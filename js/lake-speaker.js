/* rekosk.dev: the speaker icon that can be dragged out of the Sound button into the map's lake */
'use strict';

rekoSite.part((site) => {
  const { $, reduceMotion, soundBtn, setSound, renderSound, ui } = site;
  site.share({ lake: () => lake });

  /* ---------- the speaker in the lake ----------
     With the sound on, the speaker icon can be dragged out of the "Sound" button. Let go anywhere but the map's lake and
     it flies back. Let go over the lake: it splashes down in the middle, its sound waves turn into an X, the lake goes
     dark and only the fish go quiet: they stop jumping and their sounds are muted (#offMap.lake-muted); the rest of the
     site keeps its sound and the button stays "Sound on". Clicking it on the lake brings it back (with a sound);
     clicking the button is the normal "Sound off": everything mutes and it comes back silently, muted.
     Fires reko:lake-mute / reko:lake-unmute. */
  const lake = (() => {
    const map = $('#offMap'), stage = map && $('.map-stage', map);
    const lakeG = map && $('.map-art g[transform="translate(-163 -81)"]', map), lakeP = lakeG && lakeG.querySelector('path');
    const ico = $('.ico', soundBtn);
    let st = 'idle', drag = null, fly = null, badge = null, rings = [], eat = false, aim = false;
    const anim = (el, kf, o) => (reduceMotion ? Promise.resolve() : el.animate(kf, o).finished.catch(() => {}));
    const ctr = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    const size = () => Math.max(34, stage.getBoundingClientRect().width * 0.085);
    if (lakeP) { // the dark shade over the water (under the bridge and the meadow)
      const NS = 'http://www.w3.org/2000/svg', svg = lakeG.ownerSVGElement;
      const defs = svg.querySelector('defs') || svg.insertBefore(document.createElementNS(NS, 'defs'), svg.firstChild);
      defs.insertAdjacentHTML('beforeend', '<radialGradient id="lakeShadeG"><stop offset="0" stop-color="#0b0b0b" stop-opacity=".62"/><stop offset="1" stop-color="#0b0b0b" stop-opacity=".3"/></radialGradient>');
      const sh = document.createElementNS(NS, 'path');
      sh.setAttribute('d', lakeP.getAttribute('d'));
      sh.setAttribute('class', 'lake-shade');
      sh.setAttribute('fill', 'url(#lakeShadeG)');
      lakeG.appendChild(sh);
    }
    function overLake(x, y) {
      if (!lakeP) return false;
      try {
        const m = lakeP.getScreenCTM();
        return !!m && lakeP.isPointInFill(new DOMPoint(x, y).matrixTransform(m.inverse()));
      } catch (err) { return false; }
    }
    // the middle of the lake, in % of the map
    function spot() {
      const b = lakeP.getBBox();
      return [(b.x + b.width / 2 - 163) / 500 * 100, (b.y + b.height / 2 - 81) / 400 * 100];
    }
    const icon = () => ico.cloneNode(true);
    const fog = () => getComputedStyle(soundBtn).color;
    // the badge look ↔ the bare icon in the button
    const bare = (k, dx = 0, dy = 0) => ({ backgroundColor: 'rgba(244,241,234,0)', borderColor: 'rgba(11,11,11,0)', color: fog(), boxShadow: '0 0 0 rgba(0,0,0,0)', transform: `translate(${dx}px,${dy}px) scale(${k})` });
    const full = (t = 'none') => ({ backgroundColor: '#f4f1ea', borderColor: '#0b0b0b', color: '#0b0b0b', boxShadow: '0 10px 18px rgba(0,0,0,.35)', transform: t });
    function makeFly(x, y, d, muted) {
      const f = document.createElement('div');
      f.className = 'snd-fly' + (muted ? ' x' : '');
      f.style.width = f.style.height = d + 'px';
      f.style.left = x + 'px'; f.style.top = y + 'px';
      f.appendChild(icon());
      document.body.appendChild(f);
      return f;
    }
    function aimAt(on) {
      if (on === aim) return;
      aim = on;
      map.classList.toggle('lake-aim', on);
      if (fly) fly.classList.toggle('aim', on);
      if (on) ui.play('sndAim');
    }
    function start(e) {
      drag.on = true; st = 'drag';
      const d = size(), [x, y] = ctr(ico);
      fly = makeFly(e.clientX, e.clientY, d, false);
      soundBtn.classList.add('snd-out');
      document.documentElement.classList.add('snd-dragging');
      ui.play('sndGrab');
      anim(fly, [bare(17 / d, x - e.clientX, y - e.clientY), full()], { duration: 180, easing: 'cubic-bezier(.3,.7,.4,1)' });
    }
    function move(e) {
      fly.style.left = e.clientX + 'px'; fly.style.top = e.clientY + 'px';
      aimAt(overLake(e.clientX, e.clientY));
    }
    // fly the floating icon home into the button (from x, y), then show the real one again
    async function home(x, y, d) {
      const [tx, ty] = ctr(ico), dist = Math.hypot(tx - x, ty - y);
      const lift = Math.min(90, 20 + dist * 0.15), kf = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10, e2 = t * t * (3 - 2 * t);
        kf.push({ left: (x + (tx - x) * e2).toFixed(1) + 'px', top: (y + (ty - y) * e2 - lift * Math.sin(Math.PI * t)).toFixed(1) + 'px', offset: t, ...(i === 0 ? full() : i === 10 ? bare(17 / d) : {}) });
      }
      await anim(fly, kf, { duration: Math.min(800, 380 + dist * 0.35), easing: 'linear', fill: 'forwards' });
      fly.remove(); fly = null;
      soundBtn.classList.remove('snd-out');
      document.documentElement.classList.remove('snd-dragging');
      anim(ico, [{ transform: 'scale(1.45)' }, { transform: 'scale(.9)', offset: 0.6 }, { transform: 'none' }], { duration: 320, easing: 'ease-out' });
      st = 'idle';
    }
    async function land(x, y) {
      st = 'landing';
      const d = fly.getBoundingClientRect().width, [px, py] = spot();
      fly.remove(); fly = null;
      document.documentElement.classList.remove('snd-dragging');
      badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'lake-snd';
      badge.setAttribute('aria-label', 'The speaker is in the lake, click to bring the sound back');
      badge.style.setProperty('--x', px.toFixed(2) + '%'); badge.style.setProperty('--y', py.toFixed(2) + '%');
      badge.appendChild(icon());
      rings = [0, 1, 2].map((i) => {
        const r = document.createElement('span');
        r.className = 'lake-ring' + (i ? '' : ' splash');
        r.style.setProperty('--x', px.toFixed(2) + '%'); r.style.setProperty('--y', py.toFixed(2) + '%');
        if (i === 2) r.style.animationDelay = '1.4s';
        return r;
      });
      stage.append(...rings, badge);
      badge.addEventListener('click', () => back(true));
      const [cx, cy] = ctr(badge), dx = x - cx, dy = y - cy, k = d / badge.getBoundingClientRect().width;
      // a short hop to the middle, a dip into the water and a bob back up
      await anim(badge, [
        { transform: `translate(${dx}px,${dy}px) scale(${k})` },
        { transform: `translate(${dx / 2}px,${dy / 2 - 28}px) scale(${(k + 1.15) / 2})`, offset: 0.45 },
        { transform: 'translateY(2px) scale(.86)', offset: 0.78 },
        { transform: 'none' }], { duration: 520, easing: 'ease-in-out' });
      ui.play('lakeMute', 0, 0, true);
      rings[0].classList.add('go');
      map.classList.remove('lake-aim'); aim = false;
      map.classList.add('lake-muted');
      setTimeout(() => { if (badge) badge.classList.add('x'); }, reduceMotion ? 0 : 220);
      st = 'lake';
      document.dispatchEvent(new CustomEvent('reko:lake-mute'));
    }
    // unmute: clicked on the lake (flies back with a sound); else the "Sound off" button was clicked (all muted, silent)
    async function back(unmute) {
      if (st !== 'lake') return;
      st = 'returning';
      const [x, y] = ctr(badge), d = badge.getBoundingClientRect().width;
      map.classList.remove('lake-muted');
      rings.forEach((r) => r.remove()); rings = [];
      badge.remove(); badge = null;
      fly = makeFly(x, y, d, true);
      if (!unmute) setSound(false, true); // the "Sound off" button: everything mutes, no sound
      else {
        ui.play('lakeOut');
        requestAnimationFrame(() => requestAnimationFrame(() => { if (fly) fly.classList.remove('x'); }));
      }
      document.dispatchEvent(new CustomEvent('reko:lake-unmute'));
      await home(x, y, d);
    }
    if (!map || !stage || !lakeP || !ico) return { out: () => false, back() {}, click: () => false };
    soundBtn.addEventListener('pointerdown', (e) => {
      if (!site.soundOn || st !== 'idle' || e.button !== 0) return;
      e.preventDefault(); // no text selection / image drag; the click still comes
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false };
    });
    window.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.on) { if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return; start(e); }
      move(e);
    });
    const up = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      if (!d.on) return;
      eat = true; setTimeout(() => { eat = false; }, 0); // the click this release makes on the button is not a toggle
      if (e.type === 'pointerup' && overLake(e.clientX, e.clientY)) return land(e.clientX, e.clientY);
      map.classList.remove('lake-aim'); aim = false;
      st = 'returning';
      ui.play('sndBack');
      home(e.clientX, e.clientY, fly.getBoundingClientRect().width);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return {
      out: () => st !== 'idle',
      back,
      // the "Sound" button was clicked: true = handled here
      click() {
        if (eat) return true;
        if (st === 'lake') { back(false); return true; }
        return st !== 'idle'; // mid-flight: ignore
      }
    };
  })();
  soundBtn.addEventListener('click', () => { if (!lake.click()) setSound(!site.soundOn); });
  renderSound();
});
