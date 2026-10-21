/* bossfight.exe: an Undertale-style boss fight against Reko's logo, in one of the site's movable windows.
   Typing "rekoboss" in the About terminal opens it (js/logo-boxes.js sends reko:bossfight-open). This file is made from the
   standalone version (project files: bossfight/js/bossfight.js) by bossfight/to-site.py; change that one, then re-run it.
   Everything here is original: the sprites are drawn from pixel maps / the Reko logo pieces, all sounds and music are
   synthesized live with Web Audio (except heart-crack.mp3 / heart-shatter.mp3, which come from the main site).
   The game draws on a 640x480 canvas (the game's own resolution) that scales with the window.

   How a fight goes (the same loop Undertale uses):
   1. your turn: pick FIGHT / ACT / ITEM / MERCY with the soul
      FIGHT → pick the target → stop the sliding bar in the attack meter; the closer to the middle, the more damage
      ACT → pick the target → one of Reko's acts (Check, Compliment, Debug, Wink); it takes your turn
      ITEM → a Potion (heals 10 HP, you have 4) or the Code Burger (heals you fully, you have 1); it takes your turn
      MERCY → Spare (ends the fight once Reko's name is yellow) or Flee
   2. Reko talks (speech bubble), the box shrinks into a bullet box
   3. his turn: dodge an attack pattern with the soul (red = free movement, blue = gravity + jumping)
   Kill route: bring his HP to 0. Pacifist route: keep sparing until he runs out of patterns, then spare him.
   When the fight ends a "reko:bossfight" event fires on document ({ detail: { end: 'spare' | 'kill' | 'betray' |
   'flee' | 'gameover' } }), for achievements later. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeOut = (k) => 1 - (1 - k) ** 3;
  const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
  const easeBack = (k) => { const c1 = 1.70158; return 1 + (c1 + 1) * (k - 1) ** 3 + c1 * (k - 1) ** 2; };

  /* ---------- sound ----------
     Same rules as the main site: on by default, shared `reko-sound` setting, only after the first click / key,
     silent while the tab is hidden, a master compressor so nothing clips. */
  const SOUND_KEY = 'reko-sound';
  let soundOn = true;
  try { soundOn = localStorage.getItem(SOUND_KEY) !== 'off'; } catch (err) { /* storage blocked */ }

  const sfx = {
    heartCrack: new Audio('assets/sound/heart-crack.mp3'),     // the site's own 8-bit heart crack...
    heartShatter: new Audio('assets/sound/heart-shatter.mp3')  // ...and shatter: perfect for the soul breaking
  };
  Object.values(sfx).forEach((a) => { a.preload = 'auto'; a.volume = 0.85; });
  function playFile(name, fallback) {
    if (!soundOn) return;
    const a = sfx[name];
    try { a.currentTime = 0; } catch (err) {}
    a.play().catch(() => au.play(fallback)); // file missing or blocked: use the synthesized version
  }

  const au = (() => {
    let ctx = null, out = null, noiseBuf = null;
    const waves = {};

    function ensure() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        const comp = ctx.createDynamicsCompressor(); // keeps stacked sounds from clipping
        comp.threshold.value = -16;
        comp.ratio.value = 4;
        out = ctx.createGain();
        out.gain.value = 0.9;
        out.connect(comp).connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {});
      return ctx;
    }
    ['pointerdown', 'touchend', 'keydown'].forEach((t) => window.addEventListener(t, ensure, { passive: true }));
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {});
    });

    // 8-bit pulse voices: 'p50' = square, 'p25' / 'p12' = the thinner NES-style duty cycles
    function setType(o, type) {
      if (type[0] === 'p') {
        const d = +type.slice(1) / 100;
        if (!waves[d]) {
          const n = 48, re = new Float32Array(n), im = new Float32Array(n);
          for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * d);
          waves[d] = ctx.createPeriodicWave(re, im);
        }
        o.setPeriodicWave(waves[d]);
      } else o.type = type === 'tri' ? 'triangle' : type;
    }

    // a tone, optionally gliding from f0 to f1 (same building block as the main site's ui.tone)
    function tone(f0, f1, dur, vol, at = 0, type = 'sine', dest = out) {
      const t = ctx.currentTime + at;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      setType(o, type);
      o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + dur + 0.03);
    }

    // a burst of filtered noise; hard = gated on/off like a glitch slice
    function noise(dur, vol, hp, at = 0, hard = false, lp = 14000, dest = out) {
      const t = ctx.currentTime + at;
      const s = ctx.createBufferSource();
      const h = ctx.createBiquadFilter();
      const l = ctx.createBiquadFilter();
      const g = ctx.createGain();
      s.buffer = noiseBuf;
      h.type = 'highpass'; h.frequency.value = hp;
      l.type = 'lowpass'; l.frequency.value = lp;
      g.gain.setValueAtTime(vol, t);
      if (hard) g.gain.setValueAtTime(0, t + dur); else g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(h).connect(l).connect(g).connect(dest);
      s.start(t, Math.random() * 0.3);
      s.stop(t + dur + 0.03);
    }

    // air swoosh: band-passed noise sweeping f0 → f1, swelling to a peak at `peak`
    function swoosh(dur, vol, f0, f1, { q = 0.9, peak = 0.6 } = {}) {
      const t = ctx.currentTime;
      const s = ctx.createBufferSource();
      const b = ctx.createBiquadFilter();
      const l = ctx.createBiquadFilter();
      const g = ctx.createGain();
      s.buffer = noiseBuf; s.loop = true;
      b.type = 'bandpass'; b.Q.value = q;
      b.frequency.setValueAtTime(f0, t);
      b.frequency.exponentialRampToValueAtTime(f1, t + dur);
      l.type = 'lowpass'; l.frequency.value = 6000;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + dur * peak);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(b).connect(l).connect(g).connect(out);
      s.start(t, Math.random() * 0.2);
      s.stop(t + dur + 0.05);
    }

    // a soft pad voice: slow swell in and out
    function pad(f, dur, vol, at = 0, attack = 0.5, type = 'sine', dest = out) {
      const t = ctx.currentTime + at;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const l = ctx.createBiquadFilter();
      setType(o, type); o.frequency.value = f;
      l.type = 'lowpass'; l.frequency.setValueAtTime(600, t); l.frequency.linearRampToValueAtTime(3200, t + dur * 0.6);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.setValueAtTime(vol, t + Math.max(attack, dur - 0.8));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(l).connect(g).connect(dest);
      o.start(t); o.stop(t + dur + 0.05);
    }

    const R = [880, 1046.5, 1318.5, 1568]; // the "Reko" notes: A5 C6 E6 G6 (A minor), from Videos/Full.mp4
    const vary = () => 0.94 + Math.random() * 0.12;

    const recipes = {
      // menus: a thin 8-bit "squeak" to move, a two-step blip to confirm
      move: () => { tone(1250, 1250, 0.03, 0.05, 0, 'p25'); tone(1900, 1900, 0.02, 0.02, 0.025, 'p25'); },
      heal: () => { [784, 988, 1175, 1568].forEach((n, k) => tone(n, n, 0.14, 0.04, k * 0.05, 'p25')); tone(2093, 2093, 0.3, 0.02, 0.22, 'triangle'); },
      select: () => { tone(880, 880, 0.04, 0.06, 0, 'p25'); tone(1760, 1760, 0.07, 0.05, 0.04, 'p25'); },
      back: () => tone(1320, 660, 0.07, 0.05, 0, 'p25'),
      locked: () => { tone(320, 320, 0.07, 0.09, 0, 'square'); tone(260, 260, 0.1, 0.09, 0.09, 'square'); }, // the site's `error`
      // text voices: the narrator ticks, Reko "talks" on the Reko notes, the game over voice is low and soft
      txt: () => { const r = vary(); tone(560 * r, 560 * r, 0.032, 0.035, 0, 'p25'); },
      txtReko: (i = 0) => { const n = R[i % 4] / 2; tone(n, n, 0.045, 0.04, 0, 'p50'); },
      txtLow: () => { tone(196, 196, 0.07, 0.05, 0, 'triangle'); tone(392, 392, 0.04, 0.012, 0, 'p25'); },
      // the encounter: three blips while the soul flashes, then it swooshes down to the FIGHT button
      encBlip: () => { tone(1046.5, 1046.5, 0.06, 0.08, 0, 'p50'); noise(0.05, 0.05, 2500, 0, true, 9000); },
      encFly: () => { swoosh(0.5, 0.12, 3200, 500, { q: 0.8, peak: 0.3 }); tone(1568, 392, 0.45, 0.05, 0, 'p25'); },
      // logo pieces burst together (like the site's intro): the Reko notes climbing, then a pop as they snap
      assemble: () => {
        R.forEach((n, k) => tone(n / 2, n / 2, 0.12, 0.06, k * 0.08, 'p25'));
        swoosh(0.45, 0.1, 500, 3000, { peak: 0.8 });
        tone(1500, 520, 0.075, 0.16, 0.42); noise(0.01, 0.07, 3000, 0.42);
      },
      blink: () => { tone(2000, 2000, 0.03, 0.04); tone(2600, 2600, 0.03, 0.04, 0.1); },
      // your attack
      slash: () => { swoosh(0.22, 0.2, 7000, 900, { q: 0.7, peak: 0.15 }); noise(0.06, 0.08, 4000, 0, false, 12000); },
      slashBig: () => {
        swoosh(0.3, 0.24, 8000, 600, { q: 0.6, peak: 0.12 }); noise(0.09, 0.1, 3000, 0, false, 12000);
        tone(2093, 2093, 0.2, 0.03, 0, 'p25'); tone(3136, 3136, 0.25, 0.02, 0.05, 'p25');
      },
      hit: () => { noise(0.1, 0.22, 700, 0, true, 7000); tone(240, 60, 0.22, 0.18, 0, 'square'); tone(130, 45, 0.3, 0.22); },
      miss: () => tone(700, 350, 0.16, 0.04, 0, 'triangle'),
      // you get hit: the site's 8-bit "ouch" from the pixel heart
      hurt: () => {
        tone(620, 210, 0.16, 0.06, 0, 'square');
        tone(470, 160, 0.2, 0.035, 0.03, 'square');
        noise(0.05, 0.08, 1200, 0, false, 5000);
        tone(140, 70, 0.12, 0.12);
      },
      // the soul turns blue: a bell
      ding: () => { tone(1046.5, 1046.5, 0.7, 0.07, 0, 'triangle'); tone(2093, 2093, 0.4, 0.025, 0, 'triangle'); tone(3136, 3136, 0.25, 0.01); },
      jump: () => tone(330, 700, 0.09, 0.03, 0, 'p25'),
      // attacks
      warn: () => { tone(1568, 1568, 0.035, 0.03, 0, 'p25'); tone(1568, 1568, 0.035, 0.03, 0.07, 'p25'); },
      brush: (d = 0.3) => { swoosh(Math.max(0.3, d), 0.15, 900, 5200, { q: 0.6, peak: 0.25 }); noise(0.06, 0.05, 2500, 0, false, 8000); },
      charge: () => { tone(220, 1320, 0.55, 0.025, 0, 'sawtooth'); swoosh(0.55, 0.05, 400, 3000, { peak: 0.95 }); },
      wink: () => tone(2400, 1400, 0.05, 0.04),
      laser: () => { noise(0.55, 0.13, 250, 0, false, 4500); tone(110, 98, 0.55, 0.08, 0, 'square'); tone(880, 880, 0.1, 0.03, 0, 'p25'); },
      bug: () => { const f = rand(2600, 3400); tone(f, f * 1.2, 0.02, 0.015); },
      toast: () => { tone(1568, 1568, 0.05, 0.03, 0, 'p25'); tone(2093, 2093, 0.08, 0.025, 0.05, 'p25'); },
      glyph: () => { const f = pick(R); tone(f, f, 0.025, 0.012, 0, 'p25'); },
      // the logo boomerangs: the pieces whoosh apart, some turn blue, each throw is a rising swoosh, the turn a long
      // falling one, the spin a soft whirr, and the catch a little two-step blip
      piecesOff: () => { swoosh(0.55, 0.12, 2600, 500, { q: 0.8, peak: 0.35 }); R.slice().reverse().forEach((n, k) => tone(n / 2, n / 2, 0.08, 0.035, k * 0.06, 'p25')); },
      pieceBlue: (k = 0) => { const f = R[k % 4] * 1.5; tone(f, f, 0.2, 0.035, 0, 'triangle'); tone(f * 2, f * 2, 0.12, 0.01, 0, 'triangle'); },
      boomThrow: () => { swoosh(0.3, 0.17, 700, 5200, { q: 0.7, peak: 0.3 }); tone(523.25, 1046.5, 0.07, 0.03, 0, 'p25'); },
      boomBack: () => { swoosh(0.8, 0.1, 4200, 700, { q: 1.3, peak: 0.45 }); tone(392, 330, 0.1, 0.02, 0, 'p25'); },
      whirr: (v = 0.03) => swoosh(0.16, v, 1500, 3400, { q: 2.2, peak: 0.5 }),
      boomCatch: () => { tone(880, 880, 0.03, 0.04, 0, 'p25'); tone(1760, 1760, 0.05, 0.035, 0.035, 'p25'); noise(0.015, 0.05, 3000); },
      // big moments
      phase: () => { noise(0.06, 0.2, 1800, 0, true, 12000); tone(110, 55, 0.9, 0.15, 0, 'square'); swoosh(0.9, 0.12, 300, 4000, { peak: 0.85 }); },
      spare: () => {
        for (let i = 0; i < 8; i++) { const f = rand(1600, 3200); tone(f, f * 0.98, 0.18, 0.02, i * 0.04); }
        noise(0.4, 0.04, 6000, 0, false, 14000);
        R.forEach((n, k) => tone(n, n, 0.3, 0.03, 0.1 + k * 0.06, 'triangle'));
      },
      dust: () => { swoosh(1.8, 0.14, 5200, 260, { q: 0.5, peak: 0.15 }); noise(1.6, 0.05, 3500, 0, false, 12000); tone(392, 98, 1.6, 0.03, 0, 'triangle'); },
      flee: () => { for (let i = 0; i < 8; i++) tone(900 - i * 50, 700 - i * 50, 0.04, 0.035, i * 0.11, 'p25'); swoosh(0.9, 0.06, 2000, 400, { peak: 0.3 }); },
      // the site's ldDone chime: a bright little "you did it"
      win: () => {
        [783.99, 987.77, 1318.51].forEach((n, k) => { tone(n, n, 0.45, 0.06, k * 0.09); tone(n * 2, n * 2, 0.2, 0.015, k * 0.09); });
        pad(392, 1.2, 0.03, 0.2, 0.15);
      },
      // after sparing: the calm finish, F major → resting on A major, the Reko notes stepping down further apart
      calm: () => {
        [[174.61, 0.05], [220, 0.04], [261.63, 0.035], [349.23, 0.025]].forEach(([f, v], i) => pad(f, 2.4, v, i * 0.05, 0.5, 'triangle'));
        [[220, 0.05], [277.18, 0.04], [329.63, 0.035], [440, 0.025]].forEach(([f, v], i) => pad(f, 3.4, v, 2.0 + i * 0.05, 0.6, 'triangle'));
        let at = 0.2;
        [1568, 1318.5, 1046.5, 880].forEach((n, k) => { tone(n, n, 0.7, 0.035, at, 'triangle'); at += 0.4 + k * 0.18; });
        tone(1760, 1760, 0.5, 0.02, 3.6); tone(2217.46, 2217.46, 0.5, 0.015, 3.7);
      },
      // fallbacks for the two audio files (same recipes as the site's synth versions)
      crack: () => { noise(0.035, 0.22, 2500, 0, true, 12000); tone(900, 300, 0.09, 0.07, 0, 'square'); tone(180, 90, 0.15, 0.12); },
      shatter: () => {
        noise(0.06, 0.2, 1800, 0, false, 12000);
        for (let i = 0; i < 7; i++) { const f = 1400 + Math.random() * 2200; tone(f, f * 0.97, 0.5 + Math.random() * 0.4, 0.03, i * 0.025, 'square'); }
        tone(220, 60, 0.4, 0.12, 0, 'triangle');
      },
      on: () => { tone(1600, 1600, 0.05, 0.12); tone(2400, 2400, 0.08, 0.12, 0.06); },
      off: () => { tone(2000, 2000, 0.05, 0.1); tone(1200, 1200, 0.09, 0.1, 0.06); },
      tick: (f = 2600, v = 0.04) => { const r = vary(); tone(f * r, f * r, 0.028, v); noise(0.012, v * 0.6, 5000); },
      grab: () => { tone(700, 1150, 0.05, 0.12); noise(0.012, 0.06, 3000); },
      open: () => { tone(520, 1500, 0.09, 0.12); noise(0.05, 0.025, 1800); }
    };

    function play(name, ...args) {
      if ((!soundOn && name !== 'off') || document.hidden) return;
      if (!ensure()) return;
      const r = recipes[name];
      if (r) r(...args);
    }

    /* ---------- music ----------
       Synthesized chiptune on a 16th-note grid, scheduled a little ahead. The battle theme is in A minor on the
       Reko notes (Am F C G / Am F G E), and gets more intense with `level`: 0 = normal, 1 = phase two (faster,
       arpeggios, kick on every beat), 2 = the final attack, -1 = tired (slow, no drums). */
    const NOTE_ST = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
    const N = (s) => { const m = /^([A-G])(#?)(\d)$/.exec(s); return 440 * 2 ** ((NOTE_ST[m[1]] + (m[2] ? 1 : 0) + (m[3] - 4) * 12) / 12); };
    const MEL = [
      [[0, 'A4', 2], [2, 'C5', 2], [4, 'E5', 2], [6, 'G5', 2], [8, 'E5', 4], [12, 'C5', 2], [14, 'D5', 2]],
      [[0, 'E5', 3], [3, 'F5', 3], [6, 'E5', 2], [8, 'C5', 4], [12, 'A4', 4]],
      [[0, 'G4', 2], [2, 'C5', 2], [4, 'E5', 2], [6, 'G5', 2], [8, 'A5', 4], [12, 'G5', 2], [14, 'E5', 2]],
      [[0, 'D5', 4], [4, 'B4', 4], [8, 'G4', 2], [10, 'B4', 2], [12, 'D5', 4]],
      [[0, 'A5', 2], [2, 'G5', 2], [4, 'E5', 2], [6, 'C5', 2], [8, 'E5', 2], [10, 'G5', 2], [12, 'A5', 4]],
      [[0, 'C6', 4], [4, 'A5', 2], [6, 'F5', 2], [8, 'A5', 4], [12, 'G5', 2], [14, 'F5', 2]],
      [[0, 'G5', 3], [3, 'D5', 3], [6, 'G5', 2], [8, 'B5', 4], [12, 'D6', 4]],
      [[0, 'E5', 2], [2, 'G#5', 2], [4, 'B5', 2], [6, 'E6', 2], [8, 'D6', 2], [10, 'B5', 2], [12, 'G#5', 4]]
    ];
    const BASS = ['A2', 'F2', 'C3', 'G2', 'A2', 'F2', 'G2', 'E2'];
    const CH = [['A4', 'C5', 'E5'], ['F4', 'A4', 'C5'], ['C4', 'E4', 'G4'], ['G4', 'B4', 'D5'], ['A4', 'C5', 'E5'], ['F4', 'A4', 'C5'], ['G4', 'B4', 'D5'], ['E4', 'G#4', 'B4']];
    // the title screen: same key and Reko-note motif as the battle theme, but slow and calm, like a music box
    const MENU_MEL = [
      [[0, 'E5', 4], [4, 'A5', 4], [8, 'G5', 2], [10, 'E5', 2], [12, 'C5', 4]],
      [[0, 'C5', 4], [4, 'F5', 4], [8, 'E5', 4], [12, 'C5', 4]],
      [[0, 'G5', 4], [4, 'E5', 2], [6, 'G5', 2], [8, 'C6', 6], [14, 'B5', 2]],
      [[0, 'B5', 4], [4, 'G5', 4], [8, 'D5', 8]],
      [[0, 'A4', 2], [2, 'C5', 2], [4, 'E5', 2], [6, 'G5', 2], [8, 'A5', 8]],
      [[0, 'G5', 2], [2, 'F5', 2], [4, 'E5', 2], [6, 'C5', 2], [8, 'A4', 8]],
      [[0, 'D5', 4], [4, 'F5', 4], [8, 'A5', 4], [12, 'G5', 4]],
      [[0, 'G#5', 8], [8, 'B5', 4], [12, 'E5', 4]]
    ];
    const MENU_CH = [['A4', 'C5', 'E5'], ['F4', 'A4', 'C5'], ['C4', 'E4', 'G4'], ['G4', 'B4', 'D5'], ['A4', 'C5', 'E5'], ['F4', 'A4', 'C5'], ['D4', 'F4', 'A4'], ['E4', 'G#4', 'B4']];
    const MENU_BASS = ['A2', 'F2', 'C3', 'G2', 'A2', 'F2', 'D3', 'E2'];
    const OVER_MEL = [
      [[0, 'A4', 6], [6, 'C5', 2], [8, 'E5', 6], [14, 'D5', 2]],
      [[0, 'C5', 8], [8, 'A4', 8]],
      [[0, 'A4', 6], [6, 'C5', 2], [8, 'E5', 4], [12, 'A5', 4]],
      [[0, 'G#5', 12], [12, 'E5', 4]]
    ];
    const OVER_CH = [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['A3', 'C4', 'E4'], ['E3', 'G#3', 'B3']];

    let bus = null, song = null, step = 0, next = 0, timer = null, want = null, level = 0;

    function note(f, t, dur, vol, type) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      setType(o, type);
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
      g.gain.setTargetAtTime(vol * 0.55, t + 0.012, 0.09);
      g.gain.setTargetAtTime(0.0001, t + dur, 0.025);
      o.connect(g).connect(bus);
      o.start(t); o.stop(t + dur + 0.2);
    }
    function drum(kind, t, v = 1) {
      if (kind === 'kick') {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
        g.gain.setValueAtTime(0.3 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g).connect(bus); o.start(t); o.stop(t + 0.2);
        return;
      }
      const s = ctx.createBufferSource(), h = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noiseBuf; h.type = 'highpass';
      const snare = kind === 'snare';
      h.frequency.value = snare ? 1500 : 7500;
      g.gain.setValueAtTime((snare ? 0.11 : 0.035) * v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (snare ? 0.12 : 0.03));
      s.connect(h).connect(g).connect(bus);
      s.start(t, Math.random() * 0.3); s.stop(t + 0.15);
      if (snare) note(200, t, 0.05, 0.05 * v, 'tri');
    }

    function battleStep(s, t, spb) {
      const bar = Math.floor(s / 16) % 8, st = s % 16, L = level;
      const tired = L < 0;
      for (const [at, n, len] of MEL[bar]) {
        if (at !== st) continue;
        note(N(n), t, len * spb * 0.92, tired ? 0.035 : 0.05, tired ? 'tri' : 'p25');
        if (L >= 2) note(N(n) * 2, t, len * spb * 0.8, 0.018, 'p12');
      }
      if (tired) { if (st % 8 === 0) note(N(BASS[bar]), t, spb * 7, 0.13, 'tri'); return; }
      if (st % 2 === 0) note(N(BASS[bar]) * [1, 1, 2, 1, 1, 2, 1, 1.5][st / 2], t, spb * 1.7, 0.16, 'tri');
      if (st === 6 || st === 14) CH[bar].forEach((n) => note(N(n), t, spb * 0.8, 0.016, 'p50'));
      if (L >= 1) note(N(CH[bar][st % 3]) * 2, t, spb * 0.8, 0.02, 'p12');
      if (st === 0 || st === 8 || (L >= 1 && (st === 4 || st === 12)) || (L >= 2 && st === 10)) drum('kick', t);
      if (st === 4 || st === 12) drum('snare', t);
      if (st % 4 === 2 || (L >= 2 && st % 2 === 1)) drum('hat', t, st % 4 === 2 ? 1 : 0.6);
    }
    function menuStep(s, t, spb) {
      const bar = Math.floor(s / 16) % 8, st = s % 16, loop = Math.floor(s / 128);
      for (const [at, n, len] of MENU_MEL[bar]) {
        if (at !== st) continue;
        note(N(n), t, len * spb * 0.9, 0.04, 'tri');
        note(N(n), t, len * spb * 0.7, loop ? 0.018 : 0.01, 'p25'); // the lead gets a little brighter from the second loop
      }
      if (st % 2 === 0) { const ch = MENU_CH[bar]; note(N(ch[(st / 2) % 3]) * 2, t, spb * 1.6, 0.016, 'tri'); } // music-box arpeggio
      if (st === 0 || st === 8) note(N(MENU_BASS[bar]), t, spb * 7, 0.11, 'tri');
      if (st === 0) drum('kick', t, 0.45);
      if (st === 4 || st === 12) drum('hat', t, 0.55);
      if (loop && st === 8) drum('snare', t, 0.3);
    }
    function overStep(s, t, spb) {
      const bar = Math.floor(s / 16) % 4, st = s % 16;
      for (const [at, n, len] of OVER_MEL[bar]) {
        if (at !== st) continue;
        note(N(n), t, len * spb * 0.95, 0.06, 'tri');
        note(N(n) / 2, t, len * spb * 0.9, 0.012, 'p25');
      }
      if (st === 0) OVER_CH[bar].forEach((n) => note(N(n), t, spb * 15, 0.03, 'tri'));
      if (st === 0 || st === 8) note(N(OVER_CH[bar][0]) / 2, t, spb * 7, 0.08, 'tri');
    }
    const SONGS = {
      battle: { bpm: () => ({ '-1': 104, 0: 148, 1: 160, 2: 172 })[level], play: battleStep },
      gameover: { bpm: () => 66, play: overStep },
      menu: { bpm: () => 92, play: menuStep }
    };
    function sched() {
      if (!song || !ctx) return;
      while (next < ctx.currentTime + 0.14) {
        const spb = 60 / song.bpm() / 4;
        song.play(step, next, spb);
        step++; next += spb;
      }
    }
    function startNow(name) {
      if (!ensure()) return;
      halt(0.04);
      bus = ctx.createGain(); bus.gain.value = 0.85; bus.connect(out);
      song = SONGS[name]; step = 0; next = ctx.currentTime + 0.08;
      timer = setInterval(sched, 25);
      sched();
    }
    function halt(fade) {
      if (timer) clearInterval(timer);
      timer = null; song = null;
      if (bus && ctx) {
        const b = bus, t = ctx.currentTime;
        bus = null;
        b.gain.cancelScheduledValues(t); b.gain.setValueAtTime(b.gain.value, t); b.gain.linearRampToValueAtTime(0, t + fade);
        setTimeout(() => b.disconnect(), fade * 1000 + 400);
      }
    }
    const music = {
      start(name) { want = name; if (soundOn) startNow(name); },
      stop(fade = 0.25) { want = null; halt(fade); },
      pause() { halt(0.1); },             // sound switched off: remember what was playing
      resume() { if (want) startNow(want); },
      level(n) { level = n; },
      get now() { return want; }
    };

    const unlocked = () => !!ctx && ctx.state === 'running';
    return { play, music, ensure, unlocked };
  })();

  /* ---------- canvas ---------- */
  const win = $('#bfWin');
  const cv = $('#bfCanvas');
  const c = cv.getContext('2d');
  const W = 640, H = 480;
  let K = 1;
  function fit() {
    const st = cv.parentElement, w = st.clientWidth, h = st.clientHeight;
    if (!w || !h) return;
    const cw = Math.max(1, Math.floor(Math.min(w, (h * 4) / 3))), ch = Math.floor((cw * 3) / 4);
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    K = (cw / W) * dpr;
    cv.width = Math.round(W * K); cv.height = Math.round(H * K);
  }
  new ResizeObserver(fit).observe(cv.parentElement);

  const FONT = "'VT323', ui-monospace, monospace";
  const UIF = "'Jersey 10', 'VT323', ui-monospace, monospace";
  const noLig = (str) => str.replace(/f(?=[fil])/g, 'f\u200c'); // VT323 has fi / ff ligatures; the game font doesn't
  const YEL = '#ffff00', OR = '#fe7700', BLUE = '#14a9ff', RED = '#ff1a1a';
  const SOUL = OR; // the player's heart: the site's orange (the blue gravity soul stays blue)

  // pixel sprites from text maps (one character per pixel, '.' = empty)
  function pix(rows, colors) {
    const h = rows.length, w = rows[0].length;
    const o = document.createElement('canvas'); o.width = w; o.height = h;
    const x = o.getContext('2d');
    rows.forEach((r, y) => { for (let i = 0; i < w; i++) if (r[i] !== '.') { x.fillStyle = colors[r[i]] || colors.X; x.fillRect(i, y, 1, 1); } });
    return o;
  }
  const HEART_MAP = [
    '..XXXX....XXXX..',
    '.XXXXXX..XXXXXX.',
    'XXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXX',
    'XXXXXXXXXXXXXXXX',
    '.XXXXXXXXXXXXXX.',
    '..XXXXXXXXXXXX..',
    '...XXXXXXXXXX...',
    '....XXXXXXXX....',
    '.....XXXXXX.....',
    '......XXXX......',
    '.......XX.......'
  ];
  const HEART = { red: pix(HEART_MAP, { X: SOUL }), blue: pix(HEART_MAP, { X: '#1f4dff' }) };
  // the broken soul: split down a zigzag, the two halves pulled apart
  const ZIG = [0, -1, 0, 1];
  const HEART_L = pix(HEART_MAP.map((r, y) => r.split('').map((ch, i) => (i < 8 + ZIG[y % 4] ? ch : '.')).join('')), { X: SOUL });
  const HEART_R = pix(HEART_MAP.map((r, y) => r.split('').map((ch, i) => (i >= 8 + ZIG[y % 4] ? ch : '.')).join('')), { X: SOUL });
  const SHARDS = [['.X.', 'XXX', '.X.'], ['XX', 'XX'], ['X..', 'XX.', 'XXX'], ['.XX', 'XX.']].map((m) => pix(m, { X: SOUL }));
  const ICONS = {
    fight: ['.........XX', '........XXX', '.......XXX.', '......XXX..', '.....XXX...', 'X...XXX....', '.X.XXX.....', '..XXX......', '..XX.......', '.X..X......', 'X..........'],
    act: ['.XXXXXXXXX.', 'X.........X', 'X.........X', 'X.XX.XX.X.X', 'X.........X', 'X.........X', '.XXXXXXXXX.', '..XX.......', '..X........', '.X.........', '...........'],
    item: ['...XXXXX...', '..X.....X..', '..X.....X..', '.XXXXXXXXX.', 'X.........X', 'X..XXXXX..X', 'X.........X', 'X.........X', 'X.........X', '.XXXXXXXXX.', '...........'],
    mercy: ['XX.......XX', 'XXX.....XXX', '.XXX...XXX.', '..XXX.XXX..', '...XXXXX...', '....XXX....', '...XXXXX...', '..XXX.XXX..', '.XXX...XXX.', 'XXX.....XXX', 'XX.......XX']
  };
  const iconCache = {};
  const icon = (name, col) => (iconCache[name + col] ||= pix(ICONS[name], { X: col }));
  const BUG = [
    pix(['X.....X', '.X...X.', '..XXX..', 'X.XXX.X', '.XXXXX.', 'X.XXX.X', '.XXXXX.', '.X.X.X.', '..X.X..'], { X: '#fff' }),
    pix(['X.....X', '.X...X.', '..XXX..', '.XXXXX.', 'X.XXX.X', '.XXXXX.', 'X.XXX.X', '..X.X..', '.X...X.'], { X: '#fff' })
  ];
  const LEGS = [pix(['X..X', 'X..X', '.XX.'], { X: SOUL }), pix(['.XX.', 'X..X', 'X..X'], { X: SOUL })];

  // the boss: the six Reko logo pieces (4 brush corners + 2 eyes), rasterized onto a 100x98 pixel grid and drawn 2x,
  // so the smooth logo becomes a crisp pixel sprite like the game's monsters
  const PIECES = [1, 2, 3, 4, 5, 6].map((i) => { const im = new Image(); im.src = `assets/logo/reko-piece-${i}.svg`; return im; });
  const BW = 100, BH = 98, BOSS = { x: 320, y: 124 }; // sprite grid, and the logo's centre on screen
  let sprites = null;
  function tint(src, rgb) {
    const o = document.createElement('canvas'); o.width = src.width; o.height = src.height;
    const x = o.getContext('2d');
    x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = rgb; x.fillRect(0, 0, o.width, o.height);
    return o;
  }
  function buildBoss() {
    sprites = PIECES.map((im) => {
      const o = document.createElement('canvas'); o.width = BW; o.height = BH;
      const x = o.getContext('2d', { willReadFrequently: true });
      x.drawImage(im, 0, 0, BW, BH);
      let x0 = BW, y0 = BH, x1 = 0, y1 = 0;
      try {
        const d = x.getImageData(0, 0, BW, BH), p = d.data;
        for (let i = 0; i < BW * BH; i++) {
          if (p[i * 4 + 3] > 100) {
            p[i * 4] = 254; p[i * 4 + 1] = 119; p[i * 4 + 2] = 0; p[i * 4 + 3] = 255;
            const px = i % BW, py = (i / BW) | 0;
            x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
          } else p[i * 4 + 3] = 0;
        }
        x.putImageData(d, 0, 0);
      } catch (err) { x0 = 0; y0 = 0; x1 = BW; y1 = BH; } // pixel read blocked: keep the smooth drawing
      return { cv: o, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, box: [x0, y0, x1, y1], cyan: tint(o, 'rgba(0,230,170,1)'), mag: tint(o, 'rgba(255,0,120,1)') };
    });
    // one eye on its own (for the wink lasers)
    const e = sprites[4], [x0, y0, x1, y1] = e.box, o = document.createElement('canvas');
    o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
    o.getContext('2d').drawImage(e.cv, -x0, -y0);
    sprites.eye = o;
    // the logo at half size, one cropped piece each (orange, blue and white for the flash) plus its pixel mask: the
    // boomerangs of the breakpoint attack, drawn 2x like the boss so they keep the same chunky pixels
    sprites.small = PIECES.map((im) => {
      const w = BW / 2, h = Math.ceil(BH / 2), t = document.createElement('canvas'); t.width = w; t.height = h;
      const x = t.getContext('2d', { willReadFrequently: true });
      x.drawImage(im, 0, 0, w, h);
      let x0 = w, y0 = h, x1 = 0, y1 = 0, d = null;
      try {
        d = x.getImageData(0, 0, w, h);
        for (let i = 0; i < w * h; i++) {
          const on = d.data[i * 4 + 3] > 100;
          d.data[i * 4] = 254; d.data[i * 4 + 1] = 119; d.data[i * 4 + 2] = 0; d.data[i * 4 + 3] = on ? 255 : 0;
          if (on) { const px = i % w, py = (i / w) | 0; x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py); }
        }
        x.putImageData(d, 0, 0);
      } catch (err) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; d = null; }
      const cw = x1 - x0 + 1, ch = y1 - y0 + 1, o = document.createElement('canvas'); o.width = cw; o.height = ch;
      o.getContext('2d').drawImage(t, -x0, -y0);
      const mask = new Uint8Array(cw * ch);
      for (let yy = 0; yy < ch; yy++) for (let xx = 0; xx < cw; xx++) mask[yy * cw + xx] = d ? d.data[((y0 + yy) * w + x0 + xx) * 4 + 3] > 0 : 1;
      return { cv: o, blue: tint(o, BLUE), white: tint(o, '#fff'), mask, w: cw, h: ch };
    });
  }
  const ready = () => sprites || (PIECES.every((im) => im.complete && im.naturalWidth) && (buildBoss(), sprites));

  /* ---------- game state ---------- */
  const BOX_MENU = { x0: 37, y0: 255, x1: 602, y1: 385 };
  const BTN = [
    { x: 32, label: 'FIGHT', icon: 'fight' },
    { x: 185, label: 'ACT', icon: 'act' },
    { x: 345, label: 'ITEM', icon: 'item' },
    { x: 500, label: 'MERCY', icon: 'mercy' }
  ];
  const BTN_Y = 432, BTN_W = 110, BTN_H = 42;
  const BOSS_HP = 1550, SOUL_R = 5; // ten perfect hits

  const G = {
    t: 0, title: true, ui: false, boxShow: false, box: { ...BOX_MENU },
    soul: { x: 320, y: 240, vis: false, mode: 'red', vy: 0, ground: false, inv: 0, moved: false, broken: false, run: false },
    player: { name: 'YOU', lv: 1, hp: 20, max: 20 },
    boss: null, bullets: [], fx: [], shards: [],
    boxTy: null, bubble: null, list: null, meter: null, hpBar: null, inp: null,
    btn: 0, btnHi: -1, btnShake: [0, 0, 0, 0], soulAt: null, queuedBtn: null,
    shakeT: 0, flash: 0, fade: 0, over: null, overTy: null, end: null,
    deaths: 0, drag: { dx: 0, dy: 0, hold: false }, jumpPress: false
  };

  function reset() {
    const max = Math.min(32, 20 + Math.max(0, G.deaths - 1) * 4); // Reko quietly patches your HP after a couple of game overs
    Object.assign(G, {
      title: false, ui: false, boxShow: false, box: { ...BOX_MENU }, bullets: [], fx: [], shards: [],
      boxTy: null, bubble: null, list: null, meter: null, hpBar: null, inp: null,
      btn: 0, btnHi: -1, soulAt: null, queuedBtn: null, shakeT: 0, flash: 0, fade: 0, over: null, overTy: null, end: null,
      turn: 0, spares: 0, kindness: 0, acts: {}, debug: false, items: { potion: 4, burger: 1 }, hits: 0, phase2: false, finaleNext: false, finaleDone: false, spareable: false,
      seen: {}, sighs: null, bag: null, lastAtk: null, fbag: null, paintI: 0, flavor: '', last: null
    });
    G.player = { name: 'YOU', lv: 1, hp: max, max };
    G.boss = { hp: BOSS_HP, max: BOSS_HP, show: false, assemble: 1, shake: 0, alpha: 1, mood: 'idle', spared: false, dust: null, nextBlink: 1, blinkT: 0, glitchT: 0, winkAt: 0, winkT: -9 };
    Object.assign(G.soul, { vis: false, mode: 'red', vy: 0, ground: false, inv: 0, moved: false, broken: false, run: false });
  }
  reset();
  G.title = true;

  /* ---------- async flow ----------
     The fight is written as one async story (await sleep / await a key press). Every wait belongs to the current
     run; closing the window rejects them all with CANCEL, losing all HP rejects them with DEAD (→ game over). */
  const CANCEL = { cancel: true }, DEAD = { dead: true };
  const RUN = { id: 0, dead: false };
  const pending = new Set();
  const sleep = (sec) => new Promise((res, rej) => pending.add({ res, rej, t: G.t + sec }));
  const frameTick = () => sleep(0);
  function waitInput(inp) {
    return new Promise((res, rej) => {
      const p = { res, rej };
      pending.add(p);
      inp.done = (v) => { if (G.inp === inp) G.inp = null; pending.delete(p); res(v); };
      G.inp = inp;
    });
  }
  function abortAll(err) {
    for (const p of [...pending]) { pending.delete(p); p.rej(err); }
    G.inp = null;
  }
  const go = (p) => p.catch((e) => { if (e !== CANCEL && e !== DEAD) console.error(e); });
  async function tween(dur, fn) {
    const t0 = G.t;
    for (;;) {
      const k = dur <= 0 ? 1 : Math.min(1, (G.t - t0) / dur);
      fn(k);
      if (k >= 1) return;
      await frameTick();
    }
  }

  // typed text: `voice` blips every other letter, punctuation pauses a little (like the game's dialogue)
  const typer = (text, voice = 'txt', cps = 34) => ({ text, n: 0, acc: 0, cps, voice, k: 0 });
  const typed = (ty) => !ty || ty.n >= ty.text.length;
  const full = (ty) => { ty.n = ty.text.length; return ty; };
  function stepTyper(ty, dt) {
    if (typed(ty)) return;
    ty.acc += dt * ty.cps;
    while (ty.acc >= 1 && ty.n < ty.text.length) {
      const ch = ty.text[ty.n++];
      ty.acc -= 1;
      if (ch.trim() && ch !== '*' && ty.k++ % 2 === 0) au.play(ty.voice, ch.charCodeAt(0));
      if ('.!?'.includes(ch) && !'.!?'.includes(ty.text[ty.n] || '')) ty.acc -= 5;
      else if (ch === ',') ty.acc -= 2.5;
    }
  }
  const waitTy = (ty) => waitInput({ kind: 'wait', ty });
  async function say(text) {
    G.bubble = typer(text, 'txtReko', 30);
    await waitTy(G.bubble);
    G.bubble = null;
  }
  async function narrate(text) {
    G.boxTy = typer(text);
    await waitTy(G.boxTy);
  }
  const fire = (end) => document.dispatchEvent(new CustomEvent('reko:bossfight', { detail: { end } }));

  /* ---------- the words ---------- */
  const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const SPARE_TALK = [
    'spare? in a\nBOSSFIGHT?\nbold move.',
    "you're not\neven going\nto try?\nsuspicious.",
    'stop being\nnice. I have\nattacks to\ntest!!',
    "ok, honestly?\nthis is kinda\nsweet.",
    "why won't\nyou fight\nback...?",
    'fine. FINE.\nyou win the\nnice person\naward.',
    '...'
  ];
  const HIT_TALK = [
    'OW!! that\nwas my main\nbranch.',
    "rude.\nI'm filing a\nbug report.",
    "ok, now\nit's\npersonal.",
    'my logo has\nscratches\nnow. great.',
    '*heavy\nbreathing*',
    'I just wanted\nto show you\nmy\nportfolio...',
    '......'
  ];
  const MISS_TALK = ['missed!\nskill issue.', 'ha! a\nwhiff.', 'did you\neven aim?'];
  const PHASE2_TALK = ['ok. you asked\nfor it.', "PHASE TWO!!\n(I've always\nwanted to\nsay that)"];
  const TIRED_TALK = ['...', "I'm out of\npatterns.", 'you can\nSPARE me\nnow.\n(please)'];
  // his turns once he's out of patterns: a sigh (from a shuffled bag), then he either rests or drops a few dots (50/50)
  const SIGH_TALK = ['*sigh*', "*sigh*\nI'm so\ntired.", 'can we just\nbe done?', '...zzz...\noh. sorry.', 'my fans are\nat 100%...', 'I have\nnothing\nleft...', 'just SPARE\nme already.', '*yawns*'];
  const REST_TALK = ["...nah.\ntoo tired.", "I'll skip\nthis turn.", "you go.\nI'll just\nsit here.", 'attack?\nwhat attack?'];
  const DOTS_TALK = ['fine. one\nlast dot.', "here's what\nI've got\nleft.", '. . .'];
  // ACT: each act has what the box says and what Reko says back (the n-th time; the last one repeats)
  const ACTS = [
    { id: 'check', label: 'Check',
      text: ['* REKO - ATK 7 DEF 3\n* Makes websites. Fights like\n  one too.'],
      talk: ['hey, I can\nhear you\nreading that.', 'yes, still\nATK 7.\nstop checking.'] },
    { id: 'compliment', label: 'Compliment', kindness: true,
      text: ['* You tell Reko his website\n  looks really cool.', "* You compliment his logo.\n* He's blushing. In orange.", '* You say his code is clean.\n* That one was a lie.'],
      talk: ['w-what?\n...thanks.\nI made it\nmyself!', 'stop it.\n(don\'t stop)', 'ok now I\nknow you\'re\nlying.'] },
    { id: 'debug', label: 'Debug',
      text: ["* You point at a bug in his\n  code.\n* Reko's DEF dropped!", '* You find another bug.\n* Reko pretends not to see\n  it.'],
      talk: ["that's not\na bug, it's\na FEATURE!!", 'la la la\nI can\'t hear\nyou'] },
    { id: 'wink', label: 'Wink', kindness: true,
      text: ['* You wink at Reko.\n* Reko winks back.'],
      talk: ['did you just\nwink at me?', ';)'] }
  ];
  const ITEMS = {
    potion: { label: 'Potion', heal: 10, text: '* You drank a Potion.', talk: ['hey! no\nhealing in\nMY fight!', 'how many of\nthose do you\nhave??', 'stop drinking\nthose!!'] },
    burger: { label: 'Code Burger', heal: 999, text: '* You ate the Code Burger.\n* It tastes like semicolons.', talk: ['was that MY\nlunch??'] }
  };
  const NO_ITEMS = '* Your pockets are empty.\n* 404: items not found.';
  const WINK = '* Reko winks at you.';
  const FLAVOR = [
    '* Reko is refactoring his\n  attack patterns.',
    '* Smells like burnt coffee\n  and orange paint.',
    '* Reko checks the console.\n* 47 warnings. He ignores\n  all of them.',
    '* Reko pretends this was\n  all part of the plan.',
    '* It works on his machine.',
    '* The window is slightly too\n  small for this fight.',
    WINK,
    '* Reko is pushing to main\n  on a Friday.',
    '* You hear a fan spinning\n  very, very fast.',
    '* Reko forgot a semicolon.\n  Somewhere.',
    '* Reko is googling how to\n  win a bossfight.',
    '* The logo stares at you.\n* You stare back.',
    '* Reko commits "final fix".\n* (it isn\'t)',
    '* Reko clears the cache.\n* Nothing changes.'
  ];
  // flavor texts come out of a shuffled bag, so every one shows up before any repeats
  function flavor() {
    const P = G.player, B = G.boss;
    if (G.spareable) return '* Reko is out of patterns.\n* He looks tired.';
    if (P.hp <= Math.ceil(P.max * 0.3)) return '* Your HP is leaking like a\n  memory leak.';
    if (B.hp <= B.max * 0.35) return "* Reko's logo is held\n  together with tape.";
    if (G.spares + G.kindness >= 4 && G.hits === 0) return "* Reko doesn't know what to\n  do with all this kindness.";
    if (!G.fbag || !G.fbag.length) G.fbag = shuffle(FLAVOR);
    return G.fbag.shift();
  }

  /* ---------- bullets ----------
     White hurts on touch. Blue hurts only if you're moving ("blue = stop, like a breakpoint"), orange (Reko's own
     colour) hurts only if you're standing still ("keep moving"). */
  const COLS = { w: '#fff', b: BLUE, o: OR };
  const spawn = (b) => { G.bullets.push(b); return b; };
  function bullet(o) {
    return Object.assign({
      x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 99, harm: true, color: 'w', dmg: 3, clip: true, dead: false, r: 6,
      update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; },
      hits(x, y, r) { return Math.hypot(x - this.x, y - this.y) < this.r + r; },
      draw() {}
    }, o);
  }
  function hitRect(px, py, r, cx, cy, w, h, ang = 0) {
    let dx = px - cx, dy = py - cy;
    if (ang) { const cs = Math.cos(-ang), sn = Math.sin(-ang); [dx, dy] = [dx * cs - dy * sn, dx * sn + dy * cs]; }
    const qx = Math.max(Math.abs(dx) - w / 2, 0), qy = Math.max(Math.abs(dy) - h / 2, 0);
    return qx * qx + qy * qy < r * r;
  }

  const GLYPHS = '{ } ( ) ; < / > = 0 1 [ ] # $ & !'.split(' ');
  const glyph = (x, y, vx, vy, ch) => bullet({
    x, y, vx, vy, ch, r: 6, dmg: 2,
    draw() { c.fillStyle = '#fff'; c.font = `28px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(this.ch, this.x, this.y); c.textAlign = 'left'; c.textBaseline = 'top'; }
  });
  // a whole line of code falling, with one gap to slip through
  function codeLine(speed = 95) {
    const B = G.box, gx = rand(B.x0 + 30, B.x1 - 30);
    const str = pick(['if(sleep)return;', 'while(true){}', 'fix(bug);bug++;', 'console.log(x);', 'echo hello']);
    let k = 0;
    for (let x = B.x0 + 7; x < B.x1; x += 13, k++) {
      if (Math.abs(x - gx) < 24) continue;
      spawn(glyph(x, B.y0 - 14, 0, speed, str[k % str.length]));
    }
  }
  function rainGlyph(fast = 1) {
    const B = G.box;
    spawn(glyph(rand(B.x0 + 8, B.x1 - 8), B.y0 - 14, rand(-20, 20), rand(115, 165) * fast, pick(GLYPHS)));
  }

  // a brush stroke: a flickering guide line and a dot where the brush will start, then it paints its way across the
  // box from one side to the other (only the painted part hurts), holds for a moment and fades. Every stroke gets the
  // next paint colour; blue and orange are left out because those colours mean something.
  const PAINT = ['#e5262f', '#35d265', '#b46bff', '#ffd23f', '#ff5fa2', '#f4f1ea', '#2ee6c4'];
  function stroke(x, y, ang, warn, speed = 520) {
    const B = G.box, ux = Math.cos(ang), uy = Math.sin(ang);
    // where the line through (x, y) enters and leaves the box (slab method), plus a little overhang
    let t0 = -Infinity, t1 = Infinity;
    for (const [d, p, lo, hi] of [[ux, x, B.x0, B.x1], [uy, y, B.y0, B.y1]]) {
      if (Math.abs(d) < 1e-6) continue;
      const a = (lo - p) / d, b = (hi - p) / d;
      t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
    }
    if (!(t1 > t0)) { t0 = -150; t1 = 150; }
    t0 -= 14; t1 += 14;
    let sx = x + ux * t0, sy = y + uy * t0, ex = x + ux * t1, ey = y + uy * t1;
    if (Math.random() < 0.5) [sx, sy, ex, ey] = [ex, ey, sx, sy]; // which side it starts from
    const len = Math.hypot(ex - sx, ey - sy), dir = Math.atan2(ey - sy, ex - sx), paint = len / speed, hold = 0.22;
    const col = PAINT[(G.paintI = (G.paintI || 0) + 1) % PAINT.length];
    const teeth = Array.from({ length: Math.ceil(len / 8) }, () => Math.random());
    return spawn(bullet({
      x: sx, y: sy, ang: dir, len, warn, paint, hold, col, harm: false, life: warn + paint + hold + 0.25, th: 18, dmg: 3,
      done() { return clamp((this.age - this.warn) * speed, 0, this.len); },
      update() {
        const a = this.age;
        this.harm = a >= this.warn + 0.02 && a < this.warn + this.paint + this.hold;
        if (!this.snd && a >= this.warn) { this.snd = true; au.play('brush', this.paint); G.shakeT = Math.max(G.shakeT, 0.06); }
      },
      hits(px, py, r) {
        const p = this.done();
        if (p < 2) return false;
        return hitRect(px, py, r, this.x + Math.cos(this.ang) * p / 2, this.y + Math.sin(this.ang) * p / 2, p, this.th, this.ang);
      },
      draw() {
        const a = this.age, th = this.th;
        c.save(); c.translate(this.x, this.y); c.rotate(this.ang);
        c.fillStyle = this.col;
        if (a < this.warn) {
          if (Math.floor(a * 18) % 2 === 0) { c.globalAlpha = 0.55; c.fillRect(0, -1, this.len, 2); }
          c.globalAlpha = 1;
          const r = 4 + Math.sin(a * 30) * 2; // the brush waiting at its start
          c.fillRect(8 - r, -r, r * 2, r * 2);
        } else {
          const p = this.done(), end = this.warn + this.paint + this.hold;
          c.globalAlpha = a > end ? Math.max(0, 1 - (a - end) / 0.25) : 1;
          c.fillRect(0, -th / 2, p, th);
          teeth.forEach((v, i) => { // ragged bristle edges, like the logo's brush strokes
            const bx = i * 8;
            if (bx > p - 4) return;
            if (v > 0.45) c.fillRect(bx, -th / 2 - 4, 6, 4);
            if (v < 0.4) c.fillRect(bx + 2, th / 2, 5, 4);
            if (v > 0.8) { c.fillStyle = '#000'; c.fillRect(bx, -2, 7, 2); c.fillStyle = this.col; }
          });
          if (p < this.len) { c.fillStyle = '#fff'; c.fillRect(p - 5, -th / 2 - 5, 8, th + 10); } // the brush head
        }
        c.restore();
      }
    }));
  }
  function strokeNear(spread = 26, warn = 0.6, speed) {
    const s = G.soul;
    stroke(s.x + rand(-spread, spread), s.y + rand(-spread, spread), rand(0, Math.PI), warn, speed);
    au.play('warn');
  }

  // little pixel bugs that crawl after the soul
  function spawnBug(hard) {
    const B = G.box;
    let x = B.x0, y = B.y0;
    for (let k = 0; k < 10; k++) {
      const side = Math.floor(rand(0, 4));
      x = side === 0 ? B.x0 + 6 : side === 1 ? B.x1 - 6 : rand(B.x0 + 6, B.x1 - 6);
      y = side === 2 ? B.y0 + 6 : side === 3 ? B.y1 - 6 : rand(B.y0 + 6, B.y1 - 6);
      if (Math.hypot(x - G.soul.x, y - G.soul.y) > 75) break;
    }
    au.play('bug');
    spawn(bullet({
      x, y, r: 5, dmg: 2, life: hard ? 2.7 : 3.4, speed: hard ? 76 : 56, turn: hard ? 2.0 : 1.7, heading: Math.atan2(G.soul.y - y, G.soul.x - x),
      update(dt) {
        if (this.age < 0.35) return; // it pops in first
        let d = Math.atan2(G.soul.y - this.y, G.soul.x - this.x) - this.heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.heading += clamp(d, -this.turn * dt, this.turn * dt);
        this.x += Math.cos(this.heading) * this.speed * dt;
        this.y += Math.sin(this.heading) * this.speed * dt;
        this.harm = this.age < this.life - 0.35;
      },
      draw() {
        const a = this.age, s = a < 0.35 ? easeBack(a / 0.35) : 1;
        c.globalAlpha = a > this.life - 0.35 ? Math.max(0, (this.life - a) / 0.35) : 1;
        c.save(); c.translate(this.x, this.y); c.rotate(this.heading + Math.PI / 2); c.scale(s, s);
        c.drawImage(BUG[Math.floor(a * 9) % 2], -7, -9, 14, 18);
        c.restore(); c.globalAlpha = 1;
      }
    }));
  }

  // a bar sliding across the whole box (blue / orange / white, optionally with a gap)
  function bar(color, side, v, w = 14, gapY = null) {
    const B = G.box, dir = side === 'L' ? 1 : -1;
    const segs = gapY === null ? [[B.y0 - 6, B.y1 + 6]] : [[B.y0 - 6, gapY - 21], [gapY + 21, B.y1 + 6]];
    spawn(bullet({
      x: side === 'L' ? B.x0 - w : B.x1 + w, vx: dir * v, w, color, segs, dmg: 3,
      hits(px, py, r) { return this.segs.some(([a, b]) => hitRect(px, py, r, this.x, (a + b) / 2, this.w, b - a)); },
      draw() { c.fillStyle = COLS[this.color]; this.segs.forEach(([a, b]) => c.fillRect(this.x - this.w / 2, a, this.w, b - a)); }
    }));
  }

  /* breakpoint: the logo comes apart, half of it parks left of the box and half right, and about half of the pieces
     turn blue. Then, one at a time and from alternate sides, a piece is thrown at the soul (fast, homing a little),
     overshoots, slows down and comes back like a boomerang; the next one only leaves once it is home. Blue and
     orange work like the bars (blue: stand still, orange: keep moving). A bit see-through, so the soul stays visible. */
  const BOOM_A = 0.78;
  async function boomerangs(hard) {
    const Bx = G.box, B = G.boss, sm = sprites.small, ox = BOSS.x - BW, oy = BOSS.y - BH;
    const sides = { L: [], R: [] };
    sm.forEach((p, i) => sides[sprites[i].cx < BW / 2 ? 'L' : 'R'].push(i));
    let cols;
    do cols = sm.map(() => (Math.random() < 0.5 ? 'b' : 'o')); while (!cols.includes('b') || !cols.includes('o'));
    const vOut = hard ? 480 : 430, turn = hard ? 2.6 : 2.1, brakeA = hard ? 1500 : 1350, vBack = hard ? 340 : 300;
    const pcs = sm.map((p, i) => {
      const side = sprites[i].cx < BW / 2 ? 'L' : 'R', list = sides[side], k = list.indexOf(i);
      const hx = side === 'L' ? Bx.x0 - 48 : Bx.x1 + 48, hy = Bx.y0 + ((k + 0.5) * (Bx.y1 - Bx.y0)) / list.length;
      const sx = ox + sprites[i].cx * 2, sy = oy + sprites[i].cy * 2;
      return spawn(bullet({
        p, i, sx, sy, hx, hy, x: sx, y: sy, sc: 4, ang: 0, st: 'in', v: 0, hd: 0, t0: 0, spun: 0, wobT: -9, flashT: -9,
        clip: false, harm: false, color: 'o', dmg: 3,
        update(dt) {
          const s = G.soul;
          if (this.st === 'out') {
            // homing: turn towards the soul (at most `turn` rad/s) until it has flown past it
            let d = Math.atan2(s.y - this.y, s.x - this.x) - this.hd;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            if ((Math.cos(d) < 0 && Math.hypot(s.x - this.x, s.y - this.y) > 26) || G.t - this.t0 > 1.2) this.st = 'brake';
            else this.hd += clamp(d, -turn * dt, turn * dt);
          } else if (this.st === 'brake') {
            this.v = Math.max(0, this.v - brakeA * dt);
            if (this.v < 25) {
              // turn round: head roughly for home, a little off to one side, so the way back is a gentle curve
              this.st = 'back'; au.play('boomBack');
              this.hd = Math.atan2(this.hy - this.y, this.hx - this.x) + (Math.random() < 0.5 ? -0.55 : 0.55);
            }
          } else if (this.st === 'back') {
            // the way home: slower, curving round, easing into the catch
            const tx = this.hx - this.x, ty = this.hy - this.y, dist = Math.hypot(tx, ty);
            let d = Math.atan2(ty, tx) - this.hd;
            d = Math.atan2(Math.sin(d), Math.cos(d));
            this.hd += clamp(d, -3 * dt, 3 * dt);
            this.v = Math.min(vBack, this.v + 900 * dt);
            if (dist < 50) this.v = Math.min(this.v, Math.max(110, dist * 4));
            if (dist < 7 || G.t - this.t0 > 5) { this.st = 'park'; this.x = this.hx; this.y = this.hy; this.v = 0; this.harm = false; au.play('boomCatch'); }
          }
          if (this.st === 'out' || this.st === 'brake' || this.st === 'back') {
            this.x += Math.cos(this.hd) * this.v * dt;
            this.y += Math.sin(this.hd) * this.v * dt;
            const w = ((40 + this.v) / 24) * dt; // it spins faster the faster it flies
            this.ang += w; this.spun += w;
            if (this.spun > Math.PI * 2) { this.spun -= Math.PI * 2; au.play('whirr', 0.012 + this.v / 15000); }
          }
        },
        hits(px, py, r) {
          // pixel-exact: the soul's middle and a ring around it, turned into the piece's own pixels
          const cs = Math.cos(-this.ang), sn = Math.sin(-this.ang), P = this.p, sc = this.sc;
          for (let k = 0; k < 7; k++) {
            const a = (k * Math.PI * 2) / 6, rr = k === 6 ? 0 : r * 0.8;
            const dx = px + Math.cos(a) * rr - this.x, dy = py + Math.sin(a) * rr - this.y;
            const lx = Math.floor((dx * cs - dy * sn) / sc + P.w / 2), ly = Math.floor((dx * sn + dy * cs) / sc + P.h / 2);
            if (lx >= 0 && ly >= 0 && lx < P.w && ly < P.h && P.mask[ly * P.w + lx]) return true;
          }
          return false;
        },
        draw() {
          const P = this.p, wob = G.t - this.wobT < 0.3 ? Math.sin((G.t - this.wobT) * 70) * 2 : 0;
          c.save();
          c.globalAlpha = BOOM_A;
          c.translate(Math.round(this.x + wob), Math.round(this.y)); c.rotate(this.ang); c.scale(this.sc, this.sc);
          c.drawImage(this.color === 'b' ? P.blue : P.cv, -P.w / 2, -P.h / 2);
          const f = G.t - this.flashT;
          if (f < 0.25) { c.globalAlpha = BOOM_A * (1 - f / 0.25); c.drawImage(P.white, -P.w / 2, -P.h / 2); }
          c.restore();
        }
      }));
    });
    B.away = pcs.map(() => true);

    // 1. it comes apart: every piece whooshes to its spot beside the box, shrinking to half size and spinning once
    au.play('piecesOff');
    await tween(0.6, (k) => {
      const e = easeOut(k);
      pcs.forEach((pc) => { pc.x = lerp(pc.sx, pc.hx, e); pc.y = lerp(pc.sy, pc.hy, e); pc.sc = lerp(4, 2, e); pc.ang = e * Math.PI * 2; });
    });
    pcs.forEach((pc) => { pc.st = 'park'; pc.ang = 0; });
    // 2. some of them turn blue
    await sleep(0.25);
    let nb = 0;
    for (const [i, pc] of pcs.entries()) {
      if (cols[i] !== 'b') continue;
      pc.color = 'b'; pc.flashT = G.t; au.play('pieceBlue', nb++);
      await sleep(0.1);
    }
    await sleep(0.35);

    // 3. the throws: every piece once, alternating sides, each with a little wobble first so you can see which one
    // is next. Phase one: the next one gets ready as the last one comes in to land (outside the box by then).
    // Phase two: the next one starts the moment the last one reaches you, so they come right after each other.
    const q = { L: shuffle(sides.L), R: shuffle(sides.R) }, order = [];
    let side = Math.random() < 0.5 ? 'L' : 'R';
    while (q.L.length || q.R.length) {
      if (!q[side].length) side = side === 'L' ? 'R' : 'L';
      order.push(q[side].shift());
      side = side === 'L' ? 'R' : 'L';
    }
    for (const [k, i] of order.entries()) {
      const pc = pcs[i], s = G.soul;
      pc.wobT = G.t; au.play('tick', pc.color === 'o' ? 1568 : 1046.5, 0.03);
      await sleep(hard ? 0.24 : 0.32);
      pc.st = 'out'; pc.v = vOut; pc.hd = Math.atan2(s.y - pc.y, s.x - pc.x); pc.t0 = G.t; pc.harm = true;
      au.play('boomThrow');
      if (k === order.length - 1) break;
      if (hard) while (pc.st === 'out' && Math.hypot(s.x - pc.x, s.y - pc.y) > 30) await frameTick();
      else while (pc.st !== 'park' && (pc.st !== 'back' || Math.hypot(pc.hx - pc.x, pc.hy - pc.y) > 70)) await frameTick();
    }
    while (pcs.some((pc) => pc.st !== 'park')) await frameTick();

    // 4. the pieces fly back together into the logo
    await sleep(0.35);
    au.play('assemble');
    pcs.forEach((pc) => { pc.sx = pc.x; pc.sy = pc.y; pc.harm = false; });
    await tween(0.5, (k) => {
      const e = easeOut(k);
      pcs.forEach((pc, i) => {
        pc.x = lerp(pc.sx, ox + sprites[i].cx * 2, e); pc.y = lerp(pc.sy, oy + sprites[i].cy * 2, e);
        pc.sc = lerp(2, 4, e); pc.ang = -e * Math.PI * 2;
      });
    });
    pcs.forEach((pc) => { pc.dead = true; });
    B.away = null;
    await sleep(0.3);
  }

  // the same bar lying down, sliding through the box from the top or the bottom
  function hbar(color, from, v, h = 14) {
    const B = G.box, dir = from === 'T' ? 1 : -1;
    spawn(bullet({
      x: (B.x0 + B.x1) / 2, y: from === 'T' ? B.y0 - h : B.y1 + h, vy: dir * v, w: B.x1 - B.x0 + 12, h, color, dmg: 3,
      life: (B.y1 - B.y0 + h * 2 + 20) / v,
      hits(px, py, r) { return hitRect(px, py, r, this.x, this.y, this.w, this.h); },
      draw() { c.fillStyle = COLS[this.color]; c.fillRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h); }
    }));
  }

  // blue-soul obstacles sliding along the floor (posts, loading bars) or hanging from the ceiling, from either side
  function obstacle(kind, v, side = 'R', size) {
    const B = G.box, dir = side === 'L' ? 1 : -1;
    let w, h, y;
    if (kind === 'ceil') { w = 14; h = B.y1 - (size || 30) - (B.y0 - 6); y = B.y0 - 6 + h / 2; } // leaves a gap above the floor
    else if (kind === 'long') { w = size || 70; h = 14; y = B.y1 - h / 2; }
    else { w = 12; h = size || 22; y = B.y1 - h / 2; } // a post
    spawn(bullet({
      x: side === 'L' ? B.x0 - w / 2 - 6 : B.x1 + w / 2 + 6, y, w, h, vx: dir * v, dmg: 3,
      hits(px, py, r) { return hitRect(px, py, r, this.x, this.y, this.w, this.h); },
      draw() {
        c.fillStyle = '#fff'; c.fillRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
        if (this.w > 30) { c.fillStyle = '#000'; for (let i = 6; i < this.w - 4; i += 10) c.fillRect(this.x - this.w / 2 + i, this.y - 3, 5, 6); } // a loading bar
      }
    }));
  }

  // gravity.js: a stream of random obstacles. They come in waves from one side, then the other; each wave has its own
  // speed, each obstacle its own size. Blue and orange bars join in once `barsAt` seconds have passed.
  async function gravityRun(dur, hard, barsAt = 0, gapK = 1) { // gapK > 1 spaces the obstacles out
    const t0 = G.t;
    let side = pick(['L', 'R']), left = 0, v = 0;
    await sleep(0.6);
    while (G.t - t0 < dur) {
      if (left-- <= 0) {
        if (v) { side = side === 'L' ? 'R' : 'L'; await sleep(hard ? 0.35 : 0.5); }
        left = Math.floor(rand(2, 5)); v = hard ? rand(195, 250) : rand(150, 205);
      }
      const pool = ['post', 'post', 'post', 'tall', 'long', 'ceil', 'ceil', 'double', 'stairs'];
      if (G.t - t0 >= barsAt) pool.push('b', 'o');
      if (hard) pool.push('combo', 'double', 'tall', 'b', 'o');
      const k = pick(pool);
      let wait = rand(0.6, 0.9) * (hard ? 0.75 : 1) * gapK;
      if (k === 'post') obstacle('post', v, side, rand(16, 30));
      else if (k === 'tall') obstacle('post', v, side, rand(34, 46));
      else if (k === 'long') obstacle('long', v, side, rand(45, 95));
      else if (k === 'ceil') obstacle('ceil', v, side, rand(26, 34));
      else if (k === 'double') { obstacle('post', v, side, rand(14, 24)); await sleep(rand(46, 60) / v); obstacle('post', v, side, rand(14, 24)); wait += 0.15; }
      else if (k === 'stairs') {
        for (const h of [16, 28, 40]) { obstacle('post', v, side, h + rand(-3, 3)); await sleep(hard ? 0.4 : 0.5); }
        wait += 0.1;
      } else if (k === 'combo') { obstacle('ceil', v, side, rand(26, 32)); await sleep(0.62); obstacle('post', v, side, rand(16, 26)); }
      else { // a blue bar (stand still) or a wide orange one (keep moving)
        await sleep(0.25);
        bar(k, side, v * 0.85, k === 'o' ? rand(24, 50) : 14);
        au.play('tick', k === 'o' ? 1568 : 1046.5, 0.03);
        wait += 0.35;
      }
      await sleep(wait);
    }
  }

  // one of Reko's eyes floats in outside the box, aims, winks... and fires
  // `down`: the eye floats somewhere above the box and fires down at the soul, never more than ~40° off vertical
  // (everything.js uses only these)
  function laser(warn = 0.78, down = false) {
    const B = G.box, s = G.soul;
    const side = down ? 'D' : pick(['L', 'R', 'T', 'TL', 'TR']);
    const pos = {
      L: [B.x0 - 48, rand(B.y0 + 10, B.y1 - 10)], R: [B.x1 + 48, rand(B.y0 + 10, B.y1 - 10)],
      T: [rand(B.x0 + 10, B.x1 - 10), B.y0 - 48], D: [rand(B.x0 - 30, B.x1 + 30), B.y0 - 48], TL: [B.x0 - 38, B.y0 - 38], TR: [B.x1 + 38, B.y0 - 38]
    }[side];
    const [x, y] = pos, ang = down ? clamp(Math.atan2(s.y - y, s.x - x) + rand(-0.05, 0.05), Math.PI / 2 - 0.7, Math.PI / 2 + 0.7) : Math.atan2(s.y - y, s.x - x) + rand(-0.04, 0.04);
    au.play('charge');
    return spawn(bullet({
      x, y, ang, warn, fire: 0.42, clip: false, harm: false, life: warn + 0.72, dmg: 4,
      update() {
        const a = this.age;
        this.harm = a > this.warn + 0.04 && a < this.warn + this.fire;
        if (!this.s1 && a > this.warn - 0.2) { this.s1 = true; au.play('wink'); }
        if (!this.s2 && a >= this.warn) { this.s2 = true; au.play('laser'); G.shakeT = Math.max(G.shakeT, 0.2); }
      },
      hits(px, py, r) { const L = 900; return hitRect(px, py, r, this.x + Math.cos(this.ang) * L / 2, this.y + Math.sin(this.ang) * L / 2, L, 20, this.ang); },
      draw() {
        const a = this.age;
        c.save();
        c.beginPath(); c.rect(0, 0, W, 392); c.clip(); // the beam stops above the HP line and the buttons
        c.translate(this.x, this.y); c.rotate(this.ang);
        if (a < this.warn) {
          if (Math.floor(a * 16) % 2 === 0) { c.fillStyle = 'rgba(255,255,255,.45)'; c.fillRect(16, -1, 900, 2); }
        } else {
          const e = a - this.warn;
          const w = e < 0.06 ? 24 * (e / 0.06) : e < this.fire ? 24 + Math.sin(e * 60) * 2 : 24 * Math.max(0, 1 - (e - this.fire) / 0.25);
          c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(10, -w / 2 - 5, 900, w + 10);
          c.fillStyle = '#fff'; c.fillRect(10, -w / 2, 900, w);
        }
        c.restore();
        // the eye itself (upright, like on the logo)
        const eye = sprites && sprites.eye;
        if (!eye) return;
        let open = clamp(a / 0.22, 0, 1);
        if (a > this.warn - 0.2 && a < this.warn - 0.06) open = 0.12; // the wink
        if (a > this.warn + this.fire) open = Math.max(0, 1 - (a - this.warn - this.fire) / 0.25);
        const ew = eye.width * 2, eh = eye.height * 2 * open;
        c.drawImage(eye, this.x - ew / 2, this.y - eh / 2, ew, eh);
      }
    }));
  }

  // achievement toasts, the site's own pop-ups, flying through the box
  function toast(y, fromRight, hard) {
    const B = G.box, w = 112, h = 24, dir = fromRight ? -1 : 1;
    spawn(bullet({
      x: fromRight ? B.x1 + w / 2 : B.x0 - w / 2, y, w, h, vx: dir * rand(170, 230) * (hard ? 1.3 : 1), dmg: 3,
      text: pick(['ACHIEVEMENT!', '+1 BUG', 'TODO: dodge', '404', 'ouch.exe', 'DIE.', 'NEW MESSAGE', 'HAHAHA']),
      hits(px, py, r) { return hitRect(px, py, r, this.x, this.y, this.w, this.h); },
      draw() {
        const x = this.x - this.w / 2, yy = this.y - this.h / 2;
        c.fillStyle = '#fff'; c.fillRect(x, yy, this.w, this.h);
        c.fillStyle = '#000'; c.fillRect(x + 2, yy + 2, this.w - 4, this.h - 4);
        c.fillStyle = '#fff'; c.fillRect(x + 2, yy + 2, 5, this.h - 4);
        c.font = `18px ${FONT}`; c.fillText(this.text, x + 13, yy + 3);
      }
    }));
  }

  /* ---------- attack patterns ----------
     Each one sets its bullet box (width, height) and runs as a little script. Phase two (Reko at half HP) makes every
     one of them a lot harder. */
  const ATK = {
    codeRain: {
      box: [200, 150],
      intro: ['hey!', 'my code is\nrunning away!'],
      async run() {
        const hard = G.phase2, n = hard ? 60 : 34;
        for (let i = 0; i < n; i++) {
          if (i % (hard ? 6 : 9) === (hard ? 5 : 8)) codeLine(hard ? 125 : 95); else rainGlyph(hard ? 1.35 : 1);
          if (i % 3 === 0) au.play('glyph');
          await sleep(hard ? 0.1 : 0.17);
        }
        await sleep(1.5);
      }
    },
    brushSweep: {
      box: [220, 160],
      intro: ['*paints*'],
      async run() {
        const hard = G.phase2, n = hard ? 12 : 8, sp = hard ? 800 : 520;
        for (let i = 0; i < n; i++) {
          strokeNear(26, Math.max(hard ? 0.4 : 0.44, 0.64 - i * 0.02), sp);
          if (hard && i % 3 === 2) stroke(G.soul.x + rand(-45, 45), G.soul.y + rand(-45, 45), rand(0, Math.PI), 0.55, sp);
          await sleep(hard ? 0.55 : 0.9);
        }
        await sleep(1.2);
      }
    },
    bugSwarm: {
      box: [230, 160],
      intro: ["these aren't\nbugs.\nthey're\nfeatures."],
      async run() {
        const hard = G.phase2, n = hard ? 18 : 13;
        for (let i = 0; i < n; i++) { spawnBug(hard); await sleep(hard ? 0.36 : 0.45); }
        await sleep(2.0);
      }
    },
    breakpoint: {
      box: [280, 140],
      intro: ['catch this!'],
      async run() { await boomerangs(G.phase2); }
    },
    gravity: {
      box: [320, 130], blue: true,
      intro: ['activating\ngravity.js...', '...DONE!'],
      async run() {
        const hard = G.phase2;
        await gravityRun(hard ? 13 : 11, hard, hard ? 0 : 4);
        await sleep((G.box.x1 - G.box.x0 + 100) / 150 + 0.2);
      }
    },
    winkLaser: {
      box: [210, 170],
      intro: ["don't look\nme in the\neye."],
      async run() {
        const hard = G.phase2, n = hard ? 11 : 7;
        for (let i = 0; i < n; i++) {
          laser(hard ? 0.6 : 0.78);
          if (i >= n - 2 || (hard && i >= 3)) laser(hard ? 0.62 : 0.78);
          if (hard && i >= n - 2) laser(0.66);
          await sleep(hard ? (i < 2 ? 0.9 : 0.72) : i < 3 ? 1.15 : 0.85);
        }
        await sleep(1.4);
      }
    },
    toasts: {
      box: [300, 150],
      intro: ['try to earn\nthese\nachievements!'],
      async run() {
        const hard = G.phase2, B = G.box, rows = 5, rh = (B.y1 - B.y0) / rows, n = hard ? 20 : 13;
        for (let i = 0; i < n; i++) {
          const r1 = Math.floor(rand(0, rows)), r2 = i % (hard ? 2 : 3) === (hard ? 1 : 2) ? (r1 + 2 + Math.floor(rand(0, 2))) % rows : -1;
          [r1, r2].forEach((r) => { if (r >= 0) toast(B.y0 + rh * (r + 0.5), i % 2 === 0, hard); });
          au.play('toast');
          await sleep(hard ? 0.4 : 0.6);
        }
        await sleep(2.0);
      }
    },
    // everything.js: every pattern at once. Code rains from the sky the whole time. First half: blue soul, gravity.js
    // throws obstacles (and later blue and orange bars). Second half: red soul and a few bugs. All along, eye blasts
    // and brush strokes take turns (the next one only starts once the last one stops hurting): from above / top to
    // bottom in the first half, from any side in the second, where a blue or orange line now and then joins the
    // rotation. It ends with eye blasts in pairs, then it all runs out of steam.
    finale: {
      box: [300, 150], blue: true,
      intro: ['ok.', 'this is\ngenuinely not\nworking! >:(', "let's try my\nfinal\nattack...", 'activating\neverything.js\n...', '...DONE!\n>:D'],
      async run() {
        const D = 17, HALF = 8.5, t0 = G.t, T = () => G.t - t0;
        const rain = async () => {
          let i = 0;
          while (T() < D) {
            rainGlyph(0.95);
            if (i++ % 3 === 0) au.play('glyph');
            await sleep(lerp(0.5, 0.3, T() / D));
          }
        };
        const hazards = async () => {
          await sleep(3);
          let last = '', run = 0, lastBar = -9;
          while (T() < D - 3.4) {
            if (Math.abs(T() + 0.7 - HALF) < 0.9) { await sleep(0.2); continue; } // nothing while the soul changes colour
            const late = T() > HALF, pool = ['eye', 'brush'];
            if (late && T() - lastBar > 3) pool.push('bar', 'bar');
            let k = pick(pool);
            if (k === last && run >= 2) k = k === 'eye' ? 'brush' : 'eye';
            run = k === last ? run + 1 : 1; last = k;
            const s = G.soul;
            if (k === 'eye') { const l = laser(0.8, !late); await sleep(l.warn + l.fire + 0.06); }
            else if (k === 'brush') {
              const st = late
                ? stroke(s.x + rand(-30, 30), s.y + rand(-30, 30), rand(0, Math.PI), 0.7, 520)
                : stroke(s.x + rand(-40, 40), s.y, Math.PI / 2 + rand(-0.6, 0.6), 0.7, 520);
              au.play('warn');
              await sleep(st.warn + st.paint + st.hold + 0.06);
            } else { // a blue or orange line, standing up (from a side) or lying down (from the top or bottom)
              lastBar = T();
              const col = pick(['b', 'o']);
              if (Math.random() < 0.5) bar(col, pick(['L', 'R']), 170, col === 'o' ? 30 : 14);
              else hbar(col, pick(['T', 'B']), 110, col === 'o' ? 24 : 14);
              au.play('tick', col === 'o' ? 1568 : 1046.5, 0.03);
              await sleep(1.5);
            }
          }
          // the finish: eye blasts in pairs from every side, like phase two
          for (let i = 0; i < 3; i++) { laser(0.7); laser(0.75); if (i === 2) laser(0.8); await sleep(0.95); }
        };
        const halves = async () => {
          await gravityRun(HALF - 1.9, false, 3, 1.4);
          await sleep(HALF - T());
          G.soul.mode = 'red'; G.soul.vy = 0; au.play('ding'); G.flash = 0.35;
          await sleep(1);
          for (let i = 0; i < 5; i++) { spawnBug(false); await sleep(1.4); }
        };
        await Promise.all([rain(), hazards(), halves()]);
        await sleep(2.2);
        G.bullets = []; G.soul.mode = 'red'; G.soul.vy = 0;
        au.music.level(-1);
        await boxTo(90, 90, 0.8);
        await ATK.dots.run();
      }
    },
    // what's left after everything.js: a few slow dots (his attack once he's out of patterns)
    dots: {
      box: [90, 90],
      async run() {
        for (let i = 0; i < 4; i++) { const B = G.box; spawn(glyph(rand(B.x0 + 10, B.x1 - 10), B.y0 - 14, 0, 55, '.')); await sleep(0.7); }
        await sleep(1.6);
      }
    }
  };
  // the attacks come out of a shuffled bag: all seven before any repeats, and never the same one twice in a row
  const POOL = ['codeRain', 'brushSweep', 'bugSwarm', 'breakpoint', 'gravity', 'winkLaser', 'toasts'];
  function nextAttack() {
    if (!G.bag || !G.bag.length) {
      G.bag = shuffle(POOL);
      if (G.bag[0] === G.lastAtk) G.bag.push(G.bag.shift());
    }
    return (G.lastAtk = G.bag.shift());
  }

  function boxTo(w, h, dur = 0.35) {
    const a = { ...G.box };
    const b = w === 'menu' ? BOX_MENU : { x0: Math.round(320 - w / 2), y0: 385 - h, x1: Math.round(320 + w / 2), y1: 385 };
    return tween(dur, (k) => {
      const e = easeOut(k);
      G.box = { x0: lerp(a.x0, b.x0, e), y0: lerp(a.y0, b.y0, e), x1: lerp(a.x1, b.x1, e), y1: lerp(a.y1, b.y1, e) };
    });
  }

  function hurt(d) {
    const P = G.player;
    P.hp = Math.max(0, P.hp - d);
    G.soul.inv = 1.1;
    au.play('hurt');
    G.shakeT = Math.max(G.shakeT, 0.25);
    if (P.hp <= 0 && !RUN.dead) { RUN.dead = true; abortAll(DEAD); }
  }

  /* ---------- the fight ---------- */
  async function boot() {
    const id = ++RUN.id;
    abortAll(CANCEL);
    reset();
    G.title = true;
    try {
      // title music: plays right away once the browser allows sound; otherwise the first press starts it,
      // and the next one starts the fight
      if (au.unlocked()) au.music.start('menu');
      for (;;) {
        await waitInput({ kind: 'start' });
        if (!soundOn || au.music.now === 'menu') break;
        au.music.start('menu');
        au.play('select');
      }
      if (id === RUN.id) go(battle(false));
    } catch (e) { /* window closed */ }
  }

  async function battle(quick) {
    abortAll(CANCEL);
    RUN.id++; RUN.dead = false;
    reset();
    try {
      await (quick ? quickIntro() : encounter());
      for (;;) {
        const act = await playerTurn();
        if (await resolve(act)) return;
        await enemyTurn(act);
      }
    } catch (e) {
      if (e === DEAD) { go(gameOver()); return; }
      throw e;
    }
  }

  async function encounter() {
    const s = G.soul;
    s.x = 320; s.y = 240; G.soulAt = null;
    if (au.music.now === 'menu') au.music.stop(0.2);
    await sleep(0.25);
    for (let i = 0; i < 3; i++) { s.vis = true; au.play('encBlip'); await sleep(0.09); s.vis = false; await sleep(0.07); }
    s.vis = true; au.play('encFly');
    const tx = BTN[0].x + 19, ty = BTN_Y + 21;
    await tween(0.45, (k) => { const e = easeInOut(k); s.x = lerp(320, tx, e); s.y = lerp(240, ty, e); });
    G.ui = true; G.boxShow = true; G.soulAt = 'btn';
    G.boss.show = true; G.boss.assemble = 0; au.play('assemble');
    au.music.level(0); au.music.start('battle');
    await tween(0.8, (k) => { G.boss.assemble = k; });
    G.boss.nextBlink = G.t + 0.3;
    G.flavor = "* Reko looks into your soul.\n* He doesn't look scared.";
  }
  async function quickIntro() {
    G.ui = true; G.boxShow = true; G.soulAt = 'btn'; G.soul.vis = true;
    G.boss.show = true; G.boss.assemble = 0; au.play('assemble');
    au.music.level(0); au.music.start('battle');
    await tween(0.7, (k) => { G.boss.assemble = k; G.fade = 1 - k; });
    G.flavor = '* Reko is back.\n* So are you.';
  }

  async function playerTurn() {
    G.boxTy = typer(G.flavor);
    if (G.flavor === WINK) G.boss.winkAt = G.t + 0.55;
    for (;;) {
      G.soulAt = 'btn'; G.btnHi = G.btn; G.list = null; G.soul.vis = true;
      let b;
      if (G.queuedBtn !== null) { b = G.queuedBtn; G.queuedBtn = null; G.btn = b; } else b = await waitInput({ kind: 'buttons' });
      if (b === 2 && !G.items.potion && !G.items.burger) { au.play('locked'); G.btnShake[b] = 0.4; G.boxTy = typer(NO_ITEMS); continue; }
      au.play('select');
      if (b === 0) {
        const r = await pickList([{ label: 'Reko', hp: true, yellow: G.spareable }]);
        if (r < 0) { G.boxTy = full(typer(G.flavor)); continue; }
        G.list = null; G.boxTy = null; G.soulAt = null; G.soul.vis = false;
        return { type: 'fight', res: await attackMeter() };
      }
      if (b === 1) {
        const r = await pickList([{ label: 'Reko', yellow: G.spareable }]);
        if (r < 0) { G.boxTy = full(typer(G.flavor)); continue; }
        const a = await pickList(ACTS.map((x) => ({ label: x.label })));
        if (a < 0) { G.boxTy = full(typer(G.flavor)); continue; }
        G.list = null; G.boxTy = null; G.soulAt = null; G.soul.vis = false;
        return { type: 'act', act: ACTS[a] };
      }
      if (b === 2) {
        const have = Object.keys(ITEMS).filter((k) => G.items[k] > 0);
        const r = await pickList(have.map((k) => ({ label: ITEMS[k].label + (G.items[k] > 1 ? ' x' + G.items[k] : '') })));
        if (r < 0) { G.boxTy = full(typer(G.flavor)); continue; }
        G.list = null; G.boxTy = null; G.soulAt = null; G.soul.vis = false;
        return { type: 'item', item: have[r] };
      }
      const r = await pickList([{ label: 'Spare', yellow: G.spareable }, { label: 'Flee' }]);
      if (r < 0) { G.boxTy = full(typer(G.flavor)); continue; }
      G.list = null; G.boxTy = null;
      return { type: r === 0 ? 'spare' : 'flee' };
    }
  }
  async function pickList(items) {
    G.list = { items, idx: 0, grid: items.length > 3 }; G.boxTy = null; G.soulAt = 'list';
    const r = await waitInput({ kind: 'list' });
    if (r < 0) au.play('back'); else au.play('select');
    return r;
  }

  // the attack meter: a bar slides across a target; Z (or a tap) stops it, the closer to the middle the harder the hit
  async function attackMeter() {
    const B = BOX_MENU, fromLeft = Math.random() < 0.5;
    G.meter = { x: fromLeft ? B.x0 + 8 : B.x1 - 8, dir: fromLeft ? 1 : -1, speed: (B.x1 - B.x0) / 1.6, stop: false, t0: G.t, miss: false };
    const r = await waitInput({ kind: 'meter' });
    const m = G.meter;
    m.stop = true; m.t1 = G.t;
    if (r === 'miss') { m.miss = true; return { miss: true }; }
    const cx = (B.x0 + B.x1) / 2, off = Math.abs(m.x - cx), acc = 1 - off / ((B.x1 - B.x0) / 2);
    const crit = off < 9;
    let dmg = Math.round((24 + 106 * Math.max(0, acc) ** 1.6) * rand(0.97, 1.03));
    if (crit) dmg = Math.round(dmg * 1.25);
    if (G.debug) { dmg *= 2; G.debug = false; } // Debug: the next hit counts twice
    return { dmg, crit };
  }

  async function strike(res, forced) {
    const B = G.boss;
    if (res.miss) {
      G.fx.push({ kind: 'num', text: 'MISS', col: '#c8c8c8', t0: G.t });
      au.play('miss');
      await sleep(1.0);
      G.meter = null;
      return;
    }
    au.play(res.crit || forced ? 'slashBig' : 'slash');
    G.fx.push({ kind: 'slash', t0: G.t, big: res.crit || forced });
    await sleep(0.55);
    au.play('hit');
    B.shake = 0.8;
    const from = B.hp, dmg = forced ? B.hp : res.dmg;
    B.hp = Math.max(0, B.hp - dmg);
    G.hits++;
    G.fx.push({ kind: 'num', text: forced ? '99999' : String(dmg), col: RED, t0: G.t });
    G.hpBar = { from, to: B.hp, t0: G.t };
    await sleep(1.3);
    G.meter = null; G.hpBar = null;
  }

  async function resolve(act) {
    if (act.type === 'flee') { await flee(); return true; }
    if (act.type === 'spare') {
      if (G.spareable) { await spareEnd(); return true; }
      G.spares++;
      return false;
    }
    if (act.type === 'item') { await useItem(act.item); return false; }
    if (act.type === 'act') { await doAct(act.act); return false; }
    if (G.spareable && !act.res.miss) { await betray(act.res); return true; }
    await strike(act.res);
    if (G.boss.hp <= 0) { await killEnd(); return true; }
    return false;
  }

  const nth = (list, n) => list[Math.min(n, list.length) - 1];
  async function useItem(k) {
    const it = ITEMS[k], P = G.player, before = P.hp;
    G.items[k]--;
    P.hp = Math.min(P.max, P.hp + it.heal);
    au.play('heal');
    await narrate(`${it.text}\n* ${P.hp >= P.max ? 'Your HP was maxed out.' : `You recovered ${P.hp - before} HP!`}`);
  }
  async function doAct(a) {
    const n = (G.acts[a.id] = (G.acts[a.id] || 0) + 1);
    if (a.kindness) G.kindness++;
    if (a.id === 'debug' && n === 1) G.debug = true;
    if (a.id === 'wink') G.boss.winkAt = G.t + 0.7;
    au.play('select');
    await narrate(nth(a.text, n));
  }

  function reaction(act) {
    if (act.type === 'item') return nth(ITEMS[act.item].talk, ITEMS[act.item].heal > 100 ? 1 : 4 - G.items.potion);
    if (act.type === 'act') return nth(act.act.talk, G.acts[act.act.id]);
    if (act.type === 'spare') return SPARE_TALK[Math.min(G.spares, SPARE_TALK.length) - 1];
    if (act.res.miss) return pick(MISS_TALK);
    return HIT_TALK[Math.min(G.hits, HIT_TALK.length) - 1];
  }

  async function tiredTurn() {
    const rest = Math.random() < 0.5;
    if (!G.sighs || !G.sighs.length) G.sighs = shuffle(SIGH_TALK);
    G.boxTy = null; G.btnHi = -1; G.soulAt = 'box'; G.soul.vis = true; G.soul.mode = 'red';
    const shrink = rest ? null : go(boxTo(...ATK.dots.box));
    await say(G.sighs.shift());
    await say(pick(rest ? REST_TALK : DOTS_TALK));
    if (shrink) {
      await shrink;
      const s = G.soul;
      G.soulAt = null; s.x = (G.box.x0 + G.box.x1) / 2; s.y = (G.box.y0 + G.box.y1) / 2;
      G.inp = { kind: 'dodge' };
      await ATK.dots.run();
      G.inp = null; G.bullets = [];
      G.soulAt = 'box';
      await boxTo('menu');
    }
    G.flavor = flavor();
  }

  async function enemyTurn(act) {
    const B = G.boss;
    G.turn++;
    if (G.spareable) { await tiredTurn(); return; } // out of patterns: he only sighs
    if (!G.finaleDone && (G.spares + G.kindness >= 6 || B.hp <= B.max * 0.1 || G.turn >= 16)) G.finaleNext = true;
    const toPhase2 = !G.phase2 && B.hp <= B.max * 0.5;
    const name = G.finaleNext ? 'finale' : nextAttack();
    const A = ATK[name];
    const lines = [reaction(act)];
    if (toPhase2) lines.push(...PHASE2_TALK);
    if (A.intro && !G.seen[name]) lines.push(...A.intro);
    G.seen[name] = true;

    // Reko talks while the box shrinks into the bullet box; the soul waits in the middle
    G.boxTy = null; G.btnHi = -1; G.soulAt = 'box'; G.soul.vis = true; G.soul.mode = 'red';
    const shrink = go(boxTo(A.box[0], A.box[1]));
    for (const ln of lines) await say(ln);
    await shrink;
    if (toPhase2) { G.phase2 = true; au.play('phase'); au.music.level(1); G.flash = 1; G.shakeT = 0.4; }
    if (name === 'finale') au.music.level(2);

    // his turn: dodge
    const s = G.soul;
    if (A.blue) { s.mode = 'blue'; s.vy = 0; au.play('ding'); }
    G.soulAt = null;
    s.x = (G.box.x0 + G.box.x1) / 2; s.y = A.blue ? G.box.y1 - 7 : (G.box.y0 + G.box.y1) / 2;
    G.inp = { kind: 'dodge' };
    await A.run();
    G.inp = null;
    G.bullets = [];
    s.mode = 'red';

    if (name === 'finale') {
      G.finaleDone = true; G.finaleNext = false; G.spareable = true; B.mood = 'tired';
      G.soulAt = 'box';
      for (const ln of TIRED_TALK) await say(ln);
    }
    G.soulAt = 'box';
    await boxTo('menu');
    G.flavor = flavor();
  }

  /* ---------- endings ---------- */
  async function spareEnd() {
    const B = G.boss;
    au.music.stop(0.5);
    B.spared = true; B.mood = 'tired';
    au.play('spare');
    for (let i = 0; i < 26; i++) G.fx.push({ kind: 'p', x: BOSS.x + rand(-90, 90), y: BOSS.y + rand(-80, 80), vx: rand(-20, 20), vy: rand(-60, -20), life: rand(0.7, 1.4), t0: G.t, col: pick(['#fff', YEL, OR]) });
    G.btnHi = -1; G.soulAt = null; G.soul.vis = false;
    await sleep(0.9);
    await say('yay!\na draw!');
    au.play('calm');
    await narrate("* YOU WON!\n* You earned 0 EXP and 0 gold.\n* ...and Reko's respect.");
    fire('spare');
    await endCard('SPARED', G.hits ? 'You spared Reko.' : 'You spared Reko without a single hit.');
  }
  async function killEnd() {
    const B = G.boss;
    au.music.stop(0.05);
    B.mood = 'hurt'; G.btnHi = -1; G.soulAt = null; G.soul.vis = false;
    await sleep(0.6);
    await say('...ok.\ngg.');
    await say("I'll respawn\nwhen you\nreload\nanyway.");
    await dust();
    await narrate('* YOU WON!\n* You earned 150 EXP and 0 gold.\n* Your LOVE increased.');
    fire('kill');
    await endCard('DELETED', 'Reko was deleted. He comes back on reload.');
  }
  async function betray(res) {
    await strike(res, true);
    const B = G.boss;
    au.music.stop(0.05);
    B.mood = 'hurt'; G.btnHi = -1; G.soulAt = null; G.soul.vis = false;
    await say('...oh.');
    await say('I thought\nwe were\nfriends.');
    await dust();
    await narrate('* YOU WON?\n* You earned 150 EXP and 0 gold.\n* That felt wrong.');
    fire('betray');
    await endCard('BETRAYED', 'He was out of patterns. You hit him anyway.');
  }
  async function dust() {
    const B = G.boss;
    // the logo turns to dust from the top down, pixel by pixel
    const px = [];
    try {
      sprites.forEach((s, i) => {
        if (i >= 6) return;
        const d = s.cv.getContext('2d').getImageData(0, 0, BW, BH).data;
        for (let k = 0; k < BW * BH; k++) if (d[k * 4 + 3] > 0) px.push([k % BW, (k / BW) | 0, rand(10, 45), rand(-55, -20), rand(0.6, 1.1)]);
      });
    } catch (err) { /* pixels unreadable: it just fades */ }
    let y0 = BH, y1 = 0;
    for (const p of px) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    B.dust = { t0: G.t, px, y0: Math.min(y0, y1), y1, dur: 1.6 };
    au.play('dust');
    await sleep(2.6);
    B.show = false;
  }
  async function flee() {
    au.music.stop(0.6);
    G.btnHi = -1; G.soulAt = null;
    const s = G.soul, x0 = s.x;
    s.run = true;
    au.play('flee');
    G.boxTy = typer("* You ran away...\n* Reko didn't even get to\n  finish his speech.");
    await tween(1.1, (k) => { s.x = lerp(x0, -20, k * k); });
    s.vis = false; s.run = false;
    await waitTy(G.boxTy);
    fire('flee');
    await endCard('ESCAPED', 'Reko will remember this.');
  }
  async function endCard(title, sub) {
    G.end = { title, sub, t0: G.t };
    G.boxTy = null; G.bubble = null;
    if (title === 'SPARED') au.play('win');
    await sleep(0.6);
    await waitInput({ kind: 'start' });
    au.play('select');
    if (title === 'DELETED') { shatterWin(); return; } // he's gone, and so is the window (until a reload)
    go(boot()); // every other ending goes back to the title screen
  }
  async function gameOver() {
    RUN.dead = false;
    G.deaths++;
    au.music.stop(0.02);
    const s = G.soul;
    Object.assign(G, { inp: null, bullets: [], ui: false, boxShow: false, bubble: null, boxTy: null, fx: [], soulAt: null, meter: null, hpBar: null });
    G.boss.show = false;
    s.inv = 0; s.vis = true; s.mode = 'red';
    await sleep(0.7);
    s.broken = true; playFile('heartCrack', 'crack');
    await sleep(1.3);
    s.broken = false; s.vis = false;
    G.shards = SHARDS.concat(SHARDS).map((img) => ({ img, x: s.x, y: s.y, vx: rand(-130, 130), vy: rand(-230, -60) }));
    playFile('heartShatter', 'shatter');
    await sleep(1.5);
    G.over = { t0: G.t };
    au.music.start('gameover');
    await sleep(1.8);
    const next = Math.min(32, 20 + Math.max(0, G.deaths - 1) * 4);
    const line = G.deaths >= 2
      ? `* Reko felt a little bad.\n* He patched your MAX HP\n  to ${next}.`
      : "* Don't give up yet...\n* Reko's code still needs\n  a tester!";
    G.overTy = typer(line, 'txtLow', 22);
    await waitTy(G.overTy);
    G.overTy = null;
    await tween(0.9, (k) => { G.fade = k; });
    au.music.stop(0.4);
    fire('gameover');
    go(battle(true));
  }

  /* ---------- update ---------- */
  function pinSoul() {
    const s = G.soul;
    if (G.soulAt === 'btn') { s.x = BTN[G.btn].x + 19; s.y = BTN_Y + 21; }
    else if (G.soulAt === 'list' && G.list) { const p = listPos(G.list.idx); s.x = p.x - 24; s.y = p.y + 15; }
    else if (G.soulAt === 'box') { s.x = (G.box.x0 + G.box.x1) / 2; s.y = (G.box.y0 + G.box.y1) / 2; }
  }
  // lists with more than three options use two columns, like the game's ACT menu
  const listPos = (i) => (G.list && G.list.grid
    ? { x: BOX_MENU.x0 + 74 + (i % 2) * 270, y: BOX_MENU.y0 + 18 + Math.floor(i / 2) * 34 }
    : { x: BOX_MENU.x0 + 74, y: BOX_MENU.y0 + 18 + i * 34 });

  const held = new Set();
  function moveSoul(dt) {
    const s = G.soul, b = G.box, ox = s.x, oy = s.y;
    const sp = held.has('back') ? 75 : 150; // hold X to move slowly and precisely
    const dx = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
    s.x += dx * sp * dt + G.drag.dx;
    if (s.mode === 'red') {
      const dy = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
      s.y += dy * sp * dt + G.drag.dy;
    } else {
      if ((G.jumpPress || held.has('up')) && s.ground) { s.vy = -340; s.ground = false; au.play('jump'); }
      if (s.vy < 0 && !(held.has('up') || G.drag.hold)) s.vy = Math.max(s.vy, -90); // let go early = a short hop
      s.vy += (s.vy < 0 ? 900 : 1300) * dt;
      s.y += s.vy * dt;
    }
    G.jumpPress = false; G.drag.dx = 0; G.drag.dy = 0;
    s.x = clamp(s.x, b.x0 + 8, b.x1 - 8);
    const floor = b.y1 - 7;
    if (s.y >= floor) { s.y = floor; if (s.mode === 'blue') { s.vy = 0; s.ground = true; } } else s.ground = false;
    if (s.y < b.y0 + 7) { s.y = b.y0 + 7; if (s.vy < 0) s.vy = 0; }
    s.moved = Math.abs(s.x - ox) + Math.abs(s.y - oy) > 0.05;
  }

  function update(dt) {
    for (const p of [...pending]) if (p.t !== undefined && p.t <= G.t) { pending.delete(p); p.res(); }
    stepTyper(G.boxTy, dt); stepTyper(G.bubble, dt); stepTyper(G.overTy, dt);
    const B = G.boss, s = G.soul;
    B.shake = Math.max(0, B.shake - dt);
    G.shakeT = Math.max(0, G.shakeT - dt);
    G.flash = Math.max(0, G.flash - dt * 2.5);
    G.btnShake = G.btnShake.map((v) => Math.max(0, v - dt));
    s.inv = Math.max(0, s.inv - dt);
    if (G.t > B.nextBlink) { B.blinkT = G.t; B.nextBlink = G.t + rand(2.4, 4.2); }
    if (B.winkAt && G.t >= B.winkAt) { B.winkAt = 0; B.winkT = G.t; au.play('wink'); }
    if (G.phase2 && G.t > B.glitchT + 2.2 && Math.random() < 0.02) B.glitchT = G.t;

    const m = G.meter;
    if (m && !m.stop) {
      m.x += m.dir * m.speed * dt;
      if ((m.dir > 0 && m.x > BOX_MENU.x1 - 6) || (m.dir < 0 && m.x < BOX_MENU.x0 + 6)) if (G.inp && G.inp.kind === 'meter') G.inp.done('miss');
    }
    if (G.inp && G.inp.kind === 'dodge') moveSoul(dt);
    else pinSoul();

    for (const bl of G.bullets) {
      bl.age += dt; bl.update(dt);
      if (bl.age > bl.life || bl.x < -300 || bl.x > 940 || bl.y < -300 || bl.y > 780) bl.dead = true;
    }
    G.bullets = G.bullets.filter((bl) => !bl.dead);
    if (G.inp && G.inp.kind === 'dodge' && s.inv <= 0) {
      for (const bl of G.bullets) {
        if (!bl.harm || !bl.hits(s.x, s.y, SOUL_R)) continue;
        if (bl.color === 'b' && !s.moved) continue;
        if (bl.color === 'o' && s.moved) continue;
        hurt(bl.dmg);
        break;
      }
    }
    G.fx = G.fx.filter((f) => G.t - f.t0 < (f.life || 1.6));
    for (const sh of G.shards) { sh.vy += 520 * dt; sh.x += sh.vx * dt; sh.y += sh.vy * dt; }
  }

  /* ---------- drawing ---------- */
  function txt(str, x, y, font, col, align = 'left') {
    c.font = font; c.fillStyle = col; c.textAlign = align; c.fillText(noLig(str), x, y); c.textAlign = 'left';
  }
  function drawTyped(ty, x, y, lh, font, col) {
    if (!ty) return;
    c.font = font; c.fillStyle = col;
    let off = 0;
    ty.text.split('\n').forEach((ln, i) => {
      const k = clamp(ty.n - off, 0, ln.length);
      if (k > 0) c.fillText(noLig(ln.slice(0, k)), x, y + i * lh);
      off += ln.length + 1;
    });
  }
  const snap = (v) => Math.round(v / 2) * 2;

  function drawBoss() {
    const B = G.boss;
    if (!B.show || !ready()) return;
    const t = G.t, tired = B.mood === 'tired';
    const bob = tired ? 4 + Math.sin(t * 1.3) * 2 : Math.sin(t * 2.2) * 3;
    const sx = B.shake > 0 ? Math.sin(t * 55) * B.shake * 14 : 0;
    const spread = (tired ? -1 : Math.sin(t * 3) * 1.5) + (G.phase2 && !tired ? 4 + Math.sin(t * 7) * 2 : 0);
    const ox = BOSS.x - BW + sx, oy = BOSS.y - BH + bob;
    // eyes: blink now and then, squint when hit, half shut when tired, bounce while talking, look at the soul
    let eyeK = 1;
    if (t - B.blinkT < 0.13) eyeK = 0.12;
    if (B.shake > 0 || B.mood === 'hurt') eyeK = 0.25;
    else if (tired) eyeK = 0.42;
    if (G.bubble && !typed(G.bubble)) eyeK *= 1 - 0.3 * Math.abs(Math.sin(t * 16));
    const look = G.soul.vis ? clamp((G.soul.x - BOSS.x) / 70, -1, 1) * 4 : 0;
    c.globalAlpha = B.spared ? 0.45 : B.alpha;

    if (B.dust) { drawDust(ox, oy); c.globalAlpha = 1; return; }
    const glitch = G.phase2 && t - B.glitchT < 0.14 && !reduceMotion;
    const winkEye = sprites[4].cx > sprites[5].cx ? 4 : 5;
    sprites.forEach((s, i) => {
      if (i >= 6 || (B.away && B.away[i])) return;
      let dx = s.cx - BW / 2, dy = s.cy - BH / 2;
      const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const a = easeBack(clamp(B.assemble, 0, 1));
      let px = dx * spread + dx * (1 - a) * 330, py = dy * spread + dy * (1 - a) * 330;
      if (i >= 4) px += look;
      const x = snap(ox + px), y = snap(oy + py);
      const draw = (img, gx = 0) => {
        if (i < 4) { c.drawImage(img, x + gx, y, BW * 2, BH * 2); return; }
        const ecx = x + s.cx * 2, ecy = y + s.cy * 2 + (tired ? 4 : 0);
        const k = i === winkEye && t - B.winkT < 0.45 ? 0.1 : eyeK; // "* Reko winks at you." (the right eye)
        c.save(); c.translate(ecx + gx, ecy); c.scale(1, k); c.drawImage(img, -s.cx * 2, -s.cy * 2, BW * 2, BH * 2); c.restore();
      };
      if (glitch) { c.globalAlpha = 0.7; draw(s.mag, -5); draw(s.cyan, 5); c.globalAlpha = 1; }
      draw(s.cv);
    });
    c.globalAlpha = 1;
  }
  function drawDust(ox, oy) {
    const D = G.boss.dust, e = G.t - D.t0, line = D.y0 + (e / D.dur) * (D.y1 - D.y0 + 1);
    c.save();
    c.beginPath(); c.rect(0, oy + line * 2, W, H); c.clip();
    sprites.forEach((s, i) => { if (i < 6) c.drawImage(s.cv, snap(ox), snap(oy), BW * 2, BH * 2); });
    c.restore();
    for (const [x, y, vx, vy, life] of D.px) {
      const rel = e - ((y - D.y0) / (D.y1 - D.y0 + 1)) * D.dur;
      if (rel <= 0 || rel > life) continue;
      const k = rel / life;
      c.globalAlpha = 1 - k;
      c.fillStyle = k < 0.3 ? OR : '#cfc8bc';
      c.fillRect(ox + x * 2 + vx * rel, oy + y * 2 + vy * rel - 20 * k * k, 2, 2);
    }
    c.globalAlpha = 1;
  }

  function drawBubble() {
    const bb = G.bubble;
    if (!bb) return;
    const lines = bb.text.split('\n'), w = 178, h = lines.length * 20 + 22, x = 434, y = Math.max(20, 112 - h / 2);
    c.fillStyle = '#fff';
    c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, 8); else c.rect(x, y, w, h); c.fill();
    c.beginPath(); c.moveTo(x + 1, y + h / 2 - 9); c.lineTo(x - 15, y + h / 2 + 3); c.lineTo(x + 1, y + h / 2 + 7); c.fill();
    drawTyped(bb, x + 12, y + 10, 20, `21px ${FONT}`, '#000');
  }

  function drawBox() {
    const b = G.box, x0 = Math.round(b.x0), y0 = Math.round(b.y0), x1 = Math.round(b.x1), y1 = Math.round(b.y1);
    c.fillStyle = '#fff'; c.fillRect(x0 - 5, y0 - 5, x1 - x0 + 10, y1 - y0 + 10);
    c.fillStyle = '#000'; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    return [x0, y0, x1, y1];
  }
  function drawBoxContent() {
    const b = G.box;
    if (G.meter) { drawMeter(); return; }
    if (G.list) {
      G.list.items.forEach((it, i) => {
        const p = listPos(i);
        txt('* ' + it.label, p.x, p.y, `30px ${FONT}`, it.yellow ? YEL : '#fff');
        if (it.hp) {
          const B = G.boss, bw = 100;
          c.fillStyle = '#c10000'; c.fillRect(p.x + 120, p.y + 7, bw, 17);
          c.fillStyle = '#25d943'; c.fillRect(p.x + 120, p.y + 7, Math.round((bw * B.hp) / B.max), 17);
        }
      });
      return;
    }
    drawTyped(G.boxTy, b.x0 + 22, b.y0 + 14, 34, `30px ${FONT}`, '#fff');
  }
  /* the attack meter, drawn as chunky pixel art on a 4px grid: an eye-shaped target in the site's greys, dithered
     towards the middle, an off-white pupil with an orange brush-stroke bullseye, sitting on the site's dot grid */
  const MC = 4;                                    // one meter pixel = 4 game pixels
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map((r) => r.map((v) => (v + 0.5) / 16));
  let meterArt = null;
  const meterFade = document.createElement('canvas');
  function buildMeter() {
    const gw = Math.floor((BOX_MENU.x1 - BOX_MENU.x0) / MC), gh = Math.floor((BOX_MENU.y1 - BOX_MENU.y0) / MC);
    const o = document.createElement('canvas'); o.width = gw; o.height = gh;
    const x = o.getContext('2d');
    const cx = (gw - 1) / 2, cy = (gh - 1) / 2, hw = gw / 2 - 3, hh = gh / 2 - 2.2;
    const inside = (gx, gy) => ((gx - cx) / hw) ** 2 + ((gy - cy) / hh) ** 2 <= 1;
    // bands from the edge to the middle: [where it starts (0 = middle, 1 = edge), colour]
    const BANDS = [[1, '#161616'], [0.72, '#2c2c2c'], [0.5, '#5a5853'], [0.3, '#8f8f8f'], [0.16, '#bdb8b1'], [0.07, '#f4f1ea']];
    const px = (gx, gy, col) => { x.fillStyle = col; x.fillRect(gx, gy, 1, 1); };
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      if (!inside(gx, gy)) { if (gx % 4 === 1 && gy % 4 === 1) px(gx, gy, '#222'); continue; } // the site's dot grid
      if (!inside(gx - 1, gy) || !inside(gx + 1, gy) || !inside(gx, gy - 1) || !inside(gx, gy + 1)) { px(gx, gy, '#f4f1ea'); continue; } // outline
      const k = Math.abs(gx - cx) / hw;
      let b = 0;
      while (b < BANDS.length - 1 && k < BANDS[b + 1][0]) b++;
      // ordered dither near each band edge, so the steps look like old pixel art instead of flat stripes
      const top = BANDS[b][0], bot = b + 1 < BANDS.length ? BANDS[b + 1][0] : 0, f = (k - bot) / (top - bot || 1);
      const col = b > 0 && f > 0.62 && BAYER[gy % 4][gx % 4] < (f - 0.62) / 0.38 ? BANDS[b - 1][1] : BANDS[b][1];
      px(gx, gy, col);
    }
    // the bullseye: an orange brush stroke with ragged ends that pokes out of the eye, like the logo's strokes
    const mx = Math.round(cx);
    for (let gy = 0; gy < gh; gy++) {
      const ragged = gy < 2 || gy > gh - 3;
      for (let d = -1; d <= 1; d++) if (!ragged || (gy * 7 + d * 3) % 3 !== 0) px(mx + d, gy, '#fe7700');
    }
    px(mx - 2, 3, '#fe7700'); px(mx + 2, gh - 4, '#fe7700'); px(mx + 2, 5, '#fe7700'); px(mx - 2, gh - 7, '#fe7700');
    meterArt = o;
  }
  // the bar: 3 meter pixels wide, white with a black core and orange caps; it flashes orange when stopped
  function drawMeterBar(x, flash) {
    const B = BOX_MENU, gh = Math.floor((B.y1 - B.y0) / MC), y0 = B.y0;
    const body = flash ? OR : '#fff';
    c.fillStyle = '#000'; c.fillRect(x - MC * 2, y0, MC * 5, gh * MC);                 // black outline
    c.fillStyle = body; c.fillRect(x - MC, y0 + MC, MC * 3, (gh - 2) * MC);
    c.fillStyle = flash ? '#fff' : '#000'; c.fillRect(x, y0 + MC * 3, MC, (gh - 6) * MC); // core
    c.fillStyle = flash ? '#fff' : OR;                                                 // caps
    c.fillRect(x - MC * 2, y0, MC * 5, MC * 2); c.fillRect(x - MC * 2, y0 + (gh - 2) * MC, MC * 5, MC * 2);
  }
  function drawMeter() {
    const B = BOX_MENU, m = G.meter;
    if (!meterArt) buildMeter();
    const gw = meterArt.width, gh = meterArt.height;
    // appear: columns open out from the middle; disappear: a pixel dissolve
    const open = m.stop ? 1 : clamp((G.t - m.t0) / 0.18, 0, 1);
    const gone = m.stop ? clamp((G.t - m.t1 - 0.6) / 0.45, 0, 1) : 0;
    const half = Math.ceil((gw / 2) * open);
    const sx = Math.floor(gw / 2) - half;
    let art = meterArt;
    if (gone > 0) { // punch the dissolve holes into a copy on the small grid, so the scaled-up result stays seamless
      const x = meterFade.getContext('2d');
      meterFade.width = gw; meterFade.height = gh;
      x.drawImage(meterArt, 0, 0);
      for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) if (BAYER[gy % 4][gx % 4] < gone) x.clearRect(gx, gy, 1, 1);
      art = meterFade;
    }
    c.drawImage(art, sx, 0, half * 2, gh, B.x0 + sx * MC, B.y0, half * 2 * MC, gh * MC);
    if (!m.miss && gone < 0.5) {
      const bx = B.x0 + Math.round((m.x - B.x0) / MC) * MC; // the bar moves in whole meter pixels
      drawMeterBar(bx, m.stop && Math.floor((G.t - m.t1) * 12) % 2 === 1);
    }
  }

  function drawStats() {
    const P = G.player;
    txt(P.name, 30, 398, `28px ${UIF}`, '#fff');
    txt('LV ' + P.lv, 120, 398, `28px ${UIF}`, '#fff');
    txt('HP', 230, 403, `18px ${UIF}`, '#fff');
    const bw = Math.round(P.max * 1.25), x = 258;
    c.fillStyle = '#c10000'; c.fillRect(x, 399, bw, 21);
    c.fillStyle = YEL; c.fillRect(x, 399, Math.round((bw * P.hp) / P.max), 21);
    txt(`${String(P.hp).padStart(2, '0')} / ${P.max}`, x + bw + 14, 398, `28px ${UIF}`, '#fff');
  }
  function drawButtons() {
    BTN.forEach((b, i) => {
      const sel = G.btnHi === i;
      const col = b.locked ? (sel ? '#9a9a9a' : '#5a5a5a') : sel ? YEL : OR;
      const x = b.x + (G.btnShake[i] > 0 ? Math.round(Math.sin(G.t * 60) * 4 * G.btnShake[i] / 0.4) : 0);
      c.fillStyle = col;
      c.fillRect(x, BTN_Y, BTN_W, 3); c.fillRect(x, BTN_Y + BTN_H - 3, BTN_W, 3);
      c.fillRect(x, BTN_Y, 3, BTN_H); c.fillRect(x + BTN_W - 3, BTN_Y, 3, BTN_H);
      if (!(sel && G.soulAt === 'btn' && G.soul.vis)) c.drawImage(icon(b.icon, col), x + 8, BTN_Y + 10, 22, 22);
      txt(b.label, x + 72, BTN_Y + 9, `31px ${UIF}`, col, 'center');
      if (b.locked) { // a tiny padlock in the corner
        c.fillStyle = col; c.fillRect(x + BTN_W - 15, BTN_Y + 8, 8, 6);
        c.fillRect(x + BTN_W - 14, BTN_Y + 4, 2, 4); c.fillRect(x + BTN_W - 10, BTN_Y + 4, 2, 4); c.fillRect(x + BTN_W - 14, BTN_Y + 3, 6, 2);
      }
    });
  }
  function drawSoul() {
    const s = G.soul;
    if (s.broken) { c.drawImage(HEART_L, Math.round(s.x - 8) - 3, Math.round(s.y - 6)); c.drawImage(HEART_R, Math.round(s.x - 8) + 3, Math.round(s.y - 6)); return; }
    if (!s.vis) return;
    if (s.inv > 0 && Math.floor(s.inv * 12) % 2 === 0) return;
    c.drawImage(s.mode === 'blue' ? HEART.blue : HEART.red, Math.round(s.x - 8), Math.round(s.y - 6));
    if (s.run) c.drawImage(LEGS[Math.floor(G.t * 12) % 2], Math.round(s.x - 4), Math.round(s.y + 7), 8, 6);
  }
  function drawFx() {
    for (const f of G.fx) {
      const a = G.t - f.t0;
      if (f.kind === 'slash') {
        // a stepped pixel slash across the logo, drawn in over 0.3s
        const k = Math.min(1, a / 0.3), n = 16;
        c.globalAlpha = a > 0.4 ? Math.max(0, 1 - (a - 0.4) / 0.2) : 1;
        for (let i = 0; i < n * k; i++) {
          const x = BOSS.x + 70 - (140 * i) / n, y = BOSS.y - 80 + (160 * i) / n, sz = f.big ? 12 : 9;
          c.fillStyle = f.big ? (i % 2 ? OR : '#fff') : RED;
          c.fillRect(Math.round(x - sz / 2), Math.round(y - sz / 2), sz, sz);
        }
        c.globalAlpha = 1;
      } else if (f.kind === 'num') {
        const y = 40 - Math.abs(Math.sin(Math.min(1, a / 0.5) * Math.PI)) * 22 * (a < 0.5 ? 1 : 0);
        c.lineWidth = 5; c.strokeStyle = '#000'; c.font = `40px ${UIF}`; c.textAlign = 'center';
        c.strokeText(f.text, BOSS.x, y); c.fillStyle = f.col; c.fillText(f.text, BOSS.x, y); c.textAlign = 'left';
      } else if (f.kind === 'p') {
        if (a > f.life) continue;
        c.globalAlpha = 1 - a / f.life; c.fillStyle = f.col;
        c.fillRect(Math.round(f.x + f.vx * a), Math.round(f.y + f.vy * a), 3, 3);
        c.globalAlpha = 1;
      }
    }
    const hb = G.hpBar;
    if (hb) { // the enemy HP bar shrinking under the damage number
      const B = G.boss, k = easeOut(clamp((G.t - hb.t0) / 0.6, 0, 1)), hp = lerp(hb.from, hb.to, k), w = 200;
      c.fillStyle = '#3a3a3a'; c.fillRect(BOSS.x - w / 2, 88, w, 14);
      c.fillStyle = '#25d943'; c.fillRect(BOSS.x - w / 2, 88, Math.round((w * hp) / B.max), 14);
    }
  }
  function drawTitle() {
    const t = G.t;
    if (ready()) {
      const bob = Math.sin(t * 2) * 3;
      sprites.forEach((s, i) => { if (i < 6) c.drawImage(s.cv, snap(320 - BW), snap(40 + bob), BW * 2, BH * 2); });
    }
    txt('bossfight.exe', 320, 262, `60px ${UIF}`, '#fff', 'center');
    txt('* Reko wants to fight you.', 320, 316, `28px ${FONT}`, '#bdb8b1', 'center');
    if (Math.floor(t * 1.6) % 2 === 0) txt(coarse ? '[ tap to start ]' : '[ press Z or ENTER to start ]', 320, 368, `28px ${FONT}`, YEL, 'center');
    txt(coarse ? 'drag to move  ·  tap to confirm' : 'arrows/WASD move  ·  Z/ENTER confirm  ·  X/SHIFT back', 320, 432, `22px ${FONT}`, '#8f8f8f', 'center');
  }
  function drawGameOver() {
    const k = clamp((G.t - G.over.t0) / 1.6, 0, 1);
    c.globalAlpha = k;
    txt('GAME', 320, 70, `120px ${UIF}`, '#fff', 'center');
    txt('OVER', 320, 160, `120px ${UIF}`, '#fff', 'center');
    c.globalAlpha = 1;
    drawTyped(G.overTy, 130, 310, 34, `30px ${FONT}`, '#fff');
  }
  function drawEnd() {
    const e = G.end, k = clamp((G.t - e.t0) / 0.6, 0, 1);
    c.globalAlpha = 0.88 * k; c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.globalAlpha = k;
    txt(e.title, 320, 150, `80px ${UIF}`, e.title === 'SPARED' ? YEL : '#fff', 'center');
    txt(e.sub, 320, 236, `28px ${FONT}`, '#bdb8b1', 'center');
    if (G.t - e.t0 > 0.6 && Math.floor(G.t * 1.6) % 2 === 0) txt(e.title === 'DELETED' ? (coarse ? '[ tap to continue ]' : '[ Z or ENTER: continue ]') : coarse ? '[ tap to play again ]' : '[ Z or ENTER: play again ]', 320, 312, `28px ${FONT}`, YEL, 'center');
    c.globalAlpha = 1;
  }

  function render() {
    c.setTransform(K, 0, 0, K, 0, 0);
    c.imageSmoothingEnabled = false;
    c.textBaseline = 'top';
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    if (G.shakeT > 0 && !reduceMotion) c.translate(Math.round(rand(-3, 3)), Math.round(rand(-2, 2)));
    if (G.title) drawTitle();
    else {
      drawBoss();
      drawBubble();
      if (G.boxShow) {
        const [x0, y0, x1, y1] = drawBox();
        c.save(); c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip();
        drawBoxContent();
        for (const bl of G.bullets) if (bl.clip) bl.draw();
        c.restore();
      }
      for (const bl of G.bullets) if (!bl.clip) bl.draw();
      drawFx();
      if (G.ui) { drawStats(); drawButtons(); }
      drawSoul();
      for (const sh of G.shards) c.drawImage(sh.img, Math.round(sh.x), Math.round(sh.y), sh.img.width * 2, sh.img.height * 2);
      if (G.over) drawGameOver();
      if (G.end) drawEnd();
    }
    if (G.flash > 0) { c.globalAlpha = G.flash * 0.6; c.fillStyle = '#fff'; c.fillRect(-10, -10, W + 20, H + 20); c.globalAlpha = 1; }
    if (G.fade > 0) { c.globalAlpha = G.fade; c.fillStyle = '#000'; c.fillRect(-10, -10, W + 20, H + 20); c.globalAlpha = 1; }
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (win.hidden || document.hidden) return;
    G.t += dt;
    update(dt);
    render();
  }
  requestAnimationFrame(frame);

  /* ---------- input ---------- */
  const KEYS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    KeyZ: 'ok', Enter: 'ok', Space: 'ok', KeyX: 'back', ShiftLeft: 'back', ShiftRight: 'back', Backspace: 'back', KeyM: 'mute'
  };
  function press(a) {
    const inp = G.inp;
    if (!inp) return;
    if (inp.kind === 'wait') {
      if (a === 'ok' || a === 'back') { if (!typed(inp.ty)) full(inp.ty); else if (a === 'ok') inp.done(); }
    } else if (inp.kind === 'start' || inp.kind === 'meter') {
      if (a === 'ok') inp.done('hit');
    } else if (inp.kind === 'buttons') {
      if (a === 'left' || a === 'right') { G.btn = (G.btn + (a === 'left' ? 3 : 1)) % 4; G.btnHi = G.btn; au.play('move'); }
      else if (a === 'ok') inp.done(G.btn);
      else if (a === 'back' && G.boxTy) full(G.boxTy);
    } else if (inp.kind === 'list') {
      const L = G.list, n = L.items.length;
      if (L.grid) {
        const step = { up: -2, down: 2, left: -1, right: 1 }[a];
        const j = L.idx + (step || 0), sameRow = Math.floor(j / 2) === Math.floor(L.idx / 2);
        if (step && j >= 0 && j < n && (Math.abs(step) === 2 || sameRow)) { L.idx = j; au.play('move'); }
      } else if ((a === 'up' || a === 'down') && n > 1) { L.idx = (L.idx + (a === 'up' ? n - 1 : 1)) % n; au.play('move'); }
      if (a === 'ok') inp.done(L.idx);
      else if (a === 'back') inp.done(-1);
    } else if (inp.kind === 'dodge') {
      if (a === 'up') G.jumpPress = true;
    }
  }
  document.addEventListener('keydown', (e) => {
    if (win.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    const a = KEYS[e.code];
    if (!a) return;
    if ((e.code === 'Space' || e.code === 'Enter') && e.target.closest && e.target.closest('button')) return; // let buttons click
    e.preventDefault();
    if (a === 'mute') { if (!e.repeat) setSound(!soundOn); return; }
    if (!e.repeat) press(a);
    held.add(a);
  });
  document.addEventListener('keyup', (e) => { const a = KEYS[e.code]; if (a) held.delete(a); });
  window.addEventListener('blur', () => held.clear());

  const toLogical = (e) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };
  const btnAt = (p) => BTN.findIndex((b) => p.x >= b.x && p.x <= b.x + BTN_W && p.y >= BTN_Y - 4 && p.y <= BTN_Y + BTN_H + 4);
  const listAt = (p) => (G.list ? G.list.items.findIndex((it, i) => { const q = listPos(i); return p.x >= q.x - 44 && p.x <= q.x + 260 && p.y >= q.y - 2 && p.y <= q.y + 32; }) : -1);
  let ptr = null;
  // PC players use the keyboard; only touch (and pens) can play with the screen. The mouse does nothing in the game.
  cv.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || e.button !== 0) return;
    cv.focus({ preventScroll: true });
    const p = toLogical(e), inp = G.inp;
    if (!inp) return;
    if (inp.kind === 'dodge') {
      // drag anywhere on the screen to move the soul (it follows your finger 1:1); in blue mode a tap jumps
      ptr = { id: e.pointerId, x: p.x, y: p.y };
      cv.setPointerCapture(e.pointerId);
      G.drag.hold = true;
      if (G.soul.mode === 'blue') G.jumpPress = true;
      e.preventDefault();
      return;
    }
    if (inp.kind === 'buttons') {
      const i = btnAt(p);
      if (i >= 0) { G.btn = i; G.btnHi = i; press('ok'); } else if (G.boxTy) full(G.boxTy);
      return;
    }
    if (inp.kind === 'list') {
      const i = listAt(p);
      if (i >= 0) { G.list.idx = i; press('ok'); return; }
      const b = btnAt(p);
      if (b >= 0) G.queuedBtn = b; // tapping another button jumps straight to it
      press('back');
      return;
    }
    press('ok');
  });
  cv.addEventListener('pointermove', (e) => {
    const p = toLogical(e);
    if (ptr && ptr.id === e.pointerId) { G.drag.dx += p.x - ptr.x; G.drag.dy += p.y - ptr.y; ptr.x = p.x; ptr.y = p.y; return; }
  });
  const up = (e) => { if (ptr && ptr.id === e.pointerId) { ptr = null; G.drag.hold = false; } };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);

  /* ---------- sound ----------
     It follows the site's own Sound on / off (js/sound.js toggles the "muted" class on #app); M presses the site's
     switch, so both always agree. (The window has no footer, so there is normally no #bfSnd pill.) */
  const sndBtn = $('#bfSnd'), siteSnd = $('#soundBtn'), app = $('#app');
  function renderSound() {
    if (!sndBtn) return;
    sndBtn.setAttribute('aria-pressed', String(soundOn));
    $('.snd-lbl', sndBtn).textContent = soundOn ? 'Sound on' : 'Sound off';
  }
  function applySound(on) {
    if (on === soundOn) return;
    soundOn = on;
    renderSound();
    if (on) au.music.resume(); else { au.music.pause(); Object.values(sfx).forEach((a) => a.pause()); }
  }
  function setSound(on) {
    if (on === soundOn) return;
    if (siteSnd) siteSnd.click(); else applySound(on);
  }
  if (app) {
    applySound(!app.classList.contains('muted'));
    new MutationObserver(() => applySound(!app.classList.contains('muted'))).observe(app, { attributes: true, attributeFilter: ['class'] });
  }
  if (sndBtn) {
    sndBtn.addEventListener('click', () => setSound(!soundOn));
    sndBtn.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') au.play('tick', 2200, 0.035); });
  }
  renderSound();

  /* ---------- the window ----------
     One of the site's windows (moves, resizes, comes to the front, ✕ closes it). Closing it stops the fight. */
  const wm = window.rekoMakeWin ? window.rekoMakeWin(win) : { open() { win.hidden = false; }, close() { win.hidden = true; } };
  const front = () => { if (window.rekoToFront) window.rekoToFront(win); };
  let deleted = false; // set once Reko is deleted: the window can't be opened again until the page reloads
  function openWin() {
    if (deleted) { au.play('locked'); return; }
    if (!win.hidden && !win.classList.contains('closing')) { front(); win.classList.remove('nudge'); void win.offsetWidth; win.classList.add('nudge'); return; }
    wm.open();
    front();
    au.play('open');
    fit();
    cv.focus({ preventScroll: true });
    go(boot());
  }
  let shut = true;
  new MutationObserver(() => {
    const now = win.hidden || win.classList.contains('closing');
    if (now && !shut) { RUN.id++; abortAll(CANCEL); au.music.stop(0.15); }
    shut = now;
  }).observe(win, { attributes: true, attributeFilter: ['hidden', 'class'] });

  /* after DELETED: cracks run in from the window's edges to one point, the window breaks along them, the pieces
     fall to the bottom of the screen, settle and slowly fade away */
  function shatterWin() {
    deleted = true;
    RUN.id++; abortAll(CANCEL);
    au.music.stop(0.05);
    const tr0 = win.style.translate, r0 = win.getBoundingClientRect(), wx = r0.left, wy = r0.top;
    const M = 8, w = win.offsetWidth, h = win.offsetHeight, W = w + M * 2, H = h + M * 2, ox = wx - M, oy = wy - M;
    const cx = W / 2 + rand(-0.12, 0.12) * W, cy = H / 2 + rand(-0.12, 0.12) * H;
    // where a ray from the crack point hits the edge of the window
    const edge = (a) => {
      const dx = Math.cos(a), dy = Math.sin(a);
      const tx = dx > 0 ? (W - cx) / dx : dx < 0 ? -cx / dx : Infinity, ty = dy > 0 ? (H - cy) / dy : dy < 0 ? -cy / dy : Infinity;
      const t = Math.min(tx, ty);
      return [cx + dx * t, cy + dy * t];
    };
    const N = 7, a0 = rand(0, Math.PI * 2);
    const angs = Array.from({ length: N }, (_, i) => a0 + (i + rand(-0.3, 0.3)) * (Math.PI * 2) / N);
    const pts = angs.map(edge);
    const norm = (a) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const corners = [[0, 0], [W, 0], [W, H], [0, H]].map((p) => ({ p, a: Math.atan2(p[1] - cy, p[0] - cx) }));
    const pieces = angs.map((a, i) => {
      const b = angs[(i + 1) % N], span = norm(b - a);
      const mid = corners.filter((k) => norm(k.a - a) < span).sort((k1, k2) => norm(k1.a - a) - norm(k2.a - a)).map((k) => k.p);
      return [[cx, cy], pts[i], ...mid, pts[(i + 1) % N]];
    });
    const layer = (z) => { const d = document.createElement('div'); d.style.cssText = `position:fixed;left:0;top:0;width:${W}px;height:${H}px;translate:${ox}px ${oy}px;z-index:${z};pointer-events:none`; (win.parentNode || document.body).appendChild(d); return d; }; // inside .rk, so the copies keep the site's colours
    // 1. the cracks, drawn from the edges inwards (jagged lines on top of the window)
    const crack = layer(96), NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', W); svg.setAttribute('height', H); svg.style.overflow = 'visible';
    crack.appendChild(svg);
    pts.forEach(([px, py], i) => {
      const seg = [[px, py]];
      for (let k = 1; k < 4; k++) { const f = k / 4; seg.push([lerp(px, cx, f) + rand(-9, 9), lerp(py, cy, f) + rand(-9, 9)]); }
      seg.push([cx, cy]);
      let len = 0; for (let k = 1; k < seg.length; k++) len += Math.hypot(seg[k][0] - seg[k - 1][0], seg[k][1] - seg[k - 1][1]);
      ['#0b0b0b', '#fff'].forEach((col, j) => {
        const pl = document.createElementNS(NS, 'polyline');
        pl.setAttribute('points', seg.map((q) => q.join(',')).join(' '));
        pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', col); pl.setAttribute('stroke-width', j ? 1.5 : 4.5); pl.setAttribute('stroke-linejoin', 'bevel');
        pl.style.strokeDasharray = len; pl.style.strokeDashoffset = len;
        pl.style.transition = `stroke-dashoffset .32s cubic-bezier(.5,0,.9,.6) ${i * 0.11}s`;
        svg.appendChild(pl);
        requestAnimationFrame(() => requestAnimationFrame(() => { pl.style.strokeDashoffset = 0; }));
      });
      setTimeout(() => au.play('crack'), i * 110);
    });
    const shakeWin = setInterval(() => { win.style.translate = `${wx + rand(-2, 2)}px ${wy + rand(-2, 2)}px`; }, 30);
    // 2. it breaks: one copy of the window per piece (the game screen copied in), clipped to the piece's shape
    setTimeout(() => {
      clearInterval(shakeWin);
      playFile('heartShatter', 'shatter');
      const parts = pieces.map((poly) => {
        const d = layer(97);
        d.style.clipPath = `polygon(${poly.map(([x, y]) => `${x}px ${y}px`).join(',')})`;
        const cl = win.cloneNode(true);
        cl.removeAttribute('id'); cl.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
        cl.style.cssText = `position:absolute;left:${M}px;top:${M}px;width:${w}px;height:${h}px;translate:none;animation:none;margin:0`;
        const c2 = cl.querySelector('canvas');
        if (c2) { c2.style.width = cv.style.width; c2.style.height = cv.style.height; try { c2.getContext('2d').drawImage(cv, 0, 0); } catch (err) { /* blank piece */ } }
        d.appendChild(cl);
        const gx = poly.reduce((t, q) => t + q[0], 0) / poly.length, gy = poly.reduce((t, q) => t + q[1], 0) / poly.length;
        const r = Math.max(...poly.map(([x, y]) => Math.hypot(x - gx, y - gy)));
        d.style.transformOrigin = `${gx}px ${gy}px`;
        const ux = (gx - cx) / (Math.hypot(gx - cx, gy - cy) || 1), uy = (gy - cy) / (Math.hypot(gx - cx, gy - cy) || 1);
        return { d, gx, gy, r, x: 0, y: 0, rot: 0, vx: ux * rand(60, 150), vy: uy * rand(40, 110) - rand(60, 160), vr: rand(-2.6, 2.6), done: false };
      });
      win.hidden = true; win.style.translate = tr0;
      crack.remove();
      let last = performance.now(), settled = 0;
      const step = (now) => {
        const dt = Math.min(0.033, (now - last) / 1000); last = now;
        for (const p of parts) {
          if (p.done) continue;
          p.vy += 1500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
          const floor = innerHeight - (oy + p.gy) - p.r * 0.55; // how far this piece can fall before it touches the bottom
          if (p.y >= floor) {
            p.y = floor;
            if (p.vy > 260) { p.vy *= -0.28; p.vx *= 0.5; p.vr *= 0.4; au.play('tick', 900 + Math.random() * 500, 0.03); }
            else { p.vy = 0; p.vx = 0; p.vr = 0; p.done = true; settled++; }
          }
          p.d.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}rad)`;
        }
        if (settled < parts.length) { requestAnimationFrame(step); return; }
        // 3. they lie there for a moment, then slowly fade away
        setTimeout(() => {
          parts.forEach((p) => { p.d.style.transition = 'opacity 1.8s ease'; p.d.style.opacity = '0'; });
          setTimeout(() => parts.forEach((p) => p.d.remove()), 1900);
        }, 700);
      };
      requestAnimationFrame(step);
    }, N * 110 + 380);
  }
  document.addEventListener('reko:bossfight-open', openWin);
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load(`30px ${FONT}`), document.fonts.load(`28px ${UIF}`)]).catch(() => {});
})();
