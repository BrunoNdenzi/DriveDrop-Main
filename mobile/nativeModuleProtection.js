console.log('[PROTECTION] Installing SAFE native module layer...');

(function() {
  'use strict';

  if (typeof global.FormData === 'undefined') {
    console.log('[PROTECTION] Adding SAFE FormData polyfill...');
    
    function FormDataPolyfill() {
      this._data = [];
    }
    
    FormDataPolyfill.prototype.append = function(name, value, filename) {
      this._data.push({ name: name, value: value, filename: filename });
    };
    
    FormDataPolyfill.prototype.delete = function(name) {
      this._data = this._data.filter(function(item) {
        return item.name !== name;
      });
    };
    
    FormDataPolyfill.prototype.get = function(name) {
      for (var i = 0; i < this._data.length; i++) {
        if (this._data[i].name === name) {
          return this._data[i].value;
        }
      }
      return null;
    };
    
    FormDataPolyfill.prototype.getAll = function(name) {
      var results = [];
      for (var i = 0; i < this._data.length; i++) {
        if (this._data[i].name === name) {
          results.push(this._data[i].value);
        }
      }
      return results;
    };
    
    FormDataPolyfill.prototype.has = function(name) {
      for (var i = 0; i < this._data.length; i++) {
        if (this._data[i].name === name) {
          return true;
        }
      }
      return false;
    };
    
    FormDataPolyfill.prototype.set = function(name, value, filename) {
      this.delete(name);
      this.append(name, value, filename);
    };
    
    FormDataPolyfill.prototype.forEach = function(callback) {
      for (var i = 0; i < this._data.length; i++) {
        callback(this._data[i].value, this._data[i].name, this);
      }
    };
    
    global.FormData = FormDataPolyfill;
    console.log('[PROTECTION] SAFE FormData polyfill installed');
  } else {
    console.log('[PROTECTION] FormData already exists, skipping polyfill');
  }
  
  console.log('[PROTECTION] SAFE protection installed successfully!');
  
})();