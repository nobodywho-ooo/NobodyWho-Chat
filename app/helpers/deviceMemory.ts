import { getTotalMemory } from 'react-native-device-info';
import { Model, ModelPart } from 'types';
import { isIOS } from './platform';
import { log } from './log';

const BYTES_PER_GB = 1024 ** 3;

// RAM the OS keeps for itself and never makes available to a model. iOS sits
// around 2 GB; on Android it varies by manufacturer, so we reserve the higher
// estimate to stay safe across devices.
const OS_RESERVED_GB = isIOS ? 2 : 3;

// The projection (mmproj) model is held in memory alongside the chat model, so
// while running its weights effectively take up twice their on-disk size.
const PROJECTION_MODEL_MULTIPLIER = 2;

const partMemoryGB = (part: ModelPart): number =>
  part.type === 'projection-model'
    ? part.sizeGB * PROJECTION_MODEL_MULTIPLIER
    : part.sizeGB;

// The RAM a model needs to run: the sum of every part's size, counting the projection model twice.
export const modelRequiredMemoryGB = (model: Model): number =>
  model.parts.reduce((total, part) => total + partMemoryGB(part), 0);

// Keep only the models the device has enough RAM to run. If the device total
// memory can't be read, fall back to returning every model rather than hiding
// all of them.
export const filterModelsByDeviceMemory = async (
  models: Model[],
): Promise<Model[]> => {
  try {
    const totalMemoryGB = (await getTotalMemory()) / BYTES_PER_GB;
    const usableMemoryGB = totalMemoryGB - OS_RESERVED_GB;
    return models.filter(
      model => modelRequiredMemoryGB(model) <= usableMemoryGB,
    );
  } catch (error) {
    log('filterModelsByDeviceMemory failed', error, { capture: true });
    return models;
  }
};
