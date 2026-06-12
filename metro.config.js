const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { bundleModeMetroConfig } = require('react-native-worklets/bundleMode');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */

let config = getDefaultConfig(__dirname);

config.watchFolders = (config.watchFolders || []).concat(
  path.resolve(__dirname, 'node_modules/react-native-worklets/.worklets'),
);

const defaultResolver = config.resolver.resolveRequest;

config = mergeConfig(config, bundleModeMetroConfig);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('react-native-worklets/.worklets/')) {
    return bundleModeMetroConfig.resolver.resolveRequest(
      context,
      moduleName,
      platform,
    );
  }
  if (defaultResolver) {
    return defaultResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// react-native-svg-transformer: turn `.svg` imports into React components.
config.transformer.babelTransformerPath = require.resolve(
  'react-native-svg-transformer/react-native',
);
config.resolver.assetExts = config.resolver.assetExts.filter(
  ext => ext !== 'svg',
);
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

module.exports = config;
