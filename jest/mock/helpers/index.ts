// Silence devLog (which calls console.log when __DEV__ is true) during tests.
jest.mock('../../../app/helpers/log', () => ({
  devLog: jest.fn(),
}));
