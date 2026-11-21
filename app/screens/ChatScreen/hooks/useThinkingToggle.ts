import { useCallback, useMemo } from 'react';
import { DEFAULT_ASSISTANT_CONFIG, getAppState, setAppState } from 'database';
import { log } from 'helpers';
import { useAppState } from 'hooks';
import { useAiService } from 'services';

import type { ChatThinkingOptions } from './useChatGeneration';

export const useThinkingToggle = () => {
  const { chatCanThink, chatThinkOpen } = useAiService();
  const thinkingOn = (useAppState().assistantConfig ?? DEFAULT_ASSISTANT_CONFIG)
    .thinking;

  const thinking = useMemo<ChatThinkingOptions>(
    () => ({ enabled: chatCanThink && thinkingOn, open: chatThinkOpen }),
    [chatCanThink, thinkingOn, chatThinkOpen],
  );

  const toggle = useCallback(() => {
    const config = getAppState().assistantConfig ?? DEFAULT_ASSISTANT_CONFIG;

    setAppState({
      assistantConfig: { ...config, thinking: !config.thinking },
    }).catch(error => log('useThinkingToggle saving failed', error));
  }, []);

  return { thinking, canThink: chatCanThink, toggle };
};
