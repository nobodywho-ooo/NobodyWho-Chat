import { Paths } from 'expo-file-system';

import { Model } from 'types';
import { log } from './log';

const BYTES_PER_GB = 1024 ** 3;

// Headroom kept free on top of the model itself: the transfer holds a transient
// `.chunk` window (16 MiB) beside `.partial` while downloading, and a device
// left with a completely full volume misbehaves in ways unrelated to us.
const RESERVED_GB = 0.5;

// Free space on the volume holding the documents directory, in GB, or
// undefined when the platform can't report it.
export const availableDiskSpaceGB = (): number | undefined => {
  try {
    const bytes = Paths.availableDiskSpace;
    return typeof bytes === 'number' && Number.isFinite(bytes) && bytes >= 0
      ? bytes / BYTES_PER_GB
      : undefined;
  } catch (error) {
    log('availableDiskSpaceGB failed', error, { capture: true });
    return undefined;
  }
};

// What a model occupies on disk once downloaded: the sum of its parts, since
// that is exactly what gets written. Falls back to the catalogue's headline
// size if the parts carry no sizes.
export const modelDownloadSizeGB = (model: Model): number => {
  const partsTotal = model.parts.reduce(
    (total, part) => total + (part.sizeGB ?? 0),
    0,
  );
  return partsTotal > 0 ? partsTotal : model.sizeGB;
};

export interface DiskSpaceCheck {
  fits: boolean;
  requiredGB: number; // Model size plus the reserve,
  availableGB?: number; // Undefined when free space couldn't be read.
}

// Whether the device has room for a model. When free space can't be read we let
// the download run rather than block it on a missing number — the transfer
// itself fails loudly if the disk fills up.
export const checkDiskSpaceForModel = (model: Model): DiskSpaceCheck => {
  const availableGB = availableDiskSpaceGB();
  const requiredGB = modelDownloadSizeGB(model) + RESERVED_GB;

  return {
    fits: availableGB === undefined || availableGB >= requiredGB,
    requiredGB,
    availableGB,
  };
};
