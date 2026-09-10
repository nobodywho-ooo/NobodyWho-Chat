// Whisper doesn't only emit words: when a window holds no speech it labels it
// instead, most often as `[BLANK_AUDIO]`, and it uses the same bracketed form
// for other non-speech sounds. Those labels are annotations about the recording,
// not something the user said, so they must never reach the text field or be
// asked of the chat model. The set below covers what the exports we ship
// produce; anything unlisted is left alone rather than guessed at, so real
// bracketed speech survives.
const NON_SPEECH_LABELS = [
  'blank_audio',
  'blank audio',
  'silence',
  'silent',
  'music',
  'noise',
  'background noise',
  'inaudible',
  'laughter',
  'applause',
  'sound',
  'no speech',
  'pause',
];

// One `[label]`, `(label)` or `*label*` group, matched case-insensitively and
// tolerant of padding inside the delimiters (`[ BLANK_AUDIO ]`).
const NON_SPEECH_PATTERN = new RegExp(
  `(?:\\[\\s*(?:${NON_SPEECH_LABELS.join('|')})\\s*\\]` +
    `|\\(\\s*(?:${NON_SPEECH_LABELS.join('|')})\\s*\\)` +
    `|\\*\\s*(?:${NON_SPEECH_LABELS.join('|')})\\s*\\*)`,
  'gi',
);

/**
 * Turns a raw Whisper transcription into what the user actually said: strips the
 * non-speech annotations the model emits for the quiet parts and collapses the
 * whitespace they leave behind. Returns an empty string when there was nothing
 * but annotations — callers treat that the same as an empty transcription and
 * simply do nothing, rather than dictating `[BLANK_AUDIO]` into the input bar or
 * asking the chat model to answer it.
 */
export const cleanTranscript = (raw: string | undefined): string => {
  if (!raw) {
    return '';
  }

  return raw.replace(NON_SPEECH_PATTERN, ' ').replace(/\s+/g, ' ').trim();
};
