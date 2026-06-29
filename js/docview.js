// Document lightbox: zoom/pan high-res scan, transcription/translation tabs, multi-page
// navigation, citation, and "appears on" backlinks.
import * as DATA from './data.js';
import { Vault } from './crypto.js';
import { t, getLang } from './i18n.js';
import { el, clear, $ } from './util.js';

let imgs = [];
let idx = 0;
let zoom = 1, tx = 0, ty = 0;
let imgEl = null;
let captionEl = null;

export function closeDoc() {
  $('#lightbox').classList.add('hidden');
  clear($('#lightbox'));
  captionEl = null;
  document.removeEventListener('keydown', onKey);   // detach immediately, not on next keypress
  Vault.releaseFull();                              // free decrypted full-res blobs
}

// Generic gallery lightbox for any [{src, caption}] list (place/voyage/person photos).
export function openGallery(images, title, start = 0) {
  const list = (images || []).filter((m) => m && m.src);
  if (!list.length) return;
  imgs = list; idx = Math.max(0, Math.min(start, list.length - 1));
  const lb = $('#lightbox');
  clear(lb);
  lb.classList.remove('hidden');
  const bar = el('div', { class: 'lb-bar' },
    el('div', {}, el('div', { class: 'lb-title', text: title || '' })),
    el('button', { class: 'lb-close', text: '✕', title: t('closeAria'), onclick: closeDoc }));
  const stage = el('div', { class: 'lb-stage' });
  imgEl = el('img', { alt: title || '', draggable: 'false' });
  stage.append(imgEl, zoomControls());
  attachPanZoom(stage);
  captionEl = el('div', { class: 'lb-gcaption' });
  lb.append(bar, el('div', { class: 'lb-body lb-gallery' }, stage), captionEl);
  if (imgs.length > 1) lb.append(pageNav());
  showImage();
  document.addEventListener('keydown', onKey);
}

export function openDoc(code, fromPersonId) {
  const s = DATA.model().sources[code];
  if (!s) return;
  imgs = s.assets.filter((a) => a.kind === 'image' || a.kind === 'crop');
  idx = 0; captionEl = null;
  const lb = $('#lightbox');
  clear(lb);
  lb.classList.remove('hidden');

  // bar
  const meta = [s.type, s.date, s.language].filter(Boolean).join(' · ');
  const bar = el('div', { class: 'lb-bar' },
    el('div', {}, el('div', { class: 'lb-title', text: s.title }), meta ? el('div', { class: 'lb-meta', text: meta }) : null),
    el('button', { class: 'lb-close', text: '✕', title: t('closeAria'), onclick: closeDoc }));

  // stage
  const stage = el('div', { class: 'lb-stage' });
  imgEl = el('img', { alt: s.title, draggable: 'false' });
  const pdf = s.assets.find((a) => a.kind === 'pdf');
  if (imgs.length) {
    stage.append(imgEl);
    stage.append(zoomControls());
    attachPanZoom(stage);
  } else if (pdf) {
    stage.append(el('div', { class: 'lb-loading' }, el('a', { href: '#', text: t('openOriginal'),
      onclick: async (e) => { e.preventDefault(); const w = window.open('about:blank', '_blank'); const u = await Vault.fileURL(pdf.src); if (w) w.location = u; else window.open(u, '_blank'); } })));
  }

  // side
  const side = el('div', { class: 'lb-side' });
  side.append(buildTabs(s));
  if (pdf) side.append(el('p', {}, el('a', { href: '#', text: t('openOriginal'),
    onclick: async (e) => { e.preventDefault(); const u = await Vault.fileURL(pdf.src); window.open(u, '_blank'); } })));
  if (s.people && s.people.length) {
    const ap = el('div', { class: 'lb-content' }, el('h3', { text: t('appearsOn') }));
    s.people.forEach((pid) => {
      const per = DATA.person(pid);
      if (per) ap.append(el('span', { class: 'chip ' + (per.sex === 'F' ? 'female' : 'male'),
        onclick: () => { closeDoc(); location.hash = '#/person/' + pid; }, text: per.name }));
    });
    side.append(ap);
  }

  // pages
  const body = el('div', { class: 'lb-body' }, stage, side);
  lb.append(bar, body);
  if (imgs.length > 1) lb.append(pageNav());
  showImage();

  document.addEventListener('keydown', onKey);
}

