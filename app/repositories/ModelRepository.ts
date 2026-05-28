import { getDatabase } from 'helpers';
import { Model, ModelDownloadLink, ModelPipeline } from 'types';

export function rowToModel(row: Record<string, any>): Model {
  return {
    id: row.id as number,
    modelName: row.model_name as string,
    modelSizeGB: row.model_size_gb as number,
    parameterCountBillions: row.parameter_count_billions as number,
    author: row.author as string,
    family: row.family as string,
    thinking: !!(row.thinking as number),
    imageIngestion: !!(row.image_ingestion as number),
    audioIngestion: !!(row.audio_ingestion as number),
    downloadLinks: JSON.parse(row.download_links as string) as ModelDownloadLink[],
    pipeline: row.pipeline as ModelPipeline,
    tags: JSON.parse(row.tags as string) as string[],
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

export async function insertModel(model: Model): Promise<void> {
  const db = getDatabase();
  await db.execute(
    `INSERT OR REPLACE INTO models
      (id, model_name, model_size_gb, parameter_count_billions, author, family, thinking, image_ingestion, audio_ingestion, download_links, pipeline, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      model.id,
      model.modelName,
      model.modelSizeGB,
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
}

export async function insertModels(models: Model[]): Promise<void> {
  if (models.length === 0) return;
  const db = getDatabase();
  const query = `INSERT OR REPLACE INTO models
    (id, model_name, model_size_gb, parameter_count_billions, author, family, thinking, image_ingestion, audio_ingestion, download_links, pipeline, tags)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  await db.executeBatch(
    models.map(m => [
      query,
      [
        m.id,
        m.modelName,
        m.modelSizeGB,
        m.parameterCountBillions,
        m.author,
        m.family,
        m.thinking ? 1 : 0,
        m.imageIngestion ? 1 : 0,
        m.audioIngestion ? 1 : 0,
        JSON.stringify(m.downloadLinks),
        m.pipeline,
        JSON.stringify(m.tags),
      ],
    ]),
  );
}

export async function deleteModel(id: number): Promise<void> {
  const db = getDatabase();
  await db.execute('DELETE FROM models WHERE id = ?', [id]);
}

export async function deleteAllModels(): Promise<void> {
  const db = getDatabase();
  await db.execute('DELETE FROM models');
}
