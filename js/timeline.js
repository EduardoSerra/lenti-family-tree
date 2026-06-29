// The Family Saga — an illustrated, scroll-driven chronicle. Consumes data.chronicle[]:
// chronological beats (birth/death/immigration/marriage = compact entries; place/voyage =
// big illustrated cards) grouped by decade, with scroll-reveal. All info is inline (never
// hover); click a person → their profile. Images lazy-decrypt via the Vault.
import * as DATA from './data.js';
import { Vault } from './crypto.js';
import { t, getLang } from './i18n.js';
import { el, clear } from './util.js';
import { openGallery } from './docview.js';

// pick the caption / html in the current language, falling back to the base (English)
const capOf = (m) => (m && getLang() === 'es' && m.caption_es) ? m.caption_es : ((m && m.caption) || '');
const htmlOf = (b) => (getLang() === 'es' && b.htmlEs) ? b.htmlEs : b.html;

const BRANCH_TINT = { lenti: '#b1542f', serra: '#5b7c99', blasini: '#6f8a6a', hofstadter: '#9a7bb0',
  bravo: '#b08a3b', 'serra-lenti': '#5b7c99', other: '#8c877f' };
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Build branch filters from the (encrypted) chronicle so no surnames are hardcoded in this file.
const titleCase = (s) => s.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
function buildFilters(ch) {
  const seen = [];
  for (const b of ch) if (b.branch && b.branch !== 'other' && !seen.includes(b.branch)) seen.push(b.branch);
  return [{ id: 'all', label: t('filterAll') },
    ...seen.map((b) => ({ id: b, label: titleCase(b) })),
    { id: 'voyage', label: t('voyageFilter') }];
}

