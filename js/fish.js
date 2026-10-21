/* ---------- orange fish jumping out of the lake on the offline map ----------
   Four sizes; the bigger, the rarer. The giant one is golden, sparkles, and makes a huge slow leap across the bridge.
   Every frame is computed here (position on a parabola, nose along the arc), never interpolated by the browser,
   so a fish can't spin or flip mid-air. Jumps never reach up into the point labels above the lake ("Geocaching"):
   their height is capped below whatever label sits over the jump. */
'use strict';

rekoSite.part((site) => {
  const layer = document.querySelector('#offMap .map-fish');
  if (!layer || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const svg = layer.ownerSVGElement;                 // the fish layer (same 500 × 400 viewBox as the map drawing)
  const art = layer.closest('#offMap').querySelector('.map-art');
  const map = layer.closest('#offMap');
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v));
    if (parent) parent.appendChild(n);
    return n;
  };
  const sfx = (...a) => { try { if (site.playSfx) site.playSfx(...a); } catch (err) { /* sound is optional */ } };
  const rnd = (a, b) => a + Math.random() * (b - a);
  // the lake outline (drawn shifted by translate(-163 -81)) answers "is this point on the water?"
  const lake = art && art.querySelector('g[transform="translate(-163 -81)"] > path');
  const onWater = (x, y) => {
    if (!lake || !lake.isPointInFill) return x > 184 && x < 296 && y > 196 && y < 256;
    try { return lake.isPointInFill(new DOMPoint(x + 163, y + 81)); } catch (err) { return false; }
  };
  const BRIDGE = [220, 256]; // fish don't take off or land on the bridge (they may jump over it)
  const Y = [226, 254];      // they come up from the lower half of the lake, away from the labels above it
  //            k: size for the sounds (0..1), s: scale, w: how often (weights), dur: ms in the air, hang: slow-down at the top
  const TIERS = [
    { k: 0, s: 0.55, w: 52, span: [16, 26], h: [12, 20], dur: 850, hang: 0.2 },
    { k: 0.3, s: 0.85, w: 30, span: [24, 40], h: [18, 30], dur: 1100, hang: 0.25 },
    { k: 0.6, s: 1.2, w: 14, span: [36, 56], h: [26, 40], dur: 1400, hang: 0.32 },
    { k: 1, s: 1.65, w: 4, span: [72, 104], h: [44, 64], dur: 2800, hang: 0.75, giant: true }
  ];
  const pickTier = () => {
    let r = Math.random() * TIERS.reduce((a, t) => a + t.w, 0);
    return TIERS.find((t) => (r -= t.w) < 0) || TIERS[0];
  };
  // lowest bottom edge (in map units) of any point / label hanging over the x range lo..hi
  const ceilingOver = (lo, hi) => {
    const r = svg.getBoundingClientRect();
    if (!r.width) return 0;
    const k = 500 / r.width;
    let c = 0;
    map.querySelectorAll('.spot-dot, .spot-lbl').forEach((n) => {
      const b = n.getBoundingClientRect();
      if (!b.width) return;
      const l = (b.left - r.left) * k, rt = (b.right - r.left) * k, bot = (b.bottom - r.top) * k;
      if (rt > lo - 6 && l < hi + 6 && bot < Y[0]) c = Math.max(c, bot);
    });
    return c;
  };

  const splash = (x, y, s) => {
    const g = el('g', {}, layer);
    [0, 140].forEach((delay) => {
      const r = el('ellipse', { class: 'splash', cx: x, cy: y, rx: 2, ry: 0.8 }, g);
      r.animate([{ rx: 2 * s, ry: 0.8 * s, opacity: 1 }, { rx: 12 * s, ry: 3.4 * s, opacity: 0 }], { duration: 700, delay, easing: 'ease-out', fill: 'both' });
    });
    for (let i = 0; i < 3 + Math.round(s * 2); i++) {
      const d = el('circle', { class: 'drop', cx: x, cy: y, r: 1.2 * Math.sqrt(s) }, g);
      const dx = (Math.random() - 0.5) * 14 * s, up = (5 + Math.random() * 6) * s;
      d.animate([
        { transform: 'translate(0,0)', opacity: 1 },
        { transform: `translate(${dx * 0.6}px,${-up}px)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx}px,1px)`, opacity: 0 }
      ], { duration: 520, easing: 'ease-out', fill: 'both' });
    }
    setTimeout(() => g.remove(), 1000);
  };
  const sparkle = (x, y, s) => {
    const a = Math.random() * Math.PI * 2, d = rnd(6, 16) * s * 0.7;
    const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d, z = rnd(0.6, 1.2);
    // position on the group, scale on the star inside it (scaling the positioned element would pull it toward the map's corner)
    const at = el('g', { transform: `translate(${sx.toFixed(1)} ${sy.toFixed(1)})` }, layer);
    const st = el('path', { class: 'sparkle', d: 'M0-4L1-1L4 0L1 1L0 4L-1 1L-4 0L-1-1Z' }, at);
    st.animate([{ scale: 0, opacity: 1 }, { scale: z, opacity: 1, offset: 0.35 }, { scale: 0, opacity: 0 }], { duration: rnd(500, 800), easing: 'ease-out', fill: 'both' })
      .onfinish = () => at.remove();
  };

  const jump = (forced) => {
    const T = forced != null ? TIERS[forced] : pickTier();
    let plan = null;
    for (let k = 0; k < 40 && !plan; k++) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const span = rnd(...T.span), y = rnd(...Y);
      const x0 = rnd(180, 300), x1 = x0 + dir * span;
      const lo = Math.min(x0, x1), hi = Math.max(x0, x1), m = 6 * T.s; // m: half a fish, it has to fit in the water
      if (!onWater(x0 - m, y) || !onWater(x0 + m, y) || !onWater(x1 - m, y) || !onWater(x1 + m, y)) continue;
      if ((x0 > BRIDGE[0] - m && x0 < BRIDGE[1] + m) || (x1 > BRIDGE[0] - m && x1 < BRIDGE[1] + m)) continue;
      // highest the fish's back may get: a few units under the lowest label above the jump (sparkles need extra room)
      const top = ceilingOver(lo - 12 * T.s, hi + 12 * T.s) + 4 + 9 * T.s + (T.giant ? 10 : 0);
      const hMax = y - top;
      if (hMax < (T.giant ? 22 : T.h[0] * 0.7)) continue; // the giant settles for a flatter leap on small screens (label sits lower)
      plan = { dir, span, y, x0, h: Math.min(rnd(...T.h), hMax) };
    }
    if (!plan) return;
    const { dir, span, y, x0, h } = plan, s = T.s;
    const g = el('g', { class: 'fish' + (T.giant ? ' fish-giant' : '') }, layer);
    // a grab area a bit bigger than the fish (they're fast), at least ~14 map units across whatever the fish's size
    el('ellipse', { class: 'fish-hit', cx: -1.5, cy: 0, rx: Math.max(16, 15 / s), ry: Math.max(11, 13 / s) }, g);
    el('path', { d: 'M-7 0L-12.5-4.5L-11.5 0L-12.5 4.5Z', class: 'fin' }, g); // tail
    el('path', { d: 'M9 0C6-5.5-4-6-8 0C-4 6 6 5.5 9 0Z' }, g);              // body
    el('path', { d: 'M-1-4.6L1-8L4-4.2Z', class: 'fin' }, g);                  // dorsal fin
    el('circle', { cx: 4.6, cy: -1, r: 1 }, g);                                // eye
    const dur = T.dur * rnd(0.92, 1.1);
    splash(x0, y, s);
    sfx('fishOut', T.k);
    if (T.giant) sfx('fishGiant', dur / 1000);
    const t0 = performance.now();
    let n = 0;
    g._fish = { g, s, k: T.k, giant: !!T.giant, face: dir, x: x0, y }; // read by the catching code below
    const frame = (now) => {
      if (g._fish.caught) return; // grabbed by the visitor: the catching code moves it from here on
      const t = Math.min(1, (now - t0) / dur);
      const u = t + T.hang * Math.sin(2 * Math.PI * t) / (2 * Math.PI); // slower around the top = longer in the air
      const px = x0 + dir * span * u, py = y - 4 * h * u * (1 - u);
      const ang = Math.atan2(-4 * h * (1 - 2 * u), dir * span) * 180 / Math.PI; // nose along the arc
      // swimming left: mirror top/bottom after turning ~180°, so the back (fin, eye) stays on top
      g.setAttribute('transform', `translate(${px.toFixed(2)} ${py.toFixed(2)}) rotate(${ang.toFixed(2)}) scale(${s} ${dir * s})`);
      g._fish.x = px; g._fish.y = py;
      g.style.opacity = String(Math.min(1, u / 0.06, (1 - u) / 0.06));
      if (T.giant && ++n % 2 === 0) sparkle(px, py, s);
      if (t < 1) { requestAnimationFrame(frame); return; }
      g.remove();
      splash(x0 + dir * span, y, s);
      sfx('fishIn', T.k);
    };
    requestAnimationFrame(frame);
  };
  /* ---------- catching: grab a fish mid-jump (left button / touch) and drag it somewhere on the map ----------
     Where it's let go decides what happens (checked at its shadow, i.e. the ground right under it):
     the lake → it dives back in · the meadow → the ants (the little dots) eat it, then go back to their spots ·
     the mountains → it flops to their foot, a bear walks out from behind the peaks, the fish tries to run away to the
     left but the bear eats it anyway · the trees / lower-left corner (home → 01 Hiking) → a crow flies in, eats it and
     flies off · anywhere else → it grows a pair of legs and walks back to the lake. */
  const tween = (ms, fn) => new Promise((done) => {
    const t0 = performance.now();
    const f = (now) => { const t = Math.min(1, (now - t0) / ms); fn(t); if (t < 1) requestAnimationFrame(f); else done(); };
    requestAnimationFrame(f);
  });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeIn = (t) => t * t * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const backOut = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
  const toMap = (e) => { const m = svg.getScreenCTM(); return m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()) : { x: 250, y: 200 }; };
  // crows and anything else that flies in stays inside the map's paper
  const defs = el('defs', {}, svg);
  el('rect', { x: 0, y: 0, width: 500, height: 400 }, el('clipPath', { id: 'fxClip' }, defs));
  const sky = el('g', { 'clip-path': 'url(#fxClip)' }, layer);

  // a caught fish: f.lift raises it (on its legs), f.sc shrinks it (being eaten), f.face turns it left / right (f.flip: mid-turn)
  const draw = (f) => {
    f.g.setAttribute('transform', `translate(${f.x.toFixed(2)} ${(f.y - f.lift).toFixed(2)}) rotate(${f.ang.toFixed(2)}) scale(${(f.face * f.flip * f.s * f.sc).toFixed(3)} ${(f.s * f.sc).toFixed(3)})`);
    if (f.giant && f.sc > 0.3 && ++f.n % 3 === 0) sparkle(f.x, f.y - f.lift, f.s * f.sc);
  };
  // a fish on dry land flops about until the returned stop() is called
  const flop = (f) => {
    let live = true, last = 0;
    const t0 = performance.now(), y0 = f.y;
    const step = (now) => {
      if (!live) return;
      const ph = ((now - t0) / 620) * Math.PI * 2;
      f.ang = Math.sin(ph) * 13;
      f.y = y0 - Math.pow(Math.max(0, Math.sin(ph)), 3) * 3 * f.sc;
      draw(f);
      if (now - last > 620) { last = now; sfx('fishFlop'); }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    return () => { live = false; f.y = y0; };
  };
  // turning around: squash through zero width and come out facing the other way
  const turn = (f) => tween(220, (t) => { f.flip = Math.cos(t * Math.PI); draw(f); }).then(() => { f.face = -f.face; f.flip = 1; draw(f); });
  // a stranded fish flops itself over to a better spot in a few hops (to where the bear can reach it, away from the map's edge…)
  async function hopTo(f, x, y) {
    const d = Math.hypot(x - f.x, y - f.y);
    if (d < 1) return;
    if (Math.abs(x - f.x) > 2 && Math.sign(x - f.x) !== f.face) await turn(f);
    const n = Math.max(1, Math.round(d / 28));
    for (let i = 0; i < n; i++) {
      const x0 = f.x, y0 = f.y, x1 = lerp(x0, x, 1 / (n - i)), y1 = lerp(y0, y, 1 / (n - i)), up = 6 + 4 * f.s;
      sfx('fishFlop');
      await tween(260, (t) => { f.x = lerp(x0, x1, t); f.y = lerp(y0, y1, t) - Math.sin(t * Math.PI) * up; f.ang = -f.face * Math.sin(t * Math.PI * 2) * 14; draw(f); });
      await sleep(70);
    }
    f.ang = 0;
    draw(f);
  }
  const crumbs = (x, y, n) => {
    for (let i = 0; i < n; i++) {
      const c = el('circle', { class: 'crumb', cx: (x + rnd(-4, 4)).toFixed(1), cy: (y + rnd(-3, 3)).toFixed(1), r: rnd(0.7, 1.3).toFixed(1) }, layer);
      c.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${rnd(-9, 9)}px,${rnd(-8, 2)}px)`, opacity: 0 }], { duration: rnd(350, 600), easing: 'ease-out', fill: 'both' })
        .onfinish = () => c.remove();
    }
  };

  // where things are on the map (map units, 500 × 400)
  const meadow = art && art.querySelector('.map-meadow > path');
  const inMeadow = (x, y) => { try { return !!meadow && meadow.isPointInFill(new DOMPoint(x, y)); } catch (err) { return false; } };
  const MOUNTAINS = [[316, 142], [340, 96], [380, 66], [430, 46], [478, 132], [478, 150], [316, 150]];
  const inPoly = (x, y, P) => {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i], [xj, yj] = P[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const trees = art ? Array.from(art.querySelectorAll('use')).filter((u) => u.getAttribute('href') === '#mTree')
    .map((u) => ({ x: +u.getAttribute('x'), y: +u.getAttribute('y') - 4 })) : [];
  // the crows' area: the trees plus the whole lower-left corner, from home up to 01 Hiking (around the path too)
  const CROW_AREA = [[0, 188], [140, 188], [152, 240], [200, 312], [200, 400], [0, 400]];
  const inWoods = (x, y) => inPoly(x, y, CROW_AREA) || trees.some((t) => Math.hypot(t.x - x, t.y - y) < 16);
  const ants = art ? Array.from(art.querySelectorAll('.map-meadow > g[stroke="#0b0b0b"] circle'))
    .map((c) => ({ c, x0: +c.getAttribute('cx'), y0: +c.getAttribute('cy') })) : [];
  let antsBusy = false;
  let water = null; // points well inside the lake (off the bridge) for a walking fish to head for, worked out once
  const nearestWater = (x, y) => {
    if (!water) {
      water = [];
      for (let gx = 160; gx <= 320; gx += 4) for (let gy = 160; gy <= 280; gy += 4) {
        if (gx > BRIDGE[0] - 6 && gx < BRIDGE[1] + 6) continue;
        if ([[0, 0], [-7, 0], [7, 0], [0, -6], [0, 6]].every(([dx, dy]) => onWater(gx + dx, gy + dy))) water.push({ x: gx, y: gy });
      }
    }
    let best = water[0] || { x: 200, y: 230 }, bd = Infinity;
    water.forEach((p) => { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } });
    return best;
  };

  // holding
  const LIFT = 12; // how high a held fish hangs above its shadow
  let held = null;
  const hold = (now) => {
    if (!held) return;
    const h = held, f = h.f;
    const nx = lerp(f.x, h.tx, 0.35), ny = lerp(f.y, h.ty, 0.35);
    const vx = nx - f.x;
    f.x = nx; f.y = ny;
    if (Math.abs(vx) > 0.4) f.face = Math.sign(vx);
    f.ang = Math.sin(now / 60) * 14 + Math.max(-12, Math.min(12, vx * 2)); // wriggling, leaning into the movement
    draw(f);
    h.shadow.setAttribute('cx', f.x.toFixed(1));
    h.shadow.setAttribute('cy', (f.y + LIFT).toFixed(1));
    if (now - h.lastFlop > h.gap) { h.lastFlop = now; h.gap = rnd(380, 640); sfx('fishFlop'); }
    requestAnimationFrame(hold);
  };
  layer.addEventListener('pointerdown', (e) => {
    const g = e.target.closest('.fish');
    if (!g || !g._fish || g._fish.caught || held || e.button !== 0) return;
    const f = g._fish;
    f.caught = true;
    g.classList.add('caught');
    g.style.opacity = '1';
    Object.assign(f, { ang: 0, sc: 1, lift: 0, n: 0, flip: 1 });
    const p = toMap(e);
    held = { f, id: e.pointerId, tx: p.x, ty: p.y, lastFlop: performance.now(), gap: 400, shadow: el('ellipse', { class: 'fish-shadow', rx: (9 * f.s).toFixed(1), ry: (2.4 * f.s).toFixed(1) }) };
    layer.insertBefore(held.shadow, g);
    map.classList.add('fish-holding');
    sfx('fishCatch', f.k);
    // the fish upgrades: Small → Medium → Large → Golden (each only counts once the one before it is done)
    const FISH_ACH = { 0: 'off-fish-s', 0.3: 'off-fish-m', 0.6: 'off-fish-l', 1: 'off-fish-g' };
    if (FISH_ACH[f.k] && site.ach) site.ach.unlock(FISH_ACH[f.k]);
    e.preventDefault();
    requestAnimationFrame(hold);
  });
  window.addEventListener('pointermove', (e) => { if (held && e.pointerId === held.id) { const p = toMap(e); held.tx = p.x; held.ty = p.y; } });
  window.addEventListener('touchmove', (e) => { if (held) e.preventDefault(); }, { passive: false }); // no page scrolling while carrying a fish
  const release = (e) => {
    if (!held || e.pointerId !== held.id) return;
    const { f, shadow } = held;
    held = null;
    map.classList.remove('fish-holding');
    shadow.remove();
    f.x = Math.max(10, Math.min(490, f.x));
    land(f, Math.max(14, Math.min(390, f.y + LIFT)));
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);

  // a fish got eaten (ants, bear or crow): that animal's achievement, plus "A golden dinner" if it was the golden one
  const fedTo = (id, f) => {
    if (!site.ach) return;
    site.ach.unlock(id);
    if (f.giant) site.ach.unlock('off-golden');
  };
  async function land(f, gy) {
    const y0 = f.y;
    if (onWater(f.x, gy)) { // let go over the lake: straight back in
      await tween(260, (t) => { f.y = lerp(y0, gy, easeIn(t)); f.sc = 1 - 0.3 * t; draw(f); });
      f.g.remove(); splash(f.x, gy, f.s); sfx('fishIn', f.k);
      return;
    }
    await tween(220, (t) => { f.y = lerp(y0, gy, easeIn(t)); f.ang = f.face * 8 * t; draw(f); });
    sfx('fishThud');
    await tween(160, (t) => { f.y = gy - Math.sin(t * Math.PI) * 3; draw(f); });
    f.y = gy;
    if (inMeadow(f.x, gy) && ants.length && !antsBusy) return eatenByAnts(f);
    if (inPoly(f.x, gy, MOUNTAINS) && !bearBusy) return eatenByBear(f);
    if (inWoods(f.x, gy)) return eatenByCrows(f);
    return walkBack(f);
  }

  // the meadow: the ants march over in wiggly lines, eat it bite by bite and march back to exactly where they were
  let lastAntTick = 0;
  const antWalk = (a, x0, y0, x1, y1) => {
    const d = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / d, ny = (x1 - x0) / d, wob = rnd(2, 4), ph = rnd(0, 6);
    return tween(Math.max(250, d / 60 * 1000), (t) => {
      const w = Math.sin(t * Math.PI * 6 + ph) * wob * Math.sin(t * Math.PI); // wiggly in the middle, straight at both ends
      a.c.setAttribute('cx', (lerp(x0, x1, t) + nx * w).toFixed(1));
      a.c.setAttribute('cy', (lerp(y0, y1, t) + ny * w).toFixed(1));
      const now = performance.now();
      if (now - lastAntTick > 70) { lastAntTick = now; sfx('tick', 4200 + Math.random() * 800, 0.012); } // tiny footsteps
    });
  };
  async function eatenByAnts(f) {
    antsBusy = true;
    const stop = flop(f);
    sfx('antMarch');
    const R = 9 * f.s + 4;
    const at = ants.map((a, i) => { const t = (i / ants.length) * Math.PI * 2 + rnd(-0.3, 0.3); return { x: f.x + Math.cos(t) * R, y: f.y + Math.sin(t) * R * 0.7 }; });
    await Promise.all(ants.map((a, i) => sleep(i * 80).then(() => antWalk(a, a.x0, a.y0, at[i].x, at[i].y))));
    stop();
    for (let b = 1; b <= 6; b++) {
      sfx('antBite');
      crumbs(f.x, f.y, 2);
      ants.forEach((a, i) => { a.c.setAttribute('cx', lerp(at[i].x, f.x, 0.18).toFixed(1)); a.c.setAttribute('cy', lerp(at[i].y, f.y, 0.18).toFixed(1)); });
      await tween(110, (t) => { f.sc = 1 - (b - 1 + t) / 6; f.ang = Math.sin(t * Math.PI * 4) * 10; draw(f); });
      ants.forEach((a, i) => { a.c.setAttribute('cx', at[i].x.toFixed(1)); a.c.setAttribute('cy', at[i].y.toFixed(1)); });
      await sleep(130);
    }
    f.g.remove();
    sfx('antsDone');
    fedTo('off-ants', f); // "Not-so-peaceful meadow"
    await sleep(250);
    await Promise.all(ants.map((a, i) => sleep(i * 70).then(() => antWalk(a, at[i].x, at[i].y, a.x0, a.y0))));
    ants.forEach((a) => { a.c.setAttribute('cx', a.x0); a.c.setAttribute('cy', a.y0); });
    antsBusy = false;
  }

  // the mountains: the fish flops itself over to the foot of the mountains, a bear walks out from behind the peaks
  // (side-on, like a real one), lowers its head, eats it in one bite and walks back behind the peaks
  const BEAR_FISH = { x: 274, y: 114 };                              // where the fish waits for it…
  const FLEE_TO = { x: 60, y: 112 };                                 // …and where it runs to once it sees the bear (it's caught well before that)
  const BEAR_IN = { x: 398, y: 156 };                                // the bear's feet while hidden behind the peaks
  // the peaks' outline, closed underneath: the bear is invisible inside it (= behind the mountains)
  const BEHIND = '312,180 312,139 322,136 344,100 356.3,120.1 380,74 400.9,114.4 430,56 468,132 478,136 478,180';
  const mask = el('mask', { id: 'behindPeaks', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 500, height: 400 }, defs);
  el('rect', { x: 0, y: 0, width: 500, height: 400, fill: '#fff' }, mask);
  el('polygon', { points: BEHIND, fill: '#000' }, mask);
  let bearBusy = false;
  // drawn facing left, feet on y = 0, about 60 × 37 map units (shape after a side-on bear sketch)
  const makeBear = () => {
    // the mask sits on a wrapper that never moves (a mask follows the transform of the element it's on)
    const wrap = el('g', { mask: 'url(#behindPeaks)' });
    const root = el('g', { class: 'bear' }, wrap);
    const lean = el('g', {}, root);
    const leg = (front, far) => {
      const dx = far ? 3.5 : 0, g = el('g', { class: far ? 'bear-far' : '' }, lean);
      const d = front
        ? `M${-15 + dx} -19C${-16 + dx} -11 ${-15.5 + dx} -5 ${-15 + dx} -1.2C${-13 + dx} -.4 ${-10 + dx} -.4 ${-8.2 + dx} -1.2C${-8.6 + dx} -6 ${-8 + dx} -12 ${-6 + dx} -19Z`
        : `M${13 + dx} -21C${12 + dx} -13 ${14.5 + dx} -6 ${15.5 + dx} -1.2C${17.5 + dx} -.4 ${20.5 + dx} -.4 ${22.2 + dx} -1.2C${22 + dx} -6 ${25 + dx} -12 ${27.5 + dx} -20Z`;
      el('path', { class: 'bear-fur', d }, g);
      el('path', { class: 'bear-paw', d: front ? `M${-16 + dx} 0C${-16.5 + dx} -2.4 ${-8.5 + dx} -2.8 ${-7.6 + dx} 0Z` : `M${14.6 + dx} 0C${14.2 + dx} -2.4 ${22.4 + dx} -2.8 ${23 + dx} 0Z` }, g);
      return { g, px: (front ? -11 : 20) + dx, py: front ? -17 : -18, front, far };
    };
    const legs = [leg(true, true), leg(false, true)];
    el('path', { class: 'bear-fur', d: 'M-14 -30C-10 -31.5 -6 -32 -2 -35.5C3 -37.5 10 -36 16 -34C22 -32.5 27 -30 29 -25C30.5 -20 29 -14 25 -11C16 -9.5 4 -10 -6 -12C-11 -13 -14 -15 -17 -18C-18 -22 -17 -27 -14 -30Z' }, lean);
    el('path', { class: 'bear-line', d: 'M-5 -27l2-5M-1 -25l2.2-6M9 -29l1.4-4.6M17 -27l1.2-4M24 -21l2.4-4M3 -14l-1-3.4M12 -13l-.6-3.6M-9 -17l-1.6-3.4' }, lean);
    legs.push(leg(true, false), leg(false, false));
    el('path', { class: 'bear-scarf', d: 'M-12.5 -31.5C-10.8 -26 -11.4 -21 -14.4 -16.6L-10.6 -15.4C-8 -20 -7.6 -26.4 -8.6 -32Z' }, lean); // orange bandana
    el('path', { class: 'bear-scarf', d: 'M-13.6 -16.4L-9.6 -15.6L-12.6 -10.8Z' }, lean);
    const head = el('g', {}, lean);
    el('path', { class: 'bear-head', d: 'M-12 -31C-15 -32.5 -18.5 -31 -20.5 -28C-23 -26.5 -27 -25 -29.5 -23.5C-31 -22.5 -31 -20 -29 -19.2C-26 -18 -22 -17.6 -18.5 -18C-15 -18.5 -12.5 -20 -11 -23Z' }, head);
    el('path', { class: 'bear-outline', d: 'M-12 -31C-15 -32.5 -18.5 -31 -20.5 -28C-23 -26.5 -27 -25 -29.5 -23.5C-31 -22.5 -31 -20 -29 -19.2C-26 -18 -22 -17.6 -18.5 -18C-16 -18.4 -14 -19.2 -12.6 -20.4' }, head);
    el('path', { class: 'bear-fur', d: 'M-15 -30.6C-16 -34.5 -11.8 -35.2 -11.4 -31.2' }, head); // ear
    const mouth = el('path', { class: 'bear-mouth', d: 'M-29 -19.6L-20.5 -19.4L-26.5 -15.2Z' }, head);
    el('path', { class: 'bear-line', d: 'M-29 -19.6Q-25.5 -18.4 -22.5 -19.3' }, head);
    el('ellipse', { class: 'bear-ink', cx: -29.6, cy: -21.4, rx: 1.7, ry: 1.3 }, head); // nose
    const eye = el('circle', { class: 'bear-ink', cx: -21, cy: -25.2, r: 1.15 }, head);
    const happy = el('path', { class: 'bear-happy', d: 'M-22.6 -25Q-21 -27.2 -19.4 -25' }, head);
    mouth.style.opacity = '0'; happy.style.opacity = '0';
    return { wrap, root, lean, head, legs, mouth, eye, happy, x: BEAR_IN.x, y: BEAR_IN.y, face: 1, flip: 1, ph: 0, steps: 0 };
  };
  // pose: lean (whole body tips forward around the back paws), head (lowered), crouch (front legs bend to keep the paws on the ground)
  const poseBear = (B, { lean = 0, head = 0, crouch = 0, bob = 0, stride = 1 } = {}) => {
    B.root.setAttribute('transform', `translate(${B.x.toFixed(1)} ${B.y.toFixed(1)}) scale(${(B.face * B.flip).toFixed(3)} 1)`);
    B.lean.setAttribute('transform', `translate(0 ${bob.toFixed(2)}) rotate(${lean.toFixed(2)} 25 0)`);
    B.head.setAttribute('transform', `rotate(${(head + Math.sin(B.ph * 2) * 2).toFixed(2)} -17 -22)`);
    B.legs.forEach((L) => {
      // walking: legs swing in pairs (near front with far back), so the gait reads like a real four-legged walk
      const sw = Math.sin(B.ph + ((L.front !== L.far) ? Math.PI : 0)) * (L.front ? 16 : 14) * stride;
      const lift = 1 - 0.1 * Math.max(0, Math.cos(B.ph + ((L.front !== L.far) ? Math.PI : 0)));
      const a = sw + (L.front ? -lean : 0), k = (L.front ? 1 - 0.24 * crouch : 1) * lift;
      L.g.setAttribute('transform', `translate(${L.px} ${L.py}) rotate(${a.toFixed(2)}) scale(1 ${k.toFixed(3)}) translate(${-L.px} ${-L.py})`);
    });
  };
  // walk along a straight line (eases in and out); the legs' phase follows the distance, so paws don't slide
  const bearWalk = (B, to, ms) => {
    const x0 = B.x, y0 = B.y, d = Math.hypot(to.x - x0, to.y - y0), ph0 = B.ph;
    return tween(ms, (t) => {
      const e = smooth(t);
      B.x = lerp(x0, to.x, e); B.y = lerp(y0, to.y, e);
      B.ph = ph0 + d * e / 4.2;
      poseBear(B, { bob: -Math.abs(Math.sin(B.ph)) * 0.8 });
      const n = Math.floor(B.ph / Math.PI);
      if (n > B.steps) { B.steps = n; sfx('bearStep'); }
    });
  };
  // the fish spots the bear: an orange "!" pops up and it hops away to the left as fast as it can; with nowhere left
  // to go it keeps flopping in panic on the spot, until stop() (the bear has it)
  const flee = (f, to) => {
    let live = true;
    const mark = el('g', { class: 'alarm' }, layer), pop = el('g', {}, mark); // position on the outer group, pop-in scale on the inner one
    el('circle', { r: 4.6 }, pop);
    el('text', { y: 2.7, 'text-anchor': 'middle' }, pop).textContent = '!';
    const putMark = () => mark.setAttribute('transform', `translate(${f.x.toFixed(1)} ${(f.y - 9 * f.s - 8).toFixed(1)})`);
    putMark();
    pop.animate([{ scale: 0 }, { scale: 1.35, offset: 0.6 }, { scale: 1 }], { duration: 300, easing: 'ease-out', fill: 'both' });
    sfx('fishAlarm');
    const done = (async () => {
      await sleep(110);
      if (f.face !== -1) await turn(f);
      while (live && Math.hypot(to.x - f.x, to.y - f.y) > 1) {
        const x0 = f.x, y0 = f.y, d = Math.hypot(to.x - x0, to.y - y0), k = Math.min(1, 16 / d);
        const x1 = lerp(x0, to.x, k), y1 = lerp(y0, to.y, k) + rnd(-1.5, 1.5), up = 5 + 3 * f.s;
        sfx('fishFlop');
        await tween(210, (t) => { f.x = lerp(x0, x1, t); f.y = lerp(y0, y1, t) - Math.sin(t * Math.PI) * up; f.ang = -f.face * Math.sin(t * Math.PI * 2) * 16; draw(f); putMark(); });
        await sleep(40);
      }
      while (live) { // cornered
        const y0 = f.y;
        sfx('fishFlop');
        await tween(230, (t) => { f.y = y0 - Math.sin(t * Math.PI) * 3 * f.s; f.ang = Math.sin(t * Math.PI * 2) * 18; draw(f); putMark(); });
        f.y = y0;
      }
      f.ang = 0;
    })();
    return { done, stop: () => { live = false; mark.remove(); } };
  };
  async function eatenByBear(f) {
    bearBusy = true;
    let stop = flop(f);
    await sleep(350);
    stop();
    await hopTo(f, BEAR_FISH.x, BEAR_FISH.y);
    if (f.face !== 1) await turn(f);
    stop = flop(f);
    const B = makeBear();
    layer.insertBefore(B.wrap, f.g); // behind the fish
    poseBear(B);
    sfx('bearRise');
    await sleep(500);
    // the bear walks out after it; once it's out from behind the peak the fish sees it and runs, and the bear breaks
    // into a run too (faster than the fish), chasing wherever the fish is right now until its mouth is at it
    let run = null;
    await new Promise((done) => {
      let last = performance.now(), v = 0;
      const t0 = last;
      const tick = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        if (!run && (B.x < 362 || now - t0 > 3000)) { stop(); run = flee(f, FLEE_TO); sfx('chase'); } // its head is out past the peak: the fish sees it
        const tx = f.x + 26, ty = BEAR_FISH.y + 2, dx = tx - B.x, dy = ty - B.y, d = Math.hypot(dx, dy) || 0.001;
        v = Math.min(run ? 84 : 42, v + (run ? 120 : 90) * dt); // walking out, then charging (just a bit faster than the fish)
        const step = Math.min(d, v * dt);
        B.x += dx / d * step; B.y += dy / d * step;
        B.ph += step / (run ? 5.2 : 4.2);
        poseBear(B, { bob: -Math.abs(Math.sin(B.ph)) * (run ? 1.6 : 0.8), stride: run ? 1.35 : 1 });
        const n = Math.floor(B.ph / Math.PI);
        if (n > B.steps) { B.steps = n; sfx('bearStep'); }
        if (run && d < 2) { sfx('chaseEnd'); done(); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    run.stop();
    await run.done;
    stop = flop(f);
    await sleep(120);
    // head down, mouth open…
    await tween(480, (t) => { const e = smooth(t); poseBear(B, { lean: -6 * e, head: -40 * e, crouch: e }); B.mouth.style.opacity = e > 0.5 ? '1' : '0'; });
    stop();
    // …and the fish slides into it in one go
    const m = B.mouth.getBBox(), sc = svg.getScreenCTM().inverse().multiply(B.mouth.getScreenCTM());
    const mp = new DOMPoint(m.x + m.width / 2, m.y + m.height / 2).matrixTransform(sc);
    const fx = f.x, fy = f.y;
    await tween(150, (t) => { f.x = lerp(fx, mp.x, t); f.y = lerp(fy, mp.y, t); f.sc = 1 - t; draw(f); });
    f.g.remove();
    B.mouth.style.opacity = '0';
    sfx('bearChomp');
    await tween(420, (t) => { const e = 1 - smooth(t); poseBear(B, { lean: -6 * e, head: -40 * e + 10 * (1 - e), crouch: e }); });
    for (let i = 0; i < 3; i++) await tween(170, (t) => poseBear(B, { head: 10 + Math.sin(t * Math.PI) * 5 })); // chewing
    sfx('bearGulp');
    B.eye.style.opacity = '0'; B.happy.style.opacity = '1';
    fedTo('off-bear', f); // "RUN BEAR, RUN!!!!" — dinner's done
    await tween(300, (t) => poseBear(B, { head: 10 * (1 - t) }));
    await sleep(500);
    // turn around and walk back behind the peaks
    await tween(320, (t) => { B.flip = Math.cos(t * Math.PI); poseBear(B); });
    B.face = -1; B.flip = 1;
    B.eye.style.opacity = '1'; B.happy.style.opacity = '0';
    await bearWalk(B, BEAR_IN, 4000);
    B.wrap.remove();
    bearBusy = false;
  }

  // the trees / the lower-left corner: a crow flies in, pecks it to nothing and flies off
  const makeCrow = () => {
    const c = el('g', { class: 'crow' }, sky);
    const body = el('g', {}, c); // pecking tips this forward around the feet
    el('path', { class: 'crow-b', d: 'M-6 -1L-13 -4L-12 1.5Z' }, body);
    el('ellipse', { class: 'crow-b', cx: 0, cy: -1, rx: 7, ry: 4.5 }, body);
    el('circle', { class: 'crow-b', cx: 6, cy: -4.5, r: 3.4 }, body);
    el('path', { class: 'crow-beak', d: 'M8.8 -5.6L13.6 -4.3L8.8 -3Z' }, body);
    el('circle', { class: 'crow-eye', cx: 6.9, cy: -5.4, r: 0.9 }, body);
    const wing = el('path', { class: 'crow-w', d: 'M1.5 -3C-1 -12 -8 -14 -12 -10C-8 -8 -4 -5 1.5 -3Z' }, body);
    const legs = el('path', { class: 'crow-leg', d: 'M-1 3.2V6.5M2 3.2V6.5' }, body);
    return { c, body, wing, legs, x: -40, y: -40, face: 1, flap: 0.25 };
  };
  const drawCrow = (k, peck = 0) => {
    k.c.setAttribute('transform', `translate(${k.x.toFixed(1)} ${k.y.toFixed(1)}) scale(${k.face * 1.15} 1.15)`);
    k.body.setAttribute('transform', `rotate(${peck.toFixed(1)} 0 6)`);
    k.wing.setAttribute('transform', `translate(0 -3) scale(1 ${k.flap.toFixed(2)}) translate(0 3)`);
  };
  let lastFlap = 0;
  const fly = (k, x0, y0, x1, y1, ms, arc) => {
    const cx = (x0 + x1) / 2, cy = Math.min(y0, y1) + arc;
    k.face = x1 >= x0 ? 1 : -1;
    k.legs.style.opacity = '0';
    return tween(ms, (t) => {
      const e = smooth(t), u = 1 - e;
      k.x = u * u * x0 + 2 * u * e * cx + e * e * x1;
      k.y = u * u * y0 + 2 * u * e * cy + e * e * y1;
      k.flap = Math.sin(performance.now() / 45) * 0.85 + 0.15;
      drawCrow(k);
      const now = performance.now();
      if (now - lastFlap > 130) { lastFlap = now; sfx('crowFlap'); }
    });
  };
  async function eatenByCrows(f) {
    const R = 11 * f.s + 7;
    // one crow lands next to it, on whichever side has room inside the map (the map's left edge → it lands on the right);
    // right at the top or bottom edge the fish first flops itself a little inwards
    const sy = Math.max(28, Math.min(378, f.y));
    if (Math.abs(sy - f.y) > 1) { const s0 = flop(f); await sleep(300); s0(); await hopTo(f, f.x, sy); }
    const left = f.x - R - 17 >= 2;
    const perch = left ? { x: f.x - R, y: f.y + 2, face: 1 } : { x: f.x + R, y: f.y + 2, face: -1 };
    const stop = flop(f);
    layer.appendChild(sky); // above the fish
    const k = makeCrow();
    await fly(k, left ? -30 : 530, rnd(-30, 60), perch.x, perch.y, 1300, -40);
    k.face = perch.face; k.flap = 0.25; k.legs.style.opacity = '1'; drawCrow(k);
    stop();
    sfx('crowCaw');
    await sleep(420);
    for (let p = 1; p <= 6; p++) {
      sfx('crowPeck');
      crumbs(f.x, f.y, 2);
      await tween(220, (t) => { drawCrow(k, Math.sin(t * Math.PI) * 28); f.sc = 1 - (p - 1 + t) / 6; f.ang = Math.sin(t * Math.PI * 2) * 8; draw(f); });
      await sleep(p === 3 ? 260 : 60); // a short look around halfway through
    }
    f.g.remove();
    fedTo('off-crow', f); // "Air strike"
    await sleep(250);
    sfx('crowCaw');
    await fly(k, k.x, k.y, left ? 540 : -40, rnd(-40, 10), 1300, -30);
    k.c.remove();
  }

  // anywhere else: it grows a pair of legs and walks back to the lake. The legs are worked out every frame: two parts that
  // bend at the knee, each foot stays planted on the ground while the body walks over it, then lifts and swings forward
  // (toe tipping up and down). The body bobs with every step, rocks a little and the tail swings; each footfall kicks up
  // a bit of dust and plays the next note of a little walking tune. At the shore it crouches and dives in.
  const dust = (x, y, s, into) => {
    const c = el('circle', { class: 'dust', cx: x.toFixed(1), cy: y.toFixed(1), r: (1.3 * s).toFixed(2) }, into);
    c.animate([{ transform: 'translate(0,0) scale(1)', opacity: 0.7 }, { transform: `translate(${rnd(-2, 2) * s}px,${-2.5 * s}px) scale(2.6)`, opacity: 0 }],
      { duration: 420, easing: 'ease-out', fill: 'both' }).onfinish = () => c.remove();
  };
  async function walkBack(f) {
    const stop = flop(f);
    await sleep(450);
    stop();
    const a0 = f.ang;
    await tween(160, (t) => { f.ang = lerp(a0, 0, t); draw(f); });
    // which way the lake is, and how far along that line the water starts
    const to = nearestWater(f.x, f.y);
    const D0 = Math.hypot(to.x - f.x, to.y - f.y) || 1, ux = (to.x - f.x) / D0, uy = (to.y - f.y) / D0;
    let shore = D0;
    for (let d = 0; d <= D0; d += 1) if (onWater(f.x + ux * d, f.y + uy * d)) { shore = d; break; }
    shore = Math.max(0, shore - 3 * f.s); // stop with the front foot at the water's edge
    if (Math.abs(ux) > 0.15 && Math.sign(ux) !== f.face) await turn(f);
    const s = f.s, A = 4.6 * s, H = 7.4 * s, STEP = 6 * s, STANCE = 0.6, STRIDE = STEP / STANCE, HIP = 3.2 * s;
    const tail = f.g.querySelector('path.fin');
    // the legs live in their own group behind the fish, in map units; far leg first (drawn darker)
    const wrap = el('g', {});
    layer.insertBefore(wrap, f.g);
    const shadow = el('ellipse', { class: 'fish-shadow', rx: (8 * s).toFixed(1), ry: (2 * s).toFixed(1) }, wrap);
    const legs = [{ far: true, hx: -1.3, ph: 0.5 }, { far: false, hx: 1.3, ph: 0 }].map((L) => {
      const g = el('g', { class: 'fleg' + (L.far ? ' far' : '') }, wrap);
      L.o = el('path', { class: 'fleg-o', 'stroke-width': (2.7 * s).toFixed(2) }, g);
      L.i = el('path', { class: 'fleg-i', 'stroke-width': (1.25 * s).toFixed(2) }, g);
      L.foot = el('ellipse', { class: 'ffoot', rx: (2.5 * s).toFixed(2), ry: (1.2 * s).toFixed(2), 'stroke-width': (0.9 * s).toFixed(2) }, g);
      L.swing = false;
      return L;
    });
    const x0 = f.x, y0 = f.y;
    let dist = 0, grow = 0, crouch = 0, steps = 0;
    // pose everything for the current distance walked; air: 0..1 while diving (legs trail behind and tuck away)
    const pose = (air = -1) => {
      const cyc = dist / STRIDE;
      const bob = air >= 0 ? 0 : 0.45 * s * Math.cos(cyc * Math.PI * 4) * grow;
      const hipH = H * grow * (1 - 0.32 * crouch) + bob;
      if (air < 0) { f.x = x0 + ux * dist; f.y = y0 + uy * dist; f.lift = hipH + HIP; f.ang = f.face * Math.sin(cyc * Math.PI * 2) * 2.2; }
      if (tail) tail.setAttribute('transform', `rotate(${(Math.sin(cyc * Math.PI * 2) * 14 * grow).toFixed(1)} -7 0)`);
      draw(f);
      const gx = f.x, gy = f.y, hipY = gy - f.lift + HIP, a = A * Math.max(0.001, grow);
      shadow.setAttribute('cx', gx.toFixed(1)); shadow.setAttribute('cy', (air >= 0 ? f.ground : gy).toFixed(1));
      legs.forEach((L) => {
        const hipX = gx + f.face * L.hx * s;
        let fx, fy, pitch = 0;
        if (air >= 0) { // in the air: legs hang back and down
          fx = hipX - f.face * 3 * s * grow; fy = hipY + 1.85 * a; pitch = 30;
        } else {
          const ph = (cyc + L.ph) % 1;
          let off, up = 0;
          const swing = ph >= STANCE;
          if (!swing) off = STEP / 2 - STEP * (ph / STANCE); // planted: slides back under the body exactly as fast as the body moves
          else { const p = (ph - STANCE) / (1 - STANCE); off = -STEP / 2 + STEP * smooth(p); up = Math.sin(Math.PI * p) * 2.6 * s; pitch = lerp(20, -25, p); }
          if (L.swing && !swing && grow > 0.95 && crouch === 0) { // foot comes down
            steps++; sfx('fishStep', steps); dust(hipX + ux * off * grow, gy + uy * off * grow, s, wrap);
          }
          L.swing = swing;
          fx = hipX + ux * off * grow; fy = gy + uy * off * grow - up * grow;
        }
        // two-part leg: knee where the thigh and shin (both length a) meet, bending forward
        const dx = fx - hipX, dy = fy - hipY, d = Math.hypot(dx, dy) || 0.001, m = Math.min(d, 2 * a * 0.999);
        const h = Math.sqrt(Math.max(0, a * a - (m / 2) ** 2));
        let px = -dy / d, py = dx / d;
        if (Math.sign(px || 1) !== f.face) { px = -px; py = -py; }
        const kx = hipX + dx / 2 + px * h, ky = hipY + dy / 2 + py * h;
        const dpath = `M${hipX.toFixed(2)} ${hipY.toFixed(2)}L${kx.toFixed(2)} ${ky.toFixed(2)}L${fx.toFixed(2)} ${fy.toFixed(2)}`;
        L.o.setAttribute('d', dpath); L.i.setAttribute('d', dpath);
        L.foot.setAttribute('cx', (fx + f.face * 1.3 * s * grow).toFixed(2)); L.foot.setAttribute('cy', fy.toFixed(2));
        L.foot.setAttribute('transform', `rotate(${(f.face * pitch).toFixed(1)} ${fx.toFixed(2)} ${fy.toFixed(2)})`);
        L.foot.style.opacity = grow < 0.05 ? '0' : '1';
      });
    };
    // the legs push out and stand it up
    sfx('legsGrow');
    await tween(420, (t) => { grow = backOut(t); pose(); });
    grow = 1;
    if (site.ach) site.ach.unlock('off-walk'); // "FISH CAN WALK?!" — the legs are out, off it goes
    await sleep(220);
    // walk: speeds up over the first half second, slows down for the last few steps
    const vmax = 20 + 10 * s;
    await new Promise((done) => {
      let last = performance.now(), t0 = last;
      const tick = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const v = vmax * Math.min(1, (now - t0) / 500) * Math.max(0.3, Math.min(1, (shore - dist) / (8 * s)));
        dist = Math.min(shore, dist + v * dt);
        pose();
        if (dist >= shore) { done(); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    // crouch…
    await tween(220, (t) => { crouch = smooth(t); pose(); });
    // …and dive: an arc into the water, nose first, legs trailing and tucking away
    sfx('fishHop');
    const jx0 = f.x, jy0 = f.y - f.lift;
    const px1 = f.x + ux * (12 + 6 * s), py1 = f.y + uy * (12 + 6 * s);
    const P = onWater(px1, py1) ? { x: px1, y: py1 } : to;
    f.ground = f.y;
    await tween(420, (t) => {
      grow = Math.max(0, 1 - t / 0.55);
      f.lift = 0;
      f.x = lerp(jx0, P.x, t);
      f.y = lerp(jy0, P.y, t) - Math.sin(t * Math.PI) * (10 + 4 * s);
      f.ground = lerp(f.ground, P.y, 0.2);
      f.ang = f.face * lerp(-30, 60, t);
      shadow.style.opacity = String(1 - t);
      pose(t);
    });
    wrap.remove();
    f.g.remove();
    splash(P.x, P.y, s);
    sfx('fishIn', f.k);
  }

  let timer = 0, on = false;
  const loop = () => { if (!on) return; if (!document.hidden && !map.classList.contains('lake-muted')) jump(); timer = setTimeout(loop, 1800 + Math.random() * 2600); }; // a speaker in the lake scares them off
  new IntersectionObserver((ents) => {
    const vis = ents.some((e) => e.isIntersecting);
    if (vis && !on) { on = true; timer = setTimeout(loop, 900); } else if (!vis) { on = false; clearTimeout(timer); }
  }).observe(lake || map); // only while at least a bit of the lake itself is on screen
});
