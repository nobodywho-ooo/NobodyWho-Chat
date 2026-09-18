// Tuned numbers the engines are loaded with, kept together and away from the
// code that uses them — each one is a measurement or a workaround, and the
// reasoning is longer than the value.

// destroy() is fire-and-forget: it signals the native worker thread but returns
// before the llama_context / Metal buffers are actually freed, with no
// completion signal to await. So after a teardown the backend is held clear for
// this long before the next load allocates — otherwise the new context starts
// reserving Metal buffers while the old one is still releasing them, which on
// multimodal models (large footprint) makes a buffer allocation return NULL and
// crashes inside ggml-metal. Heuristic, not a real wait; bump it if field
// crashes persist.
export const TEARDOWN_SETTLE_MS = 500;

export const DEFAULT_CONTEXT_SIZE = 4096;

// Hold a requested context to what the model was actually trained for. An
// unknown ceiling (a model whose metadata doesn't report one) leaves the
// request alone rather than guessing a cap.
export const clampContextSize = (
  requested: number | undefined,
  maxContext: number | undefined,
): number | undefined =>
  maxContext === undefined
    ? requested
    : Math.min(requested ?? DEFAULT_CONTEXT_SIZE, maxContext);

export const VAD_SAMPLE_RATE = 16000;

// How long the user has to stay quiet before the detector calls the turn over.
export const VAD_MIN_SILENCE_MS = 1500;

export const VAD_THRESHOLD = 0.3;
export const VAD_MIN_SPEECH_MS = 90;
