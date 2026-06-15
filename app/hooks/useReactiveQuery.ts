import { useEffect, useState } from 'react';
import { getDatabase } from 'database';
import { log } from 'helpers';

interface ReactiveQueryConfig<T> {
  query: string;
  args?: any[];
  tables: string[];
  map: (row: Record<string, any>) => T;
  /** When false, returns [] and skips the subscription. Defaults to true. */
  enabled?: boolean;
}

interface ReactiveQueryResult<T> {
  rows: T[];
  /** True until the first result (initial load or reactive fire) is delivered. */
  loading: boolean;
}

/**
 * Subscribe to an op-sqlite reactive query: loads the initial rows, then
 * re-runs whenever any of `tables` is written to. Returns the mapped rows
 * alongside a `loading` flag that stays true until the first result lands —
 * letting callers distinguish "not loaded yet" from "genuinely empty".
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
}: ReactiveQueryConfig<T>): ReactiveQueryResult<T> {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(enabled);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      setLoading(false);
      return;
    }

    const db = getDatabase();
    let cancelled = false;
    let delivered = false;

    setLoading(true);

    // The initial load can resolve after the reactive subscription already
    // delivered fresher rows, or after cleanup — apply it only when neither
    // has happened.
    db.execute(query, args)
      .then(res => {
        if (!cancelled && !delivered) {
          setRows(res.rows.map(map));
        }
      })
      .catch(error => log('useReactiveQuery initial load failed', error))
      .finally(() => {
        // First result settled (success or failure) — clear loading unless the
        // reactive callback already did, or we've been cleaned up.
        if (!cancelled && !delivered) {
          setLoading(false);
        }
      });

    const unsubscribe = db.reactiveExecute({
      query,
      arguments: args,
      fireOn: tables.map(table => ({ table })),
      callback: response => {
        delivered = true;
        setRows(response.rows.map(map));
        setLoading(false);
      },
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // Serialize args so a new array identity each render doesn't re-subscribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, JSON.stringify(args), enabled]);

  return { rows, loading };
}
