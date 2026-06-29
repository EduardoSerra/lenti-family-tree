// A real flat map (Leaflet + OpenStreetMap/Carto tiles) for the Travesía — a marker at every
// place (a precise pin for specific venues like a marriage church, a soft dot otherwise),
// migration legs drawn as gentle curves coloured by family line, and a per-leg highlight that
// stays in sync with the step-through. Tiles need a network connection; the globe is the
// offline-friendly view. Exposes the same { render, destroy } contract the globe uses.
import { loadScript, loadCSS, el, escapeHtml } from './util.js';

const LINE_COLOR = { lenti: '#b1542f', blasini: '#6f8a6a', 'serra-lenti': '#5b7c99' };
// Carto basemap that matches the viewer's OS light/dark setting
const tileUrl = () => (matchMedia('(prefers-color-scheme: dark)').matches
  ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
  : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png');
const ACC = '#b1542f', TRAIL = '#a8a299';

// a gentle quadratic arc (perpendicular-offset control point) between two [lat,lng] points
function curve(a, b) {
  const [lat1, lng1] = a, [lat2, lng2] = b;
  const mx = (lat1 + lat2) / 2, my = (lng1 + lng2) / 2;
  const dlat = lat2 - lat1, dlng = lng2 - lng1;
  const cx = mx - dlng * 0.16, cy = my + dlat * 0.16;
  const pts = [], N = 28;
  for (let i = 0; i <= N; i++) {
    const t = i / N, u = 1 - t;
    pts.push([u * u * lat1 + 2 * u * t * cx + t * t * lat2, u * u * lng1 + 2 * u * t * cy + t * t * lng2]);
  }
  return pts;
}

export async function createFlatMap(host, places, placeExtra) {
  loadCSS('vendor/leaflet.css');
  await loadScript('vendor/leaflet.js');
  if (!host.isConnected || typeof L === 'undefined') return null;

  const map = L.map(host, { zoomControl: true, worldCopyJump: true, scrollWheelZoom: true })
    .setView([22, -35], 3);
  L.tileLayer(tileUrl(), {
    subdomains: 'abcd', maxZoom: 19,
    attribution: '&copy; OpenStreetMap, &copy; CARTO',
  }).addTo(map)
    // if the tile CDN is unreachable, show a one-line notice once (markers/legs still render)
    .once('tileerror', () => {
      if (host.querySelector('.fm-offline')) return;
      host.append(el('div', { class: 'fm-offline', text: 'Map tiles unavailable offline — switch to the Globe view.' }));
    });

  // a marker for every located place (precise venues get a tighter, accented pin)
  for (const [name, c] of Object.entries(places)) {
    if (typeof c.lat !== 'number' || typeof c.lng !== 'number') continue;
    const precise = !!c.precise;
    const icon = L.divIcon({ className: 'fm-pinwrap', iconSize: [12, 12], iconAnchor: [6, 6],
      html: `<span class="fm-pin${precise ? ' precise' : ''}"></span><span class="fm-label">${escapeHtml(name)}</span>` });
    const mk = L.marker([c.lat, c.lng], { icon, keyboard: false, riseOnHover: true }).addTo(map);
    mk.bindTooltip(name, { direction: 'top', offset: [0, -8] });
    // click a place → its card (period + 'the place then' + who was born/married/died there).
    // Frontmatter scalars (address/period) are escaped; aboutHtml is already safe md→HTML.
    let html = `<div class="fm-pop"><strong>${escapeHtml(name)}</strong>`;
    const sub = [c.address, c.country].filter(Boolean).map(escapeHtml).join(' · ');
    if (sub) html += `<div class="fm-pop-sub">${sub}</div>`;
    if (c.period) html += `<div class="fm-pop-period">${escapeHtml(c.period)}</div>`;
    if (c.aboutHtml) html += `<div class="fm-pop-about">${c.aboutHtml}</div>`;
    if (placeExtra) html += placeExtra(name) || '';
    html += '</div>';
    mk.bindPopup(html, { maxWidth: 290, className: 'fm-popup' });
  }

  const legLayer = L.layerGroup().addTo(map);

  function render(legs, idx, animate) {
    legLayer.clearLayers();
    const bounds = [];
    legs.forEach((leg, i) => {
      const a = [leg.from.lat, leg.from.lng], b = [leg.to.lat, leg.to.lng];
      const active = i === idx;
      const color = active ? (LINE_COLOR[leg.line] || ACC) : TRAIL;
      L.polyline(curve(a, b), { color, weight: active ? 4 : 2, opacity: active ? 0.95 : 0.45,
        dashArray: active ? null : '3 7' }).addTo(legLayer);
      for (const p of [a, b]) {
        L.circleMarker(p, { radius: active ? 6 : 4, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 }).addTo(legLayer);
      }
      bounds.push(a, b);
    });
    const leg = legs[idx];
    if (leg) {
      const lb = L.latLngBounds([[leg.from.lat, leg.from.lng], [leg.to.lat, leg.to.lng]]).pad(0.55);
      map.flyToBounds(lb, { duration: animate ? 0.8 : 0, maxZoom: 6 });
    } else if (bounds.length) {
      map.fitBounds(L.latLngBounds(bounds).pad(0.25), { animate: !!animate });
    }
  }

  function destroy() { try { map.remove(); } catch (e) { /* */ } }
  setTimeout(() => { try { map.invalidateSize(); } catch (e) { /* */ } }, 60);
  return { render, destroy, map };
}

// A small read-only map tracing one person's life through their event places, in order.
// stops: ordered [{ name, lat, lng, label }]. Returns { destroy } or null.
export async function createTraceMap(host, stops) {
  loadCSS('vendor/leaflet.css');
  await loadScript('vendor/leaflet.js');
  if (!host.isConnected || typeof L === 'undefined' || !stops || stops.length < 1) return null;
  const map = L.map(host, { zoomControl: true, scrollWheelZoom: false });
  L.tileLayer(tileUrl(), {
    subdomains: 'abcd', maxZoom: 19, attribution: '&copy; OpenStreetMap, &copy; CARTO',
  }).addTo(map);
  const pts = stops.map((s) => [s.lat, s.lng]);
  if (pts.length > 1) {
    let line = [];
    for (let i = 0; i < pts.length - 1; i++) line = line.concat(curve(pts[i], pts[i + 1]));
    L.polyline(line, { color: ACC, weight: 3, opacity: 0.85 }).addTo(map);
  }
  stops.forEach((s) => {
    const icon = L.divIcon({ className: 'fm-pinwrap', iconSize: [12, 12], iconAnchor: [6, 6],
      html: `<span class="fm-pin"></span><span class="fm-label">${s.name}</span>` });
    const mk = L.marker([s.lat, s.lng], { icon, keyboard: false }).addTo(map);
    if (s.label) mk.bindTooltip(s.label, { direction: 'top', offset: [0, -8] });
  });
  map.fitBounds(L.latLngBounds(pts).pad(0.3), { animate: false, maxZoom: 7 });
  setTimeout(() => { try { map.invalidateSize(); } catch (e) { /* */ } }, 60);
  return { destroy() { try { map.remove(); } catch (e) { /* */ } } };
}
