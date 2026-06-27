import { parseThinking, stripThinkingBlocks } from '../thinking';

describe('stripThinkingBlocks', () => {
  test('removes a complete think block and keeps the answer', () => {
    expect(
      stripThinkingBlocks('<think>reasoning here</think>The answer'),
    ).toBe('The answer');
  });

  test('removes multiple think blocks', () => {
    expect(
      stripThinkingBlocks('<think>a</think>one <think>b</think>two'),
    ).toBe('one two');
  });

  test('removes an unclosed trailing think block', () => {
    expect(stripThinkingBlocks('answer<think>still thinking')).toBe('answer');
  });

  test('leaves content without think blocks untouched', () => {
    expect(stripThinkingBlocks('just an answer')).toBe('just an answer');
  });
});

describe('parseThinking', () => {
  test('splits a single leading think block from the answer', () => {
    expect(parseThinking('<think>reasoning</think>The answer')).toEqual({
      thinking: 'reasoning',
      rest: 'The answer',
      isThinkingComplete: true,
    });
  });

  test('treats content without a think block as a plain answer', () => {
    expect(parseThinking('just an answer')).toEqual({
      thinking: null,
      rest: 'just an answer',
      isThinkingComplete: true,
    });
  });

  test('streams a still-open think block as active, with no answer yet', () => {
    expect(parseThinking('<think>still going')).toEqual({
      thinking: 'still going',
      rest: '',
      isThinkingComplete: false,
    });
  });

  test('collects every think block of a multi-round tool turn (no leak into rest)', () => {
    const content =
      '<think>need the weather</think><think>got it, now answer</think>It is sunny.';
    expect(parseThinking(content)).toEqual({
      thinking: 'need the weather\n\ngot it, now answer',
      rest: 'It is sunny.',
      isThinkingComplete: true,
    });
  });

  test('marks thinking active while the last of several blocks is still open', () => {
    const result = parseThinking('<think>round one</think><think>round two');
    expect(result.thinking).toBe('round one\n\nround two');
    expect(result.rest).toBe('');
    expect(result.isThinkingComplete).toBe(false);
  });
});
