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
      toolInvocations: [],
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

  test('parses tool_invocations JSON on an assistant message', () => {
    const message = rowToMessage({
      id: 3,
      timestamp: 't',
      conversation_id: 2,
      role: 'assistant',
      content: 'It is 12°C in Paris.',
      documents_path: '[]',
      tool_invocations:
        '[{"name":"get_weather","arguments":{"city":"Paris"},"result":"{\\"temperatureCelsius\\":12}"}]',
    });

    expect(message.toolInvocations).toEqual([
      {
        name: 'get_weather',
        arguments: { city: 'Paris' },
        result: '{"temperatureCelsius":12}',
      },
    ]);
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
    db.execute.mockResolvedValue({ insertId: 11, rows: [], rowsAffected: 1 });

    const id = await insertMessage({
      conversationId: 2,
      role: 'user',
      content: 'hi',
      documentsPath: ['/a'],
    });

    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO messages'),
      [2, 'user', 'hi', null, null, '["/a"]', '[]', 2],
    );
    expect(id).toBe(11);
  });

  test('bumps the conversation last_used in the same transaction', async () => {
    db.execute.mockResolvedValue({ insertId: 11, rows: [], rowsAffected: 1 });

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
    db.execute.mockResolvedValue({ insertId: 12, rows: [], rowsAffected: 1 });

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
      '[]',
      2,
    ]);
  });

  test('serializes the assistant tool invocations', async () => {
    db.execute.mockResolvedValue({ insertId: 13, rows: [], rowsAffected: 1 });

    await insertMessage({
      conversationId: 2,
      role: 'assistant',
      content: 'It is 12°C in Paris.',
      documentsPath: [],
      toolInvocations: [
        {
          name: 'get_weather',
          arguments: { city: 'Paris' },
          result: '{"temperatureCelsius":12}',
        },
      ],
    });

    const params = db.execute.mock.calls[0][1] as unknown[];
    expect(params[6]).toBe(
      '[{"name":"get_weather","arguments":{"city":"Paris"},"result":"{\\"temperatureCelsius\\":12}"}]',
    );
  });
});

describe('insertMessage — deleted conversation', () => {
  // The EXISTS guard makes the insert a no-op instead of raising
  // `FOREIGN KEY constraint failed`, which is what callers map to 'gone'.
  beforeEach(() => {
    // insertId stays populated on a no-op — SQLite's last_insert_rowid() keeps
    // the previous successful insert's id — so only rowsAffected says nothing
    // was written. A mock that omits it would hide a regression here.
    db.execute.mockResolvedValue({ insertId: 11, rows: [], rowsAffected: 0 });
  });

  test('resolves to undefined rather than throwing', async () => {
    await expect(
      insertMessage({
        conversationId: 99,
        role: 'user',
        content: 'hi',
        documentsPath: [],
      }),
    ).resolves.toBeUndefined();
  });

  test('does not bump last_used for a conversation that is gone', async () => {
    await insertMessage({
      conversationId: 99,
      role: 'user',
      content: 'hi',
      documentsPath: [],
    });

    expect(db.execute).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE conversations'),
      expect.anything(),
    );
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
