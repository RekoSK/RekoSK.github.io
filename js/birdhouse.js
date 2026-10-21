/* rekosk.dev: the birdhouse loot (shovel, compass, magnet), the Social media coin, the map's compass needle and nail,
   and the geocache under the hills */
'use strict';

rekoSite.part((site) => {
  const { $, $$, reduceMotion, ui } = site;
  site.share({ bhShowIn: () => bhShowIn, coin: () => coin });

  /* birdhouse loot: once the birdhouse is open, a shovel, a compass (its needle is missing, it's found later) and a U magnet
     lie inside it, as stickers like the About ones (but no scale / rotate buttons). Drag one out of the window and drop it
     anywhere in the "When I'm offline" section and it stays there (until reload); one left in the window closes with the
     window and is back in it when the photo is opened again. Dropped on the birdhouse photo it goes back in; dragged out
     of the section (and off the window) it poofs and pops back where it was. Each one has its own little set-down sound. */
  const offSec = $('#offline');
  const BH_ITEMS = [
    { id: 'shovel', name: 'Shovel', fx: 0.4, fy: 0.53, rot: -10, svg: '<svg viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(-35 50 50)" stroke-linejoin="round" stroke-linecap="round"><g fill="#f4f1ea" stroke="#f4f1ea" stroke-width="9"><path d="M40 6h20v13H40z"/><path d="M46.5 18h7v44h-7z"/><path d="M36 60h28v14c0 13-7 20-14 23-7-3-14-10-14-23z"/></g><g stroke="#0b0b0b" stroke-width="2.6"><path d="M40 6h20v13H40z" fill="#8a5a2b"/><path d="M45 10h10v5H45z" fill="#3a2614"/><path d="M46.5 18h7v44h-7z" fill="#b0773d"/><path d="M36 60h28v14c0 13-7 20-14 23-7-3-14-10-14-23z" fill="#c9c4bb"/><path d="M43 58v-4h14v4" fill="#8f8a82"/></g><path d="M42 66v9c0 7 3 12 6 14" fill="none" stroke="#fff" stroke-width="2.4" opacity=".7"/></g></svg>' },
    { id: 'compass', name: 'Compass', fx: 0.46, fy: 0.63, rot: 8, svg: '<svg viewBox="0 0 100 100" aria-hidden="true"><g stroke-linejoin="round"><g fill="#f4f1ea" stroke="#f4f1ea" stroke-width="9"><circle cx="50" cy="55" r="38"/><circle cx="50" cy="13" r="8"/></g><circle cx="50" cy="13" r="6" fill="none" stroke="#0b0b0b" stroke-width="3"/><circle cx="50" cy="55" r="38" fill="#fe7700" stroke="#0b0b0b" stroke-width="2.6"/><circle cx="50" cy="55" r="29" fill="#f4f1ea" stroke="#0b0b0b" stroke-width="2.6"/><path d="M50 29v6M50 75v6M24 55h6M70 55h6M31.6 36.6l3 3M65.4 70.4l3 3M68.4 36.6l-3 3M34.6 70.4l-3 3" stroke="#0b0b0b" stroke-width="2.2" stroke-linecap="round"/><text x="50" y="46" text-anchor="middle" font-family="Poppins,sans-serif" font-weight="800" font-size="10" fill="#0b0b0b">N</text><circle cx="50" cy="55" r="3.2" fill="#0b0b0b"/></g></svg>' },
    { id: 'magnet', name: 'Magnet', fx: 0.5, fy: 0.49, rot: 14, svg: '<svg viewBox="0 0 100 100" aria-hidden="true"><g stroke-linejoin="round" transform="rotate(12 50 50)"><path d="M22 12V54a28 28 0 0 0 56 0V12H58V54a8 8 0 0 1-16 0V12Z" fill="#f4f1ea" stroke="#f4f1ea" stroke-width="9"/><path d="M22 12V54a28 28 0 0 0 56 0V12H58V54a8 8 0 0 1-16 0V12Z" fill="#e5262f" stroke="#0b0b0b" stroke-width="2.6"/><path d="M22 12h20v14H22zM58 12h20v14H58z" fill="#d9d4cc" stroke="#0b0b0b" stroke-width="2.6"/><path d="M28 32v22a22 22 0 0 0 10 18" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/></g></svg>' },
  ];
  let bhItems = null, bhView = null; // the loot (made on first unlock) and the birdhouse window's photo area it lives in
  const bhWinOpen = () => bhView && bhView.isConnected && !bhView.closest('.closing');
  const inRect = (r, x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  // where: 'win' (fx, fy = fractions of the photo, so it scales with the window), 'sec' (fx of the section's width,
  // y in px from its top, so it scrolls with the page), 'drag' (fixed, at the pointer); the coin also has 'soc' (like
  // 'sec', in Social media) and 'reel' (its starting spot on the reels' "Find more here ;)" page)
  function bhPlace(it, where, a, b) {
    const el = it.el;
    it.where = where;
    el.classList.toggle('bh-fixed', where === 'drag');
    el.classList.toggle('bh-lbf', where === 'lbf'); // the coin, over the open logbook
    el.classList.toggle('bh-sec', where === 'sec' || where === 'soc');
    el.classList.toggle('bh-reel', where === 'reel');
    if (where === 'reel') { // the coin's own spot on the reels' last page
      coinPage.appendChild(el);
      el.style.removeProperty('--x'); el.style.removeProperty('--y');
    } else if (where === 'soc') { // like 'sec', but in the Social media section
      it.sx = a; it.sy = b;
      socSec.appendChild(el);
      el.style.setProperty('--x', (a * 100).toFixed(2) + '%'); el.style.setProperty('--y', b.toFixed(1) + 'px');
    } else if (where === 'win') {
      it.fx = a; it.fy = b;
      if (bhWinOpen()) bhView.appendChild(el); else el.remove(); // back when the window opens again
      el.style.setProperty('--x', (a * 100).toFixed(2) + '%'); el.style.setProperty('--y', (b * 100).toFixed(2) + '%');
    } else if (where === 'sec') {
      it.sx = a; it.sy = b;
      offSec.appendChild(el);
      el.style.setProperty('--x', (a * 100).toFixed(2) + '%'); el.style.setProperty('--y', b.toFixed(1) + 'px');
    } else {
      if (el.parentNode !== document.body) document.body.appendChild(el);
      el.style.setProperty('--x', a.toFixed(1) + 'px'); el.style.setProperty('--y', b.toFixed(1) + 'px');
    }
  }
  function bhMakeItems() {
    bhItems = BH_ITEMS.map((d) => {
      const el = document.createElement('div');
      el.className = 'stk bh-stk bh-' + d.id;
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', d.name + ' sticker');
      el.style.setProperty('--rot', d.rot + 'deg');
      el.innerHTML = d.svg;
      const it = { id: d.id, el, where: 'win', fx: d.fx, fy: d.fy, sx: 0, sy: 0 };
      let bd = null;
      const away = (e) => !inRect(offSec.getBoundingClientRect(), e.clientX, e.clientY) && !(bhWinOpen() && inRect(bhView.getBoundingClientRect(), e.clientX, e.clientY));
      el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || bd || el.classList.contains('poof') || el.classList.contains('gc-busy')) return;
        const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        bd = { id: e.pointerId, ox: e.clientX - cx, oy: e.clientY - cy, lx: e.clientX, ly: e.clientY, lt: performance.now(),
          from: it.where === 'win' ? ['win', it.fx, it.fy] : ['sec', it.sx, it.sy] };
        bhPlace(it, 'drag', cx, cy); // out of the window's clipping while it's carried
        el.setPointerCapture(e.pointerId);
        el.classList.remove('pop-in');
        el.classList.add('drag');
        try { ui.play('grab'); ui.motionStart(); } catch (err) {}
        e.preventDefault(); e.stopPropagation();
      });
      el.addEventListener('pointermove', (e) => {
        if (!bd || bd.id !== e.pointerId) return;
        bhPlace(it, 'drag', e.clientX - bd.ox, e.clientY - bd.oy);
        if (it.id === 'magnet') nailCheck(el);
        const now = performance.now();
        try { ui.motionMove(Math.hypot(e.clientX - bd.lx, e.clientY - bd.ly) / Math.max(8, now - bd.lt), Math.min(1, Math.max(0, e.clientX / innerWidth))); } catch (err) {}
        bd.lx = e.clientX; bd.ly = e.clientY; bd.lt = now;
        if (away(e)) { // dragged out of the section: poof, and back where it was
          const back = bd.from;
          try { el.releasePointerCapture(bd.id); } catch (err) {}
          bd = null;
          try { ui.motionStop(); ui.play('poof'); } catch (err) {}
          el.classList.remove('drag');
          el.classList.add('poof');
          setTimeout(() => {
            el.classList.remove('poof');
            bhPlace(it, back[0], back[1], back[2]);
            if (el.isConnected) { el.classList.add('pop-in'); try { ui.play('popIn'); } catch (err) {} setTimeout(() => el.classList.remove('pop-in'), 650); }
          }, 760);
        }
      });
      const drop = (e) => {
        if (!bd || bd.id !== e.pointerId) return;
        bd = null;
        el.classList.remove('drag');
        try { ui.motionStop(); } catch (err) {}
        const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        if (bhWinOpen() && inRect(bhView.getBoundingClientRect(), e.clientX, e.clientY)) {
          const v = bhView.getBoundingClientRect();
          bhPlace(it, 'win', Math.min(0.95, Math.max(0.05, (cx - v.left) / v.width)), Math.min(0.95, Math.max(0.05, (cy - v.top) / v.height)));
        } else {
          const s = offSec.getBoundingClientRect();
          bhPlace(it, 'sec', Math.min(0.98, Math.max(0.02, (cx - s.left) / s.width)), Math.min(s.height - 20, Math.max(20, cy - s.top)));
        }
        try { ui.play('drop'); ui.play('bhItem', it.id); } catch (err) {}
        if (it.id === 'magnet') nailCheck(el);
        if (it.id === 'shovel') digCheck(it, e);
      };
      el.addEventListener('pointerup', drop);
      el.addEventListener('pointercancel', drop);
      return it;
    });
  }
  // the birdhouse window shows its photo area: everything still "in the window" goes into it (popping in after the unlock)
  function bhShowIn(view, pop) {
    bhView = view;
    if (!bhItems) bhMakeItems();
    if (coin && coin.where === 'win') bhPlace(coin, 'win', coin.fx, coin.fy);
    bhItems.filter((it) => it.where === 'win').forEach((it, i) => {
      bhPlace(it, 'win', it.fx, it.fy);
      if (!pop) return;
      it.el.style.visibility = 'hidden';
      setTimeout(() => {
        it.el.style.visibility = '';
        it.el.classList.add('pop-in');
        try { ui.play('popIn'); } catch (err) {}
        setTimeout(() => it.el.classList.remove('pop-in'), 650);
      }, 250 + i * 260);
    });
  }
  /* the Social media coin: a coin sticker on the reels' last page ("Find more here ;)"), halfway between the Instagram
     button and the page's bottom edge. Drag it anywhere in the Social media section and it stays there (until reload);
     dragged out of the section it poofs and pops back where it was. Dropped on the open birdhouse photo it goes in with
     the loot, and from then on it can travel: out of the window into "When I'm offline", back into Social media, or into
     the birdhouse again (out of all of them: poof). Dropped back on the "Find more here ;)" page it returns to its spot.
     "reko:coin-bh" fires on document the first time it goes into the birdhouse (for a future achievement).
     The open logbook dims everything else, but not the coin (on purpose, Andrej): if it's on screen when the logbook
     opens it rises above the dim ('lbf': fixed, over the logbook) and can be dragged anywhere on the screen there.
     When the logbook closes it settles wherever it was left, like a normal drop (nowhere it may be: poof, back to
     where it was before the logbook opened). */
  const socSec = $('#social'), coinPage = $('#reels .reel-more');
  const COIN_SVG = '<svg viewBox="0 0 100 100" aria-hidden="true"><g stroke-linejoin="round"><circle cx="50" cy="50" r="40" fill="#f4f1ea" stroke="#f4f1ea" stroke-width="9"/><circle cx="50" cy="50" r="40" fill="#e9a91c" stroke="#0b0b0b" stroke-width="2.6"/><circle cx="50" cy="50" r="30" fill="#f7c843" stroke="#0b0b0b" stroke-width="2.2"/><path d="M50 31l5.6 11.4 12.6 1.8-9.1 8.9 2.1 12.5L50 59.7l-11.2 5.9 2.1-12.5-9.1-8.9 12.6-1.8z" fill="#e9a91c" stroke="#0b0b0b" stroke-width="2.2"/><path d="M26 40a26 26 0 0 1 14-15" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".7"/></g></svg>';
  let coin = null;
  if (socSec && coinPage) {
    const el = document.createElement('div');
    el.className = 'stk bh-stk bh-coin';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'Coin sticker');
    el.style.setProperty('--rot', '-8deg');
    el.innerHTML = COIN_SVG;
    const it = coin = { id: 'coin', el, where: 'reel', fx: 0.6, fy: 0.55, sx: 0, sy: 0, free: false, pre: null };
    bhPlace(it, 'reel');
    let bd = null;
    const lbOpen = () => !!$('body > .lb');
    const inSoc = (x, y) => inRect(socSec.getBoundingClientRect(), x, y);
    const inOff = (x, y) => it.free && inRect(offSec.getBoundingClientRect(), x, y);
    const inWin = (x, y) => bhWinOpen() && inRect(bhView.getBoundingClientRect(), x, y);
    // its own page counts only while that page is the one showing in the reel window
    const pageShown = () => { const v = coinPage.parentElement.parentElement.getBoundingClientRect(), p = coinPage.getBoundingClientRect(); return Math.abs(p.top - v.top) < 2; };
    const inPage = (x, y) => pageShown() && inRect(coinPage.getBoundingClientRect(), x, y);
    const from = () => it.where === 'win' ? ['win', it.fx, it.fy] : it.where === 'reel' ? ['reel'] : it.where === 'lbf' ? it.pre : [it.where, it.sx, it.sy];
    const popBack = (back) => {
      el.classList.add('poof');
      try { ui.play('poof'); } catch (err) {}
      setTimeout(() => {
        el.classList.remove('poof');
        bhPlace(it, back[0], back[1], back[2]);
        if (el.isConnected) { el.classList.add('pop-in'); try { ui.play('popIn'); } catch (err) {} setTimeout(() => el.classList.remove('pop-in'), 650); }
      }, 760);
    };
    // set it down with its middle at x, y (screen): the birdhouse, its own page, Social media or (once free) offline
    function settle(x, y, back) {
      const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (inWin(x, y)) {
        const v = bhView.getBoundingClientRect();
        bhPlace(it, 'win', Math.min(0.95, Math.max(0.05, (cx - v.left) / v.width)), Math.min(0.95, Math.max(0.05, (cy - v.top) / v.height)));
        if (!it.free) { it.free = true; document.dispatchEvent(new CustomEvent('reko:coin-bh')); }
      } else if (inPage(x, y)) bhPlace(it, 'reel');
      else if (inSoc(x, y) || inOff(x, y)) {
        const sec = inSoc(x, y) ? socSec : offSec, s = sec.getBoundingClientRect();
        bhPlace(it, sec === socSec ? 'soc' : 'sec', Math.min(0.98, Math.max(0.02, (cx - s.left) / s.width)), Math.min(s.height - 20, Math.max(20, cy - s.top)));
      } else { popBack(back); return false; }
      return true;
    }
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || bd || el.classList.contains('poof')) return;
      const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      bd = { id: e.pointerId, ox: e.clientX - cx, oy: e.clientY - cy, lx: e.clientX, ly: e.clientY, lt: performance.now(), from: from() };
      bhPlace(it, 'drag', cx, cy); // out of the reel window's / photo's clipping while it's carried
      el.setPointerCapture(e.pointerId);
      el.classList.remove('pop-in');
      el.classList.add('drag');
      try { ui.play('grab'); ui.motionStart(); } catch (err) {}
      e.preventDefault(); e.stopPropagation();
    });
    el.addEventListener('pointermove', (e) => {
      if (!bd || bd.id !== e.pointerId) return;
      bhPlace(it, 'drag', e.clientX - bd.ox, e.clientY - bd.oy);
      const now = performance.now();
      try { ui.motionMove(Math.hypot(e.clientX - bd.lx, e.clientY - bd.ly) / Math.max(8, now - bd.lt), Math.min(1, Math.max(0, e.clientX / innerWidth))); } catch (err) {}
      // over the open logbook its lower edge scrapes the secret codes' foil (scScrape), wherever it's dragged
      if (lbOpen()) site.scScrape(e.clientX - bd.ox - 8, e.clientY - bd.oy + 26, Math.hypot(e.clientX - bd.lx, e.clientY - bd.ly) / Math.max(8, now - bd.lt));
      bd.lx = e.clientX; bd.ly = e.clientY; bd.lt = now;
      // out of everywhere it may be: poof, and back where it was (over the open logbook the whole screen is fine)
      if (!lbOpen() && !inSoc(e.clientX, e.clientY) && !inOff(e.clientX, e.clientY) && !inWin(e.clientX, e.clientY)) {
        const back = bd.from;
        try { el.releasePointerCapture(bd.id); } catch (err) {}
        bd = null;
        try { ui.motionStop(); } catch (err) {}
        el.classList.remove('drag');
        popBack(back);
      }
    });
    const drop = (e) => {
      if (!bd || bd.id !== e.pointerId) return;
      const back = bd.from;
      bd = null;
      el.classList.remove('drag');
      site.scLift();
      try { ui.motionStop(); } catch (err) {}
      if (lbOpen()) { // over the logbook: it stays right where it's let go, above the dim
        const r = el.getBoundingClientRect();
        if (it.where !== 'lbf') it.pre = back;
        bhPlace(it, 'lbf', r.left + r.width / 2, r.top + r.height / 2);
      } else if (!settle(e.clientX, e.clientY, back)) return;
      try { ui.play('drop'); ui.play('bhItem', 'coin'); } catch (err) {}
    };
    el.addEventListener('pointerup', drop);
    el.addEventListener('pointercancel', drop);
    // the logbook opening / closing (it's added to / removed from <body>)
    new MutationObserver(() => {
      if (bd || el.classList.contains('poof')) return;
      if (lbOpen() && it.where !== 'lbf') {
        if (!el.isConnected || (it.where === 'reel' && !pageShown())) return;
        const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return; // off screen: it stays put, under the dim
        it.pre = from();
        bhPlace(it, 'lbf', cx, cy);
      } else if (!lbOpen() && it.where === 'lbf') {
        const r = el.getBoundingClientRect();
        settle(r.left + r.width / 2, r.top + r.height / 2, it.pre);
      }
    }).observe(document.body, { childList: true });
  }
  /* the compass needle on the map: a nail holds it. Bring the birdhouse magnet close (carried or set down) and the nail
     wiggles, shoots out and sticks to the magnet; the needle swings loose and can be dragged anywhere in the section
     (out of it: poof, back where it was). Dropped on the birdhouse compass sticker it clicks in, spins and settles
     north: the compass is fixed ("reko:compass" fires on document, for a future achievement). Resets on reload. */
  const mapNeedle = $('#offMap .map-needle'), mapNail = $('#offMap .map-nail');
  const NAIL_SIDE = '<svg viewBox="0 0 60 16"><path d="M8 5.5H49L58 8L49 10.5H8Z" fill="#b8bec4" stroke="#0b0b0b" stroke-width="2" stroke-linejoin="round"/><rect x="2" y="1" width="6" height="14" rx="1.5" fill="#a7adb3" stroke="#0b0b0b" stroke-width="2"/><path d="M11 7H46" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".6"/></svg>';
  let nailIn = !!(mapNeedle && mapNail), ndl = null; // ndl: where the loose needle is ({ where, a, b })
  const ctr = (r) => [r.left + r.width / 2, r.top + r.height / 2];
  // the spot on the magnet the nail sticks to (its left pole's tip)
  const nailSpot = (mag) => $('.bh-nail-spot', mag) || mag.appendChild(Object.assign(document.createElement('span'), { className: 'bh-nail-spot' }));
  function nailCheck(mag) {
    if (!nailIn || !mag.isConnected) return;
    const n = mapNail.getBoundingClientRect(), m = mag.getBoundingClientRect();
    if (!n.width) return;
    const [nx, ny] = ctr(n), [mx, my] = ctr(m);
    // only within the square around the compass (about 65 of the map's 500 units each way: the map's top-left corner)
    const reach = $('#offMap .map-stage').getBoundingClientRect().width * 0.13;
    if (Math.abs(nx - mx) < reach && Math.abs(ny - my) < reach) nailPull(mag);
  }
  function nailPull(mag) {
    nailIn = false;
    try { ui.play('nailPull'); } catch (err) {}
    const spot = nailSpot(mag);
    const land = () => {
      const n = document.createElement('span');
      n.className = 'bh-nail';
      n.innerHTML = NAIL_SIDE;
      mag.appendChild(n);
      if (!reduceMotion) mag.animate([{ translate: '-50% -50%' }, { translate: 'calc(-50% - 3px) calc(-50% + 2px)' }, { translate: 'calc(-50% + 2px) calc(-50% - 1px)' }, { translate: '-50% -50%' }], { duration: 220, easing: 'ease-out' }); // stickers sit at translate -50% -50%
      document.dispatchEvent(new CustomEvent('reko:nail'));
    };
    const free = () => { // the needle swings loose and can be picked up
      mapNeedle.classList.add('loose');
      mapNeedle.style.setProperty('--nr', '24deg');
      ndl = { where: 'map', a: 0.092, b: 0.14 };
    };
    if (reduceMotion) { mapNail.remove(); free(); land(); return; }
    const t0 = performance.now(), WIG = 500, FLY = 450;
    const step = (now) => {
      const t = now - t0, [sx, sy] = ctr(spot.getBoundingClientRect());
      if (t < WIG) { // tugged: wiggles harder and creeps toward the magnet
        const k = t / WIG, [nx, ny] = ctr(mapNail.getBoundingClientRect()), d = Math.hypot(sx - nx, sy - ny) || 1;
        const pull = 4 * k * k;
        mapNail.style.transform = `translate(${((sx - nx) / d * pull + Math.sin(t / 18) * 2.5 * k).toFixed(2)}px,${((sy - ny) / d * pull + Math.cos(t / 15) * 1.5 * k).toFixed(2)}px) rotate(${(Math.sin(t / 22) * 25 * k).toFixed(1)}deg)`;
        requestAnimationFrame(step);
        return;
      }
      if (!mapNail.classList.contains('fly')) { // out it comes: side view, fixed on the page, heading for the magnet
        const r = mapNail.getBoundingClientRect(), [cx, cy] = ctr(r);
        mapNail.classList.add('fly');
        mapNail.innerHTML = NAIL_SIDE;
        mapNail.style.transform = '';
        mapNail.dataset.x = cx; mapNail.dataset.y = cy; mapNail.dataset.w = r.width;
        document.body.appendChild(mapNail);
        free();
      }
      const k = Math.min(1, (t - WIG) / FLY), e = Math.pow(k, 2.2), x0 = +mapNail.dataset.x, y0 = +mapNail.dataset.y;
      const sw = spot.getBoundingClientRect().width || 20, w = +mapNail.dataset.w * 1.6 * (1 - e) + sw * e;
      mapNail.style.left = (x0 + (sx - x0) * e).toFixed(1) + 'px';
      mapNail.style.top = (y0 + (sy - y0) * e - Math.sin(k * Math.PI) * 30).toFixed(1) + 'px';
      mapNail.style.width = w.toFixed(1) + 'px';
      mapNail.style.rotate = (Math.atan2(sy - y0, sx - x0) * 180 / Math.PI * (1 - e) + 26 * e + k * 360).toFixed(1) + 'deg';
      if (k < 1) { requestAnimationFrame(step); return; }
      mapNail.remove();
      land();
    };
    requestAnimationFrame(step);
  }
  function ndlPlace(where, a, b) {
    const el = mapNeedle;
    el.classList.toggle('nd-drag', where === 'drag');
    el.classList.toggle('nd-sec', where === 'sec');
    if (where === 'map') { $('#offMap .map-stage').appendChild(el); el.style.setProperty('--x', (a * 100).toFixed(2) + '%'); el.style.setProperty('--y', (b * 100).toFixed(2) + '%'); }
    else if (where === 'sec') { offSec.appendChild(el); el.style.setProperty('--x', (a * 100).toFixed(2) + '%'); el.style.setProperty('--y', b.toFixed(1) + 'px'); }
    else { if (el.parentNode !== document.body) document.body.appendChild(el); el.style.setProperty('--x', a.toFixed(1) + 'px'); el.style.setProperty('--y', b.toFixed(1) + 'px'); }
    if (where !== 'drag') ndl = { where, a, b };
  }
  const compassEl = () => { const c = bhItems && bhItems.find((it) => it.id === 'compass'); return c && c.el.isConnected && !c.el.classList.contains('poof') && !c.el.closest('.closing') ? c.el : null; };
  function fixCompass(c) {
    mapNeedle.remove();
    ndl = { where: 'fixed' };
    const svg = $('svg', c), g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'cmp-ndl');
    g.innerHTML = '<g transform="translate(43.5 31) scale(.8)">' + NEEDLE_SVG + '</g><circle cx="50" cy="55" r="3.4" fill="#a7adb3" stroke="#0b0b0b" stroke-width="1.6"/>';
    svg.appendChild(g);
    c.classList.add('bh-fixed-needle');
    c.setAttribute('aria-label', 'Compass sticker, with its needle');
    try { ui.play('needleFix'); } catch (err) {}
    if (!reduceMotion) {
      g.animate([{ transform: 'rotate(250deg)' }, { transform: 'rotate(-55deg)', offset: 0.45 }, { transform: 'rotate(28deg)', offset: 0.65 }, { transform: 'rotate(-12deg)', offset: 0.8 }, { transform: 'rotate(4deg)', offset: 0.92 }, { transform: 'rotate(0deg)' }], { duration: 1300, easing: 'ease-out' });
      c.animate([{ scale: '1' }, { scale: '1.18' }, { scale: '1' }], { duration: 380, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    }
    document.dispatchEvent(new CustomEvent('reko:compass'));
  }
  const NEEDLE_SVG = mapNeedle ? $('svg', mapNeedle).innerHTML : '';
  if (mapNeedle) {
    let bd = null;
    const el = mapNeedle;
    const away = (e) => !inRect(offSec.getBoundingClientRect(), e.clientX, e.clientY) && !(bhWinOpen() && inRect(bhView.getBoundingClientRect(), e.clientX, e.clientY));
    el.addEventListener('pointerdown', (e) => {
      if (!el.classList.contains('loose') || el.classList.contains('nd-poof') || e.button !== 0 || bd) return;
      const [cx, cy] = ctr(el.getBoundingClientRect());
      bd = { id: e.pointerId, ox: e.clientX - cx, oy: e.clientY - cy, lx: e.clientX, ly: e.clientY, lt: performance.now(), from: ndl };
      ndlPlace('drag', cx, cy);
      el.setPointerCapture(e.pointerId);
      el.classList.add('drag');
      try { ui.play('grab'); ui.motionStart(); } catch (err) {}
      e.preventDefault(); e.stopPropagation();
    });
    el.addEventListener('pointermove', (e) => {
      if (!bd || bd.id !== e.pointerId) return;
      ndlPlace('drag', e.clientX - bd.ox, e.clientY - bd.oy);
      const now = performance.now();
      try { ui.motionMove(Math.hypot(e.clientX - bd.lx, e.clientY - bd.ly) / Math.max(8, now - bd.lt), Math.min(1, Math.max(0, e.clientX / innerWidth))); } catch (err) {}
      el.style.setProperty('--nr', Math.max(-40, Math.min(40, 24 + (e.clientX - bd.lx) * 3)).toFixed(1) + 'deg');
      bd.lx = e.clientX; bd.ly = e.clientY; bd.lt = now;
      if (away(e)) { // out of the section: poof, and back where it was
        const back = bd.from;
        try { el.releasePointerCapture(bd.id); } catch (err) {}
        bd = null;
        el.classList.remove('drag');
        try { ui.motionStop(); ui.play('poof'); } catch (err) {}
        el.classList.add('nd-poof');
        const done = () => {
          el.classList.remove('nd-poof');
          ndlPlace(back.where, back.a, back.b);
          el.style.setProperty('--nr', '24deg');
          try { ui.play('popIn'); } catch (err) {}
          if (!reduceMotion) el.animate([{ scale: '0', opacity: 0 }, { scale: '1.15', opacity: 1, offset: 0.6 }, { scale: '1' }], { duration: 500, easing: 'ease-out' });
        };
        if (reduceMotion) done();
        else el.animate([{ scale: '1', opacity: 1 }, { scale: '1.3', opacity: 1, offset: 0.3 }, { scale: '0', opacity: 0, rotate: '200deg' }], { duration: 560, easing: 'ease-in' }).onfinish = () => setTimeout(done, 200);
      }
    });
    const drop = (e) => {
      if (!bd || bd.id !== e.pointerId) return;
      bd = null;
      el.classList.remove('drag');
      try { ui.motionStop(); } catch (err) {}
      const [cx, cy] = ctr(el.getBoundingClientRect()), c = compassEl();
      if (c) {
        const [kx, ky] = ctr(c.getBoundingClientRect());
        if (Math.hypot(e.clientX - kx, e.clientY - ky) < c.getBoundingClientRect().width * 0.7) { fixCompass(c); return; }
      }
      const st = $('#offMap .map-stage').getBoundingClientRect();
      if (inRect(st, cx, cy) && !(bhWinOpen() && inRect(bhView.getBoundingClientRect(), e.clientX, e.clientY))) {
        ndlPlace('map', (cx - st.left) / st.width, (cy - st.top) / st.height);
      } else {
        const s = offSec.getBoundingClientRect();
        ndlPlace('sec', Math.min(0.98, Math.max(0.02, (cx - s.left) / s.width)), Math.min(s.height - 30, Math.max(30, cy - s.top)));
      }
      el.style.setProperty('--nr', (Math.random() * 70 - 35).toFixed(1) + 'deg');
      try { ui.play('drop'); ui.play('bhItem', 'compass'); } catch (err) {}
    };
    el.addEventListener('pointerup', drop);
    el.addEventListener('pointercancel', drop);
  }
  /* the geocache under the three little hills at the bottom of the map: set the birdhouse shovel down on them and it
     digs (three stabs, dirt flying, the hills turn into a hole) and a geocache rises out with a little fanfare. The cache
     and its logbook are stickers that stay put (no dragging). Click the cache: each click rattles it with a motif that
     climbs (with a cooldown like the birdhouse, extra clicks are ignored), and click CACHE_AT opens the lid and the
     logbook flies out and lands next to it. Fires "reko:cache-found" / "reko:cache-open" on document. Resets on reload. */
  const CACHE_AT = 5;
  const cacheShakeLen = (k) => 0.45 + 0.1 * k; // seconds: the longest part of ui's cacheShake recipe (its low note)
  const GC_HILLS = [0.47, 0.86, 0.67, 1.03]; // the hills (map units 245-320 × 355-398 of 500 × 400, with some slack), as fractions of the map
  const GC_SPOT = { hole: [0.565, 0.955], cache: [0.565, 0.905], log: [0.705, 0.925] };
  const GC_CACHE = '<svg viewBox="0 0 100 80" aria-hidden="true"><g stroke-linejoin="round"><g fill="#f4f1ea" stroke="#f4f1ea" stroke-width="9"><path d="M14 40H70V68H14Z"/><path d="M70 40L90 27V55L70 68Z"/><path d="M10 34H66L90 20H34Z"/><path d="M10 34H66V42H10Z"/></g>'
    + '<path d="M14 40H70V68H14Z" fill="#f4f1ea" stroke="#0b0b0b" stroke-width="2.6"/><path d="M70 40L90 27V55L70 68Z" fill="#d9d4cc" stroke="#0b0b0b" stroke-width="2.6"/>'
    + '<path d="M14 40H70L88 28H32Z" fill="#3a2614" stroke="#0b0b0b" stroke-width="2"/><path d="M24 38H62L74 30H36Z" fill="#efe3c6" stroke="#0b0b0b" stroke-width="1.4"/>'
    + '<g class="gc-lid"><path d="M10 34H66L90 20H34Z" fill="#fe7700" stroke="#0b0b0b" stroke-width="2.6"/><path d="M22 31.5H60L76 22.5H38Z" fill="#ff9a3d" stroke="#0b0b0b" stroke-width="1.6"/>'
    + '<path d="M10 34H66V42H10Z" fill="#d95f00" stroke="#0b0b0b" stroke-width="2.6"/><path d="M66 34L90 20V28L66 42Z" fill="#b84f00" stroke="#0b0b0b" stroke-width="2.6"/></g></g></svg>';
  const GC_LOG = '<svg viewBox="0 0 60 70" aria-hidden="true"><g stroke-linejoin="round"><path d="M8 5H52V65H8Z" fill="#f4f1ea" stroke="#f4f1ea" stroke-width="9"/><path d="M8 5H52V65H8Z" fill="#efe3c6" stroke="#0b0b0b" stroke-width="2.6"/>'
    + '<path d="M8 5H17V65H8Z" fill="#fe7700" stroke="#0b0b0b" stroke-width="2.6"/><path d="M23 14h22v9H23z" fill="#fff" stroke="#0b0b0b" stroke-width="1.6"/>'
    + '<text x="34" y="21" text-anchor="middle" font-family="Poppins,sans-serif" font-weight="800" font-size="6.5" fill="#0b0b0b">LOG</text>'
    + '<path d="M23 32h22M23 39h22M23 46h22M23 53h16" stroke="#b9a983" stroke-width="1.6" stroke-linecap="round"/><path d="M27 38.5c3-3 5 2 8-1" fill="none" stroke="#2a4c9c" stroke-width="1.4" stroke-linecap="round"/></g></svg>';
  const GC_HOLE = '<svg viewBox="0 0 100 50" aria-hidden="true"><ellipse cx="50" cy="28" rx="46" ry="18" fill="#9c7b52" stroke="#0b0b0b" stroke-width="2.4"/><ellipse cx="50" cy="25" rx="30" ry="10" fill="#3a2614"/>'
    + '<g fill="#6e4f2e"><circle cx="16" cy="30" r="2.4"/><circle cx="82" cy="34" r="2"/><circle cx="70" cy="40" r="1.6"/><circle cx="28" cy="40" r="1.8"/></g></svg>';
  let gcDug = false;
  const gcStage = () => $('#offMap .map-stage');
  const gcAt = (el, xy) => { el.style.setProperty('--x', (xy[0] * 100).toFixed(2) + '%'); el.style.setProperty('--y', (xy[1] * 100).toFixed(2) + '%'); return el; };
  const gcEl = (cls, html) => Object.assign(document.createElement('div'), { className: cls, innerHTML: html });
  function digCheck(it, e) {
    const st = gcStage();
    if (gcDug || !st || it.where !== 'sec') return;
    const r = st.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    if (fx < GC_HILLS[0] || fx > GC_HILLS[2] || fy < GC_HILLS[1] || fy > GC_HILLS[3]) return;
    gcDug = true;
    dig(it, st);
  }
  const GC_PILE = '<svg viewBox="0 0 100 50" aria-hidden="true"><path d="M4 44C14 22 30 8 50 8S86 22 96 44Z" fill="#8a6640" stroke="#0b0b0b" stroke-width="2.6" stroke-linejoin="round"/>'
    + '<path d="M30 22c6-5 14-7 20-6" fill="none" stroke="#b08a5c" stroke-width="3" stroke-linecap="round"/><g fill="#5e4326"><circle cx="40" cy="32" r="2.6"/><circle cx="62" cy="26" r="2.2"/><circle cx="72" cy="36" r="2.4"/><circle cx="26" cy="38" r="2"/></g></svg>';
  GC_SPOT.pile = [GC_SPOT.hole[0] - 0.1, GC_SPOT.hole[1] - 0.005];
  // clods of earth thrown from the hole onto the pile, in a real (parabolic) arc
  function dirt(st, n, from, to, spread) {
    if (reduceMotion) return;
    const r = st.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      const d = gcAt(gcEl('gc-dirt', ''), from);
      d.style.scale = (0.6 + Math.random() * 0.7).toFixed(2);
      st.appendChild(d);
      const ex = (to[0] - from[0]) * r.width + (Math.random() - 0.5) * spread, ey = (to[1] - from[1]) * r.height + (Math.random() - 0.5) * spread * 0.4;
      const h = 30 + Math.random() * 25, kf = [];
      for (let k = 0; k <= 10; k++) { const t = k / 10; kf.push({ transform: `translate(${(ex * t).toFixed(1)}px,${(ey * t - 4 * h * t * (1 - t)).toFixed(1)}px)`, opacity: k === 10 ? 0 : 1 }); }
      d.animate(kf, { duration: 480 + Math.random() * 160, delay: i * 18, easing: 'linear', fill: 'backwards' }).onfinish = () => d.remove();
    }
  }
  // the shovel's blade tip, from the sticker's centre in its own (unrotated) frame, for a 72px sticker
  const TIP = [19.4, 27.7], AX = [0.57, 0.82]; // AX: the handle-to-blade direction
  const aboutTip = (dx, dy, deg) => `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) translate(${TIP[0]}px,${TIP[1]}px) rotate(${deg}deg) translate(${-TIP[0]}px,${-TIP[1]}px)`;
  // the sticker centre that puts the blade tip at map point xy (the sticker is turned -10deg)
  function tipAt(it, st, xy, down, right = 0) {
    const r = st.getBoundingClientRect(), s = offSec.getBoundingClientRect();
    const x = r.left + r.width * xy[0] - 23.9 + right, y = r.top + r.height * xy[1] - 23.9 + down;
    bhPlace(it, 'sec', (x - s.left) / s.width, y - s.top);
  }
  function dig(it, st) {
    const el = it.el, a0 = el.getBoundingClientRect();
    const hills = $$('.map-art path', st).find((p) => (p.getAttribute('d') || '').startsWith('M252 372'));
    const hillsG = hills && hills.parentNode;
    el.classList.add('gc-busy');
    tipAt(it, st, GC_SPOT.hole, 2, 8); // the blade goes right onto the middle of the hills (its tip a bit right, so the blade covers the middle)
    const hole = gcAt(gcEl('gc-hole', GC_HOLE), GC_SPOT.hole), pile = gcAt(gcEl('gc-pile', GC_PILE), GC_SPOT.pile);
    if (reduceMotion) {
      if (hillsG) hillsG.style.opacity = 0;
      st.append(pile, hole);
      try { ui.play('dig'); } catch (err) {}
      return gcRise(it, st, 0);
    }
    hole.style.scale = '0'; pile.style.scale = '0';
    st.append(pile, hole);
    if (hillsG) hillsG.style.transition = 'opacity .5s';
    // slide from where it was dropped to the digging spot
    const a1 = el.getBoundingClientRect();
    el.animate([{ transform: `translate(${a0.left - a1.left}px,${a0.top - a1.top}px)` }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.3,.7,.4,1)' });
    // three digs: lift, thrust in along the handle, lever the handle back, scoop the earth up and throw it on the pile
    const CYC = 680, N = 3, T0 = 280, kf = [{ transform: 'none', offset: 0 }];
    const k = (o, dx, dy, deg, ease) => kf.push({ transform: aboutTip(dx, dy, deg), offset: o, easing: ease || 'ease-in-out' });
    for (let i = 0; i < N; i++) {
      const o = (x) => (i + x) / N;
      k(o(0.2), -10 * AX[0], -10 * AX[1], 2, 'cubic-bezier(.5,0,.9,.6)');
      k(o(0.36), 4 * AX[0], 4 * AX[1], 0, 'ease-out');
      k(o(0.56), 4 * AX[0], 4 * AX[1], -16);
      k(o(0.78), -6, -16, -24, 'ease-in');
      kf.push({ transform: 'none', offset: o(1) });
    }
    el.animate(kf, { duration: CYC * N, delay: T0, easing: 'linear' });
    for (let i = 0; i < N; i++) {
      setTimeout(() => { // the blade bites in
        try { ui.play('dig'); } catch (err) {}
        hole.style.scale = [0.5, 0.8, 1][i];
        if (hillsG) hillsG.style.opacity = [0.6, 0.25, 0][i];
      }, T0 + (i + 0.36) * CYC);
      setTimeout(() => { // ...and the earth flies onto the pile
        dirt(st, 6 + i * 2, GC_SPOT.hole, GC_SPOT.pile, 26);
        setTimeout(() => { pile.style.scale = [0.45, 0.75, 1][i]; }, 380);
      }, T0 + (i + 0.7) * CYC);
    }
    gcRise(it, st, T0 + CYC * N + 150);
  }
  function gcRise(it, st, delay) {
    setTimeout(() => {
      // the shovel gets stuck into the pile, out of the way
      const el = it.el, a = el.getBoundingClientRect();
      tipAt(it, st, GC_SPOT.pile, -2);
      const b2 = el.getBoundingClientRect();
      if (!reduceMotion) el.animate([{ transform: `translate(${a.left - b2.left}px,${a.top - b2.top}px)` }, { transform: aboutTip(-8 * AX[0], -8 * AX[1], 0), offset: 0.7 }, { transform: 'none' }], { duration: 520, easing: 'ease-in-out' });
      el.classList.remove('gc-busy');
      const c = gcAt(gcEl('gc-cache', GC_CACHE), GC_SPOT.cache);
      c.setAttribute('role', 'button');
      c.setAttribute('tabindex', '0');
      c.setAttribute('aria-label', 'Geocache sticker, click to open it');
      st.appendChild(c);
      try { ui.play('cacheFound'); } catch (err) {}
      // it comes up out of the hole: whatever is still under the ground (below the hole's rim) stays hidden
      if (!reduceMotion) {
        const g = 0.83, step = (T, deg, o, ease) => ({ transform: `translateY(${(T * 100).toFixed(1)}%) rotate(${deg}deg)`, clipPath: `inset(-40% -40% ${((1 - g + T) * 100).toFixed(1)}% -40%)`, offset: o, easing: ease });
        c.animate([step(0.9, 0, 0, 'ease-out'), step(0.55, 3, 0.35, 'ease-in-out'), step(0.25, -2.5, 0.65, 'ease-in-out'), step(0, 1, 0.88, 'ease-out'),
          { transform: 'none', clipPath: 'inset(-40% -40% -40% -40%)', offset: 1 }], { duration: 1300, easing: 'linear' });
        for (let i = 0; i < 3; i++) setTimeout(() => dirt(st, 3, [GC_SPOT.hole[0] + (Math.random() - 0.5) * 0.06, GC_SPOT.hole[1] - 0.06], [GC_SPOT.hole[0] + (Math.random() - 0.5) * 0.12, GC_SPOT.hole[1]], 10), 300 + i * 280);
      }
      wireCache(c, st);
      document.dispatchEvent(new CustomEvent('reko:cache-found'));
    }, delay);
  }
  function wireCache(c, st) {
    let n = 0, wait = 0;
    const lid = $('.gc-lid', c);
    const hit = (e) => {
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      if (e.type === 'keydown') e.preventDefault();
      if (n >= CACHE_AT || performance.now() < wait) return;
      n++;
      if (n < CACHE_AT) { // rattle, a bit harder every click
        const s = (n - 1) / Math.max(1, CACHE_AT - 2), dur = 0.35 + 0.2 * s, amp = 3 + 5 * s, rot = 3 + 6 * s;
        if (!reduceMotion) {
          const kf = [];
          for (let i = 0; i <= 8; i++) { const e2 = 1 - i / 8, sg = i % 2 ? 1 : -1; kf.push({ transform: i === 8 ? 'none' : `translate(${(sg * amp * e2).toFixed(1)}px,${(-Math.abs(amp * 0.4 * e2)).toFixed(1)}px) rotate(${(sg * rot * e2).toFixed(1)}deg)` }); }
          c.animate(kf, { duration: dur * 1000, easing: 'linear' });
        }
        try { ui.play('cacheShake', n); } catch (err) {}
        wait = performance.now() + Math.max(cacheShakeLen(n), dur) * 1000;
        return;
      }
      // open: the lid pops up and tips back, the logbook flies out and lands beside the cache
      c.classList.add('open');
      c.setAttribute('aria-label', 'Geocache sticker, open');
      try { ui.play('cacheOpen'); } catch (err) {}
      const LID = 'translate(-10px,-30px) rotate(-16deg)';
      if (!reduceMotion) lid.animate([{ transform: 'none' }, { transform: 'translate(-8px,-38px) rotate(-22deg)', offset: 0.55 }, { transform: LID }], { duration: 520, easing: 'cubic-bezier(.3,.7,.4,1)' });
      lid.style.transform = LID;
      const log = gcAt(gcEl('gc-log', GC_LOG), GC_SPOT.log);
      log.setAttribute('role', 'button');
      log.setAttribute('tabindex', '0');
      log.setAttribute('aria-label', 'Geocache logbook, click to open it');
      setTimeout(() => {
        st.appendChild(log);
        site.wireLog(log, reduceMotion ? 0 : 900);
        if (reduceMotion) return;
        // thrown out of the cache: a real arc (straight across, up and down like a ball), tumbling a little, a small bounce
        const r = st.getBoundingClientRect(), dx = (GC_SPOT.cache[0] - GC_SPOT.log[0]) * r.width, dy = (GC_SPOT.cache[1] - GC_SPOT.log[1]) * r.height - 24, h = 55, kf = [];
        for (let i = 0; i <= 12; i++) {
          const t = i / 12, x = dx * (1 - t), y = dy * (1 - t) - 4 * h * t * (1 - t);
          kf.push({ transform: `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${(-50 + 410 * t).toFixed(1)}deg) scale(${(0.55 + 0.45 * Math.min(1, t * 3)).toFixed(2)})`, offset: t * 0.78 });
        }
        kf.push({ transform: 'translate(0,-7px) rotate(366deg)', offset: 0.88, easing: 'ease-out' });
        kf.push({ transform: 'translate(0,0) rotate(360deg)', offset: 1, easing: 'ease-in' });
        log.style.rotate = '12deg'; // where it comes to rest
        log.animate(kf, { duration: 900, easing: 'linear' });
      }, reduceMotion ? 0 : 300);
      document.dispatchEvent(new CustomEvent('reko:cache-open'));
    };
    c.addEventListener('click', hit);
    c.addEventListener('keydown', hit);
  }
});
