import { renderHook } from '@testing-library/react-native';
import { rowToModel } from 'repositories';

import { useReactiveQuery } from '../useReactiveQuery';
import { useModels } from '../useModels';

jest.mock('../useReactiveQuery');

const mockUseReactiveQuery = useReactiveQuery as jest.Mock;

beforeEach(() => mockUseReactiveQuery.mockReset());

test('queries the models table and wraps the result', () => {
  const models = [{ id: 1 }, { id: 2 }];
  mockUseReactiveQuery.mockReturnValue(models);

  const { result } = renderHook(() => useModels());

  expect(mockUseReactiveQuery).toHaveBeenCalledWith({
    query: 'SELECT * FROM models ORDER BY id',
    tables: ['models'],
    map: rowToModel,
  });
  expect(result.current).toEqual({ models });
});
