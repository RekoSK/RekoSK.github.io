/* rekosk.dev: photo windows: data-photo buttons open their photo (or video), "find the guy" circles and the
   secret birdhouse unlock */
'use strict';

rekoSite.part((site) => {
  const { $, $$, reduceMotion, ui, achWin, toFront, rzSound, vidBar } = site;

  /* ---------- photo windows ----------
     Any button with data-photo="big.jpg" (and data-title="window title", the polaroids in the map cards) opens that photo in its own movable,
     resizable window, built like the Achievements one; the photo scales with the window. One window per photo
     (clicking the same photo again brings its window to the front and nudges it), any number of different ones. */

  const photoWins = new Map(); // photo src → its open window

  /* "find the guy": a photo button with data-find="x0 y0 x1 y1" (where he is, as fractions of the photo's width / height)
     lets you click him in the photo window; an orange pencil circle gets scribbled around him (a new, wobbly one every
     time, never a perfect ellipse) with a pencil-scratch sound, and the same circle shows on the polaroid afterwards. */
  const found = new Map(); // photo src → the circle's path, so it's still there when the window is reopened
  const SVGNS = 'http://www.w3.org/2000/svg';
  if (!document.getElementById('pencilRough')) { // one shared filter: roughens the stroke edge like graphite on paper
    const defs = document.createElementNS(SVGNS, 'svg');
    defs.setAttribute('width', '0'); defs.setAttribute('height', '0'); defs.setAttribute('aria-hidden', 'true');
    defs.style.position = 'absolute';
    defs.innerHTML = '<filter id="pencilRough" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G"/></filter>';
    document.body.appendChild(defs);
  }
  const findBox = (btn) => (btn.dataset.find || '').trim().split(/\s+/).map(Number);
  // a hand-drawn loop around the box: starts upper left, goes clockwise a bit more than once (overshooting its start),
  // radius wobbles on a few slow waves, drifts outward a little and the whole thing is slightly tilted
  function scribble(bx, W, H) {
    const rnd = (a, b) => a + Math.random() * (b - a);
    const cx = (bx[0] + bx[2]) / 2 * W, cy = (bx[1] + bx[3]) / 2 * H, rx = (bx[2] - bx[0]) / 2 * W * 1.16, ry = (bx[3] - bx[1]) / 2 * H * 1.07;
    const a0 = rnd(-2.3, -1.5), turn = Math.PI * rnd(2.1, 2.28), tilt = rnd(-0.1, 0.1), grow = rnd(0.05, 0.11);
    const ph = [rnd(0, 6.3), rnd(0, 6.3), rnd(0, 6.3)], amp = [rnd(0.03, 0.06), rnd(0.015, 0.03), rnd(0.005, 0.012)];
    const N = 72, pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = a0 + turn * t;
      const r = (1 + amp[0] * Math.sin(2 * a + ph[0]) + amp[1] * Math.sin(3 * a + ph[1]) + amp[2] * Math.sin(7 * a + ph[2])) * (1 - grow / 2 + grow * t);
      const x = rx * r * Math.cos(a), y = ry * r * Math.sin(a);
      pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]);
    }
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ` Q${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
    }
    return d + ` L${pts[N][0].toFixed(1)} ${pts[N][1].toFixed(1)}`;
  }
  // the circle as an overlay on a photo; viewBox = the photo's own shape and "slice", so it lines up with
  // object-fit: contain (window, same shape) and object-fit: cover (the square polaroid) alike
  function circleSvg(d, W, H, animate) {
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'find-svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `<path class="find-ring" pathLength="1" d="${d}"/>`;
    if (animate && !reduceMotion) svg.classList.add('drawing');
    return svg;
  }
  const PHOTO_W = 1000, photoH = (img) => Math.round(PHOTO_W * (img && img.naturalWidth ? img.naturalHeight / img.naturalWidth : 4 / 3));
  function markThumb(btn, d, H, animate) {
    if ($('.find-svg', btn)) return;
    btn.appendChild(circleSvg(d, PHOTO_W, H, animate)); // animated: draws itself on its own, a beat after the window's (.pola-img .drawing in css)
  }
  function wireFind(w, btn, src, thumb) {
    const bx = findBox(btn), view = $('.photo-view', w);
    if (bx.length !== 4 || bx.some(isNaN)) return;
    const H = photoH(thumb);
    if (found.has(src)) view.appendChild(circleSvg(found.get(src), PHOTO_W, H, false));
    view.addEventListener('click', (e) => {
      if (found.has(src)) return;
      const r = view.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      const pad = 0.02;
      if (fx < bx[0] - pad || fx > bx[2] + pad || fy < bx[1] - pad || fy > bx[3] + pad) return; // not him
      const d = scribble(bx, PHOTO_W, H);
      found.set(src, d);
      view.appendChild(circleSvg(d, PHOTO_W, H, true));
      markThumb(btn, d, H, true);
      try { ui.play('pencil', 0.85); } catch (err) {}
      // "Yeah, that's me!" achievement: he's circled on every photo that has a data-find box (this visit; circles reset on reload)
      if ($$('.pola-img[data-find]').every((b) => found.has(b.dataset.photo))) document.dispatchEvent(new CustomEvent('reko:found-all'));
    });
  }

  /* secret birdhouse: a photo button with data-unlock="other.jpg" (data-unlock-sm / data-unlock-alt: its polaroid and alt text)
     ignores the first UNLOCK_QUIET clicks on the photo in its window; the next ones rattle the whole window (a shake + a
     short motif, stronger every click), and click UNLOCK_AT glitches the picture, switches it off like an old TV and back
     on as the opened birdhouse. Those last clicks have a cooldown: until a rattle's sound and shake have played out,
     extra clicks are ignored. It stays open, window and polaroid, until the page is reloaded; a "reko:unlock" event fires
     on document. */
  const unlocked = new Set(); // photo srcs already unlocked
  const UNLOCK_QUIET = 10, UNLOCK_AT = 15;
  const bhShakeLen = (k) => 0.5 + 0.15 * k; // seconds: the longest part of ui's bhShake recipe (its low note)
  const BH_SWAP = 1.75, BH_END = 2.6;       // seconds into the finale (css .bh-final): the new photo goes in while the TV is dark; it's back on
  // the whole window rattles: an inline transform, which the window's own animations (scale / opacity) never touch,
  // so nothing restarts; it dies down over dur seconds
  function shakeWin(w, amp, rot, dur) {
    if (reduceMotion) return;
    const t0 = performance.now();
    const step = (now) => {
      const t = (now - t0) / 1000;
      if (t >= dur || !w.isConnected) { w.style.transform = ''; return; }
      const e = Math.pow(1 - t / dur, 1.6), ph = t * Math.PI * 2 * 13;
      w.style.transform = `translate(${(amp * e * Math.sin(ph)).toFixed(2)}px,${(amp * 0.35 * e * Math.sin(ph * 1.3 + 1)).toFixed(2)}px) rotate(${(rot * e * Math.sin(ph * 0.9 + 0.5)).toFixed(3)}deg)`;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function wireUnlock(w, btn, src) {
    const open = btn.dataset.unlock, view = $('.photo-view', w), img = $('img', view);
    if (!open) return;
    if (unlocked.has(src)) { img.src = open; site.bhShowIn(view, false); return; }
    new Image().src = open; // loaded before the big moment
    let n = 0, wait = 0; // wait: clicks are ignored until then (performance.now())
    view.addEventListener('click', () => {
      if (unlocked.has(src) || performance.now() < wait) return;
      n++;
      if (n <= UNLOCK_QUIET) return; // nothing to see here...
      if (n < UNLOCK_AT) {
        const k = n - UNLOCK_QUIET, s = (k - 1) / Math.max(1, UNLOCK_AT - UNLOCK_QUIET - 2), dur = 0.4 + 0.25 * s;
        shakeWin(w, 4 + 10 * s, 0.6 + 1.6 * s, dur);
        try { ui.play('bhShake', k); } catch (err) {}
        wait = performance.now() + Math.max(bhShakeLen(k), dur) * 1000;
        return;
      }
      unlocked.add(src);
      if (!reduceMotion) view.classList.add('bh-final');
      try { ui.play('bhUnlock'); } catch (err) {}
      setTimeout(() => {
        img.src = open;
        const t = $('img', btn);
        if (t && btn.dataset.unlockSm) t.src = btn.dataset.unlockSm;
        if (btn.dataset.unlockAlt) { img.alt = btn.dataset.unlockAlt; if (t) t.alt = btn.dataset.unlockAlt; }
      }, reduceMotion ? 0 : BH_SWAP * 1000);
      setTimeout(() => { view.classList.remove('bh-final'); site.bhShowIn(view, true); document.dispatchEvent(new CustomEvent('reko:unlock', { detail: { src } })); }, BH_END * 1000);
    });
  }

  let photoN = 0;              // cascades new windows a little, so they don't stack exactly
  const RZ = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
  function openPhoto(btn) {
    const src = btn.dataset.photo;
    const open = photoWins.get(src);
    if (open) {
      toFront(open);
      open.classList.remove('nudge');
      void open.offsetWidth;
      open.classList.add('nudge');
      open.focus({ preventScroll: true });
      try { ui.play('tick', 2600, 0.05); } catch (err) {}
      return;
    }
    const fig = btn.closest('figure'), cap = fig && $('figcaption', fig), thumb = $('img', btn);
    const title = btn.dataset.title || (cap && cap.textContent.trim()) || 'Photo'; // data-title: shown only in the window, not under the polaroid
    const w = document.createElement('div');
    w.className = 'win photo-win';
    w.setAttribute('role', 'dialog');
    w.setAttribute('aria-label', title);
    w.tabIndex = -1;
    w.innerHTML = '<div class="win-bar"><span class="win-title"></span><button class="win-x" type="button" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg></button></div>' +
      '<div class="photo-view"><img alt=""></div>' + RZ.map((d) => `<span class="win-rz" data-d="${d}" aria-hidden="true"></span>`).join('');
    $('.win-title', w).textContent = title;
    // data-glitch="jpg": that part of the title glitches (a quick RGB-split jitter) every few seconds
    const gl = btn.dataset.glitch, gi = gl ? title.lastIndexOf(gl) : -1;
    if (gi >= 0) {
      const tt = $('.win-title', w), g = document.createElement('span');
      g.className = 'win-glitch'; g.dataset.t = gl; g.textContent = gl;
      tt.textContent = title.slice(0, gi);
      tt.append(g, title.slice(gi + gl.length));
    }
    const img = $('.photo-view img', w);
    img.alt = thumb ? thumb.alt : '';
    if (thumb) img.src = thumb.currentSrc || thumb.src; // the small one right away, the big one as soon as it's loaded
    const big = new Image();
    big.onload = () => { if (!unlocked.has(src)) img.src = src; };
    big.src = src;
    // data-video="clip.webm clip.mp4": the photo is just its poster; the window plays the clip over it (looping, muted when
    // the site's sound is off); click the clip to pause / play, an orange play badge shows while paused
    if (btn.dataset.video) {
      const view = $('.photo-view', w), vid = document.createElement('video');
      vid.className = 'photo-vid';
      // data-video can list several files (space-separated, e.g. "clip.webm clip.mp4"); the browser plays the first it can
      btn.dataset.video.trim().split(/\s+/).forEach((f) => {
        const so = document.createElement('source');
        so.src = f;
        so.type = /\.webm$/i.test(f) ? 'video/webm' : 'video/mp4';
        vid.appendChild(so);
      });
      vid.poster = src;
      vid.loop = true; vid.playsInline = true; vid.autoplay = true;
      vid.muted = !site.soundOn;
      vid.setAttribute('aria-label', title);
      const badge = document.createElement('span');
      badge.className = 'vid-play'; badge.setAttribute('aria-hidden', 'true');
      badge.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>';
      view.append(vid, badge);
      w.classList.add('is-video', 'paused');
      // data-music="paradise": that tune (ui.music) plays under the clip while it plays and fades away when it's paused or the
      // window closes (scrubbing the line doesn't count as pausing); three little bars dance next to the title while it's on
      const tune = btn.dataset.music;
      if (tune) {
        w.classList.add('has-tune');
        $('.win-title', w).insertAdjacentHTML('beforeend', '<span class="win-tune" aria-hidden="true"><i></i><i></i><i></i></span>');
        vid.addEventListener('play', () => { try { ui.music(tune); } catch (err) {} });
        vid.addEventListener('pause', () => { if (!$('.vid-bar.scrubbing', w)) try { ui.musicStop(); } catch (err) {} });
      }
      vidBar(vid, w, view, (cb) => view.after(cb));
      vid.play().catch(() => {}); // blocked autoplay just leaves it paused with the badge
    }
    // size: the photo's own shape, ~420px wide, never taller than 80% of the screen
    const ratio = thumb && thumb.naturalWidth ? thumb.naturalHeight / thumb.naturalWidth : 4 / 3, BAR = 44 + (btn.dataset.video ? 52 : 0); // + the video's control bar
    let ww = Math.min(420, innerWidth * 0.9), wh = ww * ratio + BAR;
    if (wh > innerHeight * 0.8) { wh = innerHeight * 0.8; ww = (wh - BAR) / ratio; }
    w.style.width = ww + 'px'; w.style.height = wh + 'px';
    // beside the card it came from (on its roomier side), so the other photos stay clickable; a little cascade per window
    const off = (photoN++ % 6) * 28, cr = (btn.closest('.spot-card') || btn).getBoundingClientRect();
    let wx = cr.left >= innerWidth - cr.right ? cr.left - ww - 18 - off : cr.right + 18 + off;
    let wy = Math.max(80, (innerHeight - wh) / 2 - 56 + off);
    if (wx < 8 || wx + ww > innerWidth - 8) wx = Math.max(8, Math.min(innerWidth - ww - 8, (innerWidth - ww) / 2 - 56 + off)); // no room beside it (phones): over it, fully on screen
    const place = () => {
      wx = Math.max(-w.offsetWidth + 80, Math.min(innerWidth - 80, wx)); // always keep part of it on screen
      wy = Math.max(0, Math.min(innerHeight - 44, wy));
      w.style.translate = `${wx}px ${wy}px`;
    };
    ((achWin && achWin.parentNode) || document.body).appendChild(w);
    photoWins.set(src, w);
    wireFind(w, btn, src, thumb);
    wireUnlock(w, btn, src);
    toFront(w);
    place();
    w.focus({ preventScroll: true });
    try { ui.play('open'); } catch (err) {}

    const close = (sound) => {
      if (w.classList.contains('closing')) return;
      photoWins.delete(src);
      if (btn.dataset.music) try { ui.musicStop(0.9); } catch (err) {}
      w.classList.remove('nudge');
      w.classList.add('closing');
      if (w.contains(document.activeElement) && btn.isConnected && !btn.closest('[hidden]')) btn.focus({ preventScroll: true });
      if (sound) try { ui.play('close'); } catch (err) {}
      setTimeout(() => { w.remove(); removeEventListener('resize', place); }, 200);
    };
    w.closeWin = close;
    $('.win-x', w).addEventListener('click', () => close(false)); // the site's click "bloop" plays for it
    addEventListener('resize', place);
    // drag by the orange bar
    const bar = $('.win-bar', w);
    let mv = null;
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.win-x')) return;
      mv = { id: e.pointerId, ox: e.clientX - wx, oy: e.clientY - wy };
      bar.setPointerCapture(e.pointerId);
      w.classList.add('moving');
      e.preventDefault();
    });
    bar.addEventListener('pointermove', (e) => { if (!mv || mv.id !== e.pointerId) return; wx = e.clientX - mv.ox; wy = e.clientY - mv.oy; place(); });
    const up = (e) => { if (!mv || mv.id !== e.pointerId) return; mv = null; w.classList.remove('moving'); };
    bar.addEventListener('pointerup', up);
    bar.addEventListener('pointercancel', up);
    // pull any edge or corner to resize it; the window keeps the photo's shape, so the photo always fills it
    let rz = null;
    const winRz = rzSound(w);
    $$('.win-rz', w).forEach((h) => {
      h.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        rz = { id: e.pointerId, d: h.dataset.d, sx: e.clientX, sy: e.clientY, x: wx, y: wy, w: w.offsetWidth, h: w.offsetHeight };
        h.setPointerCapture(e.pointerId);
        w.classList.add('sizing');
        winRz.start();
        e.preventDefault(); e.stopPropagation();
      });
      h.addEventListener('pointermove', (e) => {
        if (!rz || rz.id !== e.pointerId) return;
        // locked to the photo's shape: the edge you pull sets the size, the other side follows (corners: the bigger pull wins)
        const dx = e.clientX - rz.sx, dy = e.clientY - rz.sy, d = rz.d;
        const byW = (d.includes('w') ? -dx : d.includes('e') ? dx : 0), byH = (d.includes('n') ? -dy : d.includes('s') ? dy : 0) / ratio;
        const grow = Math.abs(byW) >= Math.abs(byH) ? byW : byH;
        const MAXW = Math.min(innerWidth, (innerHeight - BAR) / ratio), MINW = Math.min(180, MAXW);
        const nw = Math.max(MINW, Math.min(MAXW, rz.w + grow)), nh = nw * ratio + BAR;
        const x = d.includes('w') ? rz.x + rz.w - nw : rz.x, y = d.includes('n') ? rz.y + rz.h - nh : rz.y;
        w.style.width = nw + 'px'; w.style.height = nh + 'px';
        wx = x; wy = y; place();
        winRz.move(grow !== 0 && (nw === MINW || nw === MAXW));
      });
      const end = (e) => { if (!rz || rz.id !== e.pointerId) return; rz = null; w.classList.remove('sizing'); winRz.end(); };
      h.addEventListener('pointerup', end);
      h.addEventListener('pointercancel', end);
    });
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-photo]'); if (b) openPhoto(b); });
});
