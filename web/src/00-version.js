// ---------------------------------------------------------------- the site's version
// One source of truth (docs/plans/TROPHIES_AND_DATA.md section 5): build_web.py stamps it on the page's script and
// stylesheet links, and tests check it matches the top of CHANGELOG.md. Semantic versions: MAJOR for a redesign or
// a change in how progress is saved, MINOR for new features, PATCH for fixes. RELEASE_NOTES are what the antenna
// announces (2 or 3 plain-words highlights per version, no spoilers).
const VERSION = '1.7.0';
const RELEASE_NOTES = [
  'A new easter egg: the very first rover on Mars, from 1997. Can you find it? (The Martian farm has a clue outside its Hab.)',
  'New pixel art for every spacecraft and rover: bigger, shaded, and easier to tell apart.',
  'Every found easter egg in the Galleria now has FUN FACTS and the story of why it was hidden here.',
];
