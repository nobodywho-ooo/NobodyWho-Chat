import { renderHook } from '@testing-library/react-native';
import { rowToConversation } from 'repositories';

import { useReactiveQuery } from '../useReactiveQuery';
import { useConversations } from '../useConversations';

jest.mock('../useReactiveQuery');

const mockUseReactiveQuery = useReactiveQuery as jest.Mock;

beforeEach(() => mockUseReactiveQuery.mockReset());

test('queries the conversations table and wraps the result', () => {
  const conversations = [{ id: 1 }, { id: 2 }];
  mockUseReactiveQuery.mockReturnValue(conversations);

  const { result } = renderHook(() => useConversations());

  expect(mockUseReactiveQuery).toHaveBeenCalledWith({
    query: 'SELECT * FROM conversations ORDER BY last_used DESC, id DESC',
    tables: ['conversations'],
    map: rowToConversation,
  });
  expect(result.current).toEqual({ conversations });
});
