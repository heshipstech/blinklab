# ROADMAP.md

The full increment ladder. One checkbox is one branch, one pull request, one push. If a row looks like it needs more than two hours, split it here before starting.

## Amendments to the master plan

Accepted on 2026-07-28, before any code:

1. Increment 1.1's automated check was replaced by manual steps in `test/MANUAL.md`. Playwright (the browser testing tool) is introduced at 5.5 as planned, and a headless browser cannot click a real camera permission prompt anyway.
2. Increment 5.4 was split into 5.4a and 5.4b. The gaze target is reliable quadrant classification with the head reasonably still, not a precise gaze point. The head pose gate from 3.8 marks gaze invalid when the head moves too much.
3. Video upload mode moved from 8.1 to 7.0, so dataset videos run through the same TypeScript pipeline as the live camera. Python only loads the resulting CSV files and does statistics. Increment 7.3 is a go or no-go gate on dataset licensing.
4. Accepted 2026-07-31: increment 3.7 delivers a verification of tilt invariance instead of a tilt correction. The aperture is measured as distances between landmarks, and rotations cannot change distances, so there is nothing to correct. The synthetic tests at 0, 15 and 30 degrees prove it, and a counterfactual test shows the cos(roll) shrinkage a naive vertical measurement would have suffered.
5. Accepted 2026-08-06: the long closure detector (6.2) and its alert (6.3) moved off the blink threshold onto a dedicated shut line at 40 percent of the personal baseline. The owner's face proved the need: naturally low eyelids reading at the bottom of the screen sat below the blink line for five seconds while fully awake, and the literature's 20 percent P80 line proved unreachable because the instrument reads fully shut eyes as about a third of baseline, not zero. The 40 percent line is the measured midpoint between the shut floor and the reading droop. The band between the blink line and the shut line is a partial droop, deliberately neither event. PERCLOS shares the unreachable-line problem and has its own follow-up issue.
6. Accepted 2026-08-06: PERCLOS (6.1) adopts the same measured shut line as the long closure detector, aliased from one constant. Its original 20 percent P80 line was proven unreachable on this instrument (0.0 percent through a witnessed 12.9 second closure), so PERCLOS is now an instrument-adjusted convention, documented as such rather than presented as literal literature P80. The deliberate cost: the disagreement between PERCLOS and the long closure detector was the tripwire that exposed amendment 5's bug, and aligning them removes that tripwire; the regression tests and manual items that replaced it are named in the fix.

7. Accepted 2026-08-08: increment 7.3's gate returned NO. No public dataset clears all four of the project's requirements at once (face video, a drowsiness label, per-clip subject identity, and a licence a solo unaffiliated founder may rely on for a public MIT repository). The openly licensed drowsiness data is physiological, still-image or synthetic; the video corpora with real sleepiness labels are behind signed agreements, non-commercial clauses, or no licence at all. Full evidence in DATASETS.md. Rows 7.4 to 7.7 are therefore held for replanning, and split into two tracks. Track A needs no permission from anyone: validate blink DETECTION against the GPL3 blink-annotated benchmark set, which has ground-truth blink intervals and no gate. Track B, a drowsiness classifier on UTA-RLDD, is defensible but not clean, because that dataset carries no licence at all; it is a judgement call for the maintainer and is recorded as a recommendation rather than a decision.

8. Accepted 2026-08-10: rows 7.5 and 7.6 are HELD, not done, and not achievable as written. They assume a dataset large enough to train a classifier and hold out subjects. The only dataset this project has permission for and can measure is DROZY, which yields 20 sessions from 13 subjects once the 25 fps floor removes 16, and those 16 are systematically the sleepier ones: they average KSS 6.38 against 4.60, and every rating of 9 is among them. No feature survived correction against the sleepiness ratings. Training a classifier on that and reporting a leave one subject out score would produce a number that is mostly the noise of whichever subject was held out, which is the exact failure this project spent two days climbing out of. What would unblock them: more recordings carrying real sleepiness labels, at 25 frames per second or better, from more people. Row 7.7 is delivered inside the DROZY analysis, which shuffles the ratings 1000 times with a fixed seed. Rows 7.8 and 7.9 remain achievable and are unaffected.

9. Accepted 2026-08-09: DROZY is unblocked too. Professor Jacques Verly, senior author of the DROZY database, granted written permission on 8 August 2026 for the use this project described: computing per-second numeric features locally and publishing those numbers and the resulting evaluation metrics. His reply asked about a connection with MIT, having read "MIT licensed" as the institution rather than the software licence; the owner corrected that in writing on 9 August, which matters because term 4's non-commercial clause bit this project precisely BECAUSE the MIT licence grants downstream commercial use. The condition is citation of the database and the WACV 2016 paper wherever results appear. DROZY carries real Karolinska Sleepiness Scale ratings, which is what rows 7.5 to 7.7 need and what no other permitted dataset has, so those rows are unblocked. Full record in DATASETS.md. The safeguards are unchanged: numbers only, never a frame.

