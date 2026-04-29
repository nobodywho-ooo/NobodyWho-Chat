jest.mock("@react-navigation/native", () => {
  return {
    useNavigation: () => ({ goBack: jest.fn() }),
    useRoute: () => jest.fn(),
  };
});

jest.mock("@react-navigation/native-stack", () => {
  return {
    createNativeStackNavigator: () => jest.fn,
  };
});

jest.mock("@react-navigation/bottom-tabs", () => {
  return {
    createBottomTabNavigator: () => jest.fn,
    useNavigation: () => ({ goBack: jest.fn() }),
    useRoute: () => jest.fn(),
  };
});

jest.mock("@react-navigation/core", () => {
  return {
    useRoute: () => jest.fn(),
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
    LiquidGlassView: jest.fn(),
    isLiquidGlassSupported: () => jest.fn(),
  };
});

jest.mock('react-native-enriched-markdown', () => {
  return {
    EnrichedMarkdownText: jest.fn(),
  };
});

jest.mock('react-native-nobodywho', () => {
  return {
    ChatMessage: jest.fn(),
    Role: jest.fn(),
  };
});