// ---------------------------------------------------------------- Galleria: the easter-egg game
// The ⚙ button opens the Galleria. Every easter egg starts as a black silhouette with a question mark,
// its name blanked out and a clue underneath; typing the right name in the search bar finds it: the
// drawing glows, a pop-up appears in the corner, and its card in the Galleria shows the pixel art next
// to the real thing (web/gallery/, credits in data/gallery.js) with its story. Achievements reward
// exploring the rest of the page. Progress lives only in this browser (localStorage).
const EGGS = [
  { id: 'sun', name: 'Solar System', kind: 'sun', ref: 'pale-blue-dot', query: 'Solar System', toast: 'HOME SWEET HOME',
    clue: 'Eight worlds circle me, and on one of them, someone is reading this.',
    story: 'The Sun and its planets formed about 4.6 billion years ago from a collapsing cloud of gas and dust. It is the only system we know of with life, and the only one Kepler could never see: its view looked away from home.' },
  { id: 'pluto', name: 'Pluto', kind: 'pluto', ref: 'pluto', query: 'Pluto', toast: 'DWARF PLANET DISCOVERED',
    clue: 'A planet for 76 years, then demoted. I still wear a heart.',
    story: 'Clyde Tombaugh found Pluto in 1930 at Lowell Observatory by comparing photographs night after night. In 2006 the IAU made it a dwarf planet. In July 2015 New Horizons flew past and found mountains of water ice and a heart-shaped plain of nitrogen ice, Tombaugh Regio.' },
  { id: 'kepler', name: 'Kepler', kind: 'kepler', ref: 'kepler', query: 'Kepler', toast: 'PLANET HUNTER AWAKENED',
    clue: 'I stared at one patch of sky for four years. Every pixel on this map is a star I watched. (I may be hiding on the map.)',
    story: 'Launched in March 2009, Kepler watched about 150,000 stars in Cygnus and Lyra for the tiny dips of passing planets. When two of its four reaction wheels failed, engineers balanced it against sunlight for the K2 mission. It ran out of fuel in 2018; its last command, on 15 November, was a "goodnight".' },
  { id: 'iss', name: 'International Space Station', kind: 'craft', art: 'iss', ref: 'iss', query: 'ISS', toast: 'CREW ABOARD',
    clue: 'Sixteen sunrises a day, and people have lived inside me since the year 2000.',
    story: 'Built in orbit from 1998 by the space agencies of the United States, Russia, Europe, Japan and Canada, piece by piece over dozens of launches. Crews have lived aboard without a break since November 2000, and it is big enough to see from the ground with your own eyes.' },
  { id: 'voyager', name: 'Voyager', kind: 'craft', art: 'voyager', ref: 'voyager', query: 'Voyager', toast: 'INTERSTELLAR SIGNAL',
    clue: 'Twins launched in 1977, each carrying a golden record, now whispering from beyond the Sun\'s bubble.',
    story: 'The Voyagers rode a rare line-up of the outer planets on a "Grand Tour": Voyager 2 is still the only spacecraft to visit Uranus and Neptune. Each carries a Golden Record of sounds and pictures of Earth. Voyager 1 entered interstellar space in 2012 and Voyager 2 in 2018; their signals take most of a day to reach us.' },
  { id: 'newHorizons', name: 'New Horizons', kind: 'craft', art: 'newHorizons', ref: 'new-horizons', query: 'New Horizons', toast: 'KUIPER BELT REACHED',
    clue: 'I flew past a heart in 2015 and a snowman on New Year\'s Day 2019.',
    story: 'Launched in January 2006, the fastest launch of any spacecraft at the time, New Horizons reached Pluto in July 2015 after nine and a half years. On 1 January 2019 it flew past Arrokoth, a two-lobed "snowman" in the Kuiper Belt. It carries some of the ashes of Clyde Tombaugh, who discovered Pluto.' },
  { id: 'jwst', name: 'James Webb Space Telescope', kind: 'craft', art: 'jwst', ref: 'jwst', query: 'JWST', toast: 'PARKED AT L2',
    clue: 'Eighteen golden eyes behind a parasol the size of a tennis court, a million and a half kilometres from home.',
    story: 'Launched on Christmas Day 2021 by NASA, ESA and the Canadian Space Agency, Webb unfolded its 6.5 m mirror of 18 gold-coated hexagons and its five-layer sunshield on the way to Sun-Earth L2. It sees infrared light: the first galaxies, newborn stars and the air of exoplanets.' },
  { id: 'euclid', name: 'Euclid', kind: 'craft', art: 'euclid', ref: 'euclid', query: 'Euclid', toast: 'DARK UNIVERSE MAPPED',
    clue: 'Named after the father of geometry, I measure the shape of the dark universe.',
    story: 'ESA\'s Euclid launched in July 2023 to Sun-Earth L2. It is mapping billions of galaxies across a third of the sky to learn how dark matter and dark energy shaped the universe.' },
  { id: 'soho', name: 'SOHO', kind: 'craft', art: 'soho', ref: 'soho', query: 'SOHO', toast: 'SUN WATCHER ONLINE',
    clue: 'Built to watch the Sun for two years, I\'m still at it, and I have found thousands of comets by accident.',
    story: 'The Solar and Heliospheric Observatory (ESA and NASA) launched in December 1995 to Sun-Earth L1. Planned for two years, it has watched the Sun for decades, and its pictures have revealed more than 5,000 comets, most of them spotted by volunteers.' },
  { id: 'parker', name: 'Parker Solar Probe', kind: 'craft', art: 'parker', ref: 'parker-solar-probe', query: 'Parker Solar Probe', toast: 'TOUCHED THE SUN',
    clue: 'The first spacecraft named after a living person. I fly through the Sun\'s atmosphere.',
    story: 'Launched in 2018 and named after solar physicist Eugene Parker, who came to watch. On 24 December 2024 it passed about 6.1 million km from the Sun\'s surface at around 690,000 km/h, the fastest any human-made object has ever gone, protected by its carbon heat shield.' },
  { id: 'solarOrbiter', name: 'Solar Orbiter', kind: 'craft', art: 'solarOrbiter', ref: 'solar-orbiter', query: 'Solar Orbiter', toast: 'OVER THE POLES',
    clue: 'Venus keeps pushing me higher, so I can see the Sun\'s poles.',
    story: 'ESA and NASA\'s Solar Orbiter launched in 2020. Flybys of Venus tilt its orbit out of the planets\' plane, and in 2025 it sent back the first pictures ever taken of the Sun\'s poles.' },
  { id: 'bepi', name: 'BepiColombo', kind: 'craft', art: 'bepi', ref: null, query: 'BepiColombo', toast: 'MERCURY BOUND',
    clue: 'Two orbiters, one ride, heading for the smallest planet.',
    story: 'ESA and Japan\'s JAXA launched BepiColombo in 2018 with two orbiters stacked together, using flybys of Earth, Venus and Mercury itself to slow down enough to stay at Mercury. It is named after Giuseppe "Bepi" Colombo, who worked out how Mariner 10 could fly past Mercury three times.',
    link: 'https://www.esa.int/Science_Exploration/Space_Science/BepiColombo' },
  { id: 'juno', name: 'Juno', kind: 'craft', art: 'juno', ref: 'juno', query: 'Juno', toast: 'JOVIAN ORBIT',
    clue: 'Named after a goddess who could see through clouds, I circle the king of the planets.',
    story: 'Launched in 2011, Juno reached Jupiter in July 2016 and swoops over its poles, peering under the clouds, mapping giant polar cyclones and, later, the volcanoes of Io. It was the first solar-powered spacecraft to work at Jupiter.' },
  { id: 'clipper', name: 'Europa Clipper', kind: 'craft', art: 'clipper', ref: 'europa-clipper', query: 'Europa Clipper', toast: 'OCEAN WORLD BOUND',
    clue: 'NASA\'s biggest planetary explorer, off to study an ocean hidden under ice.',
    story: 'Launched in October 2024, Europa Clipper spans more than 30 m with its solar arrays, the largest NASA has built for a planetary mission. From 2030 it will fly past Jupiter\'s moon Europa dozens of times to find out whether the ocean under its ice could support life.' },
  { id: 'juice', name: 'JUICE', kind: 'craft', art: 'juice', ref: null, query: 'JUICE', toast: 'ICY MOONS AHEAD',
    clue: 'Three icy moons are on my list, and I plan to settle around the biggest.',
    story: 'ESA\'s Jupiter Icy Moons Explorer launched in April 2023. After reaching Jupiter in 2031 it will study Europa, Callisto and Ganymede, then become the first spacecraft to orbit a moon of another planet: Ganymede.',
    link: 'https://www.esa.int/Science_Exploration/Space_Science/Juice' },
  { id: 'lucy', name: 'Lucy', kind: 'craft', art: 'lucy', ref: 'lucy', query: 'Lucy', toast: 'TROJAN TOUR',
    clue: 'Named after a famous fossil (itself named after a Beatles song), I visit the asteroids that share Jupiter\'s orbit.',
    story: 'Launched in October 2021, Lucy is touring the Trojan asteroids, fossils of planet formation that lead and trail Jupiter around the Sun; that is why it shares its name with the Lucy fossil. Its two round solar arrays are each about 7 m across.' },
  { id: 'psyche', name: 'Psyche', kind: 'craft', art: 'psyche', ref: 'psyche', query: 'Psyche', toast: 'METAL WORLD BOUND',
    clue: 'My engines glow blue, and my destination may be the metal heart of a broken planet.',
    story: 'Launched in October 2023 on a Falcon Heavy, Psyche pushes itself with electric Hall thrusters that glow blue. It is on its way to asteroid 16 Psyche, which may be the exposed metal core of an early planet, arriving in 2029.' },
  { id: 'apex', name: 'OSIRIS-APEX', kind: 'craft', art: 'apex', ref: 'osiris-apex', query: 'OSIRIS-APEX', toast: 'SAMPLE RETURNED',
    clue: 'I brought a piece of an asteroid home, then changed my name and chased another.',
    story: 'As OSIRIS-REx it touched asteroid Bennu in 2020 and dropped its sample in the Utah desert on 24 September 2023. Renamed OSIRIS-APEX, it is heading for asteroid Apophis, arriving in 2029 just after Apophis passes very close to Earth.' },
  { id: 'mro', name: 'Mars Reconnaissance Orbiter', kind: 'craft', art: 'mro', ref: 'mars-reconnaissance-orbiter', query: 'MRO', toast: 'IN MARS ORBIT',
    clue: 'From orbit, I photographed a rover\'s parachute on its way down.',
    story: 'Mars Reconnaissance Orbiter has circled Mars since 2006. Its HiRISE camera sees details the size of a desk; it photographed Curiosity hanging from its parachute in 2012, and it relays much of the rovers\' data to Earth.' },
  { id: 'odyssey', name: 'Mars Odyssey', kind: 'craft', art: 'odyssey', ref: 'mars-odyssey', query: 'Mars Odyssey', toast: 'LONG ODYSSEY',
    clue: 'Named after a science-fiction film, I became the longest-working spacecraft at another planet.',
    story: '2001 Mars Odyssey, named after Arthur C. Clarke\'s "2001: A Space Odyssey", reached Mars in October 2001. It found signs of water ice just under the surface and relayed messages for rovers and landers for over two decades.' },
  { id: 'mex', name: 'Mars Express', kind: 'craft', art: 'mex', ref: 'mars-express', query: 'Mars Express', toast: 'EUROPE AT MARS',
    clue: 'Europe\'s first mission to another planet. I lost my lander, and found it again 11 years later.',
    story: 'ESA\'s Mars Express arrived in December 2003. It has mapped Mars in 3D, and its radar found signs of liquid water under the south polar ice. Its lander, Beagle 2, went silent; in 2015 it was spotted on the surface, almost fully unfolded.' },
  { id: 'tgo', name: 'ExoMars', kind: 'craft', art: 'tgo', ref: 'trace-gas-orbiter', query: 'ExoMars', toast: 'SNIFFING MARS',
    clue: 'I sniff the Martian air for traces of methane.',
    story: 'The ExoMars Trace Gas Orbiter, built by ESA and Roscosmos, arrived in 2016 to measure rare gases such as methane in Mars\'s atmosphere, and relays data from NASA\'s rovers.' },
  { id: 'curiosity', name: 'Curiosity', kind: 'craft', art: 'curiosity', ref: 'curiosity', query: 'Curiosity', toast: 'WHEELS ON MARS',
    clue: 'A car-sized laboratory that played "Happy Birthday" to itself on another planet.',
    story: 'Lowered into Gale Crater by a rocket-powered "sky crane" on 6 August 2012, Curiosity showed that the crater once held a lake that could have supported microbes, and has been climbing Mount Sharp ever since. On its first anniversary it hummed "Happy Birthday" with its sample instrument.' },
  { id: 'perseverance', name: 'Perseverance', kind: 'craft', art: 'perseverance', ref: 'perseverance', query: 'Perseverance', toast: 'LIFTOFF ON MARS',
    clue: 'I collect rock samples in tubes, and I brought a little helicopter along.',
    story: 'Perseverance landed in Jezero Crater, an ancient river delta, on 18 February 2021. It seals rock samples in tubes for a future trip to Earth, and it carried Ingenuity, the first aircraft to fly on another planet: 72 flights instead of the planned five.' },
];
const EGG = new Map(EGGS.map(e => [e.id, e]));
const CRAFT_EGGS = EGGS.filter(e => e.kind === 'craft' && e.id !== 'iss').length;

