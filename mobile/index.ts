import { registerRootComponent } from 'expo';
import { initializeNativeModulePolyfills } from './src/utils/nativeModulePolyfill';

// Initialize native module polyfills as early as possible
// This prevents "Cannot read property 'getConstants' of null" errors on Samsung devices
try {
  initializeNativeModulePolyfills();
  console.log('[Index] Native module polyfills initialized');
} catch (error) {
  console.error('[Index] Failed to initialize native module polyfills:', error);
}

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
