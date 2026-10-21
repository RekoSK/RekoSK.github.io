/* ---------- Social media reels: Instagram embeds behind a consent notice, paged with the up/down arrows ----------
   Pages: reel 1, reel 2, "More here:". On the last page the Instagram button flies from the buttons row into the
   page's slot, and flies back when you page up. Each reel first shows a notice that it's external content from
   Instagram (Meta); nothing loads from Meta until "Load videos" is clicked, which loads both (for this visit only,
   the choice isn't stored). A loaded reel that leaves sight (paging away, or the section scrolled off screen) is
   reloaded so it goes quiet (Instagram's player has no pause API). */
'use strict';

rekoSite.part((site) => {
  const box = document.getElementById('reels');
  if (!box) return;
  const track = box.querySelector('.reel-track'), pages = box.querySelectorAll('.reel-page');
  const up = box.querySelector('.reel-up'), down = box.querySelector('.reel-down'), dots = box.querySelectorAll('.reel-dots i');
  const slot = box.querySelector('.reel-slot'), igBtn = document.querySelector('#social .btn-ig');
  const home = igBtn && igBtn.parentElement;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sfx = (n) => { try { site.playSfx && site.playSfx(n); } catch (e) {} };
  let page = 0, inView = false, ghost = null, loaded = false;

  const frames = [...box.querySelectorAll('.reel-frame')];
  const view = box.querySelector('.reel-view');
  function pauseHidden() {
    if (!loaded) return;
    frames.forEach((f) => {
      const shown = inView && f.closest('.reel-page') === pages[page];
      if (f.dataset.shown && !shown) { f.src = 'about:blank'; setTimeout(() => { f.src = f.dataset.src; }, 60); }
      if (shown) f.dataset.shown = '1'; else delete f.dataset.shown;
    });
  }
  function load() {
    if (loaded) return;
    loaded = true;
    box.classList.add('embeds-on');
    frames.forEach((f) => { f.hidden = false; f.src = f.dataset.src; });
    sfx('pop');
    pauseHidden();
  }
  box.querySelectorAll('.gate-btn').forEach((b) => b.addEventListener('click', load));
  new IntersectionObserver((ents) => { inView = ents[ents.length - 1].isIntersecting; pauseHidden(); }, { threshold: 0 }).observe(view);

  // vertical offset the track will have once it finishes sliding to the current page
  const trackShift = () => {
    const m = getComputedStyle(track).transform, now = m && m !== 'none' ? new DOMMatrixReadOnly(m).m42 : 0;
    return -page * track.clientHeight - now;
  };

  // move the Instagram button to a new parent: a fixed-position copy flies the whole way on top of everything
  // (so the reel box's clipping can't hide it), the real button stays invisible until the copy lands
  function fly(to) {
    if (!igBtn || igBtn.parentElement === to) return;
    const a = igBtn.getBoundingClientRect();
    to.appendChild(igBtn);
    if (still) return;
    const r = igBtn.getBoundingClientRect(), dy = to === slot ? trackShift() : 0;
    const bx = r.left, by = r.top + dy;
    let g = ghost, from = 'translate(0, 0) rotate(0)', ox = a.left, oy = a.top, lift = 50;
    if (g) { // paged back while it was still in the air: turn around from where it is right now
      from = getComputedStyle(g).transform; if (!from || from === 'none') from = 'translate(0, 0) rotate(0)';
      ox = parseFloat(g.style.left); oy = parseFloat(g.style.top); lift = 25;
      const old = g.getAnimations(); old.forEach((an) => { an.onfinish = an.oncancel = null; an.cancel(); });
      g.style.transform = from;
    } else {
      g = ghost = igBtn.cloneNode(true);
      g.removeAttribute('href'); g.setAttribute('aria-hidden', 'true'); g.classList.add('flying');
      Object.assign(g.style, { position: 'fixed', left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px', boxSizing: 'border-box', margin: '0', zIndex: '1000' });
      document.body.appendChild(g);
    }
    igBtn.style.visibility = 'hidden';
    const m = new DOMMatrixReadOnly(from), sx = m.e, sy = m.f, dx = bx - ox, dyy = by - oy;
    const anim = g.animate([
      { transform: from },
      { transform: `translate(${(sx + dx) / 2}px, ${(sy + dyy) / 2 - lift}px) rotate(-6deg)`, offset: 0.5 },
      { transform: `translate(${dx}px, ${dyy}px) rotate(0)` }
    ], { duration: 800, easing: 'cubic-bezier(.6,0,.3,1)' });
    const land = () => { g.remove(); if (ghost === g) { ghost = null; igBtn.style.visibility = ''; } };
    anim.onfinish = anim.oncancel = land;
    sfx('swish');
  }

  function go(n) {
    n = Math.max(0, Math.min(pages.length - 1, n));
    if (n === page) return;
    const wasLast = page === pages.length - 1;
    page = n;
    track.style.transform = `translateY(${-100 * page}%)`;
    up.disabled = page === 0; down.disabled = page === pages.length - 1;
    dots.forEach((d, i) => d.classList.toggle('on', i === page));
    sfx('spray');
    pauseHidden();
    if (page === pages.length - 1) { fly(slot); document.dispatchEvent(new CustomEvent('reko:reels-end')); } // Scroller achievement
    else if (wasLast) fly(home);
  }
  up.addEventListener('click', () => go(page - 1));
  down.addEventListener('click', () => go(page + 1));
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); go(page + 1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); go(page - 1); }
  });
});
