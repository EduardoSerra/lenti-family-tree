// The Travesía — a guided, chaptered story-map of the family's migrations. Pick a chapter
// (one per migration line); step through its legs one at a time
// with Prev/Next or a paced, pausable auto-play. Each leg shows the same story + images the
// Cronología has, plus who travelled. Two synced views: a 3D globe (offline) and a real flat
// map (Leaflet/OpenStreetMap, interactive, precise pins). Reduced-motion safe.
import * as DATA from './data.js';
import { Vault } from './crypto.js';
import { t } from './i18n.js';
import { el, clear, loadScript, initials, copyLinkButton } from './util.js';
import { openGallery } from './docview.js';
import { createFlatMap } from './flatmap.js';

const ACC = '#b1542f';
const LINE_COLOR = { lenti: '#b1542f', blasini: '#6f8a6a', 'serra-lenti': '#5b7c99' };
const TRAIL = 'rgba(120,112,104,.22)';
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const PACE = 5600;   // auto-play dwell per leg (ms) — slow enough to read

let countries = null;
let mapCtl = null, mapMode = 'globe';
let chapters = [], allLegs = [], chapterLegs = [], chapterId = null, stepIdx = 0;
let playing = false, playTimer = null;
let host = null, panelCard = null, stepBar = null, chapterBar = null, gBtn = null, mBtn = null;

export async function renderJourney(view, target) {
  clear(view);
  const M = DATA.model();
  chapters = M.journeyChapters || [];
  allLegs = M.journey || [];

  host = el('div', { id: 'journey-host' });
  const splash = el('div', { class: 'splash', text: '…' });
  host.append(splash);

  gBtn = el('button', { 'aria-pressed': 'true', text: t('globeView') });
  mBtn = el('button', { 'aria-pressed': 'false', text: t('mapView') });
  gBtn.onclick = () => switchMap('globe', gBtn, mBtn);
  mBtn.onclick = () => switchMap('map', gBtn, mBtn);
  const viewToggle = el('div', { class: 'journey-viewtoggle toggle-group' }, gBtn, mBtn);

  chapterBar = el('div', { class: 'journey-chapters' });
  chapters.forEach((ch) => {
    const b = el('button', { class: 'jch', onclick: () => selectChapter(ch.id) },
      el('span', { class: 'jch-title', text: ch.title }),
      el('span', { class: 'jch-sub', text: ch.subtitle || '' }));
    b.dataset.ch = ch.id;
    chapterBar.append(b);
  });

  panelCard = el('div', { class: 'journey-card' });
  stepBar = el('div', { class: 'journey-steps' });
  const panel = el('div', { class: 'journey-panel' },
    el('div', { class: 'journey-head' },
      el('h1', { text: t('journeyTitle') }),
      el('p', { class: 'lead', text: t('journeyLead') })),
    chapterBar, panelCard, stepBar);

  view.append(host, viewToggle, panel);

  await initMap('globe');
  if (!host.isConnected) return;
  splash.remove();

  const startCh = (target && chapters.some((c) => c.id === target.chapterId))
    ? target.chapterId : (chapters[0] && chapters[0].id);
  selectChapter(startCh);
  if (target && target.legId) {
    const i = chapterLegs.findIndex((l) => l.id === target.legId);
    if (i >= 0) { stepIdx = i; if (mapCtl) mapCtl.render(chapterLegs, i, false); renderCard(); renderSteps(); syncHash(); }
  }

  window.__viewCleanup = () => {
    stopPlay();
    if (mapCtl) { try { mapCtl.destroy(); } catch (e) { /* */ } mapCtl = null; }
  };
}

// keep the URL in step with the current chapter/leg (shareable, back-button friendly)
function syncHash() {
  const leg = chapterLegs[stepIdx];
  const h = '#/journey/' + (chapterId || '') + (leg ? '/' + leg.id : '');
  try { history.replaceState(null, '', h); } catch (e) { /* */ }
}

