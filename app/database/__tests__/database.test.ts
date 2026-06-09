import { open } from '@op-engineering/op-sqlite';

import { getDatabase, closeDatabase, initDatabase } from '../database';

const openMock = open as unknown as jest.Mock;

beforeEach(() => {
  // Start every test from a closed connection so memoization is deterministic.
  closeDatabase();
  openMock.mockClear();
});

describe('getDatabase', () => {
  test('opens the database with the expected name', () => {
    getDatabase();
    expect(openMock).toHaveBeenCalledWith({ name: 'nobodywho.sqlite' });
  });

  test('memoizes the connection across calls', () => {
    const first = getDatabase();
    const second = getDatabase();

    expect(first).toBe(second);
    expect(openMock).toHaveBeenCalledTimes(1);
  });
});

describe('closeDatabase', () => {
  test('closes the connection and opens a fresh one next time', () => {
    const db = getDatabase() as any;
    db.close.mockClear();

    closeDatabase();

    expect(db.close).toHaveBeenCalledTimes(1);

    openMock.mockClear();
    getDatabase();
    expect(openMock).toHaveBeenCalledTimes(1);
  });

  test('does nothing when no connection is open', () => {
    expect(() => closeDatabase()).not.toThrow();
  });
});

describe('initDatabase', () => {
  test('creates the models, chats and messages tables in one batch', async () => {
    const db = getDatabase() as any;
    db.executeBatch.mockClear();

    await initDatabase();

    expect(db.executeBatch).toHaveBeenCalledTimes(1);

    const sql = (db.executeBatch.mock.calls[0][0] as string[][])
      .map(statement => statement[0])
      .join('\n');

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS models');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS chats');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS messages');
  });
});
