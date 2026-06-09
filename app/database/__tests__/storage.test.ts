import {
  getStorage,
  getModelIdInUse,
  setModelIdInUse,
  subscribeModelIdInUse,
  getConversationIdInUse,
  setConversationIdInUse,
  subscribeConversationIdInUse,
} from '../storage';

const MODEL_ID_IN_USE = 'modelIdInUse';
const CONVERSATION_ID_IN_USE = 'conversationIdInUse';

const storage = getStorage() as any;

beforeEach(() => {
  storage.getItem.mockReset();
  storage.setItem.mockReset().mockResolvedValue(undefined);
});

describe('getStorage', () => {
  test('returns the same memoized instance', () => {
    expect(getStorage()).toBe(getStorage());
  });
});

describe('getModelIdInUse', () => {
  test('returns the stored id parsed as an integer', async () => {
    storage.getItem.mockResolvedValue('7');

    await expect(getModelIdInUse()).resolves.toBe(7);
    expect(storage.getItem).toHaveBeenCalledWith(MODEL_ID_IN_USE);
  });

  test('returns undefined when nothing is stored', async () => {
    storage.getItem.mockResolvedValue(undefined);

    await expect(getModelIdInUse()).resolves.toBeUndefined();
  });
});

describe('setModelIdInUse', () => {
  test('writes the id as a string under the model-id key', async () => {
    await setModelIdInUse(42);

    expect(storage.setItem).toHaveBeenCalledWith(MODEL_ID_IN_USE, '42');
  });
});

describe('subscribeModelIdInUse', () => {
  test('notifies subscribers when the model id changes', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeModelIdInUse(listener);

    await setModelIdInUse(3);

    expect(listener).toHaveBeenCalledWith(3);
    unsubscribe();
  });

  test('notifies every active subscriber', async () => {
    const a = jest.fn();
    const b = jest.fn();
    const unsubA = subscribeModelIdInUse(a);
    const unsubB = subscribeModelIdInUse(b);

    await setModelIdInUse(1);

    expect(a).toHaveBeenCalledWith(1);
    expect(b).toHaveBeenCalledWith(1);
    unsubA();
    unsubB();
  });

  test('stops notifying after unsubscribe', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeModelIdInUse(listener);

    unsubscribe();
    await setModelIdInUse(9);

    expect(listener).not.toHaveBeenCalled();
  });

  test('does not notify when the model id is unchanged', async () => {
    storage.getItem.mockResolvedValue('5');
    const listener = jest.fn();
    const unsubscribe = subscribeModelIdInUse(listener);

    await setModelIdInUse(5);

    expect(storage.setItem).toHaveBeenCalledWith(MODEL_ID_IN_USE, '5');
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});

describe('getConversationIdInUse', () => {
  test('returns the stored id parsed as an integer', async () => {
    storage.getItem.mockResolvedValue('7');

    await expect(getConversationIdInUse()).resolves.toBe(7);
    expect(storage.getItem).toHaveBeenCalledWith(CONVERSATION_ID_IN_USE);
  });

  test('returns undefined when nothing is stored', async () => {
    storage.getItem.mockResolvedValue(undefined);

    await expect(getConversationIdInUse()).resolves.toBeUndefined();
  });
});

describe('setConversationIdInUse', () => {
  test('writes the id as a string under the conversation-id key', async () => {
    await setConversationIdInUse(42);

    expect(storage.setItem).toHaveBeenCalledWith(CONVERSATION_ID_IN_USE, '42');
  });
});

describe('subscribeConversationIdInUse', () => {
  test('notifies subscribers when the conversation id changes', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeConversationIdInUse(listener);

    await setConversationIdInUse(3);

    expect(listener).toHaveBeenCalledWith(3);
    unsubscribe();
  });

  test('notifies every active subscriber', async () => {
    const a = jest.fn();
    const b = jest.fn();
    const unsubA = subscribeConversationIdInUse(a);
    const unsubB = subscribeConversationIdInUse(b);

    await setConversationIdInUse(1);

    expect(a).toHaveBeenCalledWith(1);
    expect(b).toHaveBeenCalledWith(1);
    unsubA();
    unsubB();
  });

  test('stops notifying after unsubscribe', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeConversationIdInUse(listener);

    unsubscribe();
    await setConversationIdInUse(9);

    expect(listener).not.toHaveBeenCalled();
  });

  test('does not notify when the conversation id is unchanged', async () => {
    storage.getItem.mockResolvedValue('5');
    const listener = jest.fn();
    const unsubscribe = subscribeConversationIdInUse(listener);

    await setConversationIdInUse(5);

    expect(storage.setItem).toHaveBeenCalledWith(CONVERSATION_ID_IN_USE, '5');
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
