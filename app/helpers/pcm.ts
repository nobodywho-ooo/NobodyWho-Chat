// Small buffer utilities shared by the capture paths (input-bar dictation and
// the voice assistant), which both collect mono int16 PCM windows from the
// microphone and have to hand them on as one contiguous buffer — or at a
// specific rate, for a consumer whose sample rate is fixed at load time.

/** Join captured PCM windows into a single contiguous buffer. */
export const concatPcm = (chunks: Int16Array[]): Int16Array => {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const samples = new Int16Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    samples.set(chunk, offset);
    offset += chunk.length;
  }

  return samples;
};

// Resample mono int16 PCM. Down to a lower rate each output sample is the mean
// of the source samples it spans, which doubles as a cheap anti-alias filter
// (plain nearest-neighbour decimation folds everything above the new Nyquist
// back into the speech band); up to a higher rate output samples are linearly
// interpolated. A trailing partial window is dropped, so resampling a stream
// chunk by chunk loses at most one sample per chunk.
export const resamplePcm = (
  samples: Int16Array,
  fromRate: number,
  toRate: number,
): Int16Array => {
  if (
    fromRate === toRate ||
    fromRate <= 0 ||
    toRate <= 0 ||
    samples.length === 0
  ) {
    return samples;
  }

  const ratio = fromRate / toRate;
  const length = Math.floor(samples.length / ratio);

  if (length === 0) {
    return new Int16Array(0);
  }

  const resampled = new Int16Array(length);

  if (ratio > 1) {
    for (let i = 0; i < length; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.min(Math.floor((i + 1) * ratio), samples.length);
      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += samples[j];
      }
      resampled[i] = Math.round(sum / Math.max(1, end - start));
    }
    return resampled;
  }

  for (let i = 0; i < length; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const next = Math.min(index + 1, samples.length - 1);
    const fraction = position - index;
    resampled[i] = Math.round(
      samples[index] + (samples[next] - samples[index]) * fraction,
    );
  }

  return resampled;
};
