import { getStorage } from '../storage';

describe('getStorage', () => {
  test('returns the same memoized instance', () => {
    expect(getStorage()).toBe(getStorage());
  });
});
