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
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