function onKey(e) {
  if ($('#lightbox').classList.contains('hidden')) { document.removeEventListener('keydown', onKey); return; }
  if (e.key === 'Escape') closeDoc();
  else if (e.key === 'ArrowRight') go(1);
  else if (e.key === 'ArrowLeft') go(-1);
}

function buildTabs(s) {
  const wrap = el('div');
  const tabs = el('div', { class: 'lb-tabs' });
  const content = el('div', { class: 'lb-content' });
  const panels = [];
  const addTab = (label, html) => {
    if (!html) return;
    const i = panels.length;
    panels.push(html);
    const b = el('button', { text: label, onclick: () => select(i) });
    tabs.append(b);
  };
  function select(i) {
    [...tabs.children].forEach((b, j) => b.classList.toggle('active', j === i));
    content.innerHTML = panels[i];
  }
  addTab(t('transcription'), s.transcriptionHtml);
  addTab(t('translation'), s.translationHtml);
  addTab(t('fullNote'), s.bodyHtml);
  if (s.citationHtml) wrap.append(el('div', { class: 'lb-content', html: '<h3>' + t('citation') + '</h3>' + s.citationHtml }));
  wrap.prepend(content);
  wrap.prepend(tabs);
  if (panels.length) select(0);
  return wrap;
}

function pageNav() {
  const counter = el('span', { id: 'lb-counter' });
  const prev = el('button', { text: '‹', onclick: () => go(-1) });
  const next = el('button', { text: '›', onclick: () => go(1) });
  const nav = el('div', { class: 'lb-pages' }, prev, counter, next);
  nav._update = () => { counter.textContent = `${t('page')} ${idx + 1} / ${imgs.length}`; prev.disabled = idx === 0; next.disabled = idx === imgs.length - 1; };
  nav._update();
  return nav;
}

function go(d) {
  const n = idx + d;
  if (n < 0 || n >= imgs.length) return;
  idx = n; resetZoom(); showImage();
  const nav = $('.lb-pages'); if (nav && nav._update) nav._update();
}

async function showImage() {
  if (!imgs.length || !imgEl) return;
  imgEl.style.opacity = '.4';
  try {
    const url = await Vault.imageURL(imgs[idx].src);
    imgEl.src = url;
    imgEl.style.opacity = '1';
    if (captionEl) captionEl.textContent = (getLang() === 'es' && imgs[idx].caption_es) ? imgs[idx].caption_es : (imgs[idx].caption || '');
  } catch (e) { imgEl.style.opacity = '1'; }
  applyTransform();
}

function zoomControls() {
  return el('div', { class: 'lb-zoom' },
    el('button', { text: '−', onclick: () => setZoom(zoom / 1.3) }),
    el('button', { text: '+', onclick: () => setZoom(zoom * 1.3) }),
    el('button', { text: '⟲', onclick: resetZoom }));
}
function applyTransform() { if (imgEl) imgEl.style.transform = `translate(${tx}px,${ty}px) scale(${zoom})`; }
function setZoom(z) { zoom = Math.min(8, Math.max(1, z)); if (zoom === 1) { tx = 0; ty = 0; } applyTransform(); }
function resetZoom() { zoom = 1; tx = 0; ty = 0; applyTransform(); }

function attachPanZoom(stage) {
  stage.addEventListener('wheel', (e) => { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.12 : 0.89)); }, { passive: false });
  let drag = null;
  stage.addEventListener('pointerdown', (e) => { if (zoom <= 1) return; drag = { x: e.clientX, y: e.clientY, tx, ty }; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', (e) => { if (!drag) return; tx = drag.tx + (e.clientX - drag.x); ty = drag.ty + (e.clientY - drag.y); applyTransform(); });
  stage.addEventListener('pointerup', () => { drag = null; });
  stage.addEventListener('dblclick', () => setZoom(zoom > 1 ? 1 : 2.4));
}
