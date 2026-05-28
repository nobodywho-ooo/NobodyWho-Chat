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
        thinking INTEGER DEFAULT 0,
        image_ingestion INTEGER DEFAULT 0,
        audio_ingestion INTEGER DEFAULT 0,
        download_links TEXT NOT NULL DEFAULT '[]',
        pipeline TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]'
      )`,
    ],
    [
      `CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        model_id INTEGER NOT NULL,
        FOREIGN KEY (model_id) REFERENCES models(id)
      )`,
    ],
    [
      `CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        chat_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tokens_per_second REAL,
        time_to_first_token REAL,
        documents_path TEXT NOT NULL DEFAULT '[]',
        FOREIGN KEY (chat_id) REFERENCES chats(id)
      )`,
    ],
  ]);
}
