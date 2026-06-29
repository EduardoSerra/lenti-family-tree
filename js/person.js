// Person presentation: a slim quick-look panel (#/person/ID) and a full editorial
// profile page (#/profile/ID). Both consume the researcher-authored epithet / summary /
// story / portrait when present, and degrade cleanly to name + dates + family otherwise.
import * as DATA from './data.js';
import { Vault } from './crypto.js';
import { t, getLang } from './i18n.js';
import { el, clear, initials, tintFor, $, copyLinkButton } from './util.js';
import { openDoc } from './docview.js';
import { createTraceMap } from './flatmap.js';
import { clearHighlight } from './fulltree.js';

// Pick the current language's variant; if it's missing, fall back to the other language so a
// profile that only has Spanish content still shows it to an English viewer (and vice-versa).
const L = (en, es) => (getLang() === 'es' ? (es || en) : (en || es)) || '';

const EVENT_KEY = { birth: 'born', baptism: 'baptized', christening: 'baptized',
  immigration: 'immigrated', residence: 'lived', death: 'died', burial: 'buried' };

export function closePerson() {
  $('#person-panel').classList.add('hidden');
  $('#panel-scrim').classList.add('hidden');
  clearHighlight();
}

// ---------- shared building blocks ----------
// Always a monogram — by design the archive carries no personal portraits (many ancestors
// predate photography and none is available).
function avatar(p, size) {
  const node = el('div', { class: 'p-mono', text: initials(p.name), style: `background:${tintFor(p.name)}` });
  if (size) { node.style.width = size + 'px'; node.style.height = size + 'px'; }
  return node;
}

function chip(id, route = '#/person/') {
  const p = DATA.person(id);
  if (!p) return el('span', { class: 'chip', text: '(unknown)' });
  const cls = 'chip ' + (p.sex === 'F' ? 'female' : 'male');
  return el('span', { class: cls, role: 'link', tabindex: '0',
    onclick: () => { location.hash = route + id; },
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); location.hash = route + id; } } },
    p.name, p.lifeLine ? el('small', { text: ' · ' + p.lifeLine }) : null);
}

function section(title, contentNode, withHead = true) {
  const s = el('div', { class: 'p-sec' });
  if (withHead) s.append(el('h3', { text: title }));
  s.append(contentNode);
  return s;
}

function factsList(p) {
  const dl = el('dl', { class: 'pp-facts' });
  const row = (k, v) => dl.append(el('dt', { text: k }), el('dd', { text: v }));
  if (p.occupation) row(t('occupation'), p.occupation);
  for (const ev of p.events || []) {
    const v = [ev.dateText, ev.placeName || ev.place].filter(Boolean).join(' · ');
    if (v) row(t(EVENT_KEY[ev.type] || ev.type) || ev.label, v);
  }
  return dl.children.length ? dl : null;
}

function heroChips(p) {
  const wrap = el('div', { class: 'p-badges' });
  (p.placeNames || []).slice(0, 3).forEach((pl) => wrap.append(el('span', { class: 'badge', text: pl })));
  if (p.lifeStatus === 'living') wrap.append(el('span', { class: 'badge living', text: t('living') }));
  wrap.append(el('span', { class: 'badge gen', text: t('generation') + ' ' + ((p.generation ?? 0) + 1) }));
  return wrap;
}

