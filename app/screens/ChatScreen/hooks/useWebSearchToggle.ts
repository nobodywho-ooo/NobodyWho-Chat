import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deviceRamGB, log } from 'helpers';
import { useSlotModel } from 'hooks';
import {
  NEW_CHAT_KEY,
  useAiService,
  hasMemoryForWebSearch,
  isHighMemoryDevice,
  isMemoryConstrained,
  isWebSearchReady,
  useWebSearchStore,
} from 'services';
import { ModelSlot } from 'types';

import type { EmbeddingPromptOutcome } from '../components';
import type { ChatWebSearchOptions } from './useChatGeneration';

export interface EmbeddingPrompt {
  open: boolean;
  required: boolean;
  close: (outcome: EmbeddingPromptOutcome) => void;
}

export const useWebSearchToggle = (conversationId: number | undefined) => {
  const { slots } = useAiService();
  const chatModel = useSlotModel(ModelSlot.chat);
  const embeddingModel = useSlotModel(ModelSlot.embedding);
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

  const usable =
    isWebSearchReady(chatModel) && hasMemoryForWebSearch(chatModel, ramGB);
  const enabled = toggledOn && usable;

  const toggle = useCallback(() => {
    const store = useWebSearchStore.getState();

    if (!enabled) {
      if (!isWebSearchReady(chatModel)) {
        store.showNotice('modelTooSmall');
        return;
      }

      if (!hasMemoryForWebSearch(chatModel, ramGB)) {
        store.showNotice('notEnoughMemory');
        return;
      }
    }

    store.setEnabled(conversationId, !enabled);

    if (enabled || embeddingModel || isMemoryConstrained(chatModel, ramGB)) {
      return;
    }

    const required = isHighMemoryDevice(chatModel, ramGB);

    if (required || !promptDismissedRef.current) {
      setPromptRequired(required);
      setPromptOpen(true);
    }
  }, [enabled, chatModel, embeddingModel, ramGB, conversationId]);

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

  return { webSearch, toggle, embeddingPrompt, chatModel, ramGB };
};
