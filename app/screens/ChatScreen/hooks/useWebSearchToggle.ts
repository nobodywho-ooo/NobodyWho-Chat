import { useCallback, useEffect, useMemo, useState } from 'react';
import { deviceRamGB, log } from 'helpers';
import { useSlotModel } from 'hooks';
import {
  NEW_CHAT_KEY,
  useAiService,
  WEB_SEARCH_ENABLED,
  hasMemoryForWebSearch,
  isWebSearchReady,
  useWebSearchStore,
} from 'services';
import { ModelSlot } from 'types';

import type { ChatWebSearchOptions } from './useChatGeneration';

// The globe toggle of one conversation, and what a send needs to search with.
// Turning it on is refused (with a notice) for a chat model too small to
// answer from pages, or one that already fills the device's memory.
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

  const usable =
    WEB_SEARCH_ENABLED &&
    isWebSearchReady(chatModel) &&
    hasMemoryForWebSearch(chatModel, ramGB);
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
  }, [enabled, chatModel, ramGB, conversationId]);

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

  return { webSearch, toggle, available: WEB_SEARCH_ENABLED };
};
