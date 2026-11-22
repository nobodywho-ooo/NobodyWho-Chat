// Dev-only: pumps messages pushed to the host dev server (scripts/
// devinject-server.js POST /inject) into the chat send flow, so an external
// harness can drive the app end-to-end. No-op in production (`__DEV__` gate +
// the server is only ever running on the developer's machine).

import { useEffect, useRef } from 'react';
import { pollForInjection } from '../../../services/devHook';

export interface DevTestInjectionOptions {
  isStreaming: boolean;
  /** Called with the injected text; the screen should set it and send it. */
  onInjected: (text: string) => void;
}

export const useDevTestInjection = ({
  isStreaming,
  onInjected,
}: DevTestInjectionOptions): void => {
  const stateRef = useRef({ isStreaming, onInjected });
  stateRef.current = { isStreaming, onInjected };

  useEffect(() => {
    if (!__DEV__) {
      return;
    }
    let active = true;

    const poll = async () => {
      if (stateRef.current.isStreaming) {
        return;
      }
      const text = await pollForInjection();
      if (active && text !== null) {
        stateRef.current.onInjected(text);
      }
    };

    const id = setInterval(poll, 700);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);
};