/* Audience window: owns the real position. Images are <img>, decks are preloaded
   same-folder iframes driven through bridge.js. Keys work here too, so the
   block also runs single-screen without the presenter window. */
(function () {
  var S = window.Stage, block = S.block;
  var link = new S.Link('audience');
  var stageEl = document.getElementById('stage');
  var img = document.getElementById('img');
  var blackEl = document.getElementById('black');
  var startEl = document.getElementById('start');
  var toastEl = document.getElementById('toast');
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
    blackEl.classList.toggle('on', black);
    publish();
  }

  function publish() {
    var ready = {};
    Object.keys(frames).forEach(function (k) { ready[k] = frames[k].ready; });
    link.send({ type: 'state', seg: pos.seg, step: pos.step, key: live.key, notes: live.notes, label: live.label, black: black, ready: ready });
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
    var p = dir > 0 ? S.nextPos(pos) : S.prevPos(pos);
    if (!p) return Promise.resolve();
    return goTo(p.seg, p.seg === pos.seg ? p.step : (dir > 0 ? 0 : 1e9));
  }

  function setBlack(on) { black = on; render(); }

  function onKey(key) {
    hideStart();
    if (key === 'ArrowRight' || key === 'ArrowDown' || key === 'PageDown' || key === ' ' || key === 'Spacebar') run(function () { return step(1); });
    else if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'PageUp') run(function () { return step(-1); });
    else if (key === 'b' || key === 'B' || key === '.') setBlack(!black);
    else if (key === 'Home') run(function () { return goTo(0, 0); });
    else if (key === 'f' || key === 'F') toggleFullscreen();
  }
  window.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^(Arrow|Page)|^[ bB.fF]$|^Home$|^Spacebar$/.test(e.key)) { e.preventDefault(); onKey(e.key); }
  });

  link.on(function (d) {
    if (d.type === 'hello') { publish(); return; }
    if (d.type !== 'cmd') return;
    hideStart();
    if (d.cmd === 'next') run(function () { return step(1); });
    else if (d.cmd === 'prev') run(function () { return step(-1); });
    else if (d.cmd === 'goto') run(function () { return goTo(d.seg, d.step); });
    else if (d.cmd === 'black') setBlack(d.on == null ? !black : !!d.on);
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
