const expandErrors = (value: unknown): unknown =>
  value instanceof Error
    ? `${value.message}${value.stack ? `\n${value.stack}` : ''}`
    : value;

export const devLog = (...args: unknown[]): void => {
  if (__DEV__) {
    console.log(...args.map(expandErrors));
  }
};
