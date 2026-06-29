// Small DOM + formatting helpers.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);

export function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else n.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    n.append(c.nodeType ? c : document.createTextNode(c));
  }
  return n;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

// A "copy link" button that copies the current deep-link URL (hash only — privacy-safe; the
// recipient still needs the family password). Falls back to the native share sheet on mobile.
export function copyLinkButton(label, copiedLabel) {
  const btn = el('button', { class: 'copy-link', type: 'button', text: label, title: label });
  btn.addEventListener('click', async () => {
    const url = location.href;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else if (navigator.share) { await navigator.share({ url }); return; }
      const prev = btn.textContent; btn.textContent = copiedLabel;
      setTimeout(() => { btn.textContent = prev; }, 1400);
    } catch (e) { /* */ }
  });
  return btn;
}

export function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

// deterministic warm color from a string (for monogram avatars)
export function tintFor(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  const hue = (h % 60) + (str && str.charCodeAt(0) % 2 ? 18 : 200); // browns/golds or slate/greens
  return `hsl(${hue} 32% 46%)`;
}

export function debounce(fn, ms = 160) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// strip diacritics + lowercase (mirrors the Python build's norm())
export function norm(s) {
  return (s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Lazy-load a heavy vendor script/style once (globe.gl, vis-timeline are big — load on demand).
const _loaded = new Set();
export function loadScript(src) {
  if (_loaded.has(src)) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => { _loaded.add(src); res(); };
    s.onerror = () => rej(new Error('failed to load ' + src));
    document.head.append(s);
  });
}
export function loadCSS(href) {
  if (_loaded.has(href)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = href;
  document.head.append(l);
  _loaded.add(href);
}
