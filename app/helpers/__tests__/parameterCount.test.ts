import { parameterCountLabel } from '../parameterCount';

test('reads a billion-scale count in billions, decimals kept', () => {
  expect(parameterCountLabel(4)).toBe('4B');
  expect(parameterCountLabel(1.2)).toBe('1.2B');
  expect(parameterCountLabel(1)).toBe('1B');
});

test('reads a sub-billion count in millions', () => {
  expect(parameterCountLabel(0.6)).toBe('600M');
  expect(parameterCountLabel(0.074)).toBe('74M');
  expect(parameterCountLabel(0.001)).toBe('1M');
});

test('reads a sub-million count in thousands rather than rounding it to 0M', () => {
  // Silero VAD, the case the millions-only label flattened to "(0M)".
  expect(parameterCountLabel(0.000309)).toBe('309K');
  expect(parameterCountLabel(0.0005)).toBe('500K');
});

test('has no label for a model with no known count', () => {
  // The placeholder a corrupt download row degrades to (see EMPTY_MODEL).
  expect(parameterCountLabel(0)).toBeUndefined();
  expect(parameterCountLabel(undefined)).toBeUndefined();
});
