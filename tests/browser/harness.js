// In-page checks for the star map, run by tests/test_browser.py after all detail chunks are loaded.
// Writes PASS/FAIL lines into <pre id="results">; page errors are collected by the test itself.
(function () {

const out = [];
const ok = (name, cond, extra='') => out.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' :: ' + extra : ''));
const q = document.getElementById('query'), title = () => document.getElementById('sys-title').textContent;
try {
  q.value = 'kepler-9'; q.dispatchEvent(new Event('input'));
  const items = [...document.querySelectorAll('#suggest li')];
  ok('suggestions shown', !document.getElementById('suggest').hidden && items.length > 0, items.length + ' items: ' + items.slice(0,3).map(l=>l.firstChild.textContent.trim()).join(', '));
  q.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowDown'}));
  q.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter'}));
  ok('enter picks suggestion', title().startsWith('KEPLER-9'), title());
  q.value = 'koi 351'; q.dispatchEvent(new Event('input'));
  ok('koi suggestion', document.querySelector('#suggest li')?.textContent.includes('Kepler-90'), document.querySelector('#suggest li')?.textContent.trim());
  document.getElementById('search').dispatchEvent(new Event('submit', {cancelable:true}));
  ok('submit koi 351', title() === 'KEPLER-90', title());
  document.getElementById('random').click();
  ok('random picks drawn system', document.querySelector('#info table') !== null, title());
  document.getElementById('zoom-in').click(); document.getElementById('zoom-in').click();
  ok('zoom in x2 -> 4x', document.getElementById('zoom-level').textContent === '4×', document.getElementById('zoom-level').textContent);
  const map = document.getElementById('map');
  map.dispatchEvent(new KeyboardEvent('keydown', {key:'-', bubbles:true}));
  ok('minus key zooms out', document.getElementById('zoom-level').textContent === '2×', document.getElementById('zoom-level').textContent);
  map.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight', bubbles:true}));
  ok('arrow selects a star', title() !== '', title());
  const hb = [...document.querySelectorAll('#highlights button')];
  ok('6 highlight buttons', hb.length === 6, hb.map(b => b.textContent).join(' | '));
  hb[0].click();
  ok('highlight toggles on', hb[0].getAttribute('aria-pressed') === 'true');
  hb[0].click();
  ok('highlight toggles off', hb[0].getAttribute('aria-pressed') === 'false');
  q.value = '<img src=x onerror=alert(1)>'; document.getElementById('search').dispatchEvent(new Event('submit', {cancelable:true}));
  ok('unknown query escaped', title() === 'NO SIGNAL' && !document.querySelector('#info img[src="x"]'));
} catch (e) { out.push('EXCEPTION ' + e.message + ' ' + e.stack); }

try {
  location.hash = '#%E0%A4%A';   // malformed escape must not throw
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  ok('malformed hash ignored', true);
  q.value = 'x'.repeat(500); document.getElementById('search').dispatchEvent(new Event('submit', {cancelable:true}));
  ok('long query truncated', document.querySelector('#info p:nth-of-type(2)').textContent.length < 120);
  q.value = 'Kepler-90'; document.getElementById('search').dispatchEvent(new Event('submit', {cancelable:true}));
  ok('no inline style attributes rendered', document.querySelectorAll('#info [style], #suggest [style]').length === 0);
  ok('no inline event handlers rendered', [...document.querySelectorAll('#info *')].every(el => ![...el.attributes].some(a => a.name.startsWith('on'))));
} catch (e) { out.push('EXCEPTION ' + e.message); }


try {
  q.value = 'Kepler-90'; document.getElementById('search').dispatchEvent(new Event('submit', {cancelable:true}));
  const fig = document.querySelector('#info .sky'), img = fig.querySelector('img');
  const b = fig.querySelectorAll('button');
  ok('3 survey buttons', b.length === 3);
  b[2].click();
  ok('survey switch to 2MASS', img.src.toUpperCase().includes('2MASS') && b[2].getAttribute('aria-pressed') === 'true', img.src.slice(0, 120));
  q.value = 'Kepler-62'; document.getElementById('search').dispatchEvent(new Event('submit', {cancelable:true}));
  ok('survey choice kept', document.querySelector('#info .sky img').src.toUpperCase().includes('2MASS'));
  ok('star line has age', /billion years old/.test(document.querySelector('#info .head p').textContent), document.querySelector('#info .head p').textContent);
  ok('sunlight column', document.querySelectorAll('#info thead th').length === 8);
  const SM = window.STARMAP, C_ = Object.fromEntries(SM.columns.map((c, i) => [c, i]));
  const tessSys = SM.stars.find(s => s[C_.tags] & SM.tags.tess && s[C_.drawn])[C_.name];
  q.value = tessSys; document.getElementById('search').dispatchEvent(new Event('submit', {cancelable:true}));
  ok('TESS badge', document.querySelector('#info abbr.badge') !== null, tessSys);
  ok('NASA overview link', [...document.querySelectorAll('#info a')].some(a => a.href.startsWith('https://exoplanetarchive.ipac.caltech.edu/overview/')));
} catch (e) { out.push('EXCEPTION new ' + e.message + ' ' + e.stack); }

