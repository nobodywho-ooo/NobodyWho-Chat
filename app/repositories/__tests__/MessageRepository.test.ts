import { getDatabase } from 'database';

import {
  rowToMessage,
  getMessagesByConversationId,
  getDocumentPathsByModelId,
  insertMessage,
  deleteMessagesByConversationId,
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
        conversation_id: 2,
        role: 'user',
        content: 'c',
        tokens_per_second: 5,
        time_to_first_token: 1,
        documents_path: '["/x"]',
      }),
    ).toEqual({
      id: 1,
      timestamp: 't',
      conversationId: 2,
      role: 'user',
      content: 'c',
      tokensPerSecond: 5,
      timeToFirstToken: 1,
      documentsPath: ['/x'],
    });
  });

  test('falls back to an empty documents_path on corrupt JSON', () => {
    const message = rowToMessage({
      id: 1,
      timestamp: 't',
      conversation_id: 2,
      role: 'user',
      content: 'c',
      documents_path: 'not json',
    });

    expect(message.documentsPath).toEqual([]);
  });
});

describe('getMessagesByConversationId', () => {
  test('queries the conversation ordered by id and maps the rows', async () => {
    db.execute.mockResolvedValue({
      rows: [
        {
          id: 1,
          timestamp: 't',
          conversation_id: 2,
          role: 'user',
          content: 'c',
          documents_path: '[]',
        },
      ],
    });

    const messages = await getMessagesByConversationId(2);

    expect(db.execute).toHaveBeenCalledWith(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC',
      [2],
    );
    expect(messages[0].conversationId).toBe(2);
    expect(messages[0].documentsPath).toEqual([]);
  });
});

describe('getDocumentPathsByModelId', () => {
  test('joins through conversations and flattens every documents_path', async () => {
    db.execute.mockResolvedValue({
      rows: [
        { documents_path: '["/a.png","/b.mp3"]' },
        { documents_path: '[]' },
        { documents_path: '["/c.png"]' },
      ],
    });

    const paths = await getDocumentPathsByModelId(3);

    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('JOIN conversations'),
      [3],
    );
    expect(paths).toEqual(['/a.png', '/b.mp3', '/c.png']);
  });

  test('returns an empty list when the model has no documents', async () => {
    db.execute.mockResolvedValue({ rows: [] });
    expect(await getDocumentPathsByModelId(9)).toEqual([]);
  });
});

describe('insertMessage', () => {
  test('inserts the message and returns the new id', async () => {
    db.execute.mockResolvedValue({ insertId: 11, rows: [] });

    const id = await insertMessage({
      conversationId: 2,
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

  test('bumps the conversation last_used in the same transaction', async () => {
    db.execute.mockResolvedValue({ insertId: 11, rows: [] });

    await insertMessage({
      conversationId: 2,
      role: 'user',
      content: 'hi',
      documentsPath: [],
    });

    expect(db.execute).toHaveBeenCalledWith(
      'UPDATE conversations SET last_used = CURRENT_TIMESTAMP WHERE id = ?',
      [2],
    );
  });

  test('persists provided performance metrics', async () => {
    db.execute.mockResolvedValue({ insertId: 12, rows: [] });

    await insertMessage({
      conversationId: 2,
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

describe('deleteMessagesByConversationId', () => {
  test('deletes every message for the conversation', async () => {
    await deleteMessagesByConversationId(4);

    expect(db.execute).toHaveBeenCalledWith(
      'DELETE FROM messages WHERE conversation_id = ?',
      [4],
    );
  });
});
