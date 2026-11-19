import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chat, Prompt } from 'react-native-nobodywho';
import { KeyboardController } from 'react-native-keyboard-controller';

import {
  ChatMessage,
  DisplayMessage,
  Model,
  ToolInvocation,
  WebSource,
} from 'types';
import { getAppState } from 'database';
import {
  getConversationDigest,
  insertConversation,
  insertMessage,
  setConversationDigest,
} from 'repositories';
import {
  ANSWER_RECHECK_TIME_BUDGET_MS,
  EmbeddingSlotAccess,
  NEW_CHAT_KEY,
  WebSearchTurn,
  planAnswerRecheck,
  prepareWebSearchTurn,
  restoreChatForTurn,
  restoreWebSearchTurn,
  runAnswerRecheck,
  isWebSearchReady,
  settleConversationDigest,
  stripCitations,
  updateConversationDigestInBackground,
  subscribeToolInvocations,
  useWebSearchStore,
} from 'services';
import {
  computeGenerationMetrics,
  createThinkOpenWriter,
  hasMessageContent,
  haptics,
  log,
  parseThinking,
  resolveMessageDocumentPath,
} from 'helpers';
import type { ImplicitThinkOpen } from 'helpers';

import { Attachments } from './useAttachments';

type PersistOutcome = 'written' | 'gone' | 'failed';

// Identities for messages the screen is still holding optimistically, before
// they come back from the database with a row id (see DisplayMessage.uid).
// A counter rather than a random id: uniqueness only has to hold within one
// list at one moment, which a counter gives outright, and the `new:` prefix
// keeps it clear of the `row:` ids a reload produces.
//
// Seeded from the clock rather than 0 so a Fast Refresh can't mint an id that
// is already on screen — re-evaluating this module resets the counter while
// React keeps the message list's state, and from 0 the next optimistic message
// would collide with the `new:1` still rendered. Dev-only, but free to rule out.
let optimisticMessages = Date.now();

const nextUid = (): string => `new:${++optimisticMessages}`;

const STREAM_RENDER_INTERVAL_MS = 50;

// Sends the user's turn to the model. Normally `ask` continues from the cached
// prefix. A web search whose planner borrowed the chat left the planner's
// exchange as the history, so that turn is replayed over the snapshot with
// `complete` instead.
const streamTurn = async (
  chat: Chat,
  input: string | Prompt,
  webTurn: WebSearchTurn | undefined,
): Promise<ReturnType<Chat['ask']>> => {
  if (!webTurn) {
    return chat.ask(input);
  }

  if (!webTurn.chatWasBorrowed) {
    return chat.ask(webTurn.prompt);
  }

  const { snapshot, prompt } = webTurn;
  await restoreChatForTurn(chat, snapshot);

  return chat.complete(
    [...snapshot.history, { role: 'user', content: prompt }],
    { templateVariables: snapshot.templateVariables },
  );
};

export interface ChatWebSearchOptions {
  enabled: boolean;
  chatModel: Model | undefined;
  embeddingModel: Model | undefined;
  embeddingSlot: EmbeddingSlotAccess;
}

