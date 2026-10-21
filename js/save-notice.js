/* rekosk.dev: the save-file notice: a window about what the site keeps in localStorage */
'use strict';

rekoSite.part((site) => {
  const { $, ui, makeWin, toFront } = site;
  site.share({ NOTICE_KEY: () => NOTICE_KEY });

  /* ---------- save-file notice: a window about what the site keeps in localStorage ----------
     Pops up once, the first time the site saves something (an achievement, or the Sound on / off choice: both fire
     "reko:saved"); if that happens during the intro it waits until the intro is over. NOTICE_KEY remembers it was
     closed; "Reset achievements" in the Achievements window forgets it, so it pops up again on the next save. The
     footer's "Saved data" button reopens it. Wiping progress is that reset button, which the notice links to. */
  const NOTICE_KEY = 'reko-notice';
  (() => {
    const win = $('#saveWin');
    if (!win) return;
    const sw = makeWin(win);
    new MutationObserver(() => { if (!win.hidden) toFront(win); }).observe(win, { attributes: true, attributeFilter: ['hidden'] });
    const seen = () => { try { return localStorage.getItem(NOTICE_KEY) === 'seen'; } catch (err) { return true; } }; // storage blocked: nothing gets saved, nothing to tell
    const open = () => { if (!win.hidden) { toFront(win); return; } sw.open(); try { ui.play('popIn'); } catch (err) {} };
    // closing it either way (x or "Got it!") counts as read
    new MutationObserver(() => { if (win.hidden) try { localStorage.setItem(NOTICE_KEY, 'seen'); } catch (err) { /* storage blocked */ } })
      .observe(win, { attributes: true, attributeFilter: ['hidden'] });
    let pending = false;
    const popSoon = () => { pending = false; setTimeout(() => { if (win.hidden && !seen()) open(); }, 1400); }; // after the achievement toast has popped in
    document.addEventListener('reko:saved', () => {
      if (pending || seen()) return;
      if (site.phase === 'done') popSoon(); else pending = true;
    });
    document.addEventListener('reko:intro-done', () => { if (pending) popSoon(); });
    const footBtn = $('.foot-save');
    if (footBtn) footBtn.addEventListener('click', open);
    $('.save-ok', win).addEventListener('click', sw.close);
    $('.save-link', win).addEventListener('click', sw.close); // it opens the Achievements window instead (data-win)
  })();
});
