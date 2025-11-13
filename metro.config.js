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
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    // Reduce bundle size by excluding unnecessary files
    // But don't exclude .ts files from node_modules (needed for reanimated)
    blockList: [
      /.*\/__tests__\/.*/,
      /.*\/.*\.test\..*/,
      /.*\/.*\.spec\..*/,
      /.*\/.*\.stories\..*/,
      /.*\/.*\.example\..*/,
    ],
    // Ensure react-native-reanimated is properly resolved
    sourceExts: ['jsx', 'js', 'ts', 'tsx', 'json'],
  },
  watchFolders: [__dirname],
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
