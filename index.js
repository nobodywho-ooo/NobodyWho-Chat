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

// Reanimated 4.7 warns when a hook gets a dependency array (ignored on
// native). The offenders are react-native-drawer-layout and
// react-native-keyboard-controller, not our code, so drop that one message.
// Filtering console.warn (not just LogBox.ignoreLogs) hides it from the
// DevTools console too; every other warning goes through untouched.
if (__DEV__) {
  const warn = console.warn;
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Dependencies should only be used on the web')
    ) {
      return;
    }
    warn(...args);
  };
}

AppRegistry.registerComponent(appName, () => App);
