// Full family tree: a descendant forest that shows EVERYONE — all founding couples and
// their descendants — with dashed cross-links where two lines join by marriage (so a branch
// that marries into another line stays fully visible). Custom SVG
// layout (d3.tree per forest) with pan/zoom; family-chart can't show in-law ancestry.
import * as DATA from './data.js';
import { t } from './i18n.js';
import { el, $$, initials, loadScript } from './util.js';

const CARD_W = 178, CARD_H = 80, DX = 99, SLOT = 190, ROW = 214, GAP = 30;

let svg = null, gz = null, zoom = null, onSelect = null;
let nodeById = {};   // person id -> {x, y} of their rendered card (for focus)
let famPos = {};     // family id -> {x, y} centre of the couple

// ---------- focus-vs-expand-all state ----------
// 'focus' = hourglass around one person (ancestors up + descendants down), re-centres on click;
// 'full'  = the whole forest. Toggle persists. extra* hold branches grown via the ＋ badge.
let currentView = null;
let mode = 'focus';
try { const sm = localStorage.getItem('treeMode'); if (sm === 'full' || sm === 'focus') mode = sm; } catch (e) { /* */ }
let focusId = null;
const extraFams = new Set();
const extraPeople = new Set();
let curVisP = null, curVisF = null;   // the visible sets backing the current draw (null in full mode)
const ANCESTORS = 2, DESCENDANTS = 2;

// ---------- build the family forest ----------
// visFams/visPeople (Sets) restrict the forest to a neighbourhood (focus mode); pass null for all.
function buildForest(visFams, visPeople) {
  const M = DATA.model();
  const fams = M.families, people = M.people;
  const inFam = (fid) => !visFams || visFams.has(fid);
  const inPer = (pid) => !visPeople || visPeople.has(pid);

  const anchorParent = {};   // fid -> person id through whom the family hangs in the tree
  const anchorFamily = {};   // fid -> parent family id (or null = founding family / root)
  for (const fid in fams) {
    const f = fams[fid];
    const hpf = f.husband && people[f.husband] ? people[f.husband].parentFamily : null;
    const wpf = f.wife && people[f.wife] ? people[f.wife].parentFamily : null;
    if (hpf && fams[hpf]) { anchorParent[fid] = f.husband; anchorFamily[fid] = hpf; }
    else if (wpf && fams[wpf]) { anchorParent[fid] = f.wife; anchorFamily[fid] = wpf; }
    else { anchorParent[fid] = f.husband || f.wife; anchorFamily[fid] = null; }
  }

  const familiesAnchoredVia = {};  // person id -> [fid] they anchor
  const marriedInOf = {};          // person id -> [fid] where they married in (non-anchor parent)
  for (const fid in fams) {
    const ap = anchorParent[fid];
    (familiesAnchoredVia[ap] = familiesAnchoredVia[ap] || []).push(fid);
    const f = fams[fid];
    for (const p of [f.husband, f.wife]) {
      if (p && p !== ap) (marriedInOf[p] = marriedInOf[p] || []).push(fid);
    }
  }

  const seen = new Set();
  function node(fid) {
    seen.add(fid);
    const f = fams[fid];
    const kids = [];
    for (const cid of f.children) {
      const anchored = (familiesAnchoredVia[cid] || []).filter(inFam);
      if (anchored.length) {
        anchored.forEach((cf) => kids.push(node(cf)));
      } else if (marriedInOf[cid] && marriedInOf[cid].some(inFam)) {
        // rendered in their own (visible) family; connected here by a cross-link (no card here)
      } else if (inPer(cid)) {
        kids.push({ type: 'person', pid: cid });
      }
    }
    return { type: 'family', fid, husb: f.husband, wife: f.wife,
      anchor: anchorParent[fid], children: kids };
  }

  // roots = founding families, or (in focus mode) the topmost visible families whose parent
  // family is itself out of view — so the ancestor chain ends cleanly at the top of the hourglass.
  const roots = Object.keys(fams)
    .filter((fid) => inFam(fid) && (anchorFamily[fid] === null || !inFam(anchorFamily[fid])))
    .map(node);

  // cross-links: every married-in parent -> their own parent family (if both are shown)
  const crossLinks = [];
  for (const fid in fams) {
    if (!inFam(fid)) continue;
    const f = fams[fid];
    for (const p of [f.husband, f.wife]) {
      const pf = people[p] && people[p].parentFamily;
      if (p && p !== anchorParent[fid] && pf && fams[pf] && inFam(pf)) {
        crossLinks.push({ person: p, fromFam: fid, toFam: pf });
      }
    }
  }
  return { roots, crossLinks };
}

