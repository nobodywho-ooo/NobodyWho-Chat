import { cleanTranscript } from '../transcript';

describe('cleanTranscript', () => {
  test('drops a transcription that is nothing but a blank-audio label', () => {
    expect(cleanTranscript('[BLANK_AUDIO]')).toBe('');
    expect(cleanTranscript(' [ blank_audio ] \n')).toBe('');
    expect(cleanTranscript('(blank audio)')).toBe('');
  });

  test('drops other non-speech labels', () => {
    expect(cleanTranscript('[SILENCE]')).toBe('');
    expect(cleanTranscript('*music*')).toBe('');
    expect(cleanTranscript('[MUSIC] [BLANK_AUDIO]')).toBe('');
  });

  test('keeps the speech around a label and collapses the gap', () => {
    expect(cleanTranscript('[BLANK_AUDIO] What is the weather?')).toBe(
      'What is the weather?',
    );
    expect(cleanTranscript('Hello [SILENCE] there')).toBe('Hello there');
  });

  test('leaves ordinary speech untouched', () => {
    expect(cleanTranscript('  Remind me to buy milk.  ')).toBe(
      'Remind me to buy milk.',
    );
  });

  test('keeps bracketed text that is not a known label', () => {
    expect(cleanTranscript('[Chapter one] begins')).toBe(
      '[Chapter one] begins',
    );
  });

  test('treats a missing transcription as empty', () => {
    expect(cleanTranscript(undefined)).toBe('');
  });
});
