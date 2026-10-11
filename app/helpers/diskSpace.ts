import { Paths } from 'expo-file-system';

import { Model, ModelDownload } from 'types';
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

// What a download in progress still has to write: each part's size times the
// share of it not downloaded yet.
export const remainingDownloadSizeGB = (download: ModelDownload): number =>
  download.partsProgress.reduce(
    (total, part) =>
      total + (part.sizeGB ?? 0) * (1 - Math.min(part.progress, 1)),
    0,
  );

export interface DiskSpaceCheck {
  fits: boolean;
  requiredGB: number; // Model size plus the reserve,
  // Free space minus what downloads in progress still have to write; undefined
  // when free space couldn't be read.
  availableGB?: number;
}

// Whether the device has room for a model. When free space can't be read we let
// the download run rather than block it on a missing number — the transfer
// itself fails loudly if the disk fills up. Downloads already in progress
// (`inProgress`) still have bytes to write, so that space isn't available.
export const checkDiskSpaceForModel = (
  model: Model,
  inProgress: readonly ModelDownload[] = [],
): DiskSpaceCheck => checkDiskSpaceForModels([model], inProgress);

// Same check for a batch downloaded together: room for all of them at once,
// with a single reserve.
export const checkDiskSpaceForModels = (
  models: readonly Model[],
  inProgress: readonly ModelDownload[] = [],
): DiskSpaceCheck => {
  const freeGB = availableDiskSpaceGB();
  const pendingGB = inProgress
    .filter(download => !models.some(model => model.id === download.model.id))
    .reduce((total, download) => total + remainingDownloadSizeGB(download), 0);
  const availableGB =
    freeGB === undefined ? undefined : Math.max(0, freeGB - pendingGB);
  const requiredGB =
    models.reduce((total, model) => total + modelDownloadSizeGB(model), 0) +
    RESERVED_GB;

  return {
    fits: availableGB === undefined || availableGB >= requiredGB,
    requiredGB,
    availableGB,
  };
};
