import { getDatabase } from 'database';
import { safeJsonParse } from 'helpers';
import { Model, ModelDownload, ModelDownloadPart, ModelPipeline } from 'types';

// Defensive fallback so a corrupt `model` JSON degrades to a renderable row
// instead of throwing inside the reactive-query callback. In practice the
// column always holds a model we serialized ourselves.
const EMPTY_MODEL: Model = {
  id: 0,
  name: '',
  sizeGB: 0,
  parameterCountBillions: 0,
  author: '',
  family: '',
  thinking: false,
  toolCalling: false,
  huggingfaceUrl: '',
  parts: [],
  pipeline: ModelPipeline.textGeneration,
  tags: [],
  languages: [],
  supportedFileFormat: [],
};

export function rowToModelDownload(row: Record<string, any>): ModelDownload {
  return {
    model: safeJsonParse<Model>(row.model, EMPTY_MODEL),
    partsProgress: safeJsonParse<ModelDownloadPart[]>(row.parts_progress, []),
  };
}

// Overall progress (0..1) weighted by each part's size, computed purely from
// the stored row — no in-memory bookkeeping needed.
export function modelDownloadProgress(download: ModelDownload): number {
  const totalSize = download.partsProgress.reduce(
    (sum, part) => sum + part.sizeGB,
    0,
  );
  if (totalSize <= 0) return 0;

  const downloaded = download.partsProgress.reduce(
    (sum, part) => sum + part.progress * part.sizeGB,
    0,
  );
  return downloaded / totalSize;
}

// Creates the in-progress row, with every part seeded at 0% progress. Returns
// false (without touching an existing row) when a download for this model is
// already tracked — an atomic, race-safe guard against duplicate starts, so
// callers don't need their own in-memory in-flight set.
export async function createModelDownload(model: Model): Promise<boolean> {
  const db = getDatabase();
  const partsProgress: ModelDownloadPart[] = model.parts.map(part => ({
    ...part,
    progress: 0,
  }));
  // A transaction (not a plain execute) so op-sqlite flushes reactive queries
  // on commit — otherwise the new row never fires `useModelDownloads` and the
  // Downloading section wouldn't appear.
  let created = false;
  await db.transaction(async tx => {
    const result = await tx.execute(
      `INSERT INTO model_downloads (model_id, model, parts_progress)
      VALUES (?, ?, ?)
      ON CONFLICT(model_id) DO NOTHING`,
      [model.id, JSON.stringify(model), JSON.stringify(partsProgress)],
    );
    created = (result.rowsAffected ?? 0) > 0;
  });
  return created;
}

// A transaction (not a plain execute) so op-sqlite flushes reactive queries on
// commit — this is what advances the progress bar via `useModelDownloads`.
// Callers throttle how often this runs (~1% steps) to keep it cheap.
export async function updateModelDownloadParts(
  modelId: number,
  partsProgress: ModelDownloadPart[],
): Promise<void> {
  const db = getDatabase();
  await db.transaction(async tx => {
    await tx.execute(
      'UPDATE model_downloads SET parts_progress = ? WHERE model_id = ?',
      [JSON.stringify(partsProgress), modelId],
    );
  });
}

export async function getModelDownloads(): Promise<ModelDownload[]> {
  const db = getDatabase();
  const result = await db.execute(
    'SELECT * FROM model_downloads ORDER BY model_id',
  );
  return result.rows.map(rowToModelDownload);
}

export async function deleteModelDownload(modelId: number): Promise<void> {
  const db = getDatabase();
  await db.transaction(async tx => {
    await tx.execute('DELETE FROM model_downloads WHERE model_id = ?', [
      modelId,
    ]);
  });
}
