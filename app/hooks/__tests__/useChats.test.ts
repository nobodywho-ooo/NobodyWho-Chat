import { renderHook } from '@testing-library/react-native';
import { rowToChat } from 'repositories';

import { useReactiveQuery } from '../useReactiveQuery';
import { useChats } from '../useChats';

jest.mock('../useReactiveQuery');

const mockUseReactiveQuery = useReactiveQuery as jest.Mock;

beforeEach(() => mockUseReactiveQuery.mockReset());

test('queries the chats table and wraps the result', () => {
  const chats = [{ id: 1 }, { id: 2 }];
  mockUseReactiveQuery.mockReturnValue(chats);

  const { result } = renderHook(() => useChats());

  expect(mockUseReactiveQuery).toHaveBeenCalledWith({
    query: 'SELECT * FROM chats ORDER BY last_used DESC',
    tables: ['chats'],
    map: rowToChat,
  });
  expect(result.current).toEqual({ chats });
});
