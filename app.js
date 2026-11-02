/** UI wiring: keyboard, controls, status and the scope. Audio lives in engine.js. */
(function () {
  var M = window.SynthMath;
  var AC = window.AudioContext || window.webkitAudioContext;
  var $ = function (id) { return document.getElementById(id); };

  // White keys then black keys: [semitones above the base C, computer key code]
  var WHITE = [[0, 'KeyA'], [2, 'KeyS'], [4, 'KeyD'], [5, 'KeyF'], [7, 'KeyG'], [9, 'KeyH'], [11, 'KeyJ'], [12, 'KeyK'], [14, 'KeyL'], [16, 'Semicolon']];
  var BLACK = [[1, 'KeyW', 0], [3, 'KeyE', 1], [6, 'KeyT', 3], [8, 'KeyY', 4], [10, 'KeyU', 5], [13, 'KeyO', 7], [15, 'KeyP', 8]]; // third value: index of the white key it sits after
  var KEYLABEL = { Semicolon: ';' };
  var BASE = 60; // middle C
  var octave = 0;

  var ctx = null;
  var engine = null;
  var pressed = new Map(); // input id -> { midi, el }
  var lastMidi = null;

  // ---- status -------------------------------------------------------------
  function updateStatus() {
    var state = ctx ? ctx.state : 'off';
    var text = { off: 'Audio off', running: 'Audio running', suspended: 'Audio suspended', closed: 'Audio closed', interrupted: 'Audio interrupted' };
    $('dot').dataset.state = state;
    $('status-text').textContent = text[state] || 'Audio ' + state;
    $('start').hidden = state === 'running';
    $('start').textContent = ctx ? 'Resume audio' : 'Start audio';
  }

  async function start() {
    if (!AC) { $('error').hidden = false; $('start').disabled = true; return false; }
    try {
      if (!ctx) {
        ctx = new AC();
        engine = window.createEngine(ctx);
        ctx.onstatechange = updateStatus;
        applyAll();
        drawLoop();
      }
      if (ctx.state !== 'running') await ctx.resume();
    } catch (e) {
      $('error').textContent = 'Could not start audio: ' + e.message;
      $('error').hidden = false;
    }
    updateStatus();
    return !!engine;
  }

  // ---- controls -----------------------------------------------------------
  var fmt = {
    time: function (s) { return s < 1 ? Math.round(s * 1000) + ' ms' : s.toFixed(2) + ' s'; },
    pct: function (v) { return Math.round(v * 100) + '%'; }
  };
  var spec = {
    attack: { f: fmt.time }, decay: { f: fmt.time }, release: { f: fmt.time },
    sustain: { f: fmt.pct }, feedback: { f: fmt.pct }, mix: { f: fmt.pct }, volume: { f: fmt.pct },
    delayTime: { f: fmt.time },
    resonance: { f: function (q) { return 'Q ' + q.toFixed(1); } },
    cutoff: { map: M.sliderToCutoff, f: function (hz) { return hz < 1000 ? Math.round(hz) + ' Hz' : (hz / 1000).toFixed(1) + ' kHz'; } }
  };

  function readParam(input) {
    var s = spec[input.dataset.param];
    var v = parseFloat(input.value);
    return s.map ? s.map(v) : v;
  }
  function showParam(input) { $('o-' + input.dataset.param).textContent = spec[input.dataset.param].f(readParam(input)); }
  function applyAll() {
    engine.set('wave', document.querySelector('input[name="wave"]:checked').value);
    document.querySelectorAll('input[data-param]').forEach(function (i) { engine.set(i.dataset.param, readParam(i)); });
  }

  document.querySelectorAll('input[data-param]').forEach(function (input) {
    showParam(input);
    input.addEventListener('input', function () {
      showParam(input);
      if (engine) engine.set(input.dataset.param, readParam(input));
    });
  });
  document.querySelectorAll('input[name="wave"]').forEach(function (r) {
    r.addEventListener('change', function () { if (engine) engine.set('wave', r.value); });
  });

  // ---- keyboard UI --------------------------------------------------------
  var keysEl = $('keys');
  var keyEls = {}; // code -> { el, offset }

  function build() {
    WHITE.forEach(function (k) { add(k, 'white'); });
    BLACK.forEach(function (k) { add(k, 'black'); });
  }
  function add(k, kind) {
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'key ' + kind;
    el.dataset.offset = k[0];
    el.dataset.code = k[1];
    el.innerHTML = (kind === 'white' ? '<span class="note"></span>' : '') + '<span>' + (KEYLABEL[k[1]] || k[1].replace('Key', '')) + '</span>';
    if (kind === 'black') el.style.left = 'calc(' + ((k[2] + 1) * 10) + '% - 3%)';
    keysEl.appendChild(el);
    keyEls[k[1]] = { el: el, offset: k[0] };
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* older browsers */ }
      press('p' + e.pointerId, k[1]);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) {
      el.addEventListener(ev, function (e) { release('p' + e.pointerId); });
    });
  }
  function relabel() {
    Object.keys(keyEls).forEach(function (code) {
      var n = keyEls[code].el.querySelector('.note');
      var midi = BASE + 12 * octave + keyEls[code].offset;
      keyEls[code].el.setAttribute('aria-label', M.noteName(midi));
      if (n) n.textContent = M.noteName(midi);
    });
    $('oct-label').textContent = M.noteName(BASE + 12 * octave) + ' to ' + M.noteName(BASE + 12 * octave + 16);
  }

  // ---- playing ------------------------------------------------------------
  async function press(id, code) {
    if (pressed.has(id)) return;
    var k = keyEls[code];
    var midi = BASE + 12 * octave + k.offset; // fixed now, so a later octave change cannot orphan the note
    pressed.set(id, { midi: midi, el: k.el });
    k.el.classList.add('is-down');
    if (!(await start())) { pressed.delete(id); k.el.classList.remove('is-down'); return; }
    if (!pressed.has(id)) return; // released while audio was starting
    engine.noteOn(midi);
    lastMidi = midi;
    readout();
  }
  function release(id) {
    var p = pressed.get(id);
    if (!p) return;
    pressed.delete(id);
    p.el.classList.remove('is-down');
    if (engine) engine.noteOff(p.midi);
    readout();
  }
  function releaseAll() { Array.from(pressed.keys()).forEach(release); if (engine) engine.releaseAll(); }
  function readout() {
    $('readout').textContent = lastMidi === null ? 'No note played yet'
      : 'Last note ' + M.noteName(lastMidi) + ', ' + M.midiToFreq(lastMidi).toFixed(1) + ' Hz, voices ' + (engine ? engine.voices() : 0);
  }
  function shiftOctave(d) { octave = Math.max(-2, Math.min(2, octave + d)); relabel(); }

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (keyEls[e.code]) {
      if (!e.repeat) press(e.code, e.code);
      e.preventDefault();
    } else if (e.code === 'KeyZ' || e.code === 'KeyX') {
      if (!e.repeat) shiftOctave(e.code === 'KeyZ' ? -1 : 1);
    } else if ((e.code === 'Space' || e.code === 'Enter') && e.target.classList && e.target.classList.contains('key')) {
      if (!e.repeat) press(e.code, e.target.dataset.code);
      e.preventDefault();
    }
  });
  document.addEventListener('keyup', function (e) {
    if (keyEls[e.code] || e.code === 'Space' || e.code === 'Enter') release(e.code);
  });
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', function () { if (document.hidden) releaseAll(); });
  $('start').addEventListener('click', start);
  $('oct-down').addEventListener('click', function () { shiftOctave(-1); });
  $('oct-up').addEventListener('click', function () { shiftOctave(1); });

  // ---- scope --------------------------------------------------------------
  var canvas = $('scope');
  var g = canvas.getContext('2d');
  var buf = new Float32Array(2048);
  var empty = new Float32Array(2048);

  function fit() {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    drawScope(engine ? buf : empty);
  }
  function drawScope(data) {
    var css = getComputedStyle(document.documentElement);
    var w = canvas.width, h = canvas.height, dpr = window.devicePixelRatio || 1;
    g.clearRect(0, 0, w, h);
    g.lineWidth = dpr;
    g.strokeStyle = css.getPropertyValue('--line');
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    // start at a rising zero crossing so the picture holds still
    var s = 0;
    for (var i = 1; i < 1024; i++) { if (data[i - 1] < 0 && data[i] >= 0) { s = i; break; } }
    g.lineWidth = 2 * dpr;
    g.strokeStyle = css.getPropertyValue('--accent');
    g.lineJoin = 'round';
    g.beginPath();
    for (var x = 0; x < w; x++) {
      var v = data[s + Math.floor((x / w) * 1024)] || 0;
      var y = h / 2 - v * h * 0.45;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  var looping = false;
  function drawLoop() {
    if (looping) return;
    looping = true;
    (function frame() {
      engine.analyser.getFloatTimeDomainData(buf);
      drawScope(buf);
      requestAnimationFrame(frame);
    })();
  }
  new ResizeObserver(fit).observe(canvas);

  // ---- init ---------------------------------------------------------------
  if (!AC) { $('error').hidden = false; $('start').disabled = true; }
  build();
  relabel();
  updateStatus();
  fit();
})();
