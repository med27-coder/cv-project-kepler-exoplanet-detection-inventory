// ---------------------------------------------------------------- the site's version
// One source of truth (docs/plans/TROPHIES_AND_DATA.md section 5): build_web.py stamps it on the page's script and
// stylesheet links, and tests check it matches the top of CHANGELOG.md. Semantic versions: MAJOR for a redesign or
// a change in how progress is saved, MINOR for new features, PATCH for fixes. RELEASE_NOTES are what the antenna
// announces (2 or 3 plain-words highlights per version, no spoilers).
const VERSION = '1.2.1';
const RELEASE_NOTES = [
  'Voyager 1 and Voyager 2 are now two easter eggs, each with its own story. Already found "Voyager"? That was Voyager 1.',
  'The 8-bit fanfare is on from the start and plays reliably (switch it off in Settings if you prefer quiet).',
  'Sky watch (v1.1): comets and asteroids cross the Kepler map every few minutes. Click one to catch it!',
];
