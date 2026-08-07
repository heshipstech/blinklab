# blinklab

[![CI](https://github.com/heshipstech/blinklab/actions/workflows/ci.yml/badge.svg)](https://github.com/heshipstech/blinklab/actions/workflows/ci.yml)

A browser based eye signal laboratory. It reads your webcam locally and turns what your eyes are doing into numbers you can audit: blinks, eyelid aperture in millimetres, gaze regions, fixations, PERCLOS, and an explainable alertness score.

> **Demo, not a safety or medical device. This is a learning project. It is not for clinical, workplace or safety use, its numbers are not diagnostic, and it has not been validated against any medical standard. All processing happens in your browser and no data leaves your device.**

**Live demo: https://heshipstech.github.io/blinklab/** — republished automatically on every merge to main. You need a webcam and a browser that allows camera access.

## What it measures

Every number on screen comes from a tested pure function, and every threshold is calibrated against measured data rather than copied from a paper.

- **Blinks**: count, rate per minute, closed-phase duration, closing velocity and the amplitude over velocity ratio.
- **Eyelid aperture in millimetres**, normalised by the iris as a physical ruler, so the reading survives moving closer to or further from the camera.
- **Gaze**: iris offset per eye, screen quadrant, on screen versus off, nine point calibration, fixations and saccades, a dwell heatmap and a scanpath replay.
- **PERCLOS**, the eyes closed share of the last minute, and a long closure detector with a debounced alert.
- **An alertness score, 0 to 100**, that shows its working: it is exactly 100 minus four named penalties, and a panel names the ones that cost you points.
- **A CSV export** of one record per second, plus a Karolinska Sleepiness Scale self report, for offline analysis.

## Honest limitations

This project's rule is that a limitation you know about belongs in the open.

- Thresholds are personal and learned per session. They are priced against **one** person's measured eyes so far, so another face may need different ones.
- Strong prescription glasses compress and distort the gaze signal near the edges of the screen, so calibrated gaze is reliable in the middle and degrades at the corners.
- The instrument reads fully shut eyes as roughly a third of the open baseline rather than zero, so the literature's usual PERCLOS threshold does not transfer and ours is adjusted to the instrument. This is documented rather than hidden.
- Known open defects live in the [issue tracker](https://github.com/heshipstech/blinklab/issues), including one where an unusually high learned baseline inflates blink durations.
- Self reported sleepiness is a noisy label, and there is no objective validation of the score yet. Earning that is what Phase 7 is for.

## Privacy

Everything runs in your browser. No video, image or measurement ever leaves your device. There is no backend, no analytics and no telemetry. The CSV export writes a file to your own disk and uploads nothing.

## Status

Phases 0 through 6 are complete: foundations, pixels, landmarks, measurement, blinks, gaze and attention, and the rolling state with the demo score. That is 384 unit tests and one end to end test, all green on every pull request.

Next is Phase 7, the honest evaluation track: a Python analysis folder, a real dataset, a baseline classifier with a leave one subject out split, and a negative control that must collapse to chance. The published limitations above are the things that track exists to attack.

## How to run

You need Node.js 20 or newer.

```
git clone https://github.com/heshipstech/blinklab.git
cd blinklab
npm install
npm run dev
```

Open the local URL that Vite prints, then allow camera access.

`npm test` runs the unit tests. `npm run e2e` runs the end to end tests, which drive the built app in a headless browser with a fake camera; the first run needs `npx playwright install chromium`.

## How this repo works

The project grows one small increment per session, each one branch, one pull request, one push, each with a written note explaining the idea in plain English. The working documents:

- [PROJECT.md](PROJECT.md), what this is and why.
- [SPEC.md](SPEC.md), the technical contract, including the FeatureRecord, score and CSV contracts.
- [ROADMAP.md](ROADMAP.md), the full increment ladder and its accepted amendments.
- [STATE.md](STATE.md), where things stand right now.
- [LEARNING.md](LEARNING.md), one plain English engineering note per increment, including the ones that record a mistake.
- [test/MANUAL.md](test/MANUAL.md), the checks a machine cannot run, because a headless browser has no face.
- [decisions/](decisions/), architecture decision records.

## License

MIT, with a not a medical device notice. See [LICENSE](LICENSE).
