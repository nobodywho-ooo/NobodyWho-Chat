import { useEffect, useState } from 'react';
import { Model } from 'types';
import { getDatabase } from 'helpers';
import { rowToModel } from 'repositories';

export function useModels() {
  const [models, setModels] = useState<Model[]>([]);

  useEffect(() => {
    const db = getDatabase();
    const unsubscribe = db.reactiveExecute({
      query: 'SELECT * FROM models ORDER BY id',
      arguments: [],
      fireOn: [{ table: 'models' }],
      callback: response => {
        setModels(response.rows.map(rowToModel));
      },
    });
    return unsubscribe;
  }, []);

  return { models };
}
