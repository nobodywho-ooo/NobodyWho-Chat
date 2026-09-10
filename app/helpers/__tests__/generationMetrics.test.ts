import { computeGenerationMetrics } from '../generationMetrics';

afterEach(() => {
  jest.restoreAllMocks();
});

test('returns nothing when no token ever arrived', () => {
  expect(computeGenerationMetrics(1000, undefined, 0)).toEqual({});
});

test('returns nothing when the stream produced zero tokens', () => {
  expect(computeGenerationMetrics(1000, 1200, 0)).toEqual({});
});

test('time to first token is the gap between start and the first token', () => {
  // Freeze "now" so the generation window is deterministic.
  jest.spyOn(Date, 'now').mockReturnValue(2000);
  const { timeToFirstToken } = computeGenerationMetrics(1000, 1300, 5);
  expect(timeToFirstToken).toBe(300);
});

test('tokens/sec is tokens over the time since the first token', () => {
  // First token at 1300, now at 2300 → a 1s generation window; 10 tokens → 10 tok/s.
  jest.spyOn(Date, 'now').mockReturnValue(2300);
  const { tokensPerSecond } = computeGenerationMetrics(1000, 1300, 10);
  expect(tokensPerSecond).toBeCloseTo(10);
});

test('a single-token turn clamps the window to 1ms instead of dividing by zero', () => {
  // firstTokenAt === now: without the floor this would be tokens / 0 = Infinity.
  jest.spyOn(Date, 'now').mockReturnValue(1300);
  const { tokensPerSecond, timeToFirstToken } = computeGenerationMetrics(
    1000,
    1300,
    1,
  );
  expect(timeToFirstToken).toBe(300);
  expect(tokensPerSecond).toBe(1000); // 1 token / (1ms / 1000)
  expect(Number.isFinite(tokensPerSecond)).toBe(true);
});
