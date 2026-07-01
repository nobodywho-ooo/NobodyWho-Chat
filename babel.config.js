// This bare-RN app uses @react-native/babel-preset, not babel-preset-expo, so
// nothing inlines `process.env.EXPO_OS` — which expo-modules-core warns about in
// dev and uses for Platform.select. Replicate babel-preset-expo's behaviour by
// replacing `process.env.EXPO_OS` with the per-platform string from the caller.
const inlineExpoOs = platform => ({ types: t }) => ({
  name: 'inline-expo-os',
  visitor: {
    MemberExpression(path) {
      if (path.matchesPattern('process.env.EXPO_OS')) {
        path.replaceWith(t.stringLiteral(platform));
      }
    },
  },
});

module.exports = api => {
  // The worklets plugin's bundleMode emits ESM (import/export) that Jest's
  // CommonJS transform can't parse. Disable it under test — gestures/animations
  // are mocked there, so bundleMode buys nothing.
  const isTest = api.env('test');

  // Metro transforms each file per-platform and exposes the target platform on
  // the caller; it's undefined under Jest/other callers, in which case we skip.
  const platform = api.caller(caller => caller && caller.platform);

  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
    ...(platform ? [inlineExpoOs(platform)] : []),
    [
      'module-resolver',
      {
        root: ['.'],
        extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
        alias: {
          jest: './jest',
          components: './app/components',
          navigation: './app/navigation',
          style: './app/style',
          utils: './app/utils',
          types: './app/types',
          hooks: './app/hooks',
          context: './app/context',
          services: './app/services',
          repositories: './app/repositories',
          screens: './app/screens',
          helpers: './app/helpers',
          i18n: './app/i18n',
          database: './app/database',
          svg: './svg'
        },
      },
    ],
    [
      'react-native-worklets/plugin',
      {
        bundleMode: !isTest,
        workletizableModules: ['remend'],
      },
    ],
    ],
  };
};
