import { modelSizeLabel } from '../modelSize';

test('reads a gigabyte-scale size in gigabytes, decimals kept', () => {
  expect(modelSizeLabel(4)).toBe('4 GB');
  expect(modelSizeLabel(2.5)).toBe('2.5 GB');
  expect(modelSizeLabel(1)).toBe('1 GB');
});

test('reads a sub-gigabyte size in megabytes rather than as a fraction of a GB', () => {
  expect(modelSizeLabel(0.5)).toBe('512 MB');
  expect(modelSizeLabel(0.1)).toBe('102 MB');
  // Silero VAD, the case that rendered as "0.002 GB".
  expect(modelSizeLabel(0.002)).toBe('2 MB');
});

test('promotes a size that rounds up to a gigabyte instead of labelling it 1024 MB', () => {
  expect(modelSizeLabel(0.9999)).toBe('1 GB');
  expect(modelSizeLabel(0.999)).toBe('1023 MB');
});