// Achievements, by group (the Achievements tab shows them in this order). Secret ones show "???" until earned.
const ACHIEVEMENTS = [
  { g: 'EXPLORER', id: 'first-light', title: 'FIRST LIGHT', how: 'Open your first star system.' },
  { g: 'EXPLORER', id: 'star-hopper', title: 'STAR HOPPER', how: 'Open 10 different star systems.' },
  { g: 'EXPLORER', id: 'census', title: 'GALACTIC CENSUS', how: 'Open 50 different star systems.' },
  { g: 'EXPLORER', id: 'dice', title: 'ROLL OF THE DICE', how: 'Let the 🎲 pick a system for you.' },
  { g: 'EXPLORER', id: 'ghost', title: 'GHOST HUNTER', how: 'Visit a system that has only unconfirmed planets.' },
  { g: 'EXPLORER', id: 'oracle', title: 'FORTUNE TELLER', how: 'Open the 🏆 next-planets list.' },
  { g: 'EXPLORER', id: 'link', title: 'SIGNAL RECEIVED', how: 'Open a shared view link.' },
  { g: 'FAMOUS WORLDS', id: 'first-rock', title: 'FIRST ROCK', how: 'Visit Kepler-10, home of the first rocky planet Kepler found.' },
  { g: 'FAMOUS WORLDS', id: 'eight-worlds', title: 'EIGHT WORLDS', how: 'Visit Kepler-90: eight planets, as many as our Solar System.' },
  { g: 'FAMOUS WORLDS', id: 'cousin', title: "EARTH'S COUSIN", how: 'Visit Kepler-452, a Sun-like star with a world on a 385-day orbit.' },
  { g: 'FAMOUS WORLDS', id: 'eden', title: 'FIRST EDEN', how: 'Visit Kepler-186, where the first Earth-size planet in a habitable zone was found.' },
  { g: 'FAMOUS WORLDS', id: 'puff', title: 'SUPER PUFF', how: 'Visit Kepler-51, whose planets are about as dense as cotton candy.' },
  { g: 'FAMOUS WORLDS', id: 'tiny', title: 'TINY WORLD', how: 'Visit Kepler-37, home of a planet smaller than Mercury.' },
  { g: 'SCIENCE', id: 'goldilocks', title: 'GOLDILOCKS', how: 'Light up the habitable-zone systems on the map.' },
  { g: 'SCIENCE', id: 'double', title: 'DOUBLE TROUBLE', how: 'Visit a system with more than one star.' },
  { g: 'SCIENCE', id: 'lava', title: 'LAVA WORLD', how: 'Visit a planet hotter than 1,500 K.' },
  { g: 'SCIENCE', id: 'ancient', title: 'ANCIENT LIGHT', how: 'Open a star so far away its light left before the Great Pyramid was built.' },
  { g: 'SCIENCE', id: 'flare', title: 'FLARE WATCHER', how: 'Catch a red dwarf flaring.' },
  { g: 'SCIENCE', id: 'transit', title: 'TRANSIT WITNESS', how: "Watch a system edge-on with KEPLER'S VIEW." },
  { g: 'SCIENCE', id: 'scale', title: 'MIND THE GAP', how: 'Switch a system to TRUE SCALE.' },
  { g: "STAR GAZER'S GUESSES", id: 'believer', title: 'BELIEVER', how: 'Open a candidate Star Gazer rates 90% likely or more.' },
  { g: "STAR GAZER'S GUESSES", id: 'skeptic', title: 'SKEPTIC', how: 'Open a candidate Star Gazer rates 10% or less.' },
  { g: "STAR GAZER'S GUESSES", id: 'coin', title: 'COIN FLIP', how: "Open a candidate Star Gazer can't decide on (40 to 60%)." },
  { g: 'MAP AND TOOLS', id: 'depth', title: 'DEPTH PERCEPTION', how: 'Turn the map sideways with DEPTH.' },
  { g: 'MAP AND TOOLS', id: 'chips', title: 'CHIP CHECK', how: "Switch Kepler's camera chips (CCDS) off or on." },
  { g: 'MAP AND TOOLS', id: 'eagle', title: 'EAGLE EYE', how: 'Zoom the map all the way in.' },
  { g: 'MAP AND TOOLS', id: 'cartographer', title: 'CARTOGRAPHER', how: 'Hop across 25 stars in a row with the arrow keys.' },
  { g: 'MAP AND TOOLS', id: 'highlighter', title: 'HIGHLIGHTER', how: 'Try every highlight filter under the map in one visit.' },
  { g: 'MAP AND TOOLS', id: 'sky', title: 'SKY PHOTOGRAPHER', how: 'Open the real sky photo of a star.' },
  { g: 'MAP AND TOOLS', id: 'eco', title: 'ECO MODE', how: 'Switch the animation to battery saver.' },
  { g: 'EASTER EGGS', id: 'curious', title: 'CURIOUS MIND', how: 'Find your first easter egg.' },
  { g: 'EASTER EGGS', id: 'mission-control', title: 'MISSION CONTROL', how: 'Find five spacecraft.' },
  { g: 'EASTER EGGS', id: 'red-fleet', title: 'RED PLANET FLEET', how: 'Find every mission at Mars: four orbiters and two rovers.' },
  { g: 'EASTER EGGS', id: 'jupiter-crew', title: "JUPITER'S ENTOURAGE", how: 'Find Juno, Europa Clipper, JUICE and Lucy.' },
  { g: 'EASTER EGGS', id: 'sun-chasers', title: 'SUN CHASERS', how: 'Find the three spacecraft that study the Sun.' },
  { g: 'EASTER EGGS', id: 'l2', title: 'L2 NEIGHBOURS', how: 'Find both telescopes parked at Sun-Earth L2.' },
  { g: 'EASTER EGGS', id: 'interstellar', title: 'ROAD TO INTERSTELLAR', how: 'Find the two missions heading out of the Solar System.' },
  { g: 'EASTER EGGS', id: 'photo-finish', title: 'PHOTO FINISH', how: 'Slide a Galleria photo all the way into pixel art.' },
  { g: 'EASTER EGGS', id: 'curator', title: 'CURATOR', how: 'Open ten found cards in the Galleria in one visit.' },
  { g: 'EASTER EGGS', id: 'grand-tour', title: 'GRAND TOUR', how: "Find every easter egg, like the Voyagers' tour of the planets." },
  { g: 'SECRET', id: 'patient', title: 'PATIENT OBSERVER', how: 'Watch one system for two minutes. Kepler watched for four years.', secret: true },
  { g: 'SECRET', id: 'night', title: 'NIGHT SHIFT', how: 'Go stargazing after midnight.', secret: true },
  { g: 'SECRET', id: 'hollow', title: 'NO SIGNAL', how: "Search for things that aren't there five times in one visit.", secret: true },
  { g: 'SECRET', id: 'speedrun', title: 'WARP SPEED', how: 'Find three new easter eggs within one minute.', secret: true },
  { g: 'SECRET', id: 'goodnight', title: 'GOODNIGHT KEPLER', how: 'Visit on 15 November, the day Kepler was switched off in 2018.', secret: true },
  { g: 'SECRET', id: 'launch-day', title: 'LAUNCH DAY', how: 'Visit on 7 March, the day Kepler launched in 2009.', secret: true },
];
// Visiting these systems earns a famous-world achievement.
const FAMOUS = { 'Kepler-10': 'first-rock', 'Kepler-90': 'eight-worlds', 'Kepler-452': 'cousin', 'Kepler-186': 'eden',
                 'Kepler-51': 'puff', 'Kepler-37': 'tiny' };