// The hourglass neighbourhood around a person: ancestors up, descendants down, all spouses.
function neighborhood(rootId, upGen, downGen) {
  const M = DATA.model();
  const fams = M.families, people = M.people;
  const visP = new Set(), visF = new Set();
  if (!people[rootId]) return { visP, visF };
  visP.add(rootId);

  // ancestors (and each ancestor couple)
  let frontier = [rootId];
  for (let g = 0; g < upGen && frontier.length; g++) {
    const next = [];
    for (const id of frontier) {
      const pf = people[id] && people[id].parentFamily;
      if (pf && fams[pf]) {
        visF.add(pf);
        for (const par of [fams[pf].husband, fams[pf].wife]) if (par) { visP.add(par); next.push(par); }
      }
    }
    frontier = next;
  }

  // descendants (with their spouses); the last generation lands as leaves (own families hidden)
  frontier = [rootId];
  for (let g = 0; g < downGen && frontier.length; g++) {
    const next = [];
    for (const id of frontier) {
      for (const sf of (people[id] && people[id].spouseFamilies) || []) {
        if (!fams[sf]) continue;
        visF.add(sf);
        for (const sp of [fams[sf].husband, fams[sf].wife]) if (sp) visP.add(sp);
        for (const c of fams[sf].children) { visP.add(c); next.push(c); }
      }
    }
    frontier = next;
  }

  // the focus person's own siblings, as leaves on the parent family
  const pf0 = people[rootId].parentFamily;
  if (pf0 && fams[pf0]) { visF.add(pf0); fams[pf0].children.forEach((c) => visP.add(c)); }
  return { visP, visF };
}

function visibleSets() {
  if (mode === 'full') return { visFams: null, visPeople: null };
  const { visP, visF } = neighborhood(focusId, ANCESTORS, DESCENDANTS);
  extraFams.forEach((f) => visF.add(f));
  extraPeople.forEach((p) => visP.add(p));
  // make sure both members of every visible family are visible people (so spouse cards render)
  const M = DATA.model();
  visF.forEach((fid) => { const f = M.families[fid]; if (f) { if (f.husband) visP.add(f.husband); if (f.wife) visP.add(f.wife); } });
  return { visFams: visF, visPeople: visP };
}

// ---------- render ----------
export async function renderFullTree(view, selectCb) {
  onSelect = selectCb;
  currentView = view;
  if (mode === 'focus' && !focusId) focusId = DATA.defaultMainId();
  // d3 is lazy-loaded here so non-tree pages don't pay for ~280 KB; after the first load it is a
  // global and this is synchronous (no race).
  if (typeof d3 === 'undefined') await loadScript('vendor/d3.v7.min.js');
  draw('initial');
}

