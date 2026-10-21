/* rekosk.dev: achievements: the list (ACH), progress saved as reko-ach, the window, toasts and what unlocks them */
'use strict';

rekoSite.part((site) => {
  const { $, $$, root, reduceMotion, ui, achWin } = site;
  site.share({ ach: () => ach });

  /* ---------- achievements ----------
     Each one: id, name, rarity, img, hint, and done = the text that replaces the hint once
     it's completed. Completions are kept in localStorage as { id: timestamp }, so they survive
     a reload. Unlock one with ach.unlock('id').
     Upgrade sequences: an item { chain: 'id', label: 'Fishing' (shown on its card, default "Upgrades"), steps: [ ...achievements ] } shows as ONE head; its steps can only be
     completed in order (unlock() ignores a step while the one before it isn't done). The head shows the next step's
     picture with a partial ring for progress and how many are left; its card lists every step with → between them,
     the picked step's name, and all completed steps' texts (picked one highlighted).
     Upgrade paths: the same item with paths: true branches instead of running in one line. Each step but the first names
     the step it comes after with after: 'id' (several steps can come after the same one); a step can only be completed
     once that one is. The card draws the steps as a tree, left to right, with elbow arrows into every branch.
     Locked achievements: an item with when: 'id' (another achievement) and whenText stays locked until that one is
     completed: its head shows the lock (darker than common), its card shows the name, "Locked" as the rarity and whenText
     instead of the hint, and it sorts after legendary. Doing its "what" anyway still completes it like any other.
     A step of a sequence / path can be locked the same way; when that's the first step, the whole head shows the lock. */
  const ACH_KEY = 'reko-ach';
  const RARITY = { common: 'Common', rare: 'Rare', superrare: 'Super rare', epic: 'Epic', legendary: 'Legendary' };
  const RANK = Object.keys(RARITY); // section rows are sorted by this: common → legendary
  const ACH = [
    { sec: 'General', items: [
      { id: 'gen-skip', name: 'Skip the intro', rarity: 'common', img: 'assets/ach/skip-intro.svg',
        hint: 'Pretty self-explanatory, huh?', done: 'Come on, you know how long it took to create that?' }
    ] },
    { sec: 'Pilot', items: [
      { id: 'pilot-first', name: 'First interaction', rarity: 'common', img: 'assets/ach/first-interaction.svg',
        hint: 'Change my name into my logo (by hovering your cursor on it).', done: '...or is it?' },
      { id: 'pilot-blink', name: 'Flirt-blink', rarity: 'rare', img: 'assets/ach/flirt-blink.svg',
        hint: 'Make my logo blink on you.', done: '*flirting amplifies*' }
    ] },
    { sec: 'About me', items: [
      { chain: 'about-sign', label: 'Don\'t drag it', paths: true, steps: [
        { id: 'about-drag', name: 'You shouldn\'t have drag that', rarity: 'common', img: 'assets/ach/dont-drag.svg',
          hint: 'Don\'t drag it!!! ...or do?', done: '...what will be the consequences?' },
        { id: 'about-fall', after: 'about-drag', name: 'You could have hit someone!', rarity: 'superrare', img: 'assets/ach/sign-fall.svg',
          hint: 'Make the item that SHALL NOT BE DRAGGED fall off the screen.', done: 'Let\'s just hope nobody got hurt...' },
        { id: 'about-crack', after: 'about-drag', name: 'Professional demolisher', rarity: 'epic', img: 'assets/ach/crack.svg',
          hint: 'How do you achieve a bigger impact?', done: 'Great, you damaged something I worked so long on. >:(' }
      ] },
      { id: 'about-plane', name: 'Paper can fly?', rarity: 'rare', img: 'assets/ach/paper-plane.svg',
        hint: 'Make paper plane fly.', done: 'School didn\'t teach us that. School breaks did.' },
      { id: 'about-lucka', name: 'My girlfriend <3', rarity: 'rare', img: 'assets/ach/heart.svg',
        hint: 'Type out her name', done: 'Yep, that\'s her :D.' },
      { id: 'about-heart', name: 'You\'re NOT filled with determination.', rarity: 'rare', img: 'assets/ach/heart-broken.svg',
        hint: 'Kill it.', done: 'Sans would be proud.' },
      { id: 'about-black', name: 'Black logo', rarity: 'legendary', img: 'assets/ach/black-logo.svg',
        hint: 'There is a orange logo somewhere in this section. Make it black.', done: 'Still like the orange one better.' },
      { id: 'about-load', name: 'Low PC', rarity: 'rare', img: 'assets/ach/loaded.svg',
        hint: 'Help the progress bar load to 100%.', done: 'Finally, it loaded!' },
      { id: 'about-world', name: 'Hello world!', rarity: 'common', img: 'assets/ach/hello-world.svg',
        hint: 'Finish the phrase', done: 'Every programmer\'s first words.' },
      { id: 'about-blink', name: 'Blinker', rarity: 'epic', img: 'assets/ach/blinker.svg',
        hint: 'Make it blink... a lot of times.', done: 'So blinking is now a competition, huh?' },
      { id: 'about-fetch', name: 'Fetcher', rarity: 'superrare', img: 'assets/ach/arch-fetch.svg',
        hint: 'Fetch my data in the terminal, with one of the two most known command for fetching data of a Linux distribution, among Linux users.',
        done: 'I use arch btw.' },
      { id: 'about-grandpa', name: 'Grandpa', rarity: 'rare', img: 'assets/ach/magnifier.svg',
        hint: 'Zoom in on the smallest letters in this section.', done: 'Maybe you should buy a pair of glasses...',
        when: 'about-fetch', whenText: 'Unlock other achievement in this section first...' },
      { id: 'about-spy', name: 'Background check', rarity: 'superrare', img: 'assets/ach/spy.svg',
        hint: 'Zoom in on something I don\'t like.', done: 'You have to know everything about your enemy before you can fight him!' },
      { id: 'about-shutdown', name: 'Shutdown', rarity: 'rare', img: 'assets/ach/shutdown.svg',
        hint: 'Type a command to shutdown the "computer" in the terminal.', done: 'Great... when you have a physical turn on button :D.' },
      { id: 'about-reboot', name: 'Reboot', rarity: 'rare', img: 'assets/ach/reboot.svg',
        hint: 'Type a command to reboot the "computer" in the terminal.', done: 'Well, at least it turned back on by itself...' },
      { id: 'about-french', name: 'Removing the french language', rarity: 'superrare', img: 'assets/ach/french.svg',
        hint: 'Type into chat the command to delete a whole OS. How do you do that without sudo permissions tho..?',
        done: 'Are you sure you\'re ONLY removing the french???' },
      { id: 'about-rails', name: 'Railway builder', rarity: 'superrare', img: 'assets/ach/minecart.svg',
        hint: 'The cart should never fall off the railway track, but it should also keep moving indefinitely.',
        done: 'The cart won\'t get anywhere tho...', when: 'off-bh-leak', whenText: 'Acquire secret codes for the terminal first...' },
      { chain: 'about-boss', label: 'Bossfight', paths: true, steps: [
        { id: 'about-boss-start', name: 'The beginning', rarity: 'rare', img: 'assets/ach/boss-start.svg',
          hint: 'Use the secret code...', done: 'Can you win against me tho >:) ?',
          when: 'off-bh-leak', whenText: 'Acquire secret codes for the terminal first...' },
        { id: 'about-boss-spare', after: 'about-boss-start', name: 'Yay, a draw!', rarity: 'legendary', img: 'assets/ach/boss-spare.svg',
          hint: 'Spare me. Please.', done: 'And we lived in peace forever after! (or at least until you clicked play again...)' },
        { id: 'about-boss-flee', after: 'about-boss-start', name: 'Where are you going?', rarity: 'superrare', img: 'assets/ach/boss-flee.svg',
          hint: 'Flee the fight.', done: 'Bro, why would you start a fight, when you don\'t end it..?' },
        { id: 'about-boss-betray', after: 'about-boss-start', name: 'Backstabber', rarity: 'legendary', img: 'assets/ach/boss-betray.svg',
          hint: 'Kill me at my lowest... (please don\'t)', done: ':(' },
        { id: 'about-boss-kill', after: 'about-boss-start', name: 'Deleted', rarity: 'legendary', img: 'assets/ach/boss-kill.svg',
          hint: 'Kill me. Don\'t give me chance to ask for mercy.', done: 'Yeah, I didn\'t stand a chance. Well played!' },
        { id: 'about-boss-rematch', after: 'about-boss-kill', name: 'Rematch', rarity: 'legendary', img: 'assets/ach/boss-rematch.svg',
          hint: 'Win it two for two.', done: 'Now you\'re just showing off.' }
      ] }
    ] },
    { sec: 'When I\'m offline...', items: [
      { id: 'off-grass', name: 'Touch grass', rarity: 'common', img: 'assets/ach/grass.svg',
        hint: 'Yeah... just touch it.', done: 'Great, now you\'re ready to do it IRL!' },
      { id: 'off-bear', name: 'RUN BEAR, RUN!!!!', rarity: 'superrare', img: 'assets/ach/bear.svg',
        hint: 'Watch the bear catch his dinner.', done: 'After that run, it must have been delicious.' },
      { id: 'off-crow', name: 'Air strike', rarity: 'superrare', img: 'assets/ach/crow.svg',
        hint: 'Give crow a dinner.', done: 'Gotta also watch above us these days...' },
      { id: 'off-ants', name: 'Not-so-peaceful meadow', rarity: 'superrare', img: 'assets/ach/ants.svg',
        hint: 'Feed the ants.', done: 'So small, yet so powerful...' },
      { id: 'off-walk', name: 'FISH CAN WALK?!', rarity: 'rare', img: 'assets/ach/fish-walk.svg',
        hint: 'Yeah, make them walk...', done: 'Okay, that REALLY wasn\'t on my bingo card...' },
      { id: 'off-golden', name: 'A golden dinner', rarity: 'epic', img: 'assets/ach/golden-dinner.svg',
        hint: 'Feed anything with the golden fish.', done: 'Does gold even taste good?' },
      { id: 'off-mute', name: 'Those annoying fishes', rarity: 'epic', img: 'assets/ach/fish-mute.svg',
        hint: 'Mute the fishes with a mute icon.', done: 'Those sounds can get annoying really quickly...' },
      { id: 'off-me', name: 'Yeah, that\'s me!', rarity: 'superrare', img: 'assets/ach/circle-me.svg',
        hint: 'Circle me on every photo.', done: 'You might wonder how I got into these situations...' },
      { chain: 'off-fish', label: 'Fishing', steps: [
        { id: 'off-fish-s', name: 'Small fish', rarity: 'common', img: 'assets/ach/fish-small.svg',
          hint: 'Catch a small fish.', done: 'Great! ...for starters.' },
        { id: 'off-fish-m', name: 'Medium fish', rarity: 'rare', img: 'assets/ach/fish-medium.svg',
          hint: 'Catch a medium-sized fish.', done: 'Oh an upgrade, nice!' },
        { id: 'off-fish-l', name: 'Large fish', rarity: 'epic', img: 'assets/ach/fish-large.svg',
          hint: 'Catch a large-sized fish.', done: 'That\'s huge!' },
        { id: 'off-fish-g', name: 'Golden fish', rarity: 'legendary', img: 'assets/ach/fish-golden.svg',
          hint: 'Catch the rarest golden fish.',
          done: 'A GOLD FISH?! Wow, you actually outdone yourself this time. Congratulations! Now the question is, what will you do with it...?' }
      ] },
      { chain: 'off-bh', label: 'Birdhouse', paths: true, steps: [
        { id: 'off-bh-open', name: 'Glitched opening', rarity: 'epic', img: 'assets/ach/glitched-opening.svg',
          hint: 'Open a birdhouse.', done: 'You know break-ins are illegal, right?' },
        { id: 'off-bh-mech', after: 'off-bh-open', name: 'Mechanic', rarity: 'legendary', img: 'assets/ach/mechanic.svg',
          hint: 'Fix the compass.', done: 'That was, indeed, a tricky one!' },
        { id: 'off-bh-dig', after: 'off-bh-open', name: 'Digger', rarity: 'legendary', img: 'assets/ach/digger.svg',
          hint: 'Dig out a treasure.', done: 'Btw, burying a cache is against the rules in geocaching...' },
        { id: 'off-bh-read', after: 'off-bh-dig', name: 'Reader', rarity: 'rare', img: 'assets/ach/reader.svg',
          hint: 'Read the logbook.', done: 'There might be some useful stuff in here...' },
        { id: 'off-bh-leak', after: 'off-bh-read', name: 'Leaker', rarity: 'legendary', img: 'assets/ach/leaker.svg',
          hint: 'Find secret codes in the logbook.', done: 'These were hidden for a purpose...',
          when: 'soc-scroll', whenText: 'Unlock other achievement in the section "Social Media" first...' }
      ] }
    ] },
    { sec: 'Social media', items: [
      { id: 'soc-scroll', name: 'Scroller', rarity: 'common', img: 'assets/ach/scroller.svg',
        hint: 'Scroll through all of the reels.', done: 'You can continue on my instagram/ytb ;).' }
    ] },
    { sec: 'Projects', items: [
      { id: 'proj-dj', name: 'DJ', rarity: 'rare', img: 'assets/ach/dj-disc.svg',
        hint: 'Scratch (a CD), like a DJ.', done: 'DJ, throw in some of that dance-pop for me!' }
    ] },
    { sec: 'School', items: [] },
    { sec: 'Contact me', items: [] }
  ];
  const itemRarity = (it) => (it.steps ? it.steps[0] : it).rarity; // an upgrade sequence sorts by its first step
  ACH.forEach((s) => s.items.sort((a, b) => RANK.indexOf(itemRarity(a)) - RANK.indexOf(itemRarity(b)))); // stable: same rarity keeps list order
  const achById = {}, chainById = {};
  ACH.forEach((s) => s.items.forEach((it) => {
    if (!it.steps) { achById[it.id] = it; return; }
    chainById[it.chain] = it;
    it.steps.forEach((a, i) => { a._chain = it; a._i = i; achById[a.id] = a; });
  }));
  // the step that has to be done first: the one before it, or (upgrade paths) the one named in after
  Object.values(chainById).forEach((c) => c.steps.forEach((a, i) => { a._prev = c.paths ? (a.after ? achById[a.after] : null) : (i ? c.steps[i - 1] : null); }));

  const ach = (() => {
    let done = {};
    try { done = JSON.parse(localStorage.getItem(ACH_KEY)) || {}; } catch (err) { /* storage blocked */ }
    const save = () => {
      try { localStorage.setItem(ACH_KEY, JSON.stringify(done)); } catch (err) { return; } // storage blocked
      if (Object.keys(done).length) document.dispatchEvent(new CustomEvent('reko:saved')); // the save-file notice pops up on the first one
    };
    const view = achWin && $('.win-view', achWin);
    const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const fmt = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const LAMP = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/><path class="ach-ray" d="M2.5 9H4M20 9h1.5M4.6 3.1l1.1 1.1M19.4 3.1l-1.1 1.1"/></svg>';
    const RESET_ICO = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8"/><path d="M3 3v5h5"/></svg>';
    const CHECK = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
    const LOCK = '<svg class="ach-lock" viewBox="0 0 24 24" aria-hidden="true"><path class="lk-shackle" d="M8 11V8a4 4 0 0 1 8 0v3"/><rect class="lk-body" x="5" y="11" width="14" height="10" rx="2.2"/><path class="lk-hole" d="M12 15v2.4"/></svg>';
    const ARROW = '<svg class="ach-arr" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>';
    // a step can be tried once the step it comes after is done
    const reachable = (a) => !a._prev || !!done[a._prev.id];
    // a locked achievement (when: 'id') that isn't revealed yet: the one it waits for isn't done, and neither is it
    const locked = (a) => !!a.when && !done[a.when] && !done[a.id];
    // a whole sequence / path is sealed the same way while its first step is locked (nothing in it can be done before that)
    const sealed = (a) => locked(a.steps ? a.steps[0] : a);
    // a step of a sequence / path can be locked the same way (when: 'id'): once reachable it shows the dark lock, can be
    // picked, and its card shows "Locked" and whenText instead of the rarity and the hint
    // upgrade sequences / paths: how far along, which step is "next" (the first one unlocked to try, the last one once
    // all are done) and which was completed most recently
    const chainState = (c) => {
      const got = c.steps.filter((a) => done[a.id]), n = got.length;
      const next = c.steps.find((a) => !done[a.id] && reachable(a)) || c.steps[c.steps.length - 1];
      const last = n ? got.reduce((x, y) => (done[y.id] >= done[x.id] ? y : x)) : null;
      return { n, total: c.steps.length, all: n === c.steps.length, next, last };
    };
    // upgrade paths: every step's column (how many steps before it) and row; a branch takes the next free row,
    // a step sits in the row of its first branch. Worked out once per path.
    const TREE = { S: 44, CX: 80, RY: 58, P: 8, W: 272 }; // W: the widest tree that fits the 300px card (picked step scaled up included)
    // the gap between columns: TREE.CX, tighter for a long path, so every column still fits the card
    const treeCX = (c) => { const m = Math.max(...Object.values(treePos(c)).map((p) => p.col)); return m ? Math.min(TREE.CX, Math.floor((TREE.W - 2 * TREE.P - TREE.S) / m)) : TREE.CX; };
    const treePos = (c) => {
      if (c._pos) return c._pos;
      const kids = {}, pos = {};
      let row = 0;
      c.steps.forEach((a) => { if (a._prev) (kids[a._prev.id] = kids[a._prev.id] || []).push(a); });
      const place = (a, col) => {
        const ks = kids[a.id] || [];
        ks.forEach((k) => place(k, col + 1));
        pos[a.id] = { col, row: ks.length ? pos[ks[0].id].row : row++, kids: ks };
      };
      c.steps.filter((a) => !a._prev).forEach((a) => place(a, 0));
      return (c._pos = pos);
    };
    // the tree's arrows: straight into a branch in the same row, else out, down the shared line and across (an elbow)
    function treeSVG(c, w, h) {
      const pos = treePos(c), { S, RY, P } = TREE, CX = treeCX(c), G = 7, H = 4.5;
      const cy = (p) => P + p.row * RY + S / 2;
      let d = '', lit = '';
      c.steps.forEach((a) => {
        const p = pos[a.id];
        if (!p.kids.length) return;
        const x1 = P + p.col * CX + S + G, x2 = P + (p.col + 1) * CX - G, xm = (x1 + x2) / 2, y1 = cy(p);
        const yMax = Math.max(...p.kids.map((k) => cy(pos[k.id])));
        let path = `M${x1} ${y1}H${xm}` + (yMax > y1 ? `V${yMax}` : '');
        p.kids.forEach((k) => { const y = cy(pos[k.id]); path += `M${xm} ${y}H${x2}M${x2 - H} ${y - H}L${x2} ${y}L${x2 - H} ${y + H}`; });
        if (done[a.id]) lit += path; else d += path;
      });
      return `<svg class="ach-tree-ln" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">` +
        (d ? `<path d="${d}"/>` : '') + (lit ? `<path class="on" d="${lit}"/>` : '') + '</svg>';
    }

    // one head for a whole upgrade sequence: next step's picture, a ring lit as far as you've got, steps left in the badge
    function chainHead(c) {
      if (sealed(c)) return `<button class="ach-head ach-sealed" type="button" data-chain="${c.chain}" data-key="chain:${c.chain}" aria-label="${esc(c.label || 'Upgrades')}, locked" aria-haspopup="dialog">${LOCK}<span class="ach-dot" aria-hidden="true"></span></button>`;
      const st = chainState(c), r = (st.last || c.steps[0]).rarity;
      const cls = `ach-head ach-chain r-${r}${st.all ? ' got' : ''}${st.n && !st.all ? ' prog' : ''}`;
      const dot = st.n && !st.all ? `<span class="ach-dot num" aria-hidden="true">${st.total - st.n}</span>` : '<span class="ach-dot" aria-hidden="true"></span>';
      return `<button class="${cls}" type="button" data-chain="${c.chain}" data-key="chain:${c.chain}" style="--p:${(st.n / st.total).toFixed(3)}" ` +
        `aria-label="${esc(c.steps[0].name)} upgrades, ${st.n} of ${st.total} completed" aria-haspopup="dialog"><img src="${(locked(st.next) ? st.last || c.steps[0] : st.next).img}" alt="" draggable="false">${dot}</button>`;
    }

    function render() {
      if (!view) return;
      const all = Object.keys(achById).length;
      const got = Object.keys(done).filter((id) => achById[id]).length;
      const pct = all ? (got / all) * 100 : 0;
      view.innerHTML =
        `<div class="ach-wrap"><div class="ach-top"><span class="ach-top-n"><b>${got}</b> / ${all} completed</span><span class="ach-bar"><i style="width:${pct}%"></i></span>` +
          `<button class="ach-reset" type="button"${got ? '' : ' disabled'}>${RESET_ICO}<span>Reset achievements</span></button></div>` +
        ACH.map((s) => {
          const list = s.items.flatMap((it) => it.steps || [it]); // every step of a sequence counts as one achievement
          const n = list.filter((a) => done[a.id]).length;
          return `<section class="ach-sec"><h3 class="ach-sec-t">${esc(s.sec)}${list.length ? `<span class="ach-sec-n">${n}/${list.length}</span>` : ''}</h3><div class="ach-row">` +
            (s.items.length ? '' : '<p class="ach-none">No achievements here yet.</p>') +
            s.items.slice().sort((x, y) => sealed(x) - sealed(y)).map((a) => (a.steps ? chainHead(a) : sealed(a) ?
              `<button class="ach-head ach-sealed" type="button" data-ach="${a.id}" data-key="${a.id}" aria-label="${esc(a.name)}, locked" aria-haspopup="dialog">${LOCK}<span class="ach-dot" aria-hidden="true"></span></button>` :
              `<button class="ach-head r-${a.rarity}${done[a.id] ? ' got' : ''}" type="button" data-ach="${a.id}" data-key="${a.id}" aria-label="${esc(a.name)}, ${RARITY[a.rarity]}, ${done[a.id] ? 'completed' : 'not completed'}" aria-haspopup="dialog"><img src="${a.img}" alt="" draggable="false"><span class="ach-dot" aria-hidden="true"></span></button>`)).join('') +
            '</div></section>';
        }).join('') + '</div>';
    }

    // the profile-style card that pops out next to a head
    const card = document.createElement('div');
    card.className = 'ach-card';
    card.setAttribute('role', 'dialog');
    card.hidden = true;
    root.appendChild(card);
    let cardFor = null, typer = 0;

    const headEl = (key) => key && view && $(`[data-key="${key}"]`, view);
    function closeCard() {
      if (card.hidden) return;
      clearInterval(typer);
      card.hidden = true;
      const head = headEl(cardFor);
      if (head) head.classList.remove('on');
      cardFor = null;
    }
    function placeCard(head) {
      const r = head.getBoundingClientRect(), cw = card.offsetWidth, ch = card.offsetHeight, m = 12;
      let x = r.right + m;
      if (x + cw > innerWidth - m) x = r.left - m - cw;            // no room on the right: flip left
      if (x < m) x = Math.max(m, Math.min(innerWidth - cw - m, r.left + r.width / 2 - cw / 2));
      let y = r.top - 20;
      y = Math.max(m, Math.min(innerHeight - ch - m, y));
      card.style.translate = `${x}px ${y}px`;
    }
    // open (or close, if it's already open) the card of a head in the grid: key = an achievement id or "chain:<id>"
    function openCard(key) {
      const head = headEl(key);
      if (!head) return;
      if (cardFor === key) { closeCard(); return; }
      closeCard();
      cardFor = key;
      head.classList.add('on');
      if (key.startsWith('chain:')) showChain(chainById[key.slice(6)]); else showAch(achById[key]);
      card.hidden = false;
      placeCard(head);
      try { ui.play('popIn'); } catch (err) {}
    }
    // the Hint button: "generates" (types out) the same fixed hint every time
    function wireHint(a) {
      const btn = $('.ach-hint-btn', card), box = $('.ach-hint', card), out = $('.ach-hint-t', card);
      if (!btn) return;
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        btn.disabled = true;
        card.classList.add('lit');
        box.hidden = false;
        box.classList.add('typing');
        const head = headEl(cardFor);
        if (head) placeCard(head);
        let i = 0;
        const step = () => {
          out.textContent = a.hint.slice(0, ++i);
          if (i % 3 === 0) try { ui.play('tick', 3200, 0.02); } catch (err) {}
          if (i >= a.hint.length) { clearInterval(typer); box.classList.remove('typing'); }
        };
        if (reduceMotion) { i = a.hint.length - 1; step(); } else typer = setInterval(step, 28);
      });
    }
    const hintHTML = () => `<button class="ach-hint-btn" type="button">${LAMP}<span>Hint</span></button><p class="ach-hint" hidden><span class="ach-hint-t"></span></p>`;
    // one achievement
    function showAch(a) {
      clearInterval(typer);
      const id = a.id;
      if (sealed(a)) { // locked: the lock for a picture, "Locked" for the rarity, what to do first instead of the hint
        card.className = 'ach-card ach-card-sealed';
        card.setAttribute('aria-label', `${a.name}, locked`);
        card.innerHTML =
          '<div class="ach-banner" aria-hidden="true"></div>' +
          `<div class="ach-av">${LOCK}<span class="ach-dot" aria-hidden="true"></span></div>` +
          `<div class="ach-body"><h4 class="ach-name">${esc(a.name)}</h4><span class="ach-rar">Locked</span>` +
          `<p class="ach-when">${LOCK}<span>${esc(a.whenText || 'Unlock something else first...')}</span></p></div>`;
        return;
      }
      card.className = `ach-card r-${a.rarity}${done[id] ? ' got' : ''}`;
      card.setAttribute('aria-label', a.name);
      card.innerHTML =
        '<div class="ach-banner" aria-hidden="true"></div>' +
        `<div class="ach-av"><img src="${a.img}" alt="" draggable="false"><span class="ach-dot" aria-hidden="true"></span></div>` +
        `<div class="ach-body"><h4 class="ach-name">${esc(a.name)}</h4><span class="ach-rar">${RARITY[a.rarity]}</span>` +
        (done[id] && a.done ? `<p class="ach-after">${esc(a.done)}</p>` : hintHTML()) +
        (done[id] ? `<p class="ach-done">${CHECK}Completed on ${fmt(done[id])}</p>` : '') +
        '</div>';
      wireHint(a);
    }
    // an upgrade sequence, all in one card: the steps' pictures with → between them (done ones and the next one can be
    // picked, the rest are locked), the picked step's name + rarity, and every completed step's text from the lowest
    // rarity to the highest, the picked one highlighted; a picked step that isn't done yet shows its Hint button instead
    function showChain(c, selId) {
      clearInterval(typer);
      const st = chainState(c);
      const stepBtn = (a, style) => (reachable(a) && locked(a)
        ? `<button class="ach-step sealed${a === sel ? ' sel' : ''}" type="button" data-step="${a.id}"${style} aria-pressed="${a === sel}" aria-label="${esc(a.name)}, locked">${LOCK}</button>`
        : reachable(a)
        ? `<button class="ach-step r-${a.rarity}${done[a.id] ? ' got' : ''}${a === sel ? ' sel' : ''}" type="button" data-step="${a.id}"${style} aria-pressed="${a === sel}" aria-label="${esc(a.name)}, ${RARITY[a.rarity]}, ${done[a.id] ? 'completed' : 'not completed'}"><img src="${a.img}" alt="" draggable="false"></button>`
        : `<button class="ach-step locked" type="button"${style} aria-disabled="true" aria-label="Locked: complete the one before it first">${LOCK}</button>`);
      // a sequence: one row with → between the steps; an upgrade path: a tree with elbow arrows into its branches
      const stepsHTML = () => {
        if (!c.paths) return '<div class="ach-steps">' + c.steps.map((a, i) => (i ? ARROW : '') + stepBtn(a, '')).join('') + '</div>';
        const pos = treePos(c), { S, RY, P } = TREE, CX = treeCX(c);
        const ps = Object.values(pos), w = P * 2 + Math.max(...ps.map((p) => p.col)) * CX + S, h = P * 2 + Math.max(...ps.map((p) => p.row)) * RY + S;
        return `<div class="ach-steps ach-tree" style="width:${w}px;height:${h}px">` + treeSVG(c, w, h) +
          c.steps.map((a) => stepBtn(a, ` style="left:${P + pos[a.id].col * CX}px;top:${P + pos[a.id].row * RY}px"`)).join('') + '</div>';
      };
      // where a step sits, for the swipe direction: further along (right, then down) swipes the content left
      const ord = (a) => (c.paths ? treePos(c)[a.id].col * 100 + treePos(c)[a.id].row : a._i);
      let sel = (selId && achById[selId] && reachable(achById[selId])) ? achById[selId] : st.next;
      const texts = c.steps.filter((a) => done[a.id] && a.done);
      const foot = (a) => (locked(a) ? `<p class="ach-when">${LOCK}<span>${esc(a.whenText || 'Unlock something else first...')}</span></p>`
        : done[a.id] ? `<p class="ach-done">${CHECK}Completed on ${fmt(done[a.id])}</p>` : hintHTML());
      const rar = (a) => (locked(a) ? 'Locked' : RARITY[a.rarity]);
      const setCardClass = () => { card.className = `ach-card ach-card-chain r-${sel.rarity}${done[sel.id] ? ' got' : ''}${locked(sel) ? ' ach-card-sealed' : ''}`; };
      setCardClass();
      card.setAttribute('aria-label', `${c.label || 'Upgrades'}: ${sel.name}`);
      card.innerHTML =
        '<div class="ach-banner" aria-hidden="true"></div>' +
        `<div class="ach-body"><span class="ach-ch-k">${esc(c.label || 'Upgrades')} · ${st.n} / ${st.total}</span>` +
        `<div class="ach-swap"><h4 class="ach-name">${esc(sel.name)}</h4><span class="ach-rar">${rar(sel)}</span></div>` +
        stepsHTML() +
        (texts.length ? '<div class="ach-texts">' + texts.map((a) => `<p class="ach-after r-${a.rarity}${a === sel ? ' sel' : ''}" data-for="${a.id}">${esc(a.done)}</p>`).join('') + '</div>' : '') +
        `<div class="ach-foot">${foot(sel)}</div>` +
        '</div>';
      const head = headEl(cardFor);
      if (head && !card.hidden) placeCard(head);
      wireHint(sel);
      // picking another step updates the card in place, so the rings, highlights and texts can animate
      const swap = $('.ach-swap', card), footEl = $('.ach-foot', card);
      let swipeT = 0;
      const pick = (a) => {
        if (a === sel) return;
        clearInterval(typer);
        clearTimeout(swipeT);
        const dir = ord(a) > ord(sel) ? 1 : -1; // picked one further along → the content swipes to the left (and back the other way)
        sel = a;
        setCardClass();
        card.setAttribute('aria-label', `${c.label || 'Upgrades'}: ${sel.name}`);
        $$('.ach-step[data-step]', card).forEach((b) => { const on = b.dataset.step === a.id; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', String(on)); });
        $$('.ach-texts .ach-after', card).forEach((t) => t.classList.toggle('sel', t.dataset.for === a.id));
        const fill = () => {
          $('.ach-name', swap).textContent = a.name;
          $('.ach-rar', swap).textContent = rar(a);
          footEl.innerHTML = foot(a);
          wireHint(a);
        };
        const banner = $('.ach-banner', card);
        banner.classList.remove('fade-in'); void banner.offsetWidth; banner.classList.add('fade-in');
        try { ui.play('swish'); } catch (err) {}
        if (reduceMotion) { fill(); return; }
        // swipe: the old name / rarity / bottom line slide out one way, the new ones slide in from the other side
        const D = 28, OUT = 130, IN = 220;
        [swap, footEl].forEach((el) => el.animate([{ translate: '0 0', opacity: 1 }, { translate: `${-dir * D}px 0`, opacity: 0 }], { duration: OUT, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }));
        swipeT = setTimeout(() => {
          fill();
          [swap, footEl].forEach((el) => {
            el.getAnimations().forEach((an) => an.cancel());
            el.animate([{ translate: `${dir * D}px 0`, opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: IN, easing: 'cubic-bezier(0,0,.2,1)' });
          });
        }, OUT);
      };
      $$('.ach-step[data-step]', card).forEach((b) => b.addEventListener('click', () => pick(achById[b.dataset.step])));
      // locked ones: they don't open, they turn red, shake and buzz
      $$('.ach-step.locked', card).forEach((b) => b.addEventListener('click', () => {
        b.classList.remove('deny'); void b.offsetWidth; b.classList.add('deny');
        try { ui.play('error'); } catch (err) {}
      }));
    }

    if (view) {
      view.addEventListener('click', (e) => { const h = e.target.closest('.ach-head'); if (h) openCard(h.dataset.key); });
      // reset: three clicks to really wipe everything (it cools back down if you wait)
      const RESET_STEPS = ['Reset achievements', 'Are you sure?', 'THINK ABOUT THIS!'];
      let resetStep = 0, resetTimer = 0;
      const setReset = (btn, n) => {
        resetStep = n;
        btn.classList.toggle('warn', n > 0);
        btn.classList.toggle('panic', n > 1);
        $('span', btn).textContent = RESET_STEPS[n];
        clearTimeout(resetTimer);
        if (n) resetTimer = setTimeout(() => { if (btn.isConnected) setReset(btn, 0); }, 4000);
      };
      view.addEventListener('click', (e) => {
        const btn = e.target.closest('.ach-reset');
        if (!btn || btn.disabled) return;
        if (resetStep < 2) {
          setReset(btn, resetStep + 1);
          try { ui.play(resetStep === 1 ? 'tick' : 'error'); } catch (err) {}
          return;
        }
        clearTimeout(resetTimer);
        resetStep = 0;
        try { ui.play('crash'); } catch (err) {}
        reset();
      });
      view.addEventListener('scroll', closeCard, { passive: true });
      document.addEventListener('pointerdown', (e) => { if (!card.hidden && !card.contains(e.target) && !e.target.closest('.ach-head')) closeCard(); });
      window.addEventListener('resize', closeCard);
      new MutationObserver(() => { if (achWin.hidden || achWin.classList.contains('closing') || achWin.classList.contains('moving') || achWin.classList.contains('sizing')) closeCard(); })
        .observe(achWin, { attributes: true, attributeFilter: ['hidden', 'class'] });
      render();
    }

    function unlock(id) {
      if (!achById[id] || done[id] || !reachable(achById[id])) return false; // a sequence's steps only in order
      done[id] = Date.now();
      save();
      closeCard();
      render();
      try { ui.play('ldDone'); } catch (err) {}
      toast(achById[id]);
      return true;
    }

    // "Achievement completed" pop-up, top right under the nav; click it to open the achievement
    const toasts = document.createElement('div');
    toasts.className = 'ach-toasts';
    toasts.setAttribute('aria-live', 'polite');
    root.appendChild(toasts);
    function toast(a) {
      const t = document.createElement('div');
      t.setAttribute('role', 'button');
      t.tabIndex = 0;
      t.className = `ach-toast r-${a.rarity}`;
      t.innerHTML =
        `<span class="ach-t-av"><img src="${a.img}" alt="" draggable="false"><span class="ach-dot" aria-hidden="true"></span></span>` +
        `<span class="ach-t-txt"><span class="ach-t-k">Achievement completed</span><b class="ach-t-n">${esc(a.name)}</b>` +
        (a.done ? `<span class="ach-t-d">${esc(a.done)}</span>` : '') +
        '</span><span class="ach-t-time" aria-hidden="true"></span>' +
        '<button class="ach-t-x" type="button" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg></button>';
      const bye = () => {
        if (t.classList.contains('out')) return;
        t.classList.add('out');
        setTimeout(() => t.remove(), 300);
      };
      // the timer bar runs down (paused while hovered), then the pop-up leaves
      $('.ach-t-time', t).addEventListener('animationend', bye);
      if (reduceMotion) setTimeout(bye, 6000);
      $('.ach-t-x', t).addEventListener('click', (e) => {
        e.stopPropagation();
        try { ui.play('tick'); } catch (err) {}
        bye();
      });
      t.addEventListener('keydown', (e) => { if (e.target === t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); t.click(); } });
      t.addEventListener('click', () => {
        bye();
        const link = $('[data-win="ach"]');
        if (link) link.click();
        const key = a._chain ? 'chain:' + a._chain.chain : a.id;
        if (cardFor !== key) openCard(key);
        if (a._chain) showChain(a._chain, a.id);
      });
      toasts.appendChild(t);
    }
    function reset() {
      done = {}; save(); closeCard(); render();
      try { localStorage.removeItem(site.NOTICE_KEY); } catch (err) { /* storage blocked */ } // the save-file notice pops up again on the next save
    }
    return { unlock, reset, isDone: (id) => !!done[id] };
  })();
  // Birdhouse upgrade path (off-bh): opening the birdhouse, then fixing the compass, or digging out the cache
  // (then reading its logbook: no trigger yet)
  document.addEventListener('reko:unlock', () => ach.unlock('off-bh-open'));
  document.addEventListener('reko:compass', () => ach.unlock('off-bh-mech'));
  document.addEventListener('reko:cache-found', () => ach.unlock('off-bh-dig'));
  document.addEventListener('reko:log-read', () => ach.unlock('off-bh-read'));
  // a secret code in the logbook's back cover scratched fully readable with the coin (scCheck fires reko:codes-read)
  document.addEventListener('reko:codes-read', () => ach.unlock('off-bh-leak'));
  // the nav's speaker icon dragged into the lake mutes the fish (the lake speaker code fires reko:lake-mute)
  document.addEventListener('reko:lake-mute', () => ach.unlock('off-mute'));
  // neofetch / fastfetch in the Linux box's terminal, once its output has finished typing out
  document.addEventListener('reko:fetch', () => ach.unlock('about-fetch'));
  // the magnifying glass held over a finished neofetch / fastfetch output (the magnifier code fires reko:mag-fetch)
  document.addEventListener('reko:mag-fetch', () => ach.unlock('about-grandpa'));
  // the magnifying glass held over the Python logo in the Programming languages box (reko:mag-python)
  document.addEventListener('reko:mag-python', () => ach.unlock('about-spy'));
  // paging the Social media reels down to the last page, "Find more here ;)" (the reels code fires reko:reels-end)
  document.addEventListener('reko:reels-end', () => ach.unlock('soc-scroll'));
  // Reko circled with the pencil on every "find the guy" photo in the map's waypoints (the photo code fires reko:found-all)
  document.addEventListener('reko:found-all', () => ach.unlock('off-me'));
  // the "sudo rm -rf /" sticker dropped into the Linux terminal: once the command is typed out and the first file is removed
  // (the terminal's rm -rf code fires reko:rmrf-run)
  document.addEventListener('reko:rmrf-run', () => ach.unlock('about-french'));
  // duhel_railways.run: the minecart's first full lap of the 8-rail ring around the torch (the minigame fires reko:rail-loop)
  document.addEventListener('reko:rail-loop', () => ach.unlock('about-rails'));
  // bossfight.exe (js/bossfight.js): opening it, then its endings (reko:bossfight, detail.end). A DELETED ending while
  // Deleted is already done is the second one, so it's the Rematch (a reset wipes Deleted, so the count starts over)
  document.addEventListener('reko:bossfight-open', () => ach.unlock('about-boss-start'));
  document.addEventListener('reko:bossfight', (e) => {
    const end = e.detail && e.detail.end;
    if (end === 'kill' && ach.isDone('about-boss-kill')) ach.unlock('about-boss-rematch');
    const id = { spare: 'about-boss-spare', flee: 'about-boss-flee', betray: 'about-boss-betray', kill: 'about-boss-kill' }[end];
    if (id) ach.unlock(id);
  });
  // reko-power: shutdown / poweroff (reko-power-shutdown) or reboot (reko-power-reboot) typed in the Linux box's terminal.
  // The achievement is given once the intro of the NEXT visit has ended (played out or skipped); a visit closed before
  // that keeps it waiting for the one after
  const wokeUp = () => {
    [['shutdown', 'about-shutdown'], ['reboot', 'about-reboot']].forEach(([k, id]) => {
      let on = false;
      try { on = localStorage.getItem('reko-power-' + k) === '1'; } catch (err) { /* storage blocked */ }
      if (!on) return;
      ach.unlock(id);
      try { localStorage.removeItem('reko-power-' + k); } catch (err) {}
    });
  };
  document.addEventListener('reko:intro-done', wokeUp);
  if (site.phase === 'done') wokeUp(); // the intro already ended before this ran
});
