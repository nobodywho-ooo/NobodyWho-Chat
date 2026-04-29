export const devLog = (...args: unknown[]): void => {
  if (__DEV__) {
    console.log(...args);
  }
};
