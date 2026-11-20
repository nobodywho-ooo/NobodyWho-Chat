// Resolves A2UI data bindings — the `{"@path": "/a/b"}` references that the
// wire format uses in place of values — against a scope object.
//
// Paths mirror the data model: "/a/b" walks the root scope; a relative
// "a/b" (no leading slash) is what List templates use to pull a field off the
// current item. Either way a miss resolves to `undefined` rather than
// throwing — the renderer shows the label/placeholder fallback.

export const resolvePath = (
  path: string,
  scope: unknown,
): unknown => {
  if (scope === null || scope === undefined) {
    return undefined;
  }
  if (path === '/') {
    return scope;
  }
  const segments = path.replace(/^\//, '').split('/');
  let current: unknown = scope;
  for (const segment of segments) {
    // Walk objects and arrays alike: an index segment ('1') reads an array
    // element, and returning early on anything else gives a clean miss.
    if (
      typeof current !== 'object' ||
      current === null
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
    if (current === undefined) {
      return undefined;
    }
  }
  return current;
};

/**
 * Resolve a wire `value`: literals come back untouched, `{"@path": ...}`
 * references resolve against `scope`. Used for Text, Image url, labels and
 * any other DynamicValue slot.
 */
export const resolveValue = (
  value: unknown,
  scope: unknown,
): unknown => {
  if (isBinding(value)) {
    return resolvePath(value['@path'], scope);
  }
  return value;
};

/** Whether `value` is a `{"@path": ...}` reference. */
export const isBinding = (
  value: unknown,
): value is { '@path': string } =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as { '@path'?: unknown })['@path'] === 'string' &&
  (value as { '@path': string })['@path'].length > 0;

/** The path a binding refers to, or null for literals. */
export const bindingPath = (
  value: unknown,
): string | null => (isBinding(value) ? value['@path'] : null);
