/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { getCachedModels } from 'react-native-nobodywho';
import App from './App';
import { name as appName } from './app.json';

// TODO: delete try catch once downloadModel from react-native-nobodywho is fixed

// Force react-native-nobodywho to install its native Rust crate at startup.
// The install runs as a side effect of evaluating the package's init module
// (src/index.tsx → installRustCrate). In release builds Metro's inlineRequires
// defers that module until one of its `./index` re-exports is touched, and
// downloadModel / Model.load don't touch it — so globalThis.NativeNobodywho is
// never set and every call throws "Cannot read property 'ubrn_…' of undefined".
// Touching getCachedModels here forces that module to evaluate (and install).
try {
  getCachedModels();
} catch {
  // Only the module-evaluation (install) side effect matters here.
}

AppRegistry.registerComponent(appName, () => App);
