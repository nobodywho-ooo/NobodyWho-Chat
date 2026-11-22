// Parsing and streaming for the OpenUI Lang surface source. Both wraps the
// parsers from @openuidev/lang-core (the same engine OpenUI uses), configured
// with our component library (lang.ts).

import type { ElementNode } from '@openuidev/lang-core';
import { createUiParser, createUiStreamingParser } from './lang';

export interface A2UiParseError {
  code?: string;
  message?: string;
}

export interface A2UiParseMeta {
  incomplete?: boolean;
  errors?: A2UiParseError[] | string[];
}

export interface A2UiParseResult {
  /** The evaluated component tree, or null when the source is not UI. */
  root: ElementNode | null;
  meta: A2UiParseMeta;
}

/** One-shot parse of a complete source (used at settle time). */
export const parseUiSource = (source: string): A2UiParseResult => {
  const result = createUiParser().parse(source);
  return { root: result.root ?? null, meta: result.meta };
};

/** A streaming parser for one generation: feed it the growing `<ui>` text. */
export class UiStreamParser {
  private parser = createUiStreamingParser();
  private result: A2UiParseResult = { root: null, meta: {} };

  /** Feed the full text so far; returns the current parse result. */
  set(fullText: string): A2UiParseResult {
    const result = this.parser.set(fullText);
    this.result = { root: result.root ?? null, meta: result.meta };
    return this.result;
  }

  /** Mark the stream finished (no more text will arrive). */
  finish(fullText: string): A2UiParseResult {
    const result = this.parser.set(fullText, true);
    this.result = { root: result.root ?? null, meta: result.meta };
    return this.result;
  }
}

export const firstUiWarning = (meta: A2UiParseMeta): string | undefined => {
  const first = meta.errors?.[0];
  if (!first) {
    return undefined;
  }
  return typeof first === 'string'
    ? first
    : [first.code, first.message].filter(Boolean).join(' — ');
};