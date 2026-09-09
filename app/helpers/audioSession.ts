import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';

import { holdForeground } from './foregroundHold';
import { log } from './log';

// How long the microphone may stay open on one turn before a capture path
// closes it itself. Nothing else is guaranteed to: with no detection model
// loaded a recording only ends when the user taps stop, and with one loaded the
// detector reports the end of speech only when it confirmed the beginning, so a
// turn it never hears start is a turn it can never end — the microphone then
// stays open indefinitely with the recording running. Long enough that it is
// never reached by anyone actually speaking a question or dictating a message;
// it exists so a capture that has stopped making progress recovers on its own
// rather than being left to the user to notice.
export const MAX_RECORDING_MS = 60000;

// Ask for the microphone, with the foreground held for as long as the system
// prompt is up. On Android that prompt takes the screen and reaches AppState as
// 'background', which would otherwise unload every model and abandon the turn
// that asked for the microphone in the first place — the user grants the
// permission and lands back on a reloading screen instead of a live microphone.
export const requestMicrophonePermission = (): Promise<{ granted: boolean }> =>
  holdForeground(requestRecordingPermissionsAsync);

// The audio session is process-wide, but two features hold the microphone: the
// input bar's dictation and the voice assistant, which is always mounted as the
// right drawer's content. Whichever finished first used to drop the session back
// to playback-only, cutting the input route out from under the other — its
// stream stays open but stops delivering buffers, so a turn waiting on
// end-of-speech waits forever with a dead mic. Reference-count the recording
// mode instead, and only switch back once the last holder lets go.
//
// `playsInSilentMode` is set in both directions on purpose: on iOS the audio
// mode is replaced wholesale rather than merged, so dropping it would revert the
// session to the .ambient category and mute playback whenever the ringer switch
// is on.
let holders = 0;

const applyMode = (allowsRecording: boolean) =>
  setAudioModeAsync({ allowsRecording, playsInSilentMode: true });

// Put the session into record mode and return this acquisition's release.
// Releasing twice is a no-op, so a caller can release on both its success and
// error paths without dropping someone else's hold.
export const acquireRecordingMode = async (): Promise<() => Promise<void>> => {
  let released = false;

  const release = async (): Promise<void> => {
    if (released) {
      return;
    }
    released = true;
    holders -= 1;

    if (holders > 0) {
      return;
    }

    // Best-effort: failing to hand the session back must not surface, and must
    // not stop the caller from finishing its own teardown.
    try {
      await applyMode(false);
    } catch (error) {
      log('audioSession release', error);
    }
  };

  holders += 1;

  try {
    // iOS needs the session switched to a record-capable category before the
    // input node can start; a later holder joins the one already in effect.
    if (holders === 1) {
      await applyMode(true);
    }
  } catch (error) {
    released = true;
    holders -= 1;
    throw error;
  }

  return release;
};

// Test-only: module state outlives a single test, so a suite that acquires has
// to be able to start from zero holders.
export const resetRecordingModeForTests = (): void => {
  holders = 0;
};
