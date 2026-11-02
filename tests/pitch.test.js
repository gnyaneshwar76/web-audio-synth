// Run with: node tests/pitch.test.js
const assert = require('assert');
const { midiToFreq, noteName, sliderToCutoff } = require('../synth-math.js');

assert.strictEqual(midiToFreq(69), 440); // A4
assert.ok(Math.abs(midiToFreq(60) - 261.6256) < 0.001); // middle C
assert.ok(Math.abs(midiToFreq(81) - 880) < 1e-9); // one octave up doubles
assert.strictEqual(noteName(60), 'C4');
assert.strictEqual(noteName(69), 'A4');
assert.strictEqual(noteName(73), 'C#5');
assert.strictEqual(Math.round(sliderToCutoff(0)), 60);
assert.strictEqual(Math.round(sliderToCutoff(100)), 12000);

console.log('synth-math: all checks passed');
