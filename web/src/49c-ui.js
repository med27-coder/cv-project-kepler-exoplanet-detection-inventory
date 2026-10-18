// ---------------------------------------------------------------- interface: pixel icons, first-visit tour
// Pixel icons replace the last emoji buttons (dice, gear, trophy). A three-step tour greets first-time
// visitors (search, the map, the Galleria); it never runs under automated testing (navigator.webdriver)
// unless the address asks for it (index.html?tour).
const ICONS = {
  dice: put => {
    for (let y = 1; y < 11; y++) for (let x = 1; x < 11; x++) {
      const edge = x === 1 || y === 1 || x === 10 || y === 10, corner = (x === 1 || x === 10) && (y === 1 || y === 10);
      if (!corner) put(x, y, edge ? '#9aa6b8' : '#eef2f8');
    }
    for (const [x, y] of [[3, 3], [7, 3], [5, 5], [3, 7], [7, 7]]) { put(x, y, '#151a2c'); put(x + 1, y, '#151a2c'); put(x, y + 1, '#151a2c'); put(x + 1, y + 1, '#151a2c'); }
  },
  gear: put => {
    discArt(put, 6, 6, 4.6, (dx, dy, f) => (f < 0.42 ? null : '#e6ecff'));
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      put(Math.round(5.5 + 5.2 * Math.cos(a)), Math.round(5.5 + 5.2 * Math.sin(a)), '#e6ecff');
    }
  },
  trophy: (put, t) => trophyArt('epic')((x, y, c) => put(x - 2, y - 2, c), t),
};
function paintIcons(root = document) {
  root.querySelectorAll('canvas[data-icon]').forEach(c => {
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ICONS[c.dataset.icon]((x, y, col) => { if (col && x >= 0 && y >= 0) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); } }, 1);
  });
}
const iconCanvas = (name, size = 12) => `<canvas class="icon" width="${size}" height="${size}" data-icon="${name}" aria-hidden="true"></canvas>`;

// ---- first-visit tour
const TOUR = [
  ['#query', 'SEARCH THE SKY', 'Type a star system (try Kepler-90) and press SCAN, or roll the dice for a surprise.'],
  ['#map', 'EVERY PIXEL IS A STAR', 'Click one, or use the arrow keys: each has planets or planet candidates found by Kepler.'],
  ['#open-gallery', 'YOUR GALLERIA', 'Easter eggs, achievements, predictions and settings live here. Happy hunting!'],
];
let tourBox = null;
function showTourStep(i) {
  document.querySelectorAll('.tour-target').forEach(el => el.classList.remove('tour-target'));
  if (i >= TOUR.length) { endTour(); return; }
  const [sel, head, text] = TOUR[i], target = document.querySelector(sel);
  if (!target) { endTour(); return; }
  target.classList.add('tour-target');
  target.scrollIntoView({ block: 'nearest', behavior: REDUCED_MOTION ? 'auto' : 'smooth' });
  tourBox = tourBox || Object.assign(document.createElement('div'), { className: 'tour', role: 'dialog' });
  tourBox.setAttribute('aria-label', 'Quick tour');
  tourBox.innerHTML = `<b>${esc(head)}</b><span>${esc(text)}</span>
    <span class="tour-buttons"><span class="tour-step">${i + 1} / ${TOUR.length}</span>
      <button type="button" class="ghost" data-tour="skip">SKIP</button>
      <button type="button" data-tour="next">${i === TOUR.length - 1 ? 'DONE' : 'NEXT'}</button></span>`;
  document.body.appendChild(tourBox);
  const r = target.getBoundingClientRect(), w = Math.min(300, innerWidth - 16);
  tourBox.style.width = `${w}px`;
  tourBox.style.left = `${Math.round(Math.min(Math.max(8, r.left + scrollX), scrollX + innerWidth - w - 8))}px`;
  tourBox.style.top = `${Math.round(r.bottom + scrollY + 10)}px`;
  tourBox.querySelector('[data-tour="next"]').addEventListener('click', () => showTourStep(i + 1));
  tourBox.querySelector('[data-tour="skip"]').addEventListener('click', endTour);
  if (document.activeElement === document.body) tourBox.querySelector('[data-tour="next"]').focus({ preventScroll: true });   // never steal the search box
}
function endTour() {
  document.querySelectorAll('.tour-target').forEach(el => el.classList.remove('tour-target'));
  tourBox?.remove();
  tourBox = null;
  progress.toured = true;
  saveProgress();
}

// ---- planets: hover labels on the system drawing (name and size)
function planetAt(evt) {
  if (!scene || !scene.hits) return null;
  const r = sys.getBoundingClientRect(), x = (evt.clientX - r.left) * SW / r.width, y = (evt.clientY - r.top) * SH / r.height;
  let best = null, bestD = Infinity;
  for (const h of scene.hits) {
    const d = Math.hypot(h.x - x, h.y - y);
    if (d <= h.r + 4 && d < bestD) { best = h; bestD = d; }
  }
  return best;
}
function drawHoverLabel() {   // from drawSystem, after the planets
  const h = scene && scene.hover && scene.hits && scene.hits.find(p => p.name === scene.hover);
  if (!h) return;
  const text = `${String(h.name).toUpperCase()}${h.radius != null ? ` ${fmt(h.radius, 1)}X EARTH` : ''}`;
  const w = textWidth(text) + 4, x = Math.round(Math.min(Math.max(1, h.x - w / 2), SW - w - 1)), y = Math.round(Math.max(1, h.y - h.r - 10));
  sctx.fillStyle = 'rgba(7, 11, 26, 0.85)';
  sctx.fillRect(x, y, w, 8);
  pixelText(sctx, text, x + 2, y + 2, '#ffd34d');
}

queueMicrotask(() => {
  paintIcons();
  const forced = /[?&]tour\b/.test(location.search);
  let busy = false;   // a visitor who starts typing or clicking right away doesn't get interrupted by the tour
  const mark = () => { busy = true; };
  addEventListener('keydown', mark, { once: true, capture: true });
  addEventListener('pointerdown', mark, { once: true, capture: true });
  if ((!progress.toured && !navigator.webdriver) || forced) setTimeout(() => { if (forced || !busy) showTourStep(0); }, forced ? 0 : 900);
});
