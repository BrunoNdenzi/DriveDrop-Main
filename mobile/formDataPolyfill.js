/**
 * FormData Polyfill for React Native
 * This must be the FIRST file imported
 */

// Polyfill FormData immediately
if (typeof global !== 'undefined') {
  if (!global.FormData) {
    console.log('[Polyfill] Creating FormData...');
    
    function FormDataPolyfill() {
      this._data = [];
    }
    
    FormDataPolyfill.prototype.append = function(name, value, filename) {
      this._data.push({ name: name, value: value, filename: filename });
    };
    
    FormDataPolyfill.prototype.delete = function(name) {
      var self = this;
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
    
    global.FormData = FormDataPolyfill;
    console.log('[Polyfill] ✅ FormData created');
  } else {
    console.log('[Polyfill] FormData already exists');
  }
}

module.exports = {};
