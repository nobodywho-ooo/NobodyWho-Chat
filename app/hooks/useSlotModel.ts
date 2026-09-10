import { useMemo } from 'react';
import { Model, ModelSlot, modelSlotSpec } from 'types';

import { useAppState } from './useAppState';
import { useModels } from './useModels';

// The downloaded model currently occupying `slot`, or undefined when none is
// selected or the selected one isn't downloaded. Lives in the global hooks
// folder so any screen can read it without depending on the Models screen's
// catalogue-fetching hook (useAvailableModels).
export const useSlotModel = (slot: ModelSlot): Model | undefined => {
  const { models } = useModels();
  const appState = useAppState();
  const modelId = appState[modelSlotSpec(slot).appStateKey];

  return useMemo(
    () => models.find(model => model.id === modelId),
    [models, modelId],
  );
};
