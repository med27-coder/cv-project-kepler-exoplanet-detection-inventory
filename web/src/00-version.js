// ---------------------------------------------------------------- the site's version
// One source of truth (docs/plans/TROPHIES_AND_DATA.md section 5): build_web.py stamps it on the page's script and
// stylesheet links, and tests check it matches the top of CHANGELOG.md. Semantic versions: MAJOR for a redesign or
// a change in how progress is saved, MINOR for new features, PATCH for fixes. RELEASE_NOTES are what the antenna
// announces (2 or 3 plain-words highlights per version, no spoilers).
const VERSION = '1.0.0';
const RELEASE_NOTES = [
  'The first full release: 3,600+ Kepler stars to explore, each with its planets orbiting in pixel art.',
  'A collecting game in the Galleria: 29 easter eggs to find by name, 69 achievements, trophies and your own star.',
  'A UNIVERSE view that zooms out from Kepler\'s field to the edge of the observable universe.',
];
