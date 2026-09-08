import { setAudioModeAsync } from 'expo-audio';

import {
  acquireRecordingMode,
  resetRecordingModeForTests,
} from '../audioSession';

(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;

const mockSetAudioMode = setAudioModeAsync as jest.Mock;

beforeEach(() => {
  resetRecordingModeForTests();
  mockSetAudioMode.mockReset().mockResolvedValue(undefined);
});

test('switches the session into record mode for the first holder only', async () => {
  const releaseFirst = await acquireRecordingMode();
  expect(mockSetAudioMode).toHaveBeenCalledTimes(1);
  expect(mockSetAudioMode).toHaveBeenCalledWith({
    allowsRecording: true,
    playsInSilentMode: true,
  });

  const releaseSecond = await acquireRecordingMode();
  // The second holder joins the mode already in effect.
  expect(mockSetAudioMode).toHaveBeenCalledTimes(1);

  // Releasing one of two holders must not hand the session back: the input
  // route would be cut out from under whoever is still capturing.
  await releaseFirst();
  expect(mockSetAudioMode).toHaveBeenCalledTimes(1);

  await releaseSecond();
  expect(mockSetAudioMode).toHaveBeenLastCalledWith({
    allowsRecording: false,
    playsInSilentMode: true,
  });
});

test('releasing twice does not drop another holder', async () => {
  const releaseFirst = await acquireRecordingMode();
  const releaseSecond = await acquireRecordingMode();

  await releaseFirst();
  await releaseFirst();
  expect(mockSetAudioMode).toHaveBeenCalledTimes(1);

  await releaseSecond();
  expect(mockSetAudioMode).toHaveBeenCalledTimes(2);
});

test('keeps playsInSilentMode set in both directions', async () => {
  const release = await acquireRecordingMode();
  await release();

  // On iOS the audio mode is replaced wholesale, so dropping this flag would
  // revert the session to .ambient and mute playback on a muted ringer.
  for (const call of mockSetAudioMode.mock.calls) {
    expect(call[0].playsInSilentMode).toBe(true);
  }
});

test('a failed acquire does not leave the session pinned open', async () => {
  mockSetAudioMode.mockRejectedValueOnce(new Error('no input route'));

  await expect(acquireRecordingMode()).rejects.toThrow('no input route');

  // The failed attempt released its count, so the next acquire is the first
  // holder again and actually switches the mode.
  mockSetAudioMode.mockResolvedValue(undefined);
  await acquireRecordingMode();
  expect(mockSetAudioMode).toHaveBeenLastCalledWith({
    allowsRecording: true,
    playsInSilentMode: true,
  });
});

test('a failing release still gives up the hold', async () => {
  const release = await acquireRecordingMode();
  mockSetAudioMode.mockRejectedValueOnce(new Error('session busy'));

  // Best-effort: the caller's own teardown must not be blocked by it.
  await expect(release()).resolves.toBeUndefined();

  mockSetAudioMode.mockResolvedValue(undefined);
  await acquireRecordingMode();
  expect(mockSetAudioMode).toHaveBeenLastCalledWith({
    allowsRecording: true,
    playsInSilentMode: true,
  });
});
