// ---------------------------------------------------------------- the antenna: a thank-you note, and what's new
// The little dish on the left edge of the page (its pixel art: ICONS.antenna in 49c-ui.js) opens a note from the
// site's maker. When the site has a version this browser hasn't seen (VERSION, 00-version.js), the dish lights up
// and the note starts with WHAT'S NEW IN VX: the release notes. Opening it marks the version as seen.
// Clicking outside the note closes it too.
const SEEN_VERSION_KEY = 'starmap.seenVersion';
const thanksDialog = document.getElementById('thanks');
const thanksButton = document.getElementById('thanks-open');
document.getElementById('site-version').textContent = `v${VERSION}`;
function seenVersion() {
  try { return localStorage.getItem(SEEN_VERSION_KEY); } catch { return null; }
}
const versionIsNew = seenVersion() !== VERSION;
if (versionIsNew) {
  thanksButton.classList.add('news');
  thanksButton.title = `New in v${VERSION}: open the transmission`;
  document.getElementById('thanks-news-title').textContent = `WHAT'S NEW IN V${VERSION}`;
  const list = document.getElementById('thanks-news-list');
  for (const note of RELEASE_NOTES) {
    const li = document.createElement('li');
    li.textContent = note;
    list.append(li);
  }
}
thanksButton.addEventListener('click', () => {
  document.getElementById('thanks-news').hidden = !versionIsNew;
  thanksDialog.showModal();
  thanksButton.classList.remove('news');
  thanksButton.title = 'Incoming transmission: a note from the maker';
  try { localStorage.setItem(SEEN_VERSION_KEY, VERSION); } catch { /* private window: the dish lights up again next visit */ }
});
document.getElementById('thanks-close').addEventListener('click', () => thanksDialog.close());
thanksDialog.addEventListener('click', e => { if (e.target === thanksDialog) thanksDialog.close(); });
