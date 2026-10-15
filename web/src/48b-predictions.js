// ---------------------------------------------------------------- predictions: call it before NASA does
// On any candidate's case file a visitor can call it, PLANET or NOT A PLANET. When NASA later confirms it
// or rules it a false positive (data/resolutions.js, recorded by each monthly export with the date it was
// first seen), the call is scored, but only if NASA ruled after the call was made. Calls are kept in this
// browser with the rest of the progress (and in the backup file). docs/plans/TATOOINE_AND_PROPHET.md
const RULINGS = window.STARMAP_RESOLUTIONS || { since: null, resolved: {} };
const KOI_ID = /^K\d{5}\.\d{2}$/;

function callOutcome(koi) {   // 'waiting' | 'early' (NASA ruled before the call) | 'right' | 'wrong'
  const c = progress.calls[koi], r = RULINGS.resolved[koi];
  if (!c || !r) return { state: 'waiting' };
  const planet = r[0] === 'confirmed';
  if (!(r[1] > c[1])) return { state: 'early', ruling: r[0], date: r[1] };
  return { state: (c[0] === 'planet') === planet ? 'right' : 'wrong', ruling: r[0], date: r[1],
           sgRight: c[2] ? (c[2] === 'planet') === planet : null };
}

const CALL_WORD = { planet: 'PLANET', not: 'NOT A PLANET' };
const OUTCOME_WORD = { waiting: 'waiting for NASA', early: 'NASA had already ruled', right: '✔ NASA agrees!', wrong: '✖ NASA ruled otherwise' };

// The "YOUR CALL" line on a candidate's case file (30-info.js).
function callMarkup(p, system) {
  if (p.status !== 'candidate' || !KOI_ID.test(p.koi)) return '';
  const c = progress.calls[p.koi];
  if (c) {
    return `<br><span class="call made">YOUR CALL: <b>${CALL_WORD[c[0]]}</b> · ${esc(niceDate(c[1]))} · ${OUTCOME_WORD[callOutcome(p.koi).state]}</span>`;
  }
  const sg = p.sg_planet === true ? 'planet' : p.sg_planet === false ? 'not' : '';
  return `<br><span class="call" data-koi="${esc(p.koi)}" data-system="${esc(system)}" data-sg="${sg}">YOUR CALL:
    <button type="button" class="ghost" data-call="planet">PLANET</button>
    <button type="button" class="ghost" data-call="not">NOT A PLANET</button></span>`;
}
// A compact call cell for the next-planets table (row: export_starmap.py leaderboard).
function callCell(row) {
  if (!KOI_ID.test(row.planet)) return '';
  const c = progress.calls[row.planet];
  if (c) return `<span class="call made"><b>${CALL_WORD[c[0]]}</b></span>`;
  const sg = row.sg == null ? '' : row.sg >= SG_THRESHOLD ? 'planet' : 'not';
  return `<span class="call" data-koi="${esc(row.planet)}" data-system="${esc(row.system)}" data-sg="${sg}">
    <button type="button" class="ghost" data-call="planet">PLANET</button>
    <button type="button" class="ghost" data-call="not">NOT</button></span>`;
}

function wireCalls(root) {
  root.querySelectorAll('.call[data-koi] button[data-call]').forEach(b => b.addEventListener('click', () => {
    const span = b.closest('.call'), koi = span.dataset.koi;
    progress.calls[koi] = [b.dataset.call, today(), span.dataset.sg, span.dataset.system];
    saveProgress();
    span.outerHTML = `<span class="call made">YOUR CALL: <b>${CALL_WORD[b.dataset.call]}</b> · saved · waiting for NASA
      (see ⚙ → PREDICTIONS)</span>`;
    checkPredictions();
  }));
}

