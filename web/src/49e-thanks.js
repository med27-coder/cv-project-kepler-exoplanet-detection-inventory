// ---------------------------------------------------------------- the antenna: a thank-you note, and the updates
// The little dish on the left edge of the page (its pixel art: ICONS.antenna in 49c-ui.js) opens a note from the
// site's maker, in two tabs: MESSAGE (the note, led by WHAT'S NEW IN VX when this browser hasn't seen the version)
// and UPDATES (every transmission, newest first: TRANSMISSIONS in 00-version.js, each release's notes among them). A new version lights the dish up; opening it
// marks the version as seen. Clicking outside the note closes it too.
const SEEN_VERSION_KEY = 'starmap.seenVersion';
const thanksDialog = document.getElementById('thanks');
const thanksButton = document.getElementById('thanks-open');
document.getElementById('site-version').textContent = `v${VERSION}`;
function seenVersion() {
  try { return localStorage.getItem(SEEN_VERSION_KEY); } catch { return null; }
}
const versionIsNew = seenVersion() !== VERSION;
function noteList(notes) {
  const ul = document.createElement('ul');
  for (const note of notes) {
    const li = document.createElement('li');
    li.textContent = note;
    ul.append(li);
  }
  return ul;
}
if (versionIsNew) {
  thanksButton.classList.add('news');
  thanksButton.title = `New in v${VERSION}: open the transmission`;
  document.getElementById('thanks-news-title').textContent = `WHAT'S NEW IN V${VERSION}`;
  document.getElementById('thanks-news-list').replaceWith(Object.assign(noteList(RELEASE_NOTES), { id: 'thanks-news-list' }));
}
const updatesList = document.getElementById('thanks-updates');
for (const t of TRANSMISSIONS) {
  const li = document.createElement('li');
  li.dataset.category = t.category;
  const title = document.createElement('h3');
  title.textContent = t.title;
  const date = document.createElement('span');
  date.textContent = niceDate(t.date).toUpperCase();
  title.append(date);
  const meta = document.createElement('p');
  meta.className = 'tx-meta';
  meta.textContent = `${TRANSMISSION_KINDS[t.category]} · FROM ${t.from}`;
  li.append(title, meta, noteList(t.body));
  updatesList.append(li);
}

const thanksTabs = [['thanks-tab-msg', 'thanks-pane-msg'], ['thanks-tab-upd', 'thanks-pane-upd']]
  .map(([tab, pane]) => [document.getElementById(tab), document.getElementById(pane)]);
function showThanksTab(which) {
  for (const [tab, pane] of thanksTabs) {
    const on = tab.id === which;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
    pane.hidden = !on;
  }
}
thanksTabs.forEach(([tab], k) => {
  tab.addEventListener('click', () => showThanksTab(tab.id));
  tab.addEventListener('keydown', e => {   // arrow keys move between the tabs, as in the Galleria
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = thanksTabs[(k + (e.key === 'ArrowRight' ? 1 : thanksTabs.length - 1)) % thanksTabs.length][0];
    showThanksTab(next.id);
    next.focus();
  });
});
document.getElementById('thanks-news-all').addEventListener('click', () => showThanksTab('thanks-tab-upd'));

thanksButton.addEventListener('click', () => {
  document.getElementById('thanks-news').hidden = !versionIsNew;
  showThanksTab('thanks-tab-msg');
  thanksDialog.showModal();
  thanksButton.classList.remove('news');
  thanksButton.title = 'Incoming transmission: a note from the maker';
  try { localStorage.setItem(SEEN_VERSION_KEY, VERSION); } catch { /* private window: the dish lights up again next visit */ }
});
document.getElementById('thanks-close').addEventListener('click', () => thanksDialog.close());
thanksDialog.addEventListener('click', e => { if (e.target === thanksDialog) thanksDialog.close(); });
