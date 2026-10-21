/* rekosk.dev: the magnifying glass sticker (and how big a sticker's button gets near the cursor) */
'use strict';

rekoSite.part((site) => {
  const { $, $$, board, aboutSec } = site;
  site.share({ armed: () => armed });

  /* ---------- magnifying glass: drag it around the About section and it shows everything under it bigger ----------
     A round window that follows the lens holds a live copy of the whole About grid (text, boxes, terminal, stickers),
     scaled up around the lens centre. The window lives in the section (not in the sticker), so the copy is styled
     exactly like the real thing. To keep the copy in step without re-copying all the time:
     - sticker moves / JS-driven styles: inline styles are mirrored every frame
     - animations (scrolling logos, typing caret, pop-ins): the copy's animations are set to the same point in time
     - scroll positions (terminal) and typed text are carried over */
  const magStk = $('.stk-mag', board);
  const magSrc = $('.about-grid', aboutSec);
  if (magStk && magSrc) {
    const lens = $('.mag-lens', magStk);
    const ov = document.createElement('div');
    ov.className = 'mag-ov';
    ov.setAttribute('aria-hidden', 'true');
    aboutSec.appendChild(ov);
    const ZOOM = 1.9, RING = 9;
    let copy = null, dirty = true, lastClone = 0, live = false, pairs = [], scrollPairs = [], inputPairs = [];
    const makeCopy = () => {
      const c = magSrc.cloneNode(true);
      // walk both trees side by side (before removing anything) so every real element knows its copy
      const srcEls = [magSrc, ...magSrc.querySelectorAll('*')], cpEls = [c, ...c.querySelectorAll('*')];
      const toSrc = new Map();
      pairs = []; scrollPairs = []; inputPairs = [];
      srcEls.forEach((el, i) => {
        const cp = cpEls[i];
        if (magStk.contains(el)) return;
        toSrc.set(cp, el);
        if (i) pairs.push([el, cp, el.getAttribute('style')]); // (the copy's own root gets its size/position from tick)
        if (el.scrollTop || el.scrollLeft || el.matches('.term, .lang-strip')) scrollPairs.push([el, cp]);
        if (el.matches('input, textarea')) inputPairs.push([el, cp]);
      });
      const cpMag = $('.stk-mag', c);
      if (cpMag) cpMag.remove();
      $$('[id]', c).forEach((n) => n.removeAttribute('id'));
      $$('[tabindex]', c).forEach((n) => n.setAttribute('tabindex', '-1'));
      c.inert = true;
      c.classList.add('mag-copy');
      c.style.width = magSrc.offsetWidth + 'px';
      if (copy) copy.remove();
      ov.prepend(c);
      copy = c; dirty = false; lastClone = performance.now();
      inputPairs.forEach(([el, cp]) => { cp.value = el.value; });
      // line the copy's animations up with the real ones; one-off animations that already ended on the page are skipped
      try {
        const srcAnims = magSrc.getAnimations({ subtree: true });
        c.getAnimations({ subtree: true }).forEach((an) => {
          const fx = an.effect, el = fx && toSrc.get(fx.target);
          const match = el && srcAnims.find((sa) => sa.effect && sa.effect.target === el && sa.effect.pseudoElement === fx.pseudoElement && sa.animationName === an.animationName);
          if (match) { an.currentTime = match.currentTime; if (match.playState === 'paused') an.pause(); }
          else if (fx.getComputedTiming().endTime !== Infinity) an.finish();
        });
      } catch (err) {}
      syncCopy();
    };
    const syncCopy = () => {
      for (const pr of pairs) {
        const st = pr[0].getAttribute('style');
        if (st !== pr[2]) { pr[2] = st; if (st == null) pr[1].removeAttribute('style'); else pr[1].setAttribute('style', st); }
      }
      if (copy) copy.style.width = magSrc.offsetWidth + 'px';
      scrollPairs.forEach(([el, cp]) => { cp.scrollTop = el.scrollTop; cp.scrollLeft = el.scrollLeft; });
      inputPairs.forEach(([el, cp]) => { if (cp.value !== el.value) cp.value = el.value; });
    };
    // re-copy when the section's content changes (a box opened, a logo picked, terminal output …), at most every 150 ms;
    // changes on the magnifier itself don't count
    new MutationObserver((recs) => {
      if (recs.some((r) => !magStk.contains(r.target))) dirty = true;
    }).observe(magSrc, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-expanded', 'hidden', 'src'], characterData: true });
    const tick = () => {
      if (!live) return;
      requestAnimationFrame(tick);
      const lr = lens.getBoundingClientRect(), sr = aboutSec.getBoundingClientRect();
      const gone = !magStk.isConnected || magStk.classList.contains('poof') || lr.width < 4;
      const over = !gone && lr.right > sr.left && lr.left < sr.right && lr.bottom > sr.top && lr.top < sr.bottom;
      magStk.classList.toggle('mag-on', over);
      ov.classList.toggle('on', over);
      if (!over) return;
      if (!copy || (dirty && performance.now() - lastClone > 150)) makeCopy();
      else syncCopy();
      const tr = magSrc.getBoundingClientRect();
      const sc = parseFloat(getComputedStyle(magStk).scale) || 1;
      const cx = lr.left + lr.width / 2, cy = lr.top + lr.height / 2;
      const R = Math.max(4, (lens.offsetWidth / 2 - RING) * sc); // (the lens' box is turned, so size it from its own width)
      ov.style.cssText = `left:${(cx - R - sr.left).toFixed(1)}px;top:${(cy - R - sr.top).toFixed(1)}px;width:${(2 * R).toFixed(1)}px;height:${(2 * R).toFixed(1)}px`;
      // screen point P shows up at C + ZOOM·(P − C)
      copy.style.transform = `translate(${(R + ZOOM * (tr.left - cx)).toFixed(1)}px, ${(R + ZOOM * (tr.top - cy)).toFixed(1)}px) scale(${ZOOM})`;
      // the lens' centre over a finished neofetch / fastfetch output (where it shows in the terminal) zooms in on it
      $$('.ff.ff-done', magSrc).some((ff) => {
        const fr = ff.getBoundingClientRect(), term = ff.closest('.term'), vr = term ? term.getBoundingClientRect() : fr;
        const hit = cx > Math.max(fr.left, vr.left) && cx < Math.min(fr.right, vr.right) && cy > Math.max(fr.top, vr.top) && cy < Math.min(fr.bottom, vr.bottom);
        if (hit) document.dispatchEvent(new CustomEvent('reko:mag-fetch'));
        return hit;
      });
      // ... and over the Python logo in the open Programming languages box (where it shows in its strip)
      const langBox = $('#favBox', magSrc);
      if (langBox && langBox.classList.contains('open')) {
        const strip = $('.lang-strip', langBox), vr = strip && strip.getBoundingClientRect();
        if (vr) $$('.lang-item[aria-label="Python"]', langBox).some((it) => {
          const ir = it.getBoundingClientRect();
          const hit = cx > Math.max(ir.left, vr.left) && cx < Math.min(ir.right, vr.right) && cy > Math.max(ir.top, vr.top) && cy < Math.min(ir.bottom, vr.bottom);
          if (hit) document.dispatchEvent(new CustomEvent('reko:mag-python'));
          return hit;
        });
      }
    };
    new IntersectionObserver((ents) => {
      const vis = ents.some((en) => en.isIntersecting);
      if (vis && !live) { live = true; requestAnimationFrame(tick); } else if (!vis) live = false;
    }).observe(aboutSec);
  }

  const armed = new Set();
  const NEAR = 16, FAR = 52; // px from the button's centre once the cursor is off the sticker: full size inside NEAR, gone beyond FAR
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !armed.size) return;
    armed.forEach((el) => {
      if (el.classList.contains('rotating') || el.classList.contains('scaling')) return; // keep them full while in use
      const hs = el._handles;
      const d = Math.min(...hs.map((h) => { const r = h.getBoundingClientRect(); return Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)); }));
      let k = Math.max(0, Math.min(1, 1 - (d - NEAR) / (FAR - NEAR)));
      if (el.matches(':hover')) k = 1; // always full size while the cursor is on the sticker (or on the button)
      if (k <= 0.04) { el.classList.remove('armed'); armed.delete(el); hs.forEach((h) => h.style.setProperty('--hs', '0')); return; }
      hs.forEach((h) => h.style.setProperty('--hs', k.toFixed(3)));
    });
  }, { passive: true });
});
