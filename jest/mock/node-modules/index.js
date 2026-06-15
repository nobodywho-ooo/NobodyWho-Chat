// @sentry/react-native ships ESM that the RN jest preset does not transform, so
// stub the bits the app uses (captureException, wrap, init, NavigationContainer...).
jest.mock('@sentry/react-native', () => {
  const mockReact = require('react');
  return {
    init: jest.fn(),
    wrap: component => component,
    captureException: jest.fn(),
    appLoaded: jest.fn(),
    mobileReplayIntegration: jest.fn(),
    reactNavigationIntegration: jest.fn(),
    NavigationContainer: ({ children }) =>
      mockReact.createElement(mockReact.Fragment, null, children),
  };
});

jest.mock("@react-native-menu/menu", () => {
  const mockReact = require('react');
  return {
    MenuView: ({ children }) =>
      mockReact.createElement(mockReact.Fragment, null, children),
  };
});

jest.mock("react-native-haptic-feedback", () => {
  return {
    trigger: jest.fn(),
  };
});

jest.mock('react-native-device-info', () => ({
  getVersion: jest.fn(() => '1.0.0'),
  getBuildNumber: jest.fn(() => '1'),
}));

jest.mock('@dr.pogodin/react-native-fs', () => {
  return {
    copyFile: jest.fn(),
    exists: jest.fn(),
    copyFileAssets: jest.fn(),
    MainBundlePath: jest.fn(),
    DocumentDirectoryPath: jest.fn(),
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

jest.mock('react-native-linear-gradient', () => ({
  __esModule: true,
  default: 'LinearGradient',
}));

jest.mock('@shopify/flash-list', () => ({
  FlashList: require('react-native').FlatList,
}));

export const mockFromPath = jest.fn();

jest.mock('react-native-nobodywho', () => {
  return {
    Chat: { fromPath: (opts) => mockFromPath(opts) },
    Encoder: { fromPath: jest.fn() },
    CrossEncoder: { fromPath: jest.fn() },
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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: key => key,
    i18n: { changeLanguage: jest.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: jest.fn() },
}));

jest.mock('@op-engineering/op-sqlite', () => {
  const mockDb = {
    execute: jest.fn().mockResolvedValue({ rows: [] }),
    executeSync: jest.fn().mockReturnValue({ rows: [] }),
    executeBatch: jest.fn().mockResolvedValue({}),
    reactiveExecute: jest.fn().mockReturnValue(jest.fn()),
    flushPendingReactiveQueries: jest.fn().mockResolvedValue(undefined),
    transaction: jest.fn(async fn => fn({ execute: mockDb.execute })),
    close: jest.fn(),
  };
  return {
    open: jest.fn().mockReturnValue(mockDb),
    Storage: jest.fn().mockReturnValue({
      getItem: jest.fn().mockReturnValue(jest.fn()),
      setItem: jest.fn().mockReturnValue(jest.fn())
    }),
  };
});

jest.mock("@react-navigation/native", () => {
  return {
    useNavigation: () => ({ goBack: jest.fn() }),
    useRoute: () => jest.fn(),
    getFocusedRouteNameFromRoute: jest.fn(),
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

jest.mock("@react-navigation/drawer", () => {
  const mockReact = require('react');
  return {
    createDrawerNavigator: () => ({
      Navigator: ({ children }) =>
        mockReact.createElement(mockReact.Fragment, null, children),
      Screen: ({ options }) => {
        const resolved =
          typeof options === 'function'
            ? options({ route: { key: 'Chat', name: 'Chat' } })
            : options;
        return mockReact.createElement(
          mockReact.Fragment,
          null,
          resolved.headerTitle
            ? resolved.headerTitle({ children: resolved.title })
            : null,
          resolved.headerRight ? resolved.headerRight() : null,
        );
      },
    }),
  };
});

export const mockNavigate = jest.fn();
export const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  getFocusedRouteNameFromRoute: jest.fn(() => 'ChatScreen'),
  useRoute: () => ({}),
  SFSymbol: 'SFSymbol',
  MaterialSymbol: 'MaterialSymbol',
}));
