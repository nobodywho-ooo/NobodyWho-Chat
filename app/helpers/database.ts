import { open, DB } from '@op-engineering/op-sqlite';
import { devLog } from './log';

const DB_NAME = 'nobodywho.sqlite';

let _db: DB | null = null;

export function getDatabase(): DB {
  if (!_db) {
    _db = open({ name: DB_NAME });
    devLog('Database opened:', DB_NAME);
  }
  return _db;
}

export function closeDatabase(): void {
  if (_db) {
    _db.close();
    _db = null;
    devLog('Database closed');
  }
}

export async function initDatabase(): Promise<void> {
  const db = getDatabase();
  await db.executeBatch([
    [
      `CREATE TABLE IF NOT EXISTS models (
        id INTEGER PRIMARY KEY,
        model_name TEXT NOT NULL,
        model_size_gb REAL NOT NULL,
        parameter_count_billions REAL NOT NULL,
        author TEXT NOT NULL,
        family TEXT NOT NULL,
        download_links TEXT NOT NULL DEFAULT '[]',
        pipeline TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]'
      )`,
    ],
  ]);
}
