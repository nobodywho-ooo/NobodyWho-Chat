// Dev-only HTTP test hook (no-op outside `__DEV__`).
//
// Talks to a tiny Node server on the host (scripts/devinject-server.js). The
// iOS simulator shares the host loopback, so the app can reach 127.0.0.1:
//   - the Mac pushes a message to inject with  POST /inject { text }
//   - the app polls                         GET  /pending  ({"text": ...})
//   - the app reports results back with      POST /report { ... }
// This lets an external harness drive the chat and read rendered output
// without touching the UI or pasting Metro logs.

const DEV_SERVER = 'http://127.0.0.1:8899';

const fetchJson = async (path: string): Promise<unknown> => {
  if (!__DEV__) {
    return null;
  }
  try {
    const response = await fetch(`${DEV_SERVER}${path}`);
    if (!response.ok) {
      return null;
    }
    return response.json();
  } catch {
    return null;
  }
};

/** Report an event to the dev server (best-effort, fire-and-forget). */
export const reportDev = (
  eventType: string,
  payload: Record<string, unknown>,
): void => {
  if (!__DEV__) {
    return;
  }
  fetch(`${DEV_SERVER}/report`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ t: Date.now(), type: eventType, ...payload }),
  }).catch(() => undefined);
};

/** Poll the dev server for a pending message to inject into the chat. */
export const pollForInjection = async (): Promise<string | null> => {
  const data = await fetchJson('/pending');
  if (data && typeof (data as { text?: unknown }).text === 'string') {
    const text = (data as { text: string }).text.trim();
    return text.length > 0 ? text : null;
  }
  return null;
};