import { renderHook, act, waitFor } from '@testing-library/react-native';
import { getDatabase } from 'database';

import { useReactiveQuery } from '../useReactiveQuery';

// getDatabase() returns the mocked op-sqlite db (see jest/mock/node-modules).
const db = getDatabase() as unknown as {
  execute: jest.Mock;
  reactiveExecute: jest.Mock;
};

beforeEach(() => {
  db.execute.mockReset().mockResolvedValue({ rows: [] });
  db.reactiveExecute.mockReset().mockReturnValue(jest.fn());
});

test('loads and maps the initial rows', async () => {
  db.execute.mockResolvedValue({ rows: [{ n: 1 }, { n: 2 }] });

  const { result } = renderHook(() =>
    useReactiveQuery<number>({
      query: 'SELECT * FROM t',
      tables: ['t'],
      map: row => row.n * 10,
    }),
  );

  await waitFor(() => expect(result.current).toEqual([10, 20]));
  expect(db.execute).toHaveBeenCalledWith('SELECT * FROM t', []);
});

test('subscribes with the query, args and fireOn tables', async () => {
  renderHook(() =>
    useReactiveQuery({
      query: 'Q',
      args: [5],
      tables: ['a', 'b'],
      map: row => row,
    }),
  );

  expect(db.reactiveExecute).toHaveBeenCalledWith(
    expect.objectContaining({
      query: 'Q',
      arguments: [5],
      fireOn: [{ table: 'a' }, { table: 'b' }],
    }),
  );
  await act(async () => {});
});

test('updates the result when the reactive callback fires', async () => {
  let captured: any;
  db.reactiveExecute.mockImplementation((config: any) => {
    captured = config;
    return jest.fn();
  });

  const { result } = renderHook(() =>
    useReactiveQuery<number>({ query: 'Q', tables: ['t'], map: row => row.n }),
  );
  await waitFor(() => expect(result.current).toEqual([]));

  act(() => captured.callback({ rows: [{ n: 7 }, { n: 8 }] }));
  expect(result.current).toEqual([7, 8]);
});

test('when disabled, returns [] without querying or subscribing', () => {
  const { result } = renderHook(() =>
    useReactiveQuery({
      query: 'Q',
      tables: ['t'],
      map: row => row,
      enabled: false,
    }),
  );

  expect(result.current).toEqual([]);
  expect(db.execute).not.toHaveBeenCalled();
  expect(db.reactiveExecute).not.toHaveBeenCalled();
});

test('unsubscribes on unmount', async () => {
  const unsubscribe = jest.fn();
  db.reactiveExecute.mockReturnValue(unsubscribe);

  const { unmount } = renderHook(() =>
    useReactiveQuery({ query: 'Q', tables: ['t'], map: row => row }),
  );
  await act(async () => {});
  unmount();

  expect(unsubscribe).toHaveBeenCalled();
});
