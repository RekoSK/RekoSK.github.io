/* rekosk.dev: the last part of the page's own code: click sounds, the section titles' spray sound, and "go":
   the first greeting and the intro. js/meadow.js, fish.js and reels.js run after it. */
'use strict';

rekoSite.part((site) => {
  const {
    $$, reduceMotion, GREETINGS, gWord, buildWord, soundBtn, sndHint, ui, toTop, startIntro, finishIntro, logoBtn,
    menuBtn, menu, offMap, sizeIntro,
  } = site;

  // lets the map's grass, the fish and the reels (js/meadow.js, fish.js, reels.js) play the site's sounds; the fish's own sounds go quiet while the speaker is in the lake
  site.playSfx = (name, a, b2) => (/^fish/.test(name) && offMap && offMap.classList.contains('lake-muted') ? null : ui.play(name, a, b2));


  // click: a crisp "bloop"; a few controls get their own sound
  document.addEventListener('click', (e) => {
    const el = e.target.closest('a[href], button');
    if (!el) return;
    if (el === soundBtn || el === sndHint || el === logoBtn) return; // handled where they act
    if (el.closest('.ach-head, .ach-card, .ach-toast, .ach-reset')) return; // achievements play their own sounds
    if (el.closest('.map')) return; // so does the map
    if (el === gWord || el.id === 'replay') return ui.play('swish');
    if (el.classList.contains('tl-head')) return ui.play(el.getAttribute('aria-expanded') === 'true' ? 'open' : 'close');
    if (el === menuBtn) return ui.play(menu.hidden ? 'close' : 'open');
    ui.play('pop');
  });

  // section titles: a spray "pssht" as the paint stroke appears (again each time you scroll back to it)
  if ('IntersectionObserver' in window) {
    const shown = new WeakSet();
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting && en.intersectionRatio >= 0.6 && !shown.has(en.target)) {
        shown.add(en.target);
        if (site.phase === 'done') ui.play('reveal');
      } else if (!en.isIntersecting) {
        shown.delete(en.target);
      }
    }), { threshold: [0, 0.6] });
    $$('.sec-title').forEach((t) => io.observe(t));
  }

  /* ---------- go ---------- */
  buildWord(GREETINGS[0]);
  sizeIntro();
  if (location.hash) try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} // no jumping to #section
  toTop();
  window.addEventListener('load', () => { toTop(); requestAnimationFrame(toTop); setTimeout(toTop, 120); }, { once: true });
  if (reduceMotion) finishIntro();
  else startIntro();
  // coming back via back/forward (page restored from cache) counts as a reload too
  window.addEventListener('pageshow', (e) => {
    document.documentElement.style.scrollBehavior = '';
    if (!e.persisted) return;
    toTop();
    if (!reduceMotion) startIntro();
  });
});
