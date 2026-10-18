// ---------------------------------------------------------------- the lost astronaut and their wardrobe
// The astronaut of LOST IN ORBIT (the empty system view, the UNIVERSE view's flare). Once caught, searching
// "astronaut" visits them. The 2nd visit always brings an outfit, so players learn the game; after that each
// visit rolls for one (at most every 15 minutes): rare finds, with the Texas cowboy hat (HOUSTON, WE HAVE A
// PROBLEM) the rarest. Outfits you own can be worn from the card; whichever they wear shows everywhere they
// appear. This part loads before 50-wiring.js, whose search can run while the page is still loading.
const ASTRONAUT = ['.www.', 'wooow', 'wooow', '.www.', 'wwwww', 'wwwww', '.w.w.', '.w.w.'];
// Hats: 7 x 4 art pixels over the helmet (the last row sits on the helmet's top).
const OUTFITS = [
  // common
  { id: 'party', tier: 'common', name: 'party hat', rows: ['...y...', '..ppp..', '..pyp..', '.ppppp.'],
    caption: 'Somewhere in the universe it is always somebody\'s birthday.' },
  { id: 'cap', tier: 'common', name: 'NASA cap', rows: ['.......', '..uuu..', '..uwu..', '.uuuuuu'],
    caption: 'Standard issue, for the off-duty hours.' },
  { id: 'chef', tier: 'common', name: 'chef\'s hat', rows: ['.WWWWW.', '.WWWWW.', '..WWW..', '..mmm..'],
    caption: 'Space food has come a long way since the tubes and cubes of the 1960s.' },
  { id: 'headphones', tier: 'common', name: 'headphones', rows: ['.......', '..kkk..', '.k...k.', '.r...r.'],
    caption: 'Sound needs air to travel; inside the helmet, the music plays just fine.' },
  { id: 'beanie', tier: 'common', name: 'knit beanie', rows: ['...W...', '..rrr..', '.rrrrr.', '.WWWWW.'],
    caption: 'Out in the shade, a spacesuit has to keep its wearer warm.' },
  // rare
  { id: 'tophat', tier: 'rare', name: 'top hat', rows: ['..kkk..', '..kkk..', '..rrr..', '.kkkkk.'],
    caption: 'Dressed for a very formal spacewalk.' },
  { id: 'pirate', tier: 'rare', name: 'pirate hat', rows: ['.......', '..kkk..', '.kkWkk.', 'kkkkkkk'],
    caption: 'No survey has detected a space pirate. Yet.' },
  { id: 'propeller', tier: 'rare', name: 'propeller beanie', rows: ['.rrkuu.', '...k...', '..ryu..', '.rryuu.'],
    caption: 'A propeller does nothing in empty space: Mars\'s helicopter Ingenuity needed the thin Martian air to fly.' },
  { id: 'graduate', tier: 'rare', name: 'graduation cap', rows: ['...y...', 'kkkkkky', '..kkk.y', '......y'],
    caption: 'Graduated in Computer Vision (ITAI 1378), with honours in drifting.' },
  { id: 'flowers', tier: 'rare', name: 'flower crown', rows: ['.......', '.......', '.p.y.r.', 'gpgygrg'],
    caption: 'The first flower grown in space bloomed on the space station in January 2016: a zinnia.' },
  // epic
  { id: 'wizard', tier: 'epic', name: 'wizard hat', rows: ['...v...', '..vvv..', '..vyv..', '.vvvvv.'],
    caption: 'Any sufficiently advanced technology is indistinguishable from magic (Arthur C. Clarke).' },
  { id: 'viking', tier: 'epic', name: 'Viking helmet', rows: ['i.....i', 'i.mmm.i', '.immmi.', '.mmmmm.'],
    caption: 'NASA\'s first Mars landers, in 1976, were called Viking.' },
  { id: 'santa', tier: 'epic', name: 'Santa hat', rows: ['.....rW', '..rrrr.', '.rrrr..', '.WWWWW.'],
    caption: 'On Christmas Eve 1968, Apollo 8 sent home a reading from lunar orbit.' },
  { id: 'halo', tier: 'epic', name: 'halo', rows: ['..yyy..', '.y...y.', '..yyy..', '.......'],
    caption: 'Halos around the Sun and Moon are real: ice crystals in high clouds bend the light.' },
  // legendary
  { id: 'cowboy', tier: 'legendary', name: 'Texas cowboy hat', rows: ['.......', '..bbb..', '..kkk..', 'bbbbbbb'],
    caption: 'Mission Control for NASA\'s crewed flights is in Houston, Texas: the rarest find in the wardrobe.' },
  // special: not dropped, given for DWARF KING
  { id: 'crown', tier: 'special', name: 'dwarf king\'s crown', needs: 'dwarf-king', rows: ['.......', '.y.y.y.', '.yyyyy.', '.yrybg.'],
    caption: 'Crowned by all five dwarf planets: you found them.' },
];
const OUTFIT_INK = { w: '#e6ecff', W: '#ffffff', o: '#ff9a3c', b: '#8a5a2b', k: '#1a1a24', y: '#ffd34d', p: '#ff6ec7',
                     r: '#e04a4a', g: '#4fd17a', u: '#3b8cff', v: '#8a5ad6', i: '#f0e6c8', m: '#9aa6b8' };
