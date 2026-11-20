// Streaming A2UI: the model writes its UI inside `<a2ui_ui>...</a2ui_ui>`
// sentinels in the normal assistant token stream — the one place an app can
// see tokens as they arrive (a native tool call swallows its JSON until the
// call completes). This module finds the sentinel block in the accumulating
// text and parses it *tolerantly*, so the card can render progressively:
// every time a component object closes, it becomes visible; everything not
// yet closed is skipped until it completes.
//
// The content between the sentinels is the same `ui` JSON the tool used to
// take (the A2UiSurface shape), so validation, rendering and persistence are
// unchanged.

import { validateUi } from './validate';
import type { A2UiSurface } from './types';

export const A2UI_OPEN = '<a2ui_ui>';
export const A2UI_CLOSE = '</a2ui_ui>';

export interface A2UiBlock {
  /** The raw text between the sentinels (growing while streaming). */
  uiText: string;
  /** True once the closing sentinel has been seen. */
  complete: boolean;
}

/**
 * The first UI block in `text`. Before the opening sentinel is seen this is
 * null; afterwards it always returns a block — `complete: false` while the
 * model is still writing it — so callers can render a live preview.
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

/**
 * Best-effort parse of the UI text. Tries the exact JSON first; when the
 * stream is mid-object, falls back to hardening: scan the `components` array
 * for the complete component objects seen so far and render those. Returns
 * null when nothing renderable has arrived yet.
 */
export const parseA2UiLive = (raw: string): A2UiSurface | null => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const surface = parseUiText(trimmed);
  return surface ?? parseUiText(hardenPartial(trimmed) ?? '');
};

const parseUiText = (text: string): A2UiSurface | null => {
  if (text.trim().length === 0) {
    return null;
  }
  try {
    const validation = validateUi(JSON.parse(text));
    return validation.valid && validation.surface ? validation.surface : null;
  } catch {
    return null;
  }
};

// Finds the matching '}' for a '{' at `from`, skipping string contents.
const findClosingBrace = (text: string, from: number): number => {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = from; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
};

// Rebuild a valid root object from the complete top-level component objects
// currently present in a partially-streamed `ui` text. `dataModel` and any
// trailing incomplete object are dropped until they complete.
const hardenPartial = (text: string): string | null => {
  const componentsKey = text.indexOf('"components"');
  if (componentsKey === -1) {
    return null;
  }
  const arrayOpen = text.indexOf('[', componentsKey);
  if (arrayOpen === -1) {
    return null;
  }

  const rest = text.slice(arrayOpen + 1);
  const objects: string[] = [];
  let at = 0;
  while (at < rest.length) {
    const open = rest.indexOf('{', at);
    if (open === -1) {
      break;
    }
    const close = findClosingBrace(rest, open);
    if (close === -1) {
      break; // the last object is still being written — leave it out
    }
    objects.push(rest.slice(open, close + 1));
    at = close + 1;
  }

  return objects.length > 0
    ? `{"components":[${objects.join(',')}]}`
    : null;
};