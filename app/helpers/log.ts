
const expandErrors = (value: unknown): unknown =>
  value instanceof Error ? (value.stack ?? `${value.name}: ${value.message}`) : value;

export const devLog = (...args: unknown[]): void => {
  if (__DEV__) {
    console.log(...args.map(expandErrors));
  }
};
