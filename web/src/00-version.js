// ---------------------------------------------------------------- the site's version
// One source of truth (docs/plans/TROPHIES_AND_DATA.md section 5): build_web.py stamps it on the page's script and
// stylesheet links, and tests check it matches the top of CHANGELOG.md. Semantic versions: stay on 1.x (MINOR for
// new features, PATCH for fixes). HISTORY is what players read in the antenna's UPDATES tab, newest first: plain
// words, no spoilers for hidden easter eggs, and only "new" and "fixed" (no technical or security details; those
// live in CHANGELOG.md). Its first entry is the WHAT'S NEW the antenna announces.
const HISTORY = [
  { v: '1.10.0', date: '18 Oct 2026', notes: [
    'New: an UPDATES tab in this transmission, with everything added and fixed, version by version.',
  ] },
  { v: '1.9.0', date: '18 Oct 2026', notes: [
    "New: two more rovers to find, NASA's twins of 2004, each with its own scene on Mars.",
    'New: every rover you find now rolls by behind the farm on Mars.',
    'Fixed: small bugs.',
  ] },
  { v: '1.8.0', date: '18 Oct 2026', notes: [
    'New: dwarf planets you find join the Solar System drawing, out where they really orbit.',
    'New: a second loading screen, an astronomer at a telescope under twinkling stars.',
  ] },
  { v: '1.7.0', date: '18 Oct 2026', notes: [
    'New: the very first rover on Mars, from 1997, is hidden somewhere. The farm on Mars has a clue outside its Hab.',
  ] },
  { v: '1.6.0', date: '18 Oct 2026', notes: [
    'New: fresh pixel art for every spacecraft and rover: bigger, shaded and easier to tell apart.',
    'Fixed: bugs in how the pixel art is made.',
  ] },
  { v: '1.5.0', date: '18 Oct 2026', notes: [
    'New: every easter egg you find has FUN FACTS in the Galleria, and the story of why it was hidden here.',
  ] },
  { v: '1.4.0', date: '18 Oct 2026', notes: [
    'New: some spacecraft open their own animated scenes on Mars. Try searching for the rovers you know.',
  ] },
  { v: '1.3.1', date: '18 Oct 2026', notes: [
    'New: better photos for some Galleria cards.',
  ] },
  { v: '1.3.0', date: '18 Oct 2026', notes: [
    'New: arrows on the Galleria cards (and the arrow keys) to step from card to card.',
  ] },
  { v: '1.2.1', date: '18 Oct 2026', notes: [
    "Fixed: the astronaut's wardrobe buttons and outfit count.",
  ] },
  { v: '1.2.0', date: '18 Oct 2026', notes: [
    'New: the two Voyagers are now two easter eggs, each with its own story.',
    'Fixed: the 8-bit fanfare sometimes stayed silent. It is now on from the start (switch it off in Settings).',
  ] },
  { v: '1.1.0', date: '18 Oct 2026', notes: [
    'New: sky watch. Comets and asteroids cross the Kepler map every few minutes: click one to catch it.',
    'New: six achievements for catching them, and something stranger passing by now and then.',
    'Fixed: small bugs.',
  ] },
  { v: '1.0.0', date: '18 Oct 2026', notes: [
    'The first full release: 3,600+ Kepler stars, their planets in pixel art, the Galleria collecting game, and the UNIVERSE view.',
  ] },
];
const VERSION = HISTORY[0].v;
const RELEASE_NOTES = HISTORY[0].notes;
