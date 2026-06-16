import { getDatabase } from 'database';
import { buildModel } from 'jest/factories/model';

import {
  rowToModel,
  getAllModels,
  getModelById,
  insertModel,
  deleteModel,
  deleteAllModels,
} from '../ModelRepository';

const db = getDatabase() as any;

const rawRow = {
  id: 1,
  name: 'M',
  size_gb: 0.5,
  parameter_count_billions: 0.6,
  author: 'A',
  family: 'F',
  thinking: 1,
  image_ingestion: 0,
  audio_ingestion: 0,
  parts: '[]',
  pipeline: 'textGeneration',
  tags: '["x"]',
};

beforeEach(() => {
  db.execute.mockReset().mockResolvedValue({ rows: [] });
});

describe('rowToModel', () => {
  test('maps booleans from 0/1 and parses JSON columns', () => {
    expect(rowToModel(rawRow)).toEqual({
      id: 1,
      name: 'M',
      sizeGB: 0.5,
      parameterCountBillions: 0.6,
      author: 'A',
      family: 'F',
      thinking: true,
      imageIngestion: false,
      audioIngestion: false,
      parts: [],
      pipeline: 'textGeneration',
      tags: ['x'],
    });
  });

  test('falls back to empty arrays on corrupt JSON columns', () => {
    const model = rowToModel({
      ...rawRow,
      parts: 'not json',
      tags: undefined,
    });

    expect(model.parts).toEqual([]);
    expect(model.tags).toEqual([]);
  });
});

describe('getAllModels', () => {
  test('queries ordered by id and maps the rows', async () => {
    db.execute.mockResolvedValue({ rows: [rawRow] });

    const models = await getAllModels();

    expect(db.execute).toHaveBeenCalledWith('SELECT * FROM models ORDER BY id');
    expect(models[0].thinking).toBe(true);
  });
});

describe('getModelById', () => {
  test('returns the mapped model when found', async () => {
    db.execute.mockResolvedValue({ rows: [rawRow] });

    expect((await getModelById(1))?.name).toBe('M');
    expect(db.execute).toHaveBeenCalledWith(
      'SELECT * FROM models WHERE id = ?',
      [1],
    );
  });

  test('returns undefined when not found', async () => {
    db.execute.mockResolvedValue({ rows: [] });
    expect(await getModelById(1)).toBeUndefined();
  });
});

describe('insertModel', () => {
  test('upserts via ON CONFLICT and serializes booleans/JSON columns', async () => {
    const model = buildModel(3, {
      name: 'Q',
      thinking: true,
      tags: ['fast'],
    });

    await insertModel(model);

    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT(id) DO UPDATE'),
      [3, 'Q', 1, 1, 'Author', 'Family', 1, 0, 0, '[]', 'textGeneration', '["fast"]'],
    );
    // Must NOT use INSERT OR REPLACE: with FKs on, REPLACE cascade-deletes the
    // model's conversations and messages.
    const [sql] = db.execute.mock.calls[0];
    expect(sql).not.toContain('OR REPLACE');
  });
});

describe('deleteModel', () => {
  test('deletes the model by id', async () => {
    await deleteModel(5);
    expect(db.execute).toHaveBeenCalledWith('DELETE FROM models WHERE id = ?', [
      5,
    ]);
  });
});

describe('deleteAllModels', () => {
  test('clears the models table', async () => {
    await deleteAllModels();
    expect(db.execute).toHaveBeenCalledWith('DELETE FROM models');
  });
});
