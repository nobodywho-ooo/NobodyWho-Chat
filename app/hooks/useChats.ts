import { useEffect, useState } from 'react';
import { Chat } from 'types';
import { getDatabase } from 'database';
import { getAllChats, rowToChat } from 'repositories';

export function useChats() {
  const [chats, setChats] = useState<Chat[]>([]);

  useEffect(() => {
    getAllChats().then(setChats);

    const db = getDatabase();
    const unsubscribe = db.reactiveExecute({
      query: 'SELECT * FROM chats ORDER BY last_used DESC',
      arguments: [],
      fireOn: [{ table: 'chats' }],
      callback: response => {
        setChats(response.rows.map(rowToChat));
      },
    });
    return unsubscribe;
  }, []);

  return { chats };
}