// Finding every easter egg in a set earns a collection.
const EGG_SETS = {
  'red-fleet': ['mro', 'odyssey', 'mex', 'tgo', 'curiosity', 'perseverance'],
  'jupiter-crew': ['juno', 'clipper', 'juice', 'lucy'],
  'sun-chasers': ['parker', 'soho', 'solarOrbiter'],
  l2: ['jwst', 'euclid'],
  interstellar: ['voyager', 'newHorizons'],
};
const PYRAMID_LY = 4600;   // the Great Pyramid of Giza is about 4,600 years old
const session = { unknown: 0, hops: 0, highlights: new Set(), cards: new Set(), unlocks: [] };   // this visit only
const ACH = new Map(ACHIEVEMENTS.map(a => [a.id, a]));

// ---- progress (this browser only; the page works the same without storage)
// The key and the ids never change between site updates (tests/test_web_data.py checks the ids), so a new
// version of the page always finds what an older one saved. Ids this version doesn't know are kept, not
// dropped, so nothing earned is lost if a later version renames or retires something.
const PROGRESS_KEY = 'starmap.progress.v1';
const progress = { eggs: {}, ach: {}, systems: [], toasts: true };
const ID = /^[\w-]{1,40}$/, DATE = /^\d{4}-\d{2}-\d{2}$/;
function mergeProgress(saved) {   // from storage or an imported file; keeps the earliest date of each
  if (!saved || typeof saved !== 'object') return false;
  for (const kind of ['eggs', 'ach']) {
    const entries = Object.entries(saved[kind] && typeof saved[kind] === 'object' ? saved[kind] : {}).slice(0, 300);
    for (const [id, date] of entries) {
      if (!ID.test(id) || !DATE.test(String(date))) continue;
      if (!progress[kind][id] || date < progress[kind][id]) progress[kind][id] = String(date);
    }
  }
  if (Array.isArray(saved.systems)) {
    progress.systems = [...new Set([...progress.systems, ...saved.systems.filter(n => typeof n === 'string' && n.length < 60)])].slice(-200);
  }
  if (typeof saved.toasts === 'boolean') progress.toasts = saved.toasts;
  return true;
}
let storageOK = false;   // false in private windows or with site data blocked: progress lasts for this visit
try {
  mergeProgress(JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null'));
  localStorage.setItem('starmap.check', '1');
  localStorage.removeItem('starmap.check');
  storageOK = true;
} catch { /* see above */ }
function saveProgress() {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch { /* see above */ }
}
const today = () => new Date().toISOString().slice(0, 10);

// ---- pop-ups in the corner (they never cover the drawing's controls and leave by themselves)
const toastBox = document.getElementById('toasts');
function toast(kind, title, text, egg) {
  if (!progress.toasts) return;
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `${egg ? '<canvas width="40" height="26" aria-hidden="true"></canvas>' : '<span class="trophy" aria-hidden="true">🏆</span>'}
    <div><b>${esc(title)}</b><span>${esc(text)}</span></div>`;
  if (egg) drawEggArt(el.querySelector('canvas'), egg, 0, false);
  toastBox.appendChild(el);
  while (toastBox.children.length > 3) toastBox.firstChild.remove();
  setTimeout(() => el.classList.add('leaving'), 4200);
  setTimeout(() => el.remove(), 4800);
}

function glow() {   // the drawing lights up for a moment
  sys.classList.remove('glow');
  void sys.offsetWidth;   // restart the animation
  sys.classList.add('glow');
  setTimeout(() => sys.classList.remove('glow'), 2400);
}

function achieve(id) {
  if (progress.ach[id] || !ACH.has(id)) return;
  progress.ach[id] = today();
  saveProgress();
  const a = ACH.get(id);
  toast('ach', `ACHIEVEMENT: ${a.title}`, a.how);
  refreshGallery();
}

function unlockEgg(id) {
  const egg = EGG.get(id);
  if (!egg || progress.eggs[id]) return;
  progress.eggs[id] = today();
  saveProgress();
  glow();
  toast('egg', egg.toast, `${egg.name} found! See it in the ⚙ Galleria.`, egg);
  const found = Object.keys(progress.eggs);
  achieve('curious');
  if (found.filter(k => EGG.get(k).kind === 'craft' && k !== 'iss').length >= 5) achieve('mission-control');
  if (found.length === EGGS.length) achieve('grand-tour');
  for (const [set, ids] of Object.entries(EGG_SETS)) if (ids.every(k => progress.eggs[k])) achieve(set);
  const now = Date.now();
  session.unlocks = [...session.unlocks.filter(t => now - t < 60_000), now];
  if (session.unlocks.length >= 3) achieve('speedrun');
  refreshGallery();
}

// Which easter egg a search found (called by lookup() after it opened one).
function eggForQuery(q) {
  if (/^(the )?pluto$/i.test(q)) return 'pluto';
  if (HOME_QUERY.test(q)) return 'sun';
  if (ISS_QUERY.test(q)) return 'iss';
  if (KEPLER_QUERY.test(q)) return 'kepler';
  const craft = craftFocus(q);
  return craft ? CRAFT_SPRITE[craft] : null;
}

function systemOpened(s) {   // from select(): counts systems for the achievements
  const name = s[COL.name];
  if (!progress.systems.includes(name)) {
    progress.systems.push(name);
    if (progress.systems.length > 200) progress.systems.shift();
    saveProgress();
  }
  const n = progress.systems.length;
  achieve('first-light');
  if (n >= 10) achieve('star-hopper');
  if (n >= 50) achieve('census');
  const hour = new Date().getHours();
  if (hour < 4) achieve('night');
  if (FAMOUS[name]) achieve(FAMOUS[name]);
  if (s[COL.dist] != null && s[COL.dist] * LY_PER_PC > PYRAMID_LY) achieve('ancient');
  const sg = s[COL.sg];
  if (sg != null) {
    if (sg >= 0.9) achieve('believer');
    if (sg <= 0.1) achieve('skeptic');
    if (sg >= 0.4 && sg <= 0.6) achieve('coin');
  }
}

// Small hooks from the rest of the page.
function systemDetailShown(detail) {   // showSystem / showUnconfirmed, once the details are loaded
  if ((detail.nstars ?? 1) > 1) achieve('double');
  if (detail.planets.some(p => (p.teq ?? 0) >= 1500)) achieve('lava');
}
function noSignal() { if (++session.unknown >= 5) achieve('hollow'); }
function arrowHop() { if (++session.hops >= 25) achieve('cartographer'); }
function highlightTried(key) {
  session.highlights.add(key);
  if (session.highlights.size >= Object.keys(HIGHLIGHTS).length) achieve('highlighter');
}

// ---- drawing an easter egg on a small canvas, in colour or as a silhouette with a "?"
function drawEggArt(canvas, egg, t, silhouette) {
  const w = canvas.width, h = canvas.height;
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const ctx = off.getContext('2d');
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  if (egg.kind === 'sun') {
    const r = Math.max(3, Math.floor(h / 6));
    for (const [k, orbit, art, size] of [[0, r + 6, 'mercury', 1], [1, r + 11, 'earth', 2], [2, r + 18, 'jupiter', 3]]) {
      const a = t * (0.9 - k * 0.3) + k * 2;
      solarPlanet(ctx, cx + orbit * Math.cos(a), cy + orbit * 0.42 * Math.sin(a), { art, size, noMoon: true }, -Math.cos(a), -Math.sin(a), t);
    }
    disc(ctx, cx, cy, r, '#ffd34d');
    disc(ctx, cx - 1, cy - 1, Math.max(1, r - 2), '#fff1b0');
  } else if (egg.kind === 'pluto') {
    solarPlanet(ctx, cx, cy, { art: 'pluto', size: Math.floor(h / 3) }, -0.8, -0.6, t * 2);
  } else if (egg.kind === 'kepler') {
    const px = Math.max(1, Math.min(Math.floor((w - 4) / KEPLER_W), Math.floor((h - 4) / KEPLER_H)));
    keplerSprite(ctx, cx - Math.floor(KEPLER_W * px / 2), cy - Math.floor(KEPLER_H * px / 2), px, silhouette ? null : (t / 3) % 1);
  } else {
    const [sw, sh] = spriteSize(egg.art);
    const px = Math.max(1, Math.min(Math.floor((w - 4) / sw), Math.floor((h - 4) / sh)));
    const bob = REDUCED_MOTION || silhouette ? 0 : Math.round(Math.sin(t * 1.5));
    craftSprite(ctx, egg.art, cx - Math.floor(sw * px / 2), cy - Math.floor(sh * px / 2) + bob, px);
  }
  const out = canvas.getContext('2d');
  out.clearRect(0, 0, w, h);
  if (silhouette) {
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#1c2245';
    ctx.fillRect(0, 0, w, h);
    out.drawImage(off, 0, 0);
    const q = Math.max(1, Math.floor(h / 14));   // the question mark, scaled
    out.fillStyle = '#ffd34d';
    QUESTION.forEach((row, y) => [...row].forEach((bit, x) => {
      if (bit === '1') out.fillRect(cx - Math.floor(5 * q / 2) + x * q, cy - Math.floor(7 * q / 2) + y * q, q, q);
    }));
  } else {
    out.drawImage(off, 0, 0);
  }
}

// ---- the Galleria dialog
const galleryDialog = document.getElementById('gallery');
const panes = { eggs: document.getElementById('pane-eggs'), ach: document.getElementById('pane-ach'), set: document.getElementById('pane-set') };
let detailEgg = null, detailFrame = 0;
const blanks = name => [...name].map(ch => (/[A-Za-z0-9]/.test(ch) ? '_' : ch === ' ' ? ' ' : ch)).join('');

function renderEggs() {
  const found = EGGS.filter(e => progress.eggs[e.id]).length;
  if (detailEgg) return renderDetail(detailEgg);
  panes.eggs.innerHTML = `
    <p class="gallery-progress"><b>${found} / ${EGGS.length}</b> FOUND
      <span class="bar" aria-hidden="true"><span></span></span></p>
    <p class="note">Each silhouette is a hidden easter egg. Read the clue, guess the name, then type it in the
      search bar. Found ones light up: open them to compare the pixel art with the real thing.</p>
    <ul class="egg-grid">${EGGS.map(e => {
      const got = Boolean(progress.eggs[e.id]);
      return `<li><button type="button" class="egg-card${got ? ' found' : ''}" data-egg="${esc(e.id)}"
          aria-label="${got ? esc(e.name) : 'Unknown easter egg'}: ${got ? 'found, open its story' : esc(e.clue)}">
        <canvas width="64" height="40" aria-hidden="true"></canvas>
        <span class="egg-name">${got ? esc(e.name) : esc(blanks(e.name))}</span>
        <span class="egg-clue">${got ? `★ ${esc(e.toast)}` : esc(e.clue)}</span></button></li>`;
    }).join('')}</ul>`;
  panes.eggs.querySelector('.bar span').style.width = `${Math.round(100 * found / EGGS.length)}%`;
  panes.eggs.querySelectorAll('.egg-card').forEach(b => {
    const egg = EGG.get(b.dataset.egg);
    drawEggArt(b.querySelector('canvas'), egg, 1, !progress.eggs[egg.id]);
    b.addEventListener('click', () => {
      detailEgg = egg;
      if (progress.eggs[egg.id]) { session.cards.add(egg.id); if (session.cards.size >= 10) achieve('curator'); }
      renderDetail(egg);
    });
  });
}

function renderDetail(egg) {
  const got = Boolean(progress.eggs[egg.id]);
  const credit = egg.ref && window.STARMAP_GALLERY ? window.STARMAP_GALLERY[egg.ref] : null;
  const link = (u, t) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(t)} ↗</a>`;
  const real = !got ? ''
    : credit?.img ? `<figure class="morph">
        <canvas width="240" height="160" role="img" aria-label="${esc(credit.what)}"></canvas>
        <input type="range" min="0" max="100" value="0" step="1" aria-label="Slide from the real photo to the pixel art">
        <span class="morph-ends" aria-hidden="true"><span>PHOTO</span><span>PIXEL ART</span></span>
        <figcaption>THE REAL THING · ${esc(credit.what)} · ${link(credit.link, `credit: ${credit.credit}`)}</figcaption></figure>`
    : `<figure class="no-photo"><figcaption>THE REAL THING · ${credit
        ? `${esc(credit.what)}: the picture is credited to ESA, so it isn't copied here; ${link(credit.link, `see it (${credit.credit})`)}`
        : `no NASA photo; ${link(egg.link, 'see ESA\'s mission page')}`}</figcaption></figure>`;
  panes.eggs.innerHTML = `
    <button type="button" class="ghost back">◂ BACK</button>
    <div class="egg-detail${got ? ' found' : ''}">
      <figure><canvas width="128" height="80" aria-hidden="true"></canvas>
        <figcaption>${got ? 'PIXEL ART' : 'NOT FOUND YET'}</figcaption></figure>
      ${real}
    </div>
    ${got && egg.id === 'sun' ? planetStrip() : ''}
    <h3 class="facts-title">${got ? esc(egg.name.toUpperCase()) : esc(blanks(egg.name))}</h3>
    ${got ? `<p class="egg-badge">★ ${esc(egg.toast)} · found ${esc(progress.eggs[egg.id])}</p><p>${esc(egg.story)}</p>
        <button type="button" class="show-me">SHOW ME</button>`
      : `<p class="egg-clue big-clue">${esc(egg.clue)}</p>
        <p>Know it? Type its name in the search bar.</p><button type="button" class="guess">TAKE A GUESS</button>`}`;
  const canvas = panes.eggs.querySelector('.egg-detail canvas');
  cancelAnimationFrame(detailFrame);
  let last = 0;
  const step = now => {   // animate the found egg while its card is open (~15 fps)
    if (!galleryDialog.open || detailEgg !== egg) return;
    if (now - last > 66) { drawEggArt(canvas, egg, now / 1000, !got); last = now; }
    if (got && !REDUCED_MOTION) detailFrame = requestAnimationFrame(step);
  };
  drawEggArt(canvas, egg, 1, !got);
  const morph = panes.eggs.querySelector('.morph');
  if (morph) photoToPixels(morph, credit.img, egg);
  if (got && !REDUCED_MOTION) detailFrame = requestAnimationFrame(step);
  panes.eggs.querySelector('.back').addEventListener('click', () => { detailEgg = null; renderEggs(); });
  panes.eggs.querySelector('.show-me')?.addEventListener('click', () => {
    galleryDialog.close();
    input.value = egg.query;
    lookup(egg.query);
    sys.scrollIntoView({ block: 'nearest', behavior: REDUCED_MOTION ? 'auto' : 'smooth' });
  });
  panes.eggs.querySelector('.guess')?.addEventListener('click', () => {
    galleryDialog.close();
    input.value = '';
    input.focus();
  });
}

// Pixelation slider: drag from the real photo (0) to the pixel art (100). Up to 80 the photo is drawn
// at lower and lower resolution (blocks of 1 to 16 pixels) with fewer and fewer colours; from 80 on it
// fades into the sprite. The photo comes from this site, so the canvas may read its pixels.
function photoToPixels(fig, src, egg) {
  const canvas = fig.querySelector('canvas'), slider = fig.querySelector('input');
  const ctx = canvas.getContext('2d'), photo = new Image();
  const small = document.createElement('canvas'), sctx2 = small.getContext('2d', { willReadFrequently: true });
  const sprite = document.createElement('canvas');
  const draw = () => {
    const v = Number(slider.value), W = canvas.width, H = canvas.height;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#070b1a';
    ctx.fillRect(0, 0, W, H);
    if (!photo.complete || !photo.naturalWidth) return;
    const f = Math.min(v, 80) / 80;
    const block = Math.max(1, Math.round(1 + f ** 1.6 * 15));
    if (block === 1) ctx.drawImage(photo, 0, 0, W, H);
    else {
      small.width = Math.ceil(W / block); small.height = Math.ceil(H / block);
      sctx2.imageSmoothingEnabled = true;
      sctx2.drawImage(photo, 0, 0, small.width, small.height);
      const levels = Math.round(256 - f ** 0.7 * 250);   // 256 -> 6 shades per channel
      if (levels < 256) {
        const data = sctx2.getImageData(0, 0, small.width, small.height);
        const step = 255 / (levels - 1);
        for (let i = 0; i < data.data.length; i += 4) {
          for (let c = 0; c < 3; c++) data.data[i + c] = Math.round(Math.round(data.data[i + c] / step) * step);
        }
        sctx2.putImageData(data, 0, 0);
      }
      ctx.drawImage(small, 0, 0, small.width * block, small.height * block);
    }
    if (v > 80) {   // the last stretch: our sprite fades in over the blocks
      const a = (v - 80) / 20;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#070b1a';
      ctx.fillRect(0, 0, W, H);
      sprite.width = Math.floor(W / 3); sprite.height = Math.floor(H / 3);
      drawEggArt(sprite, egg, 1, false);
      ctx.drawImage(sprite, 0, 0, sprite.width * 3, sprite.height * 3);
      ctx.globalAlpha = 1;
    }
  };
  photo.addEventListener('load', () => {
    canvas.height = Math.round(canvas.width * photo.naturalHeight / photo.naturalWidth);
    draw();
  });
  photo.src = src;
  slider.addEventListener('input', () => { draw(); if (slider.value === slider.max) achieve('photo-finish'); });
  draw();
}

// The Solar System's card: real photos of the Sun, the planets and the Moon (natural colour).
const PHOTO_STRIP = ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
function planetStrip() {
  const credits = window.STARMAP_GALLERY || {};
  const items = PHOTO_STRIP.filter(k => credits[k]?.img).map(k => `
    <li><a href="${esc(credits[k].link)}" target="_blank" rel="noopener noreferrer" title="${esc(credits[k].what)} · ${esc(credits[k].credit)}">
      <img src="${esc(credits[k].img)}" alt="${esc(credits[k].what)}" loading="lazy" width="64" height="64">
      <span>${esc(k.toUpperCase())}</span></a></li>`).join('');
  return items ? `<ul class="planet-strip" aria-label="Real photos of the Sun and planets">${items}</ul>
    <p class="note">Real photos in natural colour (NASA): hover or tap one for its source. Sizes not to scale.</p>` : '';
}

function renderAchievements() {
  const got = ACHIEVEMENTS.filter(a => progress.ach[a.id]).length;
  const groups = [...new Set(ACHIEVEMENTS.map(a => a.g))];
  panes.ach.innerHTML = `
    <p class="gallery-progress"><b>${got} / ${ACHIEVEMENTS.length}</b> UNLOCKED</p>
    ${groups.map(g => {
      const list = ACHIEVEMENTS.filter(a => a.g === g);
      return `<h3 class="facts-title">${esc(g)} <span class="ach-count">${list.filter(a => progress.ach[a.id]).length} / ${list.length}</span></h3>
      <ul class="ach-list">${list.map(a => {
        const on = progress.ach[a.id];
        const hidden = a.secret && !on;
        return `<li class="${on ? 'on' : ''}"><span class="ach-icon" aria-hidden="true">${on ? '🏆' : '🔒'}</span>
          <div><b>${hidden ? '???' : esc(a.title)}</b><span>${hidden ? 'A secret achievement. Keep exploring.' : esc(a.how)}${
            on ? ` · ${esc(on)}` : ''}</span></div></li>`;
      }).join('')}</ul>`;
    }).join('')}`;
}

function refreshGallery() {
  if (!galleryDialog.open) return;
  if (!panes.eggs.hidden) renderEggs();
  if (!panes.ach.hidden) renderAchievements();
}

// Settings: is progress being kept, and a backup file to download or load.
const storageNote = document.getElementById('set-storage');
async function renderSettings() {
  if (!storageOK) {
    storageNote.textContent = '⚠ This browser isn\'t saving your progress (a private window, or site data is ' +
      'blocked). It will be lost when you close the page: download it below to keep it.';
    return;
  }
  let kept = '';
  try { kept = (await navigator.storage?.persisted?.()) ? ' Protected from automatic clean-up.' : ''; } catch { /* older browser */ }
  storageNote.textContent = `✓ Saved in this browser: updates to the site keep it.${kept} It's only lost if this ` +
    'site\'s data is cleared, in a private window, or on another browser or device: keep a backup file for those.';
}
document.getElementById('set-export').addEventListener('click', () => {
  const file = new Blob([JSON.stringify({ app: 'kepler-star-map', version: 1, saved: today(), ...progress }, null, 1)],
                        { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = `kepler-star-map-progress-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  try { navigator.storage?.persist?.(); } catch { /* best effort: ask the browser to keep our data */ }
});
const importInput = document.getElementById('set-import-file');
document.getElementById('set-import').addEventListener('click', () => importInput.click());
importInput.addEventListener('change', async () => {
  const file = importInput.files[0];
  importInput.value = '';
  if (!file) return;
  let ok = false;
  try { ok = file.size < 200_000 && mergeProgress(JSON.parse(await file.text())); } catch { ok = false; }
  if (ok) saveProgress();
  resetNote.textContent = ok ? 'Progress loaded and merged with what you had.' : 'That file isn\'t a star map progress file.';
});

function showTab(name) {
  for (const [key, pane] of Object.entries(panes)) {
    const tab = document.getElementById(`tab-${key}`);
    tab.setAttribute('aria-selected', String(key === name));
    tab.tabIndex = key === name ? 0 : -1;
    pane.hidden = key !== name;
  }
  if (name === 'eggs') renderEggs();
  if (name === 'ach') renderAchievements();
  if (name === 'set') renderSettings();
}
const tabs = [...document.querySelectorAll('#gallery [role="tab"]')];
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => showTab(tab.id.slice(4)));
  tab.addEventListener('keydown', e => {   // arrow keys move between tabs
    const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!dir) return;
    const next = tabs[(i + dir + tabs.length) % tabs.length];
    next.focus();
    showTab(next.id.slice(4));
  });
});
document.getElementById('open-gallery').addEventListener('click', () => {
  detailEgg = null;
  galleryDialog.showModal();
  showTab('eggs');
});
document.getElementById('gallery-close').addEventListener('click', () => galleryDialog.close());
galleryDialog.addEventListener('click', e => { if (e.target === galleryDialog) galleryDialog.close(); });   // click outside
galleryDialog.addEventListener('close', () => cancelAnimationFrame(detailFrame));

const toastSetting = document.getElementById('set-toasts');
toastSetting.checked = progress.toasts;
toastSetting.addEventListener('change', () => { progress.toasts = toastSetting.checked; saveProgress(); });
const resetButton = document.getElementById('set-reset'), resetNote = document.getElementById('set-reset-note');
resetButton.addEventListener('click', () => {
  if (resetButton.dataset.armed !== '1') {   // ask twice
    resetButton.dataset.armed = '1';
    resetButton.textContent = 'SURE? CLICK AGAIN';
    resetNote.textContent = 'This forgets every easter egg and achievement you found in this browser.';
    return;
  }
  Object.assign(progress, { eggs: {}, ach: {}, systems: [] });
  saveProgress();
  resetButton.dataset.armed = '';
  resetButton.textContent = 'RESET PROGRESS';
  resetNote.textContent = 'Progress reset. Happy hunting!';
});

// Anniversaries: visiting on Kepler's launch day or the day it was switched off.
{
  const d = new Date();
  if (d.getMonth() === 2 && d.getDate() === 7) achieve('launch-day');
  if (d.getMonth() === 10 && d.getDate() === 15) achieve('goodnight');
}
info.addEventListener('click', e => { if (e.target.closest('a[href*="aladin"]')) achieve('sky'); });
