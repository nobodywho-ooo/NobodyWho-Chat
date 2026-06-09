import { getDatabase } from 'database';
import { Chat } from 'types';

export function rowToChat(row: Record<string, any>): Chat {
  return {
    id: row.id as number,
    title: row.title as string,
    lastUsed: row.last_used as string,
    modelId: row.model_id as number,
  };
}

export async function getAllChats(): Promise<Chat[]> {
  const db = getDatabase();
  const result = await db.execute(
    'SELECT * FROM chats ORDER BY last_used DESC',
  );
  return result.rows.map(rowToChat);
}

export async function getLastUsedChatId(): Promise<number | undefined> {
  const db = getDatabase();
  const result = await db.execute(
    'SELECT id FROM chats ORDER BY last_used DESC LIMIT 1',
  );
  return result.rows.length > 0 ? (result.rows[0].id as number) : undefined;
}

export async function getChatById(id: number): Promise<Chat | undefined> {
  const db = getDatabase();
  const result = await db.execute('SELECT * FROM chats WHERE id = ?', [id]);
  return result.rows.length > 0 ? rowToChat(result.rows[0]) : undefined;
}

export async function insertChat(
  chat: Omit<Chat, 'id' | 'lastUsed'>,
): Promise<number> {
  const db = getDatabase();
  let insertId = 0;
  await db.transaction(async tx => {
    const result = await tx.execute(
      `INSERT INTO chats (title, model_id) VALUES (?, ?)`,
      [chat.title, chat.modelId],
    );
    insertId = result.insertId!;
  });
  return insertId;
}

export async function updateChat(chat: Chat): Promise<void> {
  const db = getDatabase();
  await db.transaction(async tx => {
    await tx.execute(
      `UPDATE chats SET title = ?, last_used = ?, model_id = ? WHERE id = ?`,
      [chat.title, chat.lastUsed, chat.modelId, chat.id],
    );
  });
}

export async function deleteChat(id: number): Promise<void> {
  const db = getDatabase();
  await db.transaction(async tx => {
    await tx.execute('DELETE FROM messages WHERE chat_id = ?', [id]);
    await tx.execute('DELETE FROM chats WHERE id = ?', [id]);
  });
}

export async function deleteAllChats(): Promise<void> {
  const db = getDatabase();
  await db.transaction(async tx => {
    await tx.execute('DELETE FROM messages');
    await tx.execute('DELETE FROM chats');
  });
}
