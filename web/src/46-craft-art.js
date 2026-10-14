// ---------------------------------------------------------------- spacecraft pixel art
// One small sprite per spacecraft in the easter eggs, hand-drawn from official NASA images
// (pixel-art/references/, sources in pixel-art/references/SOURCES.md) and, for JUICE and
// BepiColombo, ESA's published designs. Each row is one line of pixels; letters are colours.
const CRAFT_INK = {
  w: '#eef2f8', s: '#d6dae2', l: '#b8bfcc', m: '#7d8596', d: '#454b5e', k: '#151a2c',   // white -> black
  g: '#d9a441', G: '#9c6b22', y: '#f3d27a',                                           // gold foil
  p: '#2f4fae', P: '#5d7bd6',                                                         // blue solar cells
  n: '#3a4366', N: '#66729c',                                                         // dark solar arrays
  c: '#b8864a', C: '#6e4e2c',                                                         // the ISS's copper arrays
  q: '#d5c3e0', Q: '#8f7aa8',                                                         // Webb's sunshield
  r: '#b0663a',                                                                       // Martian dust
};

const CRAFT_ART = {
  jwst: [   // gold hexagon mirror over the five-layer sunshield
    '.......ygy.......',
    '.....ygggggy.....',
    '....ggyggggyg....',
    '....gggGkGggg....',
    '....ggyggggyg....',
    '.....GggggggG....',
    '.......GGG.......',
    '........d........',
    '...qqqqqqqqqqq...',
    'qqqqqqqqqqqqqqqqq',
    '..QQQQQQQQQQQQQ..',
  ],
  voyager: [   // big white dish, ten-sided bus, science boom one way, power (RTG) boom the other
    '...wwwwwwwww.....',
    '..wllllllllw.....',
    '...wwwwwwwww.....',
    '......dgd........',
    '.mmmmmdgdmmmmmmmk',
    '.d....ddd........',
    '......m..........',
    '.....m...........',
    '....m............',
  ],
  newHorizons: [   // triangular body, dish on top, the black RTG sticking out
    '...wwwwwww...',
    '..wllllllw...',
    '...wwwwwww...',
    '.....ggg.....',
    '....gyggg....',
    '...ggggGgg...',
    '..ggggggGgg..',
    'kkkk.........',
  ],
  parker: [   // white heat shield in front, two small cooled wings, body behind
    '.wwwwwwwwwww.',
    'wsssssssssssw',
    '.mmmmmmmmmmm.',
    '......l......',
    '.p...dld...p.',
    '..p..dgd..p..',
    '...pplllpp...',
    '.....ddd.....',
  ],
  juno: [   // three long blue arrays in a Y around a dish and body
    'pp...........pp',
    '.Pp.........pP.',
    '..pp.......pp..',
    '...pP.www.Pp...',
    '....pwlllwp....',
    '.....dgggd.....',
    '......pp.......',
    '......Pp.......',
    '......pp.......',
    '......pm.......',
  ],
  clipper: [   // the largest planetary spacecraft: two huge dark arrays, dish, body
    '...........www...........',
    'nNnNnNnNnNwlllwnNnNnNnNnN',
    'nnnnnnnnnnndgdnnnnnnnnnnn',
    '...........ddd...........',
  ],
  soho: [   // gold box, two solar wings, dish
    'ppp.ggggg.ppp',
    'PpPmgGyGgmPpP',
    'ppp.ggggg.ppp',
    '.....lwl.....',
  ],
  euclid: [   // telescope tube behind a solar-panel sunshield, service module below
    'nnnnnnn...',
    'nNnNnNnww.',
    'nnnnnnnlw.',
    'nNnNnNnlw.',
    'nnnnnnnww.',
    '..dmmmmd..',
    '..dgggGd..',
  ],
  solarOrbiter: [   // dark heat shield, box body, two long arrays, boom
    'kkkkk..........',
    'kdddkggg.......',
    'kdddkgyGpppppp.',
    'kdddkgggPpPpPp.',
    'kkkkk.m........',
    '......mmmmmm...',
  ],
  bepi: [   // stacked: Mercury orbiter with its long array, Japan's orbiter, transfer module
    'pPpPpPpPp.....',
    'ppppppppplll..',
    '.........lwl..',
    '.........ggg..',
    '.........gGg..',
    'nNnNnNnNnddd..',
    'nnnnnnnnnddd..',
  ],
  juice: [   // a big cross of ten solar panels, dish, long radar antenna
    '......ppp......',
    '......pPp......',
    '......ppp......',
    'pppppplwlpppppp',
    'pPpPpPgwgpPpPpP',
    'ppppppgGgpppppp',
    '......ppp......',
    '......pPp.mmmmm',
    '......ppp......',
  ],
  lucy: [   // two enormous round solar arrays
    '.ppp.......ppp.',
    'ppPpp.....ppPpp',
    'pPPPpmgggmpPPPp',
    'ppPpp.gGg.ppPpp',
    '.ppp..lwl..ppp.',
  ],
  psyche: [   // two cross-shaped five-panel arrays, box body, dish
    '..pp.......pp..',
    'pppppmlwlmppppp',
    'pPpPpdgggdpPpPp',
    'pppppdgGgdppppp',
    '..pp.......pp..',
  ],
  apex: [   // OSIRIS-APEX: box, two wings, dish on top, sample arm
    '.....www.....',
    '....wlllw....',
    'ppp.ggggg.ppp',
    'PpPmgGyGgmPpP',
    'ppp.ggggg.ppp',
    '......m......',
    '.......m.....',
  ],
  mro: [   // Mars Reconnaissance Orbiter: the big 3 m dish over a gold body and two wings
    '...wwwwwww...',
    '..wlllllllw..',
    '...wwwwwww...',
    '......d......',
    'nnnn.ggg.nnnn',
    'NnNnmgGgmNnNn',
    'nnnn.ggg.nnnn',
  ],
  odyssey: [   // gold box, one solar wing, the long gamma-ray boom
    '.....g.......',
    '....ggg.nnnnn',
    'mmmmgGgmNnNnN',
    '....ggg.nnnnn',
    '.....w.......',
  ],
  mex: [   // Mars Express: gold cube, two wings, dish
    '....lww....',
    'ppp.ggg.ppp',
    'PpPmgGgmPpP',
    'ppp.ggg.ppp',
  ],
  tgo: [   // ExoMars Trace Gas Orbiter: big box, two long arrays, dish
    '.....lww......',
    'pppp.gggg.pppp',
    'PpPpmgyGgmPpPp',
    'pppp.gggg.pppp',
    '.....GGGG.....',
  ],
  curiosity: [   // six wheels, white body, mast with the camera head, power unit at the back
    '..........ddd',
    '...........m.',
    '...........m.',
    'kk.........m.',
    'kdwwwwwwwwwwr',
    '.dllllllllll.',
    '..dmmmmmmmmd.',
    '.kk..kk..kk..',
    '.kk..kk..kk..',
  ],
  perseverance: [   // like Curiosity, with the Ingenuity helicopter nearby
    '..........ddd.....',
    '...........m......',
    '...........m...ll.',
    'kk.........m....m.',
    'kdwwwwwwwwwwr..mdm',
    '.dllllllllll...m.m',
    '..dmmmmmmmmd......',
    '.kk..kk..kk.......',
    '.kk..kk..kk.......',
  ],
  iss: [   // eight copper solar wings on the long truss, modules in the middle
    'cc.cc.........cc.cc',
    'Cc.Cc.........cC.cC',
    'cc.cc.........cc.cc',
    'mmmmmmmmmmmmmmmmmmm',
    'cc.cc..lwwwl..cc.cc',
    'Cc.Cc...lwl...cC.cC',
    'cc.cc....l....cc.cc',
  ],
};