export function renderTimeline(view, targetLeg) {
  clear(view);
  const M = DATA.model();
  const ch = M.chronicle || [];
  const wrap = el('div', { class: 'saga' });
  wrap.append(el('div', { class: 'saga-head' },
    el('h1', { text: t('timelineTitle') }), el('p', { class: 'lead', text: t('timelineLead') })));

  // branch filter
  let active = 'all';
  const filter = el('div', { class: 'toggle-group' });
  const stream = el('div', { class: 'saga-stream' });
  buildFilters(ch).forEach((f) => filter.append(el('button', {
    'aria-pressed': f.id === 'all' ? 'true' : 'false', text: f.label,
    onclick: (e) => {
      active = f.id;
      [...filter.children].forEach((b) => b.setAttribute('aria-pressed', b === e.target ? 'true' : 'false'));
      applyFilter(stream, active);
    },
  })));
  wrap.append(el('div', { class: 'saga-filter' }, filter));

  let lastEra = null;
  for (const b of ch) {
    const era = eraOf(b.year);
    if (era !== lastEra) { stream.append(el('div', { class: 'saga-era', text: era })); lastEra = era; }
    stream.append(beatNode(b));
  }
  wrap.append(stream);
  view.append(wrap);
  reveal(stream);

  if (targetLeg) {                       // arrived from the map: focus the matching voyage beat
    const focusBeat = () => {
      const node = stream.querySelector(`.saga-beat[data-leg="${targetLeg}"]`);
      if (node) { node.classList.add('in', 'flash'); node.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    };
    requestAnimationFrame(focusBeat);
    setTimeout(focusBeat, 150);          // fallback (rAF can be throttled when off-screen)
  }
}

function eraOf(y) {
  if (!y) return '';
  return 'The ' + (Math.floor(y / 10) * 10) + 's';
}

function matchesFilter(b, f) {
  if (f === 'all') return true;
  if (f === 'voyage') return b.kind === 'voyage';
  return b.branch === f;
}
function applyFilter(stream, f) {
  [...stream.querySelectorAll('.saga-beat')].forEach((n) => {
    n.classList.toggle('hide', !matchesFilter({ kind: n.dataset.kind, branch: n.dataset.branch }, f));
  });
}

function personLink(b) {
  const id = b.personIds && b.personIds[0];
  const node = el('span', { class: 'saga-title', text: b.title });
  if (id) {
    node.setAttribute('role', 'link'); node.setAttribute('tabindex', '0');
    const go = () => { location.hash = '#/profile/' + id; };
    node.addEventListener('click', go);
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  }
  return node;
}

function lazyImg(node, src, thumb) {
  Vault.imageURL(src, { thumb }).then((u) => { node.src = u; }).catch(() => {});
}

function beatNode(b) {
  const tint = BRANCH_TINT[b.branch] || BRANCH_TINT.other;
  const base = { class: 'saga-beat ' + (reduce() ? '' : 'reveal'),
    dataset: { kind: b.kind, branch: b.branch || 'other', leg: b.legId || '' }, style: `--branch:${tint}` };

  if (b.kind === 'place' || b.kind === 'voyage') {
    const card = el('div', Object.assign({}, base, { class: base.class + ' saga-card' + (b.media.length ? '' : ' no-img') }));
    // name/header first — easier to read than after the picture
    const head = el('div', { class: 'saga-card-head' },
      el('div', { class: 'saga-kicker', text: (b.kind === 'voyage' ? '✦ ' : '') + (b.year || '') }),
      el('h3', { class: 'saga-card-title' }, personLink(b)));
    if (b.subtitle) head.append(el('div', { class: 'saga-card-sub', text: b.subtitle }));
    card.append(head);
    if (b.media.length) {
      let cur = 0;
      const hero = el('img', { class: 'saga-img', alt: capOf(b.media[0]) || b.title, loading: 'lazy',
        onclick: () => openGallery(b.media, b.title, cur) });
      lazyImg(hero, b.media[0].src, false);
      card.append(hero);
      const cap = el('div', { class: 'saga-cap', text: capOf(b.media[0]) });
      if (capOf(b.media[0]) || b.media.length > 1) card.append(cap);
      if (b.media.length > 1) {
        // click a thumbnail to preview it inline; click the hero to open the full lightbox
        const strip = el('div', { class: 'saga-gallery' });
        b.media.forEach((m, i) => {
          const th = el('img', { class: 'saga-gthumb' + (i === 0 ? ' on' : ''),
            alt: capOf(m), title: capOf(m), loading: 'lazy' });
          lazyImg(th, m.src, true);
          th.addEventListener('click', () => {
            cur = i; lazyImg(hero, m.src, false);
            hero.alt = capOf(m) || b.title;
            cap.textContent = capOf(m);
            [...strip.children].forEach((c) => c.classList.toggle('on', c === th));
          });
          strip.append(th);
        });
        card.append(strip);
      }
    }
    const body = el('div', { class: 'saga-card-body' });
    const html = htmlOf(b);
    if (html) body.append(el('div', { class: 'pp-prose', html: html }));
    const mapHref = (b.kind === 'voyage' && b.legId) ? ('#/journey/' + (b.chapter || '') + '/' + b.legId) : '#/journey';
    body.append(el('a', { class: 'saga-xlink', href: mapHref, text: t('viewOnMap') + ' →' }));
    card.append(body);
    return card;
  }

  // compact event / marriage
  const beat = el('div', Object.assign({}, base, { class: base.class + ' saga-event' }));
  beat.append(el('div', { class: 'saga-dot' }));
  beat.append(el('div', { class: 'saga-when', text: b.year || '' }));
  if (b.media.length) {
    const img = el('img', { class: 'saga-thumb', alt: b.title, loading: 'lazy' });
    lazyImg(img, b.media[0].src, true);
    beat.append(img);
  }
  const sub = [b.subtitle, b.dateText && b.dateText !== String(b.year) ? b.dateText : null].filter(Boolean).join(' · ');
  beat.append(el('div', {}, personLink(b), el('div', { class: 'saga-sub', text: sub })));
  return beat;
}

function reveal(stream) {
  let pending = [...stream.querySelectorAll('.reveal')];
  if (reduce()) { pending.forEach((n) => n.classList.add('in')); return; }
  const check = () => {
    pending = pending.filter((n) => {
      if (n.getBoundingClientRect().top < innerHeight * 0.92) { n.classList.add('in'); return false; }
      return true;
    });
    if (!pending.length) window.removeEventListener('scroll', check);
  };
  window.addEventListener('scroll', check, { passive: true });
  requestAnimationFrame(check);   // reveal above-the-fold once laid out
  setTimeout(check, 200);
}
