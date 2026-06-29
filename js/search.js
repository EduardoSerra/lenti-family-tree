// Name search with full keyboard navigation (↑/↓/Enter/Esc), accent-insensitive.
import * as DATA from './data.js';
import { norm, el, clear, $, debounce } from './util.js';
import { t } from './i18n.js';

export function initSearch() {
  const input = $('#search');
  const box = $('#search-results');
  let active = -1;

  const rows = () => [...box.querySelectorAll('.res:not(.empty)')];
  const setActive = (i) => {
    const r = rows();
    if (!r.length) return;
    active = (i + r.length) % r.length;
    r.forEach((n, j) => n.classList.toggle('active', j === active));
    r[active].scrollIntoView({ block: 'nearest' });
  };

  const run = () => {
    const q = norm(input.value.trim());
    clear(box); active = -1;
    if (q.length < 2) { box.classList.add('hidden'); return; }
    const M = DATA.model();
    const hits = [];
    for (const id in M.people) {
      const p = M.people[id];
      // name is the primary key; also match alternate names, places, occupation and birth year
      // (all already on the model; living people carry none of the extras, so they stay name-only)
      const extra = [(p.placeNames || []).join(' '), p.occupation || '', p.birthYear || ''].join(' ');
      const nameHay = norm(p.name + ' ' + (p.nameNotes || []).join(' '));
      const i = nameHay.indexOf(q);
      const inExtra = i < 0 && norm(extra).includes(q);
      if (i >= 0 || inExtra) {
        hits.push({ p, score: (i === 0 ? 0 : i > 0 ? 1 : 2) + (norm(p.surname).startsWith(q) ? -0.5 : 0) });
      }
    }
    hits.sort((a, b) => a.score - b.score || a.p.name.localeCompare(b.p.name));
    if (!hits.length) {
      box.append(el('div', { class: 'res empty' },
        el('div', { text: t('noResults') }),
        el('small', { class: 'res-hint' }, t('searchHint') + ' ',
          el('a', { href: '#/journey', text: t('navJourney'), onclick: () => box.classList.add('hidden') }),
          ' · ',
          el('a', { href: '#/sources', text: t('navSources'), onclick: () => box.classList.add('hidden') }))));
      box.classList.remove('hidden'); return;
    }
    hits.slice(0, 12).forEach(({ p }) => {
      box.append(el('div', { class: 'res', onclick: () => pick(p.id) },
        el('b', { text: p.name }),
        el('small', { text: p.lifeLine || (p.lifeStatus === 'living' ? t('living') : '') })));
    });
    box.classList.remove('hidden');
  };

  function pick(id) {
    location.hash = '#/person/' + id;
    box.classList.add('hidden');
    input.value = '';
    input.blur();
  }

  input.addEventListener('input', debounce(run, 120));
  input.addEventListener('focus', run);
  input.addEventListener('keydown', (e) => {
    if (box.classList.contains('hidden')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter') {
      const r = rows();
      if (active >= 0 && r[active]) { e.preventDefault(); r[active].click(); }
      else if (r.length === 1) { e.preventDefault(); r[0].click(); }
    } else if (e.key === 'Escape') { box.classList.add('hidden'); input.blur(); }
  });
  document.addEventListener('click', (e) => {
    if (!box.contains(e.target) && e.target !== input) box.classList.add('hidden');
  });
}
