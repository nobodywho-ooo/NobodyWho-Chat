import { useCallback, useLayoutEffect, useRef } from 'react';

// A function whose identity never changes but always calls the latest `fn`.
// For handlers handed to memoized children: the child keeps bailing out of
// re-renders while the handler still sees current state when it runs. Not for
// use during render — the ref is only updated once the commit lands.
export const useStableCallback = <Args extends unknown[], R>(
  fn: (...args: Args) => R,
): ((...args: Args) => R) => {
  const ref = useRef(fn);

  useLayoutEffect(() => {
    ref.current = fn;
  });

  return useCallback((...args: Args) => ref.current(...args), []);
};
