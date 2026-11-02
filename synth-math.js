/**
 * Pure helpers shared by the page and the node test (tests/pitch.test.js).
 * No browser APIs here, so they can run anywhere.
 */
(function (root) {
  var NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  /** MIDI note number to frequency in Hz. A4 (69) = 440 Hz, each semitone is a ratio of 2^(1/12). */
  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  /** MIDI note number to a name such as "A4" or "C#5". Middle C (60) is C4. */
  function noteName(midi) {
    return NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
  }

  /** Slider 0..100 to filter cutoff 60 Hz..12 kHz, on a log scale so the knob feels even. */
  function sliderToCutoff(v) {
    return 60 * Math.pow(200, v / 100);
  }

  var api = { midiToFreq: midiToFreq, noteName: noteName, sliderToCutoff: sliderToCutoff };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SynthMath = api;
})(this);