// ---------- map controllers ----------
async function initMap(mode) {
  const M = DATA.model();
  if (mode === 'map') {
    mapCtl = await createFlatMap(host, M.places, whoAtPlace);
    mapMode = 'map';
    return;
  }
  mapCtl = await createGlobe(host, M.places);
  if (!mapCtl && host.isConnected) {
    // WebGL unavailable (old/locked-down device) — fall back to the flat map
    mapCtl = await createFlatMap(host, M.places, whoAtPlace);
    mapMode = 'map';
    if (gBtn && mBtn) { gBtn.setAttribute('aria-pressed', 'false'); mBtn.setAttribute('aria-pressed', 'true'); }
  } else {
    mapMode = 'globe';
  }
}

const WHAT_KEY = { birth: 'born', baptism: 'baptized', christening: 'baptized',
  immigration: 'immigrated', residence: 'lived', death: 'died', burial: 'buried' };

// HTML for the "who was born/married/died here" list inside a flat-map place popup
function whoAtPlace(name) {
  const M = DATA.model();
  const rows = [];
  for (const p of Object.values(M.people)) {
    if (p.lifeStatus === 'living' || !p.events) continue;
    for (const ev of p.events) {
      if (ev.placeName !== name) continue;
      const what = t(WHAT_KEY[ev.type] || ev.type) || ev.type;
      rows.push(`<li>${what} · <a href="#/profile/${p.id}">${p.name}</a>` +
        (ev.dateText ? ` <span>(${ev.dateText})</span>` : '') + '</li>');
    }
  }
  if (!rows.length) return '';
  return `<div class="fm-pop-who"><div class="fm-pop-h">${t('whoWasHere')}</div><ul>${rows.slice(0, 10).join('')}</ul></div>`;
}

async function switchMap(mode, gBtn, mBtn) {
  if (mode === mapMode) return;
  stopPlay();
  gBtn.setAttribute('aria-pressed', mode === 'globe' ? 'true' : 'false');
  mBtn.setAttribute('aria-pressed', mode === 'map' ? 'true' : 'false');
  if (mapCtl) { try { mapCtl.destroy(); } catch (e) { /* */ } mapCtl = null; }
  // Leaflet brands the host node itself (.leaflet-container + inline styles); swap in a clean
  // node so globe.gl and Leaflet never inherit each other's classes/styles.
  const fresh = el('div', { id: 'journey-host' });
  host.replaceWith(fresh);
  host = fresh;
  const splash = el('div', { class: 'splash', text: '…' });
  host.append(splash);
  await initMap(mode);
  if (!host.isConnected) return;
  splash.remove();
  if (mapCtl) mapCtl.render(chapterLegs, stepIdx, false);
}

