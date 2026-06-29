// The in-memory model + relationship helpers + the family-chart transform.
let M = null;

export function setModel(m) { M = m; }
export function model() { return M; }
export function person(id) { return M.people[id]; }
export function family(id) { return M.families[id]; }
export function isLiving(id) { return M.people[id]?.lifeStatus === 'living'; }

export function displayName(id) { return M.people[id]?.name || '(unknown)'; }

export function parentsOf(id) {
  const p = person(id);
  if (!p || !p.parentFamily) return [];
  const f = family(p.parentFamily);
  return f ? [f.husband, f.wife].filter(Boolean) : [];
}

export function siblingsOf(id) {
  const p = person(id);
  if (!p || !p.parentFamily) return [];
  const f = family(p.parentFamily);
  return f ? f.children.filter((c) => c !== id) : [];
}

// Each union the person is part of: partner + that union's children + marriage meta.
export function unionsOf(id) {
  const p = person(id);
  if (!p) return [];
  return (p.spouseFamilies || []).map((fid) => {
    const f = family(fid);
    if (!f) return null;
    const partner = f.husband === id ? f.wife : f.husband;
    return { fid, partnerId: partner, children: f.children || [],
      type: f.type, divorced: f.divorced, marriage: f.marriage };
  }).filter(Boolean);
}

// Everyone, as family-chart datums (handles multiple unions + single-parent families).
export function toFamilyChart() {
  const push = (arr, v) => { if (v && !arr.includes(v)) arr.push(v); };
  const nodes = {};
  for (const id in M.people) {
    const p = M.people[id];
    nodes[id] = {
      id,
      data: {
        'first name': p.given || p.name || '',
        'last name': p.surname || '',
        birthday: p.lifeLine || '',
        gender: p.sex === 'F' ? 'F' : 'M',
        living: p.lifeStatus === 'living',
      },
      rels: { spouses: [], children: [], father: null, mother: null },
    };
  }
  for (const fid in M.families) {
    const f = M.families[fid];
    const h = f.husband, w = f.wife;
    if (h && w && nodes[h] && nodes[w]) { push(nodes[h].rels.spouses, w); push(nodes[w].rels.spouses, h); }
    for (const c of f.children) {
      if (!nodes[c]) continue;
      if (h && nodes[h]) { nodes[c].rels.father = h; push(nodes[h].rels.children, c); }
      if (w && nodes[w]) { nodes[c].rels.mother = w; push(nodes[w].rels.children, c); }
    }
  }
  return Object.values(nodes);
}

// A sensible default "main" person to root the tree on (the configured anchor, else first root).
export function defaultMainId() {
  if (M.people['I7']) return 'I7';
  return M.meta.roots[0] || Object.keys(M.people)[0];
}

// Surname → tint for visual grouping. Built from the loaded model's surnames so no family
// names are hardcoded in the public JS; assigned deterministically from a fixed palette.
const TINT_PALETTE = ['#7a5230', '#46607a', '#5a6b4d', '#9a5a4a', '#8a6d3b', '#6b5a7a', '#7a6b46', '#5c6b7a'];
let _surnameTints = null;
export function surnameTint(surname) {
  if (!_surnameTints) {
    _surnameTints = {};
    let i = 0;
    for (const p of Object.values(M.people)) {
      const key = (p.surname || '').split(' ')[0];
      if (key && !(key in _surnameTints)) { _surnameTints[key] = TINT_PALETTE[i % TINT_PALETTE.length]; i += 1; }
    }
  }
  return _surnameTints[(surname || '').split(' ')[0]] || null;
}
