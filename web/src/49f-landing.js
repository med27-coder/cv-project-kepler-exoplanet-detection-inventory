// ---------------------------------------------------------------- landing page (preview)
// The first screen planned in docs/plans/ACCOUNTS_AND_ACCESS.md (section 9), second version
// (docs/plans/PLATFORM_HARDENING.md section 1): the journey in four steps, START EXPLORING beside JOIN THE EXPLORER
// REGISTRY, the visitor's own numbers, what an account saves and how it is protected. A preview for now: it opens only with
// index.html?landing, and its forms send nothing yet (the accounts are being built on a local test server).
// Every claim on it must stay literally true of what is built.

Object.assign(ICONS, {
  sync: put => {   // two arrows chasing round a circle
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
      const d = Math.hypot(x - 5.5, y - 5.5), a = Math.atan2(y - 5.5, x - 5.5);
      if (Math.abs(d - 4.2) < 0.75 && Math.abs(Math.sin(a)) > 0.32) put(x, y, '#4fd17a');
    }
    for (const [x, y] of [[8, 4], [9, 3], [10, 4], [3, 7], [2, 8], [1, 7]]) put(x, y, '#4fd17a');
  },
  lock: put => {
    for (let y = 1; y < 6; y++) for (let x = 3; x < 9; x++) {
      if ((x === 3 || x === 8) && y > 1 || y === 1 && x > 3 && x < 8) put(x, y, '#9aa6d6');
    }
    for (let y = 5; y < 11; y++) for (let x = 2; x < 10; x++) put(x, y, y === 5 || y === 10 ? '#b8901a' : '#ffd34d');
    put(5, 7, '#070b1a'); put(6, 7, '#070b1a'); put(5, 8, '#070b1a'); put(6, 8, '#070b1a');
  },
  shield: put => {
    for (let y = 1; y < 11; y++) {
      const half = y < 6 ? 4 : Math.max(0, 9 - y);
      for (let x = 6 - half - 1; x <= 5 + half; x++) put(x, y, Math.abs(x - 5.5) > half - 0.5 || y === 1 ? '#9fd8ff' : '#2a6fb8');
    }
    for (const [x, y] of [[4, 5], [5, 6], [6, 5], [7, 4]]) put(x, y, '#e6ecff');   // a tick
  },
  key: put => {
    for (let y = 2; y < 7; y++) for (let x = 1; x < 6; x++) if (Math.hypot(x - 3, y - 4) < 2.6 && Math.hypot(x - 3, y - 4) > 1) put(x, y, '#ffd34d');
    for (let x = 5; x < 11; x++) put(x, 4, '#ffd34d');
    put(8, 5, '#ffd34d'); put(8, 6, '#ffd34d'); put(10, 5, '#ffd34d');
  },
  hourglass: put => {
    for (let y = 1; y < 11; y++) {
      const w = Math.abs(y - 5.5) - 0.5;
      for (let x = Math.round(5.5 - w); x <= Math.round(5.5 + w) - 1; x++) put(x, y, y === 1 || y === 10 ? '#9aa6d6' : y > 6 ? '#ffd34d' : '#e6ecff');
    }
  },
  export: put => {   // an arrow into a tray: download your progress
    for (let y = 1; y < 7; y++) { put(5, y, '#e6ecff'); put(6, y, '#e6ecff'); }
    for (const [x, y] of [[3, 5], [4, 6], [7, 6], [8, 5], [5, 7], [6, 7]]) put(x, y, '#e6ecff');
    for (let x = 1; x < 11; x++) put(x, 10, '#9aa6d6');
    put(1, 8, '#9aa6d6'); put(1, 9, '#9aa6d6'); put(10, 8, '#9aa6d6'); put(10, 9, '#9aa6d6');
  },
  planet: put => {   // a ringed world: explore
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
      const d = Math.hypot(x - 5.5, y - 5.5);
      if (d < 3.6) put(x, y, x + y < 9 ? '#9fd8ff' : '#2a6fb8');
    }
    for (let x = 0; x < 12; x++) { const y = Math.round(6.5 - (x - 5.5) * 0.35); if (Math.abs(x - 5.5) > 2.5) put(x, y, '#ffd34d'); }
  },
  crystal: put => {   // a crystal ball on its stand: predictions
    for (let y = 0; y < 9; y++) for (let x = 0; x < 12; x++) {
      const d = Math.hypot(x - 5.5, y - 4.5);
      if (d < 4.2) put(x, y, d > 3.3 ? '#b56cff' : x < 5 && y < 4 ? '#e6ecff' : '#6b3fb8');
    }
    for (let x = 3; x < 9; x++) { put(x, 9, '#b8901a'); put(x, 10, '#ffd34d'); }
    put(7, 3, '#ffd34d');   // a star inside
  },
  book: put => {   // an open logbook: the Captain's Log
    for (let y = 2; y < 10; y++) for (let x = 1; x < 11; x++) put(x, y, x === 5 || x === 6 ? '#b8901a' : '#e6ecff');
    for (const y of [4, 6, 8]) { put(2, y, '#9aa6d6'); put(3, y, '#9aa6d6'); put(8, y, '#9aa6d6'); put(9, y, '#9aa6d6'); }
    for (let x = 1; x < 11; x++) put(x, 10, '#9aa6d6');
  },
  guide: put => {   // Star Gazer, the site's AI, as a small telescope on its tripod
    for (let i = 0; i < 9; i++) { put(3 + i, 8 - Math.floor(i * 0.6), '#e6ecff'); put(3 + i, 9 - Math.floor(i * 0.6), '#9aa6d6'); }
    put(12, 2, '#ffd34d'); put(12, 3, '#ffd34d'); put(13, 2, '#fff3b0');   // the lens catching starlight
    for (let y = 10; y < 15; y++) { put(7 - (y - 10), y, '#6f7d96'); put(7 + (y - 10), y, '#6f7d96'); put(7, y, '#6f7d96'); }
    put(2, 1, '#ffd34d'); put(14, 6, '#e6ecff');
  },
});

