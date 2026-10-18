// The loading screen shows one of two scenes, picked at random on each visit (art: scripts/starmap/make_loading_art.py).
// It runs straight after the loading box in index.html, before the star map's own script; without it, the rocket shows.
(function () {
  'use strict';
  var scenes = [
    { gif: 'loading.gif', still: 'loading-still.png', title: 'LAUNCHING 3,600+ STARS...',
      fact: 'Kepler itself launched on a Delta II rocket from Cape Canaveral on 7 March 2009, and spent the next nine years hunting planets.' },
    { gif: 'loading-astronomer.gif', still: 'loading-astronomer-still.png', title: 'SCANNING 3,600+ STARS...',
      fact: 'Kepler did what astronomers at their telescopes do, only for longer: it stared at the same 150,000 stars for four years, waiting for them to dim.' },
  ];
  var box = document.getElementById('loading');
  if (!box) return;
  var pick = scenes[Math.floor(Math.random() * scenes.length)];
  box.querySelector('img').src = pick.gif;
  box.querySelector('source').srcset = pick.still;
  box.querySelector('.loading-title').textContent = pick.title;
  box.querySelector('.loading-fact').textContent = pick.fact;
}());
