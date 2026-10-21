/* rekosk.dev: `ui`, the synthesized sounds (Web Audio recipes) that every other part plays */
'use strict';

rekoSite.part((site) => {
  site.share({ ui: () => ui });

  /* ---------- UI sounds ----------
     Synthesized live (tiny, instant, no files). The palette comes from Videos/Full.mp4:
     clean ~2 kHz blips, falling "bloop" chirps (the letters getting sucked in) and hard-edged
     glitch bursts. Browsers only allow sound after the first click/tap/key on the page. */
  const ui = (() => {
    let ctx = null, out = null, noiseBuf = null;
    let cur = null, curEnd = 0; // the fader of the sound being built right now, and when its last part ends
    const upTo = (at, dur) => { if (cur) curEnd = Math.max(curEnd, at + dur); };

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
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    ['pointerdown', 'touchend', 'keydown'].forEach((t) => window.addEventListener(t, ensure, { passive: true }));

    // a sine/square tone, optionally gliding from f0 to f1 (dest: where it plays into, the master output by default)
    function tone(f0, f1, dur, vol, at = 0, type = 'sine', dest = cur || out) {
      upTo(at, dur);
      const t = ctx.currentTime + at;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + dur + 0.03);
    }

    // a burst of filtered noise; hard = gated on/off like the video's glitch slices
    function noise(dur, vol, hp, at = 0, hard = false, lp = 14000, dest = cur || out) {
      upTo(at, dur);
      const t = ctx.currentTime + at;
      const s = ctx.createBufferSource();
      const h = ctx.createBiquadFilter();
      const l = ctx.createBiquadFilter();
      const g = ctx.createGain();
      s.buffer = noiseBuf;
      h.type = 'highpass'; h.frequency.value = hp;
      l.type = 'lowpass'; l.frequency.value = lp;
      if (hard) {
        g.gain.setValueAtTime(vol, t);
        g.gain.setValueAtTime(0, t + dur);
      } else {
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      }
      s.connect(h).connect(l).connect(g).connect(dest);
      s.start(t, Math.random() * 0.3);
      s.stop(t + dur + 0.03);
    }

    // air swoosh: band-passed noise sweeping f0 → f1 (optionally panned pan0 → pan1), swelling to a peak at `peak`
    function swoosh(dur, vol, f0, f1, { q = 0.9, peak = 0.6, pan0 = 0, pan1 = 0 } = {}) {
      upTo(0, dur);
      const t = ctx.currentTime;
      const s = ctx.createBufferSource();
      const b = ctx.createBiquadFilter();
      const l = ctx.createBiquadFilter();
      const g = ctx.createGain();
      s.buffer = noiseBuf;
      s.loop = true;
      b.type = 'bandpass'; b.Q.value = q;
      b.frequency.setValueAtTime(f0, t);
      b.frequency.exponentialRampToValueAtTime(f1, t + dur);
      l.type = 'lowpass'; l.frequency.value = 6000; // keep it soft, no hiss
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + dur * peak);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = s.connect(b).connect(l).connect(g);
      if (ctx.createStereoPanner && (pan0 || pan1)) {
        const p = ctx.createStereoPanner();
        p.pan.setValueAtTime(pan0, t);
        p.pan.linearRampToValueAtTime(pan1, t + dur);
        node = node.connect(p);
      }
      node.connect(cur || out);
      s.start(t, Math.random() * 0.2);
      s.stop(t + dur + 0.05);
    }

    // a soft pad voice: slow swell in and out (for the ambient "something is happening" moments)
    function pad(f, dur, vol, at = 0, attack = 0.5, type = 'sine', detune = 0) {
      upTo(at, dur);
      const t = ctx.currentTime + at;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const l = ctx.createBiquadFilter();
      o.type = type; o.frequency.value = f; o.detune.value = detune;
      l.type = 'lowpass'; l.frequency.setValueAtTime(600, t); l.frequency.linearRampToValueAtTime(3200, t + dur * 0.6);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.setValueAtTime(vol, t + Math.max(attack, dur - 0.8));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(l).connect(g).connect(cur || out);
      o.start(t); o.stop(t + dur + 0.05);
    }

    // movement sound: a looping band of air whose loudness follows how fast the cursor moves
    let motion = null;
    function motionStart() {
      if (motion) return;
      const s = ctx.createBufferSource();
      const b = ctx.createBiquadFilter();
      const l = ctx.createBiquadFilter();
      const g = ctx.createGain();
      s.buffer = noiseBuf;
      s.loop = true;
      b.type = 'bandpass'; b.Q.value = 1.1; b.frequency.value = 900;
      l.type = 'lowpass'; l.frequency.value = 4000;
      g.gain.value = 0;
      s.connect(b).connect(l).connect(g).connect(out);
      s.start();
      motion = { s, b, g };
    }
    function motionMove(speed, pos) {
      if (!motion) return;
      const t = ctx.currentTime;
      const v = Math.min(0.07, speed * 0.035);           // px per ms → loudness
      motion.g.gain.cancelScheduledValues(t);
      motion.g.gain.setTargetAtTime(v, t, 0.03);
      motion.g.gain.setTargetAtTime(0, t + 0.07, 0.08);  // fades out by itself when the cursor stops
      motion.b.frequency.setTargetAtTime(450 + pos * 1700, t, 0.05); // left = darker, right = brighter
    }
    function motionStop() {
      if (!motion) return;
      const m = motion;
      motion = null;
      const t = ctx.currentTime;
      m.g.gain.cancelScheduledValues(t);
      m.g.gain.setTargetAtTime(0, t, 0.05);
      m.s.stop(t + 0.4);
    }

    // heavy metal scrape: noise through a few narrow resonances (a metal plate grinding on the floor)
    // plus a low rumble; loudness and grit follow how fast the heavy sticker actually moves
    let scrape = null;
    function scrapeStart() {
      if (scrape) return;
      const s = ctx.createBufferSource();
      s.buffer = noiseBuf; s.loop = true;
      const g = ctx.createGain(); g.gain.value = 0;
      const bands = [[480, 7, 1], [1150, 11, 0.7], [2240, 16, 0.4], [3300, 18, 0.2]].map(([f, q, v]) => {
        const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q;
        const bg = ctx.createGain(); bg.gain.value = v;
        s.connect(b).connect(bg).connect(g);
        return b;
      });
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 130;
      const lg = ctx.createGain(); lg.gain.value = 2.6;
      s.connect(lp).connect(lg).connect(g);
      g.connect(out);
      s.start(0, Math.random() * 0.5);
      scrape = { s, g, bands };
    }
    function scrapeMove(speed) {
      if (!scrape) return;
      const t = ctx.currentTime;
      const v = Math.min(0.18, speed * 0.2);
      scrape.g.gain.cancelScheduledValues(t);
      scrape.g.gain.setTargetAtTime(v * (0.8 + Math.random() * 0.4), t, 0.03); // a bit of judder
      scrape.g.gain.setTargetAtTime(0, t + 0.08, 0.07);
      scrape.bands.forEach((b, i) => b.frequency.setTargetAtTime([480, 1150, 2240, 3300][i] * (0.92 + Math.min(speed, 2) * 0.06 + Math.random() * 0.03), t, 0.05));
    }
    function scrapeStop() {
      if (!scrape) return;
      const m = scrape; scrape = null;
      const t = ctx.currentTime;
      m.g.gain.cancelScheduledValues(t);
      m.g.gain.setTargetAtTime(0, t, 0.06);
      m.s.stop(t + 0.5);
    }

    // DJ scratch: a short "record" (the Reko notes an octave+ down, sung as an "ahh" over a kick, with crackle) played
    // forward or backward at the speed and direction the hand turns the featured disc; a still hand is silent, and a
    // direction flip restarts the record at the same spot so it scrubs back over what was just heard
    let recF = null, recR = null, scr = null;
    function record() {
      if (recF) return;
      const sr = ctx.sampleRate, nl = Math.floor(0.4 * sr);
      recF = ctx.createBuffer(1, nl * 4, sr);
      const d = recF.getChannelData(0);
      const fw = (f) => Math.exp(-(((f - 700) / 260) ** 2)) + 0.7 * Math.exp(-(((f - 1150) / 320) ** 2)) + 0.3 * Math.exp(-(((f - 2600) / 450) ** 2));
      [220, 261.63, 329.63, 392].forEach((f0, n) => {
        const hs = [];
        for (let h = 1; h * f0 < 4000; h++) hs.push([2 * Math.PI * h * f0, fw(h * f0) + 0.12 / h]);
        for (let i = 0; i < nl; i++) {
          const t = i / sr;
          const env = Math.min(1, t / 0.012) * (0.55 + 0.45 * Math.exp(-t * 9)) * Math.min(1, (0.4 - t) / 0.05);
          const tv = t + 0.0003 * Math.sin(2 * Math.PI * 5.5 * t); // a little vibrato
          let v = 0;
          for (const [w, a] of hs) v += a * Math.sin(w * tv);
          const kick = Math.sin(2 * Math.PI * (45 * t + 75 / 18 * (1 - Math.exp(-18 * t)))) * Math.exp(-t * 16) * 2.2;
          d[n * nl + i] = v * env * 0.35 + kick + (Math.random() < 0.0004 ? (Math.random() - 0.5) * 0.6 : 0);
        }
      });
      let pk = 0;
      for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i]));
      for (let i = 0; i < d.length; i++) d[i] *= 0.9 / pk;
      recR = ctx.createBuffer(1, d.length, sr);
      recR.getChannelData(0).set(Float32Array.from(d).reverse());
    }
    function scratchStart() {
      if (scr) return;
      record();
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800;
      const g = ctx.createGain(); g.gain.value = 0;
      lp.connect(g).connect(out);
      scr = { lp, g, src: null, sg: null, dir: 0, pos: 0, t: ctx.currentTime };
    }
    function scratchMove(rate) { // rate: 1 = normal record speed, negative = backwards
      if (!scr) return;
      const t = ctx.currentTime, D = recF.duration, a = Math.abs(rate);
      scr.pos = ((scr.pos + rate * (t - scr.t)) % D + D) % D; scr.t = t;
      const dir = a < 0.03 ? scr.dir : Math.sign(rate);
      if (dir !== scr.dir) {
        if (scr.src) { scr.sg.gain.setTargetAtTime(0, t, 0.006); scr.src.stop(t + 0.05); }
        const src = ctx.createBufferSource(), sg = ctx.createGain();
        src.buffer = dir > 0 ? recF : recR; src.loop = true; src.playbackRate.value = Math.max(0.05, a);
        sg.gain.setValueAtTime(0.0001, t); sg.gain.setTargetAtTime(1, t, 0.006);
        src.connect(sg).connect(scr.lp);
        src.start(t, dir > 0 ? scr.pos : D - scr.pos);
        Object.assign(scr, { src, sg, dir });
      }
      if (scr.src) scr.src.playbackRate.setTargetAtTime(Math.min(4, Math.max(0.05, a)), t, 0.012);
      scr.lp.frequency.setTargetAtTime(600 + Math.min(a, 3) * 2400, t, 0.02); // slow = muffled, fast = bright
      scr.g.gain.setTargetAtTime(a < 0.03 ? 0 : Math.min(0.24, 0.07 + a * 0.08), t, 0.012);
    }
    function scratchStop() {
      if (!scr) return;
      const m = scr; scr = null;
      const t = ctx.currentTime;
      m.g.gain.cancelScheduledValues(t);
      m.g.gain.setTargetAtTime(0, t, 0.04);
      if (m.src) m.src.stop(t + 0.4);
      setTimeout(() => m.g.disconnect(), 600);
    }

    const NOTES = [880, 1046.5, 1318.5, 1568]; // R, e, k, o
    let chaseBus = null; // the bear chase music's own fader
    const vary = () => 0.94 + Math.random() * 0.12;

    const recipes = {
      tick: (f = 2600, v = 0.04) => { const r = vary(); tone(f * r, f * r, 0.028, v); noise(0.012, v * 0.6, 5000); },
      pop: () => { tone(1500, 520, 0.075, 0.16); noise(0.01, 0.07, 3000); },
      // sticker dragged out: a little grow "whoomp", then it gets sucked away
      poof: () => {
        tone(380, 760, 0.16, 0.08);
        setTimeout(() => { if (ctx) swoosh(0.36, 0.12, 2600, 300, { q: 0.8, peak: 0.3 }); }, 150);
        tone(1900, 700, 0.18, 0.06, 0.32);
      },
      // sticker comes back: a bubbly pop with a small sparkle
      popIn: () => {
        tone(280, 920, 0.09, 0.14);
        noise(0.012, 0.07, 3000);
        tone(1800, 2400, 0.06, 0.04, 0.07);
      },
      // highlighted words: quick sparkly plucks climbing with a bright sweep, fitted to the fill's length d (seconds)
      fillInT: (d = 1.1) => {
        const step = d / 5.5;
        [783.99, 987.77, 1174.66, 1396.91, 1760].forEach((n, k) => {
          tone(n, n * 1.01, Math.min(0.12, step * 0.75), 0.05, k * step);
          tone(n * 2, n * 2, Math.min(0.05, step * 0.35), 0.015, k * step + 0.01);
        });
      },
      // leaving early (p < 1): only the notes the fill actually reached fall back down
      fillOut: (p = 1) => {
        [1760, 1318.51, 987.77].slice(3 - Math.max(1, Math.round(p * 3))).forEach((n, k) => tone(n, n * 0.9, 0.11, 0.04 * (0.6 + 0.4 * p), k * 0.1));
      },
      // intro line: rising notes that climb from low to high, like holding on "Reko", following the orange wave
      // d = how long the wave takes (seconds); the notes spread out to match it
      leadIn: (d = 1.1) => {
        const s = d / 1.1;
        [440, 523.25, 659.25, 880].forEach((n, k) => {
          tone(n * 0.75, n, 0.26 * Math.min(s, 1.6), 0.085, k * 0.2 * s);
          tone(n * 2, n * 2, 0.08, 0.02, k * 0.2 * s + 0.03);
        });
        tone(200, 900, 0.9 * s, 0.035);
      },
      leadOut: (p = 1) => {
        [880, 659.25, 523.25, 440].slice(4 - Math.max(1, Math.round(p * 4))).forEach((n, k) => tone(n, n * 0.78, 0.2, 0.07 * (0.6 + 0.4 * p), k * 0.12));
        tone(220 + 680 * p, 220, 0.2 + 0.3 * p, 0.03);
      },
      // leaving the school notes: a softer rustle as the paper settles back down
      paperOut: (p = 1) => {
        [[0, 0.07, 0.045], [0.07, 0.09, 0.035], [0.16, 0.1, 0.02]].slice(0, Math.max(1, Math.round(p * 3))).forEach(([at, d, v]) =>
          noise(d, v * (0.5 + 0.5 * p), 900, at, false, 3600));
      },
      // school notes paper: a soft paper rustle (a few quick filtered noise flutters)
      paper: () => {
        [[0, 0.06, 0.07], [0.05, 0.05, 0.05], [0.1, 0.08, 0.06], [0.17, 0.06, 0.035]].forEach(([at, d, v]) =>
          noise(d, v, 1400, at, false, 5200));
      },
      // section title appears: just a spray-paint swoosh
      reveal: () => swoosh(0.5, 0.11, 3200, 6800, { q: 0.55, peak: 0.25 }),
      // cursor touches a section title: a quieter spray that lasts as long as the brush takes to move (d seconds)
      spray: (d = 0.26) => swoosh(d, 0.07, 4200, 6200, { q: 0.6, peak: 0.3 }),
      // greeting word / replay: a short soft swish with a gentle upward glide
      swish: () => {
        swoosh(0.32, 0.14, 700, 3200, { q: 0.8, peak: 0.45 });
        tone(620, 1180, 0.22, 0.045);
      },
      on: () => { tone(1600, 1600, 0.05, 0.12); tone(2400, 2400, 0.08, 0.12, 0.06); },
      off: () => { tone(2000, 2000, 0.05, 0.1); tone(1200, 1200, 0.09, 0.1, 0.06); },
      // the speaker icon picked up from the "Sound" button: a quick rising pluck
      sndGrab: () => { tone(620, 1180, 0.08, 0.06, 0, 'triangle'); noise(0.02, 0.03, 3000, 0, false, 8000); },
      // ...carried over the lake: a small wet "blip"
      sndAim: () => { tone(760, 1150, 0.06, 0.035); tone(1150, 820, 0.05, 0.02, 0.05); },
      // ...let go anywhere else: it swooshes back up and clicks into the button (the retreat)
      sndBack: () => {
        swoosh(0.42, 0.05, 900, 3200, { q: 1.1, peak: 0.5 });
        tone(560, 1120, 0.3, 0.035, 0, 'triangle');
        noise(0.015, 0.06, 2500, 0.4, true); tone(1600, 1600, 0.04, 0.05, 0.4);
      },
      // the geocache logbook zooms up into focus: a rising whoosh, then the soft tap of paper settling
      logOpen: () => { swoosh(0.45, 0.07, 450, 2600, { q: 0.8, peak: 0.6 }); noise(0.04, 0.04, 1500, 0.4, false, 5000); tone(260, 220, 0.06, 0.03, 0.4, 'triangle'); },
      // ...and back down to the map (the retreat): a falling whoosh and a little thud as it lands
      logClose: () => { swoosh(0.42, 0.06, 2400, 450, { q: 0.8, peak: 0.4 }); tone(170, 110, 0.09, 0.05, 0.38); noise(0.03, 0.03, 600, 0.38, false, 2500); },
      // a paper inside the logbook's cover zooms up: a light papery whoosh up, then back down
      paperUp: () => { swoosh(0.3, 0.05, 900, 3200, { q: 0.9, peak: 0.45 }); noise(0.05, 0.02, 3500, 0.3, false, 7000); },
      paperDown: () => { swoosh(0.28, 0.05, 3000, 800, { q: 0.9, peak: 0.35 }); noise(0.04, 0.02, 2500, 0.28, false, 6000); },
      // a page turned: the paper lifts with a soft rustle, swishes over and lands with a light slap (cover = heavier board)
      pageTurn: (cover) => {
        const k = 0.85 + Math.random() * 0.3;
        noise(0.05, 0.03, 2500 * k, 0, false, 9000);
        swoosh(0.34, 0.055, 1500 * k, 4200 * k, { q: 0.7, peak: 0.4, pan0: 0.3, pan1: -0.3 });
        for (let i = 0; i < 3; i++) noise(0.02, 0.012, 3500, 0.06 + i * 0.05 + Math.random() * 0.03, false, 10000);
        noise(0.035, cover ? 0.06 : 0.035, cover ? 700 : 1800, 0.3, false, cover ? 3000 : 7000);
        if (cover) tone(150, 100, 0.1, 0.05, 0.3);
      },
      // ...dropped into the lake: a plop and the sound sinking underwater with bubbles
      lakeMute: () => {
        tone(1300, 420, 0.16, 0.1); noise(0.3, 0.12, 260, 0.02, false, 2600);
        for (let i = 0; i < 4; i++) tone(1700 + Math.random() * 1500, 1400, 0.04, 0.02, 0.08 + i * 0.06);
        tone(880, 196, 0.95, 0.05, 0.15, 'triangle'); tone(660, 147, 0.95, 0.03, 0.18, 'triangle');
        for (let i = 0; i < 7; i++) { const f = 260 + Math.random() * 220; tone(f, f * 1.9, 0.07, 0.025, 0.3 + i * 0.12 + Math.random() * 0.05); }
      },
      // ...clicked on the lake: it pops out of the water and the sound swooshes back up to the button, coming back on
      lakeOut: () => {
        noise(0.12, 0.08, 500, 0, false, 3000); tone(420, 1100, 0.12, 0.08);
        swoosh(0.6, 0.05, 700, 4200, { q: 1, peak: 0.7 });
        tone(330, 990, 0.55, 0.03, 0.05, 'triangle');
        tone(1600, 1600, 0.05, 0.1, 0.66); tone(2400, 2400, 0.08, 0.1, 0.72);
      },
      open: () => { tone(520, 1500, 0.09, 0.12); noise(0.05, 0.025, 1800); },
      close: () => { tone(1500, 480, 0.09, 0.12); noise(0.05, 0.025, 1800); },
      grab: () => { tone(700, 1150, 0.05, 0.12); noise(0.012, 0.06, 3000); },
      drop: () => { tone(190, 70, 0.14, 0.22); noise(0.02, 0.05, 2000); tone(2600, 2600, 0.025, 0.04, 0.01); },
      // map pin dropping onto a point: a short falling whistle, then a soft thud as it sticks in (lands at ~0.3s)
      pin: () => {
        tone(1800, 760, 0.26, 0.035);
        tone(210, 80, 0.14, 0.2, 0.3);
        noise(0.025, 0.06, 1800, 0.3, false, 6000);
        tone(2700, 2700, 0.03, 0.035, 0.31);
      },
      copy: () => { tone(2400, 2400, 0.05, 0.12); tone(3200, 3200, 0.1, 0.12, 0.065); },
      error: () => { tone(320, 320, 0.07, 0.09, 0, 'square'); tone(260, 260, 0.1, 0.09, 0.09, 'square'); },
      noteUp: (i) => { const n = NOTES[i]; tone(n * 0.75, n, 0.13, 0.1); tone(n * 2, n * 2, 0.06, 0.025, 0.02); },
      noteDown: (i) => { const n = NOTES[i]; tone(n, n * 0.7, 0.13, 0.09); },
      // the big logo shrinking into the "R" (pan = where the R sits) and growing back
      flyIn: (pan = 0) => {
        swoosh(0.95, 0.2, 260, 2600, { q: 0.75, peak: 0.62, pan1: pan });
        tone(170, 420, 0.8, 0.05);
      },
      // heavy sticker picked up: a dull thud with a short metallic ring
      clunk: () => {
        tone(110, 42, 0.3, 0.26);
        noise(0.04, 0.06, 300, 0, false, 1800);
        tone(1870, 1850, 0.3, 0.018, 0.01);
        tone(2930, 2910, 0.22, 0.01, 0.01);
      },
      // eyes sticker sinking into the wordmark's eyes: a falling shimmer that draws in
      eyesIn: () => {
        swoosh(0.95, 0.08, 3200, 380, { q: 0.9, peak: 0.35 });
        [1568, 1318.5, 1046.5, 880, 659.25].forEach((n, k) => tone(n, n * 0.995, 0.5, 0.03, k * 0.13));
        pad(110, 1.4, 0.05, 0.2, 0.7);
      },
      // ...then the logo turns black from the eyes outward: an ambient chord that swells and settles
      blacken: () => {
        [[110, 0.07], [164.81, 0.05], [220, 0.045], [261.63, 0.035], [329.63, 0.03], [493.88, 0.018]].forEach(([f, v], i) => {
          pad(f, 3.2, v, i * 0.06, 0.9, i < 2 ? 'sine' : 'triangle');
          pad(f, 3.2, v * 0.6, i * 0.06, 0.9, 'sine', 7);   // slight chorus
        });
        [659.25, 783.99, 987.77, 1318.5, 1567.98, 1975.53].forEach((n, k) => tone(n, n, 0.7, 0.022, 0.35 + k * 0.24));
        swoosh(2.4, 0.05, 300, 2600, { q: 0.6, peak: 0.6 });
        tone(55, 52, 2.6, 0.08, 2.0);                     // low settle at the end
      },
      // loader filling up green: a quick rising swell
      ldFill: () => {
        swoosh(0.8, 0.07, 500, 3200, { q: 0.8, peak: 0.85 });
        tone(330, 660, 0.8, 0.035);
      },
      // ...and "Completed": a bright little success chime
      ldDone: () => {
        [783.99, 987.77, 1318.51].forEach((n, k) => { tone(n, n, 0.45, 0.06, k * 0.09); tone(n * 2, n * 2, 0.2, 0.015, k * 0.09); });
        pad(392, 1.2, 0.03, 0.2, 0.15);
      },
      // paper plane in flight: a light pentatonic tune over a soft pad
      flyPad: () => { pad(261.63, 2.6, 0.03, 0, 0.6); pad(392, 2.6, 0.022, 0.1, 0.6); pad(523.25, 2.6, 0.015, 0.2, 0.6); },
      flyNote: (i = 0) => {
        const tune = [659.25, 783.99, 880, 1046.5, 880, 783.99, 659.25, 587.33, 523.25, 587.33, 659.25, 783.99, 1046.5, 1174.66, 1046.5, 880];
        const n = tune[i % tune.length];
        tone(n, n, 0.32, 0.045, 0, 'triangle');
        tone(n * 2, n * 2, 0.12, 0.01, 0.01);
        if (i % 8 === 0) pad(n / 4, 1.7, 0.025, 0, 0.3);
      },
      flyEnd: () => { [1046.5, 1318.51, 1567.98].forEach((n, k) => tone(n, n, 0.5, 0.03, k * 0.07, 'triangle')); },
      // sword slices the heart: a short 8-bit "ouch" (falling square blip with a little hit thud)
      hurt: () => {
        tone(620, 210, 0.16, 0.06, 0, 'square');
        tone(470, 160, 0.2, 0.035, 0.03, 'square');
        noise(0.05, 0.08, 1200, 0, false, 5000);
        tone(140, 70, 0.12, 0.12);
      },
      // third hit: the heart cracks in two (sharp snap)
      heartCrack: () => {
        noise(0.035, 0.22, 2500, 0, true, 12000);
        tone(900, 300, 0.09, 0.07, 0, 'square');
        tone(180, 90, 0.15, 0.12);
      },
      // ...and shatters: a glassy 8-bit burst with a ringing tail
      heartShatter: () => {
        noise(0.06, 0.2, 1800, 0, false, 12000);
        for (let i = 0; i < 7; i++) { const f = 1400 + Math.random() * 2200; tone(f, f * 0.97, 0.5 + Math.random() * 0.4, 0.03, i * 0.025, 'square'); }
        tone(220, 60, 0.4, 0.12, 0, 'triangle');
        noise(0.7, 0.04, 4000, 0.05, false, 11000);
      },
      // heavy sign dropped off the edge: a falling whistle with air rushing past
      fall: () => {
        tone(820, 170, 0.9, 0.045);
        tone(1230, 250, 0.9, 0.015);
        swoosh(0.9, 0.09, 2400, 260, { q: 0.7, peak: 0.55 });
      },
      // a maxed-out sign falling: a longer, heavier whistle with a roaring rush of air
      fallBig: () => {
        tone(700, 110, 1.05, 0.06);
        tone(1050, 160, 1.05, 0.02);
        tone(180, 60, 1.05, 0.05, 0, 'triangle');
        swoosh(1.05, 0.16, 2600, 180, { q: 0.6, peak: 0.7 });
      },
      // ...and it smashes into the page: a deep boom, a sharp crack, crumbling debris and a ringing metal hit
      crash: () => {
        tone(60, 22, 1.2, 0.42);
        tone(95, 40, 0.6, 0.25, 0, 'triangle');
        noise(0.09, 0.32, 1800, 0, false, 9000);            // the crack
        noise(0.5, 0.16, 60, 0.02, false, 700);             // body of the impact
        for (let i = 0; i < 9; i++) noise(0.03 + Math.random() * 0.04, 0.05 + Math.random() * 0.05, 900 + Math.random() * 2500, 0.12 + i * 0.07 + Math.random() * 0.05, false, 7000); // debris
        tone(880, 870, 1.1, 0.02, 0.01); tone(1390, 1380, 0.9, 0.014, 0.01); tone(2210, 2200, 0.7, 0.008, 0.01);
      },
      // ...and it hits the ground far below: a muffled, distant crash with a fading metal ring
      fallLand: () => {
        tone(70, 28, 0.5, 0.26);
        noise(0.12, 0.09, 80, 0, false, 900);
        noise(0.05, 0.05, 200, 0.06, false, 1400);
        tone(1150, 1140, 0.7, 0.012, 0.02);
        tone(1790, 1780, 0.55, 0.007, 0.02);
      },
      // heavy sticker set down: a deeper clank that rings out
      clank: () => {
        tone(90, 34, 0.38, 0.3);
        noise(0.05, 0.08, 250, 0, false, 2200);
        tone(1480, 1470, 0.5, 0.022, 0.015);
        tone(2340, 2330, 0.42, 0.014, 0.015);
        tone(3710, 3700, 0.3, 0.008, 0.015);
      },
      flyOut: (pan = 0) => {
        swoosh(0.95, 0.2, 2600, 240, { q: 0.75, peak: 0.4, pan0: pan });
        tone(420, 160, 0.8, 0.05);
      },
      // meadow grass brushed aside (k = how hard, 0–1)
      rustle: (k = 0.5) => {
        swoosh(0.16 + 0.08 * k, 0.05 + 0.09 * k, 2400 + 1800 * k, 1100, { q: 1.3, peak: 0.25, pan0: (Math.random() - 0.5) * 0.6 });
        noise(0.04, 0.02 + 0.03 * k, 3500, 0.02, false, 9000);
      },
      // fish leaping out of the lake (k: 0 = tiny … 1 = the giant one): a wet slap and a rising "bloop", deeper for bigger fish
      fishOut: (k = 0.3) => {
        const f = 900 - 520 * k;
        noise(0.07 + 0.09 * k, 0.05 + 0.1 * k, 500, 0, false, 3200 - 1200 * k);
        tone(f * 0.6, f * 1.5, 0.09 + 0.06 * k, 0.07 + 0.05 * k);
      },
      // ...and diving back in: a falling "plop" with a splash of water
      fishIn: (k = 0.3) => {
        const f = 1000 - 560 * k;
        tone(f * 1.4, f * 0.45, 0.11 + 0.08 * k, 0.08 + 0.06 * k);
        noise(0.12 + 0.2 * k, 0.07 + 0.13 * k, 380 - 200 * k, 0.02, false, 3800 - 1500 * k);
        for (let i = 0; i < 2 + Math.round(k * 4); i++) tone(1800 + Math.random() * 1600, 1500, 0.04, 0.02, 0.08 + i * 0.05 + Math.random() * 0.04); // droplets
      },
      // catching a fish: a wet squelch with a grab blip (k: fish size 0..1)
      fishCatch: (k = 0.3) => { noise(0.06, 0.08, 600, 0, false, 3000); tone(520 - 150 * k, 980 - 250 * k, 0.08, 0.1); },
      // a held / stranded fish flopping: a tiny wet slap
      fishFlop: () => { noise(0.035, 0.05, 900, 0, false, 3600); tone(320, 190, 0.05, 0.035); },
      // let go above the ground: it lands with a soft thud
      fishThud: () => { tone(230, 90, 0.12, 0.13); noise(0.03, 0.05, 500, 0, false, 2500); },
      // the ants set off: a tiny pizzicato march on the "Reko" notes, an octave up
      antMarch: () => { [0, 2, 1, 3, 0, 2, 3, 3].forEach((n, i) => { const f = NOTES[n] * 2; tone(f, f, 0.05, 0.03, i * 0.13, 'triangle'); }); },
      antBite: () => { noise(0.025, 0.06, 2600, 0, false, 9000); tone(1900 + Math.random() * 500, 1300, 0.025, 0.025); },
      antsDone: () => { [NOTES[0] * 2, NOTES[2] * 2, NOTES[3] * 2].forEach((f, i) => tone(f, f, 0.06, 0.035, i * 0.08, 'triangle')); },
      // the bear: two low "dun… dun" notes and a rumbling growl from under the ground
      bearRise: () => {
        tone(110, 108, 0.4, 0.13, 0, 'triangle'); tone(103.8, 101, 0.55, 0.13, 0.42, 'triangle');
        tone(72, 60, 1.0, 0.03, 0.2, 'sawtooth'); noise(1.0, 0.07, 40, 0.2, false, 380);
      },
      // ...one huge bite...
      bearStep: () => { tone(85, 55, 0.14, 0.11); noise(0.05, 0.035, 60, 0, false, 500); },
      // the bear chase: driving music (160 bpm, A minor = the "Reko" notes) on its own fader, so it can stop the
      // moment the bear has the fish (chaseStop). Pumping bass A A F G, a soft kick on every beat, ticking hats,
      // the "Reko" notes racing up and down an octave up, off-beat chord stabs; a little more intense every bar.
      chase: () => {
        if (chaseBus) chaseBus.disconnect();
        const bus = ctx.createGain();
        bus.connect(out);
        chaseBus = bus;
        const E8 = 0.1875, roots = [110, 110, 87.31, 98], run = [0, 1, 2, 3, 2, 1, 2, 3];
        for (let i = 0; i < 48; i++) { // 9 s at most; it's cut off long before that
          const at = i * E8, bar = Math.floor(i / 8), k = Math.min(1, bar / 3), r = roots[bar % 4];
          tone(r, r, 0.15, 0.085, at, 'triangle', bus);                                  // bass, every eighth…
          if (i % 2) tone(r * 2, r * 2, 0.09, 0.04, at, 'triangle', bus);                // …pumping up the octave on the off-beats
          if (i % 2 === 0) tone(140, 45, 0.11, 0.12, at, 'sine', bus);                   // kick on every beat
          noise(0.02, 0.006 + (i % 2) * 0.008, 7000, at, false, 14000, bus);             // hats
          noise(0.02, 0.004 + (i % 2) * 0.006, 7000, at + E8 / 2, false, 14000, bus);
          const n = NOTES[run[i % 8]] * (bar >= 2 && bar % 2 === 0 ? 2 : 1);             // the "Reko" notes racing
          tone(n, n, 0.07, 0.02 + 0.018 * k, at, 'triangle', bus);
          if (bar >= 1) tone(n * 2, n * 2, 0.04, 0.008 * k, at + 0.01, 'sine', bus);
          if (bar >= 1 && [0, 3, 6].includes(i % 8)) [r * 4, r * 4 * 1.2, r * 4 * 1.5].forEach((f) => tone(f, f, 0.08, 0.016 + 0.012 * k, at, 'triangle', bus)); // stabs
        }
      },
      chaseStop: (sec = 0.16) => { // cut the chase music (quick fade)
        if (!chaseBus) return;
        const b = chaseBus, t = ctx.currentTime;
        chaseBus = null;
        b.gain.setValueAtTime(1, t);
        b.gain.linearRampToValueAtTime(0.0001, t + sec);
        setTimeout(() => b.disconnect(), sec * 1000 + 250);
      },
      // …and when the bear finally has it: one last big hit as the chase music fades, then it slows down and settles —
      // the "Reko" notes stepping down further and further apart over warm chords, from F major to a calm A major
      // (the chase was in A minor: "done it, now it can rest")
      chaseEnd: () => {
        recipes.chaseStop(0.45);
        tone(150, 40, 0.3, 0.16);                                                       // the hit
        tone(55, 55, 1.2, 0.09, 0, 'triangle'); tone(110, 110, 0.9, 0.06, 0, 'triangle'); // low A
        [220, 261.63, 329.63, 440].forEach((f) => tone(f, f, 0.5, 0.035, 0, 'triangle')); // A minor stab
        [[1568, 0.45, 0.05], [1318.5, 0.95, 0.045], [1046.5, 1.6, 0.04], [880, 2.4, 0.035]].forEach(([f, at, v]) => {
          tone(f, f, 0.5, v, at, 'triangle'); tone(f * 2, f * 2, 0.15, v * 0.25, at + 0.01);
        });
        [174.61, 220, 261.63].forEach((f, i) => pad(f, 2.0, 0.035, 0.5 + i * 0.05, 0.5));           // F major…
        [220, 277.18, 329.63, 440].forEach((f, i) => pad(f, 3.2, 0.032, 2.1 + i * 0.08, 0.7));     // …resting on A major
        [1760, 2217.46].forEach((f, i) => tone(f, f, 0.6, 0.012, 3.0 + i * 0.15));                 // a soft sparkle as it settles
      },
      // the fish sees the bear: two quick rising "!" blips
      fishAlarm: () => { tone(1200, 1800, 0.06, 0.08); tone(1600, 2400, 0.07, 0.08, 0.08); },
      bearChomp: () => { noise(0.07, 0.26, 300, 0, false, 5200); tone(170, 55, 0.2, 0.26); tone(950, 320, 0.05, 0.06); },
      // ...a gulp and a happy little "mm"
      bearGulp: () => { tone(420, 140, 0.22, 0.1); tone(330, 110, 0.2, 0.08, 0.26); tone(220, 216, 0.45, 0.05, 0.6, 'triangle'); tone(277.18, 272, 0.45, 0.035, 0.6, 'triangle'); }, // the "mm" sits in A major, like the end of the chase music
      crowFlap: () => noise(0.06, 0.05, 350, 0, false, 2200),
      crowCaw: () => { [0, 0.24].forEach((at) => { tone(640, 470, 0.17, 0.03, at, 'sawtooth'); tone(1280, 940, 0.17, 0.012, at, 'square'); noise(0.14, 0.025, 1400, at, false, 4200); }); },
      crowPeck: () => { tone(1150, 880, 0.025, 0.06); noise(0.015, 0.06, 2200, 0, false, 8000); },
      // the fish grows legs: a cartoon "sproing"
      legsGrow: () => { tone(240, 920, 0.32, 0.08); tone(480, 1840, 0.28, 0.02); tone(900, 900, 0.05, 0.05, 0.3); },
      // each footstep plays the next note of a little walking tune (the "Reko" notes, an octave down)
      fishStep: (i = 0) => { const tune = [0, 2, 1, 3, 2, 0, 1, 2]; const f = NOTES[tune[i % tune.length]] / 2; tone(f, f, 0.1, 0.06, 0, 'triangle'); noise(0.012, 0.025, 1800); },
      fishHop: () => tone(560, 1250, 0.13, 0.08),
      // the giant fish's jump (d = seconds in the air): the "Reko" notes climb as it rises (with a quiet fifth below),
      // a soft swoosh and a little sparkle run at the top, the notes come back down as it falls, and a tiny two-note chord on landing
      fishGiant: (d = 2.8) => {
        const k = d / 2.8; // the cue was written for a 2.8 s jump; stretch it to this one
        NOTES.forEach((n, i) => {
          const at = (0.12 + i * 0.17) * k;
          tone(n * 0.75, n, 0.2, 0.1, at); tone(n * 2, n * 2, 0.07, 0.022, at + 0.02); tone(n * 0.5, n * 0.667, 0.24, 0.035, at + 0.01);
        });
        setTimeout(() => { if (ctx) swoosh(0.9, 0.035, 2600, 6000, { q: 0.6, peak: 0.45 }); }, 850 * k);
        [NOTES[0] * 2, NOTES[2] * 2, NOTES[3] * 2].forEach((n, i) => tone(n, n, 0.09, 0.035 - i * 0.006, (1.05 + i * 0.07) * k));
        tone(NOTES[1] * 2, NOTES[1] * 2, 0.12, 0.02, 1.45 * k);
        [...NOTES].reverse().forEach((n, i) => {
          const at = (1.72 + i * 0.17) * k;
          tone(n, n * 0.7, 0.16, 0.085, at); tone(n * 0.667, n * 0.467, 0.18, 0.03, at + 0.01);
        });
        const end = 2.46 * k;
        tone(NOTES[0] * 1.03, NOTES[0], 0.5, 0.06, end); tone(NOTES[2] * 1.03, NOTES[2], 0.5, 0.045, end + 0.01); tone(NOTES[0] * 2, NOTES[0] * 2, 0.15, 0.015, end + 0.02);
      },
      // a pencil circling something on paper (d = seconds): a tap as the tip lands, then a run of tiny graphite
      // scratches that swell and fade with the stroke, and a soft lift-off flick at the end
      pencil: (d = 0.85) => {
        noise(0.012, 0.07, 1500, 0, false, 6000);
        const n = Math.round(d / 0.022);
        for (let i = 0; i < n; i++) {
          const k = i / n, env = Math.sin(Math.PI * Math.min(1, k * 1.15)) * 0.8 + 0.2;
          noise(0.018 + Math.random() * 0.02, (0.022 + Math.random() * 0.02) * env, 2400 + Math.random() * 1600, 0.01 + k * d, false, 6500 + Math.random() * 2500);
        }
        noise(0.05, 0.02, 3000, d + 0.01, false, 9000);
      },
      // the secret birdhouse waking up (k = 1, 2, 3...): a wooden rattle that gets longer and louder each click,
      // over a low minor motif that climbs a step every time; from the 3rd one a thin uneasy high note joins in.
      // Its longest part is the low note, 0.5 + 0.15k s (bhShakeLen near wireUnlock uses that for the click cooldown)
      bhShake: (k = 1) => {
        const s = Math.min(1, k / 4);
        for (let i = 0; i < 2 + k * 2; i++) noise(0.03, 0.05 + 0.05 * s, 180, i * (0.055 - s * 0.012), false, 900 + 500 * s);
        const base = 110 * Math.pow(2, (k - 1) * 3 / 12);
        [1, 1.189, 1.498].forEach((m, i) => tone(base * m, base * m, 0.32 + 0.08 * k, 0.05 + 0.03 * s, 0.06 + i * 0.11, 'triangle'));
        tone(base * 0.5, base * 0.485, 0.5 + 0.15 * k, 0.05 + 0.05 * s, 0);
        if (k >= 3) tone(base * 2.83, base * 2.75, 0.45, 0.012 * k, 0.2);
      },
      // ...and the last click, following the picture (css .bh-final): 0-1.2s a digital stutter that gets denser as it
      // breaks down; 1.2s the old TV switching off (falling "bwoop", dying whine, a pop as the dot vanishes); in the dark
      // the brass latch slides open by itself; 2.0s the TV switching back on (static, hum, rising whine); then weird
      // broken tones: a detuned beating drone under stuttering, pitch-jumping notes, crackles, a last whistle falling apart
      bhUnlock: () => {
        swoosh(1.2, 0.06, 200, 5000, { q: 0.6, peak: 0.55 });
        for (let at = 0, i = 0; at < 1.12; i++) {
          if (i % 3 === 1) noise(0.015 + Math.random() * 0.035, 0.1, 500 + Math.random() * 4000, at, true);
          else tone(150 + Math.random() * 2200, 60 + Math.random() * 900, 0.03 + Math.random() * 0.03, 0.045, at, i % 2 ? 'square' : 'sawtooth');
          at += 0.065 - Math.min(0.04, i * 0.0016) + Math.random() * 0.012;
        }
        tone(2400, 40, 0.4, 0.05, 0.8, 'sawtooth');
        tone(700, 45, 0.34, 0.07, 1.2, 'triangle'); tone(9000, 7600, 0.4, 0.012, 1.2);
        noise(0.03, 0.12, 200, 1.53, true, 4000);
        noise(0.04, 0.12, 1500, 1.7, false, 7000);
        noise(0.16, 0.05, 2500, 1.73, false, 9000);
        tone(1900, 2300, 0.05, 0.05, 1.87); tone(950, 950, 0.12, 0.05, 1.88, 'triangle');
        noise(0.4, 0.07, 1200, 2.0, false, 9000); noise(0.02, 0.1, 300, 2.0, true, 5000);
        tone(60, 60, 0.6, 0.05, 2.0, 'square'); tone(6000, 9500, 0.5, 0.012, 2.02);
        const T = 2.35;
        tone(146.8, 146.8, 2.3, 0.035, T, 'sawtooth'); tone(149.6, 147.4, 2.3, 0.035, T, 'sawtooth');
        tone(73.4, 68, 2.5, 0.03, T, 'square');
        [622, 1244, 415, 933, 311, 1661, 554, 1108, 277, 1480, 740, 370].forEach((f, i) => {
          const at = T + 0.05 + i * 0.16 + (i % 3 === 2 ? 0.04 : 0);
          for (let r = 0; r < 3; r++) tone(f * (1 + (Math.random() - 0.5) * 0.04), f * (r === 2 ? 0.5 : 1.02), 0.035, 0.03 * (1 - i / 14), at + r * 0.04, i % 2 ? 'square' : 'triangle');
        });
        for (let i = 0; i < 8; i++) noise(0.01, 0.05, 3000, T + 0.1 + Math.random() * 2, true);
        tone(880, 3520, 0.6, 0.012, T + 1.4); tone(3520, 220, 0.5, 0.015, T + 2.0, 'square');
      },
      // the terminal's shutdown / reboot: the same old TV switching off as bhUnlock (falling "bwoop", dying whine, a pop
      // as the dot vanishes at 0.36s, css .pwr)...
      pcOff: () => {
        tone(700, 45, 0.34, 0.07, 0, 'triangle'); tone(9000, 7600, 0.4, 0.012, 0);
        noise(0.03, 0.12, 200, 0.36, true, 4000);
      },
      // ...and back on (reboot): static, hum, rising whine
      pcOn: () => {
        noise(0.4, 0.07, 1200, 0, false, 9000); noise(0.02, 0.1, 300, 0, true, 5000);
        tone(60, 60, 0.6, 0.05, 0, 'square'); tone(6000, 9500, 0.5, 0.012, 0.02);
      },
      // birdhouse loot set down (after the usual drop): the shovel rings like a spade on stone, the compass ticks like
      // glass, the coin goes "ding-ding" like a game coin, the magnet goes "zzip"
      bhItem: (id) => {
        if (id === 'shovel') { noise(0.03, 0.09, 1200, 0, false, 6000); tone(1320, 1300, 0.35, 0.05, 0.005, 'triangle'); tone(2970, 2950, 0.2, 0.025, 0.005); }
        else if (id === 'coin') { tone(1976, 1976, 0.07, 0.04, 0, 'square'); tone(2637, 2637, 0.32, 0.04, 0.07, 'square'); tone(5274, 5200, 0.25, 0.012, 0.07); }
        else if (id === 'compass') { tone(3200, 3100, 0.05, 0.05); tone(4800, 4700, 0.04, 0.03, 0.05); noise(0.015, 0.05, 4000, 0.05); }
        else { tone(180, 720, 0.09, 0.05, 0, 'square'); tone(720, 360, 0.08, 0.03, 0.09, 'square'); }
      },
      // the map's compass nail feels the magnet: a creaky rattle that speeds up (0-0.5s, the nail wiggling), a rising
      // metallic whoosh as it shoots out (0.52s), the freed needle swinging loose with two tiny ticks, a clink as it hits the magnet (0.97s)
      nailPull: () => {
        for (let i = 0, at = 0; i < 8; i++) { noise(0.025, 0.04 + 0.01 * i, 300, at, false, 2500); tone(90 + i * 14, 75 + i * 12, 0.04, 0.03, at, 'square'); at += 0.085 - i * 0.008; }
        swoosh(0.45, 0.04, 900, 6500, { q: 1.2, peak: 0.85 });
        tone(480, 2600, 0.42, 0.03, 0.52); tone(960, 3400, 0.4, 0.012, 0.54, 'triangle');
        tone(3000, 2900, 0.03, 0.03, 0.62); tone(2500, 2400, 0.03, 0.02, 0.78);
        noise(0.02, 0.09, 3000, 0.97, true);
        tone(2637, 2630, 0.3, 0.055, 0.97, 'triangle'); tone(3951, 3940, 0.2, 0.025, 0.97); tone(1760, 1720, 0.35, 0.02, 1.0);
      },
      // the needle clicks into the birdhouse compass: a click, quick ticks slowing down as it spins (to 1.2s), and it
      // settles pointing north with a soft open fifth
      needleFix: () => {
        noise(0.02, 0.1, 2000, 0, true); tone(1500, 1450, 0.05, 0.035, 0, 'square');
        for (let i = 0, at = 0.08; i < 13; i++) { tone(4200 - i * 90, 4100 - i * 90, 0.015, 0.025 - i * 0.0012, at); at += 0.035 + i * 0.011; }
        tone(523.25, 523.25, 0.9, 0.035, 1.22, 'triangle'); tone(783.99, 783.99, 0.9, 0.028, 1.3, 'triangle');
      },
      // the shovel biting into the ground: a crunchy earthy scrape, a dull thud and a few pebbles
      dig: () => {
        noise(0.2, 0.12, 120, 0, false, 1400); noise(0.06, 0.06, 1500, 0.02, true, 5000);
        tone(95, 50, 0.14, 0.08, 0.01, 'triangle');
        for (let i = 0; i < 3; i++) noise(0.01, 0.035, 3000, 0.09 + i * 0.045 + Math.random() * 0.02, true);
      },
      // the geocache rising out of the hole: a low earthy rumble, then a bright little "found it!" fanfare and sparkles
      cacheFound: () => {
        noise(0.45, 0.05, 80, 0, false, 600); tone(110, 220, 0.45, 0.03, 0, 'triangle');
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { tone(f, f, 0.24, 0.05, 0.4 + i * 0.1, 'triangle'); tone(f * 2, f * 2, 0.12, 0.012, 0.4 + i * 0.1); });
        [1046.5, 783.99, 659.25].forEach((f, i) => pad(f, 1.3, 0.025, 0.82, 0.03, 'triangle', [5, -5, 0][i]));
        for (let i = 0; i < 7; i++) tone(2200 + Math.random() * 3000, 2600 + Math.random() * 3000, 0.05, 0.012, 0.85 + i * 0.08);
      },
      // the cache rattled (k = 1, 2, 3...): plastic clatter over a cheerful motif that climbs a step every click;
      // its longest part is the low note, 0.45 + 0.1k s (cacheShakeLen uses that for the click cooldown)
      cacheShake: (k = 1) => {
        const s = Math.min(1, k / 4);
        for (let i = 0; i < 2 + k * 2; i++) noise(0.025, 0.05 + 0.04 * s, 900, i * (0.05 - s * 0.01), true, 4500);
        const base = 262 * Math.pow(2, (k - 1) * 2 / 12);
        [1, 1.26, 1.5].forEach((m, i) => tone(base * m, base * m, 0.25 + 0.05 * k, 0.04 + 0.02 * s, 0.05 + i * 0.09, 'triangle'));
        tone(base / 2, base / 2, 0.45 + 0.1 * k, 0.04, 0);
      },
      // ...and the last click: the lid snaps open with a creak, a sparkling reveal, the logbook fluttering out and
      // landing with a soft thud (1.05s)
      cacheOpen: () => {
        noise(0.03, 0.12, 1500, 0, true, 8000); tone(900, 400, 0.06, 0.05, 0, 'square');
        tone(180, 300, 0.35, 0.012, 0.05, 'sawtooth');
        [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, f, 0.3, 0.045, 0.25 + i * 0.08, 'triangle'));
        [523.25, 659.25, 783.99].forEach((f, i) => pad(f, 1.6, 0.022, 0.65, 0.05, 'triangle', [0, 4, -4][i]));
        for (let i = 0; i < 6; i++) noise(0.03, 0.03, 2000, 0.45 + i * 0.07, false, 6000);
        tone(160, 90, 0.1, 0.06, 1.05, 'triangle'); noise(0.05, 0.05, 300, 1.05, false, 2000);
        for (let i = 0; i < 5; i++) tone(2400 + Math.random() * 2500, 3000 + Math.random() * 2500, 0.05, 0.01, 0.7 + i * 0.1);
      },
      // duhel_railways.run: a piece knocking into the floor or another piece (k = how hard, 0..1; kind: 'rail' = light
      // metal, 'cart' = heavy metal, 'torch' = wood)
      // the "sudo rm -rf /" terminal chewing through the disk: a dry hard-drive seek click, now and then a low head clunk
      rmTick: () => {
        noise(0.007, 0.022, 3500, 0, true, 9000);
        if (Math.random() < 0.3) tone(170 + Math.random() * 90, 110, 0.035, 0.028, 0, 'square');
      },
      railHit: (k = 0.5, kind = 'rail') => {
        k = Math.max(0.08, Math.min(1, k));
        if (kind === 'torch') { tone(560 + Math.random() * 140, 240, 0.07, 0.04 + 0.08 * k, 0, 'triangle'); noise(0.03, 0.03 + 0.05 * k, 900, 0, false, 4200); return; }
        const f = (kind === 'cart' ? 1150 : 2050) * (0.9 + Math.random() * 0.25);
        tone(kind === 'cart' ? 150 : 240, 60, 0.12 + 0.1 * k, 0.05 + 0.15 * k);
        noise(0.03, 0.04 + 0.08 * k, kind === 'cart' ? 400 : 1300, 0, false, 6500);
        tone(f, f * 0.995, 0.16 + 0.26 * k, 0.01 + 0.03 * k, 0.005);
        tone(f * 1.51, f * 1.5, 0.12 + 0.16 * k, 0.005 + 0.015 * k, 0.005);
      },
      // ...the pieces raining into the window the first time it opens: Reko notes falling under a rush of air
      railRain: () => {
        swoosh(1.1, 0.11, 2600, 300, { q: 0.7, peak: 0.4 });
        NOTES.slice().reverse().forEach((n, i) => tone(n, n * 0.8, 0.28, 0.026, i * 0.11, 'triangle'));
      },
      // picking a piece up: a light metallic lift
      railGrab: () => { tone(620, 1250, 0.06, 0.1); tone(2620, 2640, 0.14, 0.018, 0.02); noise(0.015, 0.05, 3000); },
      // ...and setting it into the grid: a solid "chunk" that locks in with a click (the torch: a wooden tock)
      railPlace: (kind) => {
        if (kind === 'torch') { tone(420, 210, 0.1, 0.12, 0, 'triangle'); noise(0.03, 0.06, 700, 0, false, 3500); return; }
        tone(170, 70, 0.14, 0.22);
        noise(0.025, 0.07, 1500, 0, false, 7000);
        tone(2400, 2400, 0.03, 0.05, 0.05); tone(3600, 3600, 0.04, 0.02, 0.055);
        if (kind === 'cart') tone(1180, 1170, 0.35, 0.02, 0.01);
      },
      // a rail turning to meet its neighbours: a quick ratchet
      railTurn: () => { for (let i = 0; i < 3; i++) noise(0.012, 0.05, 2600, i * 0.035, true, 9000); tone(1400, 1950, 0.09, 0.035); },
      // a powered rail lighting up near the torch: a rising electric buzz into a Reko note (and back down when it goes out)
      railPower: (i = 0) => {
        const n = NOTES[i % 4];
        tone(220, n / 2, 0.16, 0.022, 0, 'square');
        tone(n, n, 0.3, 0.05, 0.14); tone(n * 2, n * 2, 0.12, 0.012, 0.15);
        noise(0.14, 0.02, 4000, 0, false, 9000);
      },
      railOff: () => { tone(700, 180, 0.18, 0.025, 0, 'square'); },
      // the torch lit: a soft fizz swelling into a warm glow
      torchOn: () => { noise(0.3, 0.05, 2400, 0, false, 7000); tone(300, 620, 0.22, 0.03, 0, 'triangle'); pad(440, 0.7, 0.02, 0.05, 0.12); },
      // the minecart rolling over a rail joint: a double clack
      cartClack: () => {
        [0, 0.075].forEach((a) => { noise(0.02, 0.045, 1500, a, false, 6000); tone(330, 180, 0.04, 0.045, a, 'triangle'); });
        tone(1650, 1640, 0.12, 0.007);
      },
      // a lit powered rail pushing the cart: a whoosh and a rising Reko note (i: which rail, so the loop plays a little tune)
      cartBoost: (i = 0) => {
        const n = NOTES[i % 4];
        swoosh(0.32, 0.06, 600, 2400, { q: 1, peak: 0.5 });
        tone(n * 0.5, n, 0.14, 0.035, 0, 'triangle'); tone(n * 2, n * 2, 0.08, 0.008, 0.08);
      },
      // ...an unlit powered rail braking it: a short metal squeal
      cartBrake: () => { tone(2300, 1500, 0.22, 0.02, 0, 'square'); noise(0.2, 0.03, 3000, 0, false, 8000); },
      // the cart running off the end of the line: a falling whistle
      cartOff: () => { tone(900, 300, 0.45, 0.04); swoosh(0.45, 0.06, 2200, 400, { q: 0.8, peak: 0.4 }); }
    };

    /* music under a video (data-music on its polaroid). "paradise": a chill lo-fi loop at 84 bpm built around the
       "Reko" notes: soft electric-piano chords (Fmaj9, Em7, Am9, G6) with a warm round bass, a lazy swung kick, rim and
       shaker, and a little kalimba hook that comes back every two bars with an echo trailing behind it (every 8th bar it
       climbs up instead). It has its own quiet fader (MUS_V) so it stays under everything: it swells in when the clip
       plays and fades away when it stops; with the sound off or the tab hidden it goes quiet and comes back on the beat. */
    const MUS_V = 0.6, B16 = 60 / 84 / 4;
    const TUNES = {
      paradise: {
        chords: [[174.61, 220, 261.63, 329.63, 392], [164.81, 196, 246.94, 293.66, 329.63], [196, 261.63, 329.63, 392, 493.88], [146.83, 246.94, 293.66, 329.63, 392]],
        bass: [87.31, 82.41, 110, 98],
        hook: [[[0, 1318.5], [3, 1568], [6, 1318.5], [10, 1174.66], [12, 1046.5]], [[0, 987.77], [3, 1174.66], [6, 1318.5], [8, 1174.66], [14, 987.77]]],
        climb: [[0, 987.77], [3, 1174.66], [6, 1318.5], [9, 1568], [12, 1760]],
      },
    };
    let mus = null;
    const hold = (g, t) => { if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t); else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); } };
    const tuneLive = (on) => document.documentElement.classList.toggle('tune-live', on); // the dancing bars in the video's title
    function musStep(m, i, t) { // one 16th of the loop, at time t
      const T = TUNES[m.name], bar = Math.floor(i / 16), s = i % 16, c = bar % 4;
      const at = t - ctx.currentTime + (s % 4 === 2 ? B16 * 0.18 : 0); // a little swing on the off-beat 16ths
      if (s === 0 || s === 10) T.chords[c].forEach((f, k) => { // e-piano: a triangle pluck with a sine shimmer, strummed a little
        const v = s ? 0.01 : 0.015;
        tone(f, f, s ? 1.2 : 2.7, v, at + k * 0.014, 'triangle', m.ep);
        tone(f * 2, f * 2, 0.4, v * 0.22, at + k * 0.014, 'sine', m.ep);
      });
      if (s === 0) T.chords[c].slice(1, 4).forEach((f, k) => pad(f, B16 * 16 + 0.3, 0.007, at, 0.9, 'sine', [0, 5, -5][k])); // a soft bed under it
      const r = T.bass[c]; // bass: the root on 1, a nudge before 3 and the fifth after it
      if (s === 0) { tone(r, r, 1.5, 0.075, at); tone(r * 2, r * 2, 0.5, 0.012, at, 'triangle', m.bus); }
      if (s === 7) tone(r, r, 0.4, 0.05, at);
      if (s === 10) tone(r * 1.5, r * 1.5, 0.6, 0.045, at);
      if (bar >= 2) { // drums join on the third bar
        if (s === 0 || s === 10) tone(120, 46, 0.2, 0.085, at);
        if (s === 4 || s === 12) { noise(0.045, 0.02, 1800, at, false, 5200); tone(1650, 1500, 0.02, 0.008, at, 'triangle'); }
        if (s % 2 === 0) noise(0.03, s % 4 === 2 ? 0.008 : 0.0045, 6500, at, false, 12000);
      }
      if (bar >= 1) { // the hook joins on the second bar
        const hb = bar % 8, line = hb === 7 ? T.climb : T.hook[hb % 2];
        line.forEach(([st, f]) => {
          if (st !== s) return;
          tone(f, f, 0.95, 0.03, at, 'sine', m.hk);           // the tine
          tone(f * 3, f * 3, 0.09, 0.006, at, 'sine', m.hk);  // its little metallic ping
          tone(f / 2, f / 2, 0.5, 0.008, at, 'triangle', m.hk);
        });
      }
    }
    function musPump() {
      const m = mus;
      if (!m) return;
      const t = ctx.currentTime;
      if (m.leaving) { while (m.next < t) { m.next += B16; m.i++; } return; }
      const on = site.soundOn && !document.hidden && ctx.state === 'running';
      if (on !== m.on) {
        m.on = on;
        hold(m.bus.gain, t);
        m.bus.gain.setTargetAtTime(on ? MUS_V : 0.0001, t, on ? 0.5 : 0.06);
        tuneLive(on);
      }
      if (!on) { while (m.next < t) { m.next += B16; m.i++; } return; } // keep its place in the beat, play nothing
      cur = m.bus; // pad() plays into `cur`
      try {
        while (m.next < t + 0.3) { if (m.next > t - 0.02) musStep(m, m.i, m.next); m.next += B16; m.i++; }
      } finally { cur = null; }
    }
    function musicStart(name) {
      if (!TUNES[name] || !ensure()) return;
      if (mus && mus.name === name) {
        if (mus.leaving) { clearTimeout(mus.leaving); mus.leaving = 0; mus.on = null; musPump(); } // fading out: bring it back
        return;
      }
      musicStop(0.3);
      const bus = ctx.createGain();
      bus.gain.value = 0.0001;
      bus.connect(out);
      const ep = ctx.createGain(), lp = ctx.createBiquadFilter(); // the e-piano, a little rounded off
      lp.type = 'lowpass'; lp.frequency.value = 2400;
      ep.connect(lp).connect(bus);
      const hk = ctx.createGain(), dl = ctx.createDelay(1), fb = ctx.createGain(), dlp = ctx.createBiquadFilter(), wet = ctx.createGain();
      dl.delayTime.value = B16 * 3; fb.gain.value = 0.32; dlp.type = 'lowpass'; dlp.frequency.value = 2600; wet.gain.value = 0.5;
      hk.connect(bus); hk.connect(dl); dl.connect(dlp).connect(fb).connect(dl); dlp.connect(wet).connect(bus); // the hook's echo
      mus = { name, bus, ep, hk, i: 0, next: ctx.currentTime + 0.12, on: null, leaving: 0, timer: setInterval(musPump, 90) };
      musPump();
    }
    function musicStop(sec = 1.4) {
      const m = mus;
      if (!m || m.leaving) return;
      const t = ctx.currentTime;
      hold(m.bus.gain, t);
      m.bus.gain.exponentialRampToValueAtTime(0.0001, t + sec);
      tuneLive(false);
      m.leaving = setTimeout(() => { clearInterval(m.timer); m.bus.disconnect(); if (mus === m) mus = null; }, sec * 1000 + 150);
    }

    // a coin scratching lottery foil: a dry, gritty hiss (a high band of noise) with tiny crackles of grit;
    // loudness and brightness follow how fast the coin moves, and it dies away by itself when the coin stops
    let foil = null;
    function foilMove(speed, bare) {
      if (!foil) {
        const s = ctx.createBufferSource(), h = ctx.createBiquadFilter(), b = ctx.createBiquadFilter(), g = ctx.createGain();
        s.buffer = noiseBuf;
        s.loop = true;
        h.type = 'highpass'; h.frequency.value = 1800;
        b.type = 'peaking'; b.frequency.value = 4200; b.Q.value = 1.2; b.gain.value = 8;
        g.gain.value = 0;
        s.connect(h).connect(b).connect(g).connect(out);
        s.start(0, Math.random() * 0.3);
        foil = { s, b, g, last: 0 };
      }
      const t = ctx.currentTime, sp = Math.min(1.5, speed), v = Math.min(0.15, 0.03 + sp * 0.08) * (bare ? 0.35 : 1);
      foil.g.gain.cancelScheduledValues(t);
      foil.g.gain.setTargetAtTime(v * (0.75 + Math.random() * 0.5), t, 0.015);
      foil.g.gain.setTargetAtTime(0, t + 0.06, 0.05);
      foil.b.frequency.setTargetAtTime((bare ? 2400 : 3200) + Math.min(1, sp) * 2600, t, 0.04);
      if (!bare && t - foil.last > 0.035 && Math.random() < 0.65) { // the grit: tiny clicks of foil tearing
        foil.last = t;
        noise(0.01 + Math.random() * 0.014, 0.04 + Math.random() * 0.05, 2500, 0, true, 9000, out);
      }
    }
    function foilStop() {
      if (!foil) return;
      const f = foil;
      foil = null;
      const t = ctx.currentTime;
      f.g.gain.cancelScheduledValues(t);
      f.g.gain.setTargetAtTime(0, t, 0.03);
      f.s.stop(t + 0.3);
    }

    let lastT = 0;
    const SILENT = { stop() {} };
    const live = () => site.soundOn && !document.hidden && ctx && ctx.state === 'running';
    return {
      motionStart() { if (live()) motionStart(); },
      motionMove(speed, pos) { if (live()) motionMove(speed, pos); else motionStop(); },
      motionStop() { if (ctx) motionStop(); },
      scrapeStart() { if (live()) scrapeStart(); },
      scrapeMove(speed) { if (live()) scrapeMove(speed); else scrapeStop(); },
      scrapeStop() { if (ctx) scrapeStop(); },
      scratchMove(rate) { if (live()) { scratchStart(); scratchMove(rate); } else scratchStop(); },
      scratchStop() { if (ctx) scratchStop(); },
      foilMove(speed, bare) { if (live()) foilMove(speed, bare); else foilStop(); }, // the coin on the scratch-off foil
      foilStop() { if (ctx) foilStop(); },
      music(name) { musicStart(name); }, // a video's own music (data-music), see TUNES
      // the site is switched off (terminal shutdown / reboot): everything still playing fades out in `at` s and stays quiet
      silence(at = 0) {
        if (!ctx) return;
        musicStop(0.2);
        const t = ctx.currentTime + at;
        out.gain.cancelScheduledValues(t);
        out.gain.setValueAtTime(0.9, t);
        out.gain.linearRampToValueAtTime(0, t + 0.15);
      },
      wake() { if (ctx) { out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setValueAtTime(0.9, ctx.currentTime); } }, // ...back on (reboot)
      musicStop(sec) { if (ctx) musicStop(sec); },
      // force: play even when muted (the "sound off" blip)
      // returns a voice: voice.stop(sec) fades the sound out early (the action was cancelled); always safe to call
      play(name, arg, arg2, force) {
        if ((!site.soundOn && !force) || document.hidden) return SILENT;
        if (!ensure() || ctx.state !== 'running') return SILENT; // not unlocked yet: stay silent instead of queueing
        if (name === 'tick') {
          const now = performance.now();
          if (now - lastT < 35) return SILENT;
          lastT = now;
        }
        const bus = ctx.createGain();
        bus.connect(out);
        cur = bus; curEnd = 0;
        try { recipes[name](arg, arg2); } finally { cur = null; }
        let done = false;
        const end = setTimeout(() => { done = true; bus.disconnect(); }, (curEnd + 0.3) * 1000);
        return {
          stop(sec = 0.08) {
            if (done) return;
            done = true;
            clearTimeout(end);
            const t = ctx.currentTime;
            bus.gain.cancelScheduledValues(t);
            bus.gain.setValueAtTime(bus.gain.value, t);
            bus.gain.linearRampToValueAtTime(0.0001, t + sec);
            setTimeout(() => bus.disconnect(), sec * 1000 + 100);
          }
        };
      }
    };
  })();
});