10. Accepted 2026-08-08: Track B is unblocked. Professor Vassilis Athitsos, senior author of UTA-RLDD, granted written permission on 8 August 2026 for exactly the use this project proposed: computing per-second numeric features locally and publishing those numbers and the resulting evaluation metrics. The dataset's absence of a licence, which was amendment 7's reason for holding rows 7.4 to 7.7, is therefore resolved for this use. Track A continues first because it is further along and needs nobody's permission. The safeguards recorded in DATASETS.md are not relaxed by the permission: numbers only, never a frame, pseudonymous subject identifiers, source video deleted once features are computed, and the CVPR Workshops 2019 paper cited. The reason they stand is that participants recorded themselves and their consent terms are published nowhere, so no author can grant rights over a face beyond what its owner allowed.

11. Accepted 2026-08-16: rows 7.10 to 7.12 are added, a six-person validation round on live webcams. The reason they are not on the original ladder is that the ladder assumed validation meant a corpus, and a corpus is exactly what the licensing gate at 7.3 could not deliver. Meanwhile every live-camera claim this project makes rests on ONE face through ONE camera, the owner's, because Eyeblink8 and DROZY are both recorded clips at fixed rates rather than webcams in real rooms with real lighting. That is the largest untested claim in the repository and no held row unblocks it: rows 7.5 and 7.6 want labelled sleepiness data, and this round wants six people and a scripted session. It also blocks 7.9 honestly, since "limitations stated plainly" cannot be written while the biggest limitation is unmeasured. The round is not a classifier, publishes no recall figure, and is pre-registered in `docs/validation-plan.md` before any file exists, for the same reason the DROZY plan was.

12. Accepted 2026-08-18: issue #178 is reopened off the declined list and reconciled without changing any behaviour, and the reason it may be reopened is one that did not exist on 15 August. It was declined because settling it needed a corpus run or an argument; the blink-trace harness built on 17 August for the sampling-rate question runs one closure past the real detector with every variable held still, so both sides of the contradiction can be reproduced in the same framework in milliseconds. The finding is that `MAX_BLINK_DURATION_MS` does two non-overlapping jobs and which one it is doing depends on `baseline_over_resting`. The constant is NOT moved: that is step 4 of the issue's own suggested order and it is the owner's decision. Written up in `docs/max-blink-duration.txt`. The same increment adds the gradual-descent case closed issue #126 asked for and issue #115 filed, asserted as what today's code does.

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
- [x] 1.6 Mirror toggle and resolution readout. Check: unit test on the transform matrix.

## Phase 2. Landmarks

- [x] 2.1 Load FaceLandmarker, log face detected true or false. Check: unit test on the face present predicate using a fixture.
- [x] 2.2 Draw all 478 landmarks as dots on the canvas. Check: fixture based test of the point projector.
- [x] 2.3 Move landmark index groups into `core/constants.ts`, draw only the eye region. Check: index sets do not overlap and are in range.
- [x] 2.4 Draw the iris landmarks in a second colour. Check: iris indices form a closed ring.
- [x] 2.5 Guard against a model returning 468 landmarks instead of 478. Check: unit test with a 468 point fixture.
- [x] 2.6 Display per frame inference time in milliseconds. Check: test on the timing helper.
- [x] 2.7 Record 300 frames of landmarks to a JSON fixture file for tests. Done when `test/fixtures/session-01.json` exists and is used by a test.

## Phase 3. First real measurement

- [x] 3.1 Eye aspect ratio (EAR) per eye, displayed. Check: unit test with hand built synthetic eye shapes.
- [x] 3.2 Rolling sparkline of EAR over the last 10 seconds. Check: unit test of the ring buffer.
- [x] 3.3 Synthetic face generator in `test/fixtures/syntheticFace.ts`, landmark sets at known distances and angles. Check: whole new test file.
- [x] 3.4 Iris width normalisation, pixels to millimetres via the fixed 11.7 mm human iris diameter. Check: mm output stable while px output varies across synthetic distances.
- [x] 3.5 Lean in and lean out validation, coefficient of variation for px and mm. Check: CV(mm) < CV(px) on synthetic data.
- [x] 3.6 Head pose estimate: pitch, yaw, roll. Check: three separate synthetic tests, one per axis.
- [x] 3.7 Tilt invariance of aperture, verified instead of corrected (amended, see above). Check: synthetic test at 0, 15, 30 degrees roll, plus the cos(roll) counterfactual.
- [x] 3.8 Reject frames outside a head pose range, mark them invalid instead of guessing. Check: unit test of the validity gate.

## Phase 4. Blinks

