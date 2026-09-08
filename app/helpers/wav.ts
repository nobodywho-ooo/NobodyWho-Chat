// RIFF/WAVE container parsing, shared by the two helpers that need it: the one
// that stitches synthesized WAVs together (ttsAudio) and the one that reads a
// WAV back to drive the voice orb (audioLevels). One copy, so a container quirk
// fixed for playback is also fixed for the animation — a second copy drifting
// shows up only as a flat, unreactive orb, which reads as an animation bug.

/** Read a four-char tag. */
export const tagAt = (bytes: Uint8Array, p: number): string =>
  String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]);

export interface WavChunk {
  /** Offset of the chunk's payload, past its 8-byte header. */
  offset: number;
  size: number;
}

/** Locate a RIFF subchunk by id, walking word-aligned subchunk headers. */
export const findChunk = (
  bytes: Uint8Array,
  view: DataView,
  id: string,
): WavChunk | null => {
  let p = 12; // Skip "RIFF" + size + "WAVE".

  while (p + 8 <= bytes.length) {
    const size = view.getUint32(p + 4, true);

    if (tagAt(bytes, p) === id) {
      return { offset: p + 8, size };
    }

    // Chunks are word-aligned: an odd size is followed by a pad byte.
    p += 8 + size + (size % 2);
  }

  return null;
};
