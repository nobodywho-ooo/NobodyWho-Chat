import { getDatabase } from 'database';
import { safeJsonParse } from 'helpers';
import { Model, ModelDownloadLink, ModelPipeline } from 'types';

export function rowToModel(row: Record<string, any>): Model {
  return {
    id: row.id as number,
    name: row.name as string,
    sizeGB: row.size_gb as number,
    parameterCountBillions: row.parameter_count_billions as number,
    author: row.author as string,
    family: row.family as string,
    thinking: !!(row.thinking as number),
    imageIngestion: !!(row.image_ingestion as number),
    audioIngestion: !!(row.audio_ingestion as number),
    downloadLinks: safeJsonParse<ModelDownloadLink[]>(row.download_links, []),
    pipeline: row.pipeline as ModelPipeline,
    tags: safeJsonParse<string[]>(row.tags, []),
  };
}

export async function getAllModels(): Promise<Model[]> {
  const db = getDatabase();
  const result = await db.execute('SELECT * FROM models ORDER BY id');
  return result.rows.map(rowToModel);
}

export async function getModelById(id: number): Promise<Model | undefined> {
  const db = getDatabase();
  const result = await db.execute('SELECT * FROM models WHERE id = ?', [id]);
  return result.rows.length > 0 ? rowToModel(result.rows[0]) : undefined;
}

// A true upsert — NOT `INSERT OR REPLACE`. With `PRAGMA foreign_keys = ON`,
// REPLACE deletes the conflicting row before re-inserting, and that delete
// cascades through `conversations`/`messages` (ON DELETE CASCADE) — wiping a
// model's entire chat history on any re-insert (e.g. a catalog refresh).
// `ON CONFLICT(id) DO UPDATE` mutates the row in place, so no cascade fires.
export async function insertModel(model: Model): Promise<void> {
  const db = getDatabase();
  await db.transaction(async tx => {
    await tx.execute(
      `INSERT INTO models
        (id, name, size_gb, parameter_count_billions, author, family, thinking, image_ingestion, audio_ingestion, download_links, pipeline, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        size_gb = excluded.size_gb,
        parameter_count_billions = excluded.parameter_count_billions,
        author = excluded.author,
        family = excluded.family,
        thinking = excluded.thinking,
        image_ingestion = excluded.image_ingestion,
        audio_ingestion = excluded.audio_ingestion,
        download_links = excluded.download_links,
        pipeline = excluded.pipeline,
        tags = excluded.tags`,
      [
        model.id,
        model.name,
        model.sizeGB,
        model.parameterCountBillions,
        model.author,
        model.family,
        model.thinking ? 1 : 0,
        model.imageIngestion ? 1 : 0,
        model.audioIngestion ? 1 : 0,
        JSON.stringify(model.downloadLinks),
        model.pipeline,
        JSON.stringify(model.tags),
      ],
    );
  });
}

export async function deleteModel(id: number): Promise<void> {
  const db = getDatabase();
  await db.transaction(async tx => {
    await tx.execute('DELETE FROM models WHERE id = ?', [id]);
  });
}

export async function deleteAllModels(): Promise<void> {
  const db = getDatabase();
  await db.transaction(async tx => {
    await tx.execute('DELETE FROM models');
  });
}
