import {
  settleConversationDigest,
  updateConversationDigestInBackground,
} from '../digestJob';

jest.mock('helpers', () => ({
  ...jest.requireActual('helpers/thinking'),
  log: jest.fn(),
}));

const history = [
  { role: 'user', content: 'I want strong coffee without a machine.' },
  { role: 'assistant', content: 'Try a moka pot.' },
];

// A stand-in for the native chat: `complete` streams the given tokens, and a
// gate lets a test hold the stream mid-way.
const makeChat = (tokens: string[], gate?: Promise<void>) => {
  let stopped = false;
  const chat = {
    getChatHistory: jest.fn(async () => history),
    getSystemPrompt: jest.fn(async () => 'You are helpful.'),
    getTemplateVariables: jest.fn(async () => ({ enable_thinking: true })),
    setChatHistory: jest.fn(async () => {}),
    setSystemPrompt: jest.fn(async () => {}),
    setTemplateVariable: jest.fn(async () => {}),
    stopGeneration: jest.fn(() => {
      stopped = true;
    }),
    complete: jest.fn(() =>
      (async function* () {
        for (const [index, token] of tokens.entries()) {
          if (index === 1 && gate) {
            await gate;
          }
          if (stopped) {
            return;
          }
          yield token;
        }
      })(),
    ),
  };
  return chat;
};

const flush = async () => {
  for (let i = 0; i < 20; i++) {
    await new Promise<void>(resolve => setImmediate(() => resolve()));
  }
};

const input = (chat: ReturnType<typeof makeChat>, onDigest = jest.fn()) => ({
  chat: chat as never,
  previousDigest: null,
  question: 'how fine should the grind be?',
  answer: 'Fine, but coarser than for espresso.',
  onDigest,
});

test('writes the new topic and puts the chat back as it was', async () => {
  const chat = makeChat(['cast iron pan, ', 'seasoning\n', 'User: more']);
  const onDigest = jest.fn();

  await updateConversationDigestInBackground(input(chat, onDigest));
  await flush();

  expect(onDigest).toHaveBeenCalledWith('cast iron pan, seasoning');
  expect(chat.complete).toHaveBeenCalledWith(expect.any(Array), {
    templateVariables: { enable_thinking: false },
  });
  // Stopped as soon as the topic line ended, not after the made-up next turn
  expect(chat.stopGeneration).toHaveBeenCalled();
  expect(chat.setChatHistory).toHaveBeenCalledWith(history);
  expect(chat.setSystemPrompt).toHaveBeenCalledWith('You are helpful.');
  expect(chat.setTemplateVariable).toHaveBeenCalledWith(
    'enable_thinking',
    true,
  );
});

test('a run cut off by the next send keeps the previous digest but still restores', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const chat = makeChat(['moka pot ', 'coffee\n'], gate);
  const onDigest = jest.fn();

  await updateConversationDigestInBackground(input(chat, onDigest));
  await flush();
  expect(chat.complete).toHaveBeenCalled();
  const settled = settleConversationDigest();
  release();
  await settled;

  expect(onDigest).not.toHaveBeenCalled();
  expect(chat.setChatHistory).toHaveBeenCalledWith(history);
});

test('settling with nothing running resolves at once', async () => {
  await expect(settleConversationDigest()).resolves.toBeUndefined();
});
