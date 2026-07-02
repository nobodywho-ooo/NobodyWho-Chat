// @sentry/react-native ships ESM that the RN jest preset does not transform, so
// stub the bits the app uses (captureException, wrap, init, NavigationContainer...).
jest.mock('@sentry/react-native', () => {
  const mockReact = require('react');
  return {
    init: jest.fn(),
    wrap: component => component,
    captureException: jest.fn(),
    captureMessage: jest.fn(),
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

export const mockGetTotalMemory = jest.fn(() => Promise.resolve(8 * 1024 ** 3));

jest.mock('react-native-device-info', () => ({
  getVersion: jest.fn(() => '1.0.0'),
  getBuildNumber: jest.fn(() => '1'),
  getTotalMemory: () => mockGetTotalMemory(),
}));

// Legacy function API used by the file helpers (modelFiles, messageDocuments).
// documentDirectory is a file:// URI with a trailing slash, matching real expo.
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  deleteAsync: jest.fn(),
  copyAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  documentDirectory: 'file:///mock-documents/',
  cacheDirectory: 'file:///mock-cache/',
}));

// New class API used by the model download service (File/Directory/Paths).
jest.mock('expo-file-system', () => {
  // Join path segments with single slashes at the boundaries, preserving the
  // scheme's leading `file:///` (don't collapse it).
  const join = segs =>
    segs
      .map(s => (typeof s === 'string' ? s : s && s.uri ? s.uri : ''))
      .filter(Boolean)
      .reduce((acc, part) =>
        acc ? `${acc.replace(/\/+$/, '')}/${part.replace(/^\/+/, '')}` : part,
      );
  class File {
    constructor(...segs) {
      this.uri = join(segs);
    }
    // A constructed File for a model part is treated as present by default;
    // flip File.mockExists to false to exercise the missing-file path.
    get exists() {
      return File.mockExists;
    }
    delete() {}
    open() {
      return {
        readBytes: () => ({ length: 0 }),
        writeBytes: () => {},
        close: () => {},
      };
    }
  }
  File.mockExists = true;
  File.downloadFileAsync = jest.fn(
    async (_url, dest) => new File(dest && dest.uri ? dest.uri : ''),
  );
  class Directory {
    constructor(...segs) {
      this.uri = join(segs);
    }
    get exists() {
      return true;
    }
    create() {}
  }
  const Paths = {
    document: { uri: 'file:///mock-documents/' },
    cache: { uri: 'file:///mock-cache/' },
  };
  const FileMode = {
    ReadWrite: 'rw',
    ReadOnly: 'r',
    WriteOnly: 'w',
    Append: 'wa',
    Truncate: 'wt',
  };
  return { File, Directory, Paths, FileMode };
});

export const mockLaunchImageLibraryAsync = jest.fn();
export const mockGetDocumentAsync = jest.fn();
export const mockImageSaveAsync = jest.fn();

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: opts => mockLaunchImageLibraryAsync(opts),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: opts => mockGetDocumentAsync(opts),
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { PNG: 'png', JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => {
      const context = {
        resize: () => context,
        renderAsync: async () => ({
          saveAsync: opts => mockImageSaveAsync(opts),
        }),
      };
      return context;
    },
  },
}));

jest.mock('expo-blur', () => {
  const mockReact = require('react');
  return {
    BlurView: ({ children }) =>
      mockReact.createElement(mockReact.Fragment, null, children),
    BlurTargetView: ({ children }) =>
      mockReact.createElement(mockReact.Fragment, null, children),
  };
});

jest.mock('expo-camera', () => {
  const React = require('react');
  return {
    CameraView: React.forwardRef(() => null),
    useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
  };
});

