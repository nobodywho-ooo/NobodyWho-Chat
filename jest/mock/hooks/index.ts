import { useAppState, useConversations, useModels } from 'hooks';

jest.mock('hooks', () => {
  const actual = jest.requireActual('hooks');
  return {
    ...actual,
    // Delegates to the real hook by default so tests can drive the real
    // appState store; stub it with mockReturnValue for static values.
    useAppState: jest.fn(actual.useAppState),
    useModels: jest.fn(),
    useConversations: jest.fn(),
  };
});

export const mockUseAppState = useAppState as jest.Mock;
export const mockUseModels = useModels as jest.Mock;
export const mockUseConversations = useConversations as jest.Mock;
