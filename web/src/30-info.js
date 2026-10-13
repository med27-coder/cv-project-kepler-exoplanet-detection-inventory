// ---------------------------------------------------------------- info panel
const title = document.getElementById('sys-title');
const info = document.getElementById('info');

// Every value written with innerHTML goes through esc() or fmt(); the data is our own export,
// but escaping everything means a bad or tampered data file still can't inject markup.
function esc(text) {
  return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const fmt = (v, d = 0) => (v == null ? '-' : Number(v).toLocaleString('en-US', { maximumFractionDigits: d }));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function skyLink(ra, dec) {
  const url = 'https://aladin.cds.unistra.fr/AladinLite/?target=' + encodeURIComponent(`${Number(ra)} ${Number(dec)}`) +
              '&fov=0.08&survey=' + encodeURIComponent('CDS/P/DSS2/color');
  return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">See the real sky here ↗</a>`;
}

// Real photos of the sky around the star, from three surveys (via CDS hips2fits), fetched on
// demand at 40×40 and shown pixelated: about 1 KB each, nothing stored with the page.
const SURVEYS = [
  ['DSS2', 'CDS/P/DSS2/color', 'Digitized Sky Survey (visible light, photographic plates)'],
  ['PS1', 'CDS/P/PanSTARRS/DR1/color-z-zg-g', 'Pan-STARRS DR1 (visible light, sharper and deeper)'],
  ['2MASS', 'CDS/P/2MASS/color', '2MASS (infrared: cool stars and dust glow)'],
];
let survey = 0;   // kept while browsing systems
function skyUrl(ra, dec, k) {
  return 'https://alasky.cds.unistra.fr/hips-image-services/hips2fits?hips=' + encodeURIComponent(SURVEYS[k][1]) +
         `&width=40&height=40&fov=0.04&projection=TAN&coordsys=icrs&ra=${Number(ra)}&dec=${Number(dec)}&format=jpg`;
}
function skyThumb(ra, dec) {
  const buttons = SURVEYS.map(([name, , about], k) =>
    `<button type="button" data-k="${k}" title="${esc(about)}" aria-pressed="${k === survey}">${esc(name)}</button>`).join('');
  return `<figure class="sky" data-ra="${Number(ra)}" data-dec="${Number(dec)}">
            <img src="${esc(skyUrl(ra, dec, survey))}" width="40" height="40" loading="lazy"
                 referrerpolicy="no-referrer" alt="Real sky photo around the star (${esc(SURVEYS[survey][0])})">
            <figcaption>real sky</figcaption><div class="surveys">${buttons}</div></figure>`;
}

// Survey buttons swap the photo; it hides if it can't load (offline, service down). Listeners,
// not inline handlers, so the Content Security Policy can forbid inline scripts.
function wireSkyThumbs() {
  info.querySelectorAll('.sky').forEach(fig => {
    const img = fig.querySelector('img');
    img.addEventListener('error', () => { fig.hidden = true; });
    fig.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      survey = Number(b.dataset.k);
      img.src = skyUrl(fig.dataset.ra, fig.dataset.dec, survey);
      img.alt = `Real sky photo around the star (${SURVEYS[survey][0]})`;
      fig.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    }));
  });
}

// A sentence about the star from its numbers (NASA's tables, Gaia via Berger et al. 2020).
function starLine(d) {
  const bits = [];
  if (d.spectype) bits.push(`type ${esc(d.spectype)}`);
  bits.push(`${fmt(d.teff)} K`, `${fmt(d.srad, 2)} × Sun's size`);
  if (d.smass != null) bits.push(`${fmt(d.smass, 2)} × Sun's mass`);
  if (d.age != null) bits.push(`~${fmt(d.age, 1)} billion years old`);
  if (d.met != null) bits.push(d.met > 0.1 ? 'metal-rich' : d.met < -0.1 ? 'metal-poor' : 'Sun-like metals');
  if (d.logg != null && d.logg < 3.9) bits.push(d.logg < 3.5 ? 'a giant star' : 'a subgiant (ageing)');
  if (d.dist_pc != null) bits.push(`${fmt(d.dist_pc * LY_PER_PC)} light-years away`);
  if (d.nstars > 1) bits.push(`one of ${fmt(d.nstars)} stars in the system`);
  return bits.join(' · ');
}

function nasaLink(host) {
  const url = 'https://exoplanetarchive.ipac.caltech.edu/overview/' + encodeURIComponent(host);
  return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">NASA overview ↗</a>`;
}

