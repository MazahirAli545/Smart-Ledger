const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  transformer: {
    minifierConfig: {
      keep_fnames: true,
      mangle: {
        keep_fnames: true,
      },
    },
  },
  resolver: {
    // Reduce bundle size by excluding unnecessary files
    blacklistRE:
      /(.*\/__tests__\/.*|.*\/.*\.test\..*|.*\/.*\.spec\..*|.*\/.*\.stories\..*|.*\/.*\.example\..*|.*\/.*\.d\.ts)$/,
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
