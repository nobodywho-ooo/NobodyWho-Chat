import { getModelIdInUse } from 'helpers';

jest.mock('helpers', () => ({
  ...jest.requireActual('helpers'),
  getModelIdInUse: jest.fn(),
}));

export const mockGetModelIdInUse = getModelIdInUse as jest.Mock;
