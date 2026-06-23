import {
  useAppState,
  useConversations,
  useModelDownloads,
  useModels,
} from 'hooks';

jest.mock('hooks', () => {
  const actual = jest.requireActual('hooks');
  return {
    ...actual,
    // Delegates to the real hook by default so tests can drive the real
    // appState store; stub it with mockReturnValue for static values.
    useAppState: jest.fn(actual.useAppState),
    useModels: jest.fn(),
    useConversations: jest.fn(),
    // Defaults to no in-progress downloads — the same result the real reactive
    // query yields in tests (no rows). Override per test to render the
    // downloading section.
    useModelDownloads: jest.fn(() => ({ downloads: [], loading: false })),
  };
});

export const mockUseAppState = useAppState as jest.Mock;
export const mockUseModels = useModels as jest.Mock;
export const mockUseConversations = useConversations as jest.Mock;
export const mockUseModelDownloads = useModelDownloads as jest.Mock;