const LANDING_SAVED = ['Achievements, and the day you earned each', 'Easter eggs found', 'Systems saved and visited',
  'Stars you have looked at', 'Your planet-or-not calls', 'Trophies and your showcase', 'The daily mystery streak',
  'The astronaut\'s outfits', 'Sky events caught', 'Settings: sound, pop-ups, background, the score switch',
  'Your pilot name, and an emblem as your picture if you pick one'];
const LANDING_NOT_SAVED = ['No email', 'No real name', 'No location', 'No analytics or tracking', 'No ads',
  'Nothing is ever sold'];
const LANDING_FEATURES = [   // the journey in four steps
  ['planet', 'EXPLORE WORLDS', 'Every star Kepler watched for planets, 3,600+ systems, each with its planets in pixel art.'],
  ['crystal', 'MAKE PREDICTIONS', 'Call a candidate PLANET or NOT A PLANET before NASA rules on it, and see who was right.'],
  ['trophy', 'EARN ACHIEVEMENTS', 'Achievements, ranks, trophies and hidden easter eggs to find across the map.'],
  ['book', 'YOUR CAPTAIN\'S LOG', 'Your journey kept day by day: every find, every call, every first.'],
];
const LANDING_CARDS = [   // every claim literally true today; cloud sync says COMING until it is online
  ['export', 'YOUR EXPLORER ARCHIVE', 'Download everything you have found as one file, any time, and load it in another browser.'],
  ['shield', 'NO ADS, NO TRACKING', 'Your progress stays in this browser. Nothing about you is collected or sold.'],
  ['sync', 'CLOUD SYNC · COMING', 'Join the Explorer Registry to carry your progress to any browser. Not open yet.'],
];
const LANDING_PROTECTION = [
  ['lock', 'ENCRYPTED IN TRANSIT', 'Every request travels over HTTPS.'],
  ['key', 'PASSWORDS NEVER SEEN', 'The sign-in service keeps only a scrambled form of your password. Nobody can read it.'],
  ['shield', 'ONLY YOU', 'Server rules let an account read and change its own progress and nothing else.'],
  ['hourglass', 'LIMITS', 'Repeated wrong passwords are slowed down, and saves and sign-ups are rate-limited.'],
];