- [x] 4.1 Fixed threshold blink detector, blink counter. Check: unit test on a synthetic aperture time series.
- [x] 4.2 Personal baseline learned over 30 seconds, visible countdown. Check: baseline rises but never falls.
- [x] 4.3 Blink duration in milliseconds. Check: synthetic series with known durations.
- [x] 4.4 Blink rate per minute, rolling window. Check: ring buffer and window edge tests.
- [x] 4.5 Blink closing velocity and the amplitude over velocity ratio. Check: unit tests on velocity extraction.
- [x] 4.6 Frame rate honesty gate, null instead of a number when fps is too low. Check: null, not zero, below threshold.
- [x] 4.7 Squint versus blink separation. Check: synthetic squint plateau counts no blinks.
- [x] 4.8 Blink event log with timestamps in a side panel. Check: test on the event reducer.

## Phase 5. Gaze and attention

- [x] 5.1 Iris centre offset relative to the eye corners, per eye. Check: synthetic tests at known offsets.
- [x] 5.2 Screen quadrant classification, four regions. Check: test on labelled fixture frames.
- [x] 5.3 On screen versus off screen classification. Check: threshold test.
- [x] 5.4a Calibration capture screen: nine points shown, samples collected and stored (amended, split from 5.4). Check: test on the sample collector.
- [x] 5.4b Calibration solver producing a stored profile. Done when quadrant classification is reliably correct with the head reasonably still (amended target). Check: solver test with synthetic points.
- [x] 5.5 Introduce Playwright, first end to end test of the calibration flow. Check: headless test passes in CI.
- [x] 5.6 Gaze point smoothing filter, raw and smoothed traces both drawn. Check: filter preserves step response within tolerance.
- [x] 5.7 Fixation and saccade separation using a dispersion threshold algorithm (I-DT). Check: synthetic scanpath of known structure.
- [x] 5.8 Fixation duration statistics panel. Check: aggregation tests.
- [x] 5.9 Gaze heatmap over a static image. Check: test on the accumulation grid.
- [x] 5.10 Scanpath replay with a time slider. Check: test on the replay index lookup.

## Phase 6. Rolling state and the demo score

- [x] 6.1 PERCLOS (percentage of eye closure) over a rolling 60 second window. Check: synthetic series with known closure fraction.
- [x] 6.2 Long closure detector, eyes shut beyond a threshold triggers an event. Check: boundary case included.
- [x] 6.3 Alert with debounce so it cannot fire repeatedly. Check: repeated triggers within the debounce window.
- [x] 6.4 Feature vector assembled into one typed FeatureRecord per second. Check: schema test.
- [x] 6.5 Explainable 0 to 100 demo score using a documented weighted heuristic. Check: contribution numbers sum to the score.
- [x] 6.6 Contribution panel showing the top three drivers of the score. Check: snapshot test.
- [x] 6.7 Session recorder, export CSV (comma separated values) to a local download. Check: serialiser tests including comma and header edge cases.
- [x] 6.8 KSS (Karolinska Sleepiness Scale, 1 to 9) self report before and after a session, written into the CSV. Check: metadata writer test.
- [x] 6.9 Prominent, permanent "demo, not a safety or medical device" notice in UI and README. Check: Playwright assertion.

## Phase 7. Honest evaluation (the Python track)

