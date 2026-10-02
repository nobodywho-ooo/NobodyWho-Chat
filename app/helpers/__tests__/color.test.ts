import { parseColor, withAlpha } from '../color';

test('parses the hex forms the palette uses', () => {
  expect(parseColor('#628395')).toEqual({ r: 98, g: 131, b: 149, a: 1 });
  expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  expect(parseColor('#00000080')).toEqual({ r: 0, g: 0, b: 0, a: 128 / 255 });
});

test('parses rgb() and rgba()', () => {
  expect(parseColor('rgb(44, 44, 44)')).toEqual({ r: 44, g: 44, b: 44, a: 1 });
  expect(parseColor('rgba(230, 184, 0, 0.15)')).toEqual({
    r: 230,
    g: 184,
    b: 0,
    a: 0.15,
  });
});

test('gives up on anything else', () => {
  expect(parseColor('transparent')).toBeNull();
  expect(parseColor('#12345')).toBeNull();
});

test('applies an alpha on top of the colour’s own', () => {
  expect(withAlpha('#628395', 0.5)).toBe('rgba(98, 131, 149, 0.5)');
  expect(withAlpha('rgba(0, 0, 0, 0.5)', 0.5)).toBe('rgba(0, 0, 0, 0.25)');
  expect(withAlpha('#ffffff', 0)).toBe('rgba(255, 255, 255, 0)');
});

test('passes a colour it cannot read through untouched', () => {
  expect(withAlpha('transparent', 0.5)).toBe('transparent');
});
