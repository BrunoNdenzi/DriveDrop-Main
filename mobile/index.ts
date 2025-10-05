// CRITICAL: Intercept and protect NativeModules access BEFORE any imports
// This prevents "Cannot read property 'getConstants' of null" crashes
(function() {
  console.log('[Pre-Init] Starting emergency native module protection...');
  
  // Get reference to NativeModules before any imports
  const ReactNative = require('react-native');
  const NativeModules = ReactNative.NativeModules;
  
  // Create a Proxy to intercept ALL access to NativeModules
  const handler = {
    get: function(target: any, prop: string) {
      const module = target[prop];
      
      // If module is null/undefined, return a safe stub
      if (!module) {
        console.warn(`[Pre-Init] Module "${prop}" is null, returning safe stub`);
        return {
          getConstants: () => {
            console.warn(`[Pre-Init] getConstants called on null module: ${prop}`);
            return {};
          }
        };
      }
      
      // If module exists but is not an object, wrap it
      if (typeof module !== 'object') {
        return module;
      }
      
      // Wrap the module to protect getConstants calls
      return new Proxy(module, {
        get: function(moduleTarget: any, moduleProp: string) {
          const value = moduleTarget[moduleProp];
          
          // Specifically protect getConstants
          if (moduleProp === 'getConstants') {
            if (typeof value === 'function') {
              return function(...args: any[]) {
                try {
                  return value.apply(moduleTarget, args);
                } catch (error) {
                  console.error(`[Pre-Init] getConstants failed for ${prop}:`, error);
                  return {};
                }
              };
            } else {
              // If getConstants doesn't exist, provide a stub
              return () => {
                console.warn(`[Pre-Init] getConstants not found on ${prop}, returning empty object`);
                return {};
              };
            }
          }
          
          return value;
        }
      });
    }
  };
  
  // Replace NativeModules with our protected proxy
  const protectedModules = new Proxy(NativeModules, handler);
  Object.defineProperty(ReactNative, 'NativeModules', {
    get: function() { return protectedModules; },
    configurable: false,
    enumerable: true
  });
  
  console.log('[Pre-Init] Native module protection installed successfully');
})();

import { registerRootComponent } from 'expo';
import { initializeNativeModulePolyfills } from './src/utils/nativeModulePolyfill';

// Additional defensive patching after imports
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
