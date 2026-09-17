/* Presenter window: current + next preview, notes, timers, segment list.
   With an audience window connected it sends commands and mirrors the audience
   state. Without one it walks the build-time step map (rehearsal mode). */
(function () {
  var S = window.Stage, block = S.block;
  var link = new S.Link('presenter');
  var $ = function (id) { return document.getElementById(id); };
  document.title = block.title + ' · Presenter';
  $('block-title').textContent = block.title;
  $('block-window').textContent = block.window || '';

  var pos = { seg: 0, step: 0 };
  var live = null;          // last audience state
  var black = false;
  var popup = null;

  // --- preferences ----------------------------------------------------------
  var prefs = {
    notes: +(S.store('notesSize') || 28),
    ui: +(S.store('uiZoom') || 1),
    list: S.store('listOpen') !== '0',
    split: +(S.store('split') || 58)
  };
  function applyPrefs() {
    document.documentElement.style.setProperty('--notes-size', prefs.notes + 'px');
    document.documentElement.style.setProperty('--split', prefs.split + '%');
    document.body.style.zoom = prefs.ui;
    document.body.classList.toggle('list-open', prefs.list);
    $('notes-size').textContent = prefs.notes;
    $('ui-zoom').textContent = Math.round(prefs.ui * 100) + '%';
    S.store('notesSize', prefs.notes);
    S.store('uiZoom', prefs.ui);
    S.store('listOpen', prefs.list ? '1' : '0');
    S.store('split', prefs.split);
  }
  function notesSize(d) { prefs.notes = Math.max(14, Math.min(72, prefs.notes + d)); applyPrefs(); }
  function uiZoom(d) { prefs.ui = Math.max(0.6, Math.min(1.8, Math.round((prefs.ui + d) * 10) / 10)); applyPrefs(); }
  function split(d) { prefs.split = Math.max(30, Math.min(75, prefs.split + d)); applyPrefs(); }

  // --- timers ---------------------------------------------------------------
  var blockStart = null, segStart = Date.now(), lastSeg = 0;
  function fmt(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(s / 60);
    return (m < 10 ? '0' : '') + m + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
  }
  function tick() {
    var now = new Date();
    $('clock').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    $('seg-timer').textContent = fmt(Date.now() - segStart);
    $('block-timer').textContent = blockStart ? fmt(Date.now() - blockStart) : '--:--';
    var on = link.connected() && (!popup || !popup.closed || live);
    document.body.classList.toggle('linked', !!on);
    $('link-state').textContent = on ? 'Audience connected' : 'Rehearsal (no audience window)';
  }
  setInterval(tick, 500);

  // --- rendering --------------------------------------------------------------
  function thumbHtml(seg, step) {
    var s = block.segments[seg];
    var st = s && s.steps[step];
    if (!st) return '<div class="empty">End of block</div>';
    var src = st.thumb || st.src;
    return src ? '<img src="' + src + '" alt="">' : '<div class="empty">' + esc(st.label || s.label) + '</div>';
  }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function render() {
    if (pos.seg !== lastSeg) { lastSeg = pos.seg; segStart = Date.now(); }
    var seg = block.segments[pos.seg];
    var steps = seg.steps;
    var known = pos.step >= 0 && pos.step < steps.length;
    var st = known ? steps[pos.step] : null;

    $('current').innerHTML = known ? thumbHtml(pos.seg, pos.step) : '<div class="empty">' + esc(live && live.label) + '</div>';
    var n = known ? S.nextPos(pos) : null;
    $('next').innerHTML = n ? thumbHtml(n.seg, n.step) : '<div class="empty">End of block</div>';
    $('next-label').textContent = n ? (n.seg !== pos.seg ? 'Next: ' + block.segments[n.seg].title : 'Next') : 'Next';

    $('seg-title').textContent = seg.title;
    $('step-count').textContent = (known ? pos.step + 1 : '?') + ' / ' + steps.length;
    var label = (live && link.connected() && live.label) || (st && st.label) || '';
    $('step-label').textContent = label;

    var notes = (live && link.connected() && live.notes != null && live.key === (st && st.key) ? live.notes : null);
    if (notes == null) notes = st ? st.notes : (live && live.notes) || '';
    $('notes').innerHTML = notes ? formatNotes(notes) : '<p class="muted">No speaker notes for this slide.</p>';

    var ready = (live && live.ready) || {};
    var loading = seg.kind === 'deck' && link.connected() && ready[pos.seg] === false;
    $('deck-state').textContent = loading ? 'Deck loading on audience screen...' : '';

    document.body.classList.toggle('black', black);
    renderList(ready);
  }

  function formatNotes(t) {
    var lines = String(t).split(/\r?\n/);
    var out = [], inList = false;
    lines.forEach(function (l) {
      var m = l.match(/^\s*[-*•]\s+(.*)$/);
      if (m) { if (!inList) { out.push('<ul>'); inList = true; } out.push('<li>' + esc(m[1]) + '</li>'); return; }
      if (inList) { out.push('</ul>'); inList = false; }
      if (l.trim()) out.push('<p>' + esc(l).replace(/\[([^\]]+)\]/g, '<span class="dir">[$1]</span>') + '</p>');
    });
    if (inList) out.push('</ul>');
    return out.join('').replace(/<li>([^<]*)\[([^\]]+)\]/g, '<li>$1<span class="dir">[$2]</span>');
  }

  var listBuilt = false;
  function renderList(ready) {
    var ul = $('seglist');
    if (!listBuilt) {
      listBuilt = true;
      var lastGroup = null;
      block.segments.forEach(function (s, i) {
        if (s.group !== lastGroup) {
          lastGroup = s.group;
          var h = document.createElement('li');
          h.className = 'grp';
          h.textContent = s.group;
          ul.appendChild(h);
        }
        var li = document.createElement('li');
        li.className = 'seg';
        li.dataset.seg = i;
        li.innerHTML = '<span class="t">' + esc(s.label || s.title) + '</span><span class="n">' +
          (s.steps.length > 1 ? s.steps.length : '') + '</span>';
        li.addEventListener('click', function () { go(i, 0); });
        ul.appendChild(li);
      });
    }
    Array.prototype.forEach.call(ul.querySelectorAll('li.seg'), function (li) {
      var i = +li.dataset.seg;
      li.classList.toggle('cur', i === pos.seg);
      li.classList.toggle('loading', ready[i] === false);
    });
    var cur = ul.querySelector('li.cur');
    if (cur && cur.__lastSeg !== pos.seg) { cur.__lastSeg = pos.seg; cur.scrollIntoView({ block: 'nearest' }); }
  }

  // --- commands ---------------------------------------------------------------
  function startBlockTimer() { if (!blockStart) blockStart = Date.now(); }
  function next() {
    startBlockTimer();
    if (link.connected()) return link.send({ type: 'cmd', cmd: 'next' });
    var p = S.nextPos(pos); if (p) { pos = p; render(); }
  }
  function prev() {
    if (link.connected()) return link.send({ type: 'cmd', cmd: 'prev' });
    var p = S.prevPos(pos); if (p) { pos = p; render(); }
  }
  function go(seg, step) {
    startBlockTimer();
    if (link.connected()) return link.send({ type: 'cmd', cmd: 'goto', seg: seg, step: step });
    pos = { seg: seg, step: step }; render();
  }
  function toggleBlack() {
    if (link.connected()) return link.send({ type: 'cmd', cmd: 'black' });
    black = !black; render();
  }

  link.on(function (d) {
    if (d.type !== 'state') return;
    live = d;
    black = !!d.black;
    pos = { seg: d.seg, step: d.step };
    render();
  });
  link.send({ type: 'hello' });

  // --- audience window ------------------------------------------------------
  async function openAudience() {
    var url = 'audience.html?block=' + encodeURIComponent(block.id) + '#' + (pos.seg + 1) + '.' + (pos.step + 1);
    var feat = 'popup';
    try {
      if (window.getScreenDetails) {
        var det = await window.getScreenDetails();
        var other = det.screens.find(function (s) { return s !== det.currentScreen; });
        if (other) feat += ',left=' + other.availLeft + ',top=' + other.availTop + ',width=' + other.availWidth + ',height=' + other.availHeight;
      }
    } catch (e) { /* permission denied: open on this screen, drag it over */ }
    popup = window.open(url, 'summit-audience-' + block.id, feat);
    if (!popup) { alert('The browser blocked the audience window. Allow pop-ups for this page and try again.'); return; }
    link.peer = popup;
    setTimeout(function () { try { window.focus(); } catch (e) {} }, 400);
  }

  // --- input ---------------------------------------------------------------------
  window.addEventListener('keydown', function (e) {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    var k = e.key, handled = true;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ' || k === 'n' || k === 'N') next();
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'p' || k === 'P') prev();
    else if (k === 'b' || k === 'B' || k === '.') toggleBlack();
    else if (k === 'Home') go(0, 0);
    else if (k === '+' || k === '=') notesSize(2);
    else if (k === '-' || k === '_') notesSize(-2);
    else if (k === ']') uiZoom(0.1);
    else if (k === '[') uiZoom(-0.1);
    else if (k === '<' || k === ',') split(-4);
    else if (k === '>') split(4);
    else if (k === 'l' || k === 'L') { prefs.list = !prefs.list; applyPrefs(); }
    else if (k === 't' || k === 'T') { segStart = Date.now(); }
    else if (k === 'o' || k === 'O') openAudience();
    else if (k === '?' || k === 'h' || k === 'H') $('help').classList.toggle('on');
    else if (k === 'Escape') $('help').classList.remove('on');
    else handled = false;
    if (handled) e.preventDefault();
  });

  var bind = function (id, fn) { $(id).addEventListener('click', function (e) { fn(); e.currentTarget.blur(); }); };
  bind('btn-open', openAudience);
  bind('btn-prev', prev);
  bind('btn-next', next);
  bind('btn-black', toggleBlack);
  bind('btn-notes-minus', function () { notesSize(-2); });
  bind('btn-notes-plus', function () { notesSize(2); });
  bind('btn-ui-minus', function () { uiZoom(-0.1); });
  bind('btn-ui-plus', function () { uiZoom(0.1); });
  bind('btn-list', function () { prefs.list = !prefs.list; applyPrefs(); });
  bind('btn-help', function () { $('help').classList.toggle('on'); });
  bind('btn-reload-deck', function () { if (link.connected()) link.send({ type: 'cmd', cmd: 'reload-deck' }); });
  bind('btn-timer', function () { blockStart = Date.now(); segStart = Date.now(); });
  $('help').addEventListener('click', function () { $('help').classList.remove('on'); });
  $('current').addEventListener('click', next);
  $('next').addEventListener('click', next);

  applyPrefs();
  render();
  tick();
})();
