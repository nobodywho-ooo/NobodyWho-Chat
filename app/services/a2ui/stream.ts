// Streaming A2UI: the model writes its UI as an Express DSL inside
// `<ui>...</ui>` sentinels in the normal assistant token stream — the one
// place an app can see tokens as they arrive. This module finds the sentinel
// block and hands its growing text to the Express parser, which is tolerant
// and streamed naturally: it parses from the start and stops at the first
// unclosed construct, so the live card fills in component-by-component as the
// block streams in.

import { parseExpressLive } from './express';
import type { A2UiSurface } from './types';

export const A2UI_OPEN = '<ui>';
export const A2UI_CLOSE = '</ui>';

export interface A2UiBlock {
  /** The raw text between the sentinels (growing while streaming). */
  uiText: string;
  /** True once the closing sentinel has been seen. */
  complete: boolean;
}

/**
 * The first UI block in `text`. Before the opening sentinel this is null;
 * afterwards it always returns a block — `complete: false` while the model is
 * still writing it — so callers can render a live preview.
 */
export const findA2UiBlock = (text: string): A2UiBlock | null => {
  const start = text.indexOf(A2UI_OPEN);
  if (start === -1) {
    return null;
  }
  const contentStart = start + A2UI_OPEN.length;
  const end = text.indexOf(A2UI_CLOSE, contentStart);
  if (end !== -1) {
    return { uiText: text.slice(contentStart, end), complete: true };
  }
  return { uiText: text.slice(contentStart), complete: false };
};

// Strip sentinel blocks from text shown to the user. The first pass removes
// closed blocks; the second removes an unterminated trailing block that a
// stream might still be writing.
export const stripA2UiBlocks = (text: string): string =>
  text
    .replace(new RegExp(`${A2UI_OPEN}[\\s\\S]*?${A2UI_CLOSE}`, 'g'), '')
    .replace(new RegExp(`${A2UI_OPEN}[\\s\\S]*$`), '');

/** Tolerantly parse the streaming Express block into a renderable surface. */
export const parseA2UiLive = (raw: string): A2UiSurface | null =>
  parseExpressLive(raw);