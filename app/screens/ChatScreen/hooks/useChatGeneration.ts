import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Chat, Message, Prompt } from 'react-native-nobodywho';
import { FlashListRef } from '@shopify/flash-list';

import { DisplayMessage, ToolInvocation } from 'types';
import { getAppState } from 'database';
import { insertConversation, insertMessage } from 'repositories';
import { subscribeToolInvocations } from 'services';
import { haptics, log, parseThinking, resolveMessageDocumentPath } from 'helpers';

import { Attachments } from './useAttachments';

const computeGenerationMetrics = (
  startedAt: number,
  firstTokenAt: number | undefined,
  tokenCount: number,
): { tokensPerSecond?: number; timeToFirstToken?: number } => {
  if (firstTokenAt === undefined || tokenCount === 0) return {};
  const timeToFirstToken = firstTokenAt - startedAt;
  const generationMs = Math.max(Date.now() - firstTokenAt, 1);
  return {
    tokensPerSecond: tokenCount / (generationMs / 1000),
    timeToFirstToken,
  };
};

interface UseChatGenerationOptions {
  chat: React.RefObject<Chat | undefined>;
  ingestsImage: boolean;
  ingestsAudio: boolean;
  inputText: string;
  setInputText: (text: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
  conversationId: number | undefined;
  setConversationId: (id: number) => void;
  onConversationCreated: (conversationId: number) => void;
  attachments: Attachments;
  flatListRef: React.RefObject<FlashListRef<DisplayMessage> | null>;
}

export function useChatGeneration({
  chat,
  ingestsImage,
  ingestsAudio,
  inputText,
  setInputText,
  conversationId,
  setConversationId,
  onConversationCreated,
  attachments,
  setMessages,
  flatListRef,
}: UseChatGenerationOptions) {
  const { t } = useTranslation();
  const [isStreaming, setIsStreaming] = useState(false);
  const stopRequestedRef = useRef(false);

  // Halt native generation. Reads chat.current at call time (not capture time)
  // so it stops whichever chat instance is current — it may have been recreated
  // since this hook mounted.
  const haltGeneration = useCallback(() => {
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

    // TODO: check
    const userMessage: DisplayMessage = {
      role: 'user',
      content: userInput,
      documentsPath,
    };
    const initialAssistantMessage: Message = {
      role: 'assistant',
      content: '',
    };

    setMessages(prev => [...prev, userMessage, initialAssistantMessage]);
    setInputText('');

    attachments.clearAttachmentsAfterSend(documentsPath);
    Keyboard.dismiss();
    stopRequestedRef.current = false;
    setIsStreaming(true);

    const isNewConversation = conversationId === undefined;
    const id = isNewConversation
      ? await insertConversation({ title: userInput, modelId: modelIdInUse })
      : conversationId;

    if (isNewConversation) {
      setConversationId(id);
      onConversationCreated(id);
    }

    haptics.heavy();

    await insertMessage({
      conversationId: id,
      role: 'user',
      content: userInput,
      documentsPath,
    });

    const startedAt = Date.now();
    let firstTokenAt: number | undefined;
    let tokenCount = 0;
    let accumulated = '';
    let scrolledToThinking = false;
    const turnToolCalls: ToolInvocation[] = [];

    const renderAssistant = (extra?: {
      tokensPerSecond?: number;
      timeToFirstToken?: number;
    }) => {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content: accumulated,
          ...(turnToolCalls.length > 0
            ? { toolInvocations: [...turnToolCalls] }
            : {}),
          ...extra,
        };
        return next;
      });
    };

    const unsubscribe = subscribeToolInvocations(invocation => {
      turnToolCalls.push(invocation);
      renderAssistant();
    });

    const persistAssistant = async (metrics?: {
      tokensPerSecond?: number;
      timeToFirstToken?: number;
    }) => {
      if (accumulated.length === 0) {
        setMessages(prev => prev.slice(0, -1));
        return;
      }
      log(accumulated);
      await insertMessage({
        conversationId: id,
        role: 'assistant',
        content: accumulated,
        documentsPath: [],
        toolInvocations: turnToolCalls,
        ...metrics,
      });
    };

    const persistSystemMessage = async (content: string) => {
      setMessages(prev => [...prev, { role: 'system', content }]);
      await insertMessage({
        conversationId: id,
        role: 'system',
        content,
        documentsPath: [],
      });
    };

    try {
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
          
      const streamResult = activeChat.ask(askInput);

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

        if (
          !scrolledToThinking &&
          parseThinking(accumulated).thinking !== null
        ) {
          scrolledToThinking = true;
          requestAnimationFrame(() =>
            flatListRef.current?.scrollToEnd({ animated: true }),
          );
        }
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
      setIsStreaming(false);
    }
  };

  const stopStreaming = () => {
    stopRequestedRef.current = true;
    haltGeneration();
  };

  return { isStreaming, handleSend, stopStreaming };
}
