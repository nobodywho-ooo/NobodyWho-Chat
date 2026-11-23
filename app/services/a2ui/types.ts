// A2UI surface types.
//
// A rendered surface is a parsed OpenUI Lang program: an ElementNode tree
// (from @openuidev/lang-core) plus a data model for reactive `$` values.
// Components nest by value; there is no id registry.

import type { ElementNode } from '@openuidev/lang-core';
import type { A2UiParseMeta, A2UiParseError } from './parse';

export type { A2UiParseError };

export type { ElementNode };

/** The wire format of a settled surface (a `render_ui` invocation argument). */
export interface A2UiSurfaceData {
  /** The OpenUI Lang source text, statements one per line. */
  lang: string;
  /** Optional root data object exposed to the surface as `$` bindings. */
  dataModel?: Record<string, unknown>;
}

export interface A2UiMapPoint {
  lat: number;
  lon: number;
}

export interface A2UiMapMarker {
  label?: string;
  lat?: number;
  lon?: number;
}

export interface A2UiSurfaceRender {
  root: ElementNode | null;
  meta: A2UiParseMeta;
}

/** The live-preview payload attached to an in-flight assistant message. */
export interface A2UiLive {
  /** Parse result for the streaming `<ui>` text so far. */
  render: A2UiSurfaceRender;
  /** True while the block is still being written. */
  live: boolean;
}

/** A render-ready surface (parsed) plus any warnings from the parser. */
export interface A2UiRendered {
  root: ElementNode;
  warnings?: string[];
}