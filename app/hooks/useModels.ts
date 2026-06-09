import { Model } from 'types';
import { rowToModel } from 'repositories';
import { useReactiveQuery } from './useReactiveQuery';

export function useModels() {
  const models = useReactiveQuery<Model>({
    query: 'SELECT * FROM models ORDER BY id',
    tables: ['models'],
    map: rowToModel,
  });

  return { models };
}