function predictionStats() {
  const s = { calls: 0, waiting: 0, early: 0, right: 0, wrong: 0, sgRight: 0, sgWrong: 0, cassandra: 0, contrarian: 0, patience: 0 };
  for (const [koi, c] of Object.entries(progress.calls)) {
    s.calls++;
    const o = callOutcome(koi);
    s[o.state]++;
    if (o.state !== 'right' && o.state !== 'wrong') continue;
    if (o.sgRight === true) s.sgRight++;
    if (o.sgRight === false) s.sgWrong++;
    if (o.state === 'right' && o.sgRight === false) s.contrarian++;
    if (o.state === 'right' && c[0] === 'not' && c[2] === 'planet') s.cassandra++;
    if ((Date.parse(o.date) - Date.parse(c[1])) / 86_400_000 >= 365) s.patience++;
  }
  return s;
}
function checkPredictions() {   // achievements, and a pop-up for each call NASA has settled since last time
  const s = predictionStats();
  if (s.calls >= 1) achieve('first-call');
  if (s.right >= 1) achieve('prophet');
  if (s.right >= 5) achieve('seer');
  if (s.cassandra >= 1) achieve('cassandra');
  if (s.contrarian >= 3) achieve('contrarian');
  if (s.patience >= 1) achieve('patience');
  for (const koi of Object.keys(progress.calls)) {
    const o = callOutcome(koi);
    if ((o.state === 'right' || o.state === 'wrong') && !progress.notified.includes(koi)) {
      progress.notified.push(koi);
      saveProgress();
      toast('rank', 'NASA RULED', `${koi} is ${o.ruling === 'confirmed' ? 'a planet' : 'not a planet'}: ${
        o.state === 'right' ? 'you called it!' : 'not this time.'}`, null, BADGES.PREDICTIONS.art);
    }
  }
}

function renderPredictions() {
  const pane = document.getElementById('pane-pred'), s = predictionStats();
  const rows = Object.entries(progress.calls).sort((a, b) => b[1][1].localeCompare(a[1][1])).map(([koi, c]) => {
    const o = callOutcome(koi), r = RULINGS.resolved[koi];
    return `<tr class="${o.state}"><td>${esc(koi)}</td>
      <td><button type="button" class="linkish" data-name="${esc(c[3])}">${esc(c[3])}</button></td>
      <td>${CALL_WORD[c[0]]}</td><td>${esc(niceDate(c[1]))}</td><td>${c[2] ? CALL_WORD[c[2]] : '-'}</td>
      <td>${r ? `${esc(r[0])} · ${esc(niceDate(r[1]))}` : 'waiting'}</td>
      <td>${o.state === 'right' ? '✔' : o.state === 'wrong' ? '✖' : o.state === 'early' ? '(too late)' : ''}</td></tr>`;
  }).join('');
  const settled = s.right + s.wrong;
  pane.innerHTML = `
    <p>Call a candidate before NASA does: open a system with candidates (try 🏆 next planets) and choose
       <b>PLANET</b> or <b>NOT A PLANET</b> in its case files. When NASA confirms it or rules it a false positive,
       your call is scored here. It's a slow game: NASA settles a few Kepler candidates at a time.</p>
    <p class="gallery-progress"><b>${s.calls}</b> CALLS · <b>${s.right}</b> RIGHT · <b>${s.wrong}</b> WRONG · ${s.waiting} WAITING</p>
    ${settled ? `<p>You vs Star Gazer on the same settled calls: you <b>${s.right}/${settled}</b>, Star Gazer
      <b>${s.sgRight}/${s.sgRight + s.sgWrong}</b>.</p>` : ''}
    ${rows ? `<div class="table-wrap"><table>
      <thead><tr><th>Candidate</th><th>System</th><th>Your call</th><th>Called</th><th>Star Gazer</th><th>NASA</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>` : '<p class="status">No calls yet.</p>'}
    <p class="note">NASA's rulings are recorded by the site's monthly data refresh${RULINGS.since ? ` (since ${esc(niceDate(RULINGS.since))})` : ''},
      dated when they were first seen. A call counts only if NASA ruled after you made it. Calls are saved in this
      browser (keep a backup under SETTINGS).</p>`;
  pane.querySelectorAll('button[data-name]').forEach(b => b.addEventListener('click', () => {
    const star = byName.get(b.dataset.name.toLowerCase());
    if (star) { galleryDialog.close(); choose(star); }
  }));
}

queueMicrotask(checkPredictions);