async function createGlobe(host, places) {
  await loadScript('vendor/globe.gl.min.js');
  if (!countries) countries = await (await fetch('vendor/countries-110m.geojson')).json();
  if (!host.isConnected || typeof Globe === 'undefined') return null;
  // bail to the flat-map fallback if a WebGL context can't be created (old iPad / locked-down)
  try {
    const probe = document.createElement('canvas');
    if (!probe.getContext('webgl') && !probe.getContext('experimental-webgl')) return null;
  } catch (e) { return null; }
  const points = Object.entries(places)
    .filter(([, c]) => typeof c.lat === 'number' && typeof c.lng === 'number')
    .map(([name, c]) => ({ name, lat: c.lat, lng: c.lng }));

  // read themeable colors from CSS tokens so the globe follows light/dark
  const css = getComputedStyle(document.documentElement);
  const cv = (name, fb) => (css.getPropertyValue(name).trim() || fb);
  const acc = cv('--acc', ACC);
  let g;
  try {
    g = Globe()(host)
    .width(host.clientWidth).height(host.clientHeight)
    .backgroundColor(cv('--globe-bg', '#fbfaf8'))
    .showGlobe(true).showGraticules(false).showAtmosphere(true).atmosphereColor(acc).atmosphereAltitude(0.1)
    .hexPolygonsData(countries.features).hexPolygonResolution(3).hexPolygonMargin(0.4)
    .hexPolygonUseDots(true).hexPolygonColor(() => cv('--globe-land', '#d3cfc7'))
    .arcColor('color').arcStroke('stroke').arcAltitudeAutoScale(0.42)
    .arcDashLength(0.5).arcDashGap(0.3).arcDashAnimateTime(2000).arcsTransitionDuration(0)
    .ringsData([]).ringLat('lat').ringLng('lng').ringColor(() => acc).ringMaxRadius(2.6).ringPropagationSpeed(1.3).ringRepeatPeriod(1300)
    .pointsData(points).pointLat('lat').pointLng('lng').pointColor(() => acc).pointAltitude(0.008).pointRadius(0.32)
    .labelsData(points).labelLat('lat').labelLng('lng').labelText('name').labelAltitude(0.012)
    .labelSize(1.15).labelDotRadius(0.42).labelColor(() => cv('--globe-label', '#23201c')).labelResolution(2);
  } catch (e) { return null; }
  try { g.globeMaterial().color.set(cv('--globe-sphere', '#edf0f2')); } catch (e) { /* */ }
  const controls = g.controls(); controls.enableZoom = true; controls.autoRotate = false;
  g.pointOfView({ lat: 25, lng: -45, altitude: 2.3 }, 0);
  const ro = new ResizeObserver(() => { try { g.width(host.clientWidth).height(host.clientHeight); } catch (e) { /* */ } });
  ro.observe(host);

  function render(legs, idx, animate) {
    const reduce = reduceMotion();
    g.arcsData(legs.map((leg, k) => ({
      startLat: leg.from.lat, startLng: leg.from.lng, endLat: leg.to.lat, endLng: leg.to.lng,
      color: k === idx ? (LINE_COLOR[leg.line] || ACC) : TRAIL, stroke: k === idx ? 1.3 : 0.5,
    }))).arcDashAnimateTime(reduce ? 0 : 1700);
    const leg = legs[idx];
    if (leg) {
      g.ringsData([{ lat: leg.from.lat, lng: leg.from.lng }, { lat: leg.to.lat, lng: leg.to.lng }]);
      g.pointOfView({ lat: (leg.from.lat + leg.to.lat) / 2, lng: (leg.from.lng + leg.to.lng) / 2, altitude: 1.7 },
        animate && !reduce ? 1200 : 0);
    } else { g.ringsData([]); }
  }
  function destroy() {
    try { ro.disconnect(); } catch (e) { /* */ }
    try { if (g.pauseAnimation) g.pauseAnimation(); } catch (e) { /* */ }
    // release the WebGL context + THREE scene (pauseAnimation alone leaks them on each toggle)
    try { if (g._destructor) g._destructor(); } catch (e) { /* */ }
  }
  return { render, destroy };
}

// ---------- chapter / step navigation ----------
function selectChapter(id) {
  stopPlay();
  chapterId = id;
  chapterLegs = allLegs.filter((l) => l.chapter === id);
  stepIdx = 0;
  [...chapterBar.children].forEach((b) => b.classList.toggle('on', b.dataset.ch === id));
  if (mapCtl) mapCtl.render(chapterLegs, 0, true);
  renderCard();
  renderSteps();
  syncHash();
}

function goStep(delta) {
  const n = stepIdx + delta;
  if (n < 0 || n >= chapterLegs.length) return;
  stepIdx = n;
  if (mapCtl) mapCtl.render(chapterLegs, stepIdx, true);
  renderCard();
  renderSteps();
  syncHash();
}

function startPlay() {
  if (chapterLegs.length < 2) return;
  if (stepIdx >= chapterLegs.length - 1) { stepIdx = 0; if (mapCtl) mapCtl.render(chapterLegs, 0, true); renderCard(); }
  playing = true; renderSteps();
  const tick = () => {
    if (!playing) return;
    if (stepIdx >= chapterLegs.length - 1) { stopPlay(); return; }
    goStep(1);
    if (playing) playTimer = setTimeout(tick, reduceMotion() ? 1300 : PACE);
  };
  playTimer = setTimeout(tick, reduceMotion() ? 1100 : PACE);
}
function stopPlay() { playing = false; if (playTimer) { clearTimeout(playTimer); playTimer = null; } if (stepBar) renderSteps(); }
function togglePlay() { if (playing) stopPlay(); else startPlay(); }

