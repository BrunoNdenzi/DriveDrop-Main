const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Inject native module protection code at the very beginning of the bundle
config.serializer = {
  ...config.serializer,
  getModulesRunBeforeMainModule: () => [
    require.resolve('./nativeModuleProtection.js'),
  ],
};

module.exports = config;
