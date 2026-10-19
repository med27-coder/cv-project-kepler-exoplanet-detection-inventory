// ---------------------------------------------------------------- the two models: Star Gazer and Colossus
// Searching "star gazer" opens the page of Star Gazer V3, the model that scored every candidate on the map;
// "colossus" opens its rival, Colossus 2, a giant-planet specialist that was tested as registered and NOT adopted
// (docs/star-gazer/V4B_RESULTS.md), shown here as EXPERIMENTAL. Finding each earns an achievement. Giant candidates'
// case files carry a switch between the two scores (export_starmap.py adds `cg` from
// scripts/pipeline/colossus_score_candidates.py); the map's colours, the next-planets list and the predictions game
// always use Star Gazer, the adopted model.
const MODEL_QUERY = /^(the )?(star ?gazer( v3)?|colossus( 2)?)( model| ai)?$/i;
const COLOSSUS_THRESHOLD = 0.5;   // as registered
const modelFor = q => { const m = MODEL_QUERY.exec(q); return m ? (/colossus/i.test(m[2]) ? 'colossus' : 'stargazer') : null; };
const modelPick = () => (progress.model === 'colossus' ? 'colossus' : 'stargazer');

// The two scores for a case file; the chosen one in bold.
function modelScores(p, pct) {
  const sg = `Star Gazer ${pct(p.sg)}`;
  if (p.cg == null) return sg;
  const cg = `Colossus ${pct(p.cg)} <span class="tag-exp">EXPERIMENTAL</span>`;
  return modelPick() === 'colossus' ? `<b>${cg}</b> · ${sg}` : `<b>${sg}</b> · ${cg}`;
}
function modelSwitchMarkup(detail) {
  if (!detail.planets.some(p => p.status === 'candidate' && p.cg != null)) return '';
  const pick = modelPick(), pressed = m => String(pick === m);
  return `<p class="model-switch">SCORES FROM:
    <button type="button" class="ghost" data-model="stargazer" aria-pressed="${pressed('stargazer')}">STAR GAZER</button>
    <button type="button" class="ghost" data-model="colossus" aria-pressed="${pressed('colossus')}">COLOSSUS · EXPERIMENTAL</button>
    <a href="#colossus">what is Colossus?</a></p>`;
}
function wireModelSwitch(root, rerender) {
  root.querySelectorAll('.model-switch button[data-model]').forEach(b => b.addEventListener('click', () => {
    if (progress.model === b.dataset.model) return;
    progress.model = b.dataset.model;
    saveProgress();
    rerender();
  }));
}

const MODELS = {
  stargazer: {
    title: 'STAR GAZER', big: '★ STAR GAZER V3 ★', hash: 'star-gazer', ach: 'meet-star-gazer', ink: '#ffd34d',
    intro: 'The AI behind this map. Star Gazer reads each Kepler signal the way an astronomer would, its light curve folded on the planet\'s orbit, close up on the transit, odd and even dips, any second eclipse and the star\'s wobble on the camera, together with the catalogue numbers, and says how likely it is to be a real planet. Every candidate\'s score here is its answer.',
    facts: [
      'Correct on 97.1% of the Kepler signals NASA has already ruled on (plus or minus 0.4), in a five-fold test where the stars it was tested on were never seen in training.',
      'It finds 96 to 100% of the confirmed small planets; giant planets are its weak spot, which is what Colossus tried to fix.',
      'Its design was frozen before it saw the test data, and three registered attempts to beat it have failed, so it stays the model.',
      'It colours the map, ranks the next planets, and is the one you compete with in the predictions game.',
      'A model output for learning, not a discovery: only follow-up observations confirm a planet.',
    ],
  },
  colossus: {
    title: 'COLOSSUS', big: '★ COLOSSUS · EXPERIMENTAL ★', hash: 'colossus', ach: 'meet-colossus', ink: '#ff9a3c',
    intro: 'Star Gazer\'s rival, a specialist for giant candidates (6 Earth radii and up), where eclipsing binary stars most often pass for planets. It is Star Gazer\'s network retrained with physics checks and then fine-tuned on giants only. It was tested exactly as registered in advance, and it was not adopted: it is shown here as an experiment, so you can compare.',
    facts: [
      'It found 86.4% of the confirmed giant planets at Star Gazer\'s false-alarm rate, against Star Gazer\'s 81.0%: better at ranking giants.',
      'But its probabilities run high: at 50% it calls binaries planets about three times as often as Star Gazer, so mixed into the whole system it lowered accuracy (96.69% against 97.02%) and failed its registered test.',
      'So treat its numbers as a second opinion on giants, not a verdict; for planets under 6 Earth radii it simply uses Star Gazer\'s answer.',
      'Giant candidates\' case files have a switch: SCORES FROM STAR GAZER or COLOSSUS.',
      'Its full story, numbers and lessons: docs/star-gazer/V4B_RESULTS.md in the project\'s repository.',
    ],
  },
};

