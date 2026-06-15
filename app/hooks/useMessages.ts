import { ChatMessage } from 'types';
import { rowToMessage } from 'repositories';
import { useReactiveQuery } from './useReactiveQuery';

export function useMessages(conversationId: number | undefined) {
  const { rows: messages } = useReactiveQuery<ChatMessage>({
    query:
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
    args: conversationId !== undefined ? [conversationId] : [],
    tables: ['messages'],
    map: rowToMessage,
    enabled: conversationId !== undefined,
  });

  return { messages };
}
