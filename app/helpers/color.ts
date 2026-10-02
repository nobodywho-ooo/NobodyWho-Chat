// Just enough colour maths for the effects that blend theme colours on the fly
// (ShimmerText's veil, the voice glow's gradients): parse the formats the
// palette uses — hex and rgb()/rgba() — and write them back out with an alpha.

export interface Rgba {
  /** 0–255. */
  r: number;
  /** 0–255. */
  g: number;
  /** 0–255. */
  b: number;
  /** 0–1. */
  a: number;
}

const HEX_PATTERN = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;
const RGB_PATTERN =
  /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;

/**
 * Parse `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()` or `rgba()`. Returns
 * null for anything else (named colours, PlatformColor…).
 */
export const parseColor = (color: string): Rgba | null => {
  const value = color.trim();

  const hex = HEX_PATTERN.exec(value);
  if (hex) {
    const digits =
      hex[1].length <= 4
        ? hex[1].replace(/./g, digit => digit + digit)
        : hex[1];
    const channel = (index: number) =>
      parseInt(digits.slice(index * 2, index * 2 + 2), 16);
    return {
      r: channel(0),
      g: channel(1),
      b: channel(2),
      a: digits.length === 8 ? channel(3) / 255 : 1,
    };
  }

  const rgb = RGB_PATTERN.exec(value);
  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: rgb[4] === undefined ? 1 : Number(rgb[4]),
    };
  }

  return null;
};

/**
 * `color` as an `rgba()` string at `alpha` times its own opacity. Colours that
 * can't be parsed are returned unchanged.
 */
export const withAlpha = (color: string, alpha: number): string => {
  const rgba = parseColor(color);
  if (!rgba) {
    return color;
  }
  const a = Math.min(1, Math.max(0, rgba.a * alpha));
  return `rgba(${Math.round(rgba.r)}, ${Math.round(rgba.g)}, ${Math.round(
    rgba.b,
  )}, ${Number(a.toFixed(4))})`;
};
