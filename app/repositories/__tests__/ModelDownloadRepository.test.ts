import { getDatabase } from 'database';
import { buildModel } from 'jest/factories/model';
import { ModelDownload } from 'types';

import {
  rowToModelDownload,
  modelDownloadProgress,
  createModelDownload,
  updateModelDownloadParts,
  getModelDownloads,
  deleteModelDownload,
} from '../ModelDownloadRepository';

const db = getDatabase() as any;

const part = (overrides = {}) => ({
  url: 'https://example.com/model.gguf',
  fileName: 'model.gguf',
  type: 'chat-model',
  path: '',
  sizeGB: 2,
  progress: 0,
  ...overrides,
});

beforeEach(() => {
  db.execute.mockReset().mockResolvedValue({ rows: [], rowsAffected: 1 });
});

describe('rowToModelDownload', () => {
  test('parses the stored model snapshot and per-part progress', () => {
    const model = buildModel(3, { name: 'Q' });
    const partsProgress = [part({ progress: 0.5 })];

    expect(
      rowToModelDownload({
        model_id: 3,
        model: JSON.stringify(model),
        parts_progress: JSON.stringify(partsProgress),
      }),
    ).toEqual({ model, partsProgress });
  });

  test('degrades to an empty model / empty parts on corrupt JSON instead of throwing', () => {
    const result = rowToModelDownload({
      model_id: 3,
      model: 'not json',
      parts_progress: 'not json',
    });

    expect(result.model.name).toBe('');
    expect(result.partsProgress).toEqual([]);
  });
});

describe('modelDownloadProgress', () => {
  test('weights each part by its size', () => {
    const download: ModelDownload = {
      model: buildModel(3),
      partsProgress: [
        part({ sizeGB: 3, progress: 1 }), // fully done, weight 3
        part({ sizeGB: 1, progress: 0 }), // not started, weight 1
      ],
    };

    // (1*3 + 0*1) / (3 + 1) = 0.75
    expect(modelDownloadProgress(download)).toBe(0.75);
  });

  test('returns 0 when there is no size to weigh', () => {
    expect(
      modelDownloadProgress({ model: buildModel(3), partsProgress: [] }),
    ).toBe(0);
  });
});

describe('createModelDownload', () => {
  test('inserts the row seeded at 0% and reports it won the race', async () => {
    const model = buildModel(3, { parts: [part()] });

    const created = await createModelDownload(model);

    expect(created).toBe(true);
    const [sql, params] = db.execute.mock.calls[0];
    expect(sql).toContain('INSERT INTO model_downloads');
    expect(sql).toContain('ON CONFLICT(model_id) DO NOTHING');
    expect(params[0]).toBe(3);
    // Parts are seeded at progress 0.
    expect(JSON.parse(params[2])).toEqual([part({ progress: 0 })]);
  });

  test('reports false when a download already exists (no row inserted)', async () => {
    db.execute.mockResolvedValue({ rows: [], rowsAffected: 0 });

    expect(await createModelDownload(buildModel(3))).toBe(false);
  });
});


describe('updateModelDownloadParts', () => {
  test('writes the serialized parts progress for the model', async () => {
    const partsProgress = [part({ progress: 0.4 })];

    await updateModelDownloadParts(3, partsProgress);

    expect(db.execute).toHaveBeenCalledWith(
      'UPDATE model_downloads SET parts_progress = ? WHERE model_id = ?',
      [JSON.stringify(partsProgress), 3],
    );
  });
});

describe('getModelDownloads', () => {
  test('queries ordered by id and maps the rows', async () => {
    const model = buildModel(3);
    const partsProgress = [part({ progress: 0.4 })];
    db.execute.mockResolvedValue({
      rows: [
        {
          model_id: 3,
          model: JSON.stringify(model),
          parts_progress: JSON.stringify(partsProgress),
        },
      ],
    });

    const downloads = await getModelDownloads();

    expect(db.execute).toHaveBeenCalledWith(
      'SELECT * FROM model_downloads ORDER BY model_id',
    );
    expect(downloads).toEqual([{ model, partsProgress }]);
  });
});

describe('deleteModelDownload', () => {
  test('deletes the row by model id', async () => {
    await deleteModelDownload(3);

    expect(db.execute).toHaveBeenCalledWith(
      'DELETE FROM model_downloads WHERE model_id = ?',
      [3],
    );
  });
});
