import { useCallback, useSyncExternalStore } from 'react';
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

// One live subscription per distinct query, shared by every component that
// asks for it. The same few queries (the models table, the download rows) are
// read from a dozen places at once; with a subscription each, every write ran
// the SELECT and the JSON parsing of every row once per caller, and handed each
// caller its own copies, so nothing could be compared by identity across them.
//
// Keyed by query, arguments and tables — not by `map`. Callers of one query map
// its rows the same way (each query has one row mapper in repositories), and
// keying on the function would split the entry whenever a caller passes an
// inline one, which is a new function on every render.
interface Entry {
  snapshot: ReactiveQueryResult<unknown>;
  listeners: Set<() => void>;
  stop: () => void;
}

const entries = new Map<string, Entry>();

const LOADING: ReactiveQueryResult<never> = { rows: [], loading: true };
const DISABLED: ReactiveQueryResult<never> = { rows: [], loading: false };

const entryKey = (query: string, args: any[], tables: string[]): string =>
  JSON.stringify([query, args, tables]);

const publish = (entry: Entry, snapshot: ReactiveQueryResult<unknown>) => {
  entry.snapshot = snapshot;
  entry.listeners.forEach(listener => listener());
};

const openEntry = <T>(
  key: string,
  { query, args = [], tables, map }: ReactiveQueryConfig<T>,
): Entry => {
  const db = getDatabase();
  let closed = false;
  // Set by the first reactive fire, which is fresher than the initial load:
  // that load can resolve after it and must not overwrite it.
  let delivered = false;

  const entry: Entry = {
    snapshot: LOADING,
    listeners: new Set(),
    stop: () => undefined,
  };

  // Reactive queries only fire on later writes, so the current rows come from
  // a plain execute.
  db.execute(query, args)
    .then(res => {
      if (!closed && !delivered) {
        publish(entry, { rows: res.rows.map(map), loading: false });
      }
    })
    .catch(error => {
      log('useReactiveQuery initial load failed', error);
      if (!closed && !delivered) {
        publish(entry, { rows: entry.snapshot.rows, loading: false });
      }
    });

  const unsubscribe = db.reactiveExecute({
    query,
    arguments: args,
    fireOn: tables.map(table => ({ table })),
    callback: response => {
      if (closed) {
        return;
      }
      delivered = true;
      publish(entry, { rows: response.rows.map(map), loading: false });
    },
  });

  entry.stop = () => {
    closed = true;
    entries.delete(key);
    unsubscribe();
  };

  return entry;
};

/**
 * Subscribe to an op-sqlite reactive query: loads the initial rows, then
 * re-runs whenever any of `tables` is written to. Returns the mapped rows
 * alongside a `loading` flag that stays true until the first result lands —
 * letting callers distinguish "not loaded yet" from "genuinely empty".
 *
 * Every caller of the same query shares one subscription and receives the very
 * same `rows` array.
 */
export function useReactiveQuery<T>(
  config: ReactiveQueryConfig<T>,
): ReactiveQueryResult<T> {
  const { query, args = [], tables, enabled = true } = config;
  const key = entryKey(query, args, tables);

  const subscribe = useCallback(
    (listener: () => void) => {
      if (!enabled) {
        return () => undefined;
      }

      const entry = entries.get(key) ?? openEntry(key, config);
      entries.set(key, entry);
      entry.listeners.add(listener);

      return () => {
        entry.listeners.delete(listener);
        if (entry.listeners.size === 0) {
          entry.stop();
        }
      };
    },
    // The key is what identifies the query; a new `config` object (or inline
    // `map`) each render must not resubscribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, enabled],
  );

  const getSnapshot = useCallback(
    () => (enabled ? (entries.get(key)?.snapshot ?? LOADING) : DISABLED),
    [key, enabled],
  );

  return useSyncExternalStore(subscribe, getSnapshot) as ReactiveQueryResult<T>;
}
