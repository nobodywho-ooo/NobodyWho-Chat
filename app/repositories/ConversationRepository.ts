import { getDatabase } from 'database';
import { Conversation } from 'types';

export function rowToConversation(row: Record<string, any>): Conversation {
  return {
    id: row.id as number,
    title: row.title as string,
    lastUsed: row.last_used as string,
    modelId: row.model_id as number,
  };
}

export async function getAllConversations(): Promise<Conversation[]> {
  const db = getDatabase();
  const result = await db.execute(
    'SELECT * FROM conversations ORDER BY last_used DESC, id DESC',
  );
  return result.rows.map(rowToConversation);
}

export async function getLastUsedConversationId(): Promise<number | undefined> {
  const db = getDatabase();
  const result = await db.execute(
    'SELECT id FROM conversations ORDER BY last_used DESC, id DESC LIMIT 1',
  );
  return result.rows.length > 0 ? (result.rows[0].id as number) : undefined;
}

export async function getConversationById(
  id: number,
): Promise<Conversation | undefined> {
  const db = getDatabase();
  const result = await db.execute('SELECT * FROM conversations WHERE id = ?', [
    id,
  ]);
  return result.rows.length > 0 ? rowToConversation(result.rows[0]) : undefined;
}

export async function insertConversation(
  conversation: Omit<Conversation, 'id' | 'lastUsed'>,
): Promise<number> {
  const db = getDatabase();
  let insertId = 0;
  await db.transaction(async tx => {
    const result = await tx.execute(
      `INSERT INTO conversations (title, model_id) VALUES (?, ?)`,
      [conversation.title, conversation.modelId],
    );
    insertId = result.insertId!;
  });
  return insertId;
}

export async function updateConversation(
  conversation: Conversation,
): Promise<void> {
  const db = getDatabase();
  await db.transaction(async tx => {
    await tx.execute(
      `UPDATE conversations SET title = ?, last_used = ?, model_id = ? WHERE id = ?`,
      [
        conversation.title,
        conversation.lastUsed,
        conversation.modelId,
        conversation.id,
      ],
    );
  });
}

export async function deleteConversation(id: number): Promise<void> {
  const db = getDatabase();
  await db.transaction(async tx => {
    await tx.execute('DELETE FROM messages WHERE conversation_id = ?', [id]);
    await tx.execute('DELETE FROM conversations WHERE id = ?', [id]);
  });
}

export async function deleteAllConversations(): Promise<void> {
  const db = getDatabase();
  await db.transaction(async tx => {
    await tx.execute('DELETE FROM messages');
    await tx.execute('DELETE FROM conversations');
  });
}
