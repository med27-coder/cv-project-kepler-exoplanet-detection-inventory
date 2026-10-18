// ---------------------------------------------------------------- spacecraft pixel art
// One sprite per spacecraft in the easter eggs (redrawn larger and shaded in v1.6.0; the first set is in
// pixel-art/archive/spacecraft/), hand-drawn from official NASA images
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
  b: '#1e2f6e',                                                                       // solar cell grid lines
  v: '#6a5a86',                                                                       // Webb's sunshield, underside
  x: '#2a2a30', e: '#9fd8ff', E: '#4a8fd6', o: '#ff9a3c',                             // black (shields, RTGs, wheels), thruster glow
};

const CRAFT_ART = {
  jwst: [   // 18 gold hexagons, the secondary mirror on its three struts, the kite-shaped five-layer sunshield
    '.........m.........',
    '........mkm........',
    '.......m.k.m.......',
    '.....yygm.mggy.....',
    '....ygggyggyggg....',
    '...ygGgggyggGggg...',
    '...ggggyGkGyggggG..',
    '...ygGgggyggGgggG..',
    '....ggggyggyggGG...',
    '.....GgggGGgggG....',
    '.......GGdGG.......',
    '.........d.........',
    '....qqqqqqqqqqq....',
    '.qqqqqqqqqqqqqqqqq.',
    'qqqqqqqqqqqqqqqqqqq',
    '..QQQQQQQQQQQQQQQ..',
    '.....vvvvvvvvv.....',
  ],
  voyager: [   // the 3.7 m white dish over the ten-sided bus; magnetometer boom right, RTGs down-left, science platform
    '.....swwwwwwwwws.......',
    '....swwwwwwwwwwws......',
    '.....lsssssssssl.......',
    '.........mkm...........',
    '........lgGgl..........',
    '.mmmmmmmmgGGgmmmmmmmmmm',
    '........lgGgl..........',
    '.......dm.k.m..........',
    '......dm.....m.........',
    '....xxm.......mg.......',
    '...xxx.........gl......',
    '..xxx..................',
  ],
  newHorizons: [   // gold triangle body, white dish on top, the black RTG sticking out
    '......swwwwws.......',
    '.....wwwwwwwww......',
    '......lsssssl.......',
    '........mkm.........',
    '.......ygggy........',
    '......ygggggg.......',
    '.....yggggGgGg......',
    '....ygggGgggGGG.....',
    '...yggggggGGGGGxxxxx',
    '..GGGGGGGGGGGGGxxxxx',
  ],
  parker: [   // the white heat shield facing the Sun (up), the bus in its shadow, small blue arrays folded back
    '.....mswwwwwwwsm.....',
    '...mswwwwwwwwwwwsm...',
    '....mmmmmmmmmmmmm....',
    '.........d.d.........',
    '........dlslld.......',
    '..PpP...dgggGd...PpP.',
    '...Ppbb.dgGgGd.bbpP..',
    '.......bdgggGdb......',
    '........ddmdd........',
    '..........k..........',
  ],
  juno: [   // seen from above: three long blue solar arms around the hexagonal body and its white dish
    '..........PpP..........',
    '..........pPp..........',
    '..........PpP..........',
    '..........pPp..........',
    '..........PpP..........',
    '.........gswsg.........',
    '........gswwwsg........',
    '........gswkwsg........',
    '.......PpGswsGpP.......',
    '.....PpPp.GGG.pPpP.....',
    '...PpPp.........pPpPm..',
    '.PpPp.............pPpm.',
  ],
  clipper: [   // NASA's biggest planetary craft: two huge five-panel arrays, the tall body, the 3 m dish
    '...............swws................',
    '..............swwwws...............',
    '...............lssl................',
    'PpPpPpPpPpPpP...ggg...PpPpPpPpPpPpP',
    'pbpbpbpbpbpbpmmmgGgmmmpbpbpbpbpbpbp',
    'PpPpPpPpPpPpP...ggg...PpPpPpPpPpPpP',
    '................GGG................',
    '.................k.................',
  ],
  soho: [   // the gold service module, two blue wings, the white payload module on top
    '......lswwwwsl......',
    '......swwwwwws......',
    '......lsssssml......',
    'PpPpP.ygggggGG.PpPpP',
    'pbpbpmgggGgggGmpbpbp',
    'PpPpP.ggGgggGG.PpPpP',
    '......GGGGGGGG......',
    '........k..k........',
  ],
  euclid: [   // a silver telescope tube behind a sunshield of solar cells
    '......PpPp.......',
    '....wwbPpbPp.....',
    '...wsslPpbPpd....',
    '...wsslPpbPpd....',
    '...wsslPpbPpd....',
    '...wsslPpbPpd....',
    '...wsslPpbPpd....',
    '....lllPpbPpd....',
    '...ggggGGGGGG....',
    '...gggGGGGGGG....',
    '....d......d.....',
  ],
  solarOrbiter: [   // the black heat shield facing the Sun (left), the body, two long arrays, the boom
    'xx........................',
    'xxx.......PpPpPpPp........',
    'xxxdgggGd.pbpbpbpb........',
    'xxxdggGGdmmmmmmmmmmmmmmmmm',
    'xxxdgGGGd.pbpbpbpb........',
    'xxx.......PpPpPpPp........',
    'xx......ws................',
  ],
  bepi: [   // the stack: transfer module with long arrays, the European orbiter with its radiator, Japan's octagon
    '.........ll...........',
    '.PpPpPp.dssd.nNnNnNn..',
    '.pbpbpbmdgGdmnbnbnbn..',
    '.PpPpPp.dssd.nNnNnNn..',
    '........lsswwl........',
    '.......wsswwwsw.......',
    '........ggGGg.........',
    '........ddmdd.........',
    '.........eEe..........',
  ],
  juice: [   // ten big panels in a cross, the gold body, the white dish and the 10.6 m magnetometer boom
    '..........PpP...........',
    '..........pbp...........',
    '..........PpP...........',
    '........swwws...........',
    'PpPpPpPp.gGg.PpPpPpPmmmm',
    'pbpbpbpbmgGGmpbpbpbpm...',
    'PpPpPpPp.GGG.PpPpPpP....',
    '..........PpP...........',
    '..........pbp...........',
    '..........PpP...........',
  ],
  lucy: [   // two round solar arrays, 7 m across each, either side of the body and its dish
    '....PpPp.........PpPp....',
    '..PpPbPpPp.....PpPbPpPp..',
    '.PpbPpPbpPp.ws.PpbPpPbpPp',
    '.pPpPbPpPpPmggmpPpPbPpPpP',
    '.PpbPpPbpPp.GG.PpbPpPbpPp',
    '..PpPbPpPp.....PpPbPpPp..',
    '....PpPp.........PpPp....',
  ],
  psyche: [   // the box body, two X-shaped five-panel arrays, and the blue glow of its electric thrusters
    'PpP....................PpP',
    'pPpP..................PpPp',
    '..PpPp......ww......pPpP..',
    '....pPpPmmggggggmmPpPp....',
    '..PpPp.....gGGGg....pPpP..',
    'pPpP.......GGGGG......PpPp',
    'PpP.........eEe........PpP',
    '...........eEEEe..........',
    '............eEe...........',
  ],
  apex: [   // the box body, two arrays, the white dish, and the TAGSAM sampling arm reaching down
    '..........swws..........',
    '.........swwwws.........',
    'PpPpPpP...lssl...PpPpPpP',
    'pbpbpbpmmgggGGmmmpbpbpbp',
    'PpPpPpP..ggGGGG..PpPpPpP',
    '.........GGGGGG.........',
    '..........d...m.........',
    '..........d....m........',
    '..........d.....m.......',
    '.........lml.....s......',
  ],
  mro: [   // the 3 m dish on top, the gold body, two big solar arrays, the HiRISE camera
    '.......swwwwwwws........',
    '......swwwwwwwwws.......',
    '.......lsssssssl........',
    '...........d............',
    'PpPpPpPp.lggGgl.PpPpPpPp',
    'pbpbpbpbmggGGGGmpbpbpbpb',
    'PpPpPpPp.ggGGGG.PpPpPpPp',
    '..........wsl...........',
    '..........lll...........',
  ],
  odyssey: [   // one solar wing, the gold box, the white dish, and the long gamma-ray spectrometer boom
    '..............ws..........',
    '.............swws.........',
    'PpPpPpPpP....lll..........',
    'pbpbpbpbpmmmggGGgmmmmmmmlm',
    'PpPpPpPpP....gGGG.........',
    '.............GGGG.........',
    '..............k...........',
  ],
  mex: [   // a gold cube with two wings, a white dish, and the radar's long thin antennas
    '...........m...........',
    '..........m.......m....',
    '.........m.......m.....',
    'PpPpPp..ygggG...m......',
    'pbpbpbmmgggGGmmPpPpPp..',
    'PpPpPp..gGGGGm.pbpbpb..',
    '........GGGG.m.PpPpPp..',
    '.......lws....m........',
    '..............m........',
  ],
  tgo: [   // a big box, two long arrays, a dish; it sniffs Mars's air
    '..........lws...........',
    '..........sww...........',
    'PpPpPpPp.lllllll.PpPpPpP',
    'pbpbpbpbmsgggggGmpbpbpbp',
    'PpPpPpPp.sggGGGG.PpPpPpP',
    '.........sGGGGGG........',
    '..........GGGGG.........',
    '.........k....k.........',
  ],
  curiosity: [   // six wheels on rocker-bogie arms, white body, mast and camera head, the finned power unit at the back
    '..............lwwl..',
    '...............mk...',
    '...............m....',
    '...............m....',
    'mm....lsl......m....',
    'mmmwwwwwwwwwwwwwlll.',
    'mm.ssssssssssssss.ly',
    '...mmmmmmmmmmmmmm.gy',
    '..mm...mmm....mm....',
    '.xxx..xxx....xxx....',
    '.xmx..xmx....xmx....',
    '.xxx..xxx....xxx....',
  ],
  spirit: [   // a Mars Exploration Rover: the wide flat solar deck, the camera mast, six wheels
    '..........lwl......',
    '...........m.......',
    '..l........m.......',
    '..m.sl.....m.......',
    'PpPpPpPpPpPpPpPpPpP',
    '.....wwwwwwwww.....',
    '.....sssssssss.....',
    '....mmmmmmmmmmm....',
    '...xx...xx...xx....',
    '...xm...xm...xm....',
  ],
  opportunity: [   // Spirit's twin, its solar deck dusty red-brown before a gust of wind cleans it
    '..........lwl......',
    '...........m.......',
    '..l........m.......',
    '..m.sl.....m.......',
    'rrPprrPprrPprrPprrP',
    '.....wwwwwwwww.....',
    '.....sssssssss.....',
    '....mmmmmmmmmmm....',
    '...xx...xx...xx....',
    '...xm...xm...xm....',
  ],
  hubble: [   // the silver tube with its open aperture door, two blue solar wings, the high-gain antennas
    'PpP..............PpP',
    'pbp..lssssssssw..pbp',
    'PpPmlsssssssssskmPpP',
    'pbp.lllllllllllk.pbp',
    'PpP..mm......mm..PpP',
    '.....s........s.....',
  ],
  sojourner: [   // the first Mars rover: six small wheels, a flat solar panel on top, its antenna
    '.m.........',
    '.m.........',
    'PpPpPpPpPp.',
    '.sssssssg..',
    '.lllllllg..',
    'xx..xx..xx.',
    'xm..xm..xm.',
  ],
  perseverance: [   // like Curiosity (its twin design) with the Ingenuity helicopter beside it
    '..............lwwl..........',
    '...............mk...........',
    '...............m.....wwwwww.',
    '...............m........m...',
    'mm....lsl......m.......dmd..',
    'mmmwwwwwwwwwwwwwlll....lml..',
    'mm.ssssssssssssss.ly..m...m.',
    '...mmmmmmmmmmmmmm.gy.m.....m',
    '..mm...mmm....mm............',
    '.xxx..xxx....xxx............',
    '.xmx..xmx....xmx............',
    '.xxx..xxx....xxx............',
  ],
  iss: [   // eight copper solar wings on the long truss, white radiators, the modules in the middle
    'cCcC.cCcC.............cCcC.cCcC',
    'CcCc.CcCc.............CcCc.CcCc',
    'cCcC.cCcC.............cCcC.cCcC',
    'CcCc.CcCc.............CcCc.CcCc',
    'mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm',
    'cCcC.cCcC...lwwwwwl...cCcC.cCcC',
    'CcCc.CcCc..swwlwwws...CcCc.CcCc',
    'cCcC.cCcC....sws......cCcC.cCcC',
    'CcCc.CcCc.....w.......CcCc.CcCc',
  ],
};

// Spacecraft name (data/spacecraft.js, rovers) -> sprite.
const CRAFT_SPRITE = {
  'Voyager 1': 'voyager', 'Voyager 2': 'voyager', 'New Horizons': 'newHorizons',
  'James Webb Space Telescope': 'jwst', Euclid: 'euclid', SOHO: 'soho', 'Parker Solar Probe': 'parker',
  'Solar Orbiter': 'solarOrbiter', BepiColombo: 'bepi', Juno: 'juno', 'Europa Clipper': 'clipper',
  JUICE: 'juice', Lucy: 'lucy', Psyche: 'psyche', 'OSIRIS-APEX': 'apex',
  'Mars Reconnaissance Orbiter': 'mro', 'Mars Odyssey': 'odyssey', 'Mars Express': 'mex',
  'ExoMars Trace Gas Orbiter': 'tgo', Curiosity: 'curiosity', Perseverance: 'perseverance', Sojourner: 'sojourner', Spirit: 'spirit', Opportunity: 'opportunity',
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
