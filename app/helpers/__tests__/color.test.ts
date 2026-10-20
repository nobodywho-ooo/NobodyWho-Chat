import { colorBetween, parseColor, withAlpha } from '../color';

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

test('gives the colour at the given position between two colours', () => {
  expect(colorBetween('#000000', '#ffffff', 0)).toBe('rgba(0, 0, 0, 1)');
  expect(colorBetween('#000000', '#ffffff', 1)).toBe('rgba(255, 255, 255, 1)');
  expect(colorBetween('#b44618', '#3D0F11', 0.5)).toBe('rgba(121, 43, 21, 1)');
});

test('keeps the mix between the two colours', () => {
  expect(colorBetween('#000000', '#ffffff', -1)).toBe('rgba(0, 0, 0, 1)');
  expect(colorBetween('#000000', '#ffffff', 2)).toBe('rgba(255, 255, 255, 1)');
});

test('falls back to the first colour when one cannot be read', () => {
  expect(colorBetween('#b44618', 'transparent', 0.5)).toBe('#b44618');
});
