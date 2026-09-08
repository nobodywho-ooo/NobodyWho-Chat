const MB_PER_GB = 1024;

// Reads a model's on-disk size, dropping to megabytes below a gigabyte so a
// small model shows "102 MB" instead of "0.1 GB".
export const modelSizeLabel = (sizeGB: number): string => {
  // Round to megabytes first, then pick the unit from the rounded value.
  // Choosing the unit from the unrounded number instead lets a size just under
  // a gigabyte (0.9999) stay on the "MB" branch and render as "1024 MB".
  const megabytes = Math.round(sizeGB * MB_PER_GB);

  return megabytes < MB_PER_GB
    ? `${megabytes} MB`
    : `${Math.round((megabytes / MB_PER_GB) * 100) / 100} GB`;
};
