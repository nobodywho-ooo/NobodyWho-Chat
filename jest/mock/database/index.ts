import { getModelIdInUse } from 'database';

jest.mock('database', () => ({
  ...jest.requireActual('database'),
  getModelIdInUse: jest.fn(),
}));

export const mockGetModelIdInUse = getModelIdInUse as jest.Mock;
