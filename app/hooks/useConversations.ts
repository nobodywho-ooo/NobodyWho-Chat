import { Conversation } from 'types';
import { rowToConversation } from 'repositories';
import { useReactiveQuery } from './useReactiveQuery';

export function useConversations() {
  const { rows: conversations } = useReactiveQuery<Conversation>({
    query: 'SELECT * FROM conversations ORDER BY last_used DESC, id DESC',
    tables: ['conversations'],
    map: rowToConversation,
  });

  return { conversations };
}