try {
  q.value = 'Kepler-37'; document.getElementById('search').dispatchEvent(new Event('submit', {cancelable:true}));
  const lvl = () => document.getElementById('sys-level').textContent;
  ok('system tools shown', !document.getElementById('sys-tools').hidden);
  document.getElementById('sys-in').click();
  ok('system zoom in', lvl() === '1.5×', lvl());
  document.getElementById('sys-fit').click();
  ok('fit changes zoom', lvl() !== '1.5×', lvl());
  const sc = document.getElementById('sys-scale'); sc.click();
  ok('true scale toggle', sc.getAttribute('aria-pressed') === 'true' && /True scale/.test(document.getElementById('sys-hint').textContent));
  const sys = document.getElementById('system');
  sys.dispatchEvent(new WheelEvent('wheel', {deltaY: -100, clientX: 10, clientY: 10, cancelable: true}));
  ok('wheel zooms system', lvl() === '1.25×', lvl());
  sys.dispatchEvent(new KeyboardEvent('keydown', {key: '0'}));
  ok('0 key fits', lvl() !== '1.25×', lvl());
  for (let i = 0; i < 40; i++) document.getElementById('sys-in').click();
  ok('deep zoom no crash', true, lvl());
  q.value = 'no such star'; document.getElementById('search').dispatchEvent(new Event('submit', {cancelable:true}));
  ok('tools hidden on NO SIGNAL', document.getElementById('sys-tools').hidden);
  sc.click();
} catch (e) { out.push('EXCEPTION sys ' + e.message + ' ' + e.stack); }

try {
  q.value = 'home'; document.getElementById('search').dispatchEvent(new Event('submit', {cancelable:true}));
  ok('easter egg: home', title() === 'THE SOLAR SYSTEM' && location.hash === '#Sun', title() + ' ' + location.hash);
  ok('easter egg: 8 planets', document.querySelectorAll('#info tbody tr').length === 8);
  q.value = 'Solar System'; document.getElementById('search').dispatchEvent(new Event('submit', {cancelable:true}));
  ok('easter egg: solar system', title() === 'THE SOLAR SYSTEM');
  q.value = 'sun'; q.dispatchEvent(new Event('input'));
  ok('easter egg hidden from type-ahead', document.getElementById('suggest').hidden || ![...document.querySelectorAll('#suggest li')].some(li => /solar/i.test(li.textContent)));
  ok('system tools on home', !document.getElementById('sys-tools').hidden);
  q.value = 'Kepler-90'; document.getElementById('search').dispatchEvent(new Event('submit', {cancelable:true}));
  ok('back to Kepler-90', title() === 'KEPLER-90');
} catch (e) { out.push('EXCEPTION egg ' + e.message + ' ' + e.stack); }

try {
  const SM = window.STARMAP, C_ = Object.fromEntries(SM.columns.map((c, i) => [c, i]));
  const unconf = SM.stars.find(s => !s[C_.drawn])[C_.name];
  q.value = unconf; document.getElementById('search').dispatchEvent(new Event('submit', {cancelable:true}));
  ok('unconfirmed system drawn with table', document.querySelector('#info table') !== null && /CROSS THE STARS|ENGINES|COURSE/.test(document.querySelector('#info .big').textContent), unconf);
  ok('case files shown', document.querySelectorAll('#info .cases li').length > 0);
  ok('system tools on unconfirmed', !document.getElementById('sys-tools').hidden);
  const hb = [...document.querySelectorAll('#highlights button')];
  ok('TESS highlight + leaderboard buttons', hb.some(b => /TESS/.test(b.textContent)) && hb.some(b => /next planets/.test(b.textContent)), hb.map(b => b.textContent).join(' | '));
  hb.find(b => /next planets/.test(b.textContent)).click();
  ok('leaderboard shown', title() === 'NEXT PLANETS' && document.querySelectorAll('#info tbody tr').length > 0);
  document.querySelector('#info button[data-name]').click();
  ok('leaderboard row opens system', title() !== 'NEXT PLANETS', title());
} catch (e) { out.push('EXCEPTION lazy ' + e.message + ' ' + e.stack); }

const pre = document.createElement('pre'); pre.id = 'results'; pre.textContent = out.join('\n'); document.body.appendChild(pre);
})();
