// ---------------------------------------------------------------- the explorer profile (preview: add ?profile to the address)
// docs/plans/EXPLORER_JOURNEY.md D and D2: progress first, icons second. The header keeps "who am I, how far
// along": the rank emblem, its name, the bar, the count and the percentage; the badges and showcase trophies move
// here. The profile's status panel says what was earned last, the rarest find (by the game's own tiers: there are
// no player statistics), the closest achievement that isn't secret (so no spoilers) and the collection focus; then
// a bar for each group of achievements, where unfound secrets show only as "+ ?". Nothing new is saved.
function profilePreview() { return /[?&]profile\b/.test(location.search); }   // a declaration: safe at load

const TIER_RANK = { common: 0, rare: 1, epic: 2, secret: 3, legend: 4 };

function achievementGroups() {   // [{ name, earned, open, hidden }]: open = not secret; hidden = unfound secrets
  const groups = new Map();
  for (const a of ACHIEVEMENTS) {
    if (a.id === 'star-gazer') continue;   // the final mission has its own card
    const g = groups.get(a.g) || { name: a.g, earned: 0, open: 0, hidden: 0 };
    const on = Boolean(progress.ach[a.id]);
    if (on) g.earned++;
    if (!a.secret || on) g.open++;
    else g.hidden++;
    groups.set(a.g, g);
  }
  return [...groups.values()];
}

function suggestedNext() {   // the unearned, non-secret achievement closest to done (a counted one first)
  let best = null, bestShare = -1;
  for (const a of ACHIEVEMENTS) {
    if (progress.ach[a.id] || a.secret) continue;
    const p = achProgress(a), share = p && p[1] ? p[0] / p[1] : 0;
    if (share > bestShare) { best = { a, p }; bestShare = share; }
  }
  return best;
}

function profileStatus() {
  const earned = ACHIEVEMENTS.filter(a => progress.ach[a.id]);
  const byDate = [...earned].sort((x, y) => progress.ach[y.id].localeCompare(progress.ach[x.id]) || x.title.localeCompare(y.title));
  const rarest = [...earned].sort((x, y) => TIER_RANK[y.tier] - TIER_RANK[x.tier]
    || progress.ach[x.id].localeCompare(progress.ach[y.id]))[0] || null;
  // the focus: the group earned most in the last 30 days of play, or over all time
  const last = byDate[0] ? Date.parse(progress.ach[byDate[0].id]) : 0, tally = {};
  for (const a of earned) if (a.id !== 'star-gazer' && last - Date.parse(progress.ach[a.id]) <= 30 * 86_400_000) tally[a.g] = (tally[a.g] || 0) + 1;
  const focus = Object.entries(tally).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0];
  const dates = [...Object.values(progress.ach), ...Object.values(progress.eggs),
                 ...Object.values(progress.calls).map(c => (Array.isArray(c) ? c[1] : ''))].filter(d => DATE.test(String(d)));
  return { earned: earned.length, newest: byDate[0] || null, rarest, next: suggestedNext(), focus: focus ? focus[0] : '',
           since: dates.sort()[0] || '' };
}

function renderProfile() {
  const pane = document.getElementById('pane-profile');
  const i = rankIndex(), st = profileStatus(), total = ACHIEVEMENTS.length, pct = Math.round(100 * st.earned / total);
  const next = nextStage(), ps = predictionStats(), badges = earnedBadges();
  const showcase = progress.showcase.filter(id => progress.ach[id]);
  const tile = (value, label) => `<div class="dash-tile"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;
  const nextText = st.next ? st.next.a.title + (st.next.p ? ` · ${st.next.p[0]} / ${st.next.p[1]}` : '') : 'NOTHING LEFT IN SIGHT';
  pane.innerHTML = `
    <div class="profile-head">
      <canvas width="16" height="16" data-stage="${i}" class="profile-emblem" aria-hidden="true"></canvas>
      <div class="profile-rank">
        <b>${esc(rankName(i))}</b>
        <span class="profile-track" aria-hidden="true"><span class="profile-bar"></span></span>
        <span>${st.earned} / ${total} ACHIEVEMENTS · ${pct}%</span>
        <span class="note">${esc(STAGES[i].about)}${next ? ` Next: ${esc(next.stage.name)} in ${esc(plural(next.left, 'achievement'))}.` : ''}</span>
      </div>
    </div>
    <div class="dash" aria-label="Your status">
      ${tile(st.newest ? st.newest.title : 'NONE YET', 'NEWEST')}
      ${tile(st.rarest ? st.rarest.title : 'NONE YET', st.rarest ? `RAREST · ${TIERS[st.rarest.tier].name}` : 'RAREST')}
      ${tile(nextText, 'SUGGESTED NEXT')}
      ${tile(st.focus || 'NONE YET', 'COLLECTION FOCUS')}
    </div>
    <div class="dash" aria-label="Your journey">
      ${tile(String(progress.systems.length), 'SYSTEMS OPENED')}
      ${tile(`${seenStars.size} / ${gazeTotal()}`, 'STARS SEEN')}
      ${tile(ps.calls ? `${ps.right} / ${ps.right + ps.wrong}` : '0', ps.calls ? `CALLS RIGHT · ${ps.waiting} WAITING` : 'CALLS MADE')}
      ${tile(st.since ? niceDate(st.since) : 'TODAY', 'EXPLORING SINCE')}
    </div>
    <h3 class="profile-h">COLLECTION</h3>
    <ul class="profile-groups">${achievementGroups().map(g => `<li>
        <span class="profile-group">${esc(g.name)}</span>
        <span class="profile-track" aria-hidden="true"><span class="profile-bar" data-share="${g.earned / (g.open + g.hidden)}"></span></span>
        <span class="profile-count">${g.earned} / ${g.open}${g.hidden ? ' + ?' : ''}</span></li>`).join('')}</ul>
    <h3 class="profile-h">BADGES AND SHOWCASE</h3>
    <p class="profile-shelf">${badges.length || showcase.length
      ? badges.map(g => `<canvas width="16" height="16" data-badge="${esc(g)}" title="${esc(BADGES[g].name)}"></canvas>`).join('')
        + showcase.map(id => `<canvas width="16" height="16" data-trophy="${esc(id)}" title="${esc(ACH.get(id)?.title || '')}"></canvas>`).join('')
      : '<span class="status">A badge comes with every achievement of a group; pick showcase trophies in the collection.</span>'}</p>
    <p class="profile-links">
      <button type="button" class="ghost" data-go="ach">VIEW COLLECTION</button>
      <button type="button" class="ghost" data-go="log">CAPTAIN'S LOG</button>
      <button type="button" class="ghost" data-go="pred">PREDICTIONS</button></p>
    <p class="note">Your explorer profile. A preview: it may change.</p>`;
  pane.querySelector('.profile-head .profile-bar').style.width = `${pct}%`;
  pane.querySelectorAll('.profile-groups .profile-bar').forEach(b => { b.style.width = `${Math.round(100 * Number(b.dataset.share))}%`; });
  pane.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
    const tab = document.getElementById(`tab-${b.dataset.go}`);
    tab.hidden = false;
    tab.focus();
    showTab(b.dataset.go);
  }));
  paintRankArt(pane);
}

if (profilePreview()) {
  document.getElementById('tab-profile').hidden = false;
  document.body.classList.add('profile-preview');   // style.css: the header drops its badges and showcase
}
