import { useEffect, useState } from 'react';
import { getDatabase } from 'database';

interface ReactiveQueryConfig<T> {
  query: string;
  args?: any[];
  tables: string[];
  map: (row: Record<string, any>) => T;
  /** When false, returns [] and skips the subscription. Defaults to true. */
  enabled?: boolean;
}

/**
 * Subscribe to an op-sqlite reactive query: loads the initial rows, then
 * re-runs whenever any of `tables` is written to. Returns the mapped rows.
 *
 * Reactive queries only fire on subsequent writes, so we also do an initial
 * `execute` to populate on mount.
 */
export function useReactiveQuery<T>({
  query,
  args = [],
  tables,
  map,
  enabled = true,
}: ReactiveQueryConfig<T>): T[] {
  const [rows, setRows] = useState<T[]>([]);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      return;
    }

    const db = getDatabase();
    db.execute(query, args).then(res => setRows(res.rows.map(map)));

    const unsubscribe = db.reactiveExecute({
      query,
      arguments: args,
      fireOn: tables.map(table => ({ table })),
      callback: response => setRows(response.rows.map(map)),
    });
    return unsubscribe;
    // Serialize args so a new array identity each render doesn't re-subscribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, JSON.stringify(args), enabled]);

  return rows;
}
