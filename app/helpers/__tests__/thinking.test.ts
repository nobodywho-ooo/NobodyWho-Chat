import { Model, ModelPipeline } from 'types';

import {
  createThinkOpenWriter,
  hasMessageContent,
  implicitThinkOpen,
  parseThinking,
  stripThinkingBlocks,
} from '../thinking';

const model = (overrides: Partial<Model>): Model => ({
  id: 1,
  name: 'test',
  sizeGB: 1,
  parameterCountBillions: 1,
  author: 'test',
  family: 'Qwen3',
  thinking: true,
  toolCalling: true,
  huggingfaceUrl: '',
  parts: [],
  pipeline: ModelPipeline.textGeneration,
  tags: [],
  languages: [],
  supportedFileFormat: [],
  ...overrides,
});

describe('stripThinkingBlocks', () => {
  test('removes a complete think block and keeps the answer', () => {
    expect(stripThinkingBlocks('<think>reasoning here</think>The answer')).toBe(
      'The answer',
    );
  });

  test('removes multiple think blocks', () => {
    expect(stripThinkingBlocks('<think>a</think>one <think>b</think>two')).toBe(
      'one two',
    );
  });

  test('removes an unclosed trailing think block', () => {
    expect(stripThinkingBlocks('answer<think>still thinking')).toBe('answer');
  });

  test('leaves content without think blocks untouched', () => {
    expect(stripThinkingBlocks('just an answer')).toBe('just an answer');
  });

  test('removes a complete Gemma channel block', () => {
    expect(
      stripThinkingBlocks(
        '<|channel>thought reasoning here<channel|>The answer',
      ),
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

  test('has nothing to show for an empty turn', () => {
    expect(parseThinking('')).toEqual({
      thinking: null,
      rest: '',
      isThinkingComplete: true,
    });
  });

  test('drops a block whose body is only whitespace', () => {
    // A closed but empty block is a template artefact, not reasoning: showing
    // it would put an expandable block with nothing in it above the answer.
    expect(parseThinking('<think>   </think>Answer')).toEqual({
      thinking: null,
      rest: 'Answer',
      isThinkingComplete: true,
    });
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

describe('stripThinkingBlocks with an implicit opening delimiter', () => {
  test('drops reasoning that only closes its block', () => {
    expect(stripThinkingBlocks('reasoning here</think>The answer')).toBe(
      'The answer',
    );
  });

  test('drops a Gemma tool round that only closes its channel', () => {
    expect(stripThinkingBlocks('reasoning<channel|>The answer')).toBe(
      'The answer',
    );
  });

  test('folds up to every unmatched close, not just the first', () => {
    // Each round of a tool turn with no opener written closes a block the
    // prompt opened, so
    // the text between two closes is the next round's reasoning.
    expect(stripThinkingBlocks('a[/THINK]b[/THINK]c')).toBe('c');
  });
});

describe('parseThinking with an implicit opening delimiter', () => {
  test('folds reasoning that only closes its block', () => {
    expect(parseThinking('reasoning here</think>The answer')).toEqual({
      thinking: 'reasoning here',
      rest: 'The answer',
      isThinkingComplete: true,
    });
  });

  test('reads a written-back block exactly like a model-emitted one', () => {
    expect(parseThinking('<think>reasoning</think>The answer')).toEqual(
      parseThinking('reasoning</think>The answer'),
    );
  });

  test('streams a written-back block as active from the first token', () => {
    expect(parseThinking('<think>st')).toEqual({
      thinking: 'st',
      rest: '',
      isThinkingComplete: false,
    });
  });

  test('collapses a written opener the model also emitted', () => {
    expect(parseThinking('<think><think>\nreasoning</think>Answer')).toEqual({
      thinking: 'reasoning',
      rest: 'Answer',
      isThinkingComplete: true,
    });
  });

  test('folds one implicit block per tool round', () => {
    expect(
      parseThinking('need the weather</think>got it</think>It is sunny.'),
    ).toEqual({
      thinking: 'need the weather\n\ngot it',
      rest: 'It is sunny.',
      isThinkingComplete: true,
    });
  });

  test('keeps a foreign closing delimiter inside an open block as text', () => {
    // Only the pair that opened the block terminates it, so families cannot
    // cut each other's reasoning short.
    expect(
      parseThinking('<think>use [/THINK] and <channel|> here</think>Answer'),
    ).toEqual({
      thinking: 'use [/THINK] and <channel|> here',
      rest: 'Answer',
      isThinkingComplete: true,
    });
  });

  test('shows nothing yet when the repeated opener is all that has arrived', () => {
    // The written opener plus one the model emitted itself, and no reasoning
    // behind them yet: the block is open, but there is no first line to show.
    expect(parseThinking('<think> <think> ')).toEqual({
      thinking: null,
      rest: '',
      isThinkingComplete: false,
    });
  });

  test('files prose before a quoted bare terminator as reasoning', () => {
    // The documented cost of folding unmatched closes for every family: a model
    // quoting a closing delimiter in prose loses the text before it to the
    // thinking block. It stays readable there, whereas refusing to fold would
    // bury a whole answer in raw reasoning.
    expect(parseThinking('Use </think> to close.')).toEqual({
      thinking: 'Use',
      rest: 'to close.',
      isThinkingComplete: true,
    });
  });

  test('folds the first block of each family independently', () => {
    expect(parseThinking('[THINK]a[/THINK]mid<think>b</think>end')).toEqual({
      thinking: 'a\n\nb',
      rest: 'midend',
      isThinkingComplete: true,
    });
  });
});

describe('implicitThinkOpen', () => {
  test('matches LFM2.5 2.6B, the size whose template prefills', () => {
    expect(
      implicitThinkOpen(
        model({ family: 'LFM2.5', parameterCountBillions: 2.6 }),
        true,
      ),
    ).toBeDefined();
  });

  test('holds back the LFM2.5 siblings that prefill nothing', () => {
    // 1.2B Instruct and Audio share the family but end their prompts at
    // "assistant", so an opener written into their answers would never close.
    // Nothing here distinguishes them by size — the catalogue marks them
    // `thinking: false`, and that is what the gate below reads.
    for (const parameterCountBillions of [1.2, 1.5]) {
      expect(
        implicitThinkOpen(
          model({ family: 'LFM2.5', parameterCountBillions, thinking: false }),
          false,
        ),
      ).toBeUndefined();
    }
  });

  test('stands down whenever thinking is off for the turn', () => {
    expect(
      implicitThinkOpen(model({ family: 'MiniCPM5' }), true),
    ).toBeDefined();
    expect(
      implicitThinkOpen(model({ family: 'MiniCPM5' }), false),
    ).toBeUndefined();
  });

  test('covers every size of a family that shares one template', () => {
    // NeoHorse 1 ships 4B and 9B with the same generation prompt, so the row
    // carries no size pin.
    expect(
      implicitThinkOpen(
        model({ family: 'NeoHorse 1', parameterCountBillions: 4 }),
        true,
      ),
    ).toBeDefined();
    expect(
      implicitThinkOpen(
        model({ family: 'NeoHorse 1', parameterCountBillions: 9 }),
        true,
      ),
    ).toBeDefined();
    expect(
      implicitThinkOpen(model({ family: 'NeoHorse 1' }), false),
    ).toBeUndefined();
  });

  test('leaves models that emit their own opening delimiter alone', () => {
    expect(implicitThinkOpen(model({ family: 'Qwen3' }), true)).toBeUndefined();
    expect(
      implicitThinkOpen(model({ family: 'Ministral 3' }), true),
    ).toBeUndefined();
    expect(
      implicitThinkOpen(model({ family: 'Nanbeige4.1' }), true),
    ).toBeUndefined();
  });

  test('matches a family however the catalogue cases it', () => {
    // The row and the model row are compared case-folded, so a catalogue entry
    // renamed in passing does not silently stop prefilling.
    expect(implicitThinkOpen(model({ family: 'lfm2.5' }), true)).toEqual(
      implicitThinkOpen(model({ family: 'LFM2.5' }), true),
    );
    expect(implicitThinkOpen(model({ family: 'neohorse 1' }), true)).toEqual(
      implicitThinkOpen(model({ family: 'NeoHorse 1' }), true),
    );
  });

  test('does not match a family by prefix', () => {
    expect(
      implicitThinkOpen(model({ family: 'MiniCPM5 Vision' }), true),
    ).toBeUndefined();
  });
});

describe('createThinkOpenWriter', () => {
  const g9v3 = () => implicitThinkOpen(model({ family: 'G9v3' }), true);
  const gemma = () => implicitThinkOpen(model({ family: 'Gemma 4' }), true);

  test('leaves the stream untouched without an implicit opener', () => {
    const writer = createThinkOpenWriter(undefined);
    expect(writer.write('turn', '')).toBe('');
    expect(writer.write('toolResult', 'answer')).toBe('answer');
  });

  test('opens a block at the turn and at each tool round', () => {
    const writer = createThinkOpenWriter(g9v3());
    let content = writer.write('turn', '');
    expect(content).toBe('<think>');
    content = writer.write('toolResult', `${content}a</think>`);
    expect(content).toBe('<think>a</think><think>');
  });

  test('only writes where that template actually prefills', () => {
    const writer = createThinkOpenWriter(gemma());
    expect(writer.write('turn', '')).toBe('');
    expect(writer.write('toolResult', 'x')).toBe('x<|channel>thought');
  });

  test('round-trips a tool turn the parser then reads as two blocks', () => {
    // Gemma opens its own block at the turn and only closes the one the prompt
    // opens after a tool result, so a single turn mixes both shapes. What the
    // writer leaves behind has to read back as ordinary reasoning either way.
    const writer = createThinkOpenWriter(gemma());
    let content = writer.write('turn', '');
    content += '<|channel>thought checking the weather<channel|>';
    content = writer.write('toolResult', content);
    content += 'it is sunny<channel|>It is sunny.';

    expect(parseThinking(content)).toEqual({
      thinking: 'checking the weather\n\nit is sunny',
      rest: 'It is sunny.',
      isThinkingComplete: true,
    });
  });

  test('collapses the openers of a parallel tool round into one block', () => {
    // Several tools called in ONE round notify once each, while generation is
    // suspended — so the openers land back to back. The template only prefills
    // once where generation resumes, and the repeats collapse to match it.
    const writer = createThinkOpenWriter(g9v3());
    let content = `${writer.write('turn', '')}I need all three</think>`;
    for (let round = 0; round < 3; round += 1) {
      content = writer.write('toolResult', content);
    }
    content += 'all in</think>Here you go.';

    expect(parseThinking(content)).toEqual({
      thinking: 'I need all three\n\nall in',
      rest: 'Here you go.',
      isThinkingComplete: true,
    });
  });

  test('keeps earlier rounds when a turn stops on the tool openers', () => {
    // Stopped once the tools had run, before the next round wrote a token: the
    // reasoning already on screen is still worth storing.
    const writer = createThinkOpenWriter(g9v3());
    let content = `${writer.write('turn', '')}checking</think>`;
    content = writer.write('toolResult', writer.write('toolResult', content));

    expect(parseThinking(content)).toEqual({
      thinking: 'checking',
      rest: '',
      isThinkingComplete: false,
    });
    expect(hasMessageContent(content)).toBe(true);
  });

  test('leaves a block the model never closed in place', () => {
    // Stopped mid-reasoning: the block stays open, so the message reloads as a
    // thinking block rather than as an answer made of raw reasoning.
    const writer = createThinkOpenWriter(g9v3());
    const content = `${writer.write('turn', '')}I was working out that`;
    expect(parseThinking(content)).toEqual({
      thinking: 'I was working out that',
      rest: '',
      isThinkingComplete: false,
    });
  });
});

describe('hasMessageContent', () => {
  test('an opener alone is a tag, not a message', () => {
    const writer = createThinkOpenWriter(
      implicitThinkOpen(model({ family: 'G9v3' }), true),
    );
    expect(hasMessageContent(writer.write('turn', ''))).toBe(false);
  });

  test('reasoning with no answer yet is worth keeping', () => {
    expect(hasMessageContent('<think>I was working out that')).toBe(true);
  });

  test('an answer with no reasoning is worth keeping', () => {
    expect(hasMessageContent('Just the answer.')).toBe(true);
  });

  test('nothing, or whitespace, is not', () => {
    expect(hasMessageContent('')).toBe(false);
    expect(hasMessageContent('   \n ')).toBe(false);
  });
});