// The drop table (the per-visit odds are shown to players on the card)
const DROP_CHANCE = 0.5, DROP_COOLDOWN_MS = 15 * 60 * 1000, PITY_AFTER = 6;
const TIER_WEIGHTS = [['common', 0.60], ['rare', 0.28], ['epic', 0.09], ['legendary', 0.03]];
const TIER_WORD = { common: 'COMMON', rare: 'RARE', epic: 'EPIC', legendary: 'LEGENDARY', special: 'SPECIAL' };
const DROPPABLE = OUTFITS.filter(o => o.tier !== 'special');

const ASTRO_W = 21, ASTRO_H = 36;   // 7 x 12 art pixels at 3 x 3: hat rows on top of the 5 x 8 astronaut
const astronautCanvases = new Map();
function astronautSprite(outfitId = progress.outfit) {
  const outfit = OUTFITS.find(o => o.id === outfitId) || null, key = outfit ? outfit.id : '';
  if (!astronautCanvases.has(key)) {
    astronautCanvases.set(key, layer(ASTRO_W, ASTRO_H, put => {
      const art = (rows, x0, y0) => rows.forEach((row, r) => [...row].forEach((ch, c) => {
        if (ch === '.') return;
        for (let k = 0; k < 9; k++) put((x0 + c) * 3 + (k % 3), (y0 + r) * 3 + Math.floor(k / 3), OUTFIT_INK[ch]);
      }));
      art(ASTRONAUT, 1, 4);
      if (outfit) art(outfit.rows, 0, 1);
    }));
  }
  return astronautCanvases.get(key);
}
function drawAstronaut(ctx, x, y, angle, scale = 1) {   // rotated as one image, so it stays solid at every angle
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(angle);
  ctx.drawImage(astronautSprite(), -ASTRO_W / 2 * scale, -24 * scale, ASTRO_W * scale, ASTRO_H * scale);
  ctx.restore();
}

// ---- a visit: maybe a new outfit
function rollOutfit() {
  const owned = new Set(progress.outfits), unseen = list => list.filter(o => !owned.has(o.id));
  if (progress.astroDry >= PITY_AFTER) {   // bad-luck protection: something new, never the legendary hat
    const pool = unseen(DROPPABLE.filter(o => o.tier !== 'legendary'));
    if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
  }
  if (Math.random() >= DROP_CHANCE) return null;
  let r = Math.random(), tier = TIER_WEIGHTS[0][0];
  for (const [name, weight] of TIER_WEIGHTS) { if (r < weight) { tier = name; break; } r -= weight; }
  const inTier = DROPPABLE.filter(o => o.tier === tier), fresh = unseen(inTier);
  const pool = fresh.length ? fresh : inTier;
  return pool[Math.floor(Math.random() * pool.length)];
}
function visitAstronaut() {   // what this visit brings: { outfit, isNew, note }
  const now = Date.now(), day = new Date(now).toISOString().slice(0, 10);
  progress.astroVisits = (progress.astroVisits || 0) + 1;
  if (!progress.astroDays.includes(day)) progress.astroDays = [...progress.astroDays, day].slice(-30);
  const crown = OUTFITS.find(o => o.id === 'crown');
  if (progress.ach['dwarf-king'] && !progress.outfits.includes('crown')) return { outfit: crown, isNew: true };
  if (progress.astroVisits === 1) return { outfit: null, note: 'first' };
  let outfit = null;
  if (progress.astroVisits === 2) {   // always something on the 2nd visit, so the idea is clear
    const pool = DROPPABLE.filter(o => o.tier === 'common' && !progress.outfits.includes(o.id));
    outfit = pool[Math.floor(Math.random() * pool.length)] || DROPPABLE[0];
  } else if (now - (progress.astroLastRoll || 0) < DROP_COOLDOWN_MS) {
    return { outfit: null, note: 'soon' };
  } else {
    outfit = rollOutfit();
  }
  progress.astroLastRoll = now;
  const isNew = Boolean(outfit && !progress.outfits.includes(outfit.id));
  progress.astroDry = isNew ? 0 : (progress.astroDry || 0) + 1;
  return { outfit, isNew, note: outfit ? '' : 'nothing' };
}
function wardrobeAchievements() {
  const owned = OUTFITS.filter(o => progress.outfits.includes(o.id));
  if (owned.length) achieve('first-outfit');
  if (owned.some(o => o.tier === 'rare')) achieve('rare-threads');
  if (owned.some(o => o.tier === 'epic')) achieve('runway');
  if (owned.some(o => o.id === 'cowboy')) achieve('houston');
  if (owned.filter(o => o.tier !== 'special').length >= 7) achieve('walk-in-closet');
  if (DROPPABLE.every(o => progress.outfits.includes(o.id))) achieve('space-wardrobe');
  if (progress.astroDays.length >= 3) achieve('visiting-hours');
}

