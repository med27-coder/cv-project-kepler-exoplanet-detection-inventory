// ---------------------------------------------------------------- Captain's Log (preview: add ?log to the address)
// The explorer's journal, built only from the dates the game already keeps (docs/plans/EXPLORER_JOURNEY.md B):
// achievements and easter eggs found, calls made and settled by NASA, the last daily mystery solved. Newest
// first. Nothing new is saved, and nothing appears for what hasn't been found, so the log can't spoil anything.
// The DISCOVERY TIMELINE is a view of the same log with the firsts only.
const LOG_PREVIEW = /[?&]log\b/.test(location.search);

function logEntries() {   // [{ date, kind, title, text, first }], newest first
  const out = [];
  for (const [id, date] of Object.entries(progress.ach)) {
    const a = ACH.get(id);
    if (a) out.push({ date, kind: 'ACHIEVEMENT', title: a.title, text: a.how, firsts: ['ach'] });
  }
  for (const [id, date] of Object.entries(progress.eggs)) {
    const e = EGG.get(id);
    if (e) out.push({ date, kind: 'EASTER EGG', title: e.name.toUpperCase(), text: `Found: ${e.toast}.`, firsts: ['egg'] });
  }
  for (const [koi, c] of Object.entries(progress.calls)) {
    if (!Array.isArray(c) || !CALL_WORD[c[0]] || !DATE.test(String(c[1]))) continue;
    const sg = CALL_WORD[c[2]];
    out.push({ date: c[1], kind: 'CALL', title: `${koi}: ${CALL_WORD[c[0]]}`,
               text: `${c[3] ? `In ${c[3]}. ` : ''}${sg ? `Star Gazer said ${sg}.` : 'Your own call.'}`, firsts: ['call'] });
    const o = callOutcome(koi);
    if (o.state === 'right' || o.state === 'wrong') {
      const days = Math.round((Date.parse(o.date) - Date.parse(c[1])) / 86_400_000);
      out.push({ date: o.date, kind: 'NASA RULED', title: `${koi}: ${o.ruling === 'confirmed' ? 'A PLANET' : 'NOT A PLANET'}`,
                 text: `${o.state === 'right' ? 'You called it' : 'Not this time'}, after ${days} day${days === 1 ? '' : 's'} of waiting.`,
                 firsts: o.state === 'right' ? ['settled', 'right'] : ['settled'] });
    }
  }
  if (DATE.test(progress.daily.last)) {
    out.push({ date: progress.daily.last, kind: 'MYSTERY STAR', title: 'MYSTERY STAR SOLVED',
               text: progress.daily.streak > 1 ? `A streak of ${progress.daily.streak} days.` : 'The star of the day.', firsts: [] });
  }
  // the order things happened on one day is not kept, so a day's entries go by kind, then title
  out.sort((a, b) => b.date.localeCompare(a.date) || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
  const seen = new Set();   // the oldest entry of each group is a first (a correct call's most telling word wins)
  for (let i = out.length - 1; i >= 0; i--) {
    for (const key of out[i].firsts) if (!seen.has(key)) { seen.add(key); out[i].first = FIRST_WORD[key]; }
  }
  return out;
}
const FIRST_WORD = { ach: 'FIRST ACHIEVEMENT', egg: 'FIRST EASTER EGG', call: 'FIRST CALL',
                     settled: 'FIRST CALL SETTLED', right: 'FIRST CORRECT CALL' };

let logFirstsOnly = false;
function renderLog() {
  const pane = document.getElementById('pane-log');
  const all = logEntries(), shown = logFirstsOnly ? all.filter(e => e.first) : all;
  pane.innerHTML = `
    <p class="gallery-progress"><b>${all.length}</b> ENTRIES · CAPTAIN'S LOG
      <button type="button" class="ghost" id="log-firsts" aria-pressed="${logFirstsOnly}">${logFirstsOnly ? 'SHOW EVERYTHING' : 'DISCOVERY TIMELINE'}</button></p>
    <p class="note">Your journey, newest first, from what you have found and called. A preview: it may change.</p>
    ${shown.length ? `<ol class="log">${shown.map(e => `<li class="log-entry">
        <span class="log-date">${esc(niceDate(e.date))}</span>
        <span class="log-kind">${esc(e.kind)}${e.first ? ` · ★ ${esc(e.first)}` : ''}</span>
        <b class="log-title">${esc(e.title)}</b>
        <span class="log-text">${esc(e.text)}</span></li>`).join('')}</ol>`
      : '<p class="status">Nothing logged yet: open a star system to begin.</p>'}`;
  pane.querySelector('#log-firsts').addEventListener('click', () => { logFirstsOnly = !logFirstsOnly; renderLog(); });
}

if (LOG_PREVIEW) {
  document.getElementById('tab-log').hidden = false;
}
