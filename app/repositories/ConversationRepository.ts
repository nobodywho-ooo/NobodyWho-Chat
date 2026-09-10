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

// Resolves to undefined when the model is gone — `modelIdInUse` outlives the
// row it points at for the rest of a session when a delete fails part-way
// (app state lives in a separate store, so ON DELETE CASCADE can't clear it and
// only dropStaleIdsInUse at the next launch would). Guarded by an EXISTS inside
// the insert for the same reason as insertMessage: no check-then-write window,
// and a deleted model makes this a no-op rather than a foreign key error.
export async function insertConversation(
  conversation: Omit<Conversation, 'id' | 'lastUsed'>,
): Promise<number | undefined> {
  const db = getDatabase();
  let insertId: number | undefined;
  await db.transaction(async tx => {
    const result = await tx.execute(
      `INSERT INTO conversations (title, model_id)
      SELECT ?, ?
      WHERE EXISTS (SELECT 1 FROM models WHERE id = ?)`,
      [conversation.title, conversation.modelId, conversation.modelId],
    );
    // See insertMessage: insertId stays stale on a no-op, rowsAffected does not.
    if ((result.rowsAffected ?? 0) > 0) {
      insertId = result.insertId!;
    }
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