- [x] 7.0 Video file upload mode so recorded clips run through the same TypeScript pipeline (amended, moved from 8.1). Check: end to end test with a sample clip.
- [x] 7.1 `/analysis` folder, pinned Python environment, ruff, pytest, second CI job. Check: Python CI job green with one real test.
- [x] 7.2 CSV loader plus a first plot of one recorded session. Check: loader tests on malformed CSV.
- [x] 7.3 DATASETS.md, choose one openly licensed public dataset, record licence and access terms. Go or no-go gate: if no suitable openly licensed dataset exists, replan 7.4 to 7.7 before starting them (amended). Gate returned NO, see amendment 7.
- [x] 7.4 Batch runner computing features over dataset videos into feature CSVs, via the 7.0 upload pipeline (amended). Check: two frame sample test. Delivered as a stepped measurement mode, which fixes #145: the clip waits for the instrument on every frame, so the output is a property of the file rather than of the machine.
- [ ] 7.5 Baseline classifier with a clearly stated train and test split. Check: reproducibility with a fixed seed.
- [ ] 7.6 Leave one subject out evaluation, per subject scores reported. Check: no subject in both splits.
- [x] 7.7 Negative control: shuffle labels, confirm collapse to chance. Delivered inside the DROZY analysis: the ratings are shuffled 1000 times with a fixed seed and the strongest chance correlation is printed beside the observed one. Check: test asserting the collapse.
- [x] 7.8 Latency measurement, DONE 21 August 2026: time from eye closure to alert is deterministic, 500 ms plus at most one frame period (520.0 ms at 25 Hz, 533.3 at 30, 516.7 at 60), proven sensitive by mutation; the core chain costs about 42 microseconds per frame on one measured machine, asserted under a 2 ms ceiling so CI noise cannot redden it while per-frame growth still would. The debounce regime is stated beside it: within 5 s of a firing a new closure is counted, not told. Record: docs/latency.txt. Check: timing test with tolerance, test/core/alertLatency.test.ts.
- [ ] 7.9 Results section in README generated from analysis output, limitations stated plainly. Check: CI check that no TODO remains in the results block.
- [x] 7.10 The six-person validation round, pre-registered and read (amendment 11). `docs/validation-plan.md` written before any session file exists, and `analysis/blinklab/validation.py` pairing a folder of exports with a named refusal for every way it can be handed something untrustworthy, including the camera blink log that `blink_log.py` is correct to refuse. No check is computed here, deliberately: a reader and its checks arriving together is how a refusal softens into a default. Check: a mutation per refusal turns its own test red, and a session whose blink log does not exist is KEPT, because that is a result and not an accident.
- [x] 7.11 The checks and the published table: blinks between the two marks with their boundary counts, the long closure, the baseline's readiness and drift, face-detected share, iris width per device with its measurement frame, and declared against processing frame rate. `validation_checks.py` judges, `tools/validation_report.py` prints, and the report answers the plan's three failure criteria out loud rather than leaving a reader to count rows. Check: a fixture per verdict, a mutation per rule, and a refused participant gets a named row plus a non-zero exit rather than a silence. NOT YET RUN ON A REAL FILE, which is 7.12.
- [x] 7.12 The dry run, DONE 16 and 17 August. FIVE sessions on three devices, at the owner's suggestion of three rather than two: iPhone 14 Pro Max twice, MacBook Air twice, and the Sony A7 IV through a Cam Link 4K. The second MacBook run is the test that separates the processing rate from the device, repeating the first at the same rate with a baseline that lands correctly. All eight files read with no refusals and the pairing coped with device names in the filenames. The drift threshold is SET at 15 percent from the measured 0.0, 0.0, 0.0 and 5.0, recorded in `docs/validation-plan.md` before any volunteer file existed. Full write-up in `docs/validation-dry-run.txt`. It found two things no fixture could: a baseline 41 percent longer than its own session's median aperture passing BOTH halves of the pre-registered baseline check, which produced the plan's second correction and a fifth check; and the instrument losing deliberate blinks at the rate a four core machine produces, 3 of 10 on the phone and 1 of 10 on the laptop, each miss a hole a whole number of blinks wide in a metronome cadence, with the 25 fps gate never firing. It also refuted one of its own first conclusions, that blink duration moves with the processing rate, which the fifth session ordered the wrong way. Check: the threshold was recorded before any volunteer file was opened, and the session that disagreed with the protocol was re-run rather than deleted.

## Phase 8. Making it public and durable

- [ ] 8.1 (moved to 7.0, see amendments)
- [x] 8.2 ARCHITECTURE.md with a module diagram and the data flow. Done when a newcomer understands it in 5 minutes.
- [x] 8.3 CHANGELOG.md written 15 August covering all seven existing releases plus an Unreleased section. Tags exist to v0.7.0. The v0.8.0 tag is deliberately not cut: 8.8 is declined rather than done, and a version number is not worth a ceremony.
- [x] 8.4 MODEL_CARD.md: what it measures, what it does not, where it fails, who it fails for.
- [x] 8.5 Dependabot config, alerts on and reporting 0, SECURITY.md with a real threat model. Verified against the API 15 August.
- [x] 8.6 Coverage floor on src/core as its own CI step: statements 98, branches 95, functions 100, lines 98, against a measured 98.61 / 95.52 / 100 / 98.57. Far above the 70 this row asked for. Proven able to fail.
- [x] 8.7 Bundle size ceiling of 240 kB checked after every build, against 217.6 kB actual. Written against the one commit that bundles the 3.7 MB model rather than against creep. Inference time stays a locally recorded number, 6 ms, since CI machines have no camera.
- [~] 8.8 DECLINED 15 August. The floor is already met: keyboard operable, focus visible, all text clears WCAG contrast. What remained was polish.

## Phase 9 and beyond (ideas, not commitments)

- Pupil diameter estimation and a light response experiment using screen brightness.
- Ambient light compensation using scene brightness.
- Microsaccade detection, needs higher frame rates, a genuine research challenge.
- Smooth pursuit test: follow a moving dot, measure tracking quality.
- Reading detection from scanpath shape alone.
- A small learned model to replace one heuristic, with the heuristic kept as the baseline it must beat.
- WebGPU or WASM performance work, with before and after numbers.
