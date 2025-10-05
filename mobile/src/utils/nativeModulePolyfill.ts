/**
 * Native Module Polyfill
 * Provides defensive checks for native modules to prevent crashes on Samsung devices
 * where modules might not initialize properly
 */

import { NativeModules, Platform } from 'react-native';

/**
 * Patch native modules to prevent null reference errors
 * This is especially important for Samsung devices where module initialization
 * can be delayed or fail silently
 */
export function initializeNativeModulePolyfills() {
  console.log('[Native Module Polyfill] Starting initialization...');
  
  // Get all native module names
  const moduleNames = Object.keys(NativeModules);
  
  console.log(`[Native Module Polyfill] Checking ${moduleNames.length} native modules`);
  
  let patchedCount = 0;
  let nullModules: string[] = [];
  
  moduleNames.forEach((moduleName) => {
    try {
      const module = NativeModules[moduleName];
      
      // If module is null or undefined, create a stub
      if (!module) {
        console.warn(`[Native Module Polyfill] Module ${moduleName} is null/undefined, creating safe stub`);
        nullModules.push(moduleName);
        NativeModules[moduleName] = {
          getConstants: () => {
            console.warn(`[Native Module Polyfill] getConstants called on stub module: ${moduleName}`);
            return {};
          }
        };
        patchedCount++;
        return;
      }
      
      // Check if module exists but getConstants might fail
      if (typeof module === 'object') {
        // Wrap getConstants with error handling if it exists
        const originalGetConstants = module.getConstants;
        
        if (typeof originalGetConstants === 'function') {
          module.getConstants = function(...args: any[]) {
            try {
              const result = originalGetConstants.apply(this, args);
              return result || {};
            } catch (error) {
              console.warn(`[Native Module Polyfill] getConstants failed for ${moduleName}:`, error);
              return {}; // Return empty constants instead of crashing
            }
          };
          patchedCount++;
        } else if (!originalGetConstants) {
          // Add getConstants if module exists but doesn't have it
          module.getConstants = function() {
            return {};
          };
          patchedCount++;
        }
      }
    } catch (error) {
      console.error(`[Native Module Polyfill] Error patching ${moduleName}:`, error);
    }
  });
  
  console.log(`[Native Module Polyfill] Patched ${patchedCount} modules with defensive getConstants`);
  
  if (nullModules.length > 0) {
    console.warn(`[Native Module Polyfill] Found ${nullModules.length} null modules: ${nullModules.join(', ')}`);
  }
  
  // Add device-specific logging
  if (Platform.OS === 'android') {
    try {
      console.log('[Native Module Polyfill] Android device detected');
      console.log('[Native Module Polyfill] Manufacturer:', Platform.constants?.Manufacturer || 'unknown');
      console.log('[Native Module Polyfill] Model:', Platform.constants?.Model || 'unknown');
      console.log('[Native Module Polyfill] OS Version:', Platform.Version);
    } catch (error) {
      console.warn('[Native Module Polyfill] Could not get device info:', error);
    }
  }
}

/**
 * Check if a specific native module is available and properly initialized
 */
export function isNativeModuleAvailable(moduleName: string): boolean {
  try {
    const module = NativeModules[moduleName];
    if (!module) {
      console.warn(`[Native Module Check] ${moduleName} is not available`);
      return false;
    }
    
    // Try to call getConstants safely
    if (typeof module.getConstants === 'function') {
      try {
        module.getConstants();
      } catch (error) {
        console.warn(`[Native Module Check] ${moduleName}.getConstants() failed:`, error);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error(`[Native Module Check] Error checking ${moduleName}:`, error);
    return false;
  }
}

/**
 * Wait for native modules to be ready
 * Useful for Samsung devices where initialization might be delayed
 */
export async function waitForNativeModules(
  requiredModules: string[] = [],
  maxWaitTime: number = 3000,
  checkInterval: number = 100
): Promise<boolean> {
  const startTime = Date.now();
  
  console.log(`[Native Module Wait] Waiting for modules: ${requiredModules.join(', ')}`);
  
  // First check - see what's available now
  const initialAvailable = requiredModules.filter(moduleName => isNativeModuleAvailable(moduleName));
  console.log(`[Native Module Wait] Initially available: ${initialAvailable.length}/${requiredModules.length}`);
  
  while (Date.now() - startTime < maxWaitTime) {
    const allAvailable = requiredModules.every(moduleName => isNativeModuleAvailable(moduleName));
    
    if (allAvailable) {
      const elapsed = Date.now() - startTime;
      console.log(`[Native Module Wait] All modules ready after ${elapsed}ms`);
      return true;
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  // Check what's still missing
  const stillMissing = requiredModules.filter(moduleName => !isNativeModuleAvailable(moduleName));
  console.warn(
    `[Native Module Wait] Timeout after ${maxWaitTime}ms. ` +
    `Missing modules: ${stillMissing.join(', ')}`
  );
  
  return false;
}
