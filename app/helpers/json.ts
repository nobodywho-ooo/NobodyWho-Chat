// JSON.parse that never throws: malformed database content degrades to the
// fallback instead of breaking every row of a query.
export function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
