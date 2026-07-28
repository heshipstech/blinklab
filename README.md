# blinklab

[![CI](https://github.com/heshipstech/blinklab/actions/workflows/ci.yml/badge.svg)](https://github.com/heshipstech/blinklab/actions/workflows/ci.yml)

A browser based eye signal laboratory. It reads your webcam locally, measures what your eyes are doing, and turns that into interpretable numbers: blinks, eyelid aperture in millimetres, gaze regions, and rolling attention metrics.

> **This is a demo and a personal learning project. It is not a medical device, not a safety product, and must not be used for clinical, workplace or safety decisions.**

## Privacy

Everything runs in your browser. No video, image or measurement ever leaves your device. There is no backend, no analytics and no telemetry. A dedicated SECURITY.md arrives later in the ladder.

## Live demo

The current state of the app is always at **https://heshipstech.github.io/blinklab/**, republished automatically on every merge to main.

## Status

Very early. Late Phase 0 of a long public ladder: toolchain, tests, CI and deployment all work, the page itself still only prints a word. The camera arrives in Phase 1.

## How to run

You need Node.js 20 or newer. Then:

```
git clone https://github.com/heshipstech/blinklab.git
cd blinklab
npm install
npm run dev
```

Open the local URL that Vite prints. You should see the word blinklab.

## How this repo works

The project grows one small increment per session, each one branch, one pull request, one push. The working documents:

- [PROJECT.md](PROJECT.md), what this is and why.
- [SPEC.md](SPEC.md), the technical contract.
- [ROADMAP.md](ROADMAP.md), the full increment ladder.
- [STATE.md](STATE.md), where things stand right now.
- [LEARNING.md](LEARNING.md), one plain English engineering note per increment.

## License

MIT, with a not a medical device notice. See [LICENSE](LICENSE).
