/* rekosk.dev: "When I'm offline...": the paper map, its trail, points and their cards */
'use strict';

rekoSite.part((site) => {
  const { $, $$, reduceMotion, ui } = site;
  site.share({ offMap: () => offMap });

  /* ---------- "When I'm offline...": the paper map ----------
     The points are the .spot items in index.html (where each one sits = its --x / --y, in % of the map).
     The dashed trail runs through them in order, starting at "my desk", and draws itself the first time
     the map scrolls into view (each point pops up as the line reaches it). Clicking a point drops a pin
     on it and opens its card above it (or below, if there's no room above on screen). */
  const offMap = $('#offMap');
  if (offMap) {
    const spotsBox = $('.spots', offMap);
    const spots = $$('.spot', offMap);
    const pin = $('.map-pin', offMap);
    const anchors = [$('.map-home', offMap), ...spots].filter(Boolean);
    const pct = (el, v) => parseFloat(el.style.getPropertyValue(v)) / 100;
    // the route SVG has a 500×400 viewBox, the same 5:4 shape as the map, so % map straight onto it
    const pts = anchors.map((el) => ({ x: pct(el, '--x') * 500, y: pct(el, '--y') * 400 }));
    // smooth line through every point (Catmull-Rom turned into cubic Béziers)
    let d = `M${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)}` +
        ` ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)} ${p2.x} ${p2.y}`;
    }
    $$('.map-route path', offMap).forEach((p) => p.setAttribute('d', d));

    // when the drawing line reaches each point (by distance along the trail)
    const DRAW = 2.2;
    const reach = pts.map((p, i) => (i ? Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0));
    reach.forEach((v, i) => { if (i) reach[i] += reach[i - 1]; });
    anchors.forEach((el, i) => el.style.setProperty('--t', (reach[i] / reach[reach.length - 1] * DRAW).toFixed(2) + 's'));
    offMap.style.setProperty('--draw', DRAW + 's');
    let drawn = false;
    const drawTrail = () => {
      if (drawn) return;
      drawn = true;
      offMap.classList.remove('wait');
      offMap.classList.add('drawn');
      if (!reduceMotion) anchors.forEach((el, i) => setTimeout(() => { try { ui.play('tick', 1500 + i * 280, 0.045); } catch (err) {} }, reach[i] / reach[reach.length - 1] * DRAW * 1000));
    };
    if (reduceMotion || !('IntersectionObserver' in window)) drawTrail();
    else {
      offMap.classList.add('wait');
      const io = new IntersectionObserver((en) => {
        if (!en[0].isIntersecting) return;
        io.disconnect();
        setTimeout(drawTrail, 250);
      }, { threshold: 0.45 });
      io.observe(offMap);
    }

    let cur = null; // the open point
    const btnOf = (s) => $('.spot-btn', s), cardOf = (s) => $('.spot-card', s);
    const NAV = 84; // sticky nav + a little air

    function placeCard(s) {
      const card = cardOf(s);
      const W = spotsBox.clientWidth, H = spotsBox.clientHeight;
      const px = pct(s, '--x') * W, py = pct(s, '--y') * H;
      const cw = card.offsetWidth, ch = card.offsetHeight;
      const sr = spotsBox.getBoundingClientRect();
      const PIN = 46, GAP = 14, UNDER = 38; // UNDER: below, the arrow's tip stops at the edge of the point's 44px button
      // above the pin if it fits on screen, otherwise below the point (whichever side has more room)
      const roomUp = sr.top + py - PIN - GAP - NAV;
      const roomDown = innerHeight - (sr.top + py + UNDER) - 8;
      const below = roomUp < ch && roomDown > roomUp;
      let left = Math.max(0, Math.min(W - cw, px - cw / 2));
      left = Math.max(8 - sr.left, Math.min(innerWidth - 8 - sr.left - cw, left)); // and never off the side of the screen
      card.classList.toggle('below', below);
      card.style.left = left.toFixed(1) + 'px';
      card.style.top = (below ? py + UNDER : py - PIN - GAP - ch).toFixed(1) + 'px';
      card.style.setProperty('--ax', Math.max(22, Math.min(cw - 22, px - left)).toFixed(1) + 'px');
    }

    function openSpot(s) {
      if (cur === s) { closeSpot(true); return; }
      if (cur) closeSpot(false, true);
      cur = s;
      const card = cardOf(s);
      s.classList.add('on', 'seen');
      btnOf(s).setAttribute('aria-expanded', 'true');
      pin.style.setProperty('--x', s.style.getPropertyValue('--x'));
      pin.style.setProperty('--y', s.style.getPropertyValue('--y'));
      pin.classList.remove('drop', 'up');
      void pin.offsetWidth; // restart the drop
      pin.classList.add('drop');
      card.hidden = false;
      card.classList.remove('in', 'out');
      placeCard(s);
      void card.offsetWidth;
      card.classList.add('in');
      card.focus({ preventScroll: true });
      // still sticking out of the screen (small screens): scroll just enough to show all of it
      const top = spotsBox.getBoundingClientRect().top + card.offsetTop, bottom = top + card.offsetHeight;
      const dy = top < NAV ? top - NAV : bottom > innerHeight - 8 ? Math.min(bottom - innerHeight + 16, top - NAV) : 0;
      if (dy) window.scrollBy({ top: dy, behavior: reduceMotion ? 'auto' : 'smooth' });
      try { ui.play('pin'); } catch (err) {}
    }

    // refocus: give the keyboard focus back to the point (closing with the ×)
    // swap: another point is opening right away, so the card just goes and the pin stays to drop again
    function closeSpot(refocus, swap) {
      if (!cur) return;
      const s = cur, card = cardOf(s), btn = btnOf(s);
      cur = null;
      s.classList.remove('on');
      btn.setAttribute('aria-expanded', 'false');
      if (refocus) btn.focus({ preventScroll: true });
      if (swap) { card.hidden = true; card.classList.remove('in', 'out'); return; }
      pin.classList.remove('drop');
      pin.classList.add('up');
      card.classList.remove('in');
      card.classList.add('out');
      setTimeout(() => { if (cur !== s) { card.hidden = true; card.classList.remove('out'); } }, 180);
      try { ui.play('close'); } catch (err) {}
    }

    spots.forEach((s) => {
      btnOf(s).addEventListener('click', () => openSpot(s));
      $('.spot-x', s).addEventListener('click', () => closeSpot(true));
    });
    document.addEventListener('pointerdown', (e) => { if (cur && !e.target.closest('.spot-card, .spot-btn, .win')) closeSpot(); }); // a photo window keeps its card open
    window.addEventListener('resize', () => { if (cur) placeCard(cur); });

    // "Click on one" in the text: the points bounce one after another along the trail
    $$('[data-map-ping]').forEach((el) => {
      const ping = () => {
        const r = offMap.getBoundingClientRect();
        if (r.top < NAV || r.bottom > innerHeight) offMap.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        const wait = drawn ? 350 : 350 + DRAW * 1000;
        drawTrail();
        spots.forEach((s, i) => setTimeout(() => {
          const b = btnOf(s);
          b.classList.remove('ping');
          void b.offsetWidth;
          b.classList.add('ping');
          try { ui.play('tick', 1700 + i * 260, 0.05); } catch (err) {}
        }, wait + i * 130));
      };
      el.addEventListener('click', ping);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ping(); } });
    });
  }
});