function drawModelScene(m, seconds) {
  const t = REDUCED_MOTION ? 0 : seconds;
  sctx.fillStyle = '#070b1a'; sctx.fillRect(0, 0, SW, SH);
  for (let k = 0; k < 60; k++) {
    sctx.fillStyle = k % 6 ? '#1e2550' : '#4a5590';
    sctx.fillRect(Math.floor(hash(`md${k}`) * SW), Math.floor(hash(`me${k}`) * SH), 1, 1);
  }
  // a light curve scrolling past, with a transit the model is reading: small for Star Gazer, a deep giant's for Colossus
  const giant = m === MODELS.colossus, base = 70, depth = giant ? 26 : 9, period = 120;
  let prev = null;
  for (let x = 8; x < SW - 8; x++) {   // joined up, so the dip reads as one curve
    const ph = ((x + Math.floor(t * 30)) % period) - period / 2;
    const dip = Math.abs(ph) < 8 ? depth * Math.min(1, (8 - Math.abs(ph)) / (giant ? 2 : 4)) : 0;
    const y = Math.round(base + dip + (hash(`n${x + Math.floor(t * 30)}`) - 0.5) * 2);
    sctx.fillStyle = dip > 0 ? m.ink : '#9aa6d6';
    const top = prev == null ? y : Math.min(y, prev), bottom = prev == null ? y : Math.max(y, prev);
    sctx.fillRect(x, top, 1, bottom - top + 1);
    prev = y;
  }
  pixelText(sctx, giant ? 'COLOSSUS' : 'STAR GAZER', Math.round((SW - textWidth(giant ? 'COLOSSUS' : 'STAR GAZER')) / 2), 22, m.ink);
  const sub = giant ? 'EXPERIMENTAL - NOT ADOPTED' : 'V3 - THE MODEL OF RECORD';
  pixelText(sctx, sub, Math.round((SW - textWidth(sub)) / 2), 34, '#9aa6d6');
  const line = giant ? 'PLANET OR TWO STARS?' : 'PLANET OR NOT?';
  if (Math.floor(t) % 4 < 3) pixelText(sctx, line, Math.round((SW - textWidth(line)) / 2), SH - 40, '#e8ecff');
}

function showModel(id, updateHash = true) {
  const m = MODELS[id];
  selected = null;
  ++selectToken;
  title.textContent = m.title;
  info.innerHTML = `
    <p class="big">${esc(m.big)}</p>
    <p>${esc(m.intro)}</p>
    <h3 class="facts-title">${id === 'colossus' ? 'THE REGISTERED TEST' : 'HOW GOOD IT IS'}</h3>
    <ul class="facts">${m.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
    <p><a href="${id === 'colossus' ? '#star-gazer' : '#colossus'}">${id === 'colossus' ? 'meet Star Gazer, the model of record' : 'meet Colossus, the experimental rival'}</a></p>
    <p class="note">Both are model outputs for education, not discoveries or classifications · you found a hidden page!</p>`;
  setScene({ custom: seconds => drawModelScene(m, seconds) });
  achieve(m.ach);
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-current', 'false'));
  if (updateHash) history.replaceState(null, '', `#${m.hash}`);
}