// (re)build the SVG. focusAfter: 'initial' | 'fit' | a person id to re-centre on; keepTf preserves zoom.
function draw(focusAfter, keepTf) {
  const view = currentView;
  view.innerHTML = '';
  view.append(treeControls(), treeLegend(), el('div', { class: 'tree-hint', text: t('treeHint') }));
  nodeById = {}; famPos = {};

  const { visFams, visPeople } = visibleSets();
  curVisP = visPeople; curVisF = visFams;
  const { roots, crossLinks } = buildForest(visFams, visPeople);
  const hierarchy = d3.hierarchy({ type: 'virtual', children: roots });
  // width-aware separation so wide couple-cards never overlap their neighbours
  const halfW = (n) => (n.data && n.data.type === 'family' && n.data.husb && n.data.wife ? DX + CARD_W / 2 : CARD_W / 2);
  d3.tree().nodeSize([SLOT, ROW])
    .separation((a, b) => ((halfW(a) + halfW(b) + GAP) / SLOT) * (a.parent === b.parent ? 1 : 1.2))(hierarchy);

  const NS = 'http://www.w3.org/2000/svg';
  svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('id', 'ftsvg');
  gz = document.createElementNS(NS, 'g');
  svg.append(gz);
  view.append(svg);

  const gLinks = document.createElementNS(NS, 'g');
  const gCross = document.createElementNS(NS, 'g');
  const gCards = document.createElementNS(NS, 'g');
  gz.append(gLinks, gCross, gCards);

  const Y = (d) => (d.depth - 1) * ROW;
  const nodes = hierarchy.descendants().filter((d) => d.data.type !== 'virtual');

  // ----- record positions; each anchor person is rendered only ONCE across their unions -----
  const renderedAnchor = {};  // anchor id -> {x, y}
  const famRender = {};       // fid -> { anchorId, spouseId, anchorX, spouseX, y, renderAnchor }
  for (const d of nodes) {
    if (d.data.type !== 'family') { nodeById[d.data.pid] = { x: d.x, y: Y(d) }; continue; }
    const fid = d.data.fid, anchorId = d.data.anchor, yd = Y(d);
    const both = d.data.husb && d.data.wife;
    const anchorLeft = anchorId === d.data.husb;
    const ax = both ? (anchorLeft ? d.x - DX : d.x + DX) : d.x;
    const sx = both ? (anchorLeft ? d.x + DX : d.x - DX) : d.x;
    const spouseId = anchorId === d.data.husb ? d.data.wife : d.data.husb;
    let renderAnchor = false, anchorX;
    if (!(anchorId in renderedAnchor)) {
      renderedAnchor[anchorId] = { x: ax, y: yd };
      nodeById[anchorId] = { x: ax, y: yd };
      renderAnchor = true; anchorX = ax;
    } else { anchorX = renderedAnchor[anchorId].x; }
    if (spouseId) nodeById[spouseId] = { x: sx, y: yd };
    famPos[fid] = { x: d.x, y: yd };
    famRender[fid] = { anchorId, spouseId, anchorX, spouseX: spouseId ? sx : null, y: yd, renderAnchor };
  }

  // ----- parent -> child links (one per child anchor; skip an anchor's sibling unions) -----
  for (const d of nodes) {
    if (d.data.type !== 'family' || !d.children) continue;
    const fr = famRender[d.data.fid];
    const midX = fr.spouseX != null ? (fr.anchorX + fr.spouseX) / 2 : fr.anchorX;
    const py = fr.y + CARD_H / 2;
    for (const c of d.children) {
      if (c.data.type === 'family') {
        const cfr = famRender[c.data.fid];
        if (!cfr.renderAnchor) continue;
        gLinks.append(linkPath(midX, py, cfr.anchorX, cfr.y - CARD_H / 2, 'ft-link'));
      } else {
        gLinks.append(linkPath(midX, py, c.x, Y(c) - CARD_H / 2, 'ft-link'));
      }
    }
  }

  // ----- marriage connectors (shared anchor card -> each spouse) + date/place label -----
  for (const fid in famRender) {
    const fr = famRender[fid];
    if (!fr.spouseId) continue;
    const a = renderedAnchor[fr.anchorId];
    const x1 = Math.min(a.x, fr.spouseX) + CARD_W / 2 - 6;
    const x2 = Math.max(a.x, fr.spouseX) - CARD_W / 2 + 6;
    gLinks.append(seg(x1, fr.y, x2, fr.y, 'ft-marr'));
    const m = DATA.family(fid) && DATA.family(fid).marriage;
    if (m && (m.dateText || m.place)) {
      const lbl = '⚭ ' + [m.dateText, (m.place || '').split(',')[0].trim()].filter(Boolean).join(' · ');
      const tx = elem('text', { class: 'ft-marr-label', x: (a.x + fr.spouseX) / 2, y: fr.y + CARD_H / 2 + 15 });
      tx.textContent = lbl;
      gLinks.append(tx);
    }
  }

  // ----- cross-links (married-in spouse -> their origin family) -----
  for (const cl of crossLinks) {
    const from = nodeById[cl.person], to = famPos[cl.toFam];
    if (from && to) gCross.append(linkPath(from.x, from.y, to.x, to.y + CARD_H / 2, 'ft-cross'));
  }

  // ----- cards (anchor once, every spouse, every leaf child) -----
  for (const fid in famRender) {
    const fr = famRender[fid];
    if (fr.renderAnchor) gCards.append(card(fr.anchorId, fr.anchorX, fr.y));
    if (fr.spouseId) gCards.append(card(fr.spouseId, fr.spouseX, fr.y));
  }
  for (const d of nodes) if (d.data.type === 'person') gCards.append(card(d.data.pid, d.x, Y(d)));

  setupZoom(view);
  if (keepTf) { d3.select(svg).call(zoom.transform, keepTf); updateLod(keepTf.k); }
  else if (focusAfter === 'initial') { if (mode === 'focus') { fitAll(); highlight(focusId); } else focusInitial(); }
  else if (focusAfter === 'fit') fitAll();
  else if (focusAfter && nodeById[focusAfter]) { fitAll(); highlight(focusAfter); }
  else focusInitial();
}

