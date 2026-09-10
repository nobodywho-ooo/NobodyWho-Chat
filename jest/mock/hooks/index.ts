import {
  useAppState,
  useConversations,
  useModelDownloads,
  useModels,
  useSlotModel,
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
    // Composes useModels + useAppState (both real reactive queries), so stub it
    // here rather than let it hit the database. Defaults to no model in any slot.
    useSlotModel: jest.fn(() => undefined),
  };
});

export const mockUseAppState = useAppState as jest.Mock;
export const mockUseModels = useModels as jest.Mock;
export const mockUseConversations = useConversations as jest.Mock;
export const mockUseModelDownloads = useModelDownloads as jest.Mock;
export const mockUseSlotModel = useSlotModel as jest.Mock;
