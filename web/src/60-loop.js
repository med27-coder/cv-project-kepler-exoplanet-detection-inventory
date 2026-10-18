// ---------------------------------------------------------------- animation loop
// Power savers: the system view runs at 30 fps (pixel art looks the same), the map at ~8 fps;
// a canvas scrolled out of sight isn't drawn; with both out of sight, or after a few idle minutes,
// the loop stops completely and the last frame stays on screen. Any interaction wakes it.
// (Browsers already pause it in hidden tabs.)
const MAP_MS = 120, IDLE_MS = 3 * 60 * 1000;
let SYSTEM_MS = 1000 / 30;   // Animation menu: 60 / 30 / 15 fps, or off (one still frame per change)
const fpsMenu = document.getElementById('fps');
fpsMenu.addEventListener('change', () => {
  const fps = Number(fpsMenu.value);
  if (fps === 15) achieve('eco');
  SYSTEM_MS = fps ? 1000 / fps : Infinity;
  wake();
});
const onScreen = new Map([[map, true], [sys, true], [uniCanvas, false]]);
let lastMap = 0, lastSys = 0, lastUniverse = 0, lastActive = performance.now(), running = false;

function frame(now) {
  const visible = onScreen.get(map) || onScreen.get(sys) || onScreen.get(uniCanvas);
  if (!visible || now - lastActive > IDLE_MS) { running = false; return; }
  if (SYSTEM_MS === Infinity) {   // animation off: draw the current state once, then sleep until something changes
    drawMap(now);
    drawUniverse(now);
    drawSystem(0);
    drawBackdrop(now, true);
    running = false;
    return;
  }
  if (onScreen.get(map) && now - lastMap >= MAP_MS) { drawMap(now); drawHeaderEmblem(now); lastMap = now; }
  if (onScreen.get(uniCanvas) && now - lastUniverse >= MAP_MS) { drawUniverse(now); lastUniverse = now; }   // 56-universe.js
  drawBackdrop(now);   // the night sky behind the page (55-backdrop.js; ~8 fps, still with reduced motion)
  if (onScreen.get(sys) && now - lastSys >= SYSTEM_MS) {
    drawSystem(now / 1000);
    lastSys = now;
    if (scene && !scene.custom && !scene.mystery && now - sceneSince > 120_000) achieve('patient');
  }
  requestAnimationFrame(frame);
}
function wake() {
  lastActive = performance.now();
  if (!running) { running = true; requestAnimationFrame(frame); }
}
for (const evt of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll', 'focusin']) {
  window.addEventListener(evt, wake, { passive: true, capture: true });
}
// Browsers may throw away the pixels of off-screen canvases (our cached layers) while the tab is
// in the background or after a graphics reset; the cached layers are then blank. Redraw them
// whenever the page comes back, or the browser says it restored a canvas. Cheap: a few ms.
function refreshLayers() {
  renderBase();
  if (liveScene()) layout();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  refreshLayers();
  wake();
});
window.addEventListener('pageshow', e => { if (e.persisted) { refreshLayers(); wake(); } });
for (const canvas of [map, sys, base]) canvas.addEventListener('contextrestored', () => { refreshLayers(); wake(); });
window.addEventListener('hashchange', wake);
if ('IntersectionObserver' in window) {
  const watcher = new IntersectionObserver(entries => {
    for (const e of entries) onScreen.set(e.target, e.isIntersecting);
    if (onScreen.get(map) || onScreen.get(sys) || onScreen.get(uniCanvas)) wake();
  });
  watcher.observe(map);
  watcher.observe(sys);
  watcher.observe(uniCanvas);
}
drawMap(0);
drawSystem(0);
wake();
// Ready: the loading screen (index.html) fades out, if it ever showed, and goes.
const loadingScreen = document.getElementById('loading');
if (loadingScreen) {
  loadingScreen.classList.add('done');
  setTimeout(() => loadingScreen.remove(), 350);
}
// "TAKE ME SOMEWHERE" buttons (the empty screen, NO SIGNAL): the dice.
info.addEventListener('click', e => { if (e.target.closest('[data-random]')) document.getElementById('random').click(); });
