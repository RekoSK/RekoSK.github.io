/* rekosk.dev: sound on / off (saved as reko-sound), the audio files and the nav's Sound button */
'use strict';

rekoSite.part((site) => {
  const { $, root } = site;
  site.share({
    soundOn: () => soundOn, sfx: () => sfx, audioReady: () => audioReady, soundBtn: () => soundBtn,
    sndHint: () => sndHint, setSound: () => setSound, renderSound: () => renderSound, playSound: () => playSound,
    stopSounds: () => stopSounds, fadeSound: () => fadeSound,
  });

  /* ---------- sound ---------- */
  const SOUND_KEY = 'reko-sound';
  let soundOn = true;
  try { soundOn = localStorage.getItem(SOUND_KEY) !== 'off'; } catch (err) { /* storage blocked */ }

  const sfx = {
    intro: new Audio('assets/sound/intro.mp3'), // Full.mp4 soundtrack up to the wink + a landing whoosh
    poke: new Audio('assets/sound/poke.mp3'),   // grow + wink, for clicking the logo
    blink: new Audio('assets/sound/blink.mp3'),  // the exact blink from Full.mp4 (close + reopen blips)
    heartCrack: new Audio('assets/sound/heart-crack.mp3'),    // the exact crack from heartshatter.mp4
    heartShatter: new Audio('assets/sound/heart-shatter.mp3') // ...and the exact shatter from it
  };
  let audioReady = false;
  Object.values(sfx).forEach((a) => { a.preload = 'auto'; });
  sfx.intro.addEventListener('canplaythrough', () => { audioReady = true; }, { once: true });
  sfx.intro.addEventListener('error', () => { audioReady = true; }, { once: true });
  sfx.intro.load();

  const soundBtn = $('#soundBtn');
  const sndHint = $('#sndHint');

  function setSound(on, quiet) { // quiet: no on / off blip (the lake speaker plays its own sounds)
    if (!on && soundOn && !quiet) site.ui.play('off', 0, 0, true);
    soundOn = on;
    if (on && !quiet) site.ui.play('on');
    try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); document.dispatchEvent(new CustomEvent('reko:saved')); } catch (err) { /* storage blocked */ }
    renderSound();
    if (!on) { stopSounds(); site.ui.play('chaseStop', 0, 0, true); } // also cuts the bear chase music if it's playing
  }
  function renderSound() {
    root.classList.toggle('muted', !soundOn);
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    $('.snd-lbl', soundBtn).textContent = soundOn ? 'Sound on' : 'Sound off';
  }
  function playSound(name) {
    if (!soundOn) return Promise.resolve(true);
    const a = sfx[name];
    cancelAnimationFrame(a._fade); a.volume = 1; // a fade-out may still be running from last time
    a.currentTime = 0;
    return a.play().then(() => true, () => false); // false = the browser blocked autoplay
  }
  function stopSounds() {
    Object.values(sfx).forEach((a) => { cancelAnimationFrame(a._fade); a.pause(); a.volume = 1; });
  }
  // let a playing audio file die away over `sec` instead of cutting it (cancelled actions, skipping the intro)
  function fadeSound(a, sec = 0.3) {
    if (a.paused) return;
    cancelAnimationFrame(a._fade);
    const v0 = a.volume, t0 = performance.now();
    (function step(now) {
      const k = Math.min(1, Math.max(0, (now - t0) / (sec * 1000))); // rAF time can be a little behind t0
      a.volume = v0 * (1 - k);
      if (k < 1) { a._fade = requestAnimationFrame(step); return; }
      a.pause(); a.volume = 1;
    })(t0);
  }
});
