// ---------------------------------------------------------------- connecting the pieces
// A daily mystery star (a riddle built from a real system's data, the same for everyone on a given day),
// "what's new" after each monthly data refresh, and a share card: your emblem, badges and stats as one
// pixel picture to download. (Calls on the next-planets list: callCell, 48b-predictions.js.)
const pad2 = n => String(n).padStart(2, '0');
const localDay = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const DAILY_POOL = STARS.filter(s => s[COL.drawn] && s[COL.np] >= 2 && s[COL.kois] > 0);
const dailyStar = (day = localDay()) => DAILY_POOL[Math.floor(hash('daily' + day) * DAILY_POOL.length)];

function dailyClues(s) {
  const i = starIndex.get(s), [x, y] = home[i], tags = s[COL.tags];
  const clues = [`${s[COL.np]} worlds orbit this star.`];
  if (s[COL.dist] != null) clues.push(`Its light takes about ${fmt(Math.round(s[COL.dist] * LY_PER_PC / 100) * 100)} years to reach us.`);
  if (tags & TAGS.hz) clues.push('One of its worlds may sit in the habitable zone.');
  else if (tags & TAGS.earth) clues.push('One of its worlds is about the size of Earth.');
  else if (tags & TAGS.giant) clues.push('A giant planet lives here.');
  if (TAGS.twosuns && tags & TAGS.twosuns) clues.push('It has two suns.');
  if (tags & TAGS.tess) clues.push('TESS saw it again, years after Kepler.');
  const v = y < MH / 3 ? 'top' : y > 2 * MH / 3 ? 'bottom' : 'middle', h = x < MW / 3 ? 'left' : x > 2 * MW / 3 ? 'right' : 'centre';
  clues.push(`Look in the ${v === 'middle' && h === 'centre' ? 'middle' : `${v} ${h}`} of the map.`);
  return clues;
}
function dailyCard() {
  const s = dailyStar(), solved = progress.daily.last === localDay();
  if (!s) return '';
  return `<div class="daily-card${solved ? ' on' : ''}">
    <b>★ MYSTERY STAR OF THE DAY${progress.daily.streak > 1 ? ` · STREAK ${progress.daily.streak}` : ''}</b>
    ${solved ? `<span>Solved: it was <b>${esc(s[COL.name])}</b>. A new one appears tomorrow.</span>`
      : `<ul>${dailyClues(s).map(c => `<li>${esc(c)}</li>`).join('')}</ul><span>Find it and open it on the map.</span>`}</div>`;
}
function dailyCheck(s) {   // from systemOpened
  const today = localDay();
  if (s !== dailyStar(today) || progress.daily.last === today) return;
  const d = new Date();
  d.setDate(d.getDate() - 1);
  progress.daily.streak = progress.daily.last === localDay(d) ? progress.daily.streak + 1 : 1;
  progress.daily.last = today;
  saveProgress();
  toast('rank', 'MYSTERY SOLVED', `${s[COL.name]} was the star of the day.${progress.daily.streak > 1 ? ` Streak: ${progress.daily.streak} days.` : ''}`,
        null, BADGES['DAILY SKY'].art);
  achieve('daily');
  if (progress.daily.streak >= 7) achieve('streak');
}

// ---- what's new since your last visit (after a monthly data refresh)
function whatsNew() {
  const before = progress.lastExport;
  if (before && before !== DATA.exported) {
    const rulings = Object.values(RULINGS.resolved).filter(r => r[1] > before);
    const mine = Object.keys(progress.calls).filter(k => RULINGS.resolved[k] && RULINGS.resolved[k][1] > before).length;
    const added = STARS.length - (progress.lastStars || STARS.length);
    const bits = rulings.length ? [`${plural(rulings.length, 'NASA ruling')} on candidates`] : [];
    if (added > 0) bits.push(`${plural(added, 'new system')} on the map`);
    if (mine) bits.push(`${mine} of your calls settled`);
    toast('badge', "WHAT'S NEW", `Fresh data from NASA (${niceDate(DATA.exported)})${bits.length ? `: ${bits.join(' · ')}` : ''}.`, null, ICONS.trophy);
  }
  if (progress.lastExport !== DATA.exported || progress.lastStars !== STARS.length) {
    progress.lastExport = DATA.exported;
    progress.lastStars = STARS.length;
    saveProgress();
  }
}

// ---- share card: a 240 x 135 pixel picture, saved at 4x
function shareCard() {
  const W = 240, H = 135, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d'), i = rankIndex();
  ctx.fillStyle = '#070b1a';
  ctx.fillRect(0, 0, W, H);
  for (let k = 0; k < 90; k++) { ctx.fillStyle = k % 7 ? '#1e2550' : '#4a5590'; ctx.fillRect(Math.floor(hash('sc' + k) * W), Math.floor(hash('sd' + k) * H), 1, 1); }
  ctx.fillStyle = '#ffd34d';
  ctx.fillRect(0, 0, W, 1); ctx.fillRect(0, H - 1, W, 1); ctx.fillRect(0, 0, 1, H); ctx.fillRect(W - 1, 0, 1, H);
  pixelText(ctx, 'KEPLER STAR MAP', 8, 7, '#ffd34d');
  drawArt(ctx, rankArt(i), 8, 18, 3, 1);   // the emblem, 48 x 48
  const n = ACHIEVEMENTS.filter(a => progress.ach[a.id]).length, s = predictionStats();
  const lines = [[`MY STAR: ${rankName(i)}`, '#ffd34d'], [`${n} / ${ACHIEVEMENTS.length} ACHIEVEMENTS`, '#c8d0ff'],
                 [`${EGGS.filter(e => progress.eggs[e.id]).length} / ${EGGS.length} EASTER EGGS`, '#c8d0ff'],
                 [`${fmt(gazeCount())} / ${fmt(STARS.length)} STAR SYSTEMS SEEN`, '#c8d0ff'],
                 [`${s.right} RIGHT CALLS OF ${s.right + s.wrong} SETTLED`, '#c8d0ff']];
  lines.forEach(([text, col], k) => pixelText(ctx, text, 64, 22 + k * 9, col));
  const badges = earnedBadges();
  badges.forEach((g, k) => drawArt(ctx, BADGES[g].art, 8 + k * 18, 74, 1, 1));
  progress.showcase.filter(id => progress.ach[id]).forEach((id, k) => drawArt(ctx, trophyFor(ACH.get(id)), 8 + k * 18, 96, 1, 1));
  pixelText(ctx, localDay(), W - 8 - textWidth(localDay()), H - 10, '#5a6a8a');
  pixelText(ctx, 'MED27-CODER.GITHUB.IO', 8, H - 10, '#5a6a8a');
  const big = document.createElement('canvas');
  big.width = W * 4; big.height = H * 4;
  const b = big.getContext('2d');
  b.imageSmoothingEnabled = false;
  b.drawImage(c, 0, 0, W * 4, H * 4);
  const a = document.createElement('a');
  a.href = big.toDataURL('image/png');
  a.download = `kepler-star-map-card-${localDay()}.png`;
  a.click();
}

queueMicrotask(whatsNew);
