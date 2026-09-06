import { useMemo } from 'react';
import { Model } from 'types';

import { useAppState } from './useAppState';
import { useModels } from './useModels';

// The downloaded model currently occupying the voice slot (ttsModelIdInUse), or
// undefined when none is selected or it isn't downloaded. Lives in the global
// hooks folder so any screen can read it without depending on the Models
// screen's catalogue-fetching hook (useAvailableModels).
export const useCurrentTtsModel = (): Model | undefined => {
  const { models } = useModels();
  const { ttsModelIdInUse } = useAppState();

  return useMemo(
    () => models.find(model => model.id === ttsModelIdInUse),
    [models, ttsModelIdInUse],
  );
};
