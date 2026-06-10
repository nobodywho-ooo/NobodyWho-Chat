import { setAppState } from 'database';

jest.mock('database', () => ({
  ...jest.requireActual('database'),
  setAppState: jest.fn(),
}));

export const mockSetAppState = setAppState as jest.Mock;
