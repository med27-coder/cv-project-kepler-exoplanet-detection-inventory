// ---------------------------------------------------------------- animation loop
// Power savers: the system view runs at 30 fps (pixel art looks the same), the map at ~8 fps;
// a canvas scrolled out of sight isn't drawn; with both out of sight, or after a few idle minutes,
// the loop stops completely and the last frame stays on screen. Any interaction wakes it.
// (Browsers already pause it in hidden tabs.)
const SYSTEM_MS = 1000 / 30, MAP_MS = 120, IDLE_MS = 3 * 60 * 1000;
const onScreen = new Map([[map, true], [sys, true]]);
let lastMap = 0, lastSys = 0, lastActive = performance.now(), running = false;

function frame(now) {
  const visible = onScreen.get(map) || onScreen.get(sys);
  if (!visible || now - lastActive > IDLE_MS) { running = false; return; }
  if (onScreen.get(map) && now - lastMap >= MAP_MS) { drawMap(now); lastMap = now; }
  if (onScreen.get(sys) && now - lastSys >= SYSTEM_MS) { drawSystem(now / 1000); lastSys = now; }
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
  if (scene && !scene.mystery) layout();
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
    if (onScreen.get(map) || onScreen.get(sys)) wake();
  });
  watcher.observe(map);
  watcher.observe(sys);
}
drawMap(0);
drawSystem(0);
wake();
