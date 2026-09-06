import { open } from '@op-engineering/op-sqlite';

import {
  getDatabase,
  closeDatabase,
  initDatabase,
  resetDatabase,
} from '../database';

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
  test('applies every migration on a fresh database', async () => {
    const db = getDatabase() as any;
    db.execute.mockClear().mockResolvedValue({ rows: [] });
    db.transaction.mockClear();

    await initDatabase();

    // One transaction per migration (v0 -> v1 schema, v1 -> v2 pipeline rename).
    expect(db.transaction).toHaveBeenCalledTimes(2);

    const sql = db.execute.mock.calls
      .map((call: any[]) => call[0] as string)
      .join('\n');

    // v0 -> v1 schema.
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

    // The regenerated CHECK reflects the current enum values.
    expect(sql).toContain("'speechToText'");
    expect(sql).toContain("'voiceActivityDetection'");

    // v1 -> v2 pipeline rename.
    expect(sql).toContain('PRAGMA user_version = 2');

    // Migrations run with foreign keys disabled so rebuilding a referenced table
    // does not cascade-delete dependent rows.
    expect(sql).toContain('PRAGMA foreign_keys = OFF');
    expect(sql).toContain('PRAGMA foreign_keys = ON');
  });

  test('migrates an existing v1 database to v2', async () => {
    const db = getDatabase() as any;
    db.execute.mockClear().mockResolvedValue({ rows: [{ user_version: 1 }] });
    db.transaction.mockClear();

    await initDatabase();

    // Only the v1 -> v2 migration should run.
    expect(db.transaction).toHaveBeenCalledTimes(1);

    const sql = db.execute.mock.calls
      .map((call: any[]) => call[0] as string)
      .join('\n');

    // The `models` table is rebuilt (CHECK constraints can't be altered in
    // place) and the renamed pipeline value is remapped as rows copy across.
    expect(sql).toContain('CREATE TABLE models_new');
    expect(sql).toContain("WHEN 'speech-to-text' THEN 'speechToText'");
    expect(sql).toContain('DROP TABLE models');
    expect(sql).toContain('ALTER TABLE models_new RENAME TO models');
    expect(sql).toContain('PRAGMA user_version = 2');
    expect(sql).toContain('PRAGMA foreign_keys = OFF');
    expect(sql).toContain('PRAGMA foreign_keys = ON');
  });

  test('does nothing when the schema is already up to date', async () => {
    const db = getDatabase() as any;
    db.execute.mockClear().mockResolvedValue({ rows: [{ user_version: 2 }] });
    db.transaction.mockClear();

    await initDatabase();

    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.execute).toHaveBeenCalledTimes(1);
    expect(db.execute).toHaveBeenCalledWith('PRAGMA user_version');
  });
});

describe('resetDatabase', () => {
  test('drops every table, resets the version, then re-initialises', async () => {
    const db = getDatabase() as any;
    db.transaction.mockClear();
    db.execute.mockClear().mockImplementation((sql: string) => {
      if (sql.includes('FROM sqlite_master')) {
        return Promise.resolve({
          rows: [
            { name: 'models' },
            { name: 'conversations' },
            { name: 'messages' },
            { name: 'model_downloads' },
          ],
        });
      }
      // After the wipe, `initDatabase` reads version 0 and replays migrations.
      return Promise.resolve({ rows: [] });
    });

    await resetDatabase();

    const sql = db.execute.mock.calls
      .map((call: any[]) => call[0] as string)
      .join('\n');

    // Wipe: foreign keys off, every user table dropped, version reset.
    expect(sql).toContain('PRAGMA foreign_keys = OFF');
    expect(sql).toContain('DROP TABLE IF EXISTS "models"');
    expect(sql).toContain('DROP TABLE IF EXISTS "conversations"');
    expect(sql).toContain('DROP TABLE IF EXISTS "messages"');
    expect(sql).toContain('DROP TABLE IF EXISTS "model_downloads"');
    expect(sql).toContain('PRAGMA user_version = 0');
    expect(sql).toContain('PRAGMA foreign_keys = ON');

    // Re-initialised from scratch (both migrations replayed on empty tables).
    expect(sql).toContain('CREATE TABLE models');
    expect(sql).toContain('PRAGMA user_version = 1');
    expect(sql).toContain('PRAGMA user_version = 2');
  });
});
