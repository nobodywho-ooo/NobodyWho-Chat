import { useModels } from 'hooks';

jest.mock('hooks', () => ({
  ...jest.requireActual('hooks'),
  useModels: jest.fn(),
}));

export const mockUseModels = useModels as jest.Mock;
