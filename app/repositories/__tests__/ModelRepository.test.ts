import { getDatabase } from 'database';
import { buildModel } from 'jest/factories/model';

import {
  rowToModel,
  getAllModels,
  getModelById,
  insertModel,
  insertModels,
  deleteModel,
  deleteAllModels,
} from '../ModelRepository';

const db = getDatabase() as any;

const rawRow = {
  id: 1,
  model_name: 'M',
  model_size_gb: 0.5,
  parameter_count_billions: 0.6,
  author: 'A',
  family: 'F',
  thinking: 1,
  image_ingestion: 0,
  audio_ingestion: 0,
  download_links: '[]',
  pipeline: 'textGeneration',
  tags: '["x"]',
};

beforeEach(() => {
  db.execute.mockReset().mockResolvedValue({ rows: [] });
  db.executeBatch.mockReset().mockResolvedValue({});
});

describe('rowToModel', () => {
  test('maps booleans from 0/1 and parses JSON columns', () => {
    expect(rowToModel(rawRow)).toEqual({
      id: 1,
      modelName: 'M',
      modelSizeGB: 0.5,
      parameterCountBillions: 0.6,
      author: 'A',
      family: 'F',
      thinking: true,
      imageIngestion: false,
      audioIngestion: false,
      downloadLinks: [],
      pipeline: 'textGeneration',
      tags: ['x'],
    });
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

    expect((await getModelById(1))?.modelName).toBe('M');
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
  test('serializes booleans and JSON columns into the insert', async () => {
    const model = buildModel(3, {
      modelName: 'Q',
      thinking: true,
      tags: ['fast'],
    });

    await insertModel(model);

    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR REPLACE INTO models'),
      [3, 'Q', 1, 1, 'Author', 'Family', 1, 0, 0, '[]', 'textGeneration', '["fast"]'],
    );
  });
});

describe('insertModels', () => {
  test('does nothing for an empty array', async () => {
    await insertModels([]);
    expect(db.executeBatch).not.toHaveBeenCalled();
  });

  test('batch-inserts every model', async () => {
    await insertModels([buildModel(1), buildModel(2)]);

    expect(db.executeBatch).toHaveBeenCalledTimes(1);
    expect(db.executeBatch.mock.calls[0][0]).toHaveLength(2);
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
