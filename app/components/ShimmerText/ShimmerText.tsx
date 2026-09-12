import React, { useMemo } from 'react';
import { useDerivedValue } from 'react-native-reanimated';
import {
  Canvas,
  LinearGradient,
  Text as SkiaText,
  matchFont,
  useClock,
  vec,
  type SkFont,
} from '@shopify/react-native-skia';
import { useStyled } from 'hooks';

type FontWeight = '400' | '500' | '600' | '700' | '800';

interface ShimmerTextProps {
  text: string;
  width?: number; /** Available width to wrap within (px). Defaults to the measured text width. */
  fontSize?: number;
  fontWeight?: FontWeight;
  fontFamily?: string;
  baseColor?: string;
  highlightColor?: string;
  periodMs?: number;
  maxLines?: number;
  align?: 'left' | 'center';
}

/**
 * Skia's tight glyph bounds leave no room for the trailing side bearing, so an
 * intrinsically sized canvas gets a quarter-em of slack to avoid clipping.
 */
const measureIntrinsicWidth = (font: SkFont, text: string, fontSize: number) =>
  Math.ceil(font.measureText(text).width + fontSize / 4);

function wrapText(
  text: string,
  font: SkFont,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';

  for (const word of words) {
    const candidate = cur === '' ? word : `${cur} ${word}`;
    if (cur === '' || font.measureText(candidate).width <= maxWidth) {
      cur = candidate;
    } else {
      lines.push(cur);
      cur = word;
      if (lines.length === maxLines) {
        cur = '';
        break;
      }
    }
  }
  if (cur !== '' && lines.length < maxLines) {
    lines.push(cur);
  }

  if (lines.length === maxLines && cur === '' && lines[maxLines - 1] != null) {
    let last = lines[maxLines - 1];
    while (last.length > 0 && font.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1).trimEnd();
    }
    lines[maxLines - 1] = `${last}…`;
  }
  return lines.length > 0 ? lines : [''];
}

export const ShimmerText: React.FC<ShimmerTextProps> = ({
  text,
  width,
  fontSize = 14,
  fontWeight = '600',
  fontFamily = 'sans-serif',
  baseColor,
  highlightColor,
  periodMs = 1500,
  maxLines = 3,
  align = 'left',
}) => {
  const { colors } = useStyled();
  const base = baseColor ?? colors.onSurfaceVariant;
  const highlight = highlightColor ?? colors.onSurface;

  const font = useMemo(
    () => matchFont({ fontFamily, fontSize, fontWeight }),
    [fontFamily, fontSize, fontWeight],
  );

  const { lines, canvasWidth, lineHeight, baseline, height } = useMemo(() => {
    const fontMetrics = font.getMetrics();
    const computedLineHeight = Math.ceil(
      fontMetrics.descent - fontMetrics.ascent,
    );
    const resolvedWidth = width ?? measureIntrinsicWidth(font, text, fontSize);
    const wrapped =
      width === undefined ? [text] : wrapText(text, font, width, maxLines);
    return {
      lines: wrapped,
      canvasWidth: resolvedWidth,
      lineHeight: computedLineHeight,
      baseline: Math.ceil(-fontMetrics.ascent),
      height: wrapped.length * computedLineHeight,
    };
  }, [font, text, width, fontSize, maxLines]);

  const band = Math.max(60, canvasWidth * 0.5);
  const travel = canvasWidth + band * 2;
  const clock = useClock();
  const startX = useDerivedValue(
    () => -band + ((clock.value % periodMs) / periodMs) * travel,
  );
  const gradientStart = useDerivedValue(() => vec(startX.value, 0));
  const gradientEnd = useDerivedValue(() => vec(startX.value + band, 0));

  return (
    <Canvas style={{ width: canvasWidth, height }}>
      {lines.map((line, i) => {
        const lineWidth = font.measureText(line).width;
        const x = align === 'left' ? 0 : (canvasWidth - lineWidth) / 2;
        const y = baseline + i * lineHeight;
        return (
          <SkiaText key={`${i}:${line}`} x={x} y={y} text={line} font={font}>
            <LinearGradient
              start={gradientStart}
              end={gradientEnd}
              colors={[base, highlight, base]}
              positions={[0, 0.5, 1]}
            />
          </SkiaText>
        );
      })}
    </Canvas>
  );
};
