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
import { insertConversation, insertMessage } from 'repositories';
import {
  EmbeddingSlotAccess,
  NEW_CHAT_KEY,
  WebSearchTurn,
  prepareWebSearchTurn,
  restoreChatForTurn,
  restoreWebSearchTurn,
  subscribeToolInvocations,
  useWebSearchStore,
} from 'services';
import {
  computeGenerationMetrics,
  createThinkOpenWriter,
  hasMessageContent,
  haptics,
  log,
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

export interface ChatWebSearchOptions {
  // The toggle for this conversation (see useWebSearchToggle).
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
  // Aborts the web search of the turn in flight, if it is still searching.
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
    if (!userInput || isStreaming) return;

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

    const isNewConversation = conversationId === undefined;
    const id = isNewConversation
      ? await insertConversation({ title: userInput, modelId: modelIdInUse })
      : conversationId;

    // The model was deleted between this chat mounting and the send landing:
    // there is nothing to file the conversation under, and the chat root is
    // already routing away. Drop the two optimistic messages rather than
    // leaving them on screen above a chat that can never answer them.
    if (id === undefined) {
      log('ChatScreen send: model', modelIdInUse, 'no longer exists');
      setMessages(prev => prev.slice(0, -2));
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

    const startedAt = Date.now();
    let firstTokenAt: number | undefined;
    let tokenCount = 0;
    const turnToolCalls: ToolInvocation[] = [];
    let turnWebSources: WebSource[] = [];

    const thinkOpenWriter = createThinkOpenWriter(thinkOpen);
    let accumulated = thinkOpenWriter.write('turn', '');

    const renderAssistant = (extra?: {
      tokensPerSecond?: number;
      timeToFirstToken?: number;
    }) => {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          uid: assistantUid,
          role: 'assistant',
          content: accumulated,
          ...(turnToolCalls.length > 0
            ? { toolInvocations: [...turnToolCalls] }
            : {}),
          ...(turnWebSources.length > 0 ? { webSources: turnWebSources } : {}),
          ...extra,
        };
        return next;
      });
    };

    const unsubscribe = subscribeToolInvocations(invocation => {
      turnToolCalls.push(invocation);
      accumulated = thinkOpenWriter.write('toolResult', accumulated);
      renderAssistant();
    });

    const persistAssistant = async (metrics?: {
      tokensPerSecond?: number;
      timeToFirstToken?: number;
    }) => {
      if (!hasMessageContent(accumulated)) {
        setMessages(prev => prev.slice(0, -1));
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

    try {
      // Attachments take the turn: the question is about the picture or the
      // recording, and the multimodal context has no room for pages besides.
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
          setMessages(prev => prev.slice(0, -1));
          await persistSystemMessage(t('screens.chat.generationStopped'));
          return;
        }

        turnWebSources = webTurn?.sources ?? [];
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

      // A planner that borrowed the chat left its own exchange as the history,
      // so the turn is replayed over the snapshot; otherwise `ask` continues
      // from the cached prefix as any turn does.
      const streamResult = webTurn?.chatWasBorrowed
        ? await (async () => {
            await restoreChatForTurn(activeChat, webTurn!.snapshot);
            return activeChat.complete(
              [
                ...webTurn!.snapshot.history,
                { role: 'user', content: webTurn!.prompt },
              ],
              { templateVariables: webTurn!.snapshot.templateVariables },
            );
          })()
        : activeChat.ask(webTurn ? webTurn.prompt : askInput);

      for await (const token of streamResult) {
        if (chat.current !== activeChat) {
          break;
        }

        if (firstTokenAt === undefined) {
          firstTokenAt = Date.now();
        }
        tokenCount += 1;
        accumulated += token;
        renderAssistant();
      }

      if (chat.current !== activeChat) {
        return;
      }

      const metrics = computeGenerationMetrics(
        startedAt,
        firstTokenAt,
        tokenCount,
      );

      renderAssistant(metrics);
      await persistAssistant(metrics);

      if (stopRequestedRef.current) {
        await persistSystemMessage(t('screens.chat.generationStopped'));
      }

      haptics.medium();
    } catch (error) {
      log('ChatScreen generation failed', error);

      await persistAssistant();
      await persistSystemMessage(t('screens.chat.generationFailed'));
    } finally {
      unsubscribe();

      if (webTurn && chat.current === activeChat) {
        try {
          await restoreWebSearchTurn(activeChat, webTurn.prompt, userInput);
        } catch (error) {
          log('ChatScreen restoring the plain question failed', error, {
            capture: true,
          });
        }
      }

      setIsStreaming(false);
    }
  };

  const stopStreaming = () => {
    stopRequestedRef.current = true;
    haltGeneration();
  };

  return { isStreaming, handleSend, stopStreaming };
}
