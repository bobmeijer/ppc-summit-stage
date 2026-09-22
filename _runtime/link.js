/* Presenter <-> audience link. Two transports, deduped by message id:
   window.opener/popup postMessage (works on file://) and BroadcastChannel
   (lets a manually opened audience window find the presenter on http). */
(function () {
  var params = new URLSearchParams(location.search);
  var M = window.STAGE_MANIFEST;
  var blockId = params.get('block') || (M.blocks[0] && M.blocks[0].id);
  var block = M.blocks.find(function (b) { return b.id === blockId; }) || M.blocks[0];

  function Link(role) {
    this.role = role;
    this.peer = null;
    this.seen = [];
    this.handlers = [];
    this.lastHeard = 0;
    var self = this;
    try {
      this.bc = new BroadcastChannel('summit-stage');
      this.bc.onmessage = function (e) { self._in(e.data, null); };
    } catch (e) { this.bc = null; }
    window.addEventListener('message', function (e) {
      if (e.data && e.data.__link === 1) self._in(e.data, e.source);
    });
  }
  Link.prototype._in = function (d, source) {
    if (!d || d.__link !== 1 || d.from === this.role || d.block !== block.id) return;
    if (this.seen.indexOf(d.mid) >= 0) return;
    this.seen.push(d.mid);
    if (this.seen.length > 300) this.seen.shift();
    if (source) this.peer = source;
    this.lastHeard = Date.now();
    this.handlers.forEach(function (h) { h(d); });
  };
  Link.prototype.on = function (h) { this.handlers.push(h); };
  Link.prototype.send = function (msg) {
    msg.__link = 1;
    msg.from = this.role;
    msg.block = block.id;
    msg.mid = this.role + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    var targets = [];
    if (this.peer && !this.peer.closed) targets.push(this.peer);
    if (window.opener && !window.opener.closed && targets.indexOf(window.opener) < 0) targets.push(window.opener);
    targets.forEach(function (t) { try { t.postMessage(msg, '*'); } catch (e) {} });
    if (this.bc) { try { this.bc.postMessage(msg); } catch (e) {} }
  };
  Link.prototype.connected = function () { return Date.now() - this.lastHeard < 3500; };

  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem('summit-stage.' + key);
      localStorage.setItem('summit-stage.' + key, String(val));
    } catch (e) { return null; }
  }

  // Position helpers shared by both windows. A position is { seg, step }.
  function stepsOf(seg) { return (block.segments[seg] && block.segments[seg].steps) || []; }
  function nextPos(p) {
    if (p.step + 1 < stepsOf(p.seg).length) return { seg: p.seg, step: p.step + 1 };
    if (p.seg + 1 < block.segments.length) return { seg: p.seg + 1, step: 0 };
    return null;
  }
  function prevPos(p) {
    if (p.step > 0) return { seg: p.seg, step: p.step - 1 };
    if (p.seg > 0) return { seg: p.seg - 1, step: Math.max(0, stepsOf(p.seg - 1).length - 1) };
    return null;
  }

  window.Stage = { manifest: M, block: block, Link: Link, store: store, nextPos: nextPos, prevPos: prevPos, stepsOf: stepsOf };
})();
