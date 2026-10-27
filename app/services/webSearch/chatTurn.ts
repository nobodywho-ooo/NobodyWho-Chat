import type { Chat, Encoder, Message } from 'react-native-nobodywho';
import { deviceRamGB, log } from 'helpers';
import type { Model, WebSource } from 'types';

import { WEB_SEARCH_OVERALL_TIMEOUT_MS } from './constants/web';
import {
  estimatePromptTokens,
  PROMPT_TOKEN_SAFETY,
} from './constants/context-window';
import {
  createEncoderEmbeddings,
  embeddingPrefixesFor,
  type WebEmbeddings,
} from './embeddings';
import {
  getModelProfile,
  hasMemoryForEmbeddings,
  isMemoryConstrained,
  scaledGenerationReserve,
  type WebModel,
} from './modelProfile';
import { buildWebTurnPrompt } from './prompt/webTurnPrompt';
import { runWebSearch } from './runWebSearch';
import type { QueryRewriteMessage } from './buildSearchQuery';
import { webViewScrapeProvider } from './scrape/webViewScrapeProvider';
import { useWebSearchStore } from './webSearchStore';
import { todayISO } from './text/todayISO';

// One chat turn with web search: snapshot the chat, search (using the chat
// model itself as the query planner), and build the grounded user message.
// useChatGeneration then sends it and, once the answer is in, restores the
// plain question in the native history (see restoreWebSearchTurn).

export interface EmbeddingSlotAccess {
  create: (opts: { model: Model }) => Promise<boolean>;
  dispose: () => void;
  borrow: <R>(work: (encoder: Encoder) => Promise<R>) => Promise<R | undefined>;
}

export interface PrepareWebSearchTurnInput {
  chat: Chat;
  question: string;
  chatModel: Model;
  embeddingModel?: Model;
  embeddingSlot: EmbeddingSlotAccess;
  signal: AbortSignal;
}

export interface ChatSnapshot {
  history: Message[];
  systemPrompt: string | undefined;
  templateVariables: Record<string, boolean>;
}

export interface WebSearchTurn {
  // What to send instead of the bare question.
  prompt: string;
  sources: WebSource[];
  snapshot: ChatSnapshot;
  // The planner ran its own completions on the chat, which replaced its
  // history: the turn has to be sent with `complete` over the snapshot rather
  // than `ask`, or it would continue from the planner's exchange.
  chatWasBorrowed: boolean;
}

// Below this many characters of room the sources block can't hold even one
// trimmed passage; the turn is sent as the bare question instead.
const MIN_PROMPT_CHARS = 1200;

// Instructions and wrapping around the sources (measured on the longest
// combination webTurnPrompt assembles), reserved before the search sizes its
// context so the retrieval doesn't pick passages that would be cut anyway.
const ASSEMBLED_INSTRUCTION_CHARS = 2500;

// A persisted source keeps only the head of its passage — enough to show what
// the page said; the full text was only ever for the model.
const PERSISTED_PASSAGE_MAX_CHARS = 400;

const textOf = (message: Message): string => {
  const { content } = message;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(part => (part.type === 'text' ? part.text : ''))
      .join(' ')
      .trim();
  }
  return '';
};

const plannerHistory = (history: Message[]) =>
  history
    .filter(message => message.role === 'user' || message.role === 'assistant')
    .map(message => ({ role: message.role, content: textOf(message) }))
    .filter(message => message.content.length > 0);

const snapshotChat = async (chat: Chat): Promise<ChatSnapshot> => {
  const [history, systemPrompt, templateVariables] = await Promise.all([
    chat.getChatHistory(),
    chat.getSystemPrompt(),
    chat.getTemplateVariables(),
  ]);
  return { history, systemPrompt, templateVariables };
};

// Characters the grounded user message may take: what is left of the context
// once the conversation so far and the answer's reserve are counted, in the
// character density of the question (a CJK question packs ~4× the tokens).
const promptCharBudget = async (
  chat: Chat,
  question: string,
): Promise<{ chars: number; contextWindowTokens: number }> => {
  const { contextSize, contextUsed } = await chat.getStats();
  const reserve = scaledGenerationReserve(contextSize);
  const tokens = Math.floor(
    Math.max(0, contextSize - contextUsed - reserve) * PROMPT_TOKEN_SAFETY,
  );
  const density = Math.max(
    estimatePromptTokens(question) / Math.max(1, question.length),
    1 / 4,
  );
  return {
    chars: Math.floor(tokens / density),
    contextWindowTokens: contextSize,
  };
};

const toWebSource = (source: {
  name: string;
  url?: string;
  passage?: string;
  query?: string;
  used?: boolean;
  read?: boolean;
}): WebSource => ({
  name: source.name,
  ...(source.url ? { url: source.url } : {}),
  ...(source.passage
    ? { passage: source.passage.slice(0, PERSISTED_PASSAGE_MAX_CHARS) }
    : {}),
  ...(source.query ? { query: source.query } : {}),
  ...(source.used !== undefined ? { used: source.used } : {}),
  ...(source.read !== undefined ? { read: source.read } : {}),
});

