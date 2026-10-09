const reactNativeConfig = require('@react-native/eslint-config/flat');

module.exports = [
  {
    ignores: [
      '**/node_modules/',
      'android/',
      'ios/',
      'vendor/',
      'coverage/',
      '.claude/',
      // Only TypeScript is linted (as with the former `--ext .ts,.tsx`); the
      // RN flat config's ft-flow rules also crash on plain JS under ESLint 9.
      '**/*.{js,cjs,mjs}',
    ],
  },
  ...reactNativeConfig,
];