const landingCards = list => list.map(([icon, head, text]) =>
  `<div class="landing-card">${iconCanvas(icon, 12)}<b>${esc(head)}</b><span>${esc(text)}</span></div>`).join('');

// "Your explorer so far", from this browser's own progress: a first visit shows the starting point.
function landingStats() {
  const calls = predictionStats(), systems = progress.systems.length;
  const stat = (value, label) => `<div class="landing-stat"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;
  const fresh = !Object.keys(progress.ach).length && !systems;
  return `<div class="landing-you">
      <canvas width="16" height="16" data-stage="${rankIndex()}" aria-hidden="true"></canvas>
      <p><b>${esc(rankName())}</b><span>${fresh ? 'Every explorer starts as stardust. Open a star system to begin.'
        : 'Your rank so far, kept in this browser.'}</span></p>
    </div>
    <div class="landing-stats">
      ${stat(`${ACHIEVEMENTS.filter(a => progress.ach[a.id]).length} / ${ACHIEVEMENTS.length}`, 'ACHIEVEMENTS')}
      ${stat(`${EGGS.filter(e => progress.eggs[e.id]).length} / ${EGGS.length}`, 'EASTER EGGS')}
      ${stat(systems >= 200 ? '200+' : String(systems), 'SYSTEMS EXPLORED')}
      ${stat(`${calls.right} / ${calls.right + calls.wrong}`, `CALLS RIGHT${calls.waiting ? ` · ${calls.waiting} WAITING` : ''}`)}
    </div>`;
}

function landingMarkup() {
  return `<div class="landing-inner">
    <section class="landing-hero">
      <p class="landing-kicker">NASA KEPLER MISSION · 3,600+ STARS</p>
      <h1 id="landing-title">KEPLER STAR MAP</h1>
      <p class="landing-tagline">Explore 3,600+ worlds from NASA's Kepler mission.</p>
      <p>Discover planets, earn achievements, call candidates before NASA confirms them, and build your explorer
        journey.</p>
      <div class="landing-actions">
        <button type="button" data-landing="play">START EXPLORING</button>
        <button type="button" class="ghost" data-landing="signup">JOIN THE EXPLORER REGISTRY</button>
      </div>
      <p class="landing-note">No account is needed to play: your progress is kept in this browser.
        <button type="button" class="linkish" data-landing="signin">Already registered? Sign in</button></p>
    </section>
    <aside class="landing-guide" aria-label="Star Gazer, your guide">
      ${iconCanvas('guide', 16)}
      <p><b>STAR GAZER</b><span>New here? I can show you around the map in three quick steps.</span></p>
      <button type="button" class="ghost" data-landing="tour">QUICK TOUR</button>
    </aside>
    <section class="landing-forms" hidden>
      <form class="landing-form" data-form="signin" hidden>
        <h2>SIGN IN</h2>
        <label>Pilot name <input name="pilot" autocomplete="username" required maxlength="20" spellcheck="false"></label>
        <label>Password <input name="password" type="password" autocomplete="current-password" required minlength="12"></label>
        <button type="submit">SIGN IN</button>
        <p class="landing-msg" role="status"></p>
      </form>
      <form class="landing-form" data-form="signup" hidden>
        <h2>JOIN THE EXPLORER REGISTRY</h2>
        <label>Pilot name <small>3 to 20 letters, digits or dashes</small>
          <input name="pilot" autocomplete="username" required minlength="3" maxlength="20" spellcheck="false"
                 pattern="[A-Za-z0-9][A-Za-z0-9\\-]{1,18}[A-Za-z0-9]"></label>
        <label>Password <small>12 characters or more</small>
          <input name="password" type="password" autocomplete="new-password" required minlength="12"></label>
        <label>Password again <input name="again" type="password" autocomplete="new-password" required minlength="12"></label>
        <label class="landing-check"><input name="terms" type="checkbox" required> I agree to the Terms of Use</label>
        <p class="landing-warn">There is no email, so there is no reset link: write your password down.</p>
        <button type="submit">JOIN</button>
        <p class="landing-msg" role="status"></p>
      </form>
    </section>
    <section>
      <h2>YOUR JOURNEY</h2>
      <div class="landing-cards landing-four">${landingCards(LANDING_FEATURES)}</div>
    </section>
    <section class="landing-so-far">
      <h2>YOUR EXPLORER SO FAR</h2>
      ${landingStats()}
    </section>
    <section>
      <h2>WHY IT EXISTS</h2>
      <p>Every star NASA's Kepler telescope watched for planets, with its confirmed planets and its candidates, drawn
        as a map you can explore. Star Gazer, the AI behind the map, reads each signal and predicts which candidates
        are real planets. Explore, collect easter eggs, and see whether your calls beat the AI's.</p>
    </section>
    <section>
      <h2>YOUR DISCOVERIES BELONG TO YOU</h2>
      <div class="landing-cards">${landingCards(LANDING_CARDS)}</div>
    </section>
    <section class="landing-lists">
      <div><h2>WHAT AN ACCOUNT WILL SAVE</h2><ul class="landing-saved">${LANDING_SAVED.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>
      <div><h2>WHAT IS NOT SAVED</h2><ul class="landing-not">${LANDING_NOT_SAVED.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
        <p class="landing-small">The hosting provider keeps its own standard server logs, under its own privacy
          policy.</p></div>
    </section>
    <section>
      <h2>HOW ACCOUNTS ARE PROTECTED</h2>
      <div class="landing-cards">${landingCards(LANDING_PROTECTION)}</div>
    </section>
    <p class="landing-preview">PREVIEW · the Explorer Registry is being built and tested, and opens in a later version.</p>
  </div>`;
}

function showLanding() {
  if (document.getElementById('landing')) return;
  const box = Object.assign(document.createElement('div'), { id: 'landing', className: 'landing' });
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'landing-title');
  box.innerHTML = landingMarkup();
  document.body.appendChild(box);
  document.body.classList.add('landing-open');
  paintIcons(box);
  paintRankArt(box);
  const forms = box.querySelector('.landing-forms');
  const openForm = name => {
    forms.hidden = false;
    box.querySelectorAll('.landing-form').forEach(f => { f.hidden = f.dataset.form !== name; });
    const form = box.querySelector(`[data-form="${name}"]`);
    form.scrollIntoView({ block: 'center', behavior: REDUCED_MOTION ? 'auto' : 'smooth' });
    form.querySelector('input').focus({ preventScroll: true });
  };
  box.addEventListener('click', e => {
    const act = e.target.closest('[data-landing]')?.dataset.landing;
    if (act === 'play') closeLanding();
    else if (act === 'tour') { closeLanding(); showTourStep(0); }
    else if (act === 'signin' || act === 'signup') openForm(act);
  });
  box.querySelectorAll('.landing-form').forEach(form => form.addEventListener('submit', e => {
    e.preventDefault();
    const msg = form.querySelector('.landing-msg');
    if (form.dataset.form === 'signup' && form.elements.password.value !== form.elements.again.value) {
      msg.textContent = 'The two passwords differ.';
      return;
    }
    msg.textContent = 'Accounts are not open yet: this is a preview. Your progress is still kept in this browser.';
  }));
  box.addEventListener('keydown', e => { if (e.key === 'Escape') closeLanding(); });
  box.querySelector('[data-landing="play"]').focus({ preventScroll: true });
}

function closeLanding() {
  document.getElementById('landing')?.remove();
  document.body.classList.remove('landing-open');
  document.getElementById('query')?.focus({ preventScroll: true });
}

const landingOpen = () => !!document.getElementById('landing');

queueMicrotask(() => { if (/[?&]landing\b/.test(location.search)) showLanding(); });
