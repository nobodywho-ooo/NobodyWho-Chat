import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deviceRamGB, log } from 'helpers';
import { useModels, useSlotModel } from 'hooks';
import {
  NEW_CHAT_KEY,
  useAiService,
  hasMemoryForWebSearch,
  isHighMemoryDevice,
  isMemoryConstrained,
  isWebSearchReady,
  useWebSearchStore,
} from 'services';
import { isEmbeddingPipeline, ModelSlot } from 'types';

import type { EmbeddingPromptOutcome } from '../components';
import type { ChatWebSearchOptions } from './useChatGeneration';

export type WebSearchUnavailableReason = 'modelTooSmall' | 'notEnoughMemory';

export interface EmbeddingPrompt {
  open: boolean;
  required: boolean;
  close: (outcome: EmbeddingPromptOutcome) => void;
}

export const useWebSearchToggle = (conversationId: number | undefined) => {
  const { slots } = useAiService();
  const chatModel = useSlotModel(ModelSlot.chat);
  const embeddingModel = useSlotModel(ModelSlot.embedding);
  const { models: installedModels } = useModels();
  const hasInstalledEmbedding = installedModels.some(model =>
    isEmbeddingPipeline(model.pipeline),
  );
  const [ramGB, setRamGB] = useState<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    deviceRamGB()
      .then(value => {
        if (!cancelled) {
          setRamGB(value);
        }
      })
      .catch(error => log('useWebSearchToggle deviceRamGB failed', error));
    return () => {
      cancelled = true;
    };
  }, []);

  const key = conversationId ?? NEW_CHAT_KEY;
  const toggledOn = useWebSearchStore(
    state => state.enabledByChat[key] ?? false,
  );

  const [promptOpen, setPromptOpen] = useState(false);
  const [promptRequired, setPromptRequired] = useState(false);
  const promptDismissedRef = useRef(false);

  let unavailableReason: WebSearchUnavailableReason | undefined;
  if (!isWebSearchReady(chatModel)) {
    unavailableReason = 'modelTooSmall';
  } else if (!hasMemoryForWebSearch(chatModel, ramGB)) {
    unavailableReason = 'notEnoughMemory';
  }

  const enabled = toggledOn && unavailableReason === undefined;

  const toggle = useCallback((): boolean | undefined => {
    const store = useWebSearchStore.getState();

    if (!enabled && unavailableReason) {
      store.showNotice(unavailableReason);
      return undefined;
    }

    store.setEnabled(conversationId, !enabled);

    if (
      enabled ||
      embeddingModel ||
      hasInstalledEmbedding ||
      isMemoryConstrained(chatModel, ramGB)
    ) {
      return !enabled;
    }

    const required = isHighMemoryDevice(chatModel, ramGB);

    if (required || !promptDismissedRef.current) {
      setPromptRequired(required);
      setPromptOpen(true);
    }

    return true;
  }, [
    enabled,
    unavailableReason,
    chatModel,
    embeddingModel,
    hasInstalledEmbedding,
    ramGB,
    conversationId,
  ]);

  const closePrompt = useCallback(
    (outcome: EmbeddingPromptOutcome) => {
      setPromptOpen(false);

      if (outcome !== 'dismissed') {
        return;
      }

      if (promptRequired) {
        useWebSearchStore.getState().setEnabled(conversationId, false);
      } else {
        promptDismissedRef.current = true;
      }
    },
    [promptRequired, conversationId],
  );

  const embeddingPrompt = useMemo<EmbeddingPrompt>(
    () => ({ open: promptOpen, required: promptRequired, close: closePrompt }),
    [promptOpen, promptRequired, closePrompt],
  );

  const embeddingSlot = slots.embedding;

  const webSearch = useMemo<ChatWebSearchOptions>(
    () => ({
      enabled,
      chatModel,
      embeddingModel,
      embeddingSlot,
    }),
    [enabled, chatModel, embeddingModel, embeddingSlot],
  );

  return {
    webSearch,
    unavailableReason,
    toggle,
    embeddingPrompt,
    chatModel,
    ramGB,
  };
};
