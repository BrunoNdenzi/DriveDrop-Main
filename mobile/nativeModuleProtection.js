/**
 * Native Module Protection - Pure JavaScript
 * This MUST run before any other module loads
 * CRITICAL: No TypeScript, no imports, pure JS only
 */

;(function() {
  'use strict';
  
  console.log('[PROTECTION] Installing native module safety layer...');
  
  try {
    // Polyfill FormData FIRST (before any modules load)
    if (typeof global !== 'undefined' && !global.FormData) {
      console.log('[PROTECTION] Creating FormData polyfill...');
      
      // Create a basic FormData implementation
      var FormDataPolyfill = function() {
        this._data = [];
      };
      
      FormDataPolyfill.prototype.append = function(name, value, filename) {
        this._data.push({ name: name, value: value, filename: filename });
      };
      
      FormDataPolyfill.prototype.delete = function(name) {
        this._data = this._data.filter(function(item) {
          return item.name !== name;
        });
      };
      
      FormDataPolyfill.prototype.get = function(name) {
        var item = this._data.find(function(item) {
          return item.name === name;
        });
        return item ? item.value : null;
      };
      
      FormDataPolyfill.prototype.getAll = function(name) {
        return this._data
          .filter(function(item) { return item.name === name; })
          .map(function(item) { return item.value; });
      };
      
      FormDataPolyfill.prototype.has = function(name) {
        return this._data.some(function(item) {
          return item.name === name;
        });
      };
      
      FormDataPolyfill.prototype.set = function(name, value, filename) {
        this.delete(name);
        this.append(name, value, filename);
      };
      
      global.FormData = FormDataPolyfill;
      console.log('[PROTECTION] ✅ FormData polyfill created');
    }
    
    // Get NativeModules reference
    var ReactNative = require('react-native');
    var NativeModules = ReactNative.NativeModules;
    
    if (!NativeModules) {
      console.error('[PROTECTION] NativeModules is undefined!');
      return;
    }
    
    // Get all module names
    var moduleNames = Object.keys(NativeModules);
    console.log('[PROTECTION] Found ' + moduleNames.length + ' native modules');
    
    // Patch each module
    var patchedCount = 0;
    var nullCount = 0;
    
    for (var i = 0; i < moduleNames.length; i++) {
      var moduleName = moduleNames[i];
      var module = NativeModules[moduleName];
      
      // If module is null/undefined, create safe stub
      if (!module) {
        console.warn('[PROTECTION] Module "' + moduleName + '" is NULL - creating stub');
        NativeModules[moduleName] = {
          getConstants: function() {
            return {};
          }
        };
        nullCount++;
        patchedCount++;
        continue;
      }
      
      // If module exists, wrap getConstants
      if (typeof module === 'object') {
        var originalGetConstants = module.getConstants;
        
        if (typeof originalGetConstants === 'function') {
          // Wrap existing getConstants
          (function(mod, name, original) {
            mod.getConstants = function() {
              try {
                var result = original.apply(this, arguments);
                return result || {};
              } catch (error) {
                console.error('[PROTECTION] getConstants failed for ' + name + ':', error.message);
                return {};
              }
            };
          })(module, moduleName, originalGetConstants);
          patchedCount++;
        } else {
          // Add getConstants if missing
          module.getConstants = function() {
            return {};
          };
          patchedCount++;
        }
      }
    }
    
    console.log('[PROTECTION] ✅ Patched ' + patchedCount + ' modules (' + nullCount + ' were null)');
    console.log('[PROTECTION] Native module protection installed successfully!');
    
  } catch (error) {
    console.error('[PROTECTION] ❌ Failed to install protection:', error.message);
    console.error('[PROTECTION] Stack:', error.stack);
  }
})();
