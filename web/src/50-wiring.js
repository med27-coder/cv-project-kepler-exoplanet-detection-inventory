// ---------------------------------------------------------------- wiring
const input = document.getElementById('query');
const suggest = document.getElementById('suggest');
document.getElementById('search').addEventListener('submit', e => {
  e.preventDefault();
  closeSuggestions();
  lookup(input.value);
});

// Type-ahead: system names and KOI numbers, spotlight and drawn systems first.
const searchIndex = STARS.map(s => ({
  s,
  keys: [s[COL.name].toLowerCase(), ...(s[COL.koi] != null ? [`koi-${s[COL.koi]}`] : [])],
  rank: s[COL.spot] ? 0 : s[COL.drawn] ? 1 : 2,
}));
let options = [], active = -1;

function closeSuggestions() {
  suggest.hidden = true;
  input.setAttribute('aria-expanded', 'false');
  input.removeAttribute('aria-activedescendant');
  options = []; active = -1;
}

function showSuggestions() {
  let q = input.value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (/^koi\s*\d/.test(q)) q = q.replace(/^koi\s*-?\s*/, 'koi-');
  if (/^kepler\s*\d/.test(q)) q = q.replace(/^kepler\s*-?\s*/, 'kepler-');
  if (q.length < 2) {   // empty box: the systems you viewed last
    const recent = q ? [] : [...progress.systems].reverse().map(n => byName.get(n.toLowerCase())).filter(Boolean).slice(0, 5);
    if (!recent.length) { closeSuggestions(); return; }
    renderSuggestions(recent, 'recently viewed');
    return;
  }
  const starts = [], contains = [];
  for (const item of searchIndex) {
    if (item.keys.some(k => k.startsWith(q))) starts.push(item);
    else if (item.keys.some(k => k.includes(q))) contains.push(item);
  }
  const byRank = (a, b) => a.rank - b.rank ||
    a.s[COL.name].localeCompare(b.s[COL.name], 'en', { numeric: true });
  const eggs = EGGS.filter(e => progress.eggs[e.id] && (e.name.toLowerCase().includes(q) || e.query.toLowerCase().includes(q)))
    .slice(0, 3).map(egg => ({ egg }));   // easter eggs you've found are easy to revisit
  renderSuggestions([...eggs, ...[...starts.sort(byRank), ...contains.sort(byRank)].map(item => item.s)].slice(0, 8));
}

function renderSuggestions(list, note) {
  options = list;
  if (!options.length) { closeSuggestions(); return; }
  active = -1;
  suggest.innerHTML = options.map((s, i) => (s.egg ? `
    <li role="option" id="opt-${i}" data-i="${i}">${esc(s.egg.name)}<span>★ easter egg you found</span></li>` : `
    <li role="option" id="opt-${i}" data-i="${i}">${esc(s[COL.name])}
      <span>${note ? esc(note) : `${s[COL.koi] != null && !s[COL.name].startsWith('KOI') ? `KOI-${fmt(s[COL.koi])} · `.replace(/,/g, '') : ''}${
        s[COL.drawn] ? plural(s[COL.np], 'planet') : plural(s[COL.np], 'candidate')}`}</span></li>`)).join('');
  suggest.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

function setActive(i) {
  active = (i + options.length) % options.length;
  if (!options[active].egg) prefetch(options[active]);
  suggest.querySelectorAll('li').forEach((li, k) => li.setAttribute('aria-selected', String(k === active)));
  input.setAttribute('aria-activedescendant', `opt-${active}`);
}

function choose(s) {
  if (s.egg) { input.value = s.egg.query; closeSuggestions(); lookup(s.egg.query); return; }
  input.value = s[COL.name];
  closeSuggestions();
  select(s);
}

input.addEventListener('input', () => {   // emojis typed or pasted into the search box disappear at once
  const clean = noEmoji(input.value);
  if (clean !== input.value) {
    const at = noEmoji(input.value.slice(0, input.selectionStart ?? input.value.length)).length;
    input.value = clean;
    input.setSelectionRange(at, at);
  }
  showSuggestions();
});
input.addEventListener('focus', showSuggestions);
input.addEventListener('keydown', e => {
  if (suggest.hidden) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
  else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(options[active]); }
  else if (e.key === 'Escape') closeSuggestions();
});
input.addEventListener('blur', () => setTimeout(closeSuggestions, 150));
suggest.addEventListener('mousedown', e => {   // mousedown fires before the input's blur
  const li = e.target.closest('li');
  if (li) { e.preventDefault(); choose(options[Number(li.dataset.i)]); }
});

// Surprise me: a random drawn system.
const drawnStars = STARS.filter(s => s[COL.drawn]);
document.getElementById('random').addEventListener('click', () => {
  achieve('dice');
  choose(drawnStars[Math.floor(Math.random() * drawnStars.length)]);
});

// Highlight toggles under the map.
const highlightBox = document.getElementById('highlights');
for (const [key, [name]] of Object.entries(HIGHLIGHTS)) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'chip'; b.dataset.key = key;
  b.setAttribute('aria-pressed', 'false');
  b.textContent = `${name} (${fmt(highlightSets[key].size)})`;
  b.addEventListener('click', () => {
    highlight = highlight === key ? null : key;
    if (highlight === 'hz') achieve('goldilocks');
    if (highlight) highlightTried(highlight);
    highlightBox.querySelectorAll('button').forEach(x =>
      x.setAttribute('aria-pressed', String(x.dataset.key === highlight)));
    renderBase();
  });
  highlightBox.appendChild(b);
}
const board = document.createElement('button');
board.type = 'button'; board.className = 'chip';
board.innerHTML = `${iconCanvas('trophy')} next planets`;   // pixel trophy (49c-ui.js)
board.addEventListener('click', showLeaderboard);
highlightBox.appendChild(board);

const chips = document.getElementById('chips');
for (const name of SPOTLIGHT) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'chip'; b.textContent = name; b.dataset.name = name;
  b.addEventListener('click', () => { input.value = name; lookup(name); });
  chips.appendChild(b);
}

document.getElementById('legend-sg').hidden = !DATA.scored;
document.getElementById('exported').textContent = `Exported ${DATA.exported}.`;

function fromHash() {
  let q;
  try {
    q = decodeURIComponent(location.hash.slice(1)).slice(0, MAX_QUERY);
  } catch {
    return;   // malformed %-escape in a hand-edited link: ignore it
  }
  const [name, query = ''] = q.split('?');
  const params = new URLSearchParams(query);
  pendingView = { view: params.get('view'), zoom: params.get('zoom'), edge: params.get('edge') };
  if (query) achieve('link');
  if (name) { input.value = name; lookup(name, false); }
}
window.addEventListener('hashchange', fromHash);
renderBase();
fromHash();
