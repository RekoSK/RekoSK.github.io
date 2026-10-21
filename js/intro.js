/* rekosk.dev: the hero: greeting rotator, the logo intro (and its sizing), the logo poke and the "Reko" morph */
'use strict';

rekoSite.part((site) => {
  const { $, $$, root, reduceMotion, sfx, sndHint, setSound, playSound, stopSounds, fadeSound, ui, lake } = site;
  site.share({
    GREETINGS: () => GREETINGS, gWord: () => gWord, buildWord: () => buildWord, phase: () => phase,
    toTop: () => toTop, startIntro: () => startIntro, finishIntro: () => finishIntro, logoBtn: () => logoBtn,
    sizeIntro: () => sizeIntro,
  });

  const GREETINGS = ['Hello', 'Bonjour', 'Welcome', 'Ahoj', 'Hola', 'Nice to meet you', 'Ciao', 'Hallo', 'Olá', 'Salut', 'Hej', 'Servus'];
  const GREET_EVERY = 2600; // ms between greetings

  /* ---------- greeting rotator ---------- */
  const gWord = $('#gword');
  const gLine = $('.g-l1');
  let gi = 0;
  let gTimer = 0;
  let gBusy = false;

  function buildWord(word) {
    let i = 0;
    gWord.innerHTML = word.split(' ').map((w) =>
      '<span class="g-w">' +
      Array.from(w).map((c) => `<span class="g-ch" style="animation-delay:${(i++) * 40}ms">${c}</span>`).join('') +
      '</span>'
    ).join('');
    gLine.classList.toggle('g-long', word.length > 9);
  }

  function showGreeting(index) {
    gi = index;
    buildWord(GREETINGS[gi]);
    gWord.classList.remove('g-out', 'g-in');
    void gWord.offsetWidth; // restart animations
    gWord.classList.add('g-in');
  }

  function hideGreeting() {
    $$('.g-ch', gWord).forEach((el, i) => { el.style.animationDelay = (i * 16) + 'ms'; });
    gWord.classList.remove('g-in');
    gWord.classList.add('g-out');
  }

  function nextGreeting() {
    if (gBusy) return;
    gBusy = true;
    const len = GREETINGS[gi].length;
    hideGreeting();
    setTimeout(() => {
      gBusy = false;
      showGreeting((gi + 1) % GREETINGS.length);
    }, 300 + len * 18);
  }

  function startGreeting() {
    clearInterval(gTimer);
    gTimer = setInterval(nextGreeting, GREET_EVERY);
  }

  gWord.addEventListener('click', () => {
    if (phase !== 'done') return;
    nextGreeting();
    startGreeting();
  });


  /* ---------- intro (recreated from Videos/Full.mp4) ----------
     The logo assembles, "eko" glitches in to spell Reko, the letters get sucked back in,
     the logo grows, tilts and winks — then settles into its place on the page.
     While fonts / sound are still loading, the screen stays black (2.5s at most). */
  const INTRO_MS = 6400;   // keep in sync with the 6.4s animations in style.css
  const REVEAL_AT = 5600;  // page content fades in while the logo lands
  let phase = 'wait';
  let timers = [];
  let fontsReady = false;
  let introAt = 0;
  let finalAt = 0; // when the full intro (and its soundtrack) started

  const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  function setPhase(next) {
    root.classList.remove('ph-' + phase);
    phase = next;
    void root.offsetWidth; // makes the same animation restart cleanly
    root.classList.add('ph-' + next);
    // no scrolling away while the intro plays: only "Skip intro" (or the intro ending) lets you out
    document.documentElement.classList.toggle('intro-lock', next !== 'done');
    if (next === 'done') document.dispatchEvent(new CustomEvent('reko:intro-done')); // the save-file notice waits for it
  }

  // every (re)load starts at the top with the intro, never where the browser left off
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const toTop = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  // some browsers (Firefox, the artifact frame) still put the old position back late, after load:
  // while the intro is locked, any scroll gets snapped back to the top
  window.addEventListener('scroll', () => {
    if (phase !== 'done' && (window.scrollY || window.scrollX)) toTop();
  }, { passive: true });
  // and leave the page at the top, so there is no old position for the browser to remember
  const leaveTop = () => { document.documentElement.style.scrollBehavior = 'auto'; toTop(); };
  window.addEventListener('pagehide', leaveTop);

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { fontsReady = true; });

  function startIntro() {
    clearTimers();
    clearInterval(gTimer);
    stopSounds();
    site.closeMenu();
    sndHint.hidden = true;
    introAt = Date.now();
    root.classList.remove('rv');
    hideGreeting();
    setPhase('wait');
    later(runCycle, 450);
  }

  function runCycle() {
    // stay on the black screen until fonts + the intro sound are loaded (2.5s at most)
    const ready = fontsReady && (site.audioReady || !site.soundOn);
    if (!ready && Date.now() - introAt < 2500) { later(runCycle, 80); return; }
    setPhase('final');
    finalAt = performance.now();
    if (site.audioReady || !site.soundOn) {
      playSound('intro').then((ok) => { if (!ok && phase === 'final') sndHint.hidden = false; });
    } else {
      // sound arrived late: join the soundtrack where the animation already is
      sfx.intro.addEventListener('canplaythrough', () => {
        if (phase !== 'final' || !site.soundOn) return;
        sfx.intro.currentTime = (performance.now() - finalAt) / 1000;
        sfx.intro.play().catch(() => { sndHint.hidden = false; });
      }, { once: true });
    }
    later(() => { root.classList.add('rv'); showGreeting(0); }, REVEAL_AT);
    later(() => { setPhase('done'); startGreeting(); }, INTRO_MS + 50);
  }

  function finishIntro() {
    clearTimers();
    Object.values(sfx).forEach((a) => fadeSound(a, 0.4));
    sndHint.hidden = true;
    setPhase('done');
    root.classList.add('rv');
    showGreeting(gi);
    startGreeting();
  }

  $('#skip').addEventListener('click', () => {
    const skipped = phase !== 'done';
    finishIntro();
    if (skipped) setTimeout(() => site.ach.unlock('gen-skip'), 600); // "Skip the intro", once the page has settled
  });
  // turn sound on and join the soundtrack where the animation already is (no restart)
  sndHint.addEventListener('click', () => {
    if (lake.out()) lake.back(true); else setSound(true);
    sndHint.hidden = true;
    if (phase !== 'final') return; // still loading: the sound starts with the intro
    const a = sfx.intro;
    a.currentTime = Math.min((performance.now() - finalAt) / 1000, a.duration || Infinity);
    a.play().catch(() => {});
  });
  $('#replay').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    startIntro();
  });

  /* logo click = grow + wink (with sound) */
  const logoBtn = $('.logo-btn');
  let poke = 0;
  let winkTimer = 0;
  logoBtn.addEventListener('click', () => {
    if (phase !== 'done') return; // during the intro only "Skip intro" gets you out
    logoBtn.classList.remove('pk-a', 'pk-b');
    poke = poke === 1 ? 2 : 1;
    logoBtn.classList.add(poke === 1 ? 'pk-a' : 'pk-b');
    playSound('poke');
    // "Flirt-blink": once the right eye has actually winked (~0.75s into the 1.3s poke; a new click restarts it)
    clearTimeout(winkTimer);
    winkTimer = setTimeout(() => site.ach.unlock('pilot-blink'), 800);
  });

  /* ---------- "Reko": hold the cursor on it and it smoothly turns into the logo ----------
     The big logo behind shrinks and flies into the "R" spot, then e, k and o morph into the logo's
     letters one after another. Moving away morphs them back and the logo grows back behind the text. */
  const gName = $('#gName');
  const gCells = $$('.gn-ch', gName);
  const SWAP_AT = [450, 800, 1150, 1500]; // ms of holding before R, e, k, o change
  const BACK_STEP = 140;                  // ms between letters when morphing back
  const MORPH_MS = 900;                   // one letter's morph (matches the CSS transitions)
  let holding = false;

  // fix each letter slot to its text width (in em) so it can animate to the logo letter's width
  function measureName() {
    const fs = parseFloat(getComputedStyle(gName).fontSize);
    gCells.forEach((cell) => {
      const w = $('.gn-t', cell).getBoundingClientRect().width;
      if (w && fs) cell.style.setProperty('--tw', (w / fs).toFixed(3) + 'em');
    });
  }
  if (document.fonts) document.fonts.ready.then(measureName); else measureName();

  /* the big background logo ⇄ the "R" spot. Tracked every frame, because the centered line
     shifts while the other letters change width. */
  const logoSlotEl = logoBtn.parentElement;
  const lgPoke = $('.lg-poke');
  const rTarget = $('.gn-i-r');          // invisible placeholder that marks where the logo "R" goes
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let rP = 0;                            // 0 = big behind the text, 1 = sitting in the "R" spot
  let rTween = null;
  let rRaf = 0;
  let bigRect = null;                    // cached: the slot itself never moves during the morph

  function tweenR(to) {
    rTween = { from: rP, to, t0: performance.now(), dur: MORPH_MS * Math.abs(to - rP) || 1 };
    logoSlotEl.classList.add('to-r');
    if (!rRaf) rRaf = requestAnimationFrame(renderR);
  }

  function renderR(now) {
    rRaf = 0;
    if (rTween) {
      // a frame's timestamp can be a bit older than the tween's start: never let progress go below 0
      // (it used to, which read as "back home" and stopped the logo from ever shrinking into the "R")
      const t = Math.max(0, Math.min(1, (now - rTween.t0) / rTween.dur));
      rP = rTween.from + (rTween.to - rTween.from) * ease(t);
      if (t >= 1) { rP = rTween.to; rTween = null; }
    }
    const big = bigRect || (bigRect = logoSlotEl.getBoundingClientRect()); // layout box of the big logo (the button is transformed, not the slot); cached while out
    const tgt = rTarget.getBoundingClientRect();
    const s = 1 + (tgt.width / big.width - 1) * rP;
    const dx = (tgt.left - big.left) * rP;
    const dy = (tgt.top - big.top) * rP;
    if (rP > 0) {
      logoBtn.style.transformOrigin = '0 0';
      logoBtn.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${s.toFixed(4)})`;
      lgPoke.style.opacity = (0.42 + 0.58 * rP).toFixed(3);
      lgPoke.style.setProperty('--lgf', (1 - rP).toFixed(3)); // fade to black blends out on the way
      rRaf = requestAnimationFrame(renderR); // keep following the "R" while it's out
    } else if (rTween) {
      rRaf = requestAnimationFrame(renderR); // still at 0 but a tween is running: keep going
    } else {
      logoBtn.style.transform = '';
      logoBtn.style.transformOrigin = '';
      lgPoke.style.opacity = '';
      lgPoke.style.removeProperty('--lgf');
      logoSlotEl.classList.remove('to-r');
      bigRect = null;
    }
  }

  /* the orange underline follows the morph itself: its fill = how far the four letters have turned (R = the logo),
     so a quick in / out can never leave it full while the logo is still big, or empty while it's small */
  const ulP = [0, 0, 0, 0];
  const ulTw = [];
  let ulRaf = 0;
  function ulTween(i, on) {
    ulTw[i] = { from: ulP[i], to: on ? 1 : 0, t0: performance.now(), dur: MORPH_MS * Math.abs((on ? 1 : 0) - ulP[i]) || 1 };
    if (!ulRaf) ulRaf = requestAnimationFrame(renderUl);
  }
  function renderUl(now) {
    ulRaf = 0;
    let busy = false;
    ulTw.forEach((tw, i) => {
      if (!tw) return;
      const t = Math.max(0, Math.min(1, (now - tw.t0) / tw.dur));
      ulP[i] = tw.from + (tw.to - tw.from) * ease(t);
      if (t >= 1) { ulP[i] = tw.to; ulTw[i] = null; } else busy = true;
    });
    const p = (rP + ulP[1] + ulP[2] + ulP[3]) / 4; // the R part tracks the logo itself
    gName.style.setProperty('--ulp', p.toFixed(4));
    if (busy || rTween) ulRaf = requestAnimationFrame(renderUl);
  }

  let flyVoice = null; // the logo's fly-in / fly-out swoosh that's playing right now
  function setLetter(i, on) {
    gCells[i].classList.toggle('sw', on);
    ulTween(i, on);
    // sound must never break the visual morph (a throw here used to leave the R gone and the logo big)
    try {
      ui.play(on ? 'noteUp' : 'noteDown', i);
      if (i === 0) {
        const r = rTarget.getBoundingClientRect();
        const pan = Math.max(-0.8, Math.min(0.8, ((r.left + r.width / 2) / window.innerWidth - 0.5) * 1.6));
        if (flyVoice) flyVoice.stop(0.15);
        flyVoice = ui.play(on ? 'flyIn' : 'flyOut', pan);
      }
    } catch (err) {}
    if (i === 0) tweenR(on ? 1 : 0);
    // "First interaction": once the whole name has turned into the logo (the last letter's morph has finished)
    const allSw = () => gCells.every((c) => c.classList.contains('sw'));
    if (on && allSw()) setTimeout(() => { if (allSw()) site.ach.unlock('pilot-first'); }, MORPH_MS);
  }

  // one timer per letter, so changing direction mid-way never strands a letter or the logo
  const letterTimers = [];
  function setTimer(i, fn, ms) { clearTimeout(letterTimers[i]); letterTimers[i] = setTimeout(fn, ms); }
  let leaveTimer = 0;
  let wantHold = false;   // cursor on the name / finger down, even if the morph can't start yet
  let waitTimer = 0;

  function startHold() {
    wantHold = true;
    clearTimeout(leaveTimer);
    if (holding) return;
    // the name is already hoverable while the intro lands: start as soon as it's done (no need to move the cursor again)
    if (phase !== 'done') { clearTimeout(waitTimer); waitTimer = setTimeout(() => { if (wantHold) startHold(); }, 120); return; }
    holding = true;
    root.classList.add('holding');
    gCells.forEach((cell, i) => {
      clearTimeout(letterTimers[i]);
      if (!cell.classList.contains('sw')) setTimer(i, () => setLetter(i, true), SWAP_AT[i]);
    });
    if (rP < 1 && gCells[0].classList.contains('sw')) tweenR(1);
  }

  function endHold() {
    wantHold = false;
    clearTimeout(leaveTimer);
    clearTimeout(waitTimer);
    if (!holding) return;
    holding = false;
    root.classList.remove('holding');
    let k = 0;
    for (let i = gCells.length - 1; i >= 0; i--) {
      clearTimeout(letterTimers[i]);
      if (gCells[i].classList.contains('sw')) { const j = i; setTimer(j, () => setLetter(j, false), k * BACK_STEP); k++; }
    }
    // safety net: whatever happened, end with all text and the logo big behind it
    setTimer(gCells.length, () => {
      if (holding) return;
      gCells.forEach((c, i) => { if (c.classList.contains('sw')) setLetter(i, false); });
      if (rP > 0 && (!rTween || rTween.to !== 0)) tweenR(0);
    }, k * BACK_STEP + MORPH_MS + 100);
  }

  gName.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') startHold(); });
  gName.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && !holding) startHold(); }); // in case the enter was missed
  gName.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { clearTimeout(leaveTimer); leaveTimer = setTimeout(endHold, 120); } }); // small grace: the name changes width while morphing
  gName.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') startHold(); }); // touch: press and hold
  ['pointerup', 'pointercancel'].forEach((t) => gName.addEventListener(t, (e) => { if (e.pointerType !== 'mouse') endHold(); }));
  gName.addEventListener('contextmenu', (e) => e.preventDefault());


  /* ---------- intro sizing: the landed logo is big (behind the text); the intro plays it smaller ---------- */
  const logoSlot = $('.logo-slot');
  function sizeIntro() {
    const S = logoSlot.offsetWidth;
    if (!S) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const introW = Math.min(1.55 * Math.min(250, Math.max(150, vh * 0.24)), vw * 0.8); // logo width while it assembles
    const is = introW / S;
    root.style.setProperty('--is', is.toFixed(3));
    // "Reko" wordmark (2.5x the logo's width) must fit on screen
    root.style.setProperty('--ws', Math.min(is, (vw * 0.86) / (S * 2.507)).toFixed(3));
    // the grown + tilted pose is ~1.3x the logo's width; keep it on screen too
    root.style.setProperty('--ps', Math.min(is * 1.25, (vw * 0.82) / (S * 1.3)).toFixed(3));
  }
  window.addEventListener('resize', sizeIntro);
});
