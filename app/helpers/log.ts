import * as Sentry from '@sentry/react-native';

interface LogOptions {
  capture?: boolean;
}

const expandErrors = (value: unknown): unknown =>
  value instanceof Error
    ? `${value.message}${value.stack ? `\n${value.stack}` : ''}`
    : value;

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
  }

  if (options.capture) {
    const error = args.find(arg => arg instanceof Error);
    Sentry.captureException(error ?? new Error(args.map(String).join(' ')));
  }
};
