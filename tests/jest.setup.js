// Polyfill for undici's File requirement in Jest VM environment
// undici expects global File class which isn't available in Jest's experimental VM
if (typeof global.File === 'undefined') {
  // Minimal File polyfill - just enough for undici to not crash
  global.File = class File {
    constructor(bits, name, options) {
      this.bits = bits;
      this.name = name;
      this.options = options || {};
      this.type = this.options.type || '';
      this.lastModified = this.options.lastModified || Date.now();
    }
    
    get size() {
      return this.bits.reduce((acc, bit) => acc + (bit.length || bit.byteLength || 0), 0);
    }
    
    async text() {
      return this.bits.join('');
    }
    
    async arrayBuffer() {
      throw new Error('File.arrayBuffer() not implemented in test polyfill');
    }
    
    slice() {
      throw new Error('File.slice() not implemented in test polyfill');
    }
    
    stream() {
      throw new Error('File.stream() not implemented in test polyfill');
    }
  };
}
