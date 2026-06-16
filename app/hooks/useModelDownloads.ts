import { ModelDownload } from 'types';
import { rowToModelDownload } from 'repositories';
import { useReactiveQuery } from './useReactiveQuery';

export function useModelDownloads() {
  const { rows: downloads, loading } = useReactiveQuery<ModelDownload>({
    query: 'SELECT * FROM model_downloads ORDER BY model_id',
    tables: ['model_downloads'],
    map: rowToModelDownload,
  });

  return { downloads, loading };
}
