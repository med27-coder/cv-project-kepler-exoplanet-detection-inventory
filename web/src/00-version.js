// ---------------------------------------------------------------- the site's version
// One source of truth (docs/plans/TROPHIES_AND_DATA.md section 5): build_web.py stamps it on the page's script and
// stylesheet links, and tests check it matches the top of CHANGELOG.md. Versions count up in the last number, one step per release
// (1.9.1, 1.9.2, 1.9.3...), so they always read in order; no 2.0. HISTORY is what players read in the antenna's UPDATES tab, newest first: plain
// words, no spoilers for hidden easter eggs, and only "new" and "fixed" (no technical or security details; those
// live in CHANGELOG.md). Its first entry is the WHAT'S NEW the antenna announces.
const HISTORY = [
  { v: '1.9.10', date: '18 Oct 2026', notes: [
    'New: a second opinion on giant candidates. Their case files can switch to Colossus, an experimental AI made for giant planets, to compare with Star Gazer.',
    'New: two more achievements for finding out about the AIs behind the map.',
  ] },
  { v: '1.9.9', date: '18 Oct 2026', notes: [
    'New: two rovers hidden on the Moon, the first ever to drive on another world and the first on its far side, each with its own scene.',
    'New: meteors. A real-looking one now streaks across the night sky behind the page, and somewhere in orbit you can catch them.',
    'Fixed: a few systems Kepler found outside its usual list now show their Kepler names (one appeared as "2MASS J19383260+4603591"), all their planets, and what makes them unusual.',
  ] },
  { v: '1.9.8', date: '18 Oct 2026', notes: [
    'New: another rover to find on Mars, the first one from outside the United States, with its own scene.',
  ] },
  { v: '1.9.7', date: '18 Oct 2026', notes: [
    'Fixed: the next-planets list could be replaced by a star that was still loading.',
  ] },
  { v: '1.9.6', date: '18 Oct 2026', notes: [
    'Fixed: the lost astronaut spins more smoothly, with crisp edges.',
  ] },
  { v: '1.9.5', date: '18 Oct 2026', notes: [
    "New: one of the dwarf planets has a fresh look, closer to NASA's, with its two moons on their tilted orbits.",
  ] },
  { v: '1.9.4', date: '18 Oct 2026', notes: [
    'New: a nearby star you can visit now, even though Kepler never looked at it. Something small glints there.',
    'Fixed: systems whose catalog numbers put a planet inside its star now explain why.',
  ] },
  { v: '1.9.3', date: '18 Oct 2026', notes: [
    'New: the Hubble Space Telescope can be found now, circling the Earth.',
    'Fixed: clearer wording in a Galleria fun fact.',
  ] },
  { v: '1.9.2', date: '18 Oct 2026', notes: [
    'Fixed: a star still loading could replace the page you had moved on to.',
  ] },
  { v: '1.9.1', date: '18 Oct 2026', notes: [
    'New: an UPDATES tab in this transmission, with everything added and fixed, version by version.',
    'Fixed: the search box now ignores emojis.',
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
