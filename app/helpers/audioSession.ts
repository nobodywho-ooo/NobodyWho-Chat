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

// The mode the session was last successfully switched to, or undefined while
// that is unknown. Tracked rather than inferred from `holders`, because the
// count says who *wants* recording, not what the session is currently on — and
// the two come apart whenever a switch is queued behind another (see syncMode).
let applied: boolean | undefined = false;

// The switch currently in flight, so the next one can queue behind it.
let pending: Promise<void> = Promise.resolve();

// Bring the session in line with the current holder count, one switch at a
// time. Counting holders alone is not enough: it never *ordered* the native
// calls, and setAudioModeAsync is async, so a release's switch to playback
// could resolve after a later acquire's switch to record and leave the session
// playback-only with a microphone open — a stream that stays open but delivers
// no buffers, which is the dead mic this module exists to prevent. Queueing
// them makes the last switch to run the one that was asked for last, and lets a
// joining holder wait out the switch the first holder is still performing
// instead of starting its stream before the route exists.
const syncMode = (): Promise<void> => {
  const run = pending.then(async () => {
    const wanted = holders > 0;

    // A holder that joined or left without changing what the session needs
    // (iOS replaces the audio mode wholesale, so re-applying is a real native
    // round-trip) costs nothing here.
    if (wanted === applied) {
      return;
    }

    // Unknown for the length of the call: a switch that rejects may have
    // applied partially or not at all, and recording the old value across it
    // would let the next sync skip a switch the session actually needs — the
    // session would then sit on the wrong mode until the count next changed.
    applied = undefined;

    await setAudioModeAsync({
      allowsRecording: wanted,
      playsInSilentMode: true,
    });
    applied = wanted;
  });

  // Swallowed into the chain so one failed switch can't reject the *next*
  // caller's wait; `run` still rejects for whoever queued it.
  pending = run.catch(() => undefined);

  return run;
};

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

    // Best-effort: failing to hand the session back must not surface, and must
    // not stop the caller from finishing its own teardown. Still queued when
    // other holders remain, so the release can't overtake a switch in flight.
    try {
      await syncMode();
    } catch (error) {
      log('audioSession release', error);
    }
  };

  holders += 1;

  try {
    // iOS needs the session switched to a record-capable category before the
    // input node can start, so this is awaited before the caller opens its
    // stream — including for a later holder, which waits out the first
    // holder's switch rather than assuming it has already landed.
    await syncMode();
  } catch (error) {
    // Give the hold straight back, so a caller that never got its recording
    // mode can't hold the session in one. syncMode has left `applied`
    // undefined, so the next acquire re-issues the switch rather than trusting
    // whatever the failed one left behind.
    released = true;
    holders -= 1;
    throw error;
  }

  return release;
};

// Test-only: module state outlives a single test, so a suite that acquires has
// to be able to start from zero holders on the session's default mode.
export const resetRecordingModeForTests = (): void => {
  holders = 0;
  applied = false;
  pending = Promise.resolve();
};
