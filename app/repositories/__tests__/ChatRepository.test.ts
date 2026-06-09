import { getDatabase } from 'database';

import {
  rowToChat,
  getAllChats,
  getLastUsedChatId,
  getChatById,
  insertChat,
  updateChat,
  deleteChat,
  deleteAllChats,
} from '../ChatRepository';

const db = getDatabase() as any;

beforeEach(() => {
  db.execute.mockReset().mockResolvedValue({ rows: [] });
});

describe('rowToChat', () => {
  test('maps a snake_case row to a Chat', () => {
    expect(
      rowToChat({ id: 1, title: 'Hi', last_used: '2024', model_id: 7 }),
    ).toEqual({ id: 1, title: 'Hi', lastUsed: '2024', modelId: 7 });
  });
});

describe('getAllChats', () => {
  test('queries ordered by last_used and maps the rows', async () => {
    db.execute.mockResolvedValue({
      rows: [{ id: 1, title: 'a', last_used: 'x', model_id: 2 }],
    });

    const chats = await getAllChats();

    expect(db.execute).toHaveBeenCalledWith(
      'SELECT * FROM chats ORDER BY last_used DESC',
    );
    expect(chats).toEqual([{ id: 1, title: 'a', lastUsed: 'x', modelId: 2 }]);
  });
});

describe('getLastUsedChatId', () => {
  test('returns the id of the most recent chat', async () => {
    db.execute.mockResolvedValue({ rows: [{ id: 9 }] });

    expect(await getLastUsedChatId()).toBe(9);
    expect(db.execute).toHaveBeenCalledWith(
      'SELECT id FROM chats ORDER BY last_used DESC LIMIT 1',
    );
  });

  test('returns undefined when there are no chats', async () => {
    db.execute.mockResolvedValue({ rows: [] });
    expect(await getLastUsedChatId()).toBeUndefined();
  });
});

describe('getChatById', () => {
  test('returns the mapped chat when found', async () => {
    db.execute.mockResolvedValue({
      rows: [{ id: 3, title: 't', last_used: 'u', model_id: 1 }],
    });

    expect(await getChatById(3)).toEqual({
      id: 3,
      title: 't',
      lastUsed: 'u',
      modelId: 1,
    });
    expect(db.execute).toHaveBeenCalledWith(
      'SELECT * FROM chats WHERE id = ?',
      [3],
    );
  });

  test('returns undefined when not found', async () => {
    db.execute.mockResolvedValue({ rows: [] });
    expect(await getChatById(3)).toBeUndefined();
  });
});

describe('insertChat', () => {
  test('inserts the chat and returns the new id', async () => {
    db.execute.mockResolvedValue({ insertId: 42, rows: [] });

    const id = await insertChat({ title: 'New', modelId: 5 });

    expect(db.execute).toHaveBeenCalledWith(
      'INSERT INTO chats (title, model_id) VALUES (?, ?)',
      ['New', 5],
    );
    expect(id).toBe(42);
  });
});

describe('updateChat', () => {
  test('updates every field by id', async () => {
    await updateChat({ id: 1, title: 'T', lastUsed: 'L', modelId: 2 });

    expect(db.execute).toHaveBeenCalledWith(
      'UPDATE chats SET title = ?, last_used = ?, model_id = ? WHERE id = ?',
      ['T', 'L', 2, 1],
    );
  });
});

describe('deleteChat', () => {
  test('deletes the chat messages then the chat', async () => {
    await deleteChat(8);

    expect(db.execute).toHaveBeenCalledWith(
      'DELETE FROM messages WHERE chat_id = ?',
      [8],
    );
    expect(db.execute).toHaveBeenCalledWith('DELETE FROM chats WHERE id = ?', [
      8,
    ]);
  });
});

describe('deleteAllChats', () => {
  test('clears messages then chats', async () => {
    await deleteAllChats();

    expect(db.execute).toHaveBeenCalledWith('DELETE FROM messages');
    expect(db.execute).toHaveBeenCalledWith('DELETE FROM chats');
  });
});
