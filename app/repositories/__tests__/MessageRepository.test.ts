import { getDatabase } from 'database';

import {
  rowToMessage,
  getMessagesByChatId,
  insertMessage,
  deleteMessagesByChatId,
} from '../MessageRepository';

const db = getDatabase() as any;

beforeEach(() => {
  db.execute.mockReset().mockResolvedValue({ rows: [] });
});

describe('rowToMessage', () => {
  test('maps a snake_case row and parses documents_path', () => {
    expect(
      rowToMessage({
        id: 1,
        timestamp: 't',
        chat_id: 2,
        role: 'user',
        content: 'c',
        tokens_per_second: 5,
        time_to_first_token: 1,
        documents_path: '["/x"]',
      }),
    ).toEqual({
      id: 1,
      timestamp: 't',
      chatId: 2,
      role: 'user',
      content: 'c',
      tokensPerSecond: 5,
      timeToFirstToken: 1,
      documentsPath: ['/x'],
    });
  });
});

describe('getMessagesByChatId', () => {
  test('queries the chat ordered by timestamp and maps the rows', async () => {
    db.execute.mockResolvedValue({
      rows: [
        {
          id: 1,
          timestamp: 't',
          chat_id: 2,
          role: 'user',
          content: 'c',
          documents_path: '[]',
        },
      ],
    });

    const messages = await getMessagesByChatId(2);

    expect(db.execute).toHaveBeenCalledWith(
      'SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC',
      [2],
    );
    expect(messages[0].chatId).toBe(2);
    expect(messages[0].documentsPath).toEqual([]);
  });
});

describe('insertMessage', () => {
  test('inserts the message and returns the new id', async () => {
    db.execute.mockResolvedValue({ insertId: 11, rows: [] });

    const id = await insertMessage({
      chatId: 2,
      role: 'user',
      content: 'hi',
      documentsPath: ['/a'],
    });

    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO messages'),
      [2, 'user', 'hi', null, null, '["/a"]'],
    );
    expect(id).toBe(11);
  });

  test('persists provided performance metrics', async () => {
    db.execute.mockResolvedValue({ insertId: 12, rows: [] });

    await insertMessage({
      chatId: 2,
      role: 'assistant',
      content: 'yo',
      tokensPerSecond: 9,
      timeToFirstToken: 3,
      documentsPath: [],
    });

    expect(db.execute).toHaveBeenCalledWith(expect.any(String), [
      2,
      'assistant',
      'yo',
      9,
      3,
      '[]',
    ]);
  });
});

describe('deleteMessagesByChatId', () => {
  test('deletes every message for the chat', async () => {
    await deleteMessagesByChatId(4);

    expect(db.execute).toHaveBeenCalledWith(
      'DELETE FROM messages WHERE chat_id = ?',
      [4],
    );
  });
});
