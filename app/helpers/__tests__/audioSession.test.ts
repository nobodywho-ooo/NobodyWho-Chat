import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';

import {
  acquireRecordingMode,
  requestMicrophonePermission,
  resetRecordingModeForTests,
} from '../audioSession';
import {
  isForegroundHeld,
  resetForegroundHoldForTests,
} from '../foregroundHold';

(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;

const mockSetAudioMode = setAudioModeAsync as jest.Mock;

const mockRequestPermissions = requestRecordingPermissionsAsync as jest.Mock;

beforeEach(() => {
  resetRecordingModeForTests();
  resetForegroundHoldForTests();
  mockSetAudioMode.mockReset().mockResolvedValue(undefined);
  mockRequestPermissions.mockReset().mockResolvedValue({ granted: true });
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

// Lets every queued microtask run, so "no switch has been issued yet" is a
// real observation rather than one made before the queue drained.
const settleQueue = () => new Promise<void>(resolve => setImmediate(resolve));

test('queues switches so a release cannot overtake a later acquire', async () => {
  const release = await acquireRecordingMode();
  mockSetAudioMode.mockClear();

  // Hold the release's switch to playback open. Counting holders never ordered
  // these native calls, so this switch used to be able to resolve *after* the
  // acquire below — leaving the session playback-only with a stream open, which
  // stays open but delivers no buffers.
  let settleRelease: () => void = () => {};
  mockSetAudioMode.mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        settleRelease = () => resolve();
      }),
  );

  const releasing = release();
  await settleQueue();
  expect(mockSetAudioMode).toHaveBeenCalledTimes(1);
  expect(mockSetAudioMode).toHaveBeenLastCalledWith({
    allowsRecording: false,
    playsInSilentMode: true,
  });

  // A new holder arrives while that switch is still in flight. Its own switch
  // has to wait rather than race the one already running.
  const acquiring = acquireRecordingMode();
  await settleQueue();
  expect(mockSetAudioMode).toHaveBeenCalledTimes(1);

  settleRelease();
  await releasing;
  const secondRelease = await acquiring;

  // Only now does record mode go out, and it is the last word — so the
  // acquire's caller can open its stream on a session that is really on it.
  expect(mockSetAudioMode).toHaveBeenCalledTimes(2);
  expect(mockSetAudioMode).toHaveBeenLastCalledWith({
    allowsRecording: true,
    playsInSilentMode: true,
  });

  await secondRelease();
});

test('re-issues a switch after one fails rather than assuming it landed', async () => {
  const release = await acquireRecordingMode();
  mockSetAudioMode.mockClear();

  // A rejected switch may have applied partially or not at all, so the mode the
  // session is on is unknown from here — the next sync must not skip as
  // redundant on the strength of what the failed one was asked for.
  mockSetAudioMode.mockRejectedValueOnce(new Error('session busy'));
  await release();

  const second = await acquireRecordingMode();
  expect(mockSetAudioMode).toHaveBeenCalledTimes(2);
  expect(mockSetAudioMode).toHaveBeenLastCalledWith({
    allowsRecording: true,
    playsInSilentMode: true,
  });

  await second();
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

// --- Microphone permission -------------------------------------------------

test('holds the foreground while the permission prompt is up', async () => {
  // Hold the prompt open to observe the window Android reports as
  // 'background': the navigator frees every model on that event, so a turn
  // waiting on the permission it just asked for would be torn down by its own
  // prompt — and the user would land back on a reloading screen.
  let grant: (result: unknown) => void = () => {};
  mockRequestPermissions.mockReturnValue(
    new Promise(resolve => {
      grant = resolve;
    }),
  );

  expect(isForegroundHeld()).toBe(false);

  const pending = requestMicrophonePermission();
  expect(isForegroundHeld()).toBe(true);

  grant({ granted: true });
  await expect(pending).resolves.toEqual({ granted: true });

  expect(isForegroundHeld()).toBe(false);
});

test('releases the hold when the permission is refused', async () => {
  mockRequestPermissions.mockResolvedValue({ granted: false });

  await expect(requestMicrophonePermission()).resolves.toEqual({
    granted: false,
  });
  expect(isForegroundHeld()).toBe(false);
});

test('releases the hold when the prompt throws', async () => {
  mockRequestPermissions.mockRejectedValue(new Error('no permission module'));

  await expect(requestMicrophonePermission()).rejects.toThrow(
    'no permission module',
  );
  expect(isForegroundHeld()).toBe(false);
});
