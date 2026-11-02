# Web Audio Synth

A small subtractive synthesizer that runs in the browser. Plain HTML, CSS and JavaScript with no build step and no dependencies. Sound is generated live with the Web Audio API.

Live site: https://gnyaneshwar76.github.io/web-audio-synth/

## Run it

Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
```

then visit http://localhost:8000. Click **Start audio** (browsers block sound until you interact with the page), then play with the on-screen keys or the keyboard.

## Controls

| Control | What it does |
|---|---|
| Waveform | Sine, square, saw or triangle oscillator |
| Envelope | Attack, decay, sustain, release of each note's volume |
| Filter | Low-pass cutoff and resonance |
| Delay | Echo time, feedback (always below 100%) and mix |
| Volume | Master level |

Computer keys: `A S D F G H J K L ;` white keys, `W E T Y U O P` black keys, `Z` / `X` octave down / up.

## Files

| File | Role |
|---|---|
| `index.html`, `style.css` | Page and styles |
| `synth-math.js` | Pure helpers: note to frequency, note names, cutoff scale |
| `engine.js` | Audio graph and voices (oscillator, envelope, filter, delay, compressor, analyser) |
| `app.js` | Keyboard, controls, status and the waveform display |
| `tests/pitch.test.js` | `node tests/pitch.test.js` checks the pitch maths |
| `privacy.html`, `404.html`, `robots.txt`, `sitemap.xml`, `favicon.svg` | Site basics |
| `fonts/` | IBM Plex, self-hosted, SIL Open Font License |

## Signal path

oscillator, envelope gain, low-pass filter, then dry and delay paths into a master gain, then compressor, analyser and speakers.

## Deploy (GitHub Pages)

Repository Settings, Pages, deploy from branch `main`, folder `/ (root)`. Tick **Enforce HTTPS**.

Independent student project.
