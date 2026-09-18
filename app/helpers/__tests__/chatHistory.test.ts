import { File } from 'expo-file-system';

import { toChatHistory, toModelHistory } from '../chatHistory';

const base = {
  id: 0,
  timestamp: 't',
  conversationId: 1,
  documentsPath: [],
};

const weatherInvocation = {
  name: 'get_weather',
  arguments: { city: 'Paris' },
  result: '{"temperatureCelsius":12}',
};

describe('toChatHistory (display)', () => {
  test('keeps the assistant toolInvocations and does not add toolCalls', () => {
    const [assistant] = toChatHistory([
      {
        ...base,
        id: 7,
        role: 'assistant',
        content: 'It is 12°C in Paris.',
        toolInvocations: [weatherInvocation],
      },
    ]);

    expect(assistant).toEqual({
      uid: 'row:7',
      role: 'assistant',
      content: 'It is 12°C in Paris.',
      tokensPerSecond: undefined,
      timeToFirstToken: undefined,
      toolInvocations: [weatherInvocation],
    });
    expect('toolCalls' in assistant).toBe(false);
  });

  test('maps user and system messages', () => {
    expect(
      toChatHistory([
        {
          ...base,
          id: 1,
          role: 'user',
          content: 'hello',
          documentsPath: ['/a.png'],
        },
        { ...base, id: 2, role: 'system', content: 'You are helpful.' },
      ]),
    ).toEqual([
      {
        uid: 'row:1',
        role: 'user',
        content: 'hello',
        documentsPath: ['/a.png'],
      },
      { uid: 'row:2', role: 'system', content: 'You are helpful.' },
    ]);
  });

  // The row id is what the chat list keys on, so every displayed message has to
  // carry one and no two may share it — an index would not survive a turn
  // appending rows and then dropping one again.
  test('gives every message a distinct identity from its row id', () => {
    const uids = toChatHistory([
      { ...base, id: 11, role: 'user', content: 'hi' },
      { ...base, id: 12, role: 'assistant', content: 'hello' },
      { ...base, id: 13, role: 'system', content: 'stopped' },
    ]).map(message => message.uid);

    expect(uids).toEqual(['row:11', 'row:12', 'row:13']);
  });
});

describe('toModelHistory (nobodywho context)', () => {
  test('expands a tool-calling assistant turn into call → result → answer', () => {
    expect(
      toModelHistory([
        {
          ...base,
          role: 'assistant',
          content: 'It is 12°C in Paris.',
          toolInvocations: [weatherInvocation],
        },
      ]),
    ).toEqual([
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ name: 'get_weather', argumentsJson: '{"city":"Paris"}' }],
      },
      {
        role: 'tool',
        name: 'get_weather',
        content: '{"temperatureCelsius":12}',
      },
      { role: 'assistant', content: 'It is 12°C in Paris.', toolCalls: [] },
    ]);
  });

  test('expands several tools of one round into one call and one result each', () => {
    // A parallel round is still a single stored row: nobodywho expects one
    // assistant message carrying every call, then a result per call in the same
    // order, then the answer.
    const timeInvocation = {
      name: 'get_time',
      arguments: { city: 'Paris' },
      result: '{"hour":14}',
    };

    expect(
      toModelHistory([
        {
          ...base,
          role: 'assistant',
          content: 'It is 12°C at 14:00 in Paris.',
          toolInvocations: [weatherInvocation, timeInvocation],
        },
      ]),
    ).toEqual([
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { name: 'get_weather', argumentsJson: '{"city":"Paris"}' },
          { name: 'get_time', argumentsJson: '{"city":"Paris"}' },
        ],
      },
      {
        role: 'tool',
        name: 'get_weather',
        content: '{"temperatureCelsius":12}',
      },
      { role: 'tool', name: 'get_time', content: '{"hour":14}' },
      {
        role: 'assistant',
        content: 'It is 12°C at 14:00 in Paris.',
        toolCalls: [],
      },
    ]);
  });

  test('an assistant turn with no tool calls keeps an empty toolCalls', () => {
    expect(
      toModelHistory([{ ...base, role: 'assistant', content: 'hi' }]),
    ).toEqual([{ role: 'assistant', content: 'hi', toolCalls: [] }]);
  });

  test('passes user messages through and drops UI-only system notices', () => {
    expect(
      toModelHistory([
        { ...base, role: 'user', content: 'hello' },
        { ...base, role: 'system', content: 'Generation stopped.' },
      ]),
    ).toEqual([{ role: 'user', content: 'hello' }]);
  });
});

describe('toModelHistory attachments', () => {
  const DIR = '/mock-documents/message-documents';

  afterEach(() => {
    (File as unknown as { mockExists: boolean }).mockExists = true;
  });

  test('restores image and audio attachments as content parts, text first', () => {
    expect(
      toModelHistory([
        {
          ...base,
          role: 'user',
          content: 'what is this?',
          documentsPath: ['shot.png', 'clip.m4a'],
        },
      ]),
    ).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'what is this?' },
          { type: 'image', path: `${DIR}/shot.png` },
          { type: 'audio', path: `${DIR}/clip.m4a` },
        ],
      },
    ]);
  });

  test('skips plain files, which the model never saw', () => {
    expect(
      toModelHistory([
        {
          ...base,
          role: 'user',
          content: 'read this',
          documentsPath: ['notes.txt'],
        },
      ]),
    ).toEqual([{ role: 'user', content: 'read this' }]);
  });

  test('falls back to plain text when the attachment is gone from disk', () => {
    (File as unknown as { mockExists: boolean }).mockExists = false;

    expect(
      toModelHistory([
        {
          ...base,
          role: 'user',
          content: 'what is this?',
          documentsPath: ['shot.png'],
        },
      ]),
    ).toEqual([{ role: 'user', content: 'what is this?' }]);
  });
});
