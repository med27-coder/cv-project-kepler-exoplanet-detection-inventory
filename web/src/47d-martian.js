// ---------------------------------------------------------------- easter egg: The Martian (a fan nod)
// Andy Weir's 2011 novel and the 2015 film: an astronaut left behind at the Ares 3 base on Acidalia Planitia grows
// potatoes to survive. Searching "martian man" opens a Mars farm in pixel art: the Hab, a glass biodome where potato
// rows grow through a whole crop while an astronaut tends them (in whatever outfit they wear, 47c-astronaut.js),
// solar panels and a rover. Watching a crop all the way to harvest earns SPACE FARMER. The Galleria card shows
// NASA's real work on farming Mars as references (no film stills: those are the studio's).
const MARTIAN_QUERY = /^(the )?martian man$/i;   // the only way in: the Galleria clue points to it
const CROP_MS = 60_000;   // one crop, sprout to harvest, in a minute of watching
let martianSince = 0, cropDone = false;

function drawMartianBase(ctx, w, h, t, growth) {
  const horizon = Math.round(h * 0.6);
  for (let y = 0; y < horizon; y++) {   // a butterscotch sky, paler near the ground
    const f = y / horizon;
    ctx.fillStyle = f < 0.35 ? '#c99a70' : f < 0.7 ? '#d8ac80' : '#e6c29a';
    ctx.fillRect(0, y, w, 1);
  }
  ctx.fillStyle = '#f6eedb';   // a small, pale Sun: Mars is half again as far out as Earth
  ctx.fillRect(Math.round(w * 0.82), Math.round(h * 0.12), 3, 3);
  for (let x = 0; x < w; x++) {   // far hills, then the rusty plain with rocks
    const hill = horizon - 3 - Math.round(4 * hash(`mh${x >> 3}`) + 2 * Math.sin(x / 9));
    ctx.fillStyle = '#9a5634';
    ctx.fillRect(x, hill, 1, horizon - hill);
  }
  ctx.fillStyle = '#b5623a';
  ctx.fillRect(0, horizon, w, h - horizon);
  for (let k = 0; k < 90; k++) {
    ctx.fillStyle = k % 3 ? '#9a4f2c' : '#7d3b20';
    ctx.fillRect(Math.floor(hash(`mr${k}`) * w), horizon + 2 + Math.floor(hash(`ms${k}`) * (h - horizon - 2)), k % 5 ? 1 : 2, 1);
  }
  const base = horizon + Math.round(h * 0.12);
  // the Hab: a squat white dome with an airlock and an antenna
  const hx = Math.round(w * 0.16), hw = Math.round(w * 0.2), hh = Math.round(h * 0.13);
  for (let dx = -hw / 2; dx <= hw / 2; dx++) {
    const top = Math.round(hh * Math.sqrt(1 - (2 * dx / hw) ** 2));
    ctx.fillStyle = dx > hw * 0.15 ? '#c4beb3' : '#ece8e0';
    ctx.fillRect(hx + dx, base - top, 1, top);
  }
  ctx.fillStyle = '#d9d4ca'; ctx.fillRect(hx - hw / 2 - 5, base - 7, 6, 7);   // airlock
  ctx.fillStyle = '#5d6878'; ctx.fillRect(hx - hw / 2 - 4, base - 5, 2, 5);
  ctx.fillStyle = '#8a8f9a'; ctx.fillRect(hx + 2, base - hh - 6, 1, 6); ctx.fillRect(hx + 1, base - hh - 6, 3, 1);
  // a pressurised tunnel to the biodome
  const dx0 = Math.round(w * 0.56), dr = Math.round(w * 0.2), dh = Math.round(h * 0.2);
  ctx.fillStyle = '#d9d4ca';
  ctx.fillRect(hx + hw / 2, base - 3, dx0 - dr - hx - hw / 2, 3);
  // the biodome: soil rows and potato plants under glass
  for (let r = 0; r < 3; r++) {
    const y = base - 2 - r * 4;
    const span = Math.round(dr * Math.sqrt(1 - ((r * 4 + 2) / dh) ** 2)) - 3;
    ctx.fillStyle = '#5a3a28';
    ctx.fillRect(dx0 - span, y, 2 * span, 2);
    for (let x = dx0 - span + 2; x < dx0 + span - 1; x += 4) {
      const g = Math.min(1, growth * (0.8 + 0.4 * hash(`pl${r}${x}`)));
      const tall = Math.round(g * 3);
      if (g < 0.08) continue;
      ctx.fillStyle = g < 0.4 ? '#7fd17a' : '#3f9a4a';
      ctx.fillRect(x, y - tall, 1, tall);
      if (g > 0.5) { ctx.fillRect(x - 1, y - tall + 1, 1, 1); ctx.fillRect(x + 1, y - tall + 1, 1, 1); }
      if (g > 0.85 && hash(`fl${r}${x}`) < 0.5) { ctx.fillStyle = '#f4f0ff'; ctx.fillRect(x, y - tall - 1, 1, 1); }   // flowers
    }
  }
  const walk = REDUCED_MOTION ? 0 : Math.sin(t * 0.35);   // the farmer walks the rows, kneeling now and then
  const kneel = !REDUCED_MOTION && Math.abs(Math.cos(t * 0.35)) > 0.97;
  drawAstronaut(ctx, dx0 + walk * (dr - 12), base - (kneel ? 6 : 9), 0, w >= 200 ? 2 / 3 : 1 / 3);   // smaller on the Galleria thumbnail
  for (let a = 0; a <= Math.PI; a += 0.02) {   // the glass: a faint fill and a bright rim with a highlight
    const x = Math.round(dx0 + dr * Math.cos(a)), y = Math.round(base - dh * Math.sin(a));
    ctx.fillStyle = a > 1.9 && a < 2.4 ? '#ffffff' : '#cfe8ff';
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.fillStyle = 'rgba(207, 232, 255, 0.10)';
  for (let y = base - dh; y < base; y++) {
    const span = Math.round(dr * Math.sqrt(Math.max(0, 1 - ((base - y) / dh) ** 2)));
    ctx.fillRect(dx0 - span, y, 2 * span, 1);
  }
  // solar panels and a rover
  const px = Math.round(w * 0.82);
  for (let k = 0; k < 3; k++) {
    ctx.fillStyle = '#2b3a7a'; ctx.fillRect(px + k * 9, base - 6, 7, 3);
    ctx.fillStyle = '#5a6a9a'; ctx.fillRect(px + k * 9, base - 6, 7, 1);
    ctx.fillStyle = '#8a8f9a'; ctx.fillRect(px + k * 9 + 3, base - 3, 1, 3);
  }
  const rx = Math.round(w * 0.36), ry = base + Math.round(h * 0.12);
  ctx.fillStyle = '#ece8e0'; ctx.fillRect(rx, ry - 6, 14, 4);
  ctx.fillStyle = '#9fd8ff'; ctx.fillRect(rx + 10, ry - 5, 3, 2);
  ctx.fillStyle = '#2a2a30'; for (const k of [1, 6, 11]) ctx.fillRect(rx + k, ry - 2, 3, 2);
  return { base, horizon };
}

function showMartian(updateHash = true) {
  selected = null;
  ++selectToken;
  martianSince = performance.now();
  cropDone = false;
  title.textContent = 'MARTIAN MAN';
  info.innerHTML = `
    <p class="big">★ A FARM ON MARS ★</p>
    <p>A nod to Andy Weir's 2011 novel and Ridley Scott's 2015 film: an astronaut left behind at the Ares 3 base on
       Acidalia Planitia grows potatoes to stay alive, and calls Earth through the real Pathfinder lander of 1997.
       Watch the farm long enough to bring in a crop.</p>
    <h3 class="facts-title">THE REAL SCIENCE</h3>
    <ul class="facts">
      <li>Martian soil holds perchlorates, salts that are toxic to people, found by NASA's Phoenix lander in 2008: a real
        Mars farm would have to wash them out first.</li>
      <li>In 2016, NASA's Kennedy Space Center and Florida Tech grew crops in simulated Martian soil (the Galleria has
        the photo).</li>
      <li>On the International Space Station, astronauts first ate lettuce grown in space (NASA's Veggie garden) in
        August 2015, two months before the film opened.</li>
      <li>A day on Mars, a sol, lasts 24 hours 39 minutes; the thin air is about 95% carbon dioxide.</li>
      <li>Pathfinder landed in Ares Vallis on 4 July 1997; its Sojourner was the first rover on another planet.</li>
    </ul>
    <p class="note">A fan reference, not affiliated with the book's or the film's makers. The drawing is pixel art; the
      pictures in the Galleria are NASA's · you found an easter egg!</p>`;
  setScene({ custom: seconds => {
    const elapsed = performance.now() - martianSince;
    const growth = (elapsed % CROP_MS) / CROP_MS;
    if (!cropDone && elapsed >= CROP_MS) { cropDone = true; achieve('space-farmer'); }
    sctx.imageSmoothingEnabled = false;
    drawMartianBase(sctx, SW, SH, REDUCED_MOTION ? 0 : seconds, REDUCED_MOTION ? 0.9 : growth);
    pixelText(sctx, 'ACIDALIA PLANITIA', 4, SH - 10, '#fff1d6');
    const sol = `SOL ${1 + Math.floor(elapsed / 3000)}`, crop = `CROP ${Math.round(growth * 100)}%`;
    pixelText(sctx, sol, 4, 4, '#5a2a14');
    pixelText(sctx, crop, SW - textWidth(crop) - 4, SH - 10, '#fff1d6');
  } });
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-current', 'false'));
  if (updateHash) history.replaceState(null, '', '#martian-man');
}
