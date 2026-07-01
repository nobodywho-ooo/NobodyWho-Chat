/**
 * @format
 */

// MUST be first: expo-file-system's `Paths.join` relies on a spec-compliant
// global `URL` (specifically its `pathname` setter). React Native's built-in
// `URL` is a regex stub with no setter, which makes `Paths.join` silently drop
// every appended segment — so `new File(modelsDir, name)` collapses to the bare
// `Documents` directory and writes fail. This polyfill installs a real WHATWG
// `URL` before any module touches expo-file-system.
import 'react-native-url-polyfill/auto';

import { AppRegistry } from 'react-native';
import { getCachedModels } from 'react-native-nobodywho';
import App from './App';
import { name as appName } from './app.json';

// Force the nobodywho native crate to install at startup. Its Rust FFI
// (globalThis.NativeNobodywho) is set only as a side effect of evaluating the
// library's index.tsx, reached solely via `./index` re-exports like
// getCachedModels. Model/Chat/Tool come from generated/ts/nobodywho.ts and
// never touch it, so under Metro inlineRequires (on in release) the crate is
// never installed and constructing a Tool throws
// "Cannot read property 'ubrn_…' of undefined". A bare import is lazy — the
// module only evaluates when the binding is actually used, so we must CALL it.
try {
  getCachedModels();
} catch {}

AppRegistry.registerComponent(appName, () => App);
