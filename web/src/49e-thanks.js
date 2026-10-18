// ---------------------------------------------------------------- the thank-you note
// The little dish on the left edge of the page (its pixel art: ICONS.antenna in 49c-ui.js) opens a note
// from the site's maker. Clicking outside the note closes it too.
const thanksDialog = document.getElementById('thanks');
document.getElementById('thanks-open').addEventListener('click', () => thanksDialog.showModal());
document.getElementById('thanks-close').addEventListener('click', () => thanksDialog.close());
thanksDialog.addEventListener('click', e => { if (e.target === thanksDialog) thanksDialog.close(); });
