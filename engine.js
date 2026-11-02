/**
 * Audio engine. Signal path:
 *   oscillator -> envelope gain -> filter -> (dry) -> master
 *                                        \-> delay <-> feedback -> wet -> master
 *   master -> compressor -> analyser -> speakers
 * Takes any BaseAudioContext, so the same code runs live and in an OfflineAudioContext for tests.
 */
(function (root) {
  var M = root.SynthMath;
  var VOICE_LEVEL = 0.25; // per-note peak, low enough that a chord does not clip

  /** Freeze an AudioParam at its current value from time t (Safari lacks cancelAndHoldAtTime). */
  function holdAt(param, t) {
    if (param.cancelAndHoldAtTime) {
      param.cancelAndHoldAtTime(t);
    } else {
      var v = param.value;
      param.cancelScheduledValues(t);
      param.setValueAtTime(v, t);
    }
  }

  /**
   * @param {BaseAudioContext} ctx
   * @returns {{noteOn:Function, noteOff:Function, releaseAll:Function, set:Function, analyser:AnalyserNode, voices:Function}}
   */
  function createEngine(ctx) {
    var st = { wave: 'sawtooth', attack: 0.01, decay: 0.25, sustain: 0.6, release: 0.4 };

    var master = new GainNode(ctx, { gain: 0.7 });
    var comp = new DynamicsCompressorNode(ctx, { threshold: -18, knee: 12, ratio: 6, attack: 0.003, release: 0.2 });
    var analyser = new AnalyserNode(ctx, { fftSize: 2048 });
    var filter = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 3700, Q: 1 });
    var delay = new DelayNode(ctx, { maxDelayTime: 1.5, delayTime: 0.3 });
    var feedback = new GainNode(ctx, { gain: 0.35 }); // always < 1 or the echo grows forever
    var wet = new GainNode(ctx, { gain: 0.2 });

    filter.connect(master);
    filter.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(master);
    master.connect(comp);
    comp.connect(analyser);
    analyser.connect(ctx.destination);

    var held = new Map(); // midi -> voice, only keys currently down
    var all = new Set(); // every sounding voice, including ones in release

    var params = {
      volume: master.gain,
      cutoff: filter.frequency,
      resonance: filter.Q,
      delayTime: delay.delayTime,
      feedback: feedback.gain,
      mix: wet.gain
    };

    /** Set a control. Audio params glide over ~20 ms to avoid zipper noise. */
    function set(name, value) {
      if (name === 'wave') {
        st.wave = value;
        all.forEach(function (v) { v.osc.type = value; });
      } else if (name in st) {
        st[name] = value;
      } else if (params[name]) {
        params[name].setTargetAtTime(value, ctx.currentTime, 0.02);
      }
    }

    function noteOn(midi, when) {
      if (held.has(midi)) return;
      var t = when === undefined ? ctx.currentTime : when;
      var osc = new OscillatorNode(ctx, { type: st.wave, frequency: M.midiToFreq(midi) });
      var env = new GainNode(ctx, { gain: 0 });
      osc.connect(env);
      env.connect(filter);
      var g = env.gain;
      var attack = Math.max(st.attack, 0.003); // a zero-length ramp clicks
      g.setValueAtTime(0, t);
      g.linearRampToValueAtTime(VOICE_LEVEL, t + attack);
      g.setTargetAtTime(VOICE_LEVEL * st.sustain, t + attack, st.decay / 4);
      osc.start(t);
      var voice = { osc: osc, env: env };
      held.set(midi, voice);
      all.add(voice);
      osc.onended = function () {
        osc.disconnect();
        env.disconnect();
        all.delete(voice);
        if (held.get(midi) === voice) held.delete(midi);
      };
    }

    function noteOff(midi, when) {
      var voice = held.get(midi);
      if (!voice) return;
      held.delete(midi);
      var t = when === undefined ? ctx.currentTime : when;
      holdAt(voice.env.gain, t);
      voice.env.gain.setTargetAtTime(0, t, st.release / 5);
      voice.osc.stop(t + st.release + 0.05);
    }

    function releaseAll() {
      Array.from(held.keys()).forEach(function (m) { noteOff(m); });
    }

    return {
      noteOn: noteOn,
      noteOff: noteOff,
      releaseAll: releaseAll,
      set: set,
      analyser: analyser,
      voices: function () { return held.size; }
    };
  }

  root.createEngine = createEngine;
})(this);