// ---------- focus / expand-all actions ----------
function toggleMode() {
  mode = mode === 'focus' ? 'full' : 'focus';
  try { localStorage.setItem('treeMode', mode); } catch (e) { /* */ }
  if (mode === 'focus' && !focusId) focusId = DATA.defaultMainId();
  draw(mode === 'focus' ? 'initial' : 'fit');
}

// Re-root the hourglass on a person (focus mode), or just pan to them (full mode).
export function focusPerson(id) {
  if (!DATA.person(id)) return;
  if (mode === 'focus') {
    focusId = id;
    extraFams.clear(); extraPeople.clear();
    draw(id);
  } else {
    panTo(id);
  }
}

// Grow one extra ring of relatives (parents + spouses + children) around a card, keeping the view.
function expandAround(id) {
  const M = DATA.model();
  const people = M.people, fams = M.families;
  const p = people[id];
  if (!p) return;
  const addFam = (fid) => {
    const f = fams[fid]; if (!f) return;
    extraFams.add(fid);
    if (f.husband) extraPeople.add(f.husband);
    if (f.wife) extraPeople.add(f.wife);
    f.children.forEach((c) => extraPeople.add(c));
  };
  if (p.parentFamily) addFam(p.parentFamily);
  (p.spouseFamilies || []).forEach(addFam);
  const tf = svg ? d3.zoomTransform(svg) : null;
  draw(null, tf);
}

// how many of a card's immediate relatives are currently hidden (drives the ＋ badge)
function hiddenCount(id) {
  if (!curVisF) return 0;
  const M = DATA.model();
  const people = M.people, fams = M.families;
  const p = people[id];
  if (!p) return 0;
  let n = 0;
  const pf = p.parentFamily;
  if (pf && fams[pf] && !curVisF.has(pf)) {
    for (const x of [fams[pf].husband, fams[pf].wife]) if (x && x !== id && !curVisP.has(x)) n++;
  }
  for (const sf of p.spouseFamilies || []) {
    const f = fams[sf]; if (!f) continue;
    if (!curVisF.has(sf)) { for (const x of [f.husband, f.wife]) if (x && x !== id && !curVisP.has(x)) n++; }
    f.children.forEach((c) => { if (!curVisP.has(c)) n++; });
  }
  return n;
}

