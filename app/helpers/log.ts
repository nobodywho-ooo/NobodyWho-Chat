import * as Sentry from '@sentry/react-native';

interface LogOptions {
  capture?: boolean;
  tags?: Record<string, string>;
  contexts?: Record<string, Record<string, unknown>>;
}

// Error stacks from native inference can be enormous (a failed grammar build
// embeds the whole generated grammar), and building that string has overflowed
// the Hermes string limit and crashed `log` itself. Cut the expansion short so
// logging an error can never bring the app down — the head of the message/stack
// is what matters for diagnosis.
const MAX_ERROR_TEXT = 60_000;

// Truncate a single string *before* it participates in a concatenation — the
// overflow happened while building the joined text, so it has to be guarded
// at the source, not after.
const truncate = (text: string): string =>
  text.length <= MAX_ERROR_TEXT ? text : `${text.slice(0, MAX_ERROR_TEXT)}… (truncated)`;

const expandErrors = (value: unknown): unknown => {
  if (!(value instanceof Error)) {
    return value;
  }
  const message = truncate(value.message ? String(value.message) : '');
  const stack = value.stack ? truncate(value.stack) : '';
  return stack ? `${message}\n${stack}` : message;
};

const isLogOptions = (value: unknown): value is LogOptions =>
  typeof value === 'object' &&
  value !== null &&
  !(value instanceof Error) &&
  'capture' in value;

export const log = (...args: unknown[]): void => {
  let options: LogOptions = {};
  if (isLogOptions(args[args.length - 1])) {
    options = args.pop() as LogOptions;
  }

  if (__DEV__) {
    console.log(...args.map(expandErrors));
    // Dev-only mirror to the host: the harness reads /tmp/devreports.txt, so
    // every diagnostic (parse failures, stall-guard fires, a2ui render logs)
    // is visible there instead of dying in an unreachable console.
    try {
      fetch('http://127.0.0.1:8899/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          t: Date.now(),
          type: 'log',
          msg: args.map(a => (a instanceof Error ? String(a) : a)),
        }),
      }).catch(() => undefined);
    } catch {
      // logging must never throw
    }
  }

  if (options.capture) {
    const error = args.find(arg => arg instanceof Error);
    Sentry.captureException(error ?? new Error(args.map(String).join(' ')), {
      tags: options.tags,
      contexts: options.contexts,
    });
  }
};
