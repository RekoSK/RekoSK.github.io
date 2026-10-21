/* rekosk.dev: the stickers' rotate handle, and the eyes sticker's blinks (with the blink counter) */
'use strict';

rekoSite.part((site) => {
  const { $, $$, sfx, playSound, fadeSound, ui, board, eyesStk, tryMergeEyes, loaderCheck, armed } = site;

  /* ---------- rotate handle: hover a sticker, grab the little arrow at its bottom-right corner and turn it ---------- */
  $$('.stk', board).forEach((el) => {
    const h = document.createElement('span');
    h.className = 'rot-h';
    h.setAttribute('role', 'button');
    h.setAttribute('aria-label', 'Rotate');
    h.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9a8 8 0 0 1 13.5-2.5"/><path d="M18.5 3v4h-4"/><path d="M19 15a8 8 0 0 1-13.5 2.5"/><path d="M5.5 21v-4h4"/></svg>';
    el.appendChild(h);
    h.style.setProperty('--hs', '0');
    // proximity: hover the sticker to arm the button; it stays full size while the cursor is close
    // and shrinks away as the cursor moves off, until you hover the sticker again
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      el.classList.add('armed');
      el._handles.forEach((x) => x.style.setProperty('--hs', '1'));
      armed.add(el);
    });
    el._rotH = h;
    // scale handle: top-right corner, drag away from / toward the centre to grow / shrink
    const sh = document.createElement('span');
    sh.className = 'rot-h sc-h';
    sh.setAttribute('role', 'button');
    sh.setAttribute('aria-label', 'Resize');
    sh.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4l-6.5 6.5"/><path d="M10 20H4v-6"/><path d="M4 20l6.5-6.5"/></svg>';
    el.appendChild(sh);
    sh.style.setProperty('--hs', '0');
    el._handles = [h, sh];
    let sc = null;
    sh.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation(); e.preventDefault();
      const r = el.getBoundingClientRect();
      const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      sc = { id: e.pointerId, c, d0: Math.max(10, Math.hypot(e.clientX - c.x, e.clientY - c.y)), s0: parseFloat(el.style.getPropertyValue('--sz')) || 1, ls: 0, lt: performance.now() };
      sc.ls = sc.s0;
      sh.setPointerCapture(e.pointerId);
      el.style.zIndex = String(++site.zTop);
      el.classList.add('scaling');
      try { ui.play('grab'); ui.motionStart(); } catch (err) {}
    });
    sh.addEventListener('pointermove', (e) => {
      if (!sc || sc.id !== e.pointerId) return;
      const d = Math.hypot(e.clientX - sc.c.x, e.clientY - sc.c.y);
      const z = Math.max(0.5, Math.min(2.5, sc.s0 * d / sc.d0));
      el.style.setProperty('--sz', z.toFixed(3));
      const now = performance.now();
      try { ui.motionMove(Math.abs(z - sc.ls) / Math.max(8, now - sc.lt) * 400, Math.min(1, (z - 0.5) / 2)); } catch (err) {}
      sc.ls = z; sc.lt = now;
    });
    const scEnd = (e) => {
      if (!sc || sc.id !== e.pointerId) return;
      sc = null;
      el.classList.remove('scaling');
      try { ui.motionStop(); if (!(el === eyesStk && tryMergeEyes())) ui.play('drop'); } catch (err) {}
    };
    sh.addEventListener('pointerup', scEnd);
    sh.addEventListener('pointercancel', scEnd);
    let rot = null;
    const ang = (e, c) => Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180 / Math.PI;
    h.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation(); e.preventDefault(); // don't start a drag
      const r = el.getBoundingClientRect();
      const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; // the centre doesn't move while rotating
      const cur = parseFloat(el.style.getPropertyValue('--rot')) || parseFloat(getComputedStyle(el).getPropertyValue('--rot')) || 0;
      rot = { id: e.pointerId, c, a0: ang(e, c), r0: cur };
      h.setPointerCapture(e.pointerId);
      el.style.zIndex = String(++site.zTop);
      rot.la = rot.a0; rot.lt = performance.now();
      el.classList.add('rotating');
      try { ui.play('grab'); ui.motionStart(); } catch (err) {}
    });
    h.addEventListener('pointermove', (e) => {
      if (!rot || rot.id !== e.pointerId) return;
      const a = ang(e, rot.c);
      el.style.setProperty('--rot', (rot.r0 + a - rot.a0).toFixed(1) + 'deg');
      if (el.classList.contains('stk-load')) loaderCheck(el); // starts loading as soon as it's turned far enough, no need to let go
      // a whoosh that follows how fast you turn; its pitch follows the sticker's angle
      const now = performance.now();
      let d = Math.abs(a - rot.la); if (d > 180) d = 360 - d;
      try { ui.motionMove(d / Math.max(8, now - rot.lt) * 6, (Math.sin(a * Math.PI / 180) + 1) / 2); } catch (err) {}
      rot.la = a; rot.lt = now;
    });
    const end = (e) => {
      if (!rot || rot.id !== e.pointerId) return;
      rot = null;
      el.classList.remove('rotating');
      if (el.classList.contains('stk-load')) loaderCheck(el);
      try { ui.motionStop(); ui.play('drop'); } catch (err) {}
    };
    h.addEventListener('pointerup', end);
    h.addEventListener('pointercancel', end);
  });

  // the eyes sticker blinks on hover: play the video's blink with it (the CSS blink uses the video's timing)
  // ...and count the blinks: 200 in one visit (resets on reload) completes "Blinker"
  let blinks = 0;
  // blink counter under the eyes sticker (started as debug, kept on purpose)
  const dbgBlinks = document.createElement('span'); dbgBlinks.className = 'dbg-blinks'; dbgBlinks.textContent = '0'; $('.stk-eyes').appendChild(dbgBlinks);
  let blinkAt = 0;
  $('.stk-eyes').addEventListener('pointerleave', () => { if (performance.now() - blinkAt < 360) fadeSound(sfx.blink, 0.12); });
  $('.stk-eyes').addEventListener('pointerenter', () => {
    blinkAt = performance.now();
    playSound('blink');
    if (++blinks >= 200) site.ach.unlock('about-blink');
    dbgBlinks.textContent = blinks;
  });
});