// Open focused on the default person at a readable zoom (edges spill); ⊡ shows everyone.
function focusInitial() {
  const id = DATA.defaultMainId();
  const n = nodeById[id];
  if (!n || !svg) { fitAll(); return; }
  const w = svg.clientWidth || 1000, h = svg.clientHeight || 700, k = 0.82;
  d3.select(svg).call(zoom.transform, d3.zoomIdentity.translate(w / 2 - k * n.x, h / 2 - k * n.y).scale(k));
  updateLod(k);
}

function updateLod(k) { if (svg) svg.classList.toggle('lod-low', k < 0.42); }

function setupZoom(view) {
  zoom = d3.zoom().scaleExtent([0.06, 2.5])
    .on('zoom', (e) => { gz.setAttribute('transform', e.transform); updateLod(e.transform.k); });
  d3.select(svg).call(zoom).on('dblclick.zoom', null);
  const ro = new ResizeObserver(() => { svg.setAttribute('width', view.clientWidth); svg.setAttribute('height', view.clientHeight); });
  ro.observe(view);
  svg.setAttribute('width', view.clientWidth);
  svg.setAttribute('height', view.clientHeight);
}

function fitAll() {
  const all = Object.values(nodeById);
  if (!all.length) return;
  const xs = all.map((n) => n.x), ys = all.map((n) => n.y);
  const minX = Math.min(...xs) - CARD_W, maxX = Math.max(...xs) + CARD_W;
  const minY = Math.min(...ys) - CARD_H, maxY = Math.max(...ys) + CARD_H;
  const w = svg.clientWidth || 1000, h = svg.clientHeight || 700;
  const k = Math.min(w / (maxX - minX), h / (maxY - minY), 1.1) * 0.92;
  const tx = w / 2 - k * (minX + maxX) / 2, ty = h / 2 - k * (minY + maxY) / 2;
  d3.select(svg).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
}

function panTo(id) {
  const n = nodeById[id];
  if (!n || !svg) return;
  const w = svg.clientWidth, h = svg.clientHeight, k = 0.85;
  d3.select(svg).transition().duration(600).call(
    zoom.transform, d3.zoomIdentity.translate(w / 2 - k * n.x, h / 2 - k * n.y).scale(k));
  highlight(id);
}

function highlight(id) {
  $$('#ftsvg .ftcard').forEach((c) => {
    const main = c.getAttribute('data-id') === id;
    c.classList.toggle('is-main', main);
    c.classList.toggle('dim', !!id && !main);
  });
}

export function clearHighlight() {
  $$('#ftsvg .ftcard').forEach((c) => c.classList.remove('is-main', 'dim'));
}

// ---------- svg helpers ----------
const NS = 'http://www.w3.org/2000/svg';
function elem(name, attrs) {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}
function seg(x1, y1, x2, y2, cls) { return elem('line', { x1, y1, x2, y2, class: cls }); }
function linkPath(x1, y1, x2, y2, cls) {
  const my = (y1 + y2) / 2;
  return elem('path', { class: cls, d: `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}` });
}

function evLine(p, type) {
  const ev = (p.events || []).find((e) => e.type === type);
  if (!ev) return '';
  const place = ev.placeName || (ev.place || '').split(',')[0].trim();
  return [ev.dateText, place].filter(Boolean).join(' · ');
}