function relationshipsSection(p, route = '#/person/') {
  const box = el('div');
  const parents = DATA.parentsOf(p.id);
  const sibs = DATA.siblingsOf(p.id);
  const unions = DATA.unionsOf(p.id);
  if (!parents.length && !sibs.length && !unions.length) return null;   // no empty "Family" heading
  if (parents.length) box.append(relGroup(t('parents'), parents, route));
  if (sibs.length) box.append(relGroup(t('siblings'), sibs, route));
  for (const u of unions) {
    const head = el('div', { class: 'rel-head' });
    if (u.partnerId) head.append(chip(u.partnerId, route));
    let tag = t('partners');
    if (u.divorced) tag = t('divorced');
    else if (u.type === 'marriage') tag = u.marriage && u.marriage.dateText ? t('married') + ' · ' + u.marriage.dateText : t('married');
    else if (u.type === 'out_of_marriage' || u.type === 'single_parent') tag = t('outOfMarriage');
    head.append(el('span', { class: 'tag', text: tag }));
    const grp = el('div', { class: 'rel-group' }, head);
    if (u.children.length) {
      const kids = el('div');
      u.children.forEach((c) => kids.append(chip(c, route)));
      grp.append(kids);
    }
    box.append(grp);
  }
  return section(t('relationships'), box);
}
function relGroup(label, ids, route) {
  const chips = el('div');
  ids.forEach((id) => chips.append(chip(id, route)));
  return el('div', { class: 'rel-group' }, el('div', { class: 'rel-head', text: label }), chips);
}

function documentsSection(p) {
  const M = DATA.model();
  const grid = el('div', { class: 'doc-grid' });
  for (const code of p.sourceIds || []) {
    const s = M.sources[code];
    if (!s || !s.assets.length) continue;
    const firstImg = s.assets.find((a) => a.kind === 'image' || a.kind === 'crop');
    const isPdf = !firstImg && s.assets.some((a) => a.kind === 'pdf');
    // square thumbnail tile with a title overlay (the .doc-thumb design); image-less sources
    // (PDF / transcription-only) get a labelled placeholder tile instead of an empty gap.
    const card = el('div', { class: 'doc-card doc-thumb', title: s.title, role: 'button', tabindex: '0',
      onclick: () => openDoc(code, p.id),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDoc(code, p.id); } } });
    if (firstImg) {
      const img = el('img', { alt: s.title, loading: 'lazy' });
      Vault.imageURL(firstImg.src, { thumb: true }).then((u) => { img.src = u; }).catch(() => {});
      card.append(img);
    } else {
      card.append(el('div', { class: 'doc-noimg', text: isPdf ? '📄' : '🗎' }));
    }
    if (isPdf) card.append(el('span', { class: 'doc-pdf', text: 'PDF' }));
    card.append(el('div', { class: 'doc-label', text: s.title }));
    grid.append(card);
  }
  return section(t('documents'), grid);
}

// the person's distinct event places, in order, for a small "life on the map" trace
function lifeStops(p) {
  const M = DATA.model();
  const stops = [];
  for (const ev of p.events || []) {
    const c = ev.placeName && M.places[ev.placeName];
    if (!c || typeof c.lat !== 'number' || typeof c.lng !== 'number') continue;
    const label = (t(EVENT_KEY[ev.type] || ev.type) || ev.label) + (ev.dateText ? ' · ' + ev.dateText : '');
    const last = stops[stops.length - 1];
    if (last && last.name === ev.placeName) { last.label += ' · ' + label; continue; }
    stops.push({ name: ev.placeName, lat: c.lat, lng: c.lng, label });
  }
  return stops;
}

function lifeMapSection(p) {
  const stops = lifeStops(p);
  if (stops.length < 2) return null;
  const host = el('div', { class: 'pp-tracemap' });
  setTimeout(() => { if (host.isConnected) createTraceMap(host, stops); }, 0);
  return section(t('lifeMap'), host);
}

function researchNotes(p) {
  const disc = L(p.discrepanciesHtml, p.discrepanciesHtmlEs);
  if (!disc && !(p.notes && p.notes.length)) return null;
  const box = el('div', { class: 'pp-research' });
  if (disc) {
    box.append(el('details', {}, el('summary', { text: t('discrepancies') }),
      el('div', { class: 'discrep note', html: disc })));
  }
  if (p.notes && p.notes.length) {
    const d = el('details', {}, el('summary', { text: t('archiveNotes') }));
    p.notes.forEach((n) => d.append(el('div', { class: 'note', text: n })));
    box.append(d);
  }
  return section(t('researchNotes'), box);
}

