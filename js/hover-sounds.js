/* rekosk.dev: hover sounds for everything interactive, and the orange text fills that go with them */
'use strict';

rekoSite.part((site) => {
  const { $, $$, ui } = site;

  /* ---------- sounds for everything interactive ---------- */
  // hover: a quiet tick, pitched per kind of element (mouse only)
  const HOVER_SEL = '.chip, a[href], button, .stk, .now, .card, .sec-title, .note';
  // longer hover sounds follow the cursor: leaving early cuts the "in" sound short and hands over to the "out"
  // sound (if there is one), scaled to how far the effect got, so a quick brush past only gets a short retreat;
  // coming back cuts the retreat the same way
  const hoverVoices = new WeakMap();
  // how long a highlight on this text takes (seconds): longer text fills slower, about 1.2s for one word up to 3.2s
  // for a whole sentence. Every highlight with a sound uses it for both the visual (as --fd) and the sound
  const fillTime = (el) => Math.round(Math.min(3.2, Math.max(1.1, 0.75 + el.textContent.trim().length * 0.055)) * 100) / 100;
  $$('.sec-title').forEach((el) => el.style.setProperty('--fd', fillTime(el) + 's'));
  function hoverIn(el, name, dur, arg) {
    const v = hoverVoices.get(el);
    if (v) v.voice.stop(0.05);
    hoverVoices.set(el, { voice: ui.play(name, arg), at: performance.now(), dur: dur * 1000 });
  }
  function hoverOut(el, name, sec = 0.07) {
    const v = hoverVoices.get(el);
    let p = 1;
    if (v) { p = Math.min(1, (performance.now() - v.at) / v.dur); v.voice.stop(sec); }
    hoverVoices.delete(el);
    if (name && p > 0.05) hoverVoices.set(el, { voice: ui.play(name, p), at: 0, dur: Infinity });
  }
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest(HOVER_SEL);
    if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return; // still inside the same element
    if (el.matches('.stk-eyes')) return; // it plays the blink instead
    if (el.matches('.sec-title')) { const d = fillTime(el); hoverIn(el, 'spray', d, d); }
    else if (el.matches('.note')) hoverIn(el, 'paper', 0.5);
    else if (el.matches('.chip')) ui.play('tick', 3300, 0.03);
    else if (el.matches('.card')) ui.play('tick', 1900, 0.04);
    else if (el.matches('.stk')) ui.play('tick', 1500, 0.045);
    else if (el.matches('.now')) ui.play('tick', 2200, 0.035);
    else ui.play('tick');
  });

  // leaving: the school notes answer with their own "out" sound, a section title's spray just fades
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest('.note, .sec-title');
    if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return; // still inside it
    hoverOut(el, el.matches('.note') ? 'paperOut' : null, el.matches('.sec-title') ? 0.12 : 0.07);
  });

  // title lines (About me, offline, social media): the orange wave fills in while its rising notes play
  $$('.lead-hover').forEach((leadHover) => {
    // tell each highlighted word where it sits along the line (0..1) so it fills exactly when the wave reaches it
    const leadBox = $('.lead-box', leadHover);
    const mapLead = () => {
      const w = leadBox.offsetWidth;
      if (!w) return;
      $$('.lead-name, .lead-the', leadBox).forEach((el) => {
        el.style.setProperty('--a', (el.offsetLeft / w).toFixed(3));
        el.style.setProperty('--b', ((el.offsetLeft + el.offsetWidth) / w).toFixed(3));
      });
    };
    mapLead();
    if (document.fonts) document.fonts.ready.then(mapLead);
    window.addEventListener('resize', mapLead);
    const leadD = fillTime(leadBox); // the wave's length follows the length of the line, like every other highlight
    leadHover.style.setProperty('--fd', leadD + 's');
    leadHover.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hoverIn(leadHover, 'leadIn', leadD, leadD); });
    leadHover.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hoverOut(leadHover, 'leadOut'); });
  });

  // text that fills orange on hover: the fill and its sparkly sound take longer the longer the text is
  // (about 1.2s for one word up to 3.2s for a whole sentence), so every highlight moves at a similar, unhurried pace
  $$('.fill-hover').forEach((el) => {
    const d = fillTime(el); // fill length in seconds
    el.style.setProperty('--fd', d + 's');
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hoverIn(el, 'fillInT', d, d); });
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hoverOut(el, 'fillOut'); });
  });
});
