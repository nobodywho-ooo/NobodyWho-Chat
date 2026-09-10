import { concatPcm, resamplePcm } from '../pcm';

describe('concatPcm', () => {
  test('joins captured windows in order', () => {
    const joined = concatPcm([
      Int16Array.from([1, 2]),
      Int16Array.from([3]),
      Int16Array.from([4, 5, 6]),
    ]);

    expect(Array.from(joined)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test('returns an empty buffer for no windows', () => {
    expect(concatPcm([]).length).toBe(0);
  });
});

describe('resamplePcm', () => {
  test('returns the same buffer when the rates already match', () => {
    const samples = Int16Array.from([1, 2, 3]);
    expect(resamplePcm(samples, 16000, 16000)).toBe(samples);
  });

  test('averages each source span when downsampling', () => {
    // 48 kHz → 16 kHz: every three input samples become one, averaged.
    const samples = Int16Array.from([0, 3, 6, 10, 20, 30]);
    expect(Array.from(resamplePcm(samples, 48000, 16000))).toEqual([3, 20]);
  });

  test('interpolates when upsampling', () => {
    const samples = Int16Array.from([0, 100]);
    expect(Array.from(resamplePcm(samples, 8000, 16000))).toEqual([
      0, 50, 100, 100,
    ]);
  });

  test('drops the trailing partial window rather than padding it', () => {
    // 7 samples at a 3:1 ratio yield 2 whole output samples, not 3.
    const samples = Int16Array.from([1, 1, 1, 2, 2, 2, 9]);
    expect(Array.from(resamplePcm(samples, 48000, 16000))).toEqual([1, 2]);
  });

  test('is empty when the input is shorter than one output sample', () => {
    expect(resamplePcm(Int16Array.from([1, 2]), 48000, 16000).length).toBe(0);
  });

  test('leaves an empty buffer alone', () => {
    expect(resamplePcm(new Int16Array(0), 48000, 16000).length).toBe(0);
  });
});
