import { getFamilyIcon } from '../familyIcon';

describe('getFamilyIcon', () => {
  test('matches mapped families, including uppercase/spaced keys', () => {
    expect(getFamilyIcon('Qwen3')).toBeDefined();
    expect(getFamilyIcon('LFM2')).toBeDefined();
    expect(getFamilyIcon('Gemma 4')).toBeDefined();
  });

  test('matches regardless of the casing of the family', () => {
    expect(getFamilyIcon('lfm2')).toBeDefined();
    expect(getFamilyIcon('GEMMA 4')).toBeDefined();
  });

  test('returns undefined for an unmapped family', () => {
    expect(getFamilyIcon('Mistral')).toBeUndefined();
  });
});
