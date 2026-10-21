/* rekosk.dev: the About section's draggable stickers and their tricks (eyes merge, loader, bubble, keycaps, plane,
   sword vs heart, the heavy sign and its crack) and the age sticker */
'use strict';

rekoSite.part((site) => {
  const { $, $$, reduceMotion, playSound, ui } = site;
  site.share({
    board: () => board, aboutSec: () => aboutSec, zTop: [() => zTop, (v) => { zTop = v; }], eyesStk: () => eyesStk,
    tryMergeEyes: () => tryMergeEyes, loaderCheck: () => loaderCheck,
  });

  /* ---------- draggable stickers ----------
     Drag them anywhere in the About section. Drag one out of the section and it poofs away,
     then pops back in where it was before that drag. */
  const board = $('.board');
  const aboutSec = $('#about');
  const stickerPos = new WeakMap();
  let drag = null;
  let zTop = 20;

  function placeSticker(el, p) {
    stickerPos.set(el, p);
    el.style.setProperty('--sx', p.x.toFixed(1) + 'px');
    el.style.setProperty('--sy', p.y.toFixed(1) + 'px');
  }

  /* the eyes sticker can merge into the eyes of the "HELLO my name is" wordmark: scale it down and drop it
     onto them, it sinks in, and the logo turns black from the eyes outward (once; gone until reload) */
  const eyesStk = $('.stk-eyes');
  const tagStk = $('.stk-tag');
  function rectOfAll(list) {
    const rs = list.map((n) => n.getBoundingClientRect());
    const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top));
    const r = Math.max(...rs.map((x) => x.right)), b = Math.max(...rs.map((x) => x.bottom));
    return { x: (l + r) / 2, y: (t + b) / 2, w: r - l };
  }
  function tryMergeEyes() {
    if (!eyesStk || !tagStk || !eyesStk.isConnected || tagStk.classList.contains('blackened')) return false;
    const target = $('.tag-eyes', tagStk);
    const a = rectOfAll($$('.ey', eyesStk));
    const b = rectOfAll([target]);
    const near = Math.hypot(a.x - b.x, a.y - b.y) <= Math.max(16, b.w * 0.7);
    const small = a.w <= b.w * 1.9;
    if (!near || !small) return false;
    mergeEyes(a, b);
    return true;
  }
  function mergeEyes(a, b) {
    const el = eyesStk;
    site.armed.delete(el);
    el.classList.remove('armed', 'drag');
    el.classList.add('merging');
    el.style.zIndex = String(++zTop);
    const p0 = { ...(stickerPos.get(el) || { x: 0, y: 0 }) };
    const z0 = parseFloat(el.style.getPropertyValue('--sz')) || 1;
    const er = el.getBoundingClientRect();
    const o = { x: a.x - (er.left + er.width / 2), y: a.y - (er.top + er.height / 2) }; // eyes' offset from the sticker centre
    const shift = { x: b.x - a.x, y: b.y - a.y };
    const T = 950, t0 = performance.now();
    ui.play('eyesIn');
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    (function step(now) {
      const t = Math.min(1, (now - t0) / T), k = ease(t);
      const z = z0 * (1 - k);                       // shrinks to nothing...
      const keep = 1 - k;                           // ...around the eyes, which glide onto the target
      el.style.setProperty('--sz', Math.max(0.001, z).toFixed(4));
      placeSticker(el, { x: p0.x + shift.x * Math.min(1, k * 1.4) + o.x * (1 - keep), y: p0.y + shift.y * Math.min(1, k * 1.4) + o.y * (1 - keep) });
      el.style.opacity = String(1 - Math.max(0, (k - 0.7) / 0.3));
      // the black starts spreading from the eyes while they are still sinking in: one continuous motion
      if (t >= 0.4 && !tagStk.classList.contains('blackened')) {
        tagStk.classList.add('blackened');
        ui.play('blacken');
        setTimeout(() => site.ach.unlock('about-black'), 2300); // "Black logo", once the black has spread over it
      }
      if (t < 1) requestAnimationFrame(step);
      else el.remove();
    })(t0);
  }

  /* the "loading… 1%" sticker is stuck, until you turn it 90° to the right (percentage pointing down):
     it only loads while it's held at that angle (turn it away and it pauses, blinking, until you turn it back);
     at 100% it fills up green from left to right and says "Completed" */
  const loader = $('.stk-load');
  if (loader) $('.ld-bar i', loader).classList.add('blink');
  const loaderTurned = (el) => {
    const r = (((parseFloat(el.style.getPropertyValue('--rot')) || 0) % 360) + 360) % 360;
    return r >= 60 && r <= 120;                       // roughly 90° clockwise
  };
  function loaderCheck(el) {
    if (el.dataset.state === 'loading' || el.dataset.state === 'done' || !loaderTurned(el)) return;
    el.dataset.state = 'loading';
    const segs = $$('.ld-bar i', el), pc = $('.ld-pc', el);
    const blink = (p) => segs.forEach((sg, i) => sg.classList.toggle('blink', p < 100 && i === Math.floor(p / 10)));
    blink(100); // no blinking while it loads
    (function tick() {
      if (!loaderTurned(el)) { el.dataset.state = 'paused'; blink(el._p || 1); return; } // turned away: stuck again
      const p = el._p = Math.min(100, (el._p || 1) + Math.ceil(Math.random() * 6));
      pc.textContent = p + '%';
      segs.forEach((sg, i) => sg.classList.toggle('on', p >= (i + 1) * 10));
      try { ui.play('tick', 1400 + p * 14, 0.035); } catch (err) {}
      if (p < 100) { setTimeout(tick, 25 + Math.random() * 45); return; }
      el.dataset.state = 'done';
      setTimeout(() => {
        el.classList.add('filled');
        try { ui.play('ldFill'); } catch (err) {}
        setTimeout(() => {
          el.classList.add('completed');
          try { ui.play('ldDone'); } catch (err) {}
          setTimeout(() => site.ach.unlock('about-load'), 700); // "Low PC"
        }, 800);
      }, 250);
    })();
  }

  /* speech bubble "hello, ___!": just click it (no drag) and type the missing word */
  const bubble = $('.stk-bubble');
  if (bubble) {
    const inp = $('.bb-in', bubble), txt = $('.bb-txt', bubble);
    let down = null;
    bubble.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    bubble.addEventListener('pointerup', (e) => {
      if (!down || e.target.closest('.rot-h')) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 5 || bubble.classList.contains('solved')) return; // that was a drag
      bubble.classList.add('typing');
      inp.focus({ preventScroll: true });
    });
    inp.addEventListener('input', () => {
      inp.value = inp.value.replace(/[^a-zA-Z ]/g, '');
      txt.textContent = inp.value;
      try { ui.play('tick', 2000 + inp.value.length * 120, 0.05); } catch (err) {}
      if (inp.value.trim().toLowerCase() === 'world') {
        bubble.classList.add('solved');
        bubble.classList.remove('typing');
        inp.blur();
        try { ui.play('ldDone'); } catch (err) {}
        setTimeout(() => site.ach.unlock('about-world'), 600); // "Hello world!"
      }
    });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'Escape') inp.blur(); });
    inp.addEventListener('blur', () => bubble.classList.remove('typing'));
  }

  /* keycap sticker: type L, U, C, K, A in order; each correct key lights up orange, a wrong one resets,
     and the full word turns the keys green one after another */
  const keysStk = $('.stk-keys');
  if (keysStk) {
    const caps = $$('.kc', keysStk);
    let at = 0;
    document.addEventListener('keydown', (e) => {
      if (keysStk.classList.contains('done') || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
      const k = (e.key || '').toLowerCase();
      if (!/^[a-z]$/.test(k)) return;
      if (k === caps[at].dataset.k) {
        caps[at].classList.add('hit');
        try { ui.play('tick', 1500 + at * 260, 0.07); } catch (err) {}
        at++;
        if (at === caps.length) {
          setTimeout(() => {
            keysStk.classList.add('done');
            try { ui.play('ldFill'); setTimeout(() => ui.play('ldDone'), 450); } catch (err) {}
            setTimeout(() => site.ach.unlock('about-lucka'), 1100); // "My girlfriend <3", once the keys have turned green
          }, 150);
        }
      } else if (at > 0) {
        caps.forEach((c) => c.classList.remove('hit'));
        keysStk.classList.remove('nope'); void keysStk.offsetWidth; keysStk.classList.add('nope');
        try { ui.play('error'); } catch (err) {}
        at = 0;
        if (k === caps[0].dataset.k) { caps[0].classList.add('hit'); at = 1; } // a fresh start
      }
    });
  }

  /* paper plane: throw it and it flies away off the screen, leaving a trail of little orange squares
     that fades once it's gone */
  const isPlane = (el) => el.classList.contains('stk-plane');
  function flyPlane(el, vx, vy) {
    site.armed.delete(el);
    el.classList.remove('drag', 'armed');
    el.classList.add('flying');
    el.style.zIndex = '9999';
    const app = $('#app');
    const pos = { ...(stickerPos.get(el) || { x: 0, y: 0 }) };
    let sp = Math.min(0.75, Math.max(0.32, Math.hypot(vx, vy) * 0.35));  // px per ms: a slow, floaty glide
    let ang = Math.atan2(vy, vx);
    const dots = [];
    let last = performance.now(), dist = 0;
    const tStart = last;
    const LOOP_MS = 1300, loopDir = vx >= 0 ? -1 : 1; // loop upward first
    let padVoice = null;
    try { ui.play('swish'); padVoice = ui.play('flyPad'); } catch (err) {}
    // a little melody plays while it's in the air
    let note = 0;
    const music = setInterval(() => { try { ui.play('flyNote', note++); } catch (err) {} }, 210);
    (function step(now) {
      const dt = Math.min(40, now - last); last = now;
      sp *= Math.pow(1.0004, dt);                 // picks up a tiny bit of speed
      ang += Math.sin(now / 260) * 0.0009 * dt;   // a gentle wobble in the air
      // a loop-the-loop in its path shortly after take-off (it curls up and over, then carries on)
      const lt = now - tStart - 350;
      if (lt > 0 && lt < LOOP_MS) {
        if (!el._looped) { el._looped = true; try { ui.play('swish'); } catch (err) {} }
        const w = Math.sin(Math.PI * lt / LOOP_MS);            // turn rate eases in and out
        ang += loopDir * w * (Math.PI * Math.PI / LOOP_MS) * dt; // integrates to exactly one full turn
      }
      const dx = Math.cos(ang) * sp * dt, dy = Math.sin(ang) * sp * dt;
      pos.x += dx; pos.y += dy;
      placeSticker(el, pos);
      el.style.setProperty('--rot', (ang * 180 / Math.PI + 90).toFixed(1) + 'deg'); // nose first
      dist += Math.hypot(dx, dy);
      const r = el.getBoundingClientRect();
      if (dist > 16) {                            // drop a trail square behind the tail
        dist = 0;
        const ar = app.getBoundingClientRect();
        const tx = r.left + r.width / 2 - Math.cos(ang) * r.width * 0.42 - ar.left;
        const ty = r.top + r.height / 2 - Math.sin(ang) * r.height * 0.42 - ar.top;
        const d = document.createElement('span');
        d.className = 'pl-dot';
        d.style.left = tx.toFixed(1) + 'px'; d.style.top = ty.toFixed(1) + 'px';
        d.style.rotate = (ang * 180 / Math.PI).toFixed(0) + 'deg';
        app.appendChild(d); dots.push(d);
      }
      const off = r.right < -40 || r.left > innerWidth + 40 || r.bottom < -40 || r.top > innerHeight + 40;
      if (!off) { requestAnimationFrame(step); return; }
      el.remove();                                // gone for good (until reload)
      clearInterval(music);
      try { if (padVoice) padVoice.stop(0.6); ui.play('flyEnd'); } catch (err) {}
      site.ach.unlock('about-plane'); // "Paper can fly?" — it made it off the screen
      dots.forEach((d, i) => setTimeout(() => d.classList.add('fade'), i * 25));
      setTimeout(() => dots.forEach((d) => d.remove()), dots.length * 25 + 1200);
    })(last);
  }

  /* sword vs heart: drag the sword's blade through the heart. Each slice hurts it (shake + "ouch");
     the third one cracks it in two and then it shatters into falling pixel shards (gone until reload) */
  const swordStk = $('.stk-sword');
  let heartStk = $('.stk-heart'), heartHits = 0, inHeart = false, lastHit = 0;
  function bladePoints() {
    const r = swordStk.getBoundingClientRect();
    const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const th = (parseFloat(getComputedStyle(swordStk).getPropertyValue('--rot')) || 0) * Math.PI / 180;
    const size = swordStk.offsetWidth * (parseFloat(swordStk.style.getPropertyValue('--sz')) || 1);
    const pts = [];
    for (let k = 0; k <= 5; k++) {           // along the blade, tip (12.5,0.5) → base (5,8) in the 14×14 sprite
      const lx = (12.5 + (5 - 12.5) * k / 5) / 14 - 0.5, ly = (0.5 + (8 - 0.5) * k / 5) / 14 - 0.5;
      pts.push({ x: c.x + (lx * Math.cos(th) - ly * Math.sin(th)) * size, y: c.y + (lx * Math.sin(th) + ly * Math.cos(th)) * size });
    }
    return pts;
  }
  function checkSlash() {
    if (!heartStk || !heartStk.isConnected || heartStk.classList.contains('broken')) return;
    const h = $('svg', heartStk).getBoundingClientRect();
    const m = Math.min(h.width, h.height) * 0.12;
    const hit = bladePoints().some((p) => p.x > h.left + m && p.x < h.right - m && p.y > h.top + m && p.y < h.bottom - m);
    if (hit && !inHeart && performance.now() - lastHit > 250) {
      lastHit = performance.now();
      heartHits++;
      if (heartHits >= 3) breakHeart();
      else {
        heartStk.classList.remove('hurt'); void heartStk.offsetWidth; heartStk.classList.add('hurt');
        try { ui.play('hurt'); } catch (err) {}
      }
    }
    inHeart = hit;
  }
  function breakHeart() {
    const el = heartStk;
    el.classList.remove('hurt');
    el.classList.add('broken');
    site.armed.delete(el);
    // swap the heart for two halves split along a zigzag crack (pixel grid doubled to 14×12)
    const rows = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
    const zig = [7, 7, 7, 6, 6, 7, 7, 6, 6, 7, 7, 7]; // a vertical staircase crack down the middle, like the video
    let L = '', Rr = '';
    for (let y = 0; y < 12; y++) for (let x = 0; x < 14; x++) {
      if (rows[y >> 1][x >> 1] !== 'X') continue;
      const hl = (x >> 1) === 1 && (y >> 1) === 1;
      const rect = `<rect x="${x}" y="${y}" width="1.02" height="1.02"${hl ? ' class="hl"' : ''}/>`;
      if (x < zig[y]) L += rect; else Rr += rect;
    }
    const old = $('svg', el);
    const mk = (cls, inner) => `<svg class="hh ${cls}" viewBox="0 0 14 12" shape-rendering="crispEdges" aria-hidden="true">${inner}</svg>`;
    old.insertAdjacentHTML('afterend', mk('hh-l', L) + mk('hh-r', Rr));
    old.remove();
    playSound('heartCrack');
    setTimeout(() => shatterHeart(el), 1330); // same gap between crack and shatter as in the video
  }
  function shatterHeart(el) {
    const app = $('#app'), ar = app.getBoundingClientRect(), r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2 - ar.left, cy = r.top + r.height / 2 - ar.top;
    const unit = r.width / 7;                  // size of one heart pixel on screen
    el.remove();
    playSound('heartShatter');
    setTimeout(() => site.ach.unlock('about-heart'), 900); // "You're NOT filled with determination."
    const shards = [];
    for (let i = 0; i < 7; i++) {
      const d = document.createElement('span');
      d.className = 'h-shard';
      d.style.width = (unit * (1 + Math.round(Math.random()))).toFixed(1) + 'px';
      d.style.height = unit.toFixed(1) + 'px';
      app.appendChild(d);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;          // mostly up and outward
      const sp = 0.25 + Math.random() * 0.3;
      shards.push({ d, x: cx + (Math.random() - 0.5) * r.width * 0.5, y: cy + (Math.random() - 0.5) * r.height * 0.4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: Math.random() * 360, vr: (Math.random() - 0.5) * 0.6 });
    }
    let last = performance.now(); const t0 = last;
    (function step(now) {
      const dt = Math.min(40, now - last); last = now;
      const life = now - t0;
      shards.forEach((s) => {
        s.vy += 0.0011 * dt;                    // gravity
        s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt;
        s.d.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) rotate(${s.rot.toFixed(0)}deg)`;
        if (life > 1600) s.d.style.opacity = String(Math.max(0, 1 - (life - 1600) / 600));
      });
      if (life < 2200) requestAnimationFrame(step); else shards.forEach((s) => s.d.remove());
    })(last);
  }

  /* heavy stickers (the "please don't drag" sign) lag behind the cursor like a slab of metal:
     they ease toward it, tilt with the pull, and scrape while they move */
  const isHeavy = (el) => el.classList.contains('stk-warn');
  function heavyTo(el, p) {
    const h = el._hv || (el._hv = { cur: { ...(stickerPos.get(el) || { x: 0, y: 0 }) }, raf: 0, t: performance.now() });
    h.tgt = p;
    if (!h.raf) { h.t = performance.now(); h.raf = requestAnimationFrame(() => heavyStep(el)); }
  }
  function heavyStep(el) {
    const h = el._hv; h.raf = 0;
    const now = performance.now(), dt = Math.max(8, now - h.t); h.t = now;
    const k = 1 - Math.pow(0.955, dt / 16.7); // ~4.5% of the way per frame: a slow, very weighty follow
    let dx = (h.tgt.x - h.cur.x) * k, dy = (h.tgt.y - h.cur.y) * k;
    const maxStep = 0.55 * dt;                 // it can never move faster than ~0.55 px/ms, however hard you pull
    const len = Math.hypot(dx, dy);
    if (len > maxStep) { dx *= maxStep / len; dy *= maxStep / len; }
    h.cur.x += dx; h.cur.y += dy;
    const fr = Math.hypot(dx, dy) / dt;        // how hard it's grinding right now
    // friction: a fine judder while it grinds, and sparks off the trailing edge
    const j = Math.min(1.4, fr * 2.2);
    placeSticker(el, { x: h.cur.x + (Math.random() - 0.5) * j, y: h.cur.y + (Math.random() - 0.5) * j });
    stickerPos.set(el, { x: h.cur.x, y: h.cur.y });
    if (!reduceMotion && fr > 0.08) sparks(el, dx, dy, fr);
    const speed = Math.hypot(dx, dy) / dt;   // px per ms the sign actually moves
    el.style.setProperty('--tilt', Math.max(-9, Math.min(9, (dx / dt) * 11)).toFixed(2) + 'deg');
    ui.scrapeMove(speed);
    if (Math.hypot(h.tgt.x - h.cur.x, h.tgt.y - h.cur.y) > 0.4) h.raf = requestAnimationFrame(() => heavyStep(el));
    else { el.style.setProperty('--tilt', '0deg'); if (!el.classList.contains('drag')) { ui.scrapeStop(); el._hv = null; } }
  }
  function sparks(el, dx, dy, fr) {
    // a few short grinding streaks, not fireworks
    const n = Math.random() < fr * 1.1 ? 1 + (Math.random() < 0.25 ? 1 : 0) : 0;
    if (!n) return;
    const r = el.getBoundingClientRect(), sr = aboutSec.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;      // rotation is around the centre
    const cs = getComputedStyle(el);
    const th = ((parseFloat(cs.getPropertyValue('--rot')) || 0) + (parseFloat(el.style.getPropertyValue('--tilt')) || 0)) * Math.PI / 180;
    const ux = Math.cos(th), uy = Math.sin(th);                       // along the sign
    const nx = -uy, ny = ux;                                          // across it
    const z = parseFloat(el.style.getPropertyValue('--sz')) || 1;
    const hw = el.offsetWidth / 2 * z, hh = el.offsetHeight / 2 * z;
    const len = Math.hypot(dx, dy) || 1, mx = dx / len, my = dy / len;
    const along = mx * ux + my * uy;                                  // 1 = pulled lengthwise, 0 = pulled sideways
    // lengthwise: only the trailing end grinds; sideways (e.g. up/down): both ends grind
    const ends = Math.abs(along) > 0.55 ? [along > 0 ? -1 : 1] : [-1, 1];
    for (let i = 0; i < n * ends.length; i++) {
      const end = ends[i % ends.length];
      const t = Math.random() * 2 - 1;                                // somewhere along that end edge
      const x = cx + end * hw * ux + t * hh * nx - sr.left;
      const y = cy + end * hw * uy + t * hh * ny - sr.top;
      const sp = document.createElement('span');
      sp.className = 'spark';
      const v = 10 + Math.random() * 22;
      const vx = -mx * v + (Math.random() - 0.5) * 8, vy = -my * v + (Math.random() - 0.5) * 8;
      sp.style.left = x.toFixed(1) + 'px';
      sp.style.top = y.toFixed(1) + 'px';
      sp.style.setProperty('--vx', vx.toFixed(1) + 'px');
      sp.style.setProperty('--vy', vy.toFixed(1) + 'px');
      sp.style.setProperty('--a', (Math.atan2(vy, vx) * 180 / Math.PI).toFixed(0) + 'deg');
      sp.style.animationDuration = (0.18 + Math.random() * 0.17).toFixed(2) + 's';
      aboutSec.appendChild(sp);
      sp.addEventListener('animationend', () => sp.remove());
    }
  }
  /* a huge sign hitting the "ground": the page cracks where it landed and shakes */
  function crackAt(x0, y0) {           // x0/y0: position inside #app (page coordinates)
    // a comic-style spiky hole punched through the page, showing the site's binary "core" underneath
    const app = $('#app');
    const NS = 'http://www.w3.org/2000/svg';
    const R = 120, S = R * 2.3;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'crack');
    svg.setAttribute('viewBox', `${-S} ${-S} ${2 * S} ${2 * S}`);
    svg.style.left = (x0 - S) + 'px'; svg.style.top = (y0 - S) + 'px';
    svg.style.width = svg.style.height = (2 * S) + 'px';
    // a smashed-glass hole: uneven, lopsided, with long thin shards and short jagged bites
    const rnd = (a, b) => a + Math.random() * (b - a);
    const k1 = Math.floor(rnd(1, 3)), p1 = rnd(0, 6.28), k2 = Math.floor(rnd(2, 5)), p2 = rnd(0, 6.28);
    const base = (t) => R * (0.72 + 0.16 * Math.sin(t * k1 + p1) + 0.08 * Math.sin(t * k2 + p2)); // lopsided overall shape
    const verts = [];
    let t = 0;
    while (t < Math.PI * 2 - 0.12) {
      const b0 = base(t);
      const kind = Math.random();
      if (kind < 0.16) verts.push([t, b0 * rnd(1.35, 1.7)]);            // a long thin shard
      else if (kind < 0.55) verts.push([t, b0 * rnd(1.0, 1.25)]);        // a normal point
      else verts.push([t, b0 * rnd(0.82, 0.97)]);                        // a blunt chip
      t += rnd(0.06, 0.22);
      verts.push([t, base(t) * rnd(0.5, 0.78)]);                         // the notch between points
      t += rnd(0.08, 0.34);
    }
    const P = (v) => [Math.cos(v[0]) * v[1], Math.sin(v[0]) * v[1]];
    const pts = verts.map((v) => P(v).map((n) => n.toFixed(1)).join(',')).join(' ');
    // a few loose glass splinters lying around the edge
    let shards = '';
    for (let i = 0; i < 12; i++) {
      const tt = rnd(0, 6.28), rr = base(tt) * rnd(1.12, 1.75), sz = rnd(4, 14), rot = rnd(0, 6.28);
      const cx = Math.cos(tt) * rr, cy = Math.sin(tt) * rr;
      const tri = [0, 2.1, 4.2].map((o, j) => { const q = rot + o + rnd(-0.4, 0.4), l = sz * (j ? rnd(0.4, 0.8) : 1.4); return `${(cx + Math.cos(q) * l).toFixed(1)},${(cy + Math.sin(q) * l).toFixed(1)}`; }).join(' ');
      shards += `<polygon points="${tri}"/>`;
    }
    const id = 'hole' + Math.floor(Math.random() * 1e6);
    const rows = 34, lh = 13, cols = 64;
    const bin = () => Array.from({ length: cols }, () => (Math.random() < 0.5 ? '0' : '1')).join('');
    let lines = '';
    for (let k = 0; k < 2; k++) for (let i = 0; i < rows; i++) lines += `<text x="${-R * 1.8}" y="${-R * 1.8 + i * lh + k * rows * lh}">${bin()}</text>`;
    svg.innerHTML = `<defs><clipPath id="${id}"><polygon points="${pts}"/></clipPath></defs>
      <g class="hole-pop">
        <g class="shards">${shards}</g>
        <polygon class="hole-out" points="${pts}"/>
        <g clip-path="url(#${id})">
          <rect x="${-S}" y="${-S}" width="${2 * S}" height="${2 * S}" fill="#020803"/>
          <g class="bin"><g class="bin-scroll" style="--h:${rows * lh}px">${lines}</g></g>
          <circle r="${R * 1.7}" fill="url(#${id}v)"/>
        </g>
        <polygon class="hole-rim" points="${pts}"/>
      </g>
      <defs><radialGradient id="${id}v"><stop offset="35%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".85"/></radialGradient></defs>`;
    app.appendChild(svg);
    requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.add('on')));
    // the core keeps "computing": random rows flip their bits and the binary scrolls, but only while the hole is on
    // screen and the tab is in front (scrolled away or in a background tab, both wait)
    const texts = svg.querySelectorAll('.bin text');
    const flipBits = () => { for (let i = 0; i < 3; i++) texts[Math.floor(Math.random() * texts.length)].textContent = bin(); };
    let inView = true, flipper = 0;
    const flipRun = () => {
      const on = inView && !document.hidden;
      svg.classList.toggle('idle', !on);
      if (on && !flipper) flipper = setInterval(flipBits, 140);
      else if (!on && flipper) { clearInterval(flipper); flipper = 0; }
    };
    new IntersectionObserver((ents) => { inView = ents[ents.length - 1].isIntersecting; flipRun(); }).observe(svg);
    document.addEventListener('visibilitychange', flipRun);
    flipRun();
    const main = $('main');
    main.classList.remove('quake'); void main.offsetWidth; main.classList.add('quake');
    setTimeout(() => main.classList.remove('quake'), 700);
  }
  function heavyCancel(el) {
    if (el._hv) { cancelAnimationFrame(el._hv.raf); el._hv = null; }
    el.style.setProperty('--tilt', '0deg');
    ui.scrapeStop();
  }

  function poofSticker(el) {
    const back = drag.start;
    heavyCancel(el);
    try { el.releasePointerCapture(drag.id); } catch (err) { /* already released */ }
    drag = null;
    ui.motionStop();
    el.classList.remove('drag');
    el.classList.add('poof');
    ui.play('poof');
    setTimeout(() => {
      el.classList.remove('poof');
      placeSticker(el, back);       // back where it was before this drag (it's invisible right now)
      el.classList.add('pop-in');
      ui.play('popIn');
      setTimeout(() => el.classList.remove('pop-in'), 650);
    }, 760);
  }

  $$('.stk', board).forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || el.classList.contains('poof')) return;
      const p = stickerPos.get(el) || { x: 0, y: 0 };
      drag = {
        el, id: e.pointerId, ox: e.clientX - p.x, oy: e.clientY - p.y, start: { x: p.x, y: p.y },
        lx: e.clientX, ly: e.clientY, lt: performance.now()
      };
      el.setPointerCapture(e.pointerId);
      el.style.zIndex = String(++zTop);
      el.classList.remove('home', 'pop-in');
      el.classList.add('drag');
      if (isHeavy(el)) { ui.play('clunk'); ui.scrapeStart(); }
      else { ui.play('grab'); ui.motionStart(); }
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag || drag.el !== el || drag.id !== e.pointerId) return;
      const p = { x: e.clientX - drag.ox, y: e.clientY - drag.oy };
      if (isHeavy(el)) heavyTo(el, p); else placeSticker(el, p);
      if (isHeavy(el) && Math.hypot(p.x - drag.start.x, p.y - drag.start.y) > 40) site.ach.unlock('about-drag'); // "You shouldn't have drag that"
      if (el === swordStk) checkSlash();
      const now = performance.now();
      const sr = aboutSec.getBoundingClientRect();
      if (!isHeavy(el)) ui.motionMove(Math.hypot(e.clientX - drag.lx, e.clientY - drag.ly) / Math.max(8, now - drag.lt),
        Math.min(1, Math.max(0, (e.clientX - sr.left) / sr.width)));
      drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = now;
      if (isPlane(el)) { (drag.trk || (drag.trk = [])).push({ x: e.clientX, y: e.clientY, t: now }); while (drag.trk.length > 2 && now - drag.trk[0].t > 90) drag.trk.shift(); return; }
      // dragged out of the About section → poof
      // (the heavy sign may leave the section: it falls when let go out there, see drop)
      if (!isHeavy(el) && (e.clientX < sr.left || e.clientX > sr.right || e.clientY < sr.top || e.clientY > sr.bottom)) poofSticker(el);
    });
    const drop = (e) => {
      if (!drag || drag.el !== el || drag.id !== e.pointerId) return;
      if (isPlane(el)) {
        // thrown hard enough → it flies off; otherwise it behaves like any sticker
        const tr = drag.trk || [], a = tr[0], b = tr[tr.length - 1];
        const dt = a && b ? Math.max(1, b.t - a.t) : 1;
        const vx = a && b ? (b.x - a.x) / dt : 0, vy = a && b ? (b.y - a.y) / dt : 0;
        if (Math.hypot(vx, vy) > 0.9 && performance.now() - b.t < 120) {
          try { el.releasePointerCapture(drag.id); } catch (err) {}
          drag = null; ui.motionStop();
          flyPlane(el, vx, vy);
          return;
        }
        const sr = aboutSec.getBoundingClientRect();
        if (e.clientX < sr.left || e.clientX > sr.right || e.clientY < sr.top || e.clientY > sr.bottom) { poofSticker(el); return; }
      }
      // the "sudo rm -rf /" sticker let go over the open Linux terminal: it gets sucked in and runs (see reko:rmrf at the terminal)
      if (el.classList.contains('stk-rm')) {
        const t = $$('.term').find((n) => { const r = n.getBoundingClientRect(); return r.width > 40 && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; });
        if (t && !t.classList.contains('rmrf')) {
          try { el.releasePointerCapture(drag.id); } catch (err) {}
          drag = null; ui.motionStop();
          const r = t.getBoundingClientRect(), b = el.getBoundingClientRect(), p = stickerPos.get(el) || { x: 0, y: 0 };
          const tx = p.x + (r.left + 40) - (b.left + b.width / 2), ty = p.y + (r.top + r.height / 2) - (b.top + b.height / 2);
          el.style.pointerEvents = 'none';
          el.animate([{ translate: `${p.x}px ${p.y}px`, opacity: 1, filter: 'blur(0)' }, { translate: `${tx}px ${ty}px`, scale: 0.08, opacity: 0, filter: 'blur(3px)' }],
            { duration: reduceMotion ? 0 : 480, easing: 'cubic-bezier(.55,0,.8,.2)', fill: 'forwards' }).onfinish = () => { el.style.visibility = 'hidden'; };
          try { ui.play('flyIn'); } catch (err) {}
          setTimeout(() => t.dispatchEvent(new CustomEvent('reko:rmrf')), reduceMotion ? 0 : 420);
          return; // gone until the page is reloaded
        }
      }
      el.classList.remove('drag');
      drag = null;
      if (isHeavy(el)) {
        const sr = aboutSec.getBoundingClientRect();
        if (e.clientX < sr.left || e.clientX > sr.right || e.clientY < sr.top || e.clientY > sr.bottom) {
          // let go outside the About section: it falls away for good (gone until the page is reloaded)
          heavyCancel(el);
          site.armed.delete(el);
          const big = (parseFloat(el.style.getPropertyValue('--sz')) || 1) >= 2.35; // scaled (almost) to the max
          // centre of the (scaled-up) sign at the moment it's let go, stored relative to the page
          // so scrolling during the fall can't move where the crack lands
          const fr = el.getBoundingClientRect(), ar0 = $('#app').getBoundingClientRect();
          const at = { x: fr.left + fr.width / 2 - ar0.left, y: fr.top + fr.height / 2 - ar0.top };
          el.classList.add('falling');
          if (big) el.classList.add('falling-big');
          ui.play(big ? 'fallBig' : 'fall');
          setTimeout(() => {
            if (big) { ui.play('crash'); crackAt(at.x, at.y); site.ach.unlock('about-crack'); } // "Professional demolisher"
            else { ui.play('fallLand'); site.ach.unlock('about-fall'); } // "You could have hit someone!" (normal size only)
          }, big ? 1050 : 900);
          el.addEventListener('animationend', () => el.remove(), { once: true });
          return;
        }
        ui.play('clank');
        if (!el._hv) ui.scrapeStop(); // otherwise it scrapes to a stop on its own
      } else { ui.motionStop(); if (!(el === eyesStk && tryMergeEyes())) ui.play('drop'); }
    };
    el.addEventListener('pointerup', drop);
    el.addEventListener('pointercancel', drop);
  });


  // age sticker: worked out from the birth date (6. 7. 2009), so it updates by itself every birthday
  const ageEl = $('#age');
  if (ageEl) {
    const [by, bm, bd] = ageEl.dataset.born.split('-').map(Number);
    const now = new Date();
    let age = now.getFullYear() - by;
    if (now.getMonth() + 1 < bm || (now.getMonth() + 1 === bm && now.getDate() < bd)) age--;
    ageEl.textContent = String(age);
  }
});
