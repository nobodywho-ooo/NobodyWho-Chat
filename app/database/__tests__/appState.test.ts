import { getStorage } from '../storage';
import {
  hydrateAppState,
  getAppState,
  setAppState,
  subscribeAppState,
} from '../appState';

const APP_STATE = 'appState';

const storage = getStorage() as any;

beforeEach(async () => {
  storage.getItem.mockReset().mockResolvedValue(undefined);
  storage.setItem.mockReset().mockResolvedValue(undefined);
  // Re-hydrating from an empty storage resets the in-memory state.
  await hydrateAppState();
});

describe('hydrateAppState', () => {
  test('loads the persisted state into memory', async () => {
    storage.getItem.mockResolvedValue(
      '{"modelIdInUse":7,"conversationIdInUse":3}',
    );

    await hydrateAppState();

    expect(storage.getItem).toHaveBeenCalledWith(APP_STATE);
    expect(getAppState()).toEqual({ modelIdInUse: 7, conversationIdInUse: 3 });
  });

  test('defaults to an empty state when nothing is stored', () => {
    expect(getAppState()).toEqual({});
  });

  test('defaults to an empty state when the stored value is corrupt', async () => {
    storage.getItem.mockResolvedValue('not json');

    await hydrateAppState();

    expect(getAppState()).toEqual({});
  });
});

describe('setAppState', () => {
  test('merges the patch and persists the state as JSON', async () => {
    await setAppState({ modelIdInUse: 1 });
    await setAppState({ conversationIdInUse: 2 });

    expect(getAppState()).toEqual({ modelIdInUse: 1, conversationIdInUse: 2 });
    expect(storage.setItem).toHaveBeenLastCalledWith(
      APP_STATE,
      '{"modelIdInUse":1,"conversationIdInUse":2}',
    );
  });

  test('updates both ids in a single write', async () => {
    await setAppState({ modelIdInUse: 1, conversationIdInUse: 2 });

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(getAppState()).toEqual({ modelIdInUse: 1, conversationIdInUse: 2 });
  });

  test('drops a cleared id from the persisted JSON', async () => {
    await setAppState({ modelIdInUse: 1, conversationIdInUse: 2 });
    await setAppState({ conversationIdInUse: undefined });

    expect(getAppState().conversationIdInUse).toBeUndefined();
    expect(storage.setItem).toHaveBeenLastCalledWith(
      APP_STATE,
      '{"modelIdInUse":1}',
    );
  });

  test('does not persist when nothing changes', async () => {
    await setAppState({ modelIdInUse: 5 });
    storage.setItem.mockClear();

    await setAppState({ modelIdInUse: 5 });

    expect(storage.setItem).not.toHaveBeenCalled();
  });
});

describe('subscribeAppState', () => {
  test('notifies subscribers with the next and previous state', async () => {
    await setAppState({ modelIdInUse: 1, conversationIdInUse: 2 });
    const listener = jest.fn();
    const unsubscribe = subscribeAppState(listener);

    await setAppState({ conversationIdInUse: 3 });

    expect(listener).toHaveBeenCalledWith(
      { modelIdInUse: 1, conversationIdInUse: 3 },
      { modelIdInUse: 1, conversationIdInUse: 2 },
    );
    unsubscribe();
  });

  test('notifies every active subscriber', async () => {
    const a = jest.fn();
    const b = jest.fn();
    const unsubA = subscribeAppState(a);
    const unsubB = subscribeAppState(b);

    await setAppState({ modelIdInUse: 1 });

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    unsubA();
    unsubB();
  });

  test('stops notifying after unsubscribe', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeAppState(listener);

    unsubscribe();
    await setAppState({ modelIdInUse: 9 });

    expect(listener).not.toHaveBeenCalled();
  });

  test('does not notify when the state is unchanged', async () => {
    await setAppState({ modelIdInUse: 5 });
    const listener = jest.fn();
    const unsubscribe = subscribeAppState(listener);

    await setAppState({ modelIdInUse: 5 });

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
