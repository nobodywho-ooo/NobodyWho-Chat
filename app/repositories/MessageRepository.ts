import { getDatabase } from 'database';
import { ChatMessage } from 'types';

export function rowToMessage(row: Record<string, any>): ChatMessage {
  return {
    id: row.id as number,
    timestamp: row.timestamp as string,
    conversationId: row.conversation_id as number,
    role: row.role as string,
    content: row.content as string,
    tokensPerSecond: row.tokens_per_second as number | undefined,
    timeToFirstToken: row.time_to_first_token as number | undefined,
    documentsPath: JSON.parse(row.documents_path as string) as string[],
  };
}

export async function getMessagesByConversationId(
  conversationId: number,
): Promise<ChatMessage[]> {
  const db = getDatabase();
  const result = await db.execute(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
    [conversationId],
  );
  return result.rows.map(rowToMessage);
}

export async function insertMessage(
  message: Omit<ChatMessage, 'id' | 'timestamp'>,
): Promise<number> {
  const db = getDatabase();
  let insertId = 0;
  await db.transaction(async tx => {
    const result = await tx.execute(
      `INSERT INTO messages (conversation_id, role, content, tokens_per_second, time_to_first_token, documents_path)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        message.conversationId,
        message.role,
        message.content,
        message.tokensPerSecond ?? null,
        message.timeToFirstToken ?? null,
        JSON.stringify(message.documentsPath),
      ],
    );
    insertId = result.insertId!;
  });
  return insertId;
}

export async function deleteMessagesByConversationId(
  conversationId: number,
): Promise<void> {
  const db = getDatabase();
  await db.transaction(async tx => {
    await tx.execute('DELETE FROM messages WHERE conversation_id = ?', [
      conversationId,
    ]);
  });
}
