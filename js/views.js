// Content views: the documents/sources browser and the family-story page.
import * as DATA from './data.js';
import { Vault } from './crypto.js';
import { t, getLang } from './i18n.js';
import { el, clear } from './util.js';
import { openDoc } from './docview.js';

export function renderSources(view) {
  const M = DATA.model();
  clear(view);
  const page = el('div', { class: 'page' });
  page.append(el('h1', { text: t('sourcesTitle') }), el('p', { class: 'lead', text: t('sourcesLead') }));

  const all = Object.values(M.sources).filter((s) => s.assets.length);
  const types = [...new Set(all.map((s) => s.type).filter(Boolean))].sort();
  const facets = el('div', { class: 'facets' });
  const grid = el('div', { class: 'src-grid' });

  let active = 'all';
  const draw = () => {
    clear(grid);
    all.filter((s) => active === 'all' || s.type === active).forEach((s) => grid.append(srcCard(s)));
  };
  const mkFacet = (key, label) => el('button', { class: key === active ? 'active' : '', text: label,
    onclick: (e) => { active = key; [...facets.children].forEach((b) => b.classList.remove('active')); e.target.classList.add('active'); draw(); } });
  facets.append(mkFacet('all', t('filterAll')));
  types.forEach((ty) => facets.append(mkFacet(ty, ty)));
  page.append(facets, grid);
  view.append(page);
  draw();
}

function srcCard(s) {
  const card = el('div', { class: 'src-card', onclick: () => openDoc(s.code) });
  const firstImg = s.assets.find((a) => a.kind === 'image' || a.kind === 'crop');
  const imgWrap = el('div', { class: 'src-img' });
  if (firstImg) {
    const img = el('img', { alt: s.title, loading: 'lazy' });
    Vault.imageURL(firstImg.src, { thumb: true }).then((u) => { img.src = u; }).catch(() => {});
    imgWrap.append(img);
  }
  card.append(imgWrap, el('div', { class: 'src-meta' },
    el('h4', { text: s.title }),
    el('div', { class: 'src-tag', text: [s.type, s.date].filter(Boolean).join(' · ') })));
  return card;
}

export function renderStory(view) {
  const M = DATA.model();
  clear(view);
  const es = getLang() === 'es';
  const page = el('div', { class: 'page' });
  page.append(el('h1', { text: t('storyTitle') }));
  page.append(el('p', { class: 'lead', text: M.meta.familyArc }));

  // Story prose lives ONLY in the encrypted model (data.meta.story), never as plaintext JS.
  const story = (M.meta.story || {});
  const html = story[es ? 'es' : 'en'] || story.en || story.es || '';
  if (html) page.append(el('div', { class: 'pp-prose story', html: linkify(html) }));

  // journey recap with a small link to the globe
  page.append(el('p', {}, el('a', { href: '#/journey', text: '→ ' + t('journeyTitle') }),
    '   ', el('a', { href: '#/timeline', text: '→ ' + t('timelineTitle') })));
  view.append(page);
}

// turn {{ID|label}} markers (from the encrypted story model) into clickable person links
function linkify(html) {
  return html.replace(/\{\{(\w+)\|([^}]+)\}\}/g, (_, id, label) =>
    `<a href="#/person/${id}">${label}</a>`);
}