function card(pid, x, y) {
  const p = DATA.person(pid);
  const g = elem('g', { class: 'ftcard', 'data-id': pid, tabindex: '0', role: 'button',
    'aria-label': p.name, transform: `translate(${x - CARD_W / 2},${y - CARD_H / 2})` });
  if (p.lifeStatus === 'living') g.classList.add('living');
  const rect = elem('rect', { class: 'ftcard-bg', width: CARD_W, height: CARD_H, rx: 9 });
  const tint = DATA.surnameTint(p.surname) || (p.sex === 'F' ? 'var(--rose)' : 'var(--blue)');
  const strip = elem('rect', { class: 'ftcard-strip', x: 9, width: CARD_W - 18, height: 4, rx: 2, fill: tint });
  g.append(rect, strip);
  const nameLines = wrapName(p.name, 24);
  const two = nameLines.length > 1;
  if (two) {
    g.append(textEl('ftcard-name', 18, nameLines[0]), textEl('ftcard-name', 33, nameLines[1]));
  } else {
    g.append(textEl('ftcard-name', p.lifeStatus === 'living' ? 28 : 25, nameLines[0]));
  }
  if (p.lifeStatus === 'living') {
    g.append(textEl('ftcard-sub', two ? 53 : 50, t('living')));
  } else {
    const b = evLine(p, 'birth'), d = evLine(p, 'death');
    const by = two ? 52 : 48, dy = two ? 68 : 65;
    if (b) g.append(textEl('ftcard-line', by, '✶ ' + fit(b, 27)));
    if (d) g.append(textEl('ftcard-line', dy, '✝ ' + fit(d, 27)));
    if (!b && !d && p.lifeLine) g.append(textEl('ftcard-sub', two ? 53 : 50, p.lifeLine));
  }
  const sel = () => { if (onSelect) onSelect(pid); highlight(pid); };
  g.addEventListener('click', (e) => { e.stopPropagation(); sel(); });
  g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sel(); } });

  // focus mode: a ＋ badge on cards whose parents/spouses/children are still hidden
  if (mode === 'focus' && curVisF) {
    const hc = hiddenCount(pid);
    if (hc > 0) {
      const badge = elem('g', { class: 'ft-expand', transform: `translate(${CARD_W - 13},13)`,
        role: 'button', tabindex: '0', 'aria-label': t('expandBranch') });
      badge.append(elem('circle', { class: 'ft-expand-bg', r: 11 }));
      const plus = elem('text', { class: 'ft-expand-tx', x: 0, y: 1 }); plus.textContent = '+';
      const ttl = elem('title', {}); ttl.textContent = t('expandBranch') + ' (' + hc + ')';
      badge.append(plus, ttl);
      const exp = (e) => { e.stopPropagation(); expandAround(pid); };
      badge.addEventListener('click', exp);
      badge.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); exp(e); } });
      g.append(badge);
    }
  }
  return g;
}
function fit(s, n) { return s && s.length > n ? s.slice(0, n - 1) + '…' : s; }
function textEl(cls, y, txt) { const t = elem('text', { class: cls, x: CARD_W / 2, y }); t.textContent = txt; return t; }
// wrap a name into at most two lines (break on words; ellipsize the 2nd line if still too long)
function wrapName(name, max) {
  if (!name || name.length <= max) return [name || ''];
  const words = name.split(' ');
  let l1 = '', l2 = '';
  for (const w of words) {
    if (!l2 && (l1 ? l1 + ' ' + w : w).length <= max) l1 = l1 ? l1 + ' ' + w : w;
    else l2 = l2 ? l2 + ' ' + w : w;
  }
  if (!l1) { l1 = name.slice(0, max); l2 = name.slice(max); }
  return l2 ? [l1, fit(l2, max)] : [l1];
}

// ---------- chrome ----------
function treeControls() {
  const modeBtn = el('button', { class: 'tc-mode',
    'aria-pressed': mode === 'full' ? 'true' : 'false',
    text: mode === 'focus' ? '⤢  ' + t('expandAll') : '◎  ' + t('focusView'),
    title: mode === 'focus' ? t('expandAllHint') : t('focusViewHint'),
    onclick: toggleMode });
  return el('div', { class: 'tree-controls' },
    modeBtn,
    el('button', { text: '⊡', title: t('fit'), onclick: fitAll }));
}
function treeLegend() {
  return el('div', { class: 'tree-legend' },
    el('h4', { text: t('relationships') }),
    legendRow('marr', t('married')),
    legendRow('cross', t('partners')));
}
function legendRow(cls, label) { return el('div', { class: 'row' }, el('span', { class: 'swatch ' + cls }), label); }
