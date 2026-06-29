// The Vault: loads the data model and document images, transparently decrypting them
// with the family passphrase (WebCrypto) when the build is the encrypted public one.
//
//  - mode 'plain' : a plaintext data.json is present (local/dev build). No passphrase.
//  - mode 'enc'   : only data.json.enc + auth.json (public build). Needs the passphrase;
//                   data and images are AES-256-GCM, key = PBKDF2(passphrase, salt).

const ENC = new TextEncoder();
const DEC = new TextDecoder();

function b64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function mimeFor(path) {
  const e = path.toLowerCase().split('.').pop();
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    webp: 'image/webp', pdf: 'application/pdf' }[e] || 'application/octet-stream';
}

export const Vault = {
  mode: null,
  key: null,
  _auth: null,
  cache: new Map(),

  async detect() {
    try {
      const r = await fetch('data.json', { cache: 'no-store' });
      if (r.ok) { this._plain = await r.json(); this.mode = 'plain'; return 'plain'; }
    } catch (e) { /* fall through */ }
    this.mode = 'enc';
    this._auth = await (await fetch('auth.json', { cache: 'no-store' })).json();
    return 'enc';
  },

  async unlock(passphrase) {
    if (!self.crypto || !self.crypto.subtle) {
      const e = new Error('WebCrypto unavailable'); e.code = 'INSECURE'; throw e;   // http:// / file://
    }
    const a = this._auth;
    const km = await crypto.subtle.importKey('raw', ENC.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    this.key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: b64(a.salt), iterations: a.iterations, hash: a.hash || 'SHA-256' },
      km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    await this._decrypt(b64(a.verifier)); // throws on wrong passphrase
    return true;
  },

  async _decrypt(bytes) {
    const iv = bytes.slice(0, 12);
    const ct = bytes.slice(12);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, this.key, ct));
  },

  async loadModel() {
    if (this.mode === 'plain') return this._plain;
    const buf = await (await fetch('data.json.enc', { cache: 'no-store' })).arrayBuffer();
    const pt = await this._decrypt(new Uint8Array(buf));
    return JSON.parse(DEC.decode(pt));
  },

  // Returns an object URL for a document image (decrypting on demand when encrypted).
  async imageURL(relSrc, { thumb = false } = {}) {
    const cacheKey = (thumb ? 't:' : 'f:') + relSrc;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
    let url;
    if (this.mode === 'plain') {
      url = relSrc; // browser loads the plaintext file directly
    } else {
      let resp = await fetch(relSrc + (thumb ? '.thumb.enc' : '.enc'), { cache: 'force-cache' });
      if (!resp.ok && thumb) resp = await fetch(relSrc + '.enc', { cache: 'force-cache' });
      if (!resp.ok) throw new Error('asset missing: ' + relSrc);
      const pt = await this._decrypt(new Uint8Array(await resp.arrayBuffer()));
      const type = thumb ? 'image/jpeg' : mimeFor(relSrc);
      url = URL.createObjectURL(new Blob([pt], { type }));
    }
    this.cache.set(cacheKey, url);
    return url;
  },

  // For PDFs: a navigable URL to the original (object URL when encrypted).
  async fileURL(relSrc) {
    if (this.mode === 'plain') return relSrc;
    return this.imageURL(relSrc, { thumb: false });
  },

  // Free decrypted full-res blobs (the heavy ones) when the lightbox closes; keep thumbnails
  // cached for the grids. Prevents object-URL accumulation on long browsing sessions (iOS Safari).
  releaseFull() {
    for (const [k, url] of this.cache) {
      if (k.startsWith('f:') && typeof url === 'string' && url.startsWith('blob:')) {
        try { URL.revokeObjectURL(url); } catch (e) { /* */ }
        this.cache.delete(k);
      }
    }
  },
};
