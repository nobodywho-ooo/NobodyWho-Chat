jest.mock("@react-navigation/native", () => {
  return {
    useNavigation: () => ({ goBack: jest.fn() }),
    useRoute: () => jest.fn(),
    SFSymbol: 'SFSymbol',
    MaterialSymbol: 'MaterialSymbol',
  };
});

jest.mock("@react-navigation/native-stack", () => {
  return {
    createNativeStackNavigator: () => jest.fn,
  };
});

jest.mock("@react-navigation/core", () => {
  return {
    useRoute: () => jest.fn(),
  };
});

jest.mock("react-native-haptic-feedback", () => {
  return {
    trigger: jest.fn(),
  };
});

jest.mock('@dr.pogodin/react-native-fs', () => {
  return {
    copyFile: jest.fn(),
    exists: jest.fn(),
    copyFileAssets: jest.fn(),
    MainBundlePath: jest.fn(),
    DocumentDirectoryPath: jest.fn(),
  };
});

jest.mock('@callstack/liquid-glass', () => {
  return {
    LiquidGlassView: 'LiquidGlassView',
    isLiquidGlassSupported: false,
  };
});

jest.mock('react-native-enriched-markdown', () => {
  return {
    EnrichedMarkdownText: jest.fn(),
  };
});

jest.mock('react-native-streamdown', () => {
  return {
    StreamdownText: jest.fn(),
  };
});

jest.mock('react-native-nobodywho', () => {
  return {
    ChatMessage: jest.fn(),
    Role: {
      User: 0,
      Assistant: 1,
      System: 2,
      Tool: 3,
    },
  };
});

jest.mock("react-native-safe-area-context", () => {
  return {
    useSafeAreaInsets: () => jest.fn,
  };
});

jest.mock('@op-engineering/op-sqlite', () => {
  const mockDb = {
    execute: jest.fn().mockResolvedValue({ rows: [] }),
    executeSync: jest.fn().mockReturnValue({ rows: [] }),
    executeBatch: jest.fn().mockResolvedValue({}),
    reactiveExecute: jest.fn().mockReturnValue(jest.fn()),
    flushPendingReactiveQueries: jest.fn().mockResolvedValue(undefined),
    close: jest.fn(),
  };
  return {
    open: jest.fn().mockReturnValue(mockDb),
  };
});