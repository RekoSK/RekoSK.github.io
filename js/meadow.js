/* ---------- meadow grass on the offline map: hold the left button and move over it → the blades bend away ---------- */
'use strict';

rekoSite.part((site) => {
  const art = document.querySelector('#offMap .map-art');
  const grass = art && art.querySelector('.map-grass');
  if (!grass) return;
  const stage = art.closest('.map-stage');
  const offMap = art.closest('#offMap');
  const tufts = Array.from(grass.querySelectorAll('.gt')).map((g) => {
    const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g.parentNode.getAttribute('transform'));
    return { g, x: +m[1], y: +m[2], t: 0 };
  });
  const R = 34; // reach of the "hand", in map units (the map is 500 × 400)
  let down = false, lastX = null, lastSnd = 0, live = 0;
  // small orange specks that flick up out of the grass
  const fx = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  fx.setAttribute('class', 'grass-fx');
  grass.parentNode.appendChild(fx);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const spark = (tf, dir) => {
    if (reduce || live > 40) return;
    const n = 1 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      const r = 1 + Math.random() * 1.2;
      c.setAttribute('cx', (tf.x + (Math.random() - 0.5) * 8).toFixed(1));
      c.setAttribute('cy', (tf.y - 6 - Math.random() * 5).toFixed(1));
      c.setAttribute('r', r.toFixed(1));
      fx.appendChild(c);
      live++;
      const tx = dir * (6 + Math.random() * 14), ty = -(10 + Math.random() * 16);
      const an = c.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${tx * 0.6}px,${ty}px) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${tx}px,${ty * 0.55}px) scale(.3)`, opacity: 0 }
      ], { duration: 520 + Math.random() * 380, easing: 'cubic-bezier(.2,.7,.4,1)' });
      an.onfinish = () => { c.remove(); live--; };
    }
  };
  const sweep = (e) => {
    const ctm = art.getScreenCTM();
    if (!ctm) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const vx = lastX == null ? 0 : pt.x - lastX;
    lastX = pt.x;
    let hit = 0;
    tufts.forEach((tf) => {
      const dx = tf.x - pt.x, dy = tf.y - 5 - pt.y, dist = Math.hypot(dx, dy);
      if (dist > R) return;
      const k = 1 - dist / R;
      // lean away from the cursor, a bit more in the direction it's moving
      const dir = Math.sign(dx || vx || 1);
      const ang = Math.max(-62, Math.min(62, dir * k * 55 + Math.max(-14, Math.min(14, vx * 2.2)) * k));
      if (!tf.g.classList.contains('pushed')) { hit = Math.max(hit, k); spark(tf, dir); }
      // "Touch grass" — only with empty hands (not while carrying a fish)
      if (!offMap.classList.contains('fish-holding') && site.ach) site.ach.unlock('off-grass');
      tf.g.classList.add('pushed');
      tf.g.style.setProperty('--bend', ang.toFixed(1) + 'deg');
      tf.g.style.setProperty('--squash', (1 - k * 0.35).toFixed(2));
      clearTimeout(tf.t);
      tf.t = setTimeout(() => { // spring back up once the cursor has passed
        tf.g.classList.remove('pushed');
        tf.g.style.removeProperty('--bend');
        tf.g.style.removeProperty('--squash');
      }, 160);
    });
    // a soft rustle for freshly brushed grass (not more often than every 70 ms)
    const now = performance.now();
    if (hit > 0 && now - lastSnd > 70 && site.playSfx) { lastSnd = now; site.playSfx('rustle', Math.min(1, hit + Math.abs(vx) / 12)); }
  };
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, .spot-card')) return; // pressing the flag (or any point / card) leaves the grass alone
    down = true; lastX = null;
    stage.classList.add('sweeping'); // the points (flag, labels) ignore the cursor while the grass is being brushed
    e.preventDefault(); // no text selection while sweeping
    sweep(e);
  });
  stage.addEventListener('pointermove', (e) => { if (down && (e.buttons & 1)) sweep(e); });
  const lift = () => { down = false; lastX = null; stage.classList.remove('sweeping'); };
  window.addEventListener('pointerup', lift);
  window.addEventListener('pointercancel', lift);
});