// ---------- quick-look panel (#/person/ID) ----------
export function openPerson(id) {
  const p = DATA.person(id);
  if (!p) return;
  const panel = $('#person-panel');
  const scrim = $('#panel-scrim');
  clear(panel);

  const wrap = el('div');
  wrap.append(el('button', { class: 'p-close', text: '✕', title: t('closeAria'), onclick: closePerson }));
  const hero = el('div', { class: 'p-hero' }, avatar(p), el('div', { class: 'p-name', text: p.name }));
  if (L(p.epithet, p.epithetEs)) hero.append(el('div', { class: 'p-epithet', text: L(p.epithet, p.epithetEs) }));
  if (p.lifeLine) hero.append(el('div', { class: 'p-life', text: p.lifeLine }));
  if (p.nameNotes && p.nameNotes.length) hero.append(el('div', { class: 'p-altnames', text: p.nameNotes.join(' · ') }));
  hero.append(heroChips(p));
  wrap.append(hero);

  const body = el('div', { class: 'p-body' });
  if (p.lifeStatus === 'living') {
    body.append(el('div', { class: 'p-living', text: t('livingFriendly') }));
    { const rel = relationshipsSection(p); if (rel) body.append(rel); }
  } else {
    const facts = factsList(p);
    if (facts) body.append(section('', facts, false));
    { const rel = relationshipsSection(p); if (rel) body.append(rel); }
    body.append(el('a', { class: 'p-cta', href: '#/profile/' + id, text: t('readProfile') + ' →' }));
  }
  wrap.append(body);
  panel.append(wrap);
  panel.classList.remove('hidden');
  scrim.classList.remove('hidden');
  scrim.onclick = closePerson;
  panel.scrollTop = 0;
}

// ---------- full editorial profile page (#/profile/ID) ----------
export function renderProfile(view, id) {
  const p = DATA.person(id);
  clear(view);
  if (!p) { view.append(el('div', { class: 'page' }, el('p', { text: '(unknown)' }))); return; }
  closePerson();

  const page = el('div', { class: 'page' });
  page.append(el('div', { class: 'pp-top' },
    el('a', { class: 'pp-back', href: '#/', text: '← ' + t('backToTree') }),
    el('div', { class: 'pp-top-actions' },
      copyLinkButton(t('copyLink'), t('linkCopied')),
      el('button', { class: 'copy-link', type: 'button', text: t('printSheet'), onclick: () => window.print() }))));

  const hero = el('div', { class: 'p-hero pp-hero' }, avatar(p, 132), el('h1', { class: 'p-name', text: p.name }));
  if (L(p.epithet, p.epithetEs)) hero.append(el('p', { class: 'p-epithet', text: L(p.epithet, p.epithetEs) }));
  if (p.lifeLine) hero.append(el('p', { class: 'p-life', text: p.lifeLine }));
  if (p.nameNotes && p.nameNotes.length) hero.append(el('p', { class: 'p-altnames', text: p.nameNotes.join(' · ') }));
  hero.append(heroChips(p));
  page.append(hero);

  const body = el('div', { class: 'pp-body' });
  if (p.lifeStatus === 'living') {
    body.append(el('div', { class: 'p-living', text: t('livingFriendly') }));
    { const rel = relationshipsSection(p, '#/profile/'); if (rel) body.append(rel); }
  } else {
    if (L(p.summaryHtml, p.summaryHtmlEs)) body.append(el('div', { class: 'pp-prose lead', html: L(p.summaryHtml, p.summaryHtmlEs) }));
    const facts = factsList(p);
    if (facts) body.append(section(t('life'), facts));
    if (L(p.storyHtml, p.storyHtmlEs)) body.append(section(t('story'), el('div', { class: 'pp-prose story', html: L(p.storyHtml, p.storyHtmlEs) })));
    { const rel = relationshipsSection(p, '#/profile/'); if (rel) body.append(rel); }
    const lifeMap = lifeMapSection(p);
    if (lifeMap) body.append(lifeMap);
    if (p.sourceIds && p.sourceIds.length) body.append(documentsSection(p));
    const rn = researchNotes(p);
    if (rn) body.append(rn);
  }
  page.append(body);
  view.append(page);
  view.scrollTop = 0;
}
