// Jest setup to polyfill minimal browser globals required by some dependencies
// (e.g., undici/web/webidl expecting File/Blob constructors).
class TestFile extends Uint8Array {
    constructor(bits = [], name = 'file', options = {}) {
        // Allow content as string or ArrayBuffer-ish
        let buf;
        if (typeof bits === 'string') buf = Buffer.from(bits);
        else if (Array.isArray(bits)) buf = Buffer.from(bits);
        else buf = Buffer.from(bits || []);
        super(buf);
        this.name = name;
        this.lastModified = options.lastModified || Date.now();
        this.size = buf.length;
        this.type = options.type || '';
    }
}

global.File = global.File || TestFile;
global.Blob = global.Blob || class BlobClass {
    constructor(parts = [], options = {}) {
        const buf = Buffer.concat(parts.map(p => (typeof p === 'string' ? Buffer.from(p) : Buffer.from(p || []))));
        this.size = buf.length;
        this.type = options.type || '';
        this._buffer = buf;
    }
    text() { return Promise.resolve(this._buffer.toString()); }
    arrayBuffer() { return Promise.resolve(this._buffer.buffer.slice(this._buffer.byteOffset, this._buffer.byteOffset + this._buffer.byteLength)); }
};
