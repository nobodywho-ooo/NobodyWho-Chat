import { useSyncExternalStore } from 'react';
import { getAppState, subscribeAppState } from 'database';

export const useAppState = () =>
  useSyncExternalStore(subscribeAppState, getAppState);
