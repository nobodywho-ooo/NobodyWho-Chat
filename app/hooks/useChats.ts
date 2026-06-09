import { Chat } from 'types';
import { rowToChat } from 'repositories';
import { useReactiveQuery } from './useReactiveQuery';

export function useChats() {
  const chats = useReactiveQuery<Chat>({
    query: 'SELECT * FROM chats ORDER BY last_used DESC',
    tables: ['chats'],
    map: rowToChat,
  });

  return { chats };
}
