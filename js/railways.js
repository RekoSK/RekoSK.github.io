/* rekosk.dev: duhel_railways.run, the minecart minigame */
'use strict';

rekoSite.part((site) => {
  const { $, $$, reduceMotion, ui, makeWin, toFront } = site;

  /* ---------- duhel_railways.run ----------
     Typing "duhel" in the About terminal opens this window: a 3×3 grid in the middle and ten Minecraft pieces redrawn
     in the site's style (1 redstone torch, 4 powered rails, 4 rails, 1 minecart). The first time it opens they rain in
     from the top. Loose pieces have gravity and pile up; they can be dragged anywhere inside the window (never out of it)
     and dropped into an empty cell (the minecart onto a cell with a rail).
     - a plain rail turns to meet the rails next to it: one neighbour left/right + one up/down = a curve, else straight
     - a powered rail lines up with its neighbours when it's placed and never turns after that
     - a powered rail within one cell of the torch (diagonals too) lights up red
     - the minecart sits on any rail; a lit powered rail pushes it along the line, it rolls on over plain rails, an unlit
       powered rail brakes it, and where the line ends or doesn't connect it flies off and falls into the pile.
     Nothing is saved: it stays as you left it until the page reloads. */
  (() => {
    const win = $('#railWin');
    if (!win) return;
    const rw = makeWin(win);
    const stage = $('.rr-stage', win), grid = $('.rr-grid', stage), slots = $$('i', grid);
    new MutationObserver(() => { if (!win.hidden) { toFront(win); wake(); } }).observe(win, { attributes: true, attributeFilter: ['hidden'] });

    const SIDES = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }, OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
    const ENDS = { ns: ['n', 's'], ew: ['e', 'w'], ne: ['n', 'e'], nw: ['n', 'w'], se: ['s', 'e'], sw: ['s', 'w'] };
    const ROT = { ns: 0, ew: 90, se: 0, sw: 90, nw: 180, ne: 270 }; // straight art runs n–s, curve art joins s + e
    const RAILS = { rail: 1, power: 1 };

    // the art: flat, black-outlined, 48×48 (rails seen from above, the cart too)
    const O = 'stroke="#0b0b0b" stroke-linejoin="round" stroke-linecap="round"';
    const ties = (c) => [3.5, 13.5, 23.5, 33.5, 43.5].map((y) => `<rect x="8" y="${y - 2.6}" width="32" height="5.2" rx="1" fill="${c}" ${O} stroke-width="1.8"/>`).join('');
    const bar = (x, c) => `<path d="M${x} 0V48" stroke="#0b0b0b" stroke-width="6.6"/><path d="M${x} 0V48" stroke="${c}" stroke-width="3.4"/>`;
    const arcTies = (c) => [195, 217, 240, 262].map((d) => {
      const r = (d * Math.PI) / 180, p = (k) => `${(48 + k * Math.cos(r)).toFixed(1)} ${(48 + k * Math.sin(r)).toFixed(1)}`;
      return `<path d="M${p(8)}L${p(40)}" stroke="#0b0b0b" stroke-width="6.8"/><path d="M${p(8.9)}L${p(39.1)}" stroke="${c}" stroke-width="3.4"/>`;
    }).join('');
    const arc = (r, c) => `<path d="M${48 - r} 48A${r} ${r} 0 0 1 48 ${48 - r}" fill="none" stroke="#0b0b0b" stroke-width="6.6"/><path d="M${48 - r} 48A${r} ${r} 0 0 1 48 ${48 - r}" fill="none" stroke="${c}" stroke-width="3.4"/>`;
    const svg = (cls, body) => `<svg class="${cls}" viewBox="0 0 48 48" aria-hidden="true">${body}</svg>`;
    const ART = {
      rail: svg('rr-s', ties('#7a5a3c') + bar(14, '#bdb8b1') + bar(34, '#bdb8b1')) + svg('rr-c', arcTies('#7a5a3c') + arc(34, '#bdb8b1') + arc(14, '#bdb8b1')),
      power: svg('rr-s', ties('#4a3a2c') + '<path class="rr-wire" d="M24 2V46" stroke-width="3" stroke-linecap="round"/>' + bar(14, '#fe7700') + bar(34, '#fe7700')),
      torch: svg('rr-s', '<circle class="rr-glow" cx="24" cy="14" r="14"/><rect x="20.5" y="17" width="7" height="28" rx="1.6" fill="#7a5a3c" ' + O + ' stroke-width="2.2"/>'
        + '<rect x="18" y="7" width="12" height="12" rx="2.4" fill="#e5262f" ' + O + ' stroke-width="2.2"/><rect x="20.5" y="9.5" width="3.6" height="3.6" fill="#ff9a9e"/>'),
      cart: svg('rr-s', '<rect x="4.5" y="10" width="5" height="9" rx="1.5" fill="#8f8f8f" ' + O + ' stroke-width="2"/><rect x="38.5" y="10" width="5" height="9" rx="1.5" fill="#8f8f8f" ' + O + ' stroke-width="2"/>'
        + '<rect x="4.5" y="29" width="5" height="9" rx="1.5" fill="#8f8f8f" ' + O + ' stroke-width="2"/><rect x="38.5" y="29" width="5" height="9" rx="1.5" fill="#8f8f8f" ' + O + ' stroke-width="2"/>'
        + '<rect x="8.5" y="4.5" width="31" height="39" rx="5" fill="#3a3a3a" ' + O + ' stroke-width="2.4"/><rect x="14" y="10.5" width="20" height="27" rx="3" fill="#1a1a1a" ' + O + ' stroke-width="1.8"/>'
        + '<path d="M13 7.5H35M13 40.5H35" stroke="#fe7700" stroke-width="2.6" stroke-linecap="round"/>')
    };
    const SND = { rail: 'rail', power: 'rail', torch: 'torch', cart: 'cart' };

    const items = ['torch', 'power', 'power', 'power', 'power', 'rail', 'rail', 'rail', 'rail', 'cart'].map((kind) => {
      const el = document.createElement('div');
      el.className = 'rr-item rr-' + kind;
      el.innerHTML = `<div class="rr-rot">${ART[kind]}</div>`;
      stage.append(el);
      return { el, rot: $('.rr-rot', el), kind, x: 0, y: -9999, vx: 0, vy: 0, a: 0, va: 0, cell: -1, held: false, fresh: true, shape: 'ns', deg: 0, on: false, hitAt: 0 };
    });
    const cart = items[items.length - 1];
    let ride = null; // the cart on the grid: { c, from, to, t, moving, stopAt }
    // "Railway builder" achievement: one full lap of the ring of rails around the torch (in the middle cell) on one ride,
    // from where the cart started moving back to that spot, without falling off (reko:rail-loop, once)
    let lap = null, lapDone = false;
    const cells = Array.from({ length: 9 }, () => ({ item: null, cart: null }));
    let W = 0, H = 0, cs = 60, gx = 0, gy = 0, booted = false, raf = 0, last = 0, calm = 0, lastHit = 0, boosts = 0, quiet = false;
    const sfx = (name, a, b) => { if (!quiet) try { ui.play(name, a, b); } catch (err) {} };
    const rad = () => cs * 0.36; // a loose piece's size for bumping into things
    const center = (c) => [gx + ((c % 3) + 0.5) * cs, gy + (Math.floor(c / 3) + 0.5) * cs];
    const nb = (c, s) => { const x = (c % 3) + SIDES[s][0], y = Math.floor(c / 3) + SIDES[s][1]; return x < 0 || x > 2 || y < 0 || y > 2 ? -1 : y * 3 + x; };
    const railAt = (c) => c >= 0 && cells[c].item && RAILS[cells[c].item.kind] ? cells[c].item : null;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    const draw = (it) => {
      const sc = it.cell >= 0 ? (it === cart ? 0.82 : 1) : it.held ? 0.86 : 0.72;
      it.el.style.transform = `translate(${it.x - cs / 2}px,${it.y - cs / 2}px) rotate(${it.a}deg) scale(${sc})`;
    };
    const setShape = (it, shape, anim) => {
      const want = ROT[shape], d = ((want - it.deg) % 360 + 540) % 360 - 180; // turn the short way round
      const changed = shape !== it.shape;
      it.shape = shape; it.deg += d;
      it.el.classList.toggle('curve', shape.length === 2 && shape !== 'ns' && shape !== 'ew');
      it.rot.style.rotate = it.deg + 'deg';
      if (changed && anim) { it.el.classList.remove('turn'); void it.el.offsetWidth; it.el.classList.add('turn'); }
      return changed;
    };

    const layout = () => {
      if (win.hidden || !stage.clientWidth) return;
      W = stage.clientWidth; H = stage.clientHeight;
      cs = Math.round(clamp(Math.min(W * 0.78, H * 0.6) / 3, 34, 96));
      gx = Math.round((W - 3 * cs) / 2); gy = Math.round(Math.max(8, (H - 3 * cs) * 0.36));
      stage.style.setProperty('--cs', cs + 'px');
      grid.style.translate = `${gx}px ${gy}px`;
      items.forEach((it) => {
        if (it.cell >= 0 && it !== cart) [it.x, it.y] = center(it.cell);
        else if (!it.fresh) { it.x = clamp(it.x, rad(), W - rad()); it.y = Math.min(it.y, H - rad()); }
        draw(it);
      });
      if (ride) cartOnPath();
      wake();
    };
    new ResizeObserver(layout).observe(stage);

    /* ----- the rail rules ----- */
    const sidesWithRails = (c) => ({ h: ['e', 'w'].filter((s) => railAt(nb(c, s))), v: ['n', 's'].filter((s) => railAt(nb(c, s))) });
    const plainShape = (c, cur) => {
      const { h, v } = sidesWithRails(c);
      if (h.length === 1 && v.length === 1) return v[0] + h[0]; // the "triangle": bend to join both
      if (h.length === 2) return 'ew';
      if (v.length === 2) return 'ns';
      return h.length ? 'ew' : v.length ? 'ns' : cur;
    };
    const poweredShape = (c) => { // decided once, when it's placed
      const { h, v } = sidesWithRails(c);
      if (h.length !== v.length) return h.length > v.length ? 'ew' : 'ns';
      return (c === 1 || c === 7) ? 'ew' : 'ns'; // nothing to line up with: follow the edge of the grid it sits on
    };
    const lit = (c) => cells.some((cell, t) => cell.item && cell.item.kind === 'torch' && Math.abs((t % 3) - (c % 3)) <= 1 && Math.abs(Math.floor(t / 3) - Math.floor(c / 3)) <= 1);
    const joins = (c, s) => { const n = nb(c, s), r = railAt(n); return r && ENDS[r.shape].includes(OPP[s]) ? n : -1; };

    // after anything in the grid changes: plain rails turn, powered rails light up / go out, the cart reacts
    const update = (placed) => {
      let turned = false;
      cells.forEach((cell, c) => { const r = cell.item; if (r && r.kind === 'rail' && setShape(r, plainShape(c, r.shape), true) && r !== placed) turned = true; });
      if (turned) sfx('railTurn');
      let k = 0;
      cells.forEach((cell, c) => {
        const r = cell.item;
        if (!r || r.kind !== 'power') return;
        const on = lit(c);
        if (on !== r.on) { r.on = on; r.el.classList.toggle('on', on); sfx(on ? 'railPower' : 'railOff', k++); }
      });
      if (!ride) return;
      const r = railAt(ride.c), ends = ENDS[r.shape];
      if (!(ends.includes(ride.from) && ends.includes(ride.to))) { // its own rail turned under it
        if (ends.includes(ride.from)) ride.to = ends[0] === ride.from ? ends[1] : ends[0];
        else if (ends.includes(ride.to)) ride.from = ends[0] === ride.to ? ends[1] : ends[0];
        else [ride.from, ride.to] = ends;
      }
      if (!ride.moving && r.kind === 'power' && r.on) push();
      cartOnPath();
    };

    /* ----- the minecart ----- */
    const SPEED = 2.6; // cells per second
    const edge = (c, s) => { const [x, y] = center(c); return [x + SIDES[s][0] * cs / 2, y + SIDES[s][1] * cs / 2]; };
    const pathAt = (c, from, to, t) => { // a point on the rail from one side of the cell to the other, and the heading there
      const [x0, y0] = edge(c, from), [x1, y1] = edge(c, to);
      if (OPP[from] === to) return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, Math.atan2(y1 - y0, x1 - x0)];
      const [cx, cy] = center(c), kx = cx + (SIDES[from][0] + SIDES[to][0]) * cs / 2, ky = cy + (SIDES[from][1] + SIDES[to][1]) * cs / 2;
      const a0 = Math.atan2(y0 - ky, x0 - kx), a1 = Math.atan2(y1 - ky, x1 - kx);
      const da = ((a1 - a0 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI, a = a0 + da * t;
      return [kx + Math.cos(a) * cs / 2, ky + Math.sin(a) * cs / 2, a + Math.sign(da) * Math.PI / 2];
    };
    const pathLen = () => (OPP[ride.from] === ride.to ? cs : (Math.PI / 4) * cs);
    const cartOnPath = () => {
      const [x, y, h] = pathAt(ride.c, ride.from, ride.to, ride.t);
      const deg = (h * 180) / Math.PI + 90;
      cart.x = x; cart.y = y;
      cart.a += ((deg - cart.a) % 360 + 540) % 360 - 180;
      draw(cart);
    };
    // a lit powered rail gives it a shove: towards the end that carries on into another rail (or off the edge if none does)
    const push = () => {
      const ends = ENDS[railAt(ride.c).shape];
      let to = ride.moving ? ride.to : ends.find((s) => joins(ride.c, s) >= 0 && !cells[joins(ride.c, s)].cart) || ride.to;
      if (!ends.includes(to)) to = ends[1];
      if (!ride.moving) { ride.from = to === ends[0] ? ends[1] : ends[0]; ride.to = to; }
      if (!lap || lap.ride !== ride) lap = { ride, c: ride.c, t: ride.t, n: 0 };
      ride.moving = true; ride.stopAt = null;
      sfx('cartBoost', boosts++);
      wake();
    };
    const falls = (vx, vy) => { // off the rails, into the pile
      if (ride) cells[ride.c].cart = null;
      ride = null;
      cart.cell = -1; cart.el.classList.remove('placed');
      cart.vx = vx; cart.vy = vy; cart.va = (Math.random() - 0.5) * 500;
      wake();
    };
    const rideStep = (dt) => {
      if (!ride || !ride.moving) return;
      ride.t += (SPEED * cs * dt) / pathLen();
      if (ride.stopAt != null && ride.t >= ride.stopAt) { ride.t = ride.stopAt; ride.moving = false; ride.stopAt = null; cartOnPath(); return; }
      while (ride && ride.t >= 1) {
        const n = joins(ride.c, ride.to);
        if (n < 0 || cells[n].cart) { // dead end: it flies off and drops
          const [, , h] = pathAt(ride.c, ride.from, ride.to, 1), v = SPEED * cs;
          ride.t = 1; cartOnPath();
          sfx('cartOff');
          falls(Math.cos(h) * v, Math.sin(h) * v - cs * 2);
          return;
        }
        cells[ride.c].cart = null; cells[n].cart = cart; cart.cell = n;
        const ends = ENDS[railAt(n).shape], from = OPP[ride.to];
        ride.t -= 1; ride.c = n; ride.from = from; ride.to = ends[0] === from ? ends[1] : ends[0];
        if (lap && lap.ride === ride) lap.n++;
        sfx('cartClack');
        const r = railAt(n);
        if (r.kind === 'power') { if (r.on) sfx('cartBoost', boosts++); else { ride.stopAt = 0.5; ride.t = Math.min(ride.t, 0.5); sfx('cartBrake'); } }
      }
      if (ride) cartOnPath();
      const mid = cells[4].item;
      if (!lapDone && ride && lap && lap.ride === ride && lap.n >= 8 && ride.c === lap.c && ride.t >= lap.t && mid && mid.kind === 'torch') {
        lapDone = true;
        document.dispatchEvent(new CustomEvent('reko:rail-loop'));
      }
    };

    /* ----- loose pieces: gravity, bumping, landing sounds ----- */
    const G = 2300;
    const hit = (it, sp) => {
      const now = performance.now();
      if (sp < 150 || now - it.hitAt < 90 || now - lastHit < 28) return;
      it.hitAt = lastHit = now;
      sfx('railHit', sp / 1500, SND[it.kind]);
    };
    const step = (dt) => {
      const r = rad(), loose = items.filter((it) => it.cell < 0 && !it.held);
      const support = new Set();
      loose.forEach((it) => {
        it.vy += G * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.a += it.va * dt; it.va *= 0.985;
        if (it.fresh && it.y > r) it.fresh = false;
      });
      for (let pass = 0; pass < 4; pass++) {
        loose.forEach((it) => {
          if (it.y > H - r) { if (pass === 0) hit(it, it.vy); it.y = H - r; if (it.vy > 0) it.vy *= -0.18; if (Math.abs(it.vy) < 60) it.vy = 0; it.vx *= 0.86; support.add(it); }
          if (it.x < r) { it.x = r; if (it.vx < 0) { hit(it, -it.vx); it.vx *= -0.35; } }
          if (it.x > W - r) { it.x = W - r; if (it.vx > 0) { hit(it, it.vx); it.vx *= -0.35; } }
          if (!it.fresh && it.y < r) { it.y = r; if (it.vy < 0) it.vy = 0; }
        });
        // pieces bump into each other (and get shoved by the one you're holding)
        const bodies = items.filter((it) => it.cell < 0);
        for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i], b = bodies[j];
          if (a.held && b.held) continue;
          let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
          if (d >= 2 * r) continue;
          if (d < 0.01) { dx = Math.random() - 0.5; dy = -1; d = Math.hypot(dx, dy); }
          const nx = dx / d, ny = dy / d, over = 2 * r - d;
          const wa = a.held ? 0 : b.held ? 1 : 0.5, wb = 1 - wa;
          a.x -= nx * over * wa; a.y -= ny * over * wa; b.x += nx * over * wb; b.y += ny * over * wb;
          const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rv < 0) {
            if (pass === 0) hit(rv < -150 && a.held ? b : a, -rv);
            const imp = -1.2 * rv;
            a.vx -= nx * imp * wa; a.vy -= ny * imp * wa; b.vx += nx * imp * wb; b.vy += ny * imp * wb;
            // a bit of friction + spin from the glancing part of the hit
            const tx = -ny, ty = nx, tv = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty;
            a.vx += tx * tv * 0.15 * wa; a.vy += ty * tv * 0.15 * wa; b.vx -= tx * tv * 0.15 * wb; b.vy -= ty * tv * 0.15 * wb;
            // only a real knock spins them (pieces just resting on each other press together every frame and would twitch)
            if (-rv > 140) { a.va = clamp(a.va - tv * 0.5 * wa, -600, 600); b.va = clamp(b.va + tv * 0.5 * wb, -600, 600); }
          }
          if (ny > 0.5) support.add(b); else if (ny < -0.5) support.add(a); // the upper one rests on the lower one
        }
      }
      // resting pieces settle flat on a side instead of balancing on a corner
      loose.forEach((it) => {
        // resting on the floor or another piece: stop spinning and ease onto the nearest flat side (never more than 45° away)
        if (support.has(it) && Math.hypot(it.vx, it.vy) < 220) { it.va = 0; it.a += (Math.round(it.a / 90) * 90 - it.a) * Math.min(1, dt * 7); }
        else if (support.has(it)) it.va *= 0.8;
        if (support.has(it) && Math.abs(it.vx) < 4) it.vx = 0;
        draw(it);
      });
      return loose.some((it) => Math.hypot(it.vx, it.vy) > 6 || Math.abs(it.va) > 8 || it.fresh);
    };
    const frame = (now) => {
      raf = 0;
      if (win.hidden) return; // paused while it's closed; carries on where it was when reopened
      const dt = Math.min(1 / 30, (now - last) / 1000 || 0);
      last = now;
      const busy = step(dt);
      rideStep(dt);
      calm = busy || drag || (ride && ride.moving) ? 0 : calm + dt;
      if (calm < 0.6) raf = requestAnimationFrame(frame);
    };
    function wake() { calm = 0; if (!raf && !win.hidden && W) { last = performance.now(); raf = requestAnimationFrame(frame); } }

    /* ----- dragging ----- */
    let drag = null;
    const local = (e) => { const b = stage.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    const cellAt = (x, y) => { const cx = Math.floor((x - gx) / cs), cy = Math.floor((y - gy) / cs); return cx < 0 || cx > 2 || cy < 0 || cy > 2 ? -1 : cy * 3 + cx; };
    const fits = (it, c) => c >= 0 && (it === cart ? !!railAt(c) && !cells[c].cart : !cells[c].item);
    const hot = (c) => slots.forEach((s, i) => s.classList.toggle('hot', i === c));
    const lift = (it) => {
      if (it.cell >= 0) {
        if (it === cart) { cells[it.cell].cart = null; ride = null; }
        else {
          cells[it.cell].item = null;
          if (it.on) { it.on = false; it.el.classList.remove('on'); }
          if (cells[it.cell].cart && ride) { // the cart loses the rail under it and drops
            const [, , h] = pathAt(ride.c, ride.from, ride.to, ride.t), v = ride.moving ? SPEED * cs * 0.6 : 0;
            falls(Math.cos(h) * v, Math.sin(h) * v - cs * 0.6);
          }
        }
        it.cell = -1;
        it.el.classList.remove('placed');
        update();
      }
      it.held = true; it.fresh = false; it.vx = it.vy = it.va = 0;
      it.el.classList.add('held');
      it.el.classList.remove('snap');
    };
    stage.addEventListener('pointerdown', (e) => {
      const el = e.target.closest('.rr-item');
      if (!el || e.button !== 0 || drag) return;
      const it = items.find((x) => x.el === el), [px, py] = local(e);
      e.preventDefault();
      if (document.activeElement && document.activeElement.closest('.term')) document.activeElement.blur(); // leave the terminal, as a normal click would
      el.setPointerCapture(e.pointerId);
      lift(it);
      drag = { it, id: e.pointerId, ox: it.x - px, oy: it.y - py, hist: [[performance.now(), it.x, it.y]] };
      sfx('railGrab');
      draw(it);
      wake();
    });
    stage.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const it = drag.it, [px, py] = local(e), r = rad();
      it.x = clamp(px + drag.ox, r, W - r); it.y = clamp(py + drag.oy, r, H - r); // it can't leave the window
      drag.hist.push([performance.now(), it.x, it.y]);
      if (drag.hist.length > 6) drag.hist.shift();
      const c = cellAt(it.x, it.y);
      hot(fits(it, c) ? c : -1);
      draw(it);
    });
    const drop = (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const it = drag.it, c = cellAt(it.x, it.y), h = drag.hist;
      drag = null;
      hot(-1);
      it.held = false;
      it.el.classList.remove('held');
      if (e.type !== 'pointercancel' && fits(it, c)) {
        it.cell = c; it.vx = it.vy = it.va = 0;
        it.el.classList.add('placed', 'snap');
        setTimeout(() => it.el.classList.remove('snap'), 320);
        if (it === cart) {
          cells[c].cart = cart;
          const ends = ENDS[railAt(c).shape];
          ride = { c, from: ends[0], to: ends[1], t: 0.5, moving: false, stopAt: null };
          sfx('railPlace', 'cart');
          cartOnPath();
        } else {
          cells[c].item = it;
          it.a = Math.round(it.a / 360) * 360;
          [it.x, it.y] = center(c);
          if (it.kind === 'power') setShape(it, poweredShape(c), false);
          if (it.kind === 'rail') setShape(it, plainShape(c, it.shape), false);
          sfx(it.kind === 'torch' ? 'torchOn' : 'railPlace', it.kind);
          draw(it);
        }
        update(it);
      } else { // let go: it keeps the speed you threw it with
        const [t0, x0, y0] = h[0], [t1, x1, y1] = h[h.length - 1], dt = Math.max(16, t1 - t0) / 1000;
        it.vx = clamp((x1 - x0) / dt, -1600, 1600); it.vy = clamp((y1 - y0) / dt, -1600, 1600);
        it.va = it.vx * 0.4;
        draw(it);
      }
      wake();
    };
    stage.addEventListener('pointerup', drop);
    stage.addEventListener('pointercancel', drop);

    /* ----- first boot: everything rains in from above ----- */
    const boot = () => {
      booted = true;
      const order = items.slice().sort(() => Math.random() - 0.5);
      order.forEach((it, i) => {
        it.x = W * (0.12 + 0.76 * Math.random()); it.y = -cs * (0.7 + i * 0.6);
        it.vx = (Math.random() - 0.5) * 120; it.vy = 0; it.a = Math.random() * 360; it.va = (Math.random() - 0.5) * 420; it.fresh = true;
        draw(it);
      });
      if (reduceMotion) { quiet = true; for (let k = 0; k < 360 && step(1 / 60); k++); quiet = false; return; } // just show them landed
      sfx('railRain');
      wake();
    };
    const open = () => {
      if (!win.hidden) { toFront(win); win.classList.remove('nudge'); void win.offsetWidth; win.classList.add('nudge'); return; }
      rw.open();
      try { ui.play('popIn'); } catch (err) {}
      layout();
      if (!booted) setTimeout(boot, reduceMotion ? 0 : 320);
    };
    document.addEventListener('reko:duhel', open);
  })();
});
