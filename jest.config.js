module.exports = {
  preset: '@react-native/jest-preset',
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  setupFiles: [
      "<rootDir>/jest/setup.js"
  ],
  moduleNameMapper: {
    '\\.svg$': '<rootDir>/jest/mock/svg.mock.js',
    '^react-native-svg$':
      '<rootDir>/jest/mock/node-modules/react-native-svg.mock.js',
  },
};
