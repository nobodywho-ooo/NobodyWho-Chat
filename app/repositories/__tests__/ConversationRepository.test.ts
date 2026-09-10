import { getDatabase } from 'database';

import {
  rowToConversation,
  getAllConversations,
  getLastUsedConversationId,
  getConversationById,
  insertConversation,
  updateConversation,
  deleteConversation,
  deleteAllConversations,
} from '../ConversationRepository';

const db = getDatabase() as any;

beforeEach(() => {
  db.execute.mockReset().mockResolvedValue({ rows: [] });
});

describe('rowToConversation', () => {
  test('maps a snake_case row to a Conversation', () => {
    expect(
      rowToConversation({ id: 1, title: 'Hi', last_used: '2024', model_id: 7 }),
    ).toEqual({ id: 1, title: 'Hi', lastUsed: '2024', modelId: 7 });
  });
});

describe('getAllConversations', () => {
  test('queries ordered by last_used and maps the rows', async () => {
    db.execute.mockResolvedValue({
      rows: [{ id: 1, title: 'a', last_used: 'x', model_id: 2 }],
    });

    const conversations = await getAllConversations();

    expect(db.execute).toHaveBeenCalledWith(
      'SELECT * FROM conversations ORDER BY last_used DESC, id DESC',
    );
    expect(conversations).toEqual([
      { id: 1, title: 'a', lastUsed: 'x', modelId: 2 },
    ]);
  });
});

describe('getLastUsedConversationId', () => {
  test('returns the id of the most recent conversation', async () => {
    db.execute.mockResolvedValue({ rows: [{ id: 9 }] });

    expect(await getLastUsedConversationId()).toBe(9);
    expect(db.execute).toHaveBeenCalledWith(
      'SELECT id FROM conversations ORDER BY last_used DESC, id DESC LIMIT 1',
    );
  });

  test('returns undefined when there are no conversations', async () => {
    db.execute.mockResolvedValue({ rows: [] });
    expect(await getLastUsedConversationId()).toBeUndefined();
  });
});

describe('getConversationById', () => {
  test('returns the mapped conversation when found', async () => {
    db.execute.mockResolvedValue({
      rows: [{ id: 3, title: 't', last_used: 'u', model_id: 1 }],
    });

    expect(await getConversationById(3)).toEqual({
      id: 3,
      title: 't',
      lastUsed: 'u',
      modelId: 1,
    });
    expect(db.execute).toHaveBeenCalledWith(
      'SELECT * FROM conversations WHERE id = ?',
      [3],
    );
  });

  test('returns undefined when not found', async () => {
    db.execute.mockResolvedValue({ rows: [] });
    expect(await getConversationById(3)).toBeUndefined();
  });
});

describe('insertConversation', () => {
  test('inserts the conversation and returns the new id', async () => {
    db.execute.mockResolvedValue({ insertId: 42, rows: [], rowsAffected: 1 });

    const id = await insertConversation({ title: 'New', modelId: 5 });

    // The model id is bound twice: once as the value, once for the EXISTS
    // guard that keeps a deleted model from raising a foreign key error.
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO conversations'),
      ['New', 5, 5],
    );
    expect(id).toBe(42);
  });

  test('guards the insert on the model still existing', async () => {
    db.execute.mockResolvedValue({ insertId: 42, rows: [], rowsAffected: 1 });

    await insertConversation({ title: 'New', modelId: 5 });

    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('WHERE EXISTS (SELECT 1 FROM models WHERE id = ?)'),
      expect.anything(),
    );
  });

  test('resolves to undefined when the model is gone', async () => {
    // insertId is deliberately populated: on a no-op SQLite reports the
    // previous insert's rowid, so only rowsAffected can be trusted here.
    db.execute.mockResolvedValue({ insertId: 42, rows: [], rowsAffected: 0 });

    await expect(
      insertConversation({ title: 'New', modelId: 5 }),
    ).resolves.toBeUndefined();
  });
});

describe('updateConversation', () => {
  test('updates every field by id', async () => {
    await updateConversation({ id: 1, title: 'T', lastUsed: 'L', modelId: 2 });

    expect(db.execute).toHaveBeenCalledWith(
      'UPDATE conversations SET title = ?, last_used = ?, model_id = ? WHERE id = ?',
      ['T', 'L', 2, 1],
    );
  });
});

describe('deleteConversation', () => {
  test('deletes the conversation messages then the conversation', async () => {
    await deleteConversation(8);

    expect(db.execute).toHaveBeenCalledWith(
      'DELETE FROM messages WHERE conversation_id = ?',
      [8],
    );
    expect(db.execute).toHaveBeenCalledWith(
      'DELETE FROM conversations WHERE id = ?',
      [8],
    );
  });
});

describe('deleteAllConversations', () => {
  test('clears messages then conversations', async () => {
    await deleteAllConversations();

    expect(db.execute).toHaveBeenCalledWith('DELETE FROM messages');
    expect(db.execute).toHaveBeenCalledWith('DELETE FROM conversations');
  });
});