// Spacecraft name (data/spacecraft.js, rovers) -> sprite.
const CRAFT_SPRITE = {
  'Voyager 1': 'voyager', 'Voyager 2': 'voyager', 'New Horizons': 'newHorizons',
  'James Webb Space Telescope': 'jwst', Euclid: 'euclid', SOHO: 'soho', 'Parker Solar Probe': 'parker',
  'Solar Orbiter': 'solarOrbiter', BepiColombo: 'bepi', Juno: 'juno', 'Europa Clipper': 'clipper',
  JUICE: 'juice', Lucy: 'lucy', Psyche: 'psyche', 'OSIRIS-APEX': 'apex',
  'Mars Reconnaissance Orbiter': 'mro', 'Mars Odyssey': 'odyssey', 'Mars Express': 'mex',
  'ExoMars Trace Gas Orbiter': 'tgo', Curiosity: 'curiosity', Perseverance: 'perseverance',
};

const spriteSize = key => [CRAFT_ART[key][0].length, CRAFT_ART[key].length];

// Draw sprite `key` with its top-left at (x, y), `px` canvas pixels per art pixel.
function craftSprite(ctx, key, x, y, px = 1) {
  const art = CRAFT_ART[key];
  if (!art) return;
  art.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '.') return;
    ctx.fillStyle = CRAFT_INK[ch];
    ctx.fillRect(x + i * px, y + j * px, px, px);
  }));
}

// Fill every <canvas data-sprite="key"> inside `root` (the info panel's icons), scaled to fit.
function paintSpriteIcons(root) {
  root.querySelectorAll('canvas[data-sprite]').forEach(c => {
    const key = c.dataset.sprite;
    if (!CRAFT_ART[key]) return;
    const [w, h] = spriteSize(key);
    const px = Math.max(1, Math.min(Math.floor(c.width / w), Math.floor(c.height / h)));
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    craftSprite(ctx, key, Math.floor((c.width - w * px) / 2), Math.floor((c.height - h * px) / 2), px);
  });
}
const spriteIcon = key => (CRAFT_ART[key] ? `<canvas class="craft-icon" width="50" height="22" data-sprite="${esc(key)}" aria-hidden="true"></canvas>` : '');
