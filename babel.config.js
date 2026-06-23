module.exports = api => {
  // The worklets plugin's bundleMode emits ESM (import/export) that Jest's
  // CommonJS transform can't parse. Disable it under test — gestures/animations
  // are mocked there, so bundleMode buys nothing.
  const isTest = api.env('test');

  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
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
