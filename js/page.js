/* rekosk.dev: smaller page-wide bits: mobile menu, hero parallax + eyes, magnetic buttons, links to other sites,
   the "projects" link in the About text and the school timeline accordion */
'use strict';

rekoSite.part((site) => {
  const { $, $$, reduceMotion, logoBtn } = site;
  site.share({ menuBtn: () => menuBtn, menu: () => menu, closeMenu: () => closeMenu });

  /* ---------- mobile menu ---------- */
  const menuBtn = $('#menuBtn');
  const menu = $('#mMenu');
  function closeMenu() {
    menu.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
  }
  menuBtn.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    menuBtn.setAttribute('aria-expanded', String(!menu.hidden));
  });
  $$('a', menu).forEach((a) => a.addEventListener('click', closeMenu));

  /* ---------- hero parallax + eyes that follow the cursor ---------- */
  const hero = $('.hero');
  let heroRaf = 0, hx = 0, hy = 0;
  hero.addEventListener('mousemove', (e) => {
    hx = e.clientX; hy = e.clientY;
    if (heroRaf) return;
    heroRaf = requestAnimationFrame(() => {
      heroRaf = 0;
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--px', (((hx - r.left) / r.width - 0.5) * 2).toFixed(3));
      hero.style.setProperty('--py', (((hy - r.top) / r.height - 0.5) * 2).toFixed(3));
      const b = logoBtn.getBoundingClientRect();
      const dx = hx - (b.left + b.width / 2);
      const dy = hy - (b.top + b.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 320) * 2.4;
      hero.style.setProperty('--ex', (dx / d * k).toFixed(2) + '%');
      hero.style.setProperty('--ey', (dy / d * k).toFixed(2) + '%');
    });
  });
  hero.addEventListener('mouseleave', () => {
    ['--px', '--py'].forEach((p) => hero.style.setProperty(p, '0'));
    ['--ex', '--ey'].forEach((p) => hero.style.setProperty(p, '0%'));
  });

  /* ---------- magnetic buttons ---------- */
  $$('.btn').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      el.style.setProperty('--mx', ((x - r.width / 2) * 0.22).toFixed(1) + 'px');
      el.style.setProperty('--my', ((y - r.height / 2) * 0.3).toFixed(1) + 'px');
      el.style.setProperty('--hx', x.toFixed(0) + 'px');
      el.style.setProperty('--hy', y.toFixed(0) + 'px');
    });
    el.addEventListener('mouseleave', () => {
      el.style.setProperty('--mx', '0px');
      el.style.setProperty('--my', '0px');
    });
  });


  // every link to another site opens in a new tab
  $$('a[href^="http"]').forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });


  // "projects" in the About text scrolls to the Projects section
  $$('[data-goto]').forEach((el) => {
    const go = () => { const t = $(el.dataset.goto); if (t) t.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }); };
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  });


  /* ---------- school timeline accordion ---------- */
  const tlItems = $$('.tl-item');
  tlItems.forEach((item) => {
    $('.tl-head', item).addEventListener('click', () => {
      const open = !item.classList.contains('open');
      tlItems.forEach((other) => {
        other.classList.remove('open');
        $('.tl-head', other).setAttribute('aria-expanded', 'false');
      });
      item.classList.toggle('open', open);
      $('.tl-head', item).setAttribute('aria-expanded', String(open));
    });
  });
});
