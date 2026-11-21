import type { WebSource } from 'types';

import {
  attributeSourcesByBlock,
  splitIntoBlocks,
  stripCitations,
} from '../citations';

const reuters: WebSource = {
  name: 'Reuters',
  url: 'https://reuters.example/rates',
  passage:
    'The central bank raised its key interest rate to 4.5 percent on Thursday.',
  sourceNumber: 1,
};

const weather: WebSource = {
  name: 'Weather service',
  url: 'https://weather.example/paris',
  passage: 'Paris forecast: heavy rain and strong wind expected tomorrow.',
  sourceNumber: 2,
};

describe('stripCitations', () => {
  it('leaves bracketed numbers and indentation inside code alone', () => {
    const answer =
      'Make a list [1].\n\n```python\nx = [1]\nif x:\n    grid = [[0], [1]]\n```\n\nOr use `[2]` inline [2].';

    expect(stripCitations(answer)).toBe(
      'Make a list.\n\n```python\nx = [1]\nif x:\n    grid = [[0], [1]]\n```\n\nOr use `[2]` inline.',
    );
  });

  it('leaves a code fence still being streamed alone', () => {
    expect(stripCitations('Try this [1]:\n```js\nconst a = [1]')).toBe(
      'Try this:\n```js\nconst a = [1]',
    );
  });

  it('drops bracketed source numbers and the space before punctuation', () => {
    expect(stripCitations('Rates rose to 4.5% [1]. Rain is due [2].')).toBe(
      'Rates rose to 4.5%. Rain is due.',
    );
  });

  it('keeps markdown links and array-like brackets intact', () => {
    expect(stripCitations('See [the page](https://a.example) and x[1].')).toBe(
      'See [the page](https://a.example) and x[1].',
    );
  });
});

describe('splitIntoBlocks', () => {
  it('splits paragraphs and keeps a list together', () => {
    expect(splitIntoBlocks('One.\n\nTwo:\n- a\n- b\n\nThree.')).toEqual([
      'One.',
      'Two:',
      '- a\n- b',
      'Three.',
    ]);
  });
});

describe('attributeSourcesByBlock', () => {
  it('follows the source number the answer cites', () => {
    const blocks = attributeSourcesByBlock(
      'The bank moved its rate [1].\n\nExpect a wet day [2].',
      [reuters, weather],
    );

    expect(blocks).toEqual([
      { text: 'The bank moved its rate.', source: reuters },
      { text: 'Expect a wet day.', source: weather },
    ]);
  });

  it('falls back to the wording a paragraph shares with a page', () => {
    const blocks = attributeSourcesByBlock(
      'Paris will see heavy rain and strong wind tomorrow.',
      [reuters, weather],
    );

    expect(blocks).toEqual([
      {
        text: 'Paris will see heavy rain and strong wind tomorrow.',
        source: weather,
      },
    ]);
  });

  it('leaves a paragraph unattributed when nothing matches', () => {
    expect(attributeSourcesByBlock('Hello there!', [reuters])).toEqual([
      { text: 'Hello there!', source: null },
    ]);
  });

  it('skips sources whose text never reached the model', () => {
    const blocks = attributeSourcesByBlock('The bank moved its rate [1].', [
      { ...reuters, used: false },
    ]);

    expect(blocks).toEqual([
      { text: 'The bank moved its rate [1].', source: null },
    ]);
  });
});