interface UseChatGenerationOptions {
  chat: React.RefObject<Chat | undefined>;
  thinkOpen: ImplicitThinkOpen | undefined;
  ingestsImage: boolean;
  ingestsAudio: boolean;
  inputText: string;
  setInputText: (text: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
  conversationId: number | undefined;
  setConversationId: (id: number) => void;
  onConversationCreated: (conversationId: number) => void;
  attachments: Attachments;
  messages: DisplayMessage[];
  onTurnStart: (anchorIndex: number) => void;
  webSearch: ChatWebSearchOptions;
}

export function useChatGeneration({
  chat,
  thinkOpen,
  ingestsImage,
  ingestsAudio,
  inputText,
  setInputText,
  conversationId,
  setConversationId,
  onConversationCreated,
  attachments,
  setMessages,
  messages,
  onTurnStart,
  webSearch,
}: UseChatGenerationOptions) {
  const { t } = useTranslation();
  const [isStreaming, setIsStreaming] = useState(false);
  const stopRequestedRef = useRef(false);
  const searchAbortRef = useRef<AbortController | null>(null);

  // Halt native generation. Reads chat.current at call time (not capture time)
  // so it stops whichever chat instance is current — it may have been recreated
  // since this hook mounted.
  const haltGeneration = useCallback(() => {
    searchAbortRef.current?.abort();
    try {
      chat.current?.stopGeneration();
    } catch (error) {
      log('ChatScreen stopGeneration failed', error);
    }
  }, [chat]);

  // Don't let a generation keep streaming into a screen that is gone.
  useEffect(() => {
    return () => haltGeneration();
  }, [haltGeneration]);

  const handleSend = async () => {
    const userInput = inputText.trim();
    if (!userInput || isStreaming) {
      return;
    }

    const activeChat = chat.current;
    if (activeChat === undefined) {
      return;
    }

    const { modelIdInUse } = getAppState();
    if (modelIdInUse === undefined) {
      return;
    }

    const { attachedDocuments } = attachments;
    const imagePath = ingestsImage ? attachedDocuments?.imagePath : undefined;
    const audioPath = ingestsAudio ? attachedDocuments?.audioPath : undefined;

    const documentsPath = [imagePath, audioPath].filter(
      (path): path is string => typeof path === 'string',
    );

    const userMessage: DisplayMessage = {
      uid: nextUid(),
      role: 'user',
      content: userInput,
      documentsPath,
    };

    const assistantUid = nextUid();
    const initialAssistantMessage: DisplayMessage = {
      uid: assistantUid,
      role: 'assistant',
      content: '',
    };

    onTurnStart(messages.length);
    setMessages(prev => [...prev, userMessage, initialAssistantMessage]);
    setInputText('');

    attachments.clearAttachmentsAfterSend(documentsPath);

    KeyboardController.dismiss();
    stopRequestedRef.current = false;
    useWebSearchStore.getState().resetTrace();
    setIsStreaming(true);

    const dropOptimisticTurn = () =>
      setMessages(prev =>
        prev.filter(
          message =>
            message.uid !== userMessage.uid && message.uid !== assistantUid,
        ),
      );

    const isNewConversation = conversationId === undefined;
    let id: number | undefined;

    try {
      id = isNewConversation
        ? await insertConversation({ title: userInput, modelId: modelIdInUse })
        : conversationId;
    } catch (error) {
      // Outside the turn's try/finally below, so it has to settle the screen
      // itself — otherwise isStreaming stays true and blocks every later send.
      log('ChatScreen send: creating the conversation failed', error, {
        capture: true,
      });
      dropOptimisticTurn();
      setInputText(userInput);
      setIsStreaming(false);
      return;
    }

    // The model was deleted between this chat mounting and the send landing:
    // there is nothing to file the conversation under, and the chat root is
    // already routing away. Drop the two optimistic messages rather than
    // leaving them on screen above a chat that can never answer them.
    if (id === undefined) {
      log('ChatScreen send: model', modelIdInUse, 'no longer exists');
      dropOptimisticTurn();
      setIsStreaming(false);
      return;
    }

    if (isNewConversation) {
      useWebSearchStore.getState().transfer(NEW_CHAT_KEY, id);
      setConversationId(id);
      onConversationCreated(id);
    }

    haptics.heavy();

    const persist = async (
      message: Omit<ChatMessage, 'id' | 'timestamp' | 'conversationId'>,
    ): Promise<PersistOutcome> => {
      try {
        // No pre-check: insertMessage is a no-op when the conversation is gone,
        // which closes the window a check-then-write left open (and saves a
        // query per message).
        const insertId = await insertMessage({
          conversationId: id,
          ...message,
        });

        return insertId === undefined ? 'gone' : 'written';
      } catch (error) {
        log('ChatScreen message persistence failed', error, { capture: true });

        return 'failed';
      }
    };

    const userOutcome = await persist({
      role: 'user',
      content: userInput,
      documentsPath,
    });

    // Deleted before the turn even started: there is nothing left to answer
    // into, and the screen is already showing another chat. A `failed` write
    // still generates — the answer on screen beats no answer at all.
    if (userOutcome === 'gone') {
      setIsStreaming(false);
      return;
    }

    let startedAt = Date.now();
    let webSearchMs: number | undefined;
    let firstTokenAt: number | undefined;
    let tokenCount = 0;
    const turnToolCalls: ToolInvocation[] = [];
    let turnWebSources: WebSource[] = [];

    const thinkOpenWriter = createThinkOpenWriter(thinkOpen);
    let accumulated = thinkOpenWriter.write('turn', '');

    // Written by uid, never by position: the screen may have switched to
    // another conversation under a running turn, and its last row is then
    // someone else's message. A missing row means the turn is no longer on
    // screen, so there is nothing to update.
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    let lastRenderAt = 0;

    const cancelScheduledRender = () => {
      if (flushTimer !== undefined) {
        clearTimeout(flushTimer);
        flushTimer = undefined;
      }
    };

    const renderAssistant = (extra?: {
      tokensPerSecond?: number;
      timeToFirstToken?: number;
      refining?: boolean;
    }) => {
      cancelScheduledRender();
      lastRenderAt = Date.now();
      const content = accumulated;
      const toolInvocations =
        turnToolCalls.length > 0 ? [...turnToolCalls] : undefined;
      const webSources = turnWebSources.length > 0 ? turnWebSources : undefined;

      setMessages(prev => {
        const at = prev.findIndex(message => message.uid === assistantUid);

        if (at === -1) {
          return prev;
        }

        const next = [...prev];
        next[at] = {
          uid: assistantUid,
          role: 'assistant',
          content,
          ...(toolInvocations ? { toolInvocations } : {}),
          ...(webSources ? { webSources } : {}),
          ...(webSearchMs !== undefined ? { webSearchMs } : {}),
          ...extra,
        };
        return next;
      });
    };

    // Tokens arrive far faster than anyone reads them, and each render walks
    // the whole screen. The first token after a quiet spell shows at once
    // (time to first token stays honest); the rest are batched into one render
    // per STREAM_RENDER_INTERVAL_MS.
    const scheduleRender = () => {
      if (flushTimer !== undefined) {
        return;
      }

      const wait = lastRenderAt + STREAM_RENDER_INTERVAL_MS - Date.now();

      if (wait <= 0) {
        renderAssistant();
        return;
      }

      flushTimer = setTimeout(() => {
        flushTimer = undefined;
        renderAssistant();
      }, wait);
    };

    const unsubscribe = subscribeToolInvocations(invocation => {
      turnToolCalls.push(invocation);
      accumulated = thinkOpenWriter.write('toolResult', accumulated);
      renderAssistant();
    });

    const persistAssistant = async (metrics?: {
      tokensPerSecond?: number;
      timeToFirstToken?: number;
      webSearchMs?: number;
    }) => {
      if (!hasMessageContent(accumulated)) {
        setMessages(prev =>
          prev.filter(message => message.uid !== assistantUid),
        );

        return;
      }

      await persist({
        role: 'assistant',
        content: accumulated,
        documentsPath: [],
        toolInvocations: turnToolCalls,
        webSources: turnWebSources,
        ...metrics,
      });
    };

    const persistSystemMessage = async (content: string) => {
      const outcome = await persist({
        role: 'system',
        content,
        documentsPath: [],
      });

      if (outcome === 'gone') {
        return;
      }

      setMessages(prev => [
        ...prev,
        { uid: nextUid(), role: 'system', content },
      ]);
    };

    let webTurn: WebSearchTurn | undefined;
    let acceptedAnswer: string | undefined;

    // Set once the answer is complete and kept: the digest then learns from it.
    let answered = false;
    let digest: string | null = null;

    // The chat may still be writing the previous turn's digest on this chat.
    await settleConversationDigest();

    if (chat.current !== activeChat) {
      setIsStreaming(false);
      return;
    }

    digest = await getConversationDigest(id).catch(error => {
      log('ChatScreen reading the conversation digest failed', error);
      return null;
    });

    try {
      const hasMedia = !!imagePath || !!audioPath;

      if (webSearch.enabled && hasMedia) {
        useWebSearchStore.getState().showNotice('attachment');
      }

      if (webSearch.enabled && !hasMedia && webSearch.chatModel) {
        const searchAbort = new AbortController();
        searchAbortRef.current = searchAbort;
        try {
          webTurn = await prepareWebSearchTurn({
            chat: activeChat,
            question: userInput,
            chatModel: webSearch.chatModel,
            embeddingModel: webSearch.embeddingModel,
            embeddingSlot: webSearch.embeddingSlot,
            signal: searchAbort.signal,
            ...(digest ? { digest } : {}),
          });
        } finally {
          searchAbortRef.current = null;
        }

        if (chat.current !== activeChat) {
          return;
        }

        if (stopRequestedRef.current) {
          if (webTurn?.chatWasBorrowed) {
            await restoreChatForTurn(activeChat, webTurn.snapshot);
            await activeChat.setChatHistory(webTurn.snapshot.history);
          }

          setMessages(prev =>
            prev.filter(message => message.uid !== assistantUid),
          );
          await persistSystemMessage(t('screens.chat.generationStopped'));

          return;
        }

        turnWebSources = webTurn?.sources ?? [];
        webSearchMs = webTurn?.searchMs;
        startedAt = Date.now();
        renderAssistant();
      }

      const askInput =
        imagePath || audioPath
          ? new Prompt([
              Prompt.Text(userInput),
              ...(imagePath
                ? [Prompt.Image(resolveMessageDocumentPath(imagePath))]
                : []),
              ...(audioPath
                ? [Prompt.Audio(resolveMessageDocumentPath(audioPath))]
                : []),
            ])
          : userInput;

      const streamResult = await streamTurn(activeChat, askInput, webTurn);

      for await (const token of streamResult) {
        if (chat.current !== activeChat) {
          break;
        }

        if (firstTokenAt === undefined) {
          firstTokenAt = Date.now();
        }
        tokenCount += 1;
        accumulated += token;
        scheduleRender();
      }

      if (chat.current !== activeChat) {
        return;
      }

      const metrics = {
        ...computeGenerationMetrics(startedAt, firstTokenAt, tokenCount),
        ...(webSearchMs !== undefined ? { webSearchMs } : {}),
      };

      const stoppedDuringAnswer = stopRequestedRef.current;
      const recheck =
        webTurn?.grounding &&
        !stoppedDuringAnswer &&
        Date.now() - startedAt <= ANSWER_RECHECK_TIME_BUDGET_MS
          ? planAnswerRecheck(accumulated, {
              question: userInput,
              ...webTurn.grounding,
            })
          : null;

      if (recheck) {
        log('ChatScreen re-checking the answer:', recheck.reason);

        renderAssistant({ refining: true });
        let retried = '';

        try {
          retried = await runAnswerRecheck(
            activeChat,
            recheck,
            () => stopRequestedRef.current || chat.current !== activeChat,
          );
        } catch (error) {
          log('ChatScreen answer re-check failed', error);
        }

        if (chat.current !== activeChat) {
          return;
        }

        const accepted = !stopRequestedRef.current && recheck.accepts(retried);

        log('ChatScreen answer re-check', accepted ? 'accepted' : 'rejected');

        if (accepted) {
          accumulated = retried;
          acceptedAnswer = retried;
        }
      }

      renderAssistant(metrics);
      await persistAssistant(metrics);

      if (stoppedDuringAnswer) {
        await persistSystemMessage(t('screens.chat.generationStopped'));
      } else {
        answered = true;
      }

      haptics.medium();
    } catch (error) {
      log('ChatScreen generation failed', error);

      renderAssistant();
      await persistAssistant(
        webSearchMs !== undefined ? { webSearchMs } : undefined,
      );
      await persistSystemMessage(t('screens.chat.generationFailed'));
    } finally {
      cancelScheduledRender();
      unsubscribe();

      if (webTurn && chat.current === activeChat) {
        try {
          await restoreWebSearchTurn(
            activeChat,
            webTurn.prompt,
            userInput,
            acceptedAnswer,
          );
        } catch (error) {
          log('ChatScreen restoring the plain question failed', error, {
            capture: true,
          });
        }
      }

      setIsStreaming(false);

      const answer = stripCitations(parseThinking(accumulated).rest).trim();

      if (
        answered &&
        answer &&
        isWebSearchReady(webSearch.chatModel) &&
        chat.current === activeChat
      ) {
        const conversationIdForDigest = id;
        updateConversationDigestInBackground({
          chat: activeChat,
          previousDigest: digest,
          question: userInput,
          answer,
          onDigest: next =>
            setConversationDigest(conversationIdForDigest, next).catch(error =>
              log('ChatScreen saving the conversation digest failed', error),
            ),
        });
      }
    }
  };

  const stopStreaming = () => {
    stopRequestedRef.current = true;
    haltGeneration();
  };

  return { isStreaming, handleSend, stopStreaming };
}
