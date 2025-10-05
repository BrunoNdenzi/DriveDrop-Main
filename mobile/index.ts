// CRITICAL: Patch NativeModules IMMEDIATELY before ANY other imports
// This must be the FIRST code that runs to prevent Samsung device crashes
import { NativeModules } from 'react-native';

const originalModules = { ...NativeModules };
Object.keys(originalModules).forEach((name) => {
  const mod = originalModules[name];
  if (!mod) {
    NativeModules[name] = { getConstants: () => ({}) };
  } else if (typeof mod === 'object') {
    const orig = mod.getConstants;
    mod.getConstants = orig && typeof orig === 'function' 
      ? function(...args: any[]) { try { return orig.apply(this, args); } catch { return {}; } }
      : () => ({});
  }
});

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
