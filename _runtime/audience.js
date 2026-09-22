/* Audience window: owns the real position. Images are <img>, decks are preloaded
   same-folder iframes driven through bridge.js. Keys work here too, so the
   block also runs single-screen without the presenter window.
   A PDF page can carry clips (step.videos): they sit where they sit on the
   slide and play on a forward click. They never autoplay, and they reproduce
   the speaker's own trim and mute settings from the source deck. */
(function () {
  var S = window.Stage, block = S.block;
  var link = new S.Link('audience');
  var stageEl = document.getElementById('stage');
  var img = document.getElementById('img');
  var blackEl = document.getElementById('black');
  var startEl = document.getElementById('start');
  var toastEl = document.getElementById('toast');
  var vlayer = document.getElementById('vlayer');
  document.title = block.title + ' · Audience';

  var pos = { seg: 0, step: 0 };
  var live = { key: null, notes: '', label: '' };
  var black = false;

  // --- decks ---------------------------------------------------------------
  var frames = {};   // seg index -> { el, ready, pending: {id: resolve} }
  var reqId = 0;
  block.segments.forEach(function (s, i) {
    if (s.kind !== 'deck') return;
    var el = document.createElement('iframe');
    el.className = 'frame';
    el.setAttribute('allow', 'autoplay; fullscreen');
    el.setAttribute('tabindex', '-1');
    el.src = s.deck.src;
    stageEl.appendChild(el);
    frames[i] = { el: el, ready: false, pending: {} };
  });

  // --- clips ----------------------------------------------------------------
  // Google Slides bakes only a poster frame into a PDF export, so each embedded
  // clip is overlaid on the page it belongs to.
  //
  // The clip shows its own frame at her trim point as soon as it is armed, and
  // keeps showing it. The PDF's poster is not usable as the still: these are
  // phone screen recordings, and what the PDF baked in is the recording paused,
  // iOS status bar and a play button over the middle. That reads as a
  // screenshot pasted on the slide, and it jumps the moment it starts. Holding
  // the clip's own first frame means the still and the motion are the same
  // picture, so the click just makes it move. The PDF poster stays underneath
  // as the fallback for a clip that fails to load.
  var clips = {};            // "seg.step" -> [{ el, v, played }]
  var pausedByBlack = null;
  var lastShown = null;
  block.segments.forEach(function (sg, si) {
    (sg.steps || []).forEach(function (st, ti) {
      if (!st.videos || !st.videos.length) return;
      clips[si + '.' + ti] = st.videos.map(function (v) {
        var el = document.createElement('video');
        el.className = 'vid';
        el.src = v.src;
        el.preload = 'none';       // armed on approach, so nothing downloads early
        el.playsInline = true;
        el.style.left = v.rect[0] + '%';
        el.style.top = v.rect[1] + '%';
        el.style.width = v.rect[2] + '%';
        el.style.height = v.rect[3] + '%';
        var c = { el: el, v: v, played: false, blocked: false, raf: 0 };
        if (v.start) el.addEventListener('loadedmetadata', function () {
          if (c.el.paused) { try { c.el.currentTime = v.start; } catch (e) {} }
        });
        el.addEventListener('ended', function () { endClip(c); });
        el.addEventListener('timeupdate', throttled(publish, 400));
        el.addEventListener('click', function () { playClip(c); });
        vlayer.appendChild(el);
        return c;
      });
    });
  });

  function throttled(fn, ms) {
    var last = 0;
    return function () { var t = Date.now(); if (t - last < ms) return; last = t; fn(); };
  }
  function clipsAt(seg, step) { return clips[seg + '.' + step] || []; }
  function playingClip() {
    var c = clipsAt(pos.seg, pos.step);
    for (var i = 0; i < c.length; i++) if (!c[i].el.paused && !c[i].el.ended) return c[i];
    return null;
  }
  function nextClip() {
    var c = clipsAt(pos.seg, pos.step);
    for (var i = 0; i < c.length; i++) if (!c[i].played) return c[i];
    return null;
  }
  // Preload the clips on this page and the next one, and nothing else: a block
  // can carry hundreds of megabytes and the venue may be on http, not file://.
  function armClips(p) {
    if (!p) return;
    clipsAt(p.seg, p.step).forEach(function (c) {
      if (c.el.preload === 'auto') return;
      c.el.preload = 'auto';
      c.el.load();
      // Show it only once it has a frame to show, so nothing flashes black.
      var show = function () { c.el.classList.add('on'); };
      if (c.v.start) {
        c.el.addEventListener('seeked', show, { once: true });
        c.el.addEventListener('loadeddata', function () {
          try { c.el.currentTime = c.v.start; } catch (e) { show(); }
        }, { once: true });
      } else {
        c.el.addEventListener('loadeddata', show, { once: true });
      }
    });
  }
  function resetClips(seg, step) {
    clipsAt(seg, step).forEach(function (c) {
      try { c.el.pause(); } catch (e) {}
      try { c.el.currentTime = c.v.start || 0; } catch (e) {}
      if (c.raf) { cancelAnimationFrame(c.raf); c.raf = 0; }
      c.played = false;
      c.blocked = false;
    });
  }

  // She trims a clip in Slides with one start/end pair. Stop on the frame she
  // chose rather than a timeupdate tick later, which would show the cut.
  function watchEnd(c) {
    if (c.raf) cancelAnimationFrame(c.raf);
    c.raf = 0;
    if (!c.v.end) return;
    var tick = function () {
      if (c.el.paused || c.el.ended) { c.raf = 0; return; }
      if (c.el.currentTime >= c.v.end) { endClip(c); return; }
      c.raf = requestAnimationFrame(tick);
    };
    c.raf = requestAnimationFrame(tick);
  }
  function endClip(c) {
    if (c.raf) { cancelAnimationFrame(c.raf); c.raf = 0; }
    try { c.el.pause(); } catch (e) {}
    c.played = true;
    publish();
  }
  function playClip(c) {
    if (!c) return;
    var cur = playingClip();
    if (cur && cur !== c) stopClip(cur);
    c.played = true;
    c.blocked = false;
    // Her setting, not ours: some of these clips are deliberately silent.
    c.el.muted = !!c.v.muted;
    c.el.volume = 1;
    try { c.el.currentTime = c.v.start || 0; } catch (e) {}
    c.el.classList.add('on');   // already on unless it loaded late
    watchEnd(c);
    var pr = c.el.play();
    if (pr && pr.catch) pr.catch(function () {
      // Chrome only allows sound once this window has been clicked. Run the
      // picture muted rather than not at all, and say what to do about it.
      // A clip she muted herself never gets here: muted playback is allowed.
      c.el.muted = true;
      c.blocked = true;
      c.el.play().catch(function () {});
      watchEnd(c);
      toast('No sound: click the audience screen once, then press V to replay');
      publish();
    });
    publish();
  }
  function stopClip(c) {
    if (c.raf) { cancelAnimationFrame(c.raf); c.raf = 0; }
    try { c.el.pause(); } catch (e) {}
    c.played = true;
  }
  function replayClip() {
    var all = clipsAt(pos.seg, pos.step);
    if (!all.length) return;
    var c = playingClip();
    if (!c) {
      for (var i = all.length - 1; i >= 0; i--) if (all[i].played) { c = all[i]; break; }
      if (!c) c = all[0];
    }
    playClip(c);
  }
  function clipState() {
    var all = clipsAt(pos.seg, pos.step);
    if (!all.length) return null;
    var playing = playingClip();
    var played = 0;
    all.forEach(function (c) { if (c.played) played++; });
    var left = 0;
    if (playing) {
      var stop = playing.v.end || (isFinite(playing.el.duration) ? playing.el.duration : 0);
      if (stop) left = Math.max(0, stop - playing.el.currentTime);
    }
    return { total: all.length, played: played, playing: playing ? all.indexOf(playing) + 1 : 0,
      label: playing ? playing.v.label : '', left: left,
      silent: !!(playing && playing.v.muted),       // she muted it
      blocked: !!(playing && playing.blocked) };    // we wanted sound and Chrome refused
  }

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.__stage !== 'bridge') return;
    var seg = null;
    Object.keys(frames).forEach(function (k) { if (frames[k].el.contentWindow === e.source) seg = +k; });
    if (seg === null) return;
    var f = frames[seg];
    if (d.type === 'ready') {
      f.ready = true;
      if (seg === pos.seg) enterDeck(pos.step);
      publish();
    } else if (d.type === 'res') {
      var r = f.pending[d.id];
      if (r) { delete f.pending[d.id]; r(d.state); }
    } else if (d.type === 'changed' && seg === pos.seg) {
      applyDeckState(d.state);
    } else if (d.type === 'key') {
      onKey(d.key);
    }
  });

  function cmd(seg, name, key) {
    var f = frames[seg];
    if (!f || !f.ready) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var id = ++reqId;
      f.pending[id] = resolve;
      f.el.contentWindow.postMessage({ __stage: 'cmd', id: id, cmd: name, key: key }, '*');
      setTimeout(function () { if (f.pending[id]) { delete f.pending[id]; resolve(null); } }, 2500);
    });
  }

  function applyDeckState(st) {
    if (!st) return;
    live = st;
    var steps = S.stepsOf(pos.seg);
    var i = -1;
    for (var k = 0; k < steps.length; k++) if (steps[k].key === st.key) { i = k; break; }
    if (i >= 0) pos.step = i;
    publish();
  }

  function enterDeck(step) {
    var steps = S.stepsOf(pos.seg);
    var key = steps[step] ? steps[step].key : null;
    return cmd(pos.seg, 'enter', key).then(applyDeckState);
  }

  // --- rendering ------------------------------------------------------------
  function render() {
    var seg = block.segments[pos.seg];
    Object.keys(frames).forEach(function (k) {
      frames[k].el.classList.toggle('on', +k === pos.seg);
    });
    if (seg.kind === 'images') {
      var st = seg.steps[pos.step];
      if (img.getAttribute('src') !== st.src) img.src = st.src;
      img.classList.add('on');
      live = { key: String(pos.step), notes: st.notes || '', label: st.label || '' };
    } else {
      img.classList.remove('on');
    }
    // Leaving a page rewinds its clips, so coming back replays from the top.
    var here = pos.seg + '.' + pos.step;
    if (lastShown !== here) {
      if (lastShown) resetClips(+lastShown.split('.')[0], +lastShown.split('.')[1]);
      lastShown = here;
    }
    armClips(pos);
    armClips(S.nextPos(pos));
    blackEl.classList.toggle('on', black);
    publish();
  }

  function publish() {
    var ready = {};
    Object.keys(frames).forEach(function (k) { ready[k] = frames[k].ready; });
    link.send({ type: 'state', seg: pos.seg, step: pos.step, key: live.key, notes: live.notes, label: live.label, black: black, ready: ready, video: clipState() });
    try { location.replace('#' + (pos.seg + 1) + '.' + (pos.step + 1)); } catch (e) {}
  }

  // --- navigation (serialized) ---------------------------------------------
  var queue = Promise.resolve();
  function run(fn) { queue = queue.then(fn).catch(function (e) { console.error(e); }); return queue; }

  function goTo(seg, step) {
    seg = Math.max(0, Math.min(block.segments.length - 1, seg));
    var n = S.stepsOf(seg).length;
    step = Math.max(0, Math.min(n - 1, step));
    var changedSeg = seg !== pos.seg;
    pos = { seg: seg, step: step };
    render();
    var s = block.segments[seg];
    if (s.kind === 'deck') {
      if (!frames[seg].ready) { toast('Deck still loading...'); return Promise.resolve(); }
      if (changedSeg) return enterDeck(step);
      return cmd(seg, 'goto', S.stepsOf(seg)[step].key).then(applyDeckState);
    }
    return Promise.resolve();
  }

  function step(dir) {
    var s = block.segments[pos.seg];
    if (s.kind === 'deck') {
      if (!frames[pos.seg].ready) {
        if (dir < 0 && pos.seg > 0) return goTo(pos.seg - 1, 1e9);
        toast('Deck still loading...');
        return Promise.resolve();
      }
      return cmd(pos.seg, dir > 0 ? 'next' : 'prev').then(function (st) {
        if (st && st.moved) { applyDeckState(st); return; }
        if (!st) return;
        if (dir > 0 && pos.seg + 1 < block.segments.length) return goTo(pos.seg + 1, 0);
        if (dir < 0 && pos.seg > 0) return goTo(pos.seg - 1, 1e9);
      });
    }
    // On a page with clips a forward click works like Google Slides: it plays
    // the next one that has not run yet, and only then moves on.
    if (dir > 0 && clipsAt(pos.seg, pos.step).length) {
      var cur = playingClip();
      if (cur) stopClip(cur);
      var nxt = nextClip();
      if (nxt) { playClip(nxt); return Promise.resolve(); }
    }
    var p = dir > 0 ? S.nextPos(pos) : S.prevPos(pos);
    if (!p) return Promise.resolve();
    return goTo(p.seg, p.seg === pos.seg ? p.step : (dir > 0 ? 0 : 1e9));
  }

  function setBlack(on) {
    if (on) {
      var c = playingClip();
      if (c) { c.el.pause(); pausedByBlack = c; }
    } else if (pausedByBlack) {
      pausedByBlack.el.play().catch(function () {});
      pausedByBlack = null;
    }
    black = on;
    render();
  }

  function onKey(key) {
    hideStart();
    if (key === 'ArrowRight' || key === 'ArrowDown' || key === 'PageDown' || key === ' ' || key === 'Spacebar') run(function () { return step(1); });
    else if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'PageUp') run(function () { return step(-1); });
    else if (key === 'b' || key === 'B' || key === '.') setBlack(!black);
    else if (key === 'Home') run(function () { return goTo(0, 0); });
    else if (key === 'v' || key === 'V') replayClip();
    else if (key === 'f' || key === 'F') toggleFullscreen();
  }
  window.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^(Arrow|Page)|^[ bB.fFvV]$|^Home$|^Spacebar$/.test(e.key)) { e.preventDefault(); onKey(e.key); }
  });

  link.on(function (d) {
    if (d.type === 'hello') { publish(); return; }
    if (d.type !== 'cmd') return;
    hideStart();
    if (d.cmd === 'next') run(function () { return step(1); });
    else if (d.cmd === 'prev') run(function () { return step(-1); });
    else if (d.cmd === 'goto') run(function () { return goTo(d.seg, d.step); });
    else if (d.cmd === 'black') setBlack(d.on == null ? !black : !!d.on);
    else if (d.cmd === 'replay-video') replayClip();
    else if (d.cmd === 'reload-deck' && frames[pos.seg]) { frames[pos.seg].ready = false; frames[pos.seg].el.src = block.segments[pos.seg].deck.src; }
  });
  setInterval(publish, 1500);

  // --- fullscreen + start overlay ------------------------------------------
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(function () {});
  }
  function hideStart() { startEl.classList.remove('on'); }
  startEl.addEventListener('click', function () {
    document.documentElement.requestFullscreen().catch(function () {});
    hideStart();
  });
  document.addEventListener('fullscreenchange', function () {
    document.body.classList.toggle('fs', !!document.fullscreenElement);
    if (document.fullscreenElement) hideStart();
  });
  document.getElementById('start-title').textContent = block.title;

  var toastT;
  function toast(m) {
    toastEl.textContent = m;
    toastEl.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 1800);
  }

  // Resume from hash (#seg.step, 1-based) so a reload lands where it was.
  var h = (location.hash || '').match(/^#(\d+)\.(\d+)$/);
  if (h) pos = { seg: Math.min(block.segments.length - 1, +h[1] - 1), step: +h[2] - 1 };
  pos.step = Math.max(0, Math.min(S.stepsOf(pos.seg).length - 1, pos.step));
  render();
})();
