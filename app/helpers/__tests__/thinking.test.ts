import { stripThinkingBlocks } from '../thinking';

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
