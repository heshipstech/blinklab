# ROADMAP.md

The full increment ladder. One checkbox is one branch, one pull request, one push. If a row looks like it needs more than two hours, split it here before starting.

## Amendments to the master plan

Accepted on 2026-07-28, before any code:

1. Increment 1.1's automated check was replaced by manual steps in `test/MANUAL.md`. Playwright (the browser testing tool) is introduced at 5.5 as planned, and a headless browser cannot click a real camera permission prompt anyway.
2. Increment 5.4 was split into 5.4a and 5.4b. The gaze target is reliable quadrant classification with the head reasonably still, not a precise gaze point. The head pose gate from 3.8 marks gaze invalid when the head moves too much.
3. Video upload mode moved from 8.1 to 7.0, so dataset videos run through the same TypeScript pipeline as the live camera. Python only loads the resulting CSV files and does statistics. Increment 7.3 is a go or no-go gate on dataset licensing.

## Phase 0. Foundations (no eye code at all)

- [x] 0.1 The four working documents, plus LICENSE, .gitignore, README skeleton. Done when the repo has docs and nothing else.
- [x] 0.2 Vite plus TypeScript project that prints "blinklab" to the page. Done when `npm run dev` shows a page locally. Check: `npm run build` succeeds.
- [x] 0.3 ESLint, Prettier, strict tsconfig, and the rule that `core` cannot import `io` or `ui`. Check: lint and typecheck scripts pass.
- [x] 0.4 Vitest with one real test of a trivial pure function in `core`. Check: `npm test` shows 1 passing test.
- [x] 0.5 GitHub Actions CI (continuous integration) running install, lint, typecheck, test, build on every pull request. Check: green check on a pull request.
- [x] 0.6 Branch protection on `main`, pull request template, two issue templates. Done when direct pushes to `main` are blocked.
- [x] 0.7 GitHub Pages deployment workflow. Done when a public URL shows the page.
- [x] 0.8 ADR-0001 recording the stack decision and its alternatives.

## Phase 1. Pixels

- [x] 1.1 Request webcam permission, show the live video element. Done when your face appears. Check: manual steps in `test/MANUAL.md` (amended, see above).
- [x] 1.2 Permission denied and no camera states with readable messages. Check: unit test on the state machine.
- [x] 1.3 Measured frames per second, displayed. Check: unit test of the fps calculator with fake timestamps.
- [x] 1.4 Draw the video into a canvas instead of showing the video element. Check: visual check documented in `test/MANUAL.md`.
- [x] 1.5 Camera device picker when more than one camera exists. Check: unit test on the device list mapper.
- [ ] 1.6 Mirror toggle and resolution readout. Check: unit test on the transform matrix.

## Phase 2. Landmarks

- [ ] 2.1 Load FaceLandmarker, log face detected true or false. Check: unit test on the face present predicate using a fixture.
- [ ] 2.2 Draw all 478 landmarks as dots on the canvas. Check: fixture based test of the point projector.
- [ ] 2.3 Move landmark index groups into `core/constants.ts`, draw only the eye region. Check: index sets do not overlap and are in range.
- [ ] 2.4 Draw the iris landmarks in a second colour. Check: iris indices form a closed ring.
- [ ] 2.5 Guard against a model returning 468 landmarks instead of 478. Check: unit test with a 468 point fixture.
- [ ] 2.6 Display per frame inference time in milliseconds. Check: test on the timing helper.
- [ ] 2.7 Record 300 frames of landmarks to a JSON fixture file for tests. Done when `test/fixtures/session-01.json` exists and is used by a test.

## Phase 3. First real measurement

- [ ] 3.1 Eye aspect ratio (EAR) per eye, displayed. Check: unit test with hand built synthetic eye shapes.
- [ ] 3.2 Rolling sparkline of EAR over the last 10 seconds. Check: unit test of the ring buffer.
- [ ] 3.3 Synthetic face generator in `test/fixtures/syntheticFace.ts`, landmark sets at known distances and angles. Check: whole new test file.
- [ ] 3.4 Iris width normalisation, pixels to millimetres via the fixed 11.7 mm human iris diameter. Check: mm output stable while px output varies across synthetic distances.
- [ ] 3.5 Lean in and lean out validation, coefficient of variation for px and mm. Check: CV(mm) < CV(px) on synthetic data.
- [ ] 3.6 Head pose estimate: pitch, yaw, roll. Check: three separate synthetic tests, one per axis.
- [ ] 3.7 Tilt correction on aperture, using roll. Check: synthetic test at 0, 15, 30 degrees roll.
- [ ] 3.8 Reject frames outside a head pose range, mark them invalid instead of guessing. Check: unit test of the validity gate.

## Phase 4. Blinks

- [ ] 4.1 Fixed threshold blink detector, blink counter. Check: unit test on a synthetic aperture time series.
- [ ] 4.2 Personal baseline learned over 30 seconds, visible countdown. Check: baseline rises but never falls.
- [ ] 4.3 Blink duration in milliseconds. Check: synthetic series with known durations.
- [ ] 4.4 Blink rate per minute, rolling window. Check: ring buffer and window edge tests.
- [ ] 4.5 Blink closing velocity and the amplitude over velocity ratio. Check: unit tests on velocity extraction.
- [ ] 4.6 Frame rate honesty gate, null instead of a number when fps is too low. Check: null, not zero, below threshold.
- [ ] 4.7 Squint versus blink separation. Check: synthetic squint plateau counts no blinks.
- [ ] 4.8 Blink event log with timestamps in a side panel. Check: test on the event reducer.