// ---------- panel rendering ----------
function legMedia(leg) {
  if (leg.ship_images && leg.ship_images.length) return leg.ship_images;
  if (leg.ship_image) return [{ src: leg.ship_image, caption: `${leg.from.name} → ${leg.to.name}` }];
  return [];
}

function renderCard() {
  clear(panelCard);
  const leg = chapterLegs[stepIdx];
  if (!leg) { panelCard.append(el('p', { class: 'muted', text: t('journeyLead') })); return; }

  const media = legMedia(leg);
  if (media.length) {
    let cur = 0;
    const hero = el('img', { class: 'jcard-img', alt: media[0].caption || leg.label, loading: 'lazy',
      onclick: () => openGallery(media, leg.label, cur) });
    Vault.imageURL(media[0].src).then((u) => { hero.src = u; }).catch(() => {});
    panelCard.append(hero);
    if (media.length > 1) {
      const strip = el('div', { class: 'jcard-gallery' });
      media.forEach((m, i) => {
        const th = el('img', { class: 'jcard-thumb' + (i === 0 ? ' on' : ''), loading: 'lazy', title: m.caption || '' });
        Vault.imageURL(m.src, { thumb: true }).then((u) => { th.src = u; }).catch(() => {});
        th.onclick = () => {
          cur = i; Vault.imageURL(m.src).then((u) => { hero.src = u; }).catch(() => {});
          [...strip.children].forEach((c) => c.classList.toggle('on', c === th));
        };
        strip.append(th);
      });
      panelCard.append(strip);
    }
  }

  panelCard.append(el('div', { class: 'jcard-kicker', text: '✦  ' + leg.year }));
  panelCard.append(el('h2', { class: 'jcard-title', text: `${leg.from.name} → ${leg.to.name}` }));
  panelCard.append(el('div', { class: 'jcard-label', style: `--line:${LINE_COLOR[leg.line] || ACC}`, text: leg.label }));
  if (leg.storyHtml) panelCard.append(el('div', { class: 'pp-prose jcard-story', html: leg.storyHtml }));

  if (leg.personIds && leg.personIds.length) {
    const who = el('div', { class: 'jcard-people' }, el('div', { class: 'jcard-people-h', text: t('whoTravelled') }));
    leg.personIds.forEach((pid) => { const p = DATA.person(pid); if (p) who.append(personAvatar(p)); });
    panelCard.append(who);
  }
  panelCard.append(el('div', { class: 'jcard-actions' },
    el('a', { class: 'jcard-xlink', href: '#/timeline/' + leg.id, text: t('seeOnTimeline') + ' →' }),
    copyLinkButton(t('copyLink'), t('linkCopied'))));
}

function personAvatar(p) {
  const a = el('a', { class: 'javatar', href: '#/profile/' + p.id, title: p.name });
  const face = el('span', { class: 'jav-mono', text: initials(p.name) });
  a.append(face, el('span', { class: 'jav-name', text: p.name }));
  return a;
}

function renderSteps() {
  clear(stepBar);
  const prev = el('button', { class: 'jstep-btn', text: '◀', title: t('prev'), onclick: () => { stopPlay(); goStep(-1); } });
  const next = el('button', { class: 'jstep-btn', text: '▶', title: t('next'), onclick: () => { stopPlay(); goStep(1); } });
  prev.disabled = stepIdx <= 0;
  next.disabled = stepIdx >= chapterLegs.length - 1;
  const playB = el('button', { class: 'jstep-play', text: playing ? '⏸' : '▶',
    title: playing ? t('pause') : t('playJourney'), onclick: togglePlay });
  if (chapterLegs.length < 2) playB.disabled = true;
  const count = el('span', { class: 'jstep-count', text: chapterLegs.length ? `${stepIdx + 1} / ${chapterLegs.length}` : '—' });
  const pct = chapterLegs.length ? ((stepIdx + 1) / chapterLegs.length) * 100 : 0;
  const prog = el('div', { class: 'jstep-prog' }, el('div', { class: 'jstep-prog-bar', style: `width:${pct}%` }));
  stepBar.append(el('div', { class: 'jstep-row' }, prev, playB, next, count), prog);
}
