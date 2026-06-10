import { useAppState, useModels } from 'hooks';

jest.mock('hooks', () => ({
  ...jest.requireActual('hooks'),
  useAppState: jest.fn(),
  useModels: jest.fn(),
}));

export const mockUseAppState = useAppState as jest.Mock;
export const mockUseModels = useModels as jest.Mock;