export const prepareWebSearchTurn = async ({
  chat,
  question,
  chatModel,
  embeddingModel,
  embeddingSlot,
  signal,
}: PrepareWebSearchTurnInput): Promise<WebSearchTurn | undefined> => {
  const store = useWebSearchStore.getState();
  const snapshot = await snapshotChat(chat);
  const budget = await promptCharBudget(chat, question);

  if (budget.chars < MIN_PROMPT_CHARS) {
    log('Web search skipped: no room left in the context', budget);
    store.showNotice('noRoom');
    return undefined;
  }

  const ramGB = await deviceRamGB();
  const webModel: WebModel = {
    ...chatModel,
    contextWindowTokens: budget.contextWindowTokens,
  };
  const lowMemory = isMemoryConstrained(webModel, ramGB);

  const useEmbeddings =
    !!embeddingModel &&
    !lowMemory &&
    hasMemoryForEmbeddings(webModel, embeddingModel, ramGB);

  const embeddings: WebEmbeddings | null = useEmbeddings
    ? createEncoderEmbeddings({
        load: () => embeddingSlot.create({ model: embeddingModel! }),
        release: embeddingSlot.dispose,
        borrow: embeddingSlot.borrow,
        prefixes: embeddingPrefixesFor(embeddingModel!.family),
      })
    : null;

  let chatWasBorrowed = false;

  // The planner's completions go through the live chat: a second Chat on the
  // same weights would allocate a second KV cache next to the first. Thinking
  // is off for them — the plan is one JSON object, and a reasoning preamble
  // only burns the search's time budget.
  const generate = async (messages: QueryRewriteMessage[]): Promise<string> => {
    chatWasBorrowed = true;
    let out = '';
    const stream = chat.complete(
      messages.map((message): Message =>
        message.role === 'system'
          ? { role: 'system', content: message.content }
          : message.role === 'assistant'
            ? { role: 'assistant', content: message.content }
            : { role: 'user', content: message.content },
      ),
      {
        templateVariables: {
          ...snapshot.templateVariables,
          enable_thinking: false,
        },
      },
    );
    for await (const token of stream) {
      if (signal.aborted) {
        chat.stopGeneration();
        break;
      }
      out += token;
    }
    return out;
  };

  store.setSearchingWeb(true);

  try {
    const result = await runWebSearch({
      query: question,
      history: plannerHistory(snapshot.history),
      provider: webViewScrapeProvider,
      embeddings,
      embeddingModelReady: useEmbeddings,
      generate,
      onProgress: event => store.pushWebSearchEvent(event),
      signal,
      today: todayISO(),
      profile: getModelProfile(webModel),
      contextCharBudget: Math.max(
        0,
        budget.chars - ASSEMBLED_INSTRUCTION_CHARS,
      ),
      lowMemory,
      useCache: true,
      searchTimeoutMs: WEB_SEARCH_OVERALL_TIMEOUT_MS,
    });

    const { context, sourceDocuments, telemetry } = result;
    const found = sourceDocuments.length > 0;
    const webSearchFailed =
      !found && telemetry.needsSearch && !telemetry.skippedReason;

    if (signal.aborted) {
      return { prompt: question, sources: [], snapshot, chatWasBorrowed };
    }

    if (webSearchFailed) {
      store.showNotice('nothingFound');
    } else if (telemetry.skippedReason === 'provider-not-ready') {
      store.showNotice('unavailable');
    }

    const previousQuestions = snapshot.history
      .filter(message => message.role === 'user')
      .map(textOf);

    const { content } = buildWebTurnPrompt({
      question,
      previousQuestions,
      context,
      sourceDocuments,
      webIntent: found ? telemetry.intent || undefined : undefined,
      webIntentKind: found ? telemetry.intentKind : undefined,
      webSubQueries: found ? telemetry.plannedQueries : undefined,
      webWeak: found && telemetry.finalLabel === 'incorrect',
      webSearchFailed,
      charBudget: budget.chars,
    });

    return {
      prompt: found || webSearchFailed ? content : question,
      sources: sourceDocuments.map(toWebSource),
      snapshot,
      chatWasBorrowed,
    };
  } catch (error) {
    log('Web search failed', error);
    store.showNotice('nothingFound');
    return { prompt: question, sources: [], snapshot, chatWasBorrowed };
  } finally {
    store.setSearchingWeb(false);
    webViewScrapeProvider.releaseHost();
  }
};

// Puts the chat back the way the planner found it, for a turn sent through
// `complete` (see WebSearchTurn.chatWasBorrowed): the planner's leading system
// message replaced the chat's system prompt, and `complete` keeps it.
export const restoreChatForTurn = async (
  chat: Chat,
  snapshot: ChatSnapshot,
): Promise<void> => {
  await chat.setSystemPrompt(snapshot.systemPrompt);
};

// After the answer: swap the grounded message the model was sent back to the
// plain question, so the next turn's context doesn't carry this turn's
// sources (they would crowd out the conversation and go stale), and matches
// what a reload rebuilds from the database.
export const restoreWebSearchTurn = async (
  chat: Chat,
  prompt: string,
  question: string,
): Promise<void> => {
  if (prompt === question) {
    return;
  }
  const history = await chat.getChatHistory();
  let at = history.length - 1;
  while (
    at >= 0 &&
    !(history[at]!.role === 'user' && textOf(history[at]!) === prompt)
  ) {
    at -= 1;
  }
  if (at < 0) {
    return;
  }
  history[at] = { role: 'user', content: question };
  await chat.setChatHistory(history);
};
