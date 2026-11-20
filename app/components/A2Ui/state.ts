// Local editing state for one rendered surface.
//
// The chat has no server round trip, so values the user edits (typing in a
// TextField, dragging a Slider, toggling a CheckBox) live only on this surface
// while it stays mounted: each write shadows the corresponding
// `dataModel` path. The binding resolver consults the shadow map first, then
// falls back to the data model — which is exactly what `resolveValue` in the
// context does.

import { useState } from 'react';
import { isBinding, resolvePath } from '../../services/a2ui/bindings';

export interface SurfaceState {
  /** Resolve a wire value; manual edits shadow the base data model. */
  resolveValue: (value: unknown, scope?: unknown) => unknown;
  /** Record an edit for the given data-model path. */
  setValue: (path: string, value: unknown) => void;
}

export const useSurfaceState = (): SurfaceState => {
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});

  // A binding resolves as: edit shadow → scope walk. The scope is the whole
  // data model at the top of the tree, or a List item inside a template.
  const resolveValue = (value: unknown, scope?: unknown): unknown => {
    if (isBinding(value)) {
      const path = value['@path'];
      if (path in overrides) {
        return overrides[path];
      }
      return resolvePath(path, scope);
    }
    return value;
  };

  const setValue = (path: string, value: unknown): void => {
    if (path.length === 0) {
      return;
    }
    setOverrides(previous => ({ ...previous, [path]: value }));
  };

  return { resolveValue, setValue };
};