// Stateful stand-in for expo-audio: useAudioPlayer holds a stable player whose
// play()/pause() flip a piece of React state, and useAudioPlayerStatus reflects
// it. Both hooks run in the same component, so toggling drives a real re-render
// and tests can assert on the play/pause button flipping.
jest.mock('expo-audio', () => {
  const mockReact = require('react');
  return {
    useAudioPlayer: () => {
      const [playing, setPlaying] = mockReact.useState(false);
      const ref = mockReact.useRef(null);
      if (!ref.current) {
        ref.current = {
          play: () => setPlaying(true),
          pause: () => setPlaying(false),
          seekTo: jest.fn(),
        };
      }
      ref.current.playing = playing;
      return ref.current;
    },
    useAudioPlayerStatus: player => ({
      playing: player.playing,
      didJustFinish: false,
    }),
  };
});

// react-native-gesture-handler's native module isn't available under Jest, and
// the real entrypoint calls TurboModuleRegistry.getEnforcing on import. Stub the
// pieces FullScreenImageModal uses: a chainable Gesture.Pan builder and
// pass-through GestureDetector / GestureHandlerRootView wrappers.
jest.mock('react-native-gesture-handler', () => {
  const mockReact = require('react');
  const chainableGesture = () => {
    const gesture = {
      onUpdate: () => gesture,
      onEnd: () => gesture,
      onStart: () => gesture,
      onBegin: () => gesture,
    };
    return gesture;
  };
  return {
    Gesture: { Pan: chainableGesture, Tap: chainableGesture },
    GestureDetector: ({ children }) =>
      mockReact.createElement(mockReact.Fragment, null, children),
    GestureHandlerRootView: ({ children }) =>
      mockReact.createElement(mockReact.Fragment, null, children),
  };
});

// react-native-reanimated needs its worklet runtime, which isn't present under
// Jest. Map Animated.View/Image to plain RN components (so accessibility props
// pass through) and stub the hooks/helpers FullScreenImageModal calls.
jest.mock('react-native-reanimated', () => {
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: {
      View: ReactNative.View,
      Image: ReactNative.Image,
    },
    useSharedValue: initial => ({ value: initial }),
    useAnimatedStyle: () => ({}),
    withTiming: value => value,
    interpolate: value => value,
    runOnJS: fn => fn,
  };
});

// react-native-worklets ships ESM that Jest can't load, and its native worklet
// runtime is absent. FullScreenImageModal only uses scheduleOnRN to hop a
// gesture callback back to JS, so stub it as a synchronous pass-through.
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn, ...args) => fn(...args),
}));

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
export const mockDownloadModel = jest.fn(() => Promise.resolve('file://downloaded.gguf'));

jest.mock('react-native-nobodywho', () => {
  // Lightweight stand-in for the multimodal Prompt: records its parts so tests
  // can assert what was sent without the native FFI.
  class Prompt {
    constructor(parts) {
      this.parts = parts;
    }
    static Text(content) {
      return { kind: 'text', content };
    }
    static Image(path) {
      return { kind: 'image', path };
    }
    static Audio(path) {
      return { kind: 'audio', path };
    }
  }
  // Records its options so a test can assert how a tool was defined, without
  // the native polling loop the real Tool starts in its constructor.
  class Tool {
    constructor(opts) {
      this.opts = opts;
    }
  }
  return {
    Chat: { fromPath: (opts) => mockFromPath(opts) },
    Encoder: { fromPath: jest.fn() },
    CrossEncoder: { fromPath: jest.fn() },
    SamplerPresets: {
      default: jest.fn(() => ({ preset: 'default' })),
      temperature: jest.fn(temperature => ({ preset: 'temperature', temperature })),
    },
    Prompt,
    Tool,
    downloadModel: (opts) => mockDownloadModel(opts),
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
export const mockSetOptions = jest.fn();
export const mockUseRoute = jest.fn(() => ({}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    setOptions: mockSetOptions,
  }),
  getFocusedRouteNameFromRoute: jest.fn(() => 'ChatScreen'),
  useRoute: () => mockUseRoute(),
  SFSymbol: 'SFSymbol',
  MaterialSymbol: 'MaterialSymbol',
}));
