import { open, DB } from '@op-engineering/op-sqlite';
import { ModelPipeline } from 'types';
import { log } from '../helpers/log';

const DB_NAME = 'nobodywho.sqlite';

let _db: DB | null = null;

export function getDatabase(): DB {
  if (!_db) {
    _db = open({ name: DB_NAME });
    _db.executeSync('PRAGMA foreign_keys = ON');
    _db.executeSync('PRAGMA journal_mode = WAL');
    log('Database opened:', DB_NAME);
  }
  return _db;
}

export function closeDatabase(): void {
  if (_db) {
    _db.close();
    _db = null;
    log('Database closed');
  }
}

const PIPELINES = Object.values(ModelPipeline)
  .map(pipeline => `'${pipeline}'`)
  .join(', ');

// Append-only list of schema migrations: entry N migrates the schema from
// user_version N to N + 1. Never edit a shipped entry — add a new one.
const MIGRATIONS: string[][] = [
  // v0 -> v1: initial schema, created on a blank database.
  [
    `CREATE TABLE models (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      size_gb REAL NOT NULL,
      parameter_count_billions REAL NOT NULL,
      author TEXT NOT NULL,
      family TEXT NOT NULL,
      thinking INTEGER DEFAULT 0,
      huggingface_url TEXT NOT NULL DEFAULT '',
      parts TEXT NOT NULL DEFAULT '[]',
      pipeline TEXT NOT NULL CHECK (pipeline IN (${PIPELINES})),
      tags TEXT NOT NULL DEFAULT '[]',
      languages TEXT NOT NULL DEFAULT '[]',
      supported_file_format TEXT NOT NULL DEFAULT '[]'
    )`,
    `CREATE TABLE model_downloads (
      model_id INTEGER PRIMARY KEY,
      model TEXT NOT NULL,
      parts_progress TEXT NOT NULL DEFAULT '[]',
      running INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      model_id INTEGER NOT NULL,
      FOREIGN KEY (model_id) REFERENCES models(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
      content TEXT NOT NULL,
      tokens_per_second REAL,
      time_to_first_token REAL,
      documents_path TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX idx_messages_conversation_id ON messages(conversation_id)`,
  ],
];

export async function initDatabase(): Promise<void> {
  const db = getDatabase();
  const result = await db.execute('PRAGMA user_version');
  const version = (result.rows[0]?.user_version as number | undefined) ?? 0;

  for (let v = version; v < MIGRATIONS.length; v++) {
    await db.transaction(async tx => {
      for (const statement of MIGRATIONS[v]) {
        await tx.execute(statement);
      }
      await tx.execute(`PRAGMA user_version = ${v + 1}`);
    });
    log('Database migrated to version', v + 1);
  }
}
