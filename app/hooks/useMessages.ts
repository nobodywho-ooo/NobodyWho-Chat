import { ChatMessage } from 'types';
import { rowToMessage } from 'repositories';
import { useReactiveQuery } from './useReactiveQuery';

export function useMessages(chatId: number | undefined) {
  const messages = useReactiveQuery<ChatMessage>({
    query: 'SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC',
    args: chatId !== undefined ? [chatId] : [],
    tables: ['messages'],
    map: rowToMessage,
    enabled: chatId !== undefined,
  });

  return { messages };
}
