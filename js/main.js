// Boot, unlock, and hash routing.
import { Vault } from './crypto.js';
import * as DATA from './data.js';
import { $, $$, clear, el } from './util.js';
import { applyStatic, toggleLang, onLangChange, t } from './i18n.js';
import { renderFullTree, focusPerson } from './fulltree.js';
import { openPerson, closePerson, renderProfile } from './person.js';
import { openDoc, closeDoc } from './docview.js';
import { initSearch } from './search.js';
import { renderSources, renderStory } from './views.js';
import { renderTimeline } from './timeline.js';
import { renderJourney } from './journey.js';
import { renderRelated } from './related.js';

let mounted = null; // which view currently occupies #view: 'tree' | 'page'

async function boot() {
  applyStatic();
  const mode = await Vault.detect();
  if (mode === 'enc') showLock();
  else start();
}

function showLock() {
  const lock = $('#lock');
  lock.classList.remove('hidden');
  $('#lock-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#lock-error'); err.textContent = '';
    const btn = $('#lock-btn'); btn.disabled = true;
    try {
      await Vault.unlock($('#lock-input').value);
      lock.classList.add('hidden');
      start();
    } catch (ex) {
      err.textContent = (ex && ex.code === 'INSECURE') ? t('lockInsecure') : t('lockWrong');
      btn.disabled = false;
      $('#lock-input').select();
    }
  });
  $('#lock-input').focus();
}

async function start() {
  const m = await Vault.loadModel();
  DATA.setModel(m);
  $('#brand-title').textContent = m.meta.title;
  $('#app').classList.remove('hidden');
  initSearch();
  initNav();
  $('#lang-toggle').addEventListener('click', toggleLang);
  onLangChange(() => { mounted = null; route(); });
  window.addEventListener('hashchange', route);
  route();
  maybeOnboard();
}

// A once-shown welcome that names the core moves (dismiss persists in localStorage).
function maybeOnboard() {
  try { if (localStorage.getItem('seenIntro')) return; } catch (e) { return; }
  const close = () => { card.remove(); try { localStorage.setItem('seenIntro', '1'); } catch (e) { /* */ } };
  const card = el('div', { class: 'onboard', role: 'dialog' },
    el('h2', { text: t('introTitle') }),
    el('p', { text: t('introBody') }),
    el('button', { class: 'onboard-btn', text: t('introOk'), onclick: close }));
  $('#app').append(card);
}

function initNav() {
  $$('[data-route]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    location.hash = a.dataset.route;
    $('#nav').classList.remove('open');
  }));
  $('#nav-toggle').addEventListener('click', () => $('#nav').classList.toggle('open'));
}

function setActiveNav(route) {
  $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === route));
}

function ensureTree() {
  if (mounted !== 'tree') {
    mounted = 'tree';
    return renderFullTree($('#view'), onCardSelect);   // async (lazy-loads d3 on first tree view)
  }
  return Promise.resolve();
}

const isMobile = () => window.matchMedia('(max-width:780px)').matches;

function onCardSelect(id) {
  if (isMobile()) { location.hash = '#/profile/' + id; return; }
  openPerson(id);
  history.replaceState(null, '', '#/person/' + id);
  focusPerson(id);   // focus mode: re-root the hourglass on this person
}

function page(render, route) {
  clear($('#view'));
  mounted = 'page';
  render($('#view'));
  setActiveNav(route);
}

function route() {
  const hash = location.hash || '#/';
  closeDoc();
  if (window.__viewCleanup) { try { window.__viewCleanup(); } catch (e) { /* */ } window.__viewCleanup = null; }

  const profileMatch = hash.match(/^#\/profile\/(\w+)/);
  if (profileMatch) {
    closePerson();
    page((v) => renderProfile(v, profileMatch[1]), '#/');
    return;
  }

  const personMatch = hash.match(/^#\/person\/(\w+)/);
  if (personMatch) {
    if (isMobile()) { location.hash = '#/profile/' + personMatch[1]; return; }
    setActiveNav('#/');
    ensureTree().then(() => focusPerson(personMatch[1]));   // focus once the tree (and d3) is ready
    openPerson(personMatch[1]);
    return;
  }
  closePerson();

  const docMatch = hash.match(/^#\/doc\/(\w+)/);
  if (docMatch) { ensureTree(); setActiveNav('#/'); openDoc(docMatch[1]); return; }

  if (hash.startsWith('#/timeline')) {
    const tm = hash.match(/^#\/timeline\/(\w+)/);
    return page((v) => renderTimeline(v, tm ? tm[1] : null), '#/timeline');
  }
  if (hash.startsWith('#/journey')) {
    const jm = hash.match(/^#\/journey\/([\w-]+)(?:\/(\w+))?/);
    return page((v) => renderJourney(v, jm ? { chapterId: jm[1], legId: jm[2] } : null), '#/journey');
  }
  if (hash.startsWith('#/sources')) return page(renderSources, '#/sources');
  if (hash.startsWith('#/story')) return page(renderStory, '#/story');
  if (hash.startsWith('#/related')) return page(renderRelated, '#/related');

  ensureTree();
  setActiveNav('#/');
}

boot();
