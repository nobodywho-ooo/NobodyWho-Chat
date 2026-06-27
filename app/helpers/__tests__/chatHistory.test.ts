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
        role: 'assistant',
        content: 'It is 12°C in Paris.',
        toolInvocations: [weatherInvocation],
      },
    ]);

    expect(assistant).toEqual({
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
        { ...base, role: 'user', content: 'hello', documentsPath: ['/a.png'] },
        { ...base, role: 'system', content: 'You are helpful.' },
      ]),
    ).toEqual([
      { role: 'user', content: 'hello', documentsPath: ['/a.png'] },
      { role: 'system', content: 'You are helpful.' },
    ]);
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
      { role: 'tool', name: 'get_weather', content: '{"temperatureCelsius":12}' },
      { role: 'assistant', content: 'It is 12°C in Paris.', toolCalls: [] },
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
        { ...base, role: 'user', content: 'hello', documentsPath: ['/a.png'] },
        { ...base, role: 'system', content: 'Generation stopped.' },
      ]),
    ).toEqual([{ role: 'user', content: 'hello', documentsPath: ['/a.png'] }]);
  });
});
