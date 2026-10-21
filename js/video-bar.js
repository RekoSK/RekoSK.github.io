/* rekosk.dev: the play / pause and seek bar of the videos in photo windows */
'use strict';

rekoSite.part((site) => {
  const { ui } = site;
  site.share({ vidBar: () => vidBar });

  /* the control bar for a clip (photo windows' videos): the clip toggles play / pause on a click
     of `clickArea`, `host` gets .paused while it's paused (CSS shows the orange play badge and swaps the button icon);
     `place(bar)` puts the bar into the page. */
  function vidBar(vid, host, clickArea, place) {
    vid.addEventListener('play', () => host.classList.remove('paused'));
    vid.addEventListener('pause', () => host.classList.add('paused'));
    const toggle = () => {
      const go = vid.paused;
      if (go) vid.play().catch(() => {}); else vid.pause();
      try { ui.play(go ? 'on' : 'off'); } catch (err) {}
    };
    clickArea.addEventListener('click', toggle);
    // the control bar under the clip: a hand-drawn play/pause button, the time, and a pencil line that fills orange
    // as the clip plays; click or drag the line to jump (pencil-scrape sound), arrow keys skip 5s
    const cb = document.createElement('div');
    cb.className = 'vid-bar';
    cb.innerHTML = '<button class="vid-btn" type="button" aria-label="Pause"><svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path class="i-play" d="M8.3 5.4c-.3 4.4-.2 8.8.1 13.2 3.2-1.9 6.3-4 9.3-6.4-3-2.4-6.2-4.6-9.4-6.8z"/>' +
      '<g class="i-pause"><path d="M8.6 5.6c-.3 4.3-.1 8.6.1 12.9"/><path d="M15.3 5.4c.2 4.4-.1 8.8-.2 13.1"/></g></svg></button>' +
      '<div class="vid-track" role="slider" tabindex="0" aria-label="Video position" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0">' +
      '<span class="vid-time mono"><b>0:00</b><i>/ 0:00</i></span><div class="vid-line">' +
      '<svg class="vl-bg" viewBox="0 0 400 20" preserveAspectRatio="none" aria-hidden="true"><path d="M3 10.6C70 8.9 130 11.6 200 9.9S330 9.1 397 10.4"/></svg>' +
      '<svg class="vl-fg" viewBox="0 0 400 20" preserveAspectRatio="none" aria-hidden="true"><path d="M3 10.6C70 8.9 130 11.6 200 9.9S330 9.1 397 10.4"/></svg>' +
      '<span class="vid-ghost"></span><span class="vid-pos"><span class="vid-knob"></span></span></div></div>';
    place(cb);
    const vbtn = cb.querySelector('.vid-btn'), track = cb.querySelector('.vid-track'), line = cb.querySelector('.vid-line'), tNow = cb.querySelector('.vid-time b'), tAll = cb.querySelector('.vid-time i');
    const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    let shown = '';
    // smooth: a video only reports its time once per frame of the clip (some browsers just ~4x a second), so while it plays
    // the line runs on the clock between reports and never steps back; seeks, loops and pauses snap it to the real time
    let ref = { t: -1, at: 0 }, disp = 0;
    const paint = (live) => {
      const d = vid.duration || 0, ct = vid.currentTime, now = performance.now();
      if (ct !== ref.t) ref = { t: ct, at: now };
      let t = ct;
      if (live === true) {
        const est = Math.min(d || Infinity, ref.t + Math.min(0.5, (now - ref.at) / 1000) * (vid.playbackRate || 1));
        t = Math.abs(est - disp) > 0.6 ? est : Math.max(disp, est);
      }
      disp = t;
      const p = d ? Math.min(1, t / d) : 0;
      cb.style.setProperty('--p', (p * 100).toFixed(4) + '%');
      const s = fmt(ct);
      if (s !== shown) { shown = s; tNow.textContent = s; track.setAttribute('aria-valuenow', Math.floor(vid.currentTime)); track.setAttribute('aria-valuetext', s); }
    };
    let raf = 0;
    const loop = () => { paint(true); raf = host.isConnected && !vid.paused ? requestAnimationFrame(loop) : 0; };
    vid.addEventListener('play', () => { vbtn.setAttribute('aria-label', 'Pause'); if (!raf) raf = requestAnimationFrame(loop); });
    vid.addEventListener('pause', () => { vbtn.setAttribute('aria-label', 'Play'); paint(); });
    vid.addEventListener('loadedmetadata', () => { tAll.textContent = '/ ' + fmt(vid.duration); track.setAttribute('aria-valuemax', Math.floor(vid.duration)); paint(); });
    vid.addEventListener('seeked', paint);
    let lastT = 0;
    vid.addEventListener('timeupdate', () => { // it looped: a little flick, like the pencil going back to the start
      if (vid.currentTime + 0.5 < lastT && !scrub) { cb.classList.remove('looped'); void cb.offsetWidth; cb.classList.add('looped'); try { ui.play('tick', 1800, 0.035); } catch (err) {} }
      lastT = vid.currentTime;
    });
    vbtn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    // drag / click the line to jump; the clip holds still while you scrub and carries on as it was afterwards
    const at = (x) => { const r = line.getBoundingClientRect(); return Math.max(0, Math.min(1, (x - r.left) / r.width)); };
    let scrub = null;
    track.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.vid-btn') || !vid.duration) return;
      scrub = { id: e.pointerId, was: !vid.paused, x: e.clientX, t: performance.now() };
      track.setPointerCapture(e.pointerId);
      cb.classList.add('scrubbing');
      vid.pause();
      vid.currentTime = at(e.clientX) * vid.duration; paint();
      try { ui.play('grab'); ui.scrapeStart(); } catch (err) {}
      e.preventDefault(); e.stopPropagation();
    });
    track.addEventListener('pointermove', (e) => {
      cb.style.setProperty('--g', (at(e.clientX) * 100).toFixed(2) + '%');
      if (!scrub || scrub.id !== e.pointerId) return;
      const now = performance.now(), speed = Math.abs(e.clientX - scrub.x) / Math.max(8, now - scrub.t);
      scrub.x = e.clientX; scrub.t = now;
      vid.currentTime = at(e.clientX) * vid.duration; paint();
      try { ui.scrapeMove(speed); } catch (err) {}
    });
    const unscrub = (e) => {
      if (!scrub || scrub.id !== e.pointerId) return;
      const was = scrub.was; scrub = null;
      cb.classList.remove('scrubbing');
      try { ui.scrapeStop(); ui.play('tick', 2200, 0.05); } catch (err) {}
      if (was) vid.play().catch(() => {});
    };
    track.addEventListener('pointerup', unscrub);
    track.addEventListener('pointercancel', unscrub);
    track.addEventListener('keydown', (e) => {
      if (!vid.duration) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        vid.currentTime = Math.max(0, Math.min(vid.duration - 0.05, vid.currentTime + (e.key === 'ArrowRight' ? 5 : -5))); paint();
        try { ui.play('tick', e.key === 'ArrowRight' ? 2800 : 2000, 0.05); } catch (err) {}
        e.preventDefault();
      } else if (e.key === ' ' || e.key === 'Enter') { toggle(); e.preventDefault(); }
    });
    paint();
    return toggle;
  }
});