// "astronaut" (after LOST IN ORBIT): a visit.
const ASTRO_QUERY = /^(the )?(lost )?(astronaut|spaceman|spacewoman|lost in orbit)$/i;
function showAstronaut(updateHash = true) {
  const visit = visitAstronaut();
  if (visit.outfit) {
    progress.outfit = visit.outfit.id;
    if (!progress.outfits.includes(visit.outfit.id)) progress.outfits.push(visit.outfit.id);
  }
  saveProgress();
  wardrobeAchievements();
  selected = null;
  ++selectToken;
  title.textContent = 'LOST IN ORBIT';
  renderAstronautCard(visit);
  setScene({ custom: seconds => {
    const t = REDUCED_MOTION ? 0 : seconds;
    sctx.fillStyle = '#070b1a';
    sctx.fillRect(0, 0, SW, SH);
    for (let k = 0; k < 70; k++) {
      sctx.fillStyle = k % 6 ? '#1e2550' : '#4a5590';
      sctx.fillRect(Math.floor(hash('as' + k) * SW), Math.floor(hash('at' + k) * SH), 1, 1);
    }
    const cx = SW / 2 + 8 * Math.sin(t * 0.4), cy = SH / 2 + 4 * Math.cos(t * 0.3);
    sctx.fillStyle = '#4a5590';
    for (let k = 0; k < 30; k++) sctx.fillRect(Math.round(cx + 16 + k * 2), Math.round(cy + 14 + Math.sin(k / 3 + t * 1.5) * 3 + k * 0.5), 1, 1);
    drawAstronaut(sctx, cx, cy, t * 0.35, 2);
    const wearing = OUTFITS.find(o => o.id === progress.outfit);
    const label = wearing ? `${TIER_WORD[wearing.tier]}: ${wearing.name.toUpperCase().replace(/'/g, '')}` : 'NO OUTFIT YET';
    pixelText(sctx, label, Math.round((SW - textWidth(label)) / 2), SH - 14, wearing && wearing.tier === 'legendary' ? '#ffd34d' : '#c8d0ff');
  } });
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-current', 'false'));
  if (updateHash) history.replaceState(null, '', '#astronaut');
}

function renderAstronautCard(visit) {
  const wearing = OUTFITS.find(o => o.id === progress.outfit);
  const news = visit.note === 'first'
    ? 'They\'re just glad to see a friendly face. They have been rummaging through the supply crates, though: come back and see what turns up.'
    : visit.note === 'soon'
      ? `Still wearing ${wearing ? `the ${wearing.name}` : 'their plain suit'}. They're busy right now: come back in a little while.`
      : visit.note === 'wear'
        ? `Now wearing ${wearing ? `the <b>${esc(wearing.name)}</b>` : 'their plain suit'}.`
      : visit.note === 'nothing'
        ? `They tried something on, but went back to ${wearing ? `the ${wearing.name}` : 'the plain suit'}. Maybe next time.`
        : visit.isNew ? `New in the wardrobe: <b>${esc(visit.outfit.name)}</b> (${esc(TIER_WORD[visit.outfit.tier].toLowerCase())}). ${esc(visit.outfit.caption)}`
          : `The <b>${esc(visit.outfit.name)}</b> again: a favourite.`;
  const owned = OUTFITS.filter(o => progress.outfits.includes(o.id));
  const buttons = owned.map(o => `<button type="button" class="ghost outfit-pick" data-outfit="${esc(o.id)}"
      aria-pressed="${o.id === progress.outfit}">${esc(o.name)}</button>`).join(' ');
  info.innerHTML = `
    <p class="big">★ MISSION CONTROL, HOUSTON ★</p>
    <p>${news}</p>
    <p>Wardrobe: <b>${owned.filter(o => o.tier !== 'special').length} of ${DROPPABLE.length}</b> found.
       ${owned.length ? 'Choose what they wear:' : ''}</p>
    ${owned.length ? `<p class="outfit-picks">${buttons}<button type="button" class="ghost outfit-pick" data-outfit=""
      aria-pressed="${!progress.outfit}">plain suit</button></p>` : ''}
    <p class="note">Visit every so often: each visit (at most one every 15 minutes) has a 50% chance of an outfit.
      Of those: common 60%, rare 28%, epic 9%, legendary 3%. Six visits in a row with nothing new, and the next one
      brings something new. The real line from Apollo 13, on 13 April 1970, was "Houston, we've had a problem".</p>`;
  info.querySelectorAll('[data-outfit]').forEach(b => b.addEventListener('click', () => {
    progress.outfit = b.dataset.outfit;
    saveProgress();
    renderAstronautCard({ outfit: null, note: 'wear' });
  }));
}
