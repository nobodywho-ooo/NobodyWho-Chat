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

  test('removes a complete Gemma channel block', () => {
    expect(
      stripThinkingBlocks('<|channel>thought reasoning here<channel|>The answer'),
    ).toBe('The answer');
  });

  test('removes an unclosed trailing Gemma channel block', () => {
    expect(stripThinkingBlocks('answer<|channel>thought still thinking')).toBe(
      'answer',
    );
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

  test('splits a Gemma channel block from the answer', () => {
    expect(
      parseThinking('<|channel>thought reasoning<channel|>The answer'),
    ).toEqual({
      thinking: 'reasoning',
      rest: 'The answer',
      isThinkingComplete: true,
    });
  });

  test('streams a still-open Gemma channel block as active', () => {
    expect(parseThinking('<|channel>thought still going')).toEqual({
      thinking: 'still going',
      rest: '',
      isThinkingComplete: false,
    });
  });

  test('folds a real multi-paragraph Gemma answer, keeping only the story', () => {
    const content =
      '<|channel>thought\nThinking Process:\n1. Analyze the request.\n2. Draft it.<channel|>## The Cartographer\n\nElara lived on the edge of a forgotten town.';
    const result = parseThinking(content);
    expect(result.isThinkingComplete).toBe(true);
    expect(result.thinking).toContain('Thinking Process');
    expect(result.rest).toBe(
      '## The Cartographer\n\nElara lived on the edge of a forgotten town.',
    );
  });

  test('splits a Ministral THINK block from the answer', () => {
    expect(
      parseThinking('[THINK]Okay, so the user needs help[/THINK]The answer'),
    ).toEqual({
      thinking: 'Okay, so the user needs help',
      rest: 'The answer',
      isThinkingComplete: true,
    });
  });

  test('streams a still-open Ministral THINK block as active', () => {
    expect(parseThinking('[THINK]still going')).toEqual({
      thinking: 'still going',
      rest: '',
      isThinkingComplete: false,
    });
  });
});
