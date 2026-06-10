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

  test('enables foreign keys and WAL mode on open', () => {
    const db = getDatabase() as any;

    expect(db.executeSync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON');
    expect(db.executeSync).toHaveBeenCalledWith('PRAGMA journal_mode = WAL');
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
  test('applies the initial migration on a fresh database', async () => {
    const db = getDatabase() as any;
    db.execute.mockClear().mockResolvedValue({ rows: [] });
    db.transaction.mockClear();

    await initDatabase();

    expect(db.transaction).toHaveBeenCalledTimes(1);

    const sql = db.execute.mock.calls
      .map((call: any[]) => call[0] as string)
      .join('\n');

    expect(sql).toContain('CREATE TABLE models');
    expect(sql).toContain('CREATE TABLE conversations');
    expect(sql).toContain('CREATE TABLE messages');
    expect(sql).toContain('REFERENCES models(id) ON DELETE CASCADE');
    expect(sql).toContain('REFERENCES conversations(id) ON DELETE CASCADE');
    expect(sql).toContain("CHECK (role IN ('user', 'assistant', 'system', 'tool'))");
    expect(sql).toContain("CHECK (pipeline IN ('textGeneration'");
    expect(sql).toContain(
      'CREATE INDEX idx_messages_conversation_id ON messages(conversation_id)',
    );
    expect(sql).toContain('PRAGMA user_version = 1');
  });

  test('does nothing when the schema is already up to date', async () => {
    const db = getDatabase() as any;
    db.execute.mockClear().mockResolvedValue({ rows: [{ user_version: 1 }] });
    db.transaction.mockClear();

    await initDatabase();

    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(db.execute).toHaveBeenCalledWith('PRAGMA user_version');
  });
});
