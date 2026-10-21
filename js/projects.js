/* rekosk.dev: the Projects section: card tilt + spotlight, locked "Coming soon." cards and the featured DJ disc */
'use strict';

rekoSite.part((site) => {
  const { $, $$, ui } = site;

  /* ---------- project cards: 3D tilt + spotlight ---------- */
  $$('.card').forEach((el) => {
    let lastX = 0, lastY = 0, lastT = 0;
    el.addEventListener('mouseenter', (e) => {
      lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
      ui.motionStart();
    });
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      const now = performance.now();
      const speed = Math.hypot(e.clientX - lastX, e.clientY - lastY) / Math.max(8, now - lastT);
      lastX = e.clientX; lastY = e.clientY; lastT = now;
      ui.motionStart();
      ui.motionMove(speed, x); // the tilt "whooshes" with the movement
      el.style.setProperty('--ry', ((x - 0.5) * 9).toFixed(2) + 'deg');
      el.style.setProperty('--rx', ((0.5 - y) * 7).toFixed(2) + 'deg');
      el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
    });
    el.addEventListener('mouseleave', () => {
      ui.motionStop();
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  });


  /* ---------- locked projects ("Coming soon.") ----------
     .card.locked: the card is blurred under a dark veil with "Coming soon." and a steel chain hanging in a U from its
     top corners, a padlock at the lowest point (redrawn to fit whenever the card changes size).
     Clicking it anywhere shakes the card, flashes it red and plays the locked buzz (like locked achievement steps). */
  const LOCK_G = '<path d="M15 30V20a13 13 0 0 1 26 0v10" stroke="#0b0b0b" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M15 30V20a13 13 0 0 1 26 0v10" stroke="#5b6067" stroke-width="3.6" fill="none" stroke-linecap="round"/><rect x="5" y="28" width="46" height="33" rx="7" fill="#3a3e43" stroke="#0b0b0b" stroke-width="2.4"/><path d="M11 33.5h34" stroke="#575c62" stroke-width="2" stroke-linecap="round"/><circle cx="28" cy="43" r="4.2" fill="#0b0b0b"/><path d="M26.2 45h3.6l1.2 8h-6z" fill="#0b0b0b"/>';
  function hangChain(veil) {
    const w = veil.clientWidth, h = veil.clientHeight;
    if (!w || !h) return;
    const x0 = -8, x1 = w + 8, y0 = h * 0.22, sag = h * 0.56; // hung from just past the top corners
    const at = (t) => [x0 + (x1 - x0) * t, y0 + sag * (1 - (2 * t - 1) ** 2)];
    let links = '', run = 0, k = 0, [px, py] = at(0);
    for (let i = 1; i <= 600; i++) { // walk the curve, one link every 11px of chain
      const [x, y] = at(i / 600);
      run += Math.hypot(x - px, y - py);
      if (run >= 11) {
        run = 0;
        const t = `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(Math.atan2(y - py, x - px) * 180 / Math.PI).toFixed(1)})`;
        links += k++ % 2 ? `<line x1="-7" x2="7" transform="${t}"/>` : `<ellipse rx="8.5" ry="4.8" transform="${t}"/>`;
      }
      px = x; py = y;
    }
    const s = Math.max(38, Math.min(50, w * 0.09)) / 56; // padlock size follows the card
    veil.querySelector('.chain-svg').innerHTML = `<g class="cl-out">${links}</g><g class="cl-in">${links}</g>`
      + `<g transform="translate(${(w / 2 - 28 * s).toFixed(1)} ${(y0 + sag - 8 * s).toFixed(1)}) scale(${s.toFixed(3)})"><g class="lk">${LOCK_G}</g></g>`;
  }
  $$('.card.locked').forEach((el) => {
    const veil = document.createElement('div');
    veil.className = 'lock-veil';
    veil.innerHTML = '<svg class="chain-svg" aria-hidden="true"></svg><span class="lock-txt">Coming soon.</span>';
    $('.card-in', el).append(veil);
    if ('ResizeObserver' in window) new ResizeObserver(() => hangChain(veil)).observe(veil);
    else hangChain(veil);
    let off = 0;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      el.classList.remove('deny'); void el.offsetWidth; el.classList.add('deny');
      clearTimeout(off); off = setTimeout(() => el.classList.remove('deny'), 950); // back to the slow sway
      try { ui.play('error'); } catch (err) {}
    });
  });

  /* ---------- featured disc: grab it and scratch it like a DJ ----------
     The "FEATURED" badge spins like a record. Hold it and turn it back and forth to scratch (the scratch sound
     follows the disc's speed and direction; a still hand stops the record). Let go and the motor pulls it back to speed. */
  $$('.badge').forEach((el) => {
    const IDLE = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 360 / 14; // deg/s, same as the old CSS spin
    let rot = 0, vel = IDLE, prev = 0, held = false, ang = 0, last = 0, raf = 0, seen = false;
    let stroke = 0, flips = 0; // "DJ" achievement: back-and-forth strokes (of 15°+) in one hold
    el.classList.add('disc');
    const at = (e) => {
      const r = el.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
    };
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (held) {
        if (dt > 0) vel += ((rot - prev) / dt - vel) * Math.min(1, dt * 25); // smoothed hand speed
        prev = rot;
        ui.scratchMove(vel / 300); // ~300 deg/s of hand = normal record speed
      } else {
        vel += (IDLE - vel) * Math.min(1, dt * 2.5);
        rot += vel * dt;
      }
      el.style.transform = `rotate(${rot.toFixed(2)}deg)`;
      raf = (seen || held) ? requestAnimationFrame(frame) : 0;
    };
    const run = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    new IntersectionObserver(([en]) => { seen = en.isIntersecting; if (seen) run(); }).observe(el);
    el.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      e.preventDefault(); e.stopPropagation();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      held = true; ang = at(e); prev = rot; vel = 0; stroke = 0; flips = 0;
      el.classList.add('scr');
      run();
    });
    el.addEventListener('pointermove', (e) => {
      if (!held) return;
      const a = at(e);
      let d = a - ang; d -= Math.round(d / 360) * 360; // the short way round
      ang = a; rot += d;
      // a real scratch = turning it one way, then back, a few times: 4 direction changes ends the 5th stroke
      if (d && stroke && Math.sign(d) !== Math.sign(stroke)) {
        if (Math.abs(stroke) >= 15 && ++flips >= 4) site.ach.unlock('proj-dj');
        stroke = 0;
      }
      stroke += d;
    });
    const up = () => { if (!held) return; held = false; el.classList.remove('scr'); ui.scratchStop(); };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => el.addEventListener(t, up));
  });
});
