// ---------------------------------------------------------------- the lost astronaut and their outfits
// The astronaut of LOST IN ORBIT (the empty system view, the UNIVERSE view's flare). Once caught, searching
// "astronaut" shows them up close in the next outfit (HOUSTON, WE HAVE A PROBLEM; SPACE WARDROBE). This part
// loads before 50-wiring.js, whose search can run while the page is still loading (a #astronaut link).
const ASTRONAUT = ['.www.', 'wooow', 'wooow', '.www.', 'wwwww', 'wwwww', '.w.w.', '.w.w.'];
// Once found, searching "astronaut" dresses them in the next outfit (a hat over the helmet, 7 x 4 art pixels).
const OUTFITS = [
  { id: 'cowboy', name: 'Texas cowboy hat', rows: ['.......', '..bbb..', '..kkk..', 'bbbbbbb'],
    caption: 'Mission Control for NASA\'s crewed flights is in Houston, Texas, so a Stetson felt right.' },
  { id: 'party', name: 'party hat', rows: ['...y...', '..ppp..', '.pypyp.', '.......'],
    caption: 'Somewhere in the universe it is always somebody\'s birthday.' },
  { id: 'tophat', name: 'top hat', rows: ['..kkk..', '..kkk..', '..rrr..', '.kkkkk.'],
    caption: 'Dressed for a very formal spacewalk.' },
  { id: 'propeller', name: 'propeller beanie', rows: ['rrr.uuu', '...w...', '..rgu..', '.ryyur.'],
    caption: 'A propeller does nothing in empty space: Mars\'s helicopter Ingenuity needed the thin Martian air to fly.' },
  { id: 'pirate', name: 'pirate hat', rows: ['.......', '..kkk..', '.kkwkk.', 'kkkkkkk'],
    caption: 'No survey has detected a space pirate. Yet.' },
  { id: 'graduate', name: 'graduation cap', rows: ['.......', 'kkkkkkk', '..kkk.y', '......y'],
    caption: 'Graduated in Computer Vision (ITAI 1378), with honours in drifting.' },
  { id: 'crown', name: 'dwarf king\'s crown', needs: 'dwarf-king', rows: ['.......', '.y.y.y.', '.yyyyy.', '.yrybg.'],
    caption: 'Crowned by all five dwarf planets: you found them.' },
];
const OUTFIT_INK = { w: '#e6ecff', o: '#ff9a3c', b: '#8a5a2b', k: '#1a1a24', y: '#ffd34d', p: '#ff6ec7', r: '#e04a4a', g: '#4fd17a', u: '#3b8cff' };
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
// "astronaut" (after LOST IN ORBIT): the astronaut up close, in the next outfit.
const ASTRO_QUERY = /^(the )?(lost )?(astronaut|spaceman|spacewoman|lost in orbit)$/i;
function showAstronaut(updateHash = true) {
  const owned = OUTFITS.filter(o => !o.needs || progress.ach[o.needs]);
  const at = owned.findIndex(o => o.id === progress.outfit);
  const outfit = owned[(at + 1) % owned.length];
  progress.outfit = outfit.id;
  if (!progress.outfits.includes(outfit.id)) progress.outfits.push(outfit.id);
  saveProgress();
  if (outfit.id === 'cowboy') achieve('houston');
  if (OUTFITS.filter(o => !o.needs).every(o => progress.outfits.includes(o.id))) achieve('space-wardrobe');
  selected = null;
  ++selectToken;
  title.textContent = 'LOST IN ORBIT';
  const seen = OUTFITS.filter(o => progress.outfits.includes(o.id)).length;
  info.innerHTML = `
    <p class="big">★ MISSION CONTROL, HOUSTON ★</p>
    <p>Still drifting, still in good spirits. Today's outfit: <b>${esc(outfit.name)}</b>. ${esc(outfit.caption)}</p>
    <p>Search <b>astronaut</b> again for another outfit (${seen} of ${OUTFITS.length} found).</p>
    <p class="note">The real line from Apollo 13, on 13 April 1970, was "Houston, we've had a problem"; the 1995 film
      made it "we have".</p>`;
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
    const label = `OUTFIT: ${outfit.name.toUpperCase().replace(/'/g, '')}`;
    pixelText(sctx, label, Math.round((SW - textWidth(label)) / 2), SH - 14, '#ffd34d');
  } });
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-current', 'false'));
  if (updateHash) history.replaceState(null, '', '#astronaut');
}