## Phase 5. Gaze and attention

- [ ] 5.1 Iris centre offset relative to the eye corners, per eye. Check: synthetic tests at known offsets.
- [ ] 5.2 Screen quadrant classification, four regions. Check: test on labelled fixture frames.
- [ ] 5.3 On screen versus off screen classification. Check: threshold test.
- [ ] 5.4a Calibration capture screen: nine points shown, samples collected and stored (amended, split from 5.4). Check: test on the sample collector.
- [ ] 5.4b Calibration solver producing a stored profile. Done when quadrant classification is reliably correct with the head reasonably still (amended target). Check: solver test with synthetic points.
- [ ] 5.5 Introduce Playwright, first end to end test of the calibration flow. Check: headless test passes in CI.
- [ ] 5.6 Gaze point smoothing filter, raw and smoothed traces both drawn. Check: filter preserves step response within tolerance.
- [ ] 5.7 Fixation and saccade separation using a dispersion threshold algorithm (I-DT). Check: synthetic scanpath of known structure.
- [ ] 5.8 Fixation duration statistics panel. Check: aggregation tests.
- [ ] 5.9 Gaze heatmap over a static image. Check: test on the accumulation grid.
- [ ] 5.10 Scanpath replay with a time slider. Check: test on the replay index lookup.

## Phase 6. Rolling state and the demo score

- [ ] 6.1 PERCLOS (percentage of eye closure) over a rolling 60 second window. Check: synthetic series with known closure fraction.
- [ ] 6.2 Long closure detector, eyes shut beyond a threshold triggers an event. Check: boundary case included.
- [ ] 6.3 Alert with debounce so it cannot fire repeatedly. Check: repeated triggers within the debounce window.
- [ ] 6.4 Feature vector assembled into one typed FeatureRecord per second. Check: schema test.
- [ ] 6.5 Explainable 0 to 100 demo score using a documented weighted heuristic. Check: contribution numbers sum to the score.
- [ ] 6.6 Contribution panel showing the top three drivers of the score. Check: snapshot test.
- [ ] 6.7 Session recorder, export CSV (comma separated values) to a local download. Check: serialiser tests including comma and header edge cases.
- [ ] 6.8 KSS (Karolinska Sleepiness Scale, 1 to 9) self report before and after a session, written into the CSV. Check: metadata writer test.
- [ ] 6.9 Prominent, permanent "demo, not a safety or medical device" notice in UI and README. Check: Playwright assertion.

## Phase 7. Honest evaluation (the Python track)

- [ ] 7.0 Video file upload mode so recorded clips run through the same TypeScript pipeline (amended, moved from 8.1). Check: end to end test with a sample clip.
- [ ] 7.1 `/analysis` folder, pinned Python environment, ruff, pytest, second CI job. Check: Python CI job green with one real test.
- [ ] 7.2 CSV loader plus a first plot of one recorded session. Check: loader tests on malformed CSV.
- [ ] 7.3 DATASETS.md, choose one openly licensed public dataset, record licence and access terms. Go or no-go gate: if no suitable openly licensed dataset exists, replan 7.4 to 7.7 before starting them (amended).
- [ ] 7.4 Batch runner computing features over dataset videos into feature CSVs, via the 7.0 upload pipeline (amended). Check: two frame sample test.
- [ ] 7.5 Baseline classifier with a clearly stated train and test split. Check: reproducibility with a fixed seed.
- [ ] 7.6 Leave one subject out evaluation, per subject scores reported. Check: no subject in both splits.
- [ ] 7.7 Negative control: shuffle labels, confirm collapse to chance. Check: test asserting the collapse.
- [ ] 7.8 Latency measurement: per frame compute cost, and time from eye closure to alert. Check: timing test with tolerance.
- [ ] 7.9 Results section in README generated from analysis output, limitations stated plainly. Check: CI check that no TODO remains in the results block.

## Phase 8. Making it public and durable

- [ ] 8.1 (moved to 7.0, see amendments)
- [ ] 8.2 ARCHITECTURE.md with a module diagram and the data flow. Done when a newcomer understands it in 5 minutes.
- [ ] 8.3 CHANGELOG.md, semantic version tags, first GitHub Release v0.1.0. Check: release workflow.
- [ ] 8.4 MODEL_CARD.md: what it measures, what it does not, where it fails, who it fails for.
- [ ] 8.5 Dependabot and a basic security policy. Check: automated dependency pull requests appear.
- [ ] 8.6 Test coverage reporting with a floor on `core/`, starting at 70 percent. Check: CI gate.
- [ ] 8.7 Performance budget check in CI: bundle size gate in CI, inference time measured locally and recorded (CI machines have no camera and vary in speed). Check: CI gate plus documented local numbers.
- [ ] 8.8 Accessibility pass: keyboard navigation, focus states, text alternatives for every graphic number. Check: automated accessibility test.

## Phase 9 and beyond (ideas, not commitments)

- Pupil diameter estimation and a light response experiment using screen brightness.
- Ambient light compensation using scene brightness.
- Microsaccade detection, needs higher frame rates, a genuine research challenge.
- Smooth pursuit test: follow a moving dot, measure tracking quality.
- Reading detection from scanpath shape alone.
- A small learned model to replace one heuristic, with the heuristic kept as the baseline it must beat.
- WebGPU or WASM performance work, with before and after numbers.