function statusText(p) {
  if (p.note) return esc(p.note);
  if (p.status === 'other') return esc(p.method);
  if (p.status === 'candidate' && p.sg != null) {
    return `candidate · Star Gazer ${fmt(Math.round(p.sg * 100))}% ${p.sg_planet ? 'planet' : '(likely false positive)'}`;
  }
  return esc(p.status);
}

function planetTable(detail) {
  const rows = detail.planets.map(p => {
    const cls = `${planetClass(p.teq)} ${STATUSES.has(p.status) ? p.status : ''}`;
    const mass = p.mass == null ? '-' : (p.mass_kind === 'estimated' ? '~' : '') + fmt(p.mass, 1);
    const tess = p.toi ? ` <abbr class="badge" title="Seen again by NASA's TESS mission as ${esc(p.toi)}">TESS</abbr>` : '';
    const ecc = p.ecc >= 0.1 ? ` <abbr class="badge" title="Oval orbit: eccentricity ${fmt(p.ecc, 2)}">e ${fmt(p.ecc, 2)}</abbr>` : '';
    return `
    <tr>
      <td><span class="dot ${cls}"></span>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.name)}</a>` : esc(p.name)}${tess}${ecc}</td>
      <td class="num">${fmt(p.radius, 1)}</td>
      <td class="num">${mass}</td>
      <td class="num">${fmt(p.period, 1)}</td>
      <td class="num">${fmt(p.teq)}</td>
      <td class="num">${p.insol == null ? '-' : fmt(p.insol, p.insol < 0.1 ? 4 : p.insol < 10 ? 2 : 0)}</td>
      <td>${statusText(p)}</td>
      <td class="num">${p.year == null ? '-' : esc(p.year)}</td>
    </tr>`;
  }).join('');
  return `
    <div class="table-wrap"><table>
      <thead><tr><th>Planet</th><th class="num">Size (Earths)</th><th class="num">Mass (Earths)</th>
        <th class="num">Year (days)</th><th class="num">Temp (K)</th><th class="num">Sunlight (vs Earth)</th>
        <th>Status</th><th class="num">Found</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

function showSystem(s, detail) {
  title.textContent = s[COL.name].toUpperCase();
  const count = k => detail.planets.filter(p => p.status === k).length;
  const parts = count('confirmed') ? [plural(count('confirmed'), 'confirmed planet')] : [];
  if (count('candidate')) parts.push(`${plural(count('candidate'), 'candidate')} (hollow)`);
  if (count('other')) parts.push(`${count('other')} more from NASA's planet list (◆)`);
  const links = [skyLink(detail.ra, detail.dec), ...(detail.host ? [nasaLink(detail.host)] : [])];
  info.innerHTML = `
    <div class="head">${skyThumb(detail.ra, detail.dec)}<div>
      <p>Star: ${starLine(detail)}</p>
      <p>${parts.join(' + ')} · ${links.join(' · ')}</p>
    </div></div>
    ${planetTable(detail)}
    <p class="note">~ mass estimated from size · green band = habitable zone (approx.) · bottom strip = the
      star's brightness as Kepler sees it: it dips when a planet crosses in front (dips exaggerated) ·
      planet looks are a guess from size and temperature · Kepler ID ${esc(detail.kepid)}</p>`;
  wireSkyThumbs();
  setScene(buildScene(detail));
}

function showSoon(s) {
  title.textContent = s[COL.name].toUpperCase();
  const line = SOON[Math.floor(hash(s[COL.name]) * SOON.length)];
  info.innerHTML = `
    <p class="big">✦ ${esc(line.toUpperCase())} ✦</p>
    <div class="head">${skyThumb(s[COL.ra], s[COL.dec])}
    <p>${esc(label(s))}. Only unconfirmed candidates orbit this star, so its pixel portrait is still in the hangar
       until Star Gazer has scored them.</p></div>
    <p>${skyLink(s[COL.ra], s[COL.dec])} · ${fmt(Object.keys(SYSTEMS).length)} systems are already drawn; try one above.</p>`;
  wireSkyThumbs();
  setScene({ mystery: true });
}

function showUnknown(query) {
  title.textContent = 'NO SIGNAL';
  info.innerHTML = `
    <p class="big alert">✖ NO SIGNAL</p>
    <p>Nothing called “${esc(query)}” in the Kepler field.</p>
    <p>Try <b>Kepler-90</b>, <b>KOI-351</b>, a KOI like <b>K00351.01</b> or a Kepler ID like <b>11442793</b>.</p>`;
  setScene(null);
  selected = null;
}
