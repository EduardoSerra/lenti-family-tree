// "How are we related?" — BFS over the blood-relationship graph to a common ancestor,
// then a plain-language, gendered label (English / Spanish).
import * as DATA from './data.js';
import { t, getLang } from './i18n.js';
import { el, clear, norm } from './util.js';

function ancestors(id) {
  const dist = {};
  const stack = [[id, 0]];
  while (stack.length) {
    const [n, d] = stack.pop();
    if (n in dist && dist[n] <= d) continue;
    dist[n] = d;
    for (const par of DATA.parentsOf(n)) stack.push([par, d + 1]);
  }
  return dist;
}

function ordinal(n, es) {
  if (es) return ['', 'primer', 'segundo', 'tercer', 'cuarto', 'quinto', 'sexto'][n] || n + '.º';
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function greats(n, es) { // n times "great"
  if (n <= 0) return '';
  const w = es ? 'tatara' : 'great-';
  return w.repeat(n);
}

// term for "A is B's ___" given generational distances da (A→ancestor), db (B→ancestor)
function term(da, db, aSex, es) {
  const male = aSex === 'M';
  const F = (m, f) => (male ? m : f);
  if (da === 0) { // A is ancestor of B, db levels up
    if (db === 1) return F(es ? 'padre' : 'father', es ? 'madre' : 'mother');
    const g = greats(db - 2, es);
    return g + F(es ? 'abuelo' : 'grandfather', es ? 'abuela' : 'grandmother');
  }
  if (db === 0) { // A is descendant of B, da levels down
    if (da === 1) return F(es ? 'hijo' : 'son', es ? 'hija' : 'daughter');
    const g = greats(da - 2, es);
    return g + F(es ? 'nieto' : 'grandson', es ? 'nieta' : 'granddaughter');
  }
  if (da === 1 && db === 1) return F(es ? 'hermano' : 'brother', es ? 'hermana' : 'sister');
  if (da === 1 && db >= 2) { // A is (great-)uncle/aunt of B
    const g = greats(db - 2, es);
    return g + F(es ? 'tío' : 'uncle', es ? 'tía' : 'aunt');
  }
  if (db === 1 && da >= 2) { // A is (great-)nephew/niece of B
    const g = greats(da - 2, es);
    return g + F(es ? 'sobrino' : 'nephew', es ? 'sobrina' : 'niece');
  }
  // cousins
  const degree = Math.min(da, db) - 1;
  const removed = Math.abs(da - db);
  let base = es ? `${ordinal(degree, true)} primo${male ? '' : 'a'}` : `${ordinal(degree, false)} cousin`;
  if (removed) base += es ? `, ${ordinal(removed, true)} grado removido` : `, ${ordinal(removed, false)} removed`;
  return base;
}

export function relationship(aId, bId) {
  const es = getLang() === 'es';
  if (aId === bId) return es ? 'la misma persona' : 'the same person';
  const A = ancestors(aId), B = ancestors(bId);
  let best = null;
  for (const k in A) {
    if (k in B) {
      const c = A[k] + B[k];
      if (!best || c < best.c) best = { k, c, da: A[k], db: B[k] };
    }
  }
  const aP = DATA.person(aId);
  if (best) return term(best.da, best.db, aP.sex, es);
  // spouse / by-marriage
  for (const u of DATA.unionsOf(aId)) {
    if (u.partnerId === bId) {
      if (u.divorced) return es ? (aP.sex === 'M' ? 'ex-esposo' : 'ex-esposa') : 'former spouse';
      return es ? (aP.sex === 'M' ? 'esposo' : 'esposa') : (aP.sex === 'M' ? 'husband' : 'wife');
    }
  }
  // A's spouse is blood-related to B? -> in-law
  for (const u of DATA.unionsOf(aId)) {
    if (u.partnerId && Object.keys(ancestors(u.partnerId)).some((k) => k in ancestors(bId))) {
      return es ? 'pariente político (por matrimonio)' : 'related by marriage (in-law)';
    }
  }
  return es ? 'sin un parentesco directo registrado' : 'no direct blood relationship on record';
}

export function renderRelated(view) {
  const M = DATA.model();
  clear(view);
  const es = getLang() === 'es';
  const page = el('div', { class: 'page' });
  page.append(el('h1', { text: t('relatedTitle') }), el('p', { class: 'lead', text: t('relatedLead') }));

  const people = Object.values(M.people).sort((a, b) => a.name.localeCompare(b.name));
  const sel = () => {
    const s = el('select', { class: 'u-select' });
    s.append(el('option', { value: '', text: '—' }));
    people.forEach((p) => s.append(el('option', { value: p.id, text: p.name + (p.lifeLine ? ` (${p.lifeLine})` : '') })));
    return s;
  };
  const a = sel(), b = sel();
  const out = el('div', { class: 'related-result hidden' });

  const compute = () => {
    if (!a.value || !b.value) { out.classList.add('hidden'); return; }
    const rel = relationship(a.value, b.value);
    const an = M.people[a.value].name, bn = M.people[b.value].name;
    out.innerHTML = es
      ? `<b>${an}</b> es <b>${rel}</b> de <b>${bn}</b>.`
      : `<b>${an}</b> is <b>${bn}</b>'s <b>${rel}</b>.`;
    out.classList.remove('hidden');
  };
  a.addEventListener('change', compute);
  b.addEventListener('change', compute);

  const pickers = el('div', { class: 'related-pickers' },
    el('div', {}, el('label', { text: t('personFirst') }), el('br'), a),
    el('div', { style: 'align-self:center;color:var(--mut)' }, t('personB')),
    el('div', {}, el('label', { text: t('personSecond') }), el('br'), b));
  page.append(pickers, out);
  view.append(page);
}
