module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-async-storage|react-native-linear-gradient|react-native-safe-area-context|react-native-screens|react-native-svg|lucide-react-native|react-native-image-viewing)/)',
  ],
  watchman: false,
};
