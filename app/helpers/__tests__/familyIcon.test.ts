import { getFamilyIcon } from '../familyIcon';

describe('getFamilyIcon', () => {
  test('matches mapped families, including uppercase/spaced keys', () => {
    expect(getFamilyIcon('Qwen3')).toBeDefined();
    expect(getFamilyIcon('LFM2')).toBeDefined();
    expect(getFamilyIcon('LFM3')).toBe(getFamilyIcon('LFM2.5'));
    expect(getFamilyIcon('Gemma 4')).toBeDefined();
  });

  test('gives EmbeddingGemma the Gemma logo', () => {
    expect(getFamilyIcon('EmbeddingGemma 2')).toBe(getFamilyIcon('Gemma 4'));
  });

  test('gives Qwen4 its own logo, spaced or not, and keeps Qwen3 on the Qwen one', () => {
    // Every .svg shares one Jest mock, so give each logo its own component.
    let svg: Record<string, unknown> = {};
    let resolve: typeof getFamilyIcon = getFamilyIcon;
    jest.isolateModules(() => {
      jest.doMock('svg', () => {
        const actual = jest.requireActual<Record<string, unknown>>('svg');
        return Object.fromEntries(
          Object.keys(actual).map(key => [key, () => key]),
        );
      });
      svg = require('svg');
      resolve = require('../familyIcon').getFamilyIcon;
    });
    expect(svg.qwen4).not.toBe(svg.qwen);
    expect(resolve('Qwen4')).toBe(svg.qwen4);
    expect(resolve('Qwen 4')).toBe(svg.qwen4);
    expect(resolve('Qwen4.5')).toBe(svg.qwen4);
    expect(resolve('Qwen3.5')).toBe(svg.qwen);
  });

  test('matches regardless of the casing of the family', () => {
    expect(getFamilyIcon('lfm2')).toBeDefined();
    expect(getFamilyIcon('GEMMA 4')).toBeDefined();
  });

  test('returns undefined for an unmapped family', () => {
    expect(getFamilyIcon('Mistral')).toBeUndefined();
  });
});
