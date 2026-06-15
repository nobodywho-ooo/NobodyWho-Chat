// Silence log (which calls console.log when __DEV__ is true) during tests.
jest.mock('../../../app/helpers/log', () => ({
  log: jest.fn(),
}));

// Stub the clipboard helper so the NativeClipboard TurboModule is never resolved in tests.
jest.mock('../../../app/helpers/clipboard', () => ({
  copyToClipboard: jest.fn(),
}));
