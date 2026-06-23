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
  huggingfaceUrl: '',
  parts: [],
  pipeline: ModelPipeline.textGeneration,
  tags: [],
  languages: [],
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

// Atomically acquires the live-process lock for a download: flips `running`
// from 0 to 1 and reports whether this caller won. Because the UPDATE is a
// single statement, two racing drivers (a press and a resume, or two resumes)
// can't both succeed — only one sees a row affected, so only one loop runs.
export async function claimModelDownload(modelId: number): Promise<boolean> {
  const db = getDatabase();
  const result = await db.execute(
    'UPDATE model_downloads SET running = 1 WHERE model_id = ? AND running = 0',
    [modelId],
  );
  return (result.rowsAffected ?? 0) > 0;
}

// Releases the lock so the download can be resumed later (e.g. after an error).
export async function releaseModelDownload(modelId: number): Promise<void> {
  const db = getDatabase();
  await db.execute('UPDATE model_downloads SET running = 0 WHERE model_id = ?', [
    modelId,
  ]);
}

// Clears every lock — call once on app launch. A killed process leaves
// `running = 1` with no loop to release it, which would otherwise block the
// download from ever being resumed.
export async function clearRunningDownloads(): Promise<void> {
  const db = getDatabase();
  await db.execute('UPDATE model_downloads SET running = 0');
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
