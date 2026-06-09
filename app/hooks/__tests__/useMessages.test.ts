import { renderHook } from '@testing-library/react-native';
import { rowToMessage } from 'repositories';

import { useReactiveQuery } from '../useReactiveQuery';
import { useMessages } from '../useMessages';

jest.mock('../useReactiveQuery');

const mockUseReactiveQuery = useReactiveQuery as jest.Mock;

beforeEach(() => mockUseReactiveQuery.mockReset());

test('queries messages for the given conversation and wraps the result', () => {
  const messages = [{ id: 1 }, { id: 2 }];
  mockUseReactiveQuery.mockReturnValue(messages);

  const { result } = renderHook(() => useMessages(5));

  expect(mockUseReactiveQuery).toHaveBeenCalledWith({
    query:
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
    args: [5],
    tables: ['messages'],
    map: rowToMessage,
    enabled: true,
  });
  expect(result.current).toEqual({ messages });
});

test('disables the query when no conversationId is provided', () => {
  mockUseReactiveQuery.mockReturnValue([]);

  renderHook(() => useMessages(undefined));

  expect(mockUseReactiveQuery).toHaveBeenCalledWith(
    expect.objectContaining({ args: [], enabled: false }),
  );
});
