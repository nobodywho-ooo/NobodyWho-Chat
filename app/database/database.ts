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

// Regenerated from the enum on every fresh install, so extending ModelPipeline
// extends the CHECK below without a new migration. A database created BEFORE an
// enum addition has the old list frozen in (user_version already 1) — inserting
// a model with a newer pipeline fails its CHECK. Fine pre-release: wipe the app.
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
      tool_calling INTEGER DEFAULT 0,
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
      parts_progress TEXT NOT NULL DEFAULT '[]'
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
      tool_invocations TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX idx_messages_conversation_id ON messages(conversation_id)`,
  ],
  // v1 -> v2: rename the `speech-to-text` pipeline value to `speechToText` (a
  // typo mirrored from the backend) and drop the `automatic-speech-recognition`
  // value in favour of `voiceActivityDetection`. The `pipeline` CHECK constraint
  // is frozen at table-creation time and SQLite can't ALTER a CHECK in place, so
  // `models` is rebuilt with a CHECK regenerated from the current enum and rows
  // are remapped as they copy across. Foreign keys are disabled around the
  // migration (see initDatabase), so dropping `models` here does not cascade
  // through `conversations`/`messages`.
  [
    // Belt-and-suspenders: a rolled-back or force-quit prior attempt can't leave
    // `models_new` behind (the whole migration is one transaction), but guard
    // anyway so a re-run always starts from a clean slate.
    `DROP TABLE IF EXISTS models_new`,
    `CREATE TABLE models_new (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      size_gb REAL NOT NULL,
      parameter_count_billions REAL NOT NULL,
      author TEXT NOT NULL,
      family TEXT NOT NULL,
      thinking INTEGER DEFAULT 0,
      tool_calling INTEGER DEFAULT 0,
      huggingface_url TEXT NOT NULL DEFAULT '',
      parts TEXT NOT NULL DEFAULT '[]',
      pipeline TEXT NOT NULL CHECK (pipeline IN (${PIPELINES})),
      tags TEXT NOT NULL DEFAULT '[]',
      languages TEXT NOT NULL DEFAULT '[]',
      supported_file_format TEXT NOT NULL DEFAULT '[]'
    )`,
    `INSERT INTO models_new
      (id, name, size_gb, parameter_count_billions, author, family, thinking, tool_calling, huggingface_url, parts, pipeline, tags, languages, supported_file_format)
     SELECT
      id, name, size_gb, parameter_count_billions, author, family, thinking, tool_calling, huggingface_url, parts,
      CASE pipeline
        WHEN 'speech-to-text' THEN 'speechToText'
        WHEN 'automatic-speech-recognition' THEN 'speechToText'
        ELSE pipeline
      END,
      tags, languages, supported_file_format
     FROM models`,
    `DROP TABLE models`,
    `ALTER TABLE models_new RENAME TO models`,
  ],
];

export async function initDatabase(): Promise<void> {
  const db = getDatabase();
  const result = await db.execute('PRAGMA user_version');
  const version = (result.rows[0]?.user_version as number | undefined) ?? 0;

  if (version >= MIGRATIONS.length) {
    return;
  }

  // Foreign keys must be off while migrating. A migration that rebuilds a table
  // (create-new / copy / drop-old / rename) drops a table other tables
  // reference; with foreign keys on, that DROP performs an implicit DELETE that
  // fires ON DELETE CASCADE and wipes dependent rows (dropping `models` would
  // cascade through `conversations` and `messages`). PRAGMA foreign_keys is a
  // no-op inside a transaction, so it is toggled out here, around the
  // transactional migration steps, and restored afterwards.
  await db.execute('PRAGMA foreign_keys = OFF');
  try {
    for (let v = version; v < MIGRATIONS.length; v++) {
      await db.transaction(async tx => {
        for (const statement of MIGRATIONS[v]) {
          await tx.execute(statement);
        }
        await tx.execute(`PRAGMA user_version = ${v + 1}`);
      });
      log('Database migrated to version', v + 1);
    }
    const fkViolations = await db.execute('PRAGMA foreign_key_check');
    if (fkViolations.rows.length > 0) {
      log('Foreign key violations after migration:', fkViolations.rows);
    }
  } finally {
    await db.execute('PRAGMA foreign_keys = ON');
  }
}

// Recovery escape hatch for a database a migration can't get past (e.g. a
// deterministic, data-dependent migration failure that would otherwise strand
// the user on the error screen forever). Drops every table and resets
// user_version to 0, then replays migrations from scratch — on empty tables the
// data-dependent steps can't fail, so the rebuild always succeeds. This is
// destructive: chat history and the downloaded-model list are erased (downloaded
// model files on disk are left untouched but become orphaned). App state lives
// in a separate Storage database and is not affected here. Gate every caller
// behind an explicit user confirmation.
export async function resetDatabase(): Promise<void> {
  const db = getDatabase();
  // Foreign keys off so parent tables can be dropped regardless of order without
  // firing cascades. PRAGMA foreign_keys is a no-op inside a transaction, so it
  // is toggled out here, around the transactional drop.
  await db.execute('PRAGMA foreign_keys = OFF');
  try {
    const tables = await db.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    );
    // Atomic: either every table is dropped and the version reset, or nothing
    // changes — so a failure mid-wipe can't leave a half-dropped schema behind.
    await db.transaction(async tx => {
      for (const row of tables.rows as { name: string }[]) {
        await tx.execute(`DROP TABLE IF EXISTS "${row.name}"`);
      }
      await tx.execute('PRAGMA user_version = 0');
    });
  } finally {
    await db.execute('PRAGMA foreign_keys = ON');
  }
  log('Database reset');
  await initDatabase();
}
