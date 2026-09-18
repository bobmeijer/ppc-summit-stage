/* Stage bridge. Injected as the first <head> script of every stage deck copy.
   Gives the six deck engines one interface so the audience window (and the build)
   can drive them: exec('next'|'prev'|'goto'|'enter'|'state', key) -> state.
   A state is { key, notes, label, moved }. A key is an adapter-specific position
   string; the build records the ordered list of keys (the step map).
   Listeners are registered on window, so they survive the Claude Design bundle
   loader swapping document.documentElement. */
(function () {
  if (window.__stageBridge) return;
  var ADAPTER = (document.currentScript && document.currentScript.getAttribute('data-adapter')) || '';
  var EMBEDDED = window.parent !== window;
  var g = function (expr) { return (0, eval)(expr); };

  function addStyle(root, css) {
    var s = document.createElement('style');
    s.setAttribute('data-stage-bridge', '');
    s.textContent = css;
    (root || document.head || document.documentElement).appendChild(s);
  }
  function textFromHtml(html) {
    var d = document.createElement('div');
    d.innerHTML = String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n');
    return (d.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  }

  var adapters = {
    deckStage: {
      // The stage owns navigation while embedded. Authored click handlers must
      // not independently advance their private build counter behind the bridge.
      blockClicks: true,
      before: function () {
        try { localStorage.setItem('deck-stage.railVisible', '0'); } catch (e) {}
      },
      el: function () { return document.querySelector('deck-stage'); },
      ready: function () { var d = this.el(); return !!(d && d.length > 0 && d.shadowRoot); },
      setup: function () {
        var d = this.el();
        if (d.__stageSetup) return;
        d.__stageSetup = true;
        window.postMessage({ __omelette_presenting: true }, '*');
        addStyle(d.shadowRoot, '.overlay,.rail,.rail-resize,.menu{display:none !important}');
      },
      slide: function () {
        var d = this.el(), s = d._slides && d._slides[d.index];
        if (s !== this._buildSlide) {
          this._buildSlide = s;
          this._build = 0;
          this.applyBuild();
        }
        return s;
      },
      buildElements: function () {
        return this._buildSlide ? Array.from(this._buildSlide.querySelectorAll('[data-build],[data-build-hide]')) : [];
      },
      maxBuild: function () {
        return this.buildElements().reduce(function (max, e) {
          return Math.max(max, parseInt(e.dataset.build, 10) || 0, parseInt(e.dataset.buildHide, 10) || 0);
        }, 0);
      },
      applyBuild: function () {
        var elements = this.buildElements(), step = this._build || 0;
        if (!elements.length) return;
        // Match the export's declarative build grammar, without changing the
        // source HTML or its timers. Mark ready so its observer cannot replay
        // initialization over a position restored by the presenter.
        this._buildSlide.classList.add('bld-ready');
        elements.forEach(function (e) {
          var from = parseInt(e.dataset.build, 10) || 0;
          var until = e.hasAttribute('data-build-hide') ? parseInt(e.dataset.buildHide, 10) || 0 : Infinity;
          e.classList.toggle('bld-off', !(step >= from && step < until));
        });
      },
      key: function () {
        this.slide();
        // Keep existing integer keys for the initial state and plain slides.
        return String(this.el().index) + (this._build ? '.' + this._build : '');
      },
      next: function () {
        this.slide();
        if (this._build < this.maxBuild()) { this._build++; this.applyBuild(); }
        else { this.el().next(); this.slide(); }
      },
      prev: function () {
        this.slide();
        if (this._build > 0) { this._build--; this.applyBuild(); return; }
        var before = this.el().index;
        this.el().prev();
        this.slide();
        if (this.el().index !== before) { this._build = this.maxBuild(); this.applyBuild(); }
      },
      goto: function (k) {
        var parts = String(k).split('.');
        this.el().goTo(parseInt(parts[0], 10) || 0);
        this.slide();
        this._build = Math.max(0, Math.min(this.maxBuild(), parseInt(parts[1], 10) || 0));
        this.applyBuild();
      },
      enter: function () {
        var d = this.el(), s = d._slides && d._slides[d.index];
        if (!s) return;
        s.removeAttribute('data-deck-active');
        void s.offsetWidth;
        s.setAttribute('data-deck-active', '');
      },
      notes: function () {
        var d = this.el(), i = d.index, s = d._slides && d._slides[i];
        var n = s && s.getAttribute('data-speaker-notes');
        if (!n) {
          try {
            var tag = document.getElementById('speaker-notes');
            var arr = tag ? JSON.parse(tag.textContent) : null;
            if (arr && arr[i]) n = arr[i];
          } catch (e) {}
        }
        return n || '';
      },
      label: function () {
        var d = this.el(), s = d._slides && d._slides[d.index];
        return (s && s.getAttribute('data-label')) || '';
      }
    },

    frederik: {
      ready: function () { return g('typeof slides!=="undefined" && typeof show==="function" && typeof setStep==="function"'); },
      setup: function () { addStyle(null, '#hud{display:none !important}'); },
      blockClicks: true,
      key: function () { return g('cur + "." + (slides[cur]._step || 0)'); },
      next: function () { g('next()'); },
      prev: function () { g('prev()'); },
      goto: function (k) {
        var p = String(k).split('.'), i = +p[0] || 0, s = +p[1] || 0;
        g('(function(i,s){var sl=slides[i];var full=s>0&&s>=(sl._steps||0);' +
          'if(i!==cur){show(i,full);if(!full&&s>0)setStep(sl,s,false);}else{setStep(sl,s,false);}})(' + i + ',' + s + ')');
      },
      // Replays the entry build of the current slide (the deck sat hidden while preloading).
      enter: function () {
        g('(function(){var s=slides[cur];if((s._step||0)===0){resetBuild(s);setStep(s,0,true);runCounts(s);runBoss(s);}})()');
      },
      notes: function () { return ''; },
      label: function () { return 'Slide ' + g('cur+1'); }
    },

    reveal: {
      ready: function () { return !!(window.Reveal && Reveal.isReady && Reveal.isReady()); },
      setup: function () {},
      key: function () {
        var i = Reveal.getIndices();
        return i.h + '.' + (i.v || 0) + '.' + (typeof i.f === 'number' ? i.f : -1);
      },
      next: function () { Reveal.next(); },
      prev: function () { Reveal.prev(); },
      goto: function (k) {
        var p = String(k).split('.');
        Reveal.slide(+p[0] || 0, +p[1] || 0, +p[2]);
      },
      enter: function () {},
      notes: function () { return textFromHtml(Reveal.getSlideNotes && Reveal.getSlideNotes()); },
      label: function () { return 'Slide ' + (Reveal.getIndices().h + 1); }
    },

    cindy: {
      ready: function () { return g('typeof slides!=="undefined" && typeof show==="function" && typeof cur!=="undefined"'); },
      setup: function () { document.body.classList.add('fs'); },
      blockClicks: true,
      key: function () { return String(g('cur')); },
      next: function () { g('show(cur+1)'); },
      prev: function () { g('show(cur-1)'); },
      goto: function (k) { g('show(' + (parseInt(k, 10) || 0) + ')'); },
      enter: function () { g('(function(){var s=slides[cur];s.classList.remove("active");void s.offsetWidth;show(cur);})()'); },
      notes: function () { return g('slides[cur].dataset.notes') || ''; },
      label: function () {
        return g('(function(s){return "Slide "+s.dataset.slide+(s.dataset.stage?" ("+s.dataset.stage+")":"");})(slides[cur])');
      }
    },

    preso: {
      ready: function () { return !!window.__preso; },
      setup: function () { addStyle(null, '#counter,#hint,#present{display:none !important}'); },
      blockClicks: true,
      key: function () { return window.__preso.idx + '.' + window.__preso.step; },
      next: function () {
        var p = window.__preso;
        if (p.idx >= p.total - 1 && p.step >= p.steps()) return;
        p.forward();
      },
      prev: function () { window.__preso.back(); },
      goto: function (k) { var q = String(k).split('.'); window.__preso.go(+q[0] || 0, +q[1] || 0); },
      enter: function () { this.goto(this.key()); },
      notes: function () { return ''; },
      label: function () { return 'Slide ' + (window.__preso.idx + 1); }
    }
  };

  var A = adapters[ADAPTER];
  if (!A) { console.error('[stage-bridge] unknown adapter', ADAPTER); return; }
  if (A.before) A.before();

  function isReady() {
    try { if (!A.ready()) return false; A.setup(); return true; } catch (e) { return false; }
  }
  function state(moved) {
    return { key: A.key(), notes: A.notes(), label: A.label(), moved: !!moved };
  }
  function exec(cmd, key) {
    if (!isReady()) return null;
    var before = A.key();
    if (cmd === 'next') A.next();
    else if (cmd === 'prev') A.prev();
    else if (cmd === 'goto') A.goto(key);
    else if (cmd === 'enter') { if (key != null && key !== before) A.goto(key); A.enter(); }
    var s = state(A.key() !== before);
    lastKey = s.key;
    return s;
  }
  window.__stageBridge = { adapter: ADAPTER, ready: isReady, exec: exec };

  if (!EMBEDDED) return;

  // --- embedded in the audience window -------------------------------------
  function post(msg) { msg.__stage = msg.__stage || 'bridge'; try { window.parent.postMessage(msg, '*'); } catch (e) {} }
  var NAV_KEYS = { ArrowRight: 1, ArrowLeft: 1, ArrowUp: 1, ArrowDown: 1, PageUp: 1, PageDown: 1, ' ': 1, Spacebar: 1, Home: 1, End: 1, b: 1, B: 1, '.': 1, Escape: 0 };
  function typing(e) {
    var t = e.composedPath ? e.composedPath()[0] : e.target;
    return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''));
  }
  window.addEventListener('keydown', function (e) {
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (NAV_KEYS[e.key] || /^[0-9]$/.test(e.key)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!e.repeat || e.key.indexOf('Arrow') === 0 || e.key.indexOf('Page') === 0) post({ type: 'key', key: e.key });
    }
  }, true);
  if (A.blockClicks) {
    ['click', 'mousedown', 'touchstart'].forEach(function (t) {
      window.addEventListener(t, function (e) { e.stopImmediatePropagation(); }, true);
    });
  }

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.__stage !== 'cmd' || e.source !== window.parent) return;
    var s = exec(d.cmd, d.key);
    post({ type: 'res', id: d.id, state: s });
  });

  var lastKey = null, announced = false;
  setInterval(function () {
    if (!isReady()) return;
    if (!announced) { announced = true; lastKey = A.key(); post({ type: 'ready', state: state(false) }); return; }
    var k = A.key();
    if (k !== lastKey) { lastKey = k; post({ type: 'changed', state: state(true) }); }
  }, 250);
})();
