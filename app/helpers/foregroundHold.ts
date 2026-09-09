// A system dialog the app itself launched — the photo or document picker, or
// the microphone permission prompt — takes over the screen and reaches
// AppState as 'background', indistinguishable from the user leaving. The app is
// not going anywhere, though, and the loaded engines have to survive it: the
// background handler frees all four models, so treating a permission prompt as
// a departure unloads them, reloads them on the way back, and tears down the
// very turn the prompt was asked for — the microphone then never opens and the
// screen drops back to its idle state.
//
// Anything that launches such a dialog holds the foreground for as long as it
// is up, and the background handler skips its teardown while a hold is in
// place. Counted rather than a flag: these can nest — a picker whose own
// permission prompt appears on top of it — and the inner one closing must not
// clear the outer one's hold.
let holds = 0;

/** Whether a system dialog the app launched is currently on screen. */
export const isForegroundHeld = (): boolean => holds > 0;

/** Run `run` with the foreground held, releasing it however `run` settles. */
export const holdForeground = async <T>(run: () => Promise<T>): Promise<T> => {
  holds += 1;

  try {
    return await run();
  } finally {
    holds = Math.max(0, holds - 1);
  }
};

// Test-only: module state outlives a single test, so a suite that leaves a hold
// behind (a rejected run, say) has to be able to start from none.
export const resetForegroundHoldForTests = (): void => {
  holds = 0;
};
