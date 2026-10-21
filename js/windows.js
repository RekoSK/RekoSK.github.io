/* rekosk.dev: the site's movable, resizable windows (Achievements, the save-file notice, photos, bossfight.exe).
   js/bossfight.js uses makeWin and toFront through window.rekoMakeWin and window.rekoToFront. */
'use strict';

rekoSite.part((site) => {
  const { $, $$, ui } = site;
  site.share({ makeWin: () => makeWin, achWin: () => achWin, toFront: () => toFront, rzSound: () => rzSound });

  // a movable, resizable "program" window (Achievements, the save-file notice): drag the orange bar, pull any edge or
  // corner to resize; only the x (or the window's own buttons) closes it, never Escape. Returns { open, close }
  function makeWin(win) {
    const bar = $('.win-bar', win);
    let wx = null, wy = null, mv = null;
    const place = () => {
      const w = win.offsetWidth;
      wx = Math.max(-w + 80, Math.min(innerWidth - 80, wx));   // always keep part of it on screen
      wy = Math.max(0, Math.min(innerHeight - 44, wy));
      win.style.translate = `${wx}px ${wy}px`;
    };
    const openWin = () => {
      win.hidden = false;
      win.classList.remove('closing');
      if (wx === null) { wx = (innerWidth - win.offsetWidth) / 2; wy = Math.max(80, (innerHeight - win.offsetHeight) / 2); }
      place();
    };
    const closeWin = () => {
      if (win.hidden || win.classList.contains('closing')) return;
      win.classList.add('closing');
      try { ui.play('tick'); } catch (err) {}
      setTimeout(() => { win.hidden = true; win.classList.remove('closing'); }, 200);
    };
    $('.win-x', win).addEventListener('click', closeWin);
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.win-x')) return;
      mv = { id: e.pointerId, ox: e.clientX - wx, oy: e.clientY - wy };
      bar.setPointerCapture(e.pointerId);
      win.classList.add('moving');
      e.preventDefault();
    });
    bar.addEventListener('pointermove', (e) => { if (!mv || mv.id !== e.pointerId) return; wx = e.clientX - mv.ox; wy = e.clientY - mv.oy; place(); });
    const up = (e) => { if (!mv || mv.id !== e.pointerId) return; mv = null; win.classList.remove('moving'); };
    bar.addEventListener('pointerup', up);
    bar.addEventListener('pointercancel', up);
    window.addEventListener('resize', () => { if (!win.hidden) place(); });
    // pull any edge or corner to resize it
    let rz = null;
    const winRz = rzSound(win);
    $$('.win-rz', win).forEach((h) => {
      h.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        rz = { id: e.pointerId, d: h.dataset.d, sx: e.clientX, sy: e.clientY, x: wx, y: wy, w: win.offsetWidth, h: win.offsetHeight };
        h.setPointerCapture(e.pointerId);
        win.classList.add('sizing');
        winRz.start();
        e.preventDefault(); e.stopPropagation();
      });
      h.addEventListener('pointermove', (e) => {
        if (!rz || rz.id !== e.pointerId) return;
        const dx = e.clientX - rz.sx, dy = e.clientY - rz.sy, MINW = 280, MINH = 180;
        let { x, y, w, h: hh } = rz;
        if (rz.d.includes('e')) w = Math.min(innerWidth, Math.max(MINW, rz.w + dx));
        if (rz.d.includes('s')) hh = Math.min(innerHeight, Math.max(MINH, rz.h + dy));
        if (rz.d.includes('w')) { w = Math.min(innerWidth, Math.max(MINW, rz.w - dx)); x = rz.x + rz.w - w; }
        if (rz.d.includes('n')) { hh = Math.min(innerHeight, Math.max(MINH, rz.h - dy)); y = rz.y + rz.h - hh; }
        win.style.width = w + 'px'; win.style.height = hh + 'px';
        wx = x; wy = y; place();
        winRz.move((/[ew]/.test(rz.d) && (w === MINW || w === innerWidth)) || (/[ns]/.test(rz.d) && (hh === MINH || hh === innerHeight)));
      });
      const end = (e) => { if (!rz || rz.id !== e.pointerId) return; rz = null; win.classList.remove('sizing'); winRz.end(); };
      h.addEventListener('pointerup', end);
      h.addEventListener('pointercancel', end);
    });
    return { open: openWin, close: closeWin };
  }

  // resizing any window (photo, video, Achievements): a grab, then a soft whoosh that follows how fast it changes size and
  // gets deeper the bigger the window is, a tick when it hits its smallest / biggest size, and a click when you let go
  function rzSound(win) {
    let lw = 0, lh = 0, lt = 0, edge = false;
    return {
      start() { lw = win.offsetWidth; lh = win.offsetHeight; lt = performance.now(); edge = false; try { ui.play('grab'); ui.motionStart(); } catch (err) {} },
      move(atLimit) {
        const now = performance.now(), nw = win.offsetWidth, nh = win.offsetHeight;
        const speed = (Math.abs(nw - lw) + Math.abs(nh - lh)) / Math.max(8, now - lt);
        const size = Math.min(1, Math.sqrt((nw * nh) / (innerWidth * innerHeight)));
        try { ui.motionMove(speed, 1 - size); if (atLimit && !edge) ui.play('tick', 1200, 0.05); } catch (err) {}
        edge = atLimit; lw = nw; lh = nh; lt = now;
      },
      end() { try { ui.motionStop(); ui.play('tick', 1700, 0.06); } catch (err) {} },
    };
  }

  // Achievements tab: opens its window instead of scrolling to a section
  const achWin = $('#achWin');
  if (achWin) {
    const achW = makeWin(achWin);
    $$('[data-win="ach"]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); achW.open(); }));
  }
  window.rekoMakeWin = makeWin;


  // clicking any window (photos, Achievements, ...) brings it to the front
  let winZ = 95; // .win z-index; .ach-card / .ach-toasts sit above every window (960 / 970 in css)
  const toFront = (w) => {
    if (winZ > 95 && +w.style.zIndex === winZ) return;
    if (winZ > 900) { winZ = 95; $$('.win').sort((a, b) => (+a.style.zIndex || 95) - (+b.style.zIndex || 95)).forEach((x) => { x.style.zIndex = ++winZ; }); }
    w.style.zIndex = ++winZ;
  };
  document.addEventListener('pointerdown', (e) => { const w = e.target.closest('.win'); if (w) toFront(w); }, true);
  window.rekoToFront = toFront; // js/bossfight.js brings its window to the front with it
  if (achWin) new MutationObserver(() => { if (!achWin.hidden) toFront(achWin); }).observe(achWin, { attributes: true, attributeFilter: ['hidden'] });
});
