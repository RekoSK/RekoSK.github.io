/* rekosk.dev: the geocache logbook: its pages and the scratch-off codes in the back cover */
'use strict';

rekoSite.part((site) => {
  const { $, $$, reduceMotion, ui } = site;
  site.share({ wireLog: () => wireLog, scScrape: () => scScrape, scLift: () => scLift });

  /* ---------- the logbook, opened ----------
     Clicking the logbook from the dug-up cache zooms it up into a focus view (everything else dimmed): the closed book,
     its cover first. The arrows (or ← / →) turn the pages like a real book: the cover swings open, then each leaf flips
     over from the right to the left. The pages are full of logs, stamps and stickers (LB_PAGES). The × closes it back down to the map.
     Fires "reko:log-read" on document the first time it opens. */
  const LB_LEAVES = 5; // the cover + 4 leaves of paper (8 pages, LB_PAGES)
  function wireLog(log, after) {
    lbFonts();
    setTimeout(() => log.classList.add('gc-open-able'), after);
    const open = (e) => {
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      if (!log.classList.contains('gc-open-able') || document.querySelector('.lb')) return;
      e.preventDefault();
      openLog(log);
    };
    log.addEventListener('click', open);
    log.addEventListener('keydown', open);
  }
  /* the logbook's contents, made to look like a real, well-used geocache logbook: every page crammed with handwritten logs
     (all kinds of handwriting and pens), rubber stamps of the cachers (1reko2's own, a travel bug's tag with its code hidden)
     and stickers. The handwriting fonts load only once the logbook is dug up (lbFonts), so they're ready when it opens. */
  const LB_FONTS = { cav: ['Caveat', 1.3], dan: ['Dancing Script', 1.08], kal: ['Kalam', .92], pat: ['Patrick Hand', 1.05], sac: ['Sacramento', 1.25], mar: ['Marck Script', 1.1], hom: ['Homemade Apple', .78], ind: ['Indie Flower', 1], sha: ['Shadows Into Light', 1.1], ree: ['Reenie Beanie', 1.4], not: ['Nothing You Could Do', .82], roc: ['Rock Salt', .72], glo: ['Gloria Hallelujah', .86], cov: ['Covered By Your Grace', 1.25], bel: ['La Belle Aurore', 1.05] };
  const LB_INK = { b: '#22409a', k: '#26231f', r: '#b02a2e', g: '#1f6b45', p: '#5c3190', n: '#7a766d', w: '#6e4322' };
  let lbFontsOn = false;
  function lbFonts() {
    if (lbFontsOn) return;
    lbFontsOn = true;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'css/fonts-logbook.css'; // self-hosted in assets/fonts, like the rest of the site's fonts
    // fonts download only once something uses them: ask for them all now
    l.onload = () => Object.values(LB_FONTS).forEach(([f]) => document.fonts.load(`20px "${f}"`, 'Aaďž').catch(() => {}));
    document.head.appendChild(l);
  }
  let lbId = 0;
  // text along an arc of a round stamp (centered on the arc)
  const lbArc = (d, t, size, extra = '') => { const id = 'lbp' + (++lbId); return `<path id="${id}" d="${d}" fill="none"/><text font-size="${size}" text-anchor="middle" ${extra}><textPath href="#${id}" startOffset="50%">${t}</textPath></text>`; };
  const lbInk = (color, vb, body) => `<svg viewBox="${vb}" aria-hidden="true"><g class="lb-ink" style="color:${color}">${body}</g></svg>`;
  const LB_STAMP = {
    // 1reko2's own stamp: the logo in the middle, the name around the top and the thanks around the bottom
    reko: () => lbInk('#c44a08', '0 0 100 100', '<circle cx="50" cy="50" r="47.5" stroke-width="2.6"/><circle cx="50" cy="50" r="44" stroke-width=".9"/><circle cx="50" cy="50" r="29" stroke-width="1.6"/>'
      + '<g fill="currentColor" stroke="none" font-family="Poppins,sans-serif">' + lbArc('M16 50A34 34 0 0 1 84 50', '1reko2', 12.5, 'font-weight="800" letter-spacing="1.4"')
      + lbArc('M9 50A41 41 0 0 0 91 50', 'Thanks for the cache!', 8.2, 'font-weight="700" letter-spacing=".3"') + '<circle cx="13" cy="50" r="1.7"/><circle cx="87" cy="50" r="1.7"/></g>'
      + '<image href="assets/logo/reko-logo.svg" x="31" y="31" width="38" height="38" filter="url(#lbRk)"/>'),
    // a travel bug's dog tag; the real tracking code is never shown
    tb: () => lbInk('#1f6b45', '0 0 120 78', '<path d="M18 3h84a15 15 0 0 1 15 15v42a15 15 0 0 1-15 15H18A15 15 0 0 1 3 60V18A15 15 0 0 1 18 3z" stroke-width="2.6"/><circle cx="15" cy="39" r="5" stroke-width="2"/>'
      + '<path d="M33 33l-7-5M33 41h-8M33 49l-7 5M47 33l7-5M47 41h8M47 49l7 5M37 22l-4-6M43 22l4-6" stroke-width="2.2" stroke-linecap="round"/><path d="M62 35h44" stroke-width="1"/>'
      + '<g fill="currentColor" stroke="none" font-family="Poppins,sans-serif" text-anchor="middle"><ellipse cx="40" cy="42" rx="8" ry="11"/><circle cx="40" cy="26.5" r="5"/>'
      + '<text x="84" y="29" font-size="8.6" font-weight="800" letter-spacing=".4">TRAVEL BUG</text><text x="84" y="53" font-size="15" font-weight="600" font-family="\'Montserrat\',monospace" letter-spacing="1.5">xxxxxx</text>'
      + '<text x="84" y="66" font-size="7" font-weight="600">trackable</text></g>'),
    ring: (name, low, color, icon) => lbInk(color, '0 0 100 100', '<circle cx="50" cy="50" r="47" stroke-width="2.4"/><circle cx="50" cy="50" r="30" stroke-width="1.4"/>'
      + '<g fill="currentColor" stroke="none" font-family="Poppins,sans-serif" font-weight="800">' + lbArc('M15 50A35 35 0 0 1 85 50', name, 10.5, 'letter-spacing="1"')
      + lbArc('M8 50A42 42 0 0 0 92 50', low, 10, 'letter-spacing="1.4"') + '<circle cx="11.5" cy="50" r="1.8"/><circle cx="88.5" cy="50" r="1.8"/>' + icon + '</g>'),
    date: (top, d, color) => lbInk(color, '0 0 110 60', '<rect x="3" y="3" width="104" height="54" rx="4" stroke-width="2.6"/><rect x="8" y="8" width="94" height="44" rx="2" stroke-width="1"/>'
      + `<g fill="currentColor" stroke="none" font-family="Poppins,sans-serif" text-anchor="middle"><text x="55" y="31" font-size="18" font-weight="900" letter-spacing="3">${top}</text><text x="55" y="45" font-size="10" font-weight="700" font-family="'JetBrains Mono',monospace" letter-spacing="1">${d}</text></g>`),
    oval: (big, small, color) => lbInk(color, '0 0 110 64', '<ellipse cx="55" cy="32" rx="51" ry="28" stroke-width="2.6"/><ellipse cx="55" cy="32" rx="45" ry="22.5" stroke-width="1"/>'
      + `<g fill="currentColor" stroke="none" font-family="Poppins,sans-serif" text-anchor="middle"><text x="55" y="37" font-size="20" font-weight="900" letter-spacing="2">${big}</text><text x="55" y="48" font-size="7.5" font-weight="700" letter-spacing="1">${small}</text></g>`),
    paw: (color) => lbInk(color, '0 0 60 60', '<g fill="currentColor" stroke="none"><ellipse cx="30" cy="40" rx="13" ry="11"/><ellipse cx="14" cy="26" rx="5.5" ry="7" transform="rotate(-20 14 26)"/><ellipse cx="24" cy="15" rx="5.5" ry="7.5"/><ellipse cx="37" cy="15" rx="5.5" ry="7.5"/><ellipse cx="47" cy="26" rx="5.5" ry="7" transform="rotate(20 47 26)"/></g>'),
  };
  const LB_TREE = '<path d="M50 24l-11 15h6l-10 13h7l-10 13h36l-10-13h7l-10-13h6z"/><rect x="47" y="65" width="6" height="8"/>';
  const LB_PEAKS = '<path d="M25 68l15-22 7 9 9-15 19 28z"/><circle cx="64" cy="35" r="4"/>';
  // stickers: printed in colour, die-cut with a white edge
  const lbSk = (vb, body) => `<svg viewBox="${vb}" aria-hidden="true">${body}</svg>`;
  const WE = 'stroke="#fff" stroke-width="5" stroke-linejoin="round" paint-order="stroke"';
  const LB_STICK = {
    smile: lbSk('0 0 60 60', `<circle cx="30" cy="30" r="26" fill="#ffcf2e" ${WE}/><circle cx="21" cy="24" r="3.4" fill="#2a2016"/><circle cx="39" cy="24" r="3.4" fill="#2a2016"/><path d="M17 34q13 13 26 0" fill="none" stroke="#2a2016" stroke-width="3.2" stroke-linecap="round"/>`),
    star: lbSk('0 0 60 60', `<path d="M30 4l7.6 15.6 17.2 2.5-12.4 12.1 2.9 17.1L30 43.2 14.7 51.3l2.9-17.1L5.2 22.1l17.2-2.5z" fill="#ffb81c" ${WE}/><path d="M30 14l4.6 9.5 10.4 1.5" fill="none" stroke="#fff3c4" stroke-width="2.4" stroke-linecap="round"/>`),
    heart: lbSk('0 0 60 56', `<path d="M30 52S4 36 4 19C4 10 11 4 18.5 4 24 4 28 7.5 30 12c2-4.5 6-8 11.5-8C49 4 56 10 56 19c0 17-26 33-26 33z" fill="#e2384d" ${WE}/><path d="M14 16q2-5 7-5" fill="none" stroke="#ffd0d6" stroke-width="3" stroke-linecap="round"/>`),
    tatry: lbSk('0 0 60 60', `<circle cx="30" cy="30" r="27" fill="#3c9fd6" ${WE}/><circle cx="41" cy="20" r="6" fill="#ffd44a"/><path d="M5 42l13-17 7 8 10-15 20 24a27 27 0 0 1-50 0z" fill="#2f5d3a"/><path d="M18 25l-4 5 4-1 3 3zM35 18l-5 7 5-2 4 3z" fill="#fff"/><text x="30" y="52" fill="#fff" font-family="Poppins,sans-serif" font-size="7.5" font-weight="800" text-anchor="middle" letter-spacing="1">TATRY</text>`),
    fox: lbSk('0 0 60 60', `<path d="M8 8l13 9h18l13-9-3 22-19 24-19-24z" fill="#f07a1a" ${WE}/><path d="M11 30l19 24 19-24-10 3h-18z" fill="#fff4e6"/><circle cx="22" cy="28" r="2.6" fill="#2a2016"/><circle cx="38" cy="28" r="2.6" fill="#2a2016"/><path d="M27 44h6l-3 4z" fill="#2a2016"/>`),
    tftc: lbSk('0 0 70 52', `<path d="M10 4h50a7 7 0 0 1 7 7v22a7 7 0 0 1-7 7H28l-12 9 2-9h-8a7 7 0 0 1-7-7V11a7 7 0 0 1 7-7z" fill="#2fa36b" ${WE}/><text x="35" y="28" fill="#fff" font-family="Poppins,sans-serif" font-size="14" font-weight="900" text-anchor="middle" letter-spacing="1">TFTC!</text>`),
  };
  // one page: logs { f: handwriting, c: ink, t: text, s: size, r: tilt, i: indent }, stamps { st, side, w, r } that the logs
  // flow around, and stickers { sk, x, y, w, r } stuck anywhere on top
  const LB_PAGES = [
    [
      { f: 'kal', c: 'k', t: '23.9.2023 – <u>1reko2</u> – cache placed! Have fun &amp; sign the log :)' },
      { st: () => LB_STAMP.date('FTF', '24 SEP 2023', '#b02a2e'), w: .3, r: -8 },
      { f: 'dan', c: 'b', t: '24.9.23 <b>geoMaťo</b> – FTF!!! at 7:12 am, still dark :) TFTC', r: -1 },
      { f: 'cav', c: 'n', t: '24/9 Zuzka_K – STF :( TFTC', i: 4 },
      { f: 'hom', c: 'b', t: 'Sept 30 – TheTrailRats – what a cute birdhouse! TFTC', r: .8 },
      { f: 'cav', c: 'g', t: '1.10.2023 Kubko &amp; Ema (7 y.o.) – we found it!! ♥ took an eraser, left a toy car', r: -.6 },
      { f: 'roc', c: 'k', t: 'OCT 8 2023 – BLUEFINCH – TFTC!', i: 10 },
      { sk: LB_STICK.smile, x: 74, y: 2, w: .15, r: 12 },
    ],
    [
      { st: LB_STAMP.reko, side: 'l', w: .38, r: -10 },
      { f: 'sac', c: 'p', t: '15.10.2023 – Hlava22 – Beautiful place, thanks for the cache!' },
      { f: 'ind', c: 'b', t: '22/10/23 jojo_geo – quick find, SL. TNLN' },
      { f: 'mar', c: 'k', t: '29.10. OndraCZ – Thanks for the cache, greetings from Brno!', r: -1 },
      { f: 'not', c: 'r', t: 'Nov 4 &#39;23 – dadabird – found it with my dad', r: .7 },
      { f: 'cav', c: 'b', t: '11.11.2023 Rybár Peter – a quick cache after fishing :) TFTC', i: 3 },
      { sk: LB_STICK.star, x: 76, y: 88, w: .12, r: -14 },
    ],
    [
      { st: () => LB_STAMP.ring('TEAM JEŽKO', 'FOUND IT', '#22409a', LB_TREE), w: .34, r: 9 },
      { f: 'kal', c: 'g', t: '2.12.2023 TeamJežko – 4 hedgehogs, 1 cache. Great hide!', r: -.8 },
      { f: 'sha', c: 'k', t: 'DEC 27 – Gecko77 – Merry Xmas caching! TFTC' },
      { f: 'dan', c: 'p', t: '1.1.2024 New year, new cache! – MiloT', i: 6 },
      { f: 'ree', c: 'b', t: 'jan 14 – lostnfound.pl – frozen fingers, still worth it!', r: .5 },
      { f: 'hom', c: 'k', t: '3 Feb 2024 – pathfinder.at' },
      { f: 'bel', c: 'b', t: 'Thanks for the cache! Greetings from Graz', i: 14, r: -1.2 },
      { sk: LB_STICK.tatry, x: 3, y: 85, w: .15, r: -9 },
    ],
    [
      { st: () => LB_STAMP.paw('#6e4322'), w: .17, r: 18 },
      { f: 'pat', c: 'w', t: '17.2.2024 Kristína &amp; Bady the dog – Bady found it first!' },
      { f: 'cav', c: 'n', t: '9.3.24 Lesní skřítci – thanks, it was muddy here', r: -.5 },
      { f: 'roc', c: 'b', t: 'MAR 16 – WANDERINGOWL – SL', i: 8 },
      { f: 'not', c: 'k', t: 'Mar 30 – the Novaks – lovely walk with the kids, thanks!', r: .6 },
      { st: () => LB_STAMP.oval('TFTC', 'GEO · ONDRA · CZ', '#5c3190'), side: 'l', w: .3, r: -7 },
      { f: 'mar', c: 'p', t: '6.4. OndraCZ again, this time with a stamp :)' },
      { f: 'kal', c: 'b', t: '13.4.2024 geoMaťo – here again, with friends.', r: -.6 },
      { f: 'ind', c: 'k', t: 'Apr 14 – hikerdan – TFTC from Ireland!', i: 3 },
      { sk: LB_STICK.fox, x: 74, y: 1, w: .15, r: 10 },
    ],
    [
      { st: LB_STAMP.tb, side: 'l', w: .4, r: -6 },
      { f: 'ind', c: 'g', t: 'Apr 20 – bluefinch – TB drop! take it further please', r: .5 },
      { f: 'kal', c: 'k', t: '27.4. Zuzka_K – took the TB, it travels on to Austria!' },
      { f: 'sac', c: 'r', t: '1 May 2024 – Love &amp; caching ♥ Ela and Tomi', i: 4, s: 1.05 },
      { f: 'glo', c: 'k', t: 'MAY 18 2024 – TRAILKID – my first cache ever!!!', r: -.8 },
      { f: 'dan', c: 'b', t: '2.6.2024 Hlava22 – second visit, still the best' },
      { f: 'pat', c: 'g', t: '9.6.2024 Kubko &amp; Ema – us again :)', r: .6 },
      { sk: LB_STICK.heart, x: 82, y: 89, w: .12, r: 12 },
    ],
    [
      { f: 'cov', c: 'p', t: 'June 21 – the summer crew – 5 of us! TFTC', r: -.6 },
      { st: () => LB_STAMP.ring('GEO HIKERS', '★ SK ★', '#26231f', LB_PEAKS), w: .33, r: -12 },
      { f: 'cav', c: 'k', t: '6.7.2024 Kubko &amp; Ema – that makes 50 finds!' },
      { f: 'mar', c: 'b', t: '20.7.2024 Wanderlust_SK – a tropical heatwave, but I found it!', r: .7 },
      { f: 'sha', c: 'g', t: 'Aug 3 &#39;24 – gecko77 again – TNLN, SL', i: 6 },
      { f: 'pat', c: 'r', t: '17.8.2024 Rybár Peter – caches &gt; fish' },
      { f: 'hom', c: 'n', t: 'Sep 1 – owlbert – rainy day find', r: -.5 },
      { sk: LB_STICK.tftc, x: 4, y: 0, w: .19, r: -8 },
    ],
    [
      { f: 'kal', c: 'k', t: '23.9.2024 <u>1reko2</u> – OM: happy 1st birthday, birdhouse! all dry &amp; ok' },
      { st: () => LB_STAMP.date('FOUND', '05 OCT 2024', '#1f6b45'), side: 'l', w: .3, r: 7 },
      { f: 'dan', c: 'g', t: '5.10.2024 Zuzka_K – STF again :D', r: -.7 },
      { f: 'mar', c: 'b', t: '19.10. lostnfound.pl – thanks for the cache!' },
      { f: 'not', c: 'p', t: 'Nov 2 – owlbert – misty morning, spooky birdhouse', i: 5, r: .6 },
      { f: 'ind', c: 'b', t: 'Dec 24, 2024 – Santa&#39;s little caching elf. Ho ho ho!' },
      { f: 'cav', c: 'r', t: '1.1.2025 MiloT – happy new year :)', r: -.4 },
      { f: 'ree', c: 'k', t: 'jan 6 – Gecko77 – SL', i: 4 },
      { sk: LB_STICK.star, x: 78, y: 1, w: .11, r: 20 },
    ],
    [
      { f: 'cav', c: 'b', t: '15.3.2025 TeamJežko – spring is here! TFTC' },
      { st: () => LB_STAMP.date('FOUND', '14 JUN 2025', '#b02a2e'), w: .3, r: -6 },
      { f: 'glo', c: 'k', t: 'JUN 14 2025 – ROADTRIPPERS – 2000 km for this one :)', r: .5 },
      { f: 'sac', c: 'g', t: '2.8.2025 Ela &amp; Tomi – our anniversary ♥', i: 6, s: 1.05 },
      { f: 'pat', c: 'n', t: 'ps: signed right on the edge – MiloT', r: -1 },
      { f: 'hom', c: 'p', t: 'Aug 30 – owlbert – back again!', r: .5 },
      { f: 'mar', c: 'g', t: '7.9.2025 geoMaťo – 2 years! TFTC', i: 5 },
      { f: 'kal', c: 'k', t: '23.9.2025 <u>1reko2</u> – OM: the logbook is full!! A new one is coming soon. Thanks everyone!', r: -.4 },
      { sk: LB_STICK.smile, x: 6, y: 90, w: .11, r: -16 },
    ],
  ];
  // inside the cover: a printed "you found it" note and the geocache card (its English side) glued in; both zoom in on a click (openLog)
  const LB_INSIDE = '<div class="lb-note lb-zoomable" role="button" tabindex="0" aria-label="Zoom in on the note"><b>GEOCACHE</b><em>Congratulations, you found it!</em><span>Please sign this logbook with your name and the date. Trade fair, trade even, and put everything back exactly where you found it. Thank you!</span><i>Birdhouse · hidden by 1reko2 · 23.9.2023</i></div>'
    + '<div class="lb-card lb-zoomable" role="button" tabindex="0" aria-label="Zoom in on the geocache card"><img class="lbc-logo" src="assets/offline/geocaching-logo.jpg" alt="" draggable="false">'
    + '<b class="lbc-t">CACHE for game GEOCACHING<br>please read</b><strong class="lbc-h">Congrats, you’ve found it!</strong>'
    + '<p>Intentionally or not, it is part of a worldwide game dedicated to GPS (Global Positioning System) users, called Geocaching. The game basically involves a GPS user hiding „treasure“ (this container and its contents), and publishing the exact coordinates so other GPS users can come on a „treasure hunt“ to find it.</p>'
    + '<p>The only rules are: if you take something from the cache, you must leave something for the cache, and you have to write about your visit in the logbook. If possible, let us know that you found it by visiting the website listed below. Hopefully, the person that hid this container found a good spot that is not easily found by uninterested parties. Geocaching is open to everyone with a GPS and a sense of adventure. There are similar sites all over the world. For more information visit our websites:</p>'
    + '<p class="lbc-url">http://www.geocaching.com</p><p>If this container needs to be removed for any reason, please let us know that. We do apologize and will be happy to move it.</p>'
    + '<b class="lbc-f">PLEASE DO NOT MOVE AND VANDALIZE THE CONTAINER</b></div>';
  function lbPage(items) {
    let txt = '', top = '';
    for (const it of items) {
      if (it.st) txt += `<span class="lb-st lb-${it.side || 'r'}" style="width:calc(var(--pw) * ${it.w});rotate:${it.r || 0}deg">${it.st()}</span>`;
      else if (it.sk) top += `<span class="lb-sk" style="left:${it.x}%;top:${it.y}%;width:calc(var(--pw) * ${it.w});rotate:${it.r || 0}deg">${it.sk}</span>`;
      else {
        const [fam, k] = LB_FONTS[it.f];
        txt += `<p class="lb-log" style="font-family:'${fam}',cursive;font-size:calc(var(--pw) * ${(.046 * k * (it.s || 1)).toFixed(4)});color:${LB_INK[it.c]};rotate:${it.r || 0}deg;padding-left:${it.i || 0}%">${it.t}</p>`;
      }
    }
    return `<div class="lb-txt">${txt}</div>${top}`;
  }
  /* the scratch-off paper glued inside the logbook's back cover ("Secret codes for the terminal"): a lottery foil only
     the birdhouse coin scrapes off, and only where the coin is actually dragged over it, on the paper in the book or on
     its zoomed-up copy. Both copies draw the same mask (SC.mask), so they always match. It stays scraped until reload. */
  const SC_W = 600, SC_H = 180;
  const LB_END = '<div class="lb-note lb-sc lb-zoomable" role="button" tabindex="0" aria-label="Zoom in on the secret codes"><b>SECRET CODES</b><em>for the terminal</em>'
    + `<span class="sc-box"><span class="sc-txt">duhel<br>rekoboss</span><canvas class="sc-foil" width="${SC_W}" height="${SC_H}" aria-hidden="true"></canvas></span></div>`;
  const SC = { mask: null, tex: null, last: null, live: null, t: 0 };
  function scInit() {
    if (SC.mask) return;
    SC.mask = Object.assign(document.createElement('canvas'), { width: SC_W, height: SC_H });
    const t = SC.tex = Object.assign(document.createElement('canvas'), { width: SC_W, height: SC_H });
    const c = t.getContext('2d');
    const g = c.createLinearGradient(0, 0, SC_W, SC_H);
    g.addColorStop(0, '#9fa4ab'); g.addColorStop(0.35, '#e4e7ea'); g.addColorStop(0.5, '#b9bdc3'); g.addColorStop(0.7, '#eceef0'); g.addColorStop(1, '#a3a8ae');
    c.fillStyle = g;
    c.fillRect(0, 0, SC_W, SC_H);
    const im = c.getImageData(0, 0, SC_W, SC_H), d = im.data; // the foil's grain
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 34; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    c.putImageData(im, 0, 0);
    c.strokeStyle = 'rgba(255,255,255,.2)'; // diagonal sheen lines, like on lottery tickets
    c.lineWidth = 2;
    for (let x = -SC_H; x < SC_W; x += 14) { c.beginPath(); c.moveTo(x, SC_H); c.lineTo(x + SC_H, 0); c.stroke(); }
    c.fillStyle = 'rgba(70,74,80,.5)';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = "800 34px Poppins, sans-serif";
    c.fillText('SCRATCH HERE', SC_W / 2, SC_H / 2);
  }
  // draw the foil, minus what's scraped off, on every copy of the paper
  function scRender() {
    if (!SC.mask) return;
    $$('.sc-foil').forEach((cv) => {
      const c = cv.getContext('2d');
      c.globalCompositeOperation = 'copy';
      c.drawImage(SC.tex, 0, 0);
      c.globalCompositeOperation = 'destination-out';
      c.drawImage(SC.mask, 0, 0);
      c.globalCompositeOperation = 'source-over';
    });
  }
  // the carried coin moved over the open logbook: x, y = where its edge touches (screen), speed in px per ms
  function scScrape(x, y, speed) {
    const reach = SC.live && SC.live(); // set by openLog: the foil copy showing right now (none mid-turn or covered)
    const cv = reach && reach.find((c) => { const r = c.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; });
    if (!cv) { scLift(); return; }
    const r = cv.getBoundingClientRect(), k = SC_W / r.width;
    const px = (x - r.left) * k, py = (y - r.top) * SC_H / r.height, rad = 9 * k;
    const c = SC.mask.getContext('2d');
    const bare = c.getImageData(Math.min(SC_W - 1, px | 0), Math.min(SC_H - 1, py | 0), 1, 1).data[3] > 200; // already scraped here
    c.fillStyle = c.strokeStyle = '#000';
    c.lineCap = c.lineJoin = 'round';
    c.lineWidth = rad * 2;
    const l = SC.last && SC.last.cv === cv ? SC.last : { px, py };
    c.beginPath(); c.moveTo(l.px, l.py); c.lineTo(px, py); c.stroke();
    for (let i = 0; i < 3; i++) { // ragged edges, the foil tears unevenly
      c.beginPath();
      c.arc(px + (Math.random() - 0.5) * rad * 2.3, py + (Math.random() - 0.5) * rad * 2.3, rad * (0.2 + Math.random() * 0.35), 0, 7);
      c.fill();
    }
    SC.last = { cv, px, py };
    scRender();
    scCheck(cv);
    if (site.coin) site.coin.el.classList.add('foil');
    try { ui.foilMove(speed, bare); } catch (err) {}
    if (!bare) scFlakes(x, y, speed);
  }
  // Leaker achievement: a secret code counts as found once the foil over its whole line is scraped off (each line of
  // .sc-txt is one code; the line's text box, measured on the copy just scraped, must be at least SC_READ bare)
  const SC_READ = 0.9;
  let scFound = false, scCheckT = 0;
  function scCheck(cv) {
    const now = performance.now();
    if (scFound || now - scCheckT < 120) return;
    scCheckT = now;
    const txt = $('.sc-txt', cv.parentNode);
    if (!txt) return;
    const r = cv.getBoundingClientRect(), kx = SC_W / r.width, ky = SC_H / r.height, c = SC.mask.getContext('2d');
    const read = [...txt.childNodes].filter((n) => n.nodeType === 3 && n.data.trim()).some((n) => {
      const rg = document.createRange();
      rg.selectNodeContents(n);
      const b = rg.getBoundingClientRect();
      const x0 = Math.max(0, Math.floor((b.left - r.left) * kx)), y0 = Math.max(0, Math.floor((b.top - r.top) * ky));
      const x1 = Math.min(SC_W, Math.ceil((b.right - r.left) * kx)), y1 = Math.min(SC_H, Math.ceil((b.bottom - r.top) * ky));
      if (x1 - x0 < 2 || y1 - y0 < 2) return false;
      const d = c.getImageData(x0, y0, x1 - x0, y1 - y0).data;
      let bare = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 200) bare++;
      return bare / (d.length / 4) >= SC_READ;
    });
    if (read) { scFound = true; document.dispatchEvent(new CustomEvent('reko:codes-read')); }
  }
  // the coin left the foil (or was let go)
  function scLift() {
    SC.last = null;
    if (site.coin) site.coin.el.classList.remove('foil');
    try { ui.foilStop(); } catch (err) {}
  }
  // little silver flakes of foil curling off the coin's edge and falling away
  function scFlakes(x, y, speed) {
    const now = performance.now();
    if (reduceMotion || now - SC.t < 28) return;
    SC.t = now;
    const n = 1 + Math.floor(Math.random() * Math.min(3, 1 + speed * 2));
    for (let i = 0; i < n; i++) {
      const f = document.createElement('i'), s = 2 + Math.random() * 4.5;
      f.className = 'sc-flake';
      f.style.cssText = `left:${(x + (Math.random() - 0.5) * 16).toFixed(1)}px;top:${(y + (Math.random() - 0.5) * 8).toFixed(1)}px;width:${s.toFixed(1)}px;height:${(s * (0.45 + Math.random() * 0.6)).toFixed(1)}px`;
      document.body.appendChild(f);
      const dx = (Math.random() - 0.5) * 80, up = 8 + Math.random() * 26, dy = 40 + Math.random() * 70, rot = (Math.random() - 0.5) * 900;
      f.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${(dx * 0.45).toFixed(1)}px,${-up.toFixed(1)}px) rotate(${(rot * 0.4).toFixed(0)}deg)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) rotate(${rot.toFixed(0)}deg)`, opacity: 0 },
      ], { duration: 520 + Math.random() * 420, easing: 'cubic-bezier(.3,.6,.6,1)' }).finished.then(() => f.remove(), () => f.remove());
    }
  }
  let logRead = false;
  function openLog(log) {
    const arr = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
    const paper = (n, side) => `<div class="lb-face lb-paper lb-${side}">${lbPage(LB_PAGES[n - 1])}<span class="lb-pn">${n}</span></div>`;
    let leaves = '<div class="lb-leaf lb-cover"><div class="lb-face lb-front lb-cv"><span class="lb-spine"></span><span class="lb-lbl">Logbook</span>'
      + '<span class="lb-lines"><i></i><i></i><i></i><i></i></span></div><div class="lb-face lb-back lb-inside">' + LB_INSIDE + '</div></div>';
    for (let i = 1; i < LB_LEAVES; i++) leaves += `<div class="lb-leaf">${paper(2 * i - 1, 'front')}${paper(2 * i, 'back')}</div>`;
    const lb = document.createElement('div');
    lb.className = 'lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Geocache logbook');
    lb.innerHTML = '<svg class="lb-defs" width="0" height="0" aria-hidden="true"><filter id="lbInk" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="2" seed="4" result="w"/><feDisplacementMap in="SourceGraphic" in2="w" scale="2.2" xChannelSelector="R" yChannelSelector="G" result="d"/><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="9" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.4 0 0 0 1.95" result="m"/><feComposite in="d" in2="m" operator="in"/></filter><filter id="lbRk" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 .77  0 0 0 0 .29  0 0 0 0 .03  0 0 0 1 0"/></filter></svg><div class="lb-dim"></div><div class="lb-stage"><div class="lb-book shut"><div class="lb-board">' + LB_END + '</div>' + leaves + '</div>'
      + '<button class="lb-arr lb-prev" type="button" aria-label="Previous page">' + arr('M15 5l-7 7 7 7') + '</button>'
      + '<button class="lb-arr lb-next" type="button" aria-label="Next page">' + arr('M9 5l7 7-7 7') + '</button>'
      + '<button class="lb-x" type="button" aria-label="Close the logbook">' + arr('M6 6l12 12M18 6L6 18') + '</button></div>';
    scInit();
    document.body.appendChild(lb);
    scRender();
    const stage = $('.lb-stage', lb), book = $('.lb-book', lb), L = $$('.lb-leaf', lb), prev = $('.lb-prev', lb), next = $('.lb-next', lb);
    let page = 0, busy = false, closing = false;
    // stacking: leaves still on the right, the top one first; leaves turned to the left, the last turned one on top
    const z = () => L.forEach((l, i) => { if (!l._turning) l.style.zIndex = i < page ? i + 1 : 2 * LB_LEAVES - i; });
    const ui2 = () => { prev.disabled = page === 0; next.disabled = page === LB_LEAVES; book.classList.toggle('shut', page === 0); };
    z(); ui2();
    function turn(d) {
      if (busy || closing) return;
      const to = page + d;
      if (to < 0 || to > LB_LEAVES) return;
      const leaf = L[d > 0 ? page : to];
      busy = true;
      leaf._turning = true;
      leaf.style.zIndex = 3 * LB_LEAVES;
      try { ui.play('pageTurn', leaf.classList.contains('lb-cover')); } catch (err) {}
      leaf.classList.toggle('flip', d > 0);
      page = to; ui2();
      setTimeout(() => { busy = false; }, reduceMotion ? 0 : 380);
      setTimeout(() => { leaf._turning = false; z(); }, reduceMotion ? 0 : 760);
    }
    // the stage's transform that puts the closed book exactly over the sticker on the map
    const fromLog = () => {
      const r = log.getBoundingClientRect(), b = $('.lb-cover', lb).getBoundingClientRect();
      // the cover's own (unrotated) width: the sticker is turned 12deg, so its box is a bit wider than it
      const w = r.width / (Math.cos(Math.PI / 15) + Math.sin(Math.PI / 15) * 70 / 60);
      return `translate(${r.left + r.width / 2 - (b.left + b.width / 2)}px,${r.top + r.height / 2 - (b.top + b.height / 2)}px) rotate(12deg) scale(${(w / b.width).toFixed(4)})`;
    };
    const t0 = fromLog();
    log.style.visibility = 'hidden';
    requestAnimationFrame(() => lb.classList.add('on'));
    try { ui.play('logOpen'); } catch (err) {}
    if (!reduceMotion) stage.animate([{ transform: t0 }, { transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)' });
    const back = document.activeElement;
    $('.lb-x', lb).focus({ preventScroll: true });
    if (!logRead) { logRead = true; document.dispatchEvent(new CustomEvent('reko:log-read')); }
    async function close() {
      if (closing) return;
      closing = true;
      // close the book first (the turned leaves fall back, quickly, one after another), then it shrinks back onto the map
      if (page > 0 && !reduceMotion) {
        const n = page;
        book.classList.add('fast');
        for (let i = n - 1; i >= 0; i--) {
          const leaf = L[i];
          setTimeout(() => { leaf._turning = true; leaf.style.zIndex = 3 * LB_LEAVES + n - i; leaf.classList.remove('flip'); if (i === 0) book.classList.add('shut'); }, (n - 1 - i) * 70);
        }
        try { ui.play('pageTurn', false); } catch (err) {}
        await new Promise((res) => setTimeout(res, (n - 1) * 70 + 420));
      }
      L.forEach((l) => l.classList.remove('flip'));
      page = 0;
      book.classList.add('shut');
      try { ui.play('logClose'); } catch (err) {}
      lb.classList.remove('on');
      if (!reduceMotion) await stage.animate([{ transform: 'none' }, { transform: fromLog() }], { duration: 480, easing: 'cubic-bezier(.5,0,.75,.4)', fill: 'forwards' }).finished.catch(() => {});
      log.style.visibility = '';
      lb.remove();
      SC.live = null;
      scLift();
      document.removeEventListener('keydown', key, true);
      if (back && back.isConnected) back.focus({ preventScroll: true });
    }
    function key(e) {
      if (zoom) { // a zoomed paper: Enter / Space put it back, nothing else reaches the book
        if (e.key === 'Enter' || e.key === ' ') { e.stopImmediatePropagation(); zoom.close(); }
        if (e.key !== 'Tab') e.preventDefault();
        return;
      }
      if (e.key === 'ArrowRight') { e.preventDefault(); turn(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); turn(-1); }
      else if (e.key === 'Tab') { // keep the keyboard inside the logbook
        const f = [prev, next, $('.lb-x', lb), ...(page === 1 ? $$('.lb-inside .lb-zoomable', lb) : page === LB_LEAVES ? $$('.lb-board .lb-zoomable', lb) : [])].filter((b) => !b.disabled), i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    }
    document.addEventListener('keydown', key, true);
    prev.addEventListener('click', () => turn(-1));
    next.addEventListener('click', () => turn(1));
    $('.lb-x', lb).addEventListener('click', close);
    // the papers glued inside the cover (the printed note, the geocache card) zoom up on a click, the same way the
    // logbook did; a click anywhere puts them back
    let zoom = null;
    function zoomIn(el) {
      if (zoom || busy || closing || page !== (el.closest('.lb-board') ? LB_LEAVES : 1)) return; // inside the front cover / the back cover
      const r = el.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
      const k = Math.min(innerWidth * .92 / w, innerHeight * .86 / h, 3.4);
      const z = document.createElement('div');
      z.className = 'lb-zoom';
      const c = el.cloneNode(true);
      c.removeAttribute('tabindex');
      c.removeAttribute('role');
      c.removeAttribute('aria-label');
      // fixed sizes: the copy sits in the whole screen now, so its % padding would grow
      c.style.cssText = `left:50%;top:50%;right:auto;bottom:auto;box-sizing:border-box;width:${w}px;height:${h}px;padding:${getComputedStyle(el).padding};margin:${-h / 2}px 0 0 ${-w / 2}px;rotate:none`;
      z.appendChild(c);
      lb.appendChild(z);
      scRender(); // a copied canvas is blank: draw the scratch foil on it
      const from = `translate(${(r.left + r.width / 2 - innerWidth / 2).toFixed(1)}px,${(r.top + r.height / 2 - innerHeight / 2).toFixed(1)}px) rotate(${parseFloat(getComputedStyle(el).rotate) || 0}deg) scale(1)`;
      const to = `translate(0px,0px) rotate(0deg) scale(${k.toFixed(3)})`;
      c.style.transform = to;
      el.style.visibility = 'hidden';
      requestAnimationFrame(() => z.classList.add('on'));
      try { ui.play('paperUp'); } catch (err) {}
      if (!reduceMotion) c.animate([{ transform: from }, { transform: to }], { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)' });
      let out = false;
      zoom = {
        async close() {
          if (out) return;
          out = true;
          try { ui.play('paperDown'); } catch (err) {}
          z.classList.remove('on');
          if (!reduceMotion) await c.animate([{ transform: to }, { transform: from }], { duration: 400, easing: 'cubic-bezier(.5,0,.75,.4)', fill: 'forwards' }).finished.catch(() => {});
          el.style.visibility = '';
          z.remove();
          zoom = null;
          el.focus({ preventScroll: true });
        },
      };
      z.addEventListener('click', () => zoom && zoom.close());
    }
    // which copy of the scratch foil the coin can reach right now: the zoomed one, or the one in the book (at its end)
    SC.live = () => {
      if (closing || !lb.isConnected) return null;
      if (zoom) return $$('.lb-zoom .sc-foil', lb);
      return page === LB_LEAVES && !busy ? $$('.lb-board .sc-foil', lb) : null;
    };
    $$('.lb-zoomable', lb).forEach((el) => {
      el.addEventListener('click', (e) => { e.stopPropagation(); zoomIn(el); });
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); zoomIn(el); } });
    });
    // clicking the pages themselves turns them too: the right half forward, the left half back
    book.addEventListener('click', (e) => { const r = book.getBoundingClientRect(); turn(page === 0 || e.clientX > r.left + r.width / 2 ? 1 : -1); });
  }
});
