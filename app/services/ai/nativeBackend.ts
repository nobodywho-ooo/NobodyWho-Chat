import { useCallback, useMemo, useRef } from 'react';
import { log, sleep } from 'helpers';

import { TEARDOWN_SETTLE_MS } from './tuning';

export interface NativeBackend {
  allocate: <T>(work: () => Promise<T>) => Promise<T>;
  free: (release: () => Promise<void>) => Promise<void>;
  settleAfterFree: () => Promise<void>;
}

export const useNativeBackend = (): NativeBackend => {
  // Set when a release finished without waiting out its settle, because more were still queued behind it.
  const settleDeferred = useRef(false);
  const lastQueuedWork = useRef<Promise<unknown> | undefined>(undefined);
  const pendingReleases = useRef(0);

  const enqueue = useCallback(<T>(work: () => Promise<T>): Promise<T> => {
    const waitFor = lastQueuedWork.current;

    const running = (async () => {
      if (waitFor) {
        await waitFor;
      }
      return work();
    })();

    lastQueuedWork.current = running.catch(() => undefined);
    return running;
  }, []);

  const settleAfterFree = useCallback(async () => {
    settleDeferred.current = false;
    await sleep(TEARDOWN_SETTLE_MS);
  }, []);

  const allocate = useCallback(
    <T>(work: () => Promise<T>): Promise<T> =>
      enqueue(async () => {
        // Checked rather than awaited unconditionally: awaiting even a resolved
        // promise costs a turn, and a load on an idle backend is meant to reach
        // the loader in the same tick as its caller.
        if (settleDeferred.current) {
          await settleAfterFree();
        }
        return work();
      }),
    [enqueue, settleAfterFree],
  );

  const free = useCallback(
    (release: () => Promise<void>): Promise<void> => {
      pendingReleases.current += 1;

      return enqueue(async () => {
        try {
          await release();
        } catch (error) {
          log('AiService teardown failed', error, { capture: true });
        } finally {
          pendingReleases.current -= 1;
        }

        // Only the last release of a burst waits it out — freeing allocates
        // nothing, so spacing releases apart buys nothing, and disposing all
        // four slots (backgrounding) would otherwise sleep
        // 4 × TEARDOWN_SETTLE_MS that the next load has to sit through on
        // resume.
        if (pendingReleases.current === 0) {
          await settleAfterFree();
        } else {
          settleDeferred.current = true;
        }
      });
    },
    [enqueue, settleAfterFree],
  );

  return useMemo(
    () => ({ allocate, free, settleAfterFree }),
    [allocate, free, settleAfterFree],
  );
};
