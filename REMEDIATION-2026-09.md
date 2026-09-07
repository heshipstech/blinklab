# REMEDIATION-2026-09.md

The save state for the work that follows the September 2026 review.

`REMEDIATION.md` was the save state for the August fixes and is closed.
The confirmed findings behind this file (F-001 to F-109 and the seven
G-series lenses) hold the reasoning; this file holds the order and the
progress. Written 6 September 2026 against `main` at 8ad1c06.

---

## How to resume

ROADMAP.md's amendment 17 (accepted 6 September 2026) names these items in
brackets on its rows; that table is the STATUS, this file is the ORDER.
Where the two disagree on order (10.8a before 13.8; hysteresis before the
driver), the roadmap's amendment says why and wins.

0. **`- [~]` means DECLINED, not pending.** Stage F lists every finding
   that was confirmed and is not being done, with the reason. A declined
   item is a decision. Do not reopen one without a reason that did not
   exist on 6 September.
1. The first unticked `- [ ]` item in Stage A is the next one to do.
   Stages run A to E in order; inside a stage, items are ordered by
   severity × confidence × leverage. Confidence is the verifier
   verdict pair: "confirmed ×2" means both independent verifications
   held at the filed severity; "downgraded" means at least one lowered
   it, and the item is placed at the lowered level.
2. One branch, one pull request, green continuous integration, per
   item. **Merge before deleting** (`gh pr view <n> --json state`).
3. **The corpus rule.** Any item that can move the Eyeblink8 count
   (A7, A15, A19, C2, C5, C6) is pre-registered in a dated doc BEFORE
   the change and lands through the regression run in D10.
   `tools/detectorRatchet.mjs` demands the caveat; D4 widens what it
   watches so the caveat is demanded for the scorer and stepper too.
4. Items marked **owner** need the owner's machines, cameras or the
   corpus download; nothing else on the ladder waits on them.

Gates before every pull request, from the repo root: `npm run lint`,
`npm run typecheck`, `npm test`, `npm run e2e`, `npm run format:check`,
`npm run build`. In `analysis/`: `uv run ruff check .`,
`uv run ruff format --check .`, `uv run pytest`. Never push to main.
Never run `npm install` or `npm ci` from inside a worktree scratch copy.

---

## Stage A. Correctness: wrong numbers and defects. Fix first.

- [x] **A1. Stepped clips can re-measure the same photograph under
      invented timestamps and open the 25 fps gate.** DONE 6 September
      2026 for the code and the four fixtures; the corpus half of the
      Check (a byte-identical Eyeblink8 run, or the branch B change
      `docs/stepper-honesty.txt` predicts) awaits D10's regression run.
      `critical · confirmed ×2 (reproduced) · M`
      **What:** one short inter-frame gap among the six calibration
      probes (`src/io/videoStepper.ts:44`) sets a step shorter than the
      true frame period; every later schedule slot that lands inside a
      frame already showing is measured again with a fabricated time
      (`videoStepper.ts:335-337`, `:344-354`) and counted as new. A
      200-frame 20 fps clip reports 399 frames at 40.0 fps,
      `stoppedEarly:false` (`src/main.ts:1417-1420`); `fpsGate` passes
      and blink rate, PERCLOS, long closures and the score are published
      for a recording `constants.ts:123` declares unmeasurable.
      `checkStepping` (`src/core/frameClock.ts:262-277`, the #193 guard)
      cannot fire because the invented times are monotonic, and
      `tools/measure_corpus.mjs:209` logs 62 characters of the status
      line. No fixture presents a non-constant interval
      (`test/io/videoStepper.test.ts:19-53`) and no export row records
      the interval, the frames sought or the inexact landings
      (`frameClock.ts:160-179`, `src/core/frameTrace.ts:71-77`).
      **Why first:** a fabricated measurement presented as real, on the
      variable-rate inputs the next era targets, and the mechanism that
      decides which UTA-RLDD videos are in the published result (A11).
      **Fix:** count inexact landings in `StepSummary`; refuse the run by
      name above a pre-registered fraction (0.02, mirroring
      `STEPPING_DUPLICATE_TOLERANCE` at `frameClock.ts:249`, message
      already at `main.ts:1355-1357`); in `measureFrameInterval` compare
      minimum gap against median gap and refuse or witness when they
      disagree by more than a quantum, probing more than six frames
      before committing a schedule; feed the inexact count to
      `checkStepping`; log the full status sentence; generalise
      `fakeVideo` to an explicit frame-time array and pin four cases
      (33/34 ms alternation, ms-quantised 29.97, one short glitch, a
      20 fps clip that stays refused); write `frame_interval_s`,
      `frames_sought`, `inexact_landings` as header rows; add a
      five-line histogram of consecutive `mediaTimeSeconds` differences
      for any retained `*.frames.csv`. Make "variable frame rate"
      greppable.
      **Check:** the four fixtures are red on HEAD; the stepped Eyeblink8
      run is byte-identical (all eight clips are constant-rate, so zero
      inexact landings are predicted, and that prediction is written
      down first).
      **Depends on:** nothing. **Unblocks:** A11, D3, D4.
      **Findings:** G-Stepped-1, G-Stepped-2, G-Stepped-6, G-Stepped-7.

- [ ] **A2. Drive the pipeline from delivered frames, not the display;
      peak velocity and A/V stop being a property of the monitor.**
      `high · confirmed ×2 · M`
      **What:** `processFrame` runs on every `requestAnimationFrame`
      tick (`src/main.ts:4590-4599`, `src/io/frameLoop.ts:66-79`),
      runs `detectForVideo` each tick (`main.ts:2983-2993`, counted at
      `:3023-3025` with nothing gating on `deliveredCount`) and pushes
      one `stabilitySample` per tick stamped with the rAF wall clock
      (`main.ts:3904-3911`). `analyzeClosing` divides the max adjacent
      drop by the adjacent gap (`src/core/blinkShape.ts:84-96`), so
      `peakClosingVelocityMmPerS` and `amplitudeOverVelocityMs` scale
      with display-refresh over camera-delivery; on a 120 Hz Mac the
      LID_SLUGGISH ramp (`src/core/score.ts:150-165`, 150-300 ms) can
      essentially never fire. Three of four inferences on a fast
      machine and ~45% on phones re-read the same photograph, the
      thermal load phones throttle under. `blinkShape.ts:3-4` promises
      the opposite.
      **Why:** a published column and a score input are hardware
      artefacts; the cheapest phone-throttling source the project
      controls. Roadmap 13.8 (`ROADMAP.md:224`) is this change and sits
      behind the signal rows it corrupts.
      **Fix:** drive `processFrame` from `requestVideoFrameCallback` /
      `observeVideoDelivery` (one call per presented frame, rVFC
      timestamp), leave rAF to repaint; keep the rAF fallback and record
      the driver in the export header; return null shape when delivery
      is unreported. Pre-register on existing dry-run exports that A/V
      scales inversely with processing/delivery ratio; after the change
      predict stepped Eyeblink8 unchanged, processing rate equals
      `sampled_fps`, inference time down by the old ratio. Re-derive
      the LID_SLUGGISH ramp and MANUAL item 26 afterwards. Move 13.8
      ahead of Phase 11/12 signal rows. Riders that fall out for free:
      `detectFixations` (`src/core/fixation.ts:94-100`) and the ~14
      unguarded `writeReadout` calls (`main.ts:4505-4528`) now run once
      per photograph (F-044, F-082; residual polish in E10).
      **Check:** stepped corpus digit-for-digit; `docs/latency.txt`
      re-run; the pre-registered A/V-vs-ratio relation on the old
      exports.
      **Depends on:** nothing. Do before A7/A19 so their trace harness
      runs on the corrected sample cadence.
      **Findings:** F-001, F-002 (F-044, F-082 partially).

- [x] **A3. `sampled_fps` crosses the export border rounded to one
      decimal, so the page and the Python mirror disagree on the 25 fps
      refusal and `pilot.py` halts the cohort.**
      `high · confirmed ×2 · S`
      **What:** `main.ts:2419` hands `sessionVerdict` the raw double;
      `src/core/sessionMetadata.ts:177-180` writes `toFixed(1)`;
      `analysis/blinklab/verdict.py:189-196` reads it back. In
      [24.95, 25.0) the page says refused, the mirror warned; in
      [59.95, 60.0) warned vs ok. `pilot.py:40-78` raises
      `InstrumentDefect` on the disagreement. The page also prints
      "25.0 frames per second ... below the 25".
      **Fix:** `asExported(rates.sampledFps, 1)` at `main.ts:2419`,
      exactly as pose and markers already do at `:2433-2442`; add
      verdict fixtures at `sampled_fps` 24.96 and 59.96 so both sides
      are pinned at the edges.
      **Depends on:** nothing. D6 later regenerates the fixtures.
      **Findings:** G-export/l-1.
      **Done:** 6 September 2026, roadmap 10.15.

- [x] **A4. Stop camera greys out Export CSV and the blink log; the
      natural stop-then-export order loses the session.**
      `high · confirmed ×2 · S`
      **What:** `render()` disables both exports whenever
      `state.kind !== "running"` unless `measurementFailed`
      (`main.ts:900-913`); the Stop handler (`:2667-2678`) sets idle
      under a comment saying the records stay exportable; the next
      Start wipes `featureRecords`. KSS-after is never asked
      (`src/core/participantReport.ts:85-97`,
      `docs/assessment-pilot-plan.md:72-74`).
      **Fix (interim):** export availability follows
      `featureRecords.length > 0`; e2e: Start, wait for one record,
      Stop, assert both exports enabled and the KSS-after prompt fires.
      A17 replaces the interim with a real ended state.
      **Findings:** F-015.
      **Done:** 6 September 2026, roadmap 14.0a, straight to A17's
      ended state; the interim was never built.

- [x] **A5. A superseded camera start attaches its stream and never
      stops it.** `high · confirmed ×2 · S`
      **What:** `src/io/camera.ts:34-36` sets `srcObject` and plays
      before returning; `main.ts:1075-1076` checks the run token only
      after it resolves and returns without `track.stop()`. Two picker
      changes inside getUserMedia latency, or Start then a clip pick
      while the permission bubble is up, leave a live unowned track
      (and can hijack the clip load, `src/io/videoFile.ts:36`) for the
      page's life, the shape `:1132-1137` calls dishonest.
      **Fix:** request, check token, then attach; return the
      `MediaStream` and stop its tracks on mismatch; disable
      `clipInput` and the device picker while requesting or loading.
      e2e with two rapid picker changes asserting one live track.
      **Findings:** F-017.
      **Done:** 6 September 2026, roadmap 14.0d: requestCamera,
      attachStream and stopStream in src/io/camera.ts, the token
      checked between request and attach, the picker and the clip
      input disabled while a start is in flight;
      test/e2e/cameraSupersede.spec.ts counts one live track after
      two picks inside one request's latency.

- [x] **A6. Light response without `Element.requestFullscreen` throws
      after the black overlay is shown, and has no touch exit.**
      `high · confirmed ×2 (reproduced headless) · S`
      **What:** `main.ts:4152-4155` unhides the overlay then calls
      `requestFullscreen()`; an absent method throws synchronously
      before `.catch`, `step()` (`:4157-4170`) never runs, and a
      z-index-20 black overlay with no text and no touch exit
      (`:4144-4173`, `:4175-4194`) traps a phone user; reload discards
      the session.
      **Fix:** guard on `typeof requestFullscreen`; touch-reachable
      exit and touch wording; add the no-fullscreen path to
      `lightResponse.spec.ts` via `addInitScript`.
      **Findings:** F-028.
      **Done:** 6 September 2026, roadmap 14.0b: fullscreen requested
      only where the method exists, a tap anywhere on the overlay ends
      it, and the overlay's words come from `lightPhaseMessage` in
      core and name both exits; the no-fullscreen path and the tap
      exit are in lightResponse.spec.ts.

- [ ] **A7. Long-closure reducer has no hysteresis: one hovering
      closure fires two or three times on phones.**
      `high · confirmed ×2 · S · corpus rule`
      **What:** `src/core/longClosure.ts:85` closes on one line and
      `:101-126` re-arms on any frame at or above it, so a later
      sub-line run over 500 ms fires again; `blink.ts:95-104`, `:127-129`
      already use `APERTURE_HYSTERESIS_FRACTION` (`constants.ts:118`).
      `docs/validation-dry-run.txt:221-233`: 3 and 2 events for one
      six-second closure on iPhones. One closure can cost 30-45 score
      points (`score.ts:38-39`) and the alert repeats. No roadmap row
      covers it (`ROADMAP.md:188` is the phone protocol, not this).
      **Fix:** a closure ends only when the aperture rises a
      noise-floor-derived fraction above the shut line
      (`docs/aperture-noise-floor.txt:65-67`) or holds N ms; prediction
      first via the trace harness on the dry-run traces (phone shapes
      collapse 3→1 and 2→1, desktop unchanged, durations
      byte-identical); pin with a 6 s closure at ±0.3 mm noise counting
      once; state hysteresis-not-filtering as the rule; new roadmap row
      before Phase 12.
      **Depends on:** A2 (run the harness on the corrected cadence).
      **Findings:** F-009.

- [ ] **A8. The line the detector reads is invisible to every export,
      follows the browser rather than the face, and can be learned from
      a clip's face.** `high · confirmed ×2 · M`
      **What:** `main.ts:1692-1693` loads `storedBlinkCalibration` at
      page load; `:3538-3542` uses it whenever non-null with no
      `frameSource` or device check; the calibrate buttons are enabled
      for any running source, clips included (`:885-889`, `:3403-3420`,
      `:3450-3486`), so three seconds of a recorded stranger's eye
      become this visitor's stored line. `CSV_COLUMNS`
      (`src/core/csv.ts:10-37`) and `calibrationMetadataRows`
      (`sessionMetadata.ts:201-214`) carry no line value or source; the
      stored shape is three numbers (`guidedCalibration.ts:118-122`,
      `src/io/calibrationStore.ts:199-212`); a guided line lifts the
      refusal for blinks (`:3569`) but not PERCLOS or the score
      (`:3683-3697`, `:3825-3827`, `:3848`, `:3877-3878`); two exports
      of one session disagree; `analysis/blinklab/plot.py:26,43`
      redraws a threshold the detector did not use; round II's frozen
      plan (`docs/validation-plan-round2.md:36-42`) cannot read a
      guided session.
      **Why:** the parameter that most directly controls every blink
      number is unrecorded; the guided line's first out-of-house test
      would be silently unmeasurable.
      **Fix:** append `blinkLineMm` and `blinkLineSource`
      (passive | guided | fixed | none) to `CSV_COLUMNS` by the
      trailing-append discipline at `csv.ts:29-36`; emit
      `guided_line_mm`, `guided_open_median_mm`,
      `guided_closed_median_mm` when a stored line is in force; compute
      one `blinksWithheld` boolean per frame and use it for readout,
      record, report and the log button; refuse a stored line when
      `frameSource === "file"` or when stamped iris px / frame size
      differ beyond a margin; gate both calibrate buttons and their
      steps on camera; cancel in-flight calibration in `resetSession`;
      store camera label, resolution and ISO timestamp beside the three
      numbers (keep `parseBlinkCalibration` strict); `plot.py` reads
      the exported line; a dated section in
      `validation-plan-round2.md` on reading guided sessions; an ADR
      on whether a guided line serves the shut baseline; e2e that a
      seeded line reaches the export and that the clip fixture cannot
      calibrate. Land BEFORE D10's regression run.
      **Unblocks:** A9, C2, C3, D10.
      **Findings:** F-007, G-Guided b-6, F-052, G-Guided b-11.

- [ ] **A9. The guided line has no soundness ceiling, and its open
      phase samples the eye while the person is reading the
      instruction.** `high · confirmed ×2 (b-4), confirmed/high +
downgraded/medium (b-1) · M`
      **What:** `resolveGuidedCalibration`
      (`guidedCalibration.ts:101-112`) has two length checks and one
      separation check (`closed > open × 0.7`), then returns the bare
      midpoint; nothing compares the line to the resting eye, so it can
      sit at 0.85 of the open median, above the droop band
      `longClosure.ts:29-35` documents. The only soundness ceiling in
      the codebase (`constants.ts:167`) guards the passive ruler the
      guided line supersedes. Separately `main.ts:3450-3455` starts
      sampling on the frame the instruction first paints
      (`guidedCalibration.ts:232-239`), so the open median is taken
      in the reading posture `constants.ts:20-23` calls a droop, and a
      person who reads for more than half the phase stores a line up
      to 40% low that passes every check.
      **Fix:** `GUIDED_CALIBRATION_SETTLE_MS` discarding the first
      window of each phase (or a ready affordance / visible countdown
      before sampling); a resolve-time ceiling symmetric to
      `BASELINE_MEDIAN_CEILING_FACTOR`, pre-registered before any
      guided data is read (refuse when `personalLineMm` exceeds p10 of
      the open samples, or exceeds the concurrently learned passive
      half-line by a committed factor); unit tests on both.
      **Depends on:** A8 (so the refusal is visible in the export).
      **Findings:** G-Guided b-4, G-Guided b-1.

- [ ] **A10. Guided calibration's own 3 s closed phase is scored as a
      microsleep and fed to the passive baseline.**
      `medium · confirmed ×2 · S`
      **What:** `blinkCalibrationSession` is read nowhere below
      `main.ts:3502`; `baselineStep` (`:3517-3521`), `blinkStep`
      (`:3561-3573`), `longClosureStep` (`:3688-3697`) and
      `perclosStep` (`:3755-3760`) run on the instructed closure; the
      3 s hold exceeds `LONG_CLOSURE_THRESHOLD_MS` (`longClosure.ts:19`),
      charges 15 points for a minute (`score.ts:38-39`), and inside the
      learning window feeds ~90 closed samples into the baseline; the
      export carries no mark.
      **Fix:** feed null to all four reducers while
      `blinkCalibrationSession !== null`; show "paused for
      calibration"; auto-write a marker at start and end
      (`main.ts:4226`); wiring test.
      **Findings:** F-040, G-Guided b-9.

- [ ] **A11. UTA-RLDD's 25 fps exclusion is a property of the stepper's
      calibration on each file, cross-checked against nothing; the
      record dropped the 30 reason lines its tool prints.**
      `high · confirmed ×2 · M · owner (manifest half)`
      **What:** `analysis/blinklab/rldd.py:195-198` takes the median of
      the export's per-second `fps` column and `:120` gates usability on
      it; that column is `measureFps` over the stepper's stamps, so a
      mis-calibrated step (A1) decides who is in the 148-video result.
      No container witness exists (`prepare_rldd.py:250-275` has no
      ffprobe line; `evaluate_eyeblink8.py:163-179` does the check for
      Eyeblink8 only). `analyse_rldd.py:47-61`, `:179-181` print a
      per-video reason; `docs/uta-rldd-result.txt:32`, `:34`, `:37-38`
      have none, round two reasons into one, and say 30 where the tool
      says 29 + 1. `docs/uta-rldd-plan.md:63-68` calls the exclusion a
      property of the file.
      **Fix:** one ffprobe line per clip (`r_frame_rate`,
      `avg_frame_rate`, `nb_read_packets`) into a manifest from
      `prepare_rldd.py`; coverage check in `rldd.py` against container
      frames, refusing above a stated tolerance; restate plan :66-68
      as "the rate this instrument measured"; paste the 30 reason
      lines from a re-run of `analyse_rldd.py` over the retained CSVs
      (no re-measurement) and reconcile :37-38 with :32; when row 10.3
      runs, attach the same manifest to DROZY and say in
      `docs/drozy-result.txt:5` that its exclusion is corroborated by
      DROZY's README (`docs/drozy-analysis-plan.md:29-40`), the
      sentence UTA-RLDD cannot write.
      **Depends on:** A1 (inexact-landing witness for future runs).
      **Findings:** G-Stepped-3, G-Stepped-4, G-Stepped-9.

- [ ] **A12. The Eyeblink8 evaluator exits 0 on a partial corpus, drops
      the glasses split silently, and its coverage rule tolerates 157
      frames and fails open on a missing header.**
      `medium · confirmed/high + downgraded/medium · S`
      **What:** `analysis/tools/evaluate_eyeblink8.py:183-191` returns 0
      whenever any clip evaluated; a watched-mode clip is skipped on
      stderr only (`:84-96`) and the glasses section vanishes (`:147`)
      instead of announcing it; the coverage check (`:171-179`) prints
      `<-- MISMATCH` under a full table at 1% tolerance and passes when
      `frames_measured` is absent. `docs/eyeblink8-preparation.txt:60-64`
      and `docs/eyeblink8-m5max.txt:39-40`, `:61-63` say "a coverage
      mismatch stops the line"; the published table carries +1 on two
      clips (`docs/eyeblink8-result.txt:25`, `:28`) with no explanation.
      **Fix:** `return 0 if len(results) == len(tags_found) else 1`;
      print skip and not-measured notices in the report body; "Split by
      glasses: not computable, N glasses clip(s) evaluated"; a coverage
      gap or an unparseable header refuses the clip with the tolerance
      in the printed line, tightened from 1% to a frame-exact bound; a
      dated paragraph naming which candidate (stepper last-frame
      duplicate, `videoStepper.ts:337-354`, or annotator stopping a
      frame early) produces the +1, or that it is unresolved. All
      pinned in D1's test file.
      **Findings:** G-Reproduc-3, G-Reproduc-5.

- [ ] **A13. `blinkRatePerMin` divides by elapsed time, not observed
      time.** `medium · confirmed/high + downgraded/medium · S`
      **What:** `src/core/blinkRate.ts:41-51`: `observedMs = min(now −
startedAt, 60000)`; `rateState` starts on the first processed
      frame, face or no face (`main.ts:3590`); frames the reducer was
      fed null (no face, pose gate, fps < 25, refusal) count as
      observed time with no blink. Windowed into the RLDD feature set
      (`analysis/blinklab/rldd.py:212`) and the DROZY rate row
      (`drozy.py:229`): missed blinks read as calm.
      **Fix:** accumulate observed time only on frames fed an aperture,
      window it like blink times, null below
      `BLINK_RATE_MIN_OBSERVATION_MS` of observed time; export the
      observed fraction beside the rate.
      **Findings:** F-004.

- [ ] **A14. Blink counting goes silently dead during a droop below the
      line or the re-arm line, and the rate prints 0/min.**
      `medium · confirmed ×2 (probed through the real reducers) · M`
      **What:** `blink.ts:91-105` treats every sub-line aperture as
      closed and mints a count only on a reopen crossing; `:127-129`
      re-arms only at 1.1 × line (`constants.ts:193`); resting at
      4.2 mm on a 4.0 line with five deep blinks counts one. Nothing
      distinguishes "no blinks" from "counting suspended"
      (`main.ts:3658-3667`); the fabricated zero is the failure the
      fps gate exists to prevent.
      **Fix:** null the rate while closed longer than
      `MAX_BLINK_DURATION_MS` or while `rearmed` is false; "blink
      counting suspended for N s" on the page and a per-record flag;
      export vertical iris offset so downgaze droop is separable;
      arming on closing velocity is C5's question.
      **Depends on:** A13.
      **Findings:** F-031.

- [ ] **A15. Refusal does not withhold durations, amplitude, velocity
      or the blink log, and the first 30 s of every session counts
      against the owner-fixture 4 mm line.**
      `medium · confirmed/high + downgraded (F-008); downgraded ×2
(F-006) · S · corpus rule`
      **What:** `docs/calibration-refusal.txt:42-44` lists blink
      durations as withheld; `main.ts:3825-3827` nulls only
      `blinkRatePerMin`, `:3828-3831` write `lastBlinkDurationMs`,
      amplitude and velocity unconditionally, and `:2699-2714` exports
      every learning-period event. While learning, `:3569-3572` hands
      the reducer `BLINK_APERTURE_THRESHOLD_MM` (`constants.ts:14-18`,
      the owner's fixture), an absolute-mm decision the iris ruler does
      not cancel (40% of open on a 10 mm eye, 80% on a 5 mm eye), and
      "Blinks: N" prints beside "Learning your open eyes"
      (`:3551`, `:3655-3672`); every Eyeblink8 figure includes this
      regime and `eyeblink8-result.txt` and `MODEL_CARD` do not say so.
      **Fix:** gate the three fields on `!calibrationRefused` (null,
      not zero); withhold or line-tag the blink log under refusal;
      wiring test that a refused session's records carry null in all
      three. For the learning window, DECIDE and pre-register: either
      feed null while learning (moves the corpus count; goes through
      D10) or keep the fixture line and label the count provisional
      on the page and in `eyeblink8-result.txt` / `MODEL_CARD`
      conditions. Either way the line source per blink is A8's column.
      **Depends on:** A8.
      **Findings:** F-008, F-006.

- [ ] **A16. The 25 fps refusal judges the processing rate, not the
      evidence rate; the report can say blink numbers were withheld
      while printing them.** `medium · downgraded ×2 · M · owner
(one session)`
      **What:** `main.ts:2943-2945` builds `fps` from per-tick
      `processFrame` stamps; `:3559` `blinkMeasurable =
measurableAtFps(fps)` gates the reducer, long closures (`:3693`)
      and PERCLOS (`:3758`); `evidenceFps` (`:2970`) feeds only the
      warning. A camera delivering 15-24 distinct frames behind a 60 Hz
      display passes, and the report (`:2420-2424`, `:2475-2500`,
      `sessionVerdict.ts:103-123`) then asserts withholding. The tests
      pin the sentence, not the wiring
      (`test/core/sessionVerdictFixture.test.ts:82-107`).
      `docs/blink-sample-rate.txt:436-444` pre-registered that the rule
      changes only after the case is observed; no session has yet
      delivered below 25.
      **Fix:** run one deliberate dim-room session (folded into C1) so
      the rule can fire; then gate on `min(sampledFps, fps)` where
      delivery is reported, with 60/65-style hysteresis, at
      `:3559/:3693/:3758`; a verdict/report fixture with
      `sampledFps` 20 and processing 60 whose measured rows and
      verdict agree; stepped corpus unchanged.
      **Depends on:** C1 (the observation), A3, A18.
      **Findings:** F-003.

- [x] **A17. There is no ended state: a finished clip stays running,
      the report is unreachable for every clip session, interruptions
      are counted after the end and stamped 0.000 s, and reset residue
      leaks across sessions.** `medium · confirmed ×2 · M`
      **What:** both clip end paths set only `clipRunEnded`
      (`main.ts:691-707`, `:1316-1322`) so `reportAvailable("running",
n)` stays false (`participantReport.ts:85-97`); Stop
      (`:2667-2678`) goes to idle and greys exports (A4); the
      `visibilitychange` listener (`:4241-4247`) has no state gate and
      stamps `lastRecordAtMs ?? 0`, so the verdict
      (`sessionVerdict.ts:144-161`) degrades on non-events and the
      export (`sessionMetadata.ts:327-331`) carries a literal zero
      where null-never-zero requires unknown; `resetSession`
      (`:950-1039`) never clears `blinkCalibrationSession`
      (`:1699-1700`) or inference samples (`:2912`), and mark/light
      buttons act on a stopped session (`:4109-4110`, `:4144-4150`,
      `:4175-4178`, `:4210-4211`).
      **Fix:** an `ended` state reached from Stop, clip finish and
      crash; exports, report and KSS-after depend on it; calibrations,
      markers and light on `running && camera`; interruptions gated on
      running with a null stamp exported as `unknown`; `resetSession`
      nulls calibration state and clears inference samples; refuse or
      export every stimulus start; word the gate per source; unit
      tests plus one e2e per transition. Supersedes A4's interim.
      **Findings:** F-057, F-055, F-095, (F-015 structural).
      **Done:** 6 September 2026, roadmap 14.0a: the `ended` state,
      exports, report and KSS-after on it, markers and light on
      `running && camera`, interruptions gated with a null stamp.
      The reset residue (calibration state, inference samples) and
      the stimulus export are carried by roadmap 14.0e, as the
      roadmap already says.

- [x] **A18. Delivery rates are memoised at the first consumer, so the
      report's evidence rate depends on click timing.**
      `medium · confirmed ×2 · M`
      **What:** `main.ts:590-596` `sessionDeliveryRates ??=
deliveryRates(...)` reads a rolling 5 s window
      (`deliveryRate.ts:45`, `:126-151`) whenever export, verdict
      (`:2414-2420`) or report first asks; the surface deciding
      refused/warned/ok is a function of operator speed
      (`docs/pilot-dry-run.txt:56-62`).
      **Fix:** capture at every session end before the observer stops
      (A17's ended transition); record `sampledFps` per second and let
      the verdict use its median.
      **Depends on:** A17.
      **Findings:** F-053.
      **Done:** 6 September 2026, roadmap 14.0d: the capture happens
      at every camera session end (Stop, the crash path, the camera
      that stopped) before the observer stops; the single settled
      capture is what every consumer reads. The per-second sampledFps
      column and its median are not built: the roadmap row asked for
      the capture at the transition, and the median is a separate
      decision for the ruler era.

- [ ] **A19. One untrusted frame splits a closure into two long closures
      and can hand its tail to the blink counter, pinned by test as
      intended.** `medium · confirmed ×2 · M · corpus rule`
      **What:** `longClosure.ts:77-84` resets `closedAtMs` and
      `firedForCurrentClosure` on a null frame;
      `test/core/longClosure.test.ts:291-307` pins count 2 for one
      100→1900 ms closure with a null at 1100; `blink.ts:88-90`,
      `:101-103` then count the tail. A microsleep with a head nod is
      double-charged (`score.ts:123-134`) and alerts twice.
      **Fix:** carry closure state across a bounded gap; do not arm a
      closure beginning right after a gap unless the eye was seen
      open; re-pin the test to the physical intent; trace-harness
      prediction first; Eyeblink8 through D10.
      **Depends on:** A7 (same reducer, land after it).
      **Findings:** F-036.

- [ ] **A20. Baseline and guided-calibration sample floors count
      processing ticks, not seconds of face.**
      `medium · confirmed ×2 · S`
      **What:** `baseline.ts:74-77` requires 30 s elapsed and 100
      samples; samples accrue one per tick (`main.ts:3517-3521`), so a
      120 Hz display satisfies the floor on 25 distinct photographs;
      the guided floors (`guidedCalibration.ts:87-91`,
      `constants.ts:166-172`) likewise (`main.ts:3456-3461`).
      **Fix:** require a minimum span of trusted-face time (or
      distinct `deliveredCount` values, `deliveryRate.ts:36-44`) per
      window and per guided phase; show and export face seconds. A2
      makes ticks equal frames; this makes the floor say so.
      **Depends on:** A2.
      **Findings:** F-051.

- [ ] **A21. A stepped clip that crashes mid-run exports as a camera
      session with no clip name.** `medium · confirmed/high +
downgraded/medium · S`
      **What:** the shared catch at `main.ts:1465-1491` sets
      `frameSource = "camera"` (`:1470`) and `loadedClipName = null`
      (`:1474`) before the `framesMeasured > 0` branch enters
      `measurementFailed` (`:1485-1488`); `measurementMode` stays
      stepped (`:1244`), so the provenance rows
      (`sessionMetadata.ts:121-125`, `:153-186`) contradict each other.
      **Fix:** branch first: if `framesMeasured > 0` set
      `measurementFailed` leaving source, clip name and mode untouched;
      extract the decision into core; e2e injecting a throw during a
      stepped clip asserting `# source: file` and the clip name.
      **Findings:** F-016.

- [x] **A22. KSS-after is re-asked on every export after a Skip and is
      stamped by whichever export comes first, even mid-session.**
      `medium · confirmed ×2 · S`
      **What:** `main.ts:2760-2783` guards on `kssAfter === null`
      although `kssAfterAsked` exists (`:2229-2232`) and Skip sets it
      (`:2323-2328`); two files from one session can carry `skipped`
      and `6`; a mid-session answer attaches to the wrong moment
      (`docs/assessment-pilot-plan.md:61-62`).
      **Fix:** test `!kssAfterAsked`; export `kss_after_at_seconds`;
      ask on A17's ended transition rather than on export.
      **Depends on:** A17 (or land the guard first, S).
      **Findings:** F-056.
      **Done:** 6 September 2026, roadmap 14.0a: guarded on asked,
      asked once on the ended transition, `kss_after_at_seconds`
      exported.

- [ ] **A23. Gaze calibration has no goodness-of-fit refusal; a garbage
      axis is stored and labelled "(calibrated)".**
      `medium · confirmed/high + downgraded/medium · S`
      **What:** `calibrationProfile.ts:36-59` `fitLine` refuses only
      `spread <= 0` and computes no residual; `:87-92` is all-or-nothing
      on null; `main.ts:3410-3419` stores any non-null solve;
      `:2152-2156` labels it. The blink calibration refuses on
      insufficient evidence (`guidedCalibration.ts:101-106`); this one
      does not.
      **Fix:** per-axis RMS residual and R² on the dot medians; refuse
      above a pre-stated bound (RMS > 0.15 or R² < 0.8); carry the
      residual in the profile, button label and export header; pin the
      noise-only-axis case.
      **Findings:** F-010.

- [ ] **A24. `headPose` reads MediaPipe's column-major matrix as
      row-major and decomposes the transpose.** `medium · confirmed ×2
(upstream `matrix_data.proto` checked) · S · owner (one frame)`
      **What:** `src/core/headPose.ts:7-8` asserts row-major with no
      source, `:22` reads `data[row*4+col]`; the only test builds its
      matrix the same way (`test/core/headPose.test.ts:50-60`,
      `test/fixtures/syntheticFace.ts:20-22`), so it cannot see it.
      Displayed signs invert and combined poses mis-split by degrees;
      the gate (`main.ts:3072-3074`) survives because limits are
      symmetric. 12.5's pitch medians and 10.7b/c's thresholds would
      embed the wrong convention.
      **Fix:** one DEV frame logging the 16 numbers with the head
      turned (translation at 12-14 means column-major); read
      `data[col*4+row]`; pin a real-recording fixture with a matrix;
      re-run MANUAL 19 for signs; use the translation for the gaze
      distance gate (C10).
      **Findings:** F-032.

- [ ] **A25. Blinks are not excluded from the gaze chain: each blink
      splits a fixation, truncates it ~330 ms and credits dwell to the
      wrong cell.** `medium · confirmed ×2 · M`
      **What:** no aperture check anywhere from `main.ts:3193-3221`
      (offset) through `:3293-3297` (smoothing), `:3341-3349`
      (`detectFixations`) and `:3380-3385` (heatmap); fixation count
      inflates by one per blink, so 12.13's turnover would move with
      blink rate.
      **Fix:** null the offset below the blink line; let I-DT bridge a
      blink-length null gap; exclude those frames from the heatmap;
      pin with `session-01.json` fixation count before/after.
      **Findings:** F-042.

- [x] **A26. A camera that stops delivering reads as "this browser does
      not report it" and records continue from a frozen frame.**
      `medium (downgraded/low once) · M`
      **What:** `deliveryRate.ts:119-124` documents null as three
      causes and `:167-173` renders all three as the browser's fault;
      `main.ts:2957-2978` lets `evidenceFps` fall back to the display
      rate; nothing listens for track `ended`/`mute` (`:691-692`,
      `:2983-2993`).
      **Fix:** render "no frames in the last 5 s" on staleness and null
      `evidenceFps`; listen for track ended/mute and route to
      failed/ended (A17); gate record writing on a delivered frame.
      **Depends on:** A17.
      **Findings:** F-054.
      **Done:** 6 September 2026, roadmap 14.0d: `deliveryStaleness`
      and the observed/stale readout in src/core/deliveryRate.ts, the
      `cameraStopped` state (its own, not failed: the camera started
      fine, and not ended: the verdict must call it a failure),
      reached from the track's `ended` event and from a drained
      window on an attentive page, the evidence rate null rather than
      the display's pace when delivery is observed, and
      src/core/recordGate.ts gating a row on a frame delivered since
      the last one. test/e2e/cameraStopped.spec.ts freezes the fake
      camera and reads the end by name.

- [x] **A27. Four small arithmetic and wiring defects, one PR.**
      `low · confirmed · S` - `deliveryRate.ts:100-116`, `:126-147`, `:167-179`: the two
      rates are measured over different spans and printed as
      part-of-whole ("3 per second, of which this instrument read
      5"). Measure both over one span; say "read all N" when sampled
      ≥ delivered; unit test `sampled <= delivered`. (F-105) - `perclos.ts:29-31`, `:95-118`: the minimum observation is a
      span rule; one sample at t=0 and one at 15 s speaks. Require a
      minimum valid-sample count or observed fraction; export it.
      (F-093) - `analysis/blinklab/light_response.py:231-233` returns
      `at_least / PERMUTATIONS`, printing p = 0.0000; `stats.py:91-94`
      and `rldd.py:471-476` use +1. Use `(at_least+1)/(N+1)` with a
      never-zero test. (F-091) - `frameTrace.ts:100-110` writes `# frames_measured` inside the
      cap warning while `main.ts:2733-2745` already passes
      `coverageMetadataRows` (`frameClock.ts:174-179`), so a
      truncated trace is refused as "edited or damaged" by
      `loader.py:118-127`; `blink_log.py:76-85` does not enforce the
      rule at all. Drop the redundant row; hoist one `_read_metadata`
      shared by loader, validation and blink_log. (G-export/l-7)
      **Done:** 6 September 2026, roadmap 10.16. Both delivery rates are
      counted inside the reads' span, a read remembers when its frame
      arrived so a frame delivered before the span is not credited to
      it, and the frames read in a span are a subset of the frames
      delivered in it, so the read fraction is at most one by
      construction rather than by a clamp; the equal case says "read
      all N". `PERCLOS_MIN_SAMPLES` is 100, deliberately far below the
      375 a 25 fps session produces in fifteen seconds, and both floors
      are exported. `light_response.py` uses (k+1)/(N+1), so the floor
      is 1/1001. `frameTrace.ts` no longer declares a key its caller
      owns, and one `read_metadata` in `blinklab/metadata.py` serves
      loader, validation and blink_log, each handing it its own
      exception; `blink_log.py` refuses a repeated key for the first
      time. One correction to this item's own wording: the reader that
      actually consumes a frame trace (`tools/miss_autopsy.py`) skips
      metadata lines entirely, so the duplicate key broke the
      exporter's stated contract without yet breaking a reader.

---

## Stage B. Honesty: overclaims and missing conditions

- [x] **B1. MODEL_CARD says the alertness score was never tested;
      README says AUC 0.70; `cannotSeeBlock` pins the stale sentence
      into the participant report.** `high · confirmed ×2 · S`
      **What:** `MODEL_CARD.md:34`, `:47-57` (revised 5 September, one
      day after `docs/alertness-score-result.txt` landed) omit UTA-RLDD
      entirely; `README.md:46-48`, `:527-535` report it;
      `tools/cannotSeeBlock.mjs:96-100` → `src/core/cannotSee.ts:49` →
      `participantReport.ts:234` carry the card's sentence.
      **Fix:** `MODEL_CARD.md:34` → "UTA-RLDD, 95 videos / 52 subjects:
      AUC 0.70 [about 0.60-0.81] cohort-level; per person unvalidated";
      rewrite `:47-57` to hold both facts; regenerate `cannotSee.ts`;
      add the 0.70 / p 0.001 pair to `resultGuard`'s pins against
      `alertness-score-result.txt`.
      **Findings:** F-014.
      **Done:** 6 September 2026, roadmap 10.0a1: the card's alertness
      row carries AUC 0.70 at p 0.001, cohort-level, per person
      unvalidated, and `resultGuard.parseAlertnessResult` reads those
      numbers out of `docs/alertness-score-result.txt` so the card is
      held to the record rather than to whoever edited it last; the
      tested-on table gains both UTA-RLDD reads, 54 subjects and 52,
      each parsed from its own file, and names tablets as untested.
      `cannotSee.ts` is 10.0a3's.

- [x] **B2. README's Privacy section says two localStorage keys; the app
      writes four, including a pseudonym and a personal blink line; the
      CSV carries a machine fingerprint, KSS answers and the pseudonym
      undisclosed.** `high · confirmed ×2 · S`
      **What:** `README.md:589` "those two keys are the only storage
      this app touches"; `src/io/calibrationStore.ts:29-45` and
      `src/core/storedData.ts:24-53` declare four; the stamp guard
      checks dates, not content (`test/e2e/storedData.spec.ts:49`).
      `src/io/deviceInfo.ts:52-66` and `sessionMetadata.ts:139-150`,
      `:364-366` write full `userAgent`, cores, screen, camera label,
      pseudonym and KSS into every export; the page (`notice.ts:23`)
      and `README.md:587` say nothing; participants are asked to email
      the files (`docs/validation-plan.md:294-296`,
      `docs/assessment-pilot-plan.md:57-59`).
      **Fix:** generate the storage paragraph from `STORED_ITEMS`
      (`resultsBlock` pattern) with a guard that every stored key
      appears in README's Privacy section; a tested constant beside
      the export buttons and in README listing what the CSV contains,
      derived from the metadata keys; offer a reduced user agent unless
      the full string is needed.
      **Findings:** F-023, F-064.
      **Done:** 6 September 2026, roadmap 10.0a2: README's Privacy
      section is generated by `tools/privacyBlock.mjs` from
      `STORED_ITEMS` and the export disclosure, with a test that
      rebuilds the block and a second that looks for every stored key
      inside the section rather than anywhere in the file; the count
      is counted, not typed. `exportContentsSentence` names what a CSV
      carries, derived from the metadata row builders and refusing when
      a key it names has left them, and it renders in the Session box
      beside the export buttons. `reduceUserAgent` gives the export a
      browser, a major version and a platform family; the full string
      is a checkbox, off by default, and a `user_agent_form` row says
      which form the file got.

- [x] **B3. The on-page notice and six documents say the model "does
      send" usage statistics after the 5 September block made that
      false; the install-order comment overclaims.**
      `medium · confirmed/high + downgraded/medium · S`
      **What:** `src/core/notice.ts:19-24` (pinned by
      `test/core/notice.test.ts:24-25`, `test/e2e/calibration.spec.ts:67`),
      `README.md:7`, `:591`, `MODEL_CARD.md:16-17`, `:319-324`,
      `PROJECT.md:28`, `CONTRIBUTING.md:19-23`, `docs/UI.md:108`;
      `ADR-0004:106-116`. `main.ts:279-285` says the block installs
      "before anything else" while `main.ts:268` →
      `src/io/landmarker.ts:1` statically evaluates the bundle first
      (`telemetryBlock.ts:22-23` wraps globals, so it holds anyway).
      **Fix:** one sentence variant ("tries to send ... this page
      intercepts the request before it leaves the browser, and a test
      checks it") at all seven sites; update the two pinning tests; a
      positive pin that `notice.ts`'s text is quoted verbatim in README
      and MODEL_CARD; keep retired phrases retired; state the true
      reason for the install order and the bundle property it relies
      on (or install from a side-effect module imported first).
      **Findings:** F-024, F-096.
      **Done:** 6 September 2026, roadmap 10.0a1: `DEMO_NOTICE` says
      the model tries to send and this page intercepts the request
      before it leaves the browser, and the seven echoes (README,
      MODEL_CARD twice, PROJECT, CONTRIBUTING, docs/UI.md, MANUAL item 52) say the same. README and MODEL_CARD now quote the constant
      verbatim, held by a test that collapses whitespace on both sides,
      so a reworded copy is a red build. The two pinning tests carry
      the new half. The install-order sentence is 10.1c's.

- [ ] **B4. `drozyGuard` watches one file while four of the seven DROZY
      rows depend on code that has since moved; the guarded caveat is
      now false.** `high · confirmed ×2 · M`
      **What:** `tools/drozyGuard.mjs:30` `SHAPE_SOURCE =
"src/core/blinkShape.ts"` is the only path asked about
      (`test/tools/drozyGuard.test.ts:121-151`); `blink.ts`,
      `blinkRate.ts` and the reducers moved after bd2a98d; blink
      duration (rho 0.444, `docs/drozy-result.txt:19-33`) and three
      others are presented as current-code numbers at
      `README.md:478-490`.
      **Fix:** a per-feature source map in `drozyGuard` requiring the
      caveat to name every feature whose sources moved since the
      measuring commit; reword `README.md:482-485` and
      `drozy-result.txt:26-28`; feed owner decision 10.3 the true
      stale list.
      **Findings:** F-020.

- [x] **B5. Generator tests freeze hard-coded prose: the report and
      README say the miss mechanism is unexplained while the record
      calls it a measured ceiling.** `medium · confirmed/high +
downgraded/medium · M`
      **What:** `tools/cannotSeeBlock.mjs:114`, `:121` emit "The
      mechanism is unexplained" as bare template text, pinned by
      `test/tools/cannotSeeBlock.test.ts:14-25` into `cannotSee.ts:19`,
      `:24`, `README.md:339-354`, `MODEL_CARD.md:140-155`;
      `docs/iris-occlusion.txt:121-129` and `ROADMAP.md:35` say
      otherwise; `tools/resultsBlock.mjs:233`, `:236` likewise.
      **Fix:** every generated sentence is a parse or an `assertQuote`
      (refuse claims with none); re-derive claim 1 from
      `iris-occlusion.txt`; delete `resultsBlock.mjs:233`, reword
      `:236`; rewrite `README:339-354` and drop the duplicate; a test
      that greps generators for unpinned sentence literals.
      **Findings:** F-021.
      **Done:** 6 September 2026, roadmap 10.0a3: every cannot-see
      claim now carries the exact sentences it rests on, the generator
      refuses to emit a claim with none, and the miss claim reads the
      ceiling count out of `docs/iris-occlusion.txt` and is pinned to
      "CEILING, not a tunable defect". The results block's limitations
      bullet was the one emitted line with no parsed value in it, so it
      now interpolates the alertness AUC and p value and the DROZY
      session count, and `unpinnedLiterals` reads the generator's own
      source and names any bullet that stops doing so. README's
      duplicated miss paragraph is one paragraph, and it states the
      mechanism. Two mutations reddened their tests: a claim stripped
      of its pins, and the bullet returned to a typed literal.

- [ ] **B6. The only cross-engine table was measured on pre-fix code and
      never re-run; the headline says "different browser binary" where
      the source says "WebKit binary".** `medium · confirmed/high +
downgraded/medium · S`
      **What:** `README.md:545-583` dates from 1de3ae4 (8 August,
      before #156's last-frame fix and #189's model-clock fix) and is
      inside the run-to-run noise the next PR removed;
      `tools/resultsBlock.mjs:233` → `README.md:45` and
      `MODEL_CARD.md:29` generalise `docs/eyeblink8-result.txt:170`'s
      two-WebKit-build reproduction to engine independence.
      **Fix:** date the table and state its provenance in one sentence,
      then either re-run on current code with both exports committed or
      demote it to a historical record; change "browser binary" to
      "WebKit binary" in the template and the card, regenerate, and
      add "no engine other than WebKit has measured this corpus"
      (C11 is the measurement).
      **Findings:** G-Browser-5, G-Browser-1.
      **Half done:** 6 September 2026, roadmap 10.0a1 — the dating
      half. The table now says it was measured 8 August 2026 on
      `1de3ae4`, names the two fixes that landed after it, and calls
      itself a historical record; the results block and the card say
      "WebKit binary" and add that no engine other than WebKit has
      measured this corpus. The re-measurement is roadmap row 13.0 and
      this item stays open until it runs.

- [x] **B7. SECURITY.md sends reporters to a private channel that is
      switched off.** `medium · confirmed live · S`
      **What:** `SECURITY.md:18-23` names the Security tab and forbids
      public issues; the API returns `private-vulnerability-reporting:
enabled false`.
      **Fix:** enable it and re-verify, or rewrite `:18-23` to the
      mailto already on the page (`main.ts:414`); record the
      verification date as `dependabot.yml` does.
      **Findings:** F-022.
      **Done:** 6 September 2026, roadmap 10.0a1: the private report
      is not enabled, so the section names the contact link the
      published page already carries and records the date the channel
      was last verified switched off, the dating rule `dependabot.yml`
      set. Enabling GitHub's private vulnerability reporting stays open
      to the owner; this file changes with it if they do.

- [ ] **B8. The UTA-RLDD result omits the pre-registered per-subject
      scores and coefficients.** `medium · confirmed ×2 · S`
      **What:** `docs/uta-rldd-plan.md:99-104`, `:125-131` promise both;
      `analyse_rldd.py:166-256` prints the per-subject table but
      `docs/uta-rldd-result.txt:44-56`, `:95-115` lack it; "weights
      load on long closures" (`STATE.md:571-574`) rests on an
      unidentified fold fit.
      **Fix:** standardised all-data coefficients and `--seed` /
      `--shuffles` flags in `format_report`; regenerate the result
      from stdout with the per-subject table.
      **Findings:** F-047.

- [ ] **B9. Alertness Bar 2 tests a joint-noise null and "about as good
      as a fitted one" is unsupported.** `medium · downgraded ×2 · S`
      **What:** `analysis/blinklab/alertness.py:401-413` computes
      `null_diff` with both AUCs against the same shuffled labels;
      `:304-312` is the bar; at n=95 it can clear only ~0.14 AUC;
      `docs/alertness-score-result.txt:20-23`, `:66-75`, `:94-95` read
      p 0.099 as equivalence.
      **Fix:** keep the pre-registered verdict; add a subject-level
      paired bootstrap or DeLong CI beside p 0.099; replace "not
      distinguishable" and "about as good" with "no evidence either
      way; detectable edge ~0.14 at this n"; pre-register before
      re-reading.
      **Findings:** F-013.
      **Half done:** 7 September 2026, roadmap 10.10c2. The reading is
      corrected: "not distinguishable from chance" and "about as good
      as a fitted one" both claimed a finding of no difference, and a
      control that can detect only about 0.14 AUC at this n never made
      one. Both now read as no evidence either way, with the detectable
      edge named. The paired bootstrap is roadmap 10.10c2b and needs
      the owner: it resamples by subject, the committed result file
      carries pooled AUCs only, and `compare_alertness.py` takes a
      measured corpus directory that is not in this repository.

- [ ] **B10. No headline result carries a confidence interval.**
      `low · confirmed/medium + downgraded/low · M`
      **What:** Wilson on 341/408 is [79.7, 86.9]; three-class balanced
      accuracy 0.498 sits in [0.42, 0.57]; nothing in
      `evaluate_eyeblink8.py:115-123`, `analyse_rldd.py:189-193`,
      `compare_alertness.py:58-61` computes one;
      `docs/eyeblink8-result.txt:5-7`, `README.md:45-48`,
      `MODEL_CARD.md:27`, `uta-rldd-result.txt:45`, `:69`,
      `alertness-score-result.txt:48-50`.
      **Fix:** Wilson intervals and subject-level bootstrap CIs in the
      three tools, printed beside the points; extend `resultsBlock` /
      `resultGuard` to carry them.
      **Findings:** F-046.
      **Half done:** 7 September 2026, roadmap 10.10c1. The Wilson half
      is in: `wilson_interval` in `analysis/blinklab/stats.py` and
      `wilsonInterval` in `tools/wilson.mjs`, held to one another by a
      committed table of cases both suites recompute. Recall and
      precision carry their intervals in the README and in
      `evaluate_eyeblink8.py`, and validation criterion 1 carries the
      bound its three sound sessions support. Two corrections to this
      item's own fix text. `resultGuard` needs no extension: the README
      block is generated from the result file's own counts and byte
      compared, so the published interval already cannot disagree with
      the counts beside it, and a second check through another door is
      the kind of restatement this ladder keeps removing. And F1 gets
      no interval: it is a harmonic mean of two proportions rather than
      a count over a count, so Wilson there would be arithmetic
      borrowed from a distribution it does not have. The bootstrap half
      is roadmap 10.10c2.

- [ ] **B11. Two statistical verdicts read stronger than their n.**
      `low · downgraded ×2 · S` - DROZY's within-subject bar (`analyse_drozy.py:66-94`,
      `:206-218`, 3 of 5 agreeing) passes by chance with p 0.5 and
      alone grants three "suggestive" verdicts
      (`docs/drozy-result.txt:36-43`, `:55-63`). Append the chance
      rate; require future bars with chance rate below 0.05. (F-049)
      **Done for the DROZY half:** 7 September 2026, roadmap 10.10c2.
      `binomial_at_least` computes it, the tool prints it beside every
      row from its next run, and the result file states it in prose
      with the rule for later bars, because regenerating that table
      would need a re-extract that recreates the derived video
      DATASETS.md requires destroyed. A test recomputes the rate from
      the counts the committed table already publishes. - Validation criterion 1 was judged on 3 sound sessions against
      an absolute bar of 3 misses (`docs/validation-plan.md:238-242`,
      `:420-433`, `docs/validation-round.txt:56-61`); `README.md:47`,
      `:66-68`, `MODEL_CARD.md:74-75` carry no n. Add "0 of 3 sound
      sessions; 95% upper bound ~56%"; express round-II criterion 1
      as a proportion with a minimum sound count. (F-050)

- [ ] **B12. Six measured bounds are known and unstated in the
      conditions sentences.** `low · confirmed · S` - PERCLOS counts blink frames; the literature's PERCLOS excludes
      them (`perclos.ts:3-7`, `:83`; `MODEL_CARD.md:172-177`,
      `test/MANUAL.md:44`, `drozy-result.txt:43`). State "includes
      blink time" in all three; the blink-excluded variant is C7.
      (F-029) - Peak velocity and A/V are biased 12-28% at 25-30 fps by the
      single finite difference (`blinkShape.ts:1-6`, `:84-96`;
      reproduced). State it in `blinkShape.ts` and MODEL_CARD;
      attach the sampling interval to each row; the fix is C6.
      (F-033) - `IRIS_DIAMETER_MM` (`constants.ts:10-12`) has no citation and
      no spread; `MODEL_CARD.md:30`. Cite MediaPipe Iris and one WTW
      study; add ±4%; row 10.7d with a ruler-vs-scale-bar
      prediction (owner). (F-034) - Aperture in mm is not pose-invariant inside the gate: pitch
      20° reads −6%, yaw 25° up to +12% (`constants.ts:196-203`,
      `aperture.ts:109-122`, `SPEC.md:137`). State the bound;
      optionally divide the chord by cos(pitch) after A24. (F-086) - The PERCLOS sampling bound excludes ordinary blinks the 40%
      line counts; "even at 15 fps" is ~2× understated
      (`samplingBounds.ts:25-28`, `:63-68`, `:142-149`,
      `docs/sampling-bounds.txt:25-27`, `:81-88`). Add a
      pre-registered blink term or scope the sentence to closures of
      0.3 s and longer; do not edit the existing table. (F-090) - The noise-floor median sits at two rounding quanta of the
      fixture's 1e-4 storage precision
      (`src/core/fixtureRecording.ts:35-39`,
      `docs/aperture-noise-floor.txt:49-50`, `:66-67`). Add the
      precision to the conditions block; record an unrounded fixture
      for 10.7b. (F-094)
      **Two of six done:** 7 September 2026, roadmap 10.10c4a. F-029 is
      stated in `perclos.ts` where the number is defined, in MODEL_CARD
      beside the threshold caveat it is larger than, and in
      `drozy-result.txt` where the null is read: this PERCLOS includes
      blink time, so at rest it is mostly blink time and inherits
      blink-rate variance. F-090 is scoped rather than recomputed: the
      simulation drew closures of half a second and longer, so the
      sentence now says so and names the blinks the share also counts,
      and the table is untouched because it measured what it measured.
      One correction to this item's own text: the scope is half a
      second, not 0.3, because `MIN_CLOSURE_S` is 0.5 and the honest
      statement is the range that was simulated. The velocity bound is
      roadmap 10.10c4b, the pose and precision bounds 10.10c4c, and the
      iris citation 10.10c4d, which needs the owner: a reference for
      the constant every millimetre on the page divides by must come
      from a source they have read, and inventing one would be worse
      than the silence it replaces.

- [x] **B13. "Reliable near the centre, degrades at the corners" is
      published with no measurement behind it.** `medium · downgraded ×2
· S`
      **What:** `MODEL_CARD.md:32` in the Result column beside
      externally validated numbers; `README.md:30`; flagged in August
      (`docs/audit/appendix-chunk-6-all-findings.md:803`), never
      remediated; 14.9 (`ROADMAP.md:244`) is the instrument.
      **Fix:** "not measured; quadrant-level target checked by the
      owner on one setup (MANUAL item 34)" in both places until 14.9
      produces a number; add the sentence to `resultGuard` /
      `claimGuard`.
      **Findings:** F-012.
      **Done:** 6 September 2026, roadmap 10.0a1: both sites say "not
      measured", name MANUAL item 34 as the only check that exists and
      row 14.9 as the instrument that would put a number on it, and a
      test holds the retired sentence out of both documents.

- [ ] **B14. One freshness PR: a dozen stale sentences under fresh
      stamps, plus the parser fix.** `medium · confirmed/medium +
downgraded/medium · M`
      **What:** the per-touch stamp certifies a touch, not a re-read
      (`tools/resultGuard.mjs:166-208`,
      `test/tools/resultGuard.test.ts:237-266`,
      `.github/pull_request_template.md:12`). Stale under fresh stamps:
      `README.md:9`, `:32`, `:34` ("no objective validation of the
      score yet"), `:595`; `ARCHITECTURE.md:93`, `:117`, `:130-137`;
      `MODEL_CARD.md:238-240`; `REMEDIATION.md:29-32`. Plus the small
      ones that belong in the same pass: - `MODEL_CARD.md:193` counts 8 clips as 8 people; the annotation
      carries no subject id (`docs/eyeblink8-preparation.txt:16-24`).
      Write "8 clips; number of distinct people not recorded in this
      repository", or count the subject folders and cite that.
      (G-Reproduc-8) - `MODEL_CARD.md:25-34`: a paragraph between table rows breaks
      five of six rows into text. Move it; re-run prettier. (F-101) - `MODEL_CARD.md:187-196`: tablets are in the goal and absent
      from every session. Name them untested. (F-103) - `MODEL_CARD.md:250-255`, `ADR-0002`: the sha pins the file to
      itself. Add origin URL, variant, fetch date and matched
      upstream hash. (F-099) - `ROADMAP.md:3` "one checkbox is one branch" is not what
      PRs #374-#403 did. Rewrite to what is true. (F-102, the taken
      half)
      **Fix:** re-read the three summary documents in full and correct
      each sentence; parse only the first stamp line; add a "Read in
      full on <date>" stamp; extend `resultGuard` with cheap literal
      pins (file count, phases complete vs ROADMAP, gate list vs
      `ci.yml`).
      **Findings:** F-062, G-Reproduc-8, F-101, F-103, F-099, F-102.

- [ ] **B15. `resultGuard` counts `it(` tokens: three documents publish
      952 unit tests while vitest reports 962.** `low · confirmed · S`
      **What:** `tools/resultGuard.mjs:101-130` counts source tokens;
      loops at `test/core/rulerFit.test.ts:56-57` and
      `blinkClosedForm.test.ts:112-113` emit ten more; `README.md:595`,
      `STATE.md:18`, `ARCHITECTURE.md:18`.
      **Fix:** count from the runner and assert static == runtime, or
      say "about 950"; scope number checks to their section.
      **Findings:** F-059.

- [x] **B16. SPEC's "kept current" contract is two fields, two states
      and ~34 metadata keys behind.** `medium · confirmed ×2 · S`
      **What:** `SPEC.md:18-38` omits `baselineOverResting` and
      `pupilDiameterMm` (`featureRecord.ts:41`, `:55`, `csv.ts:27-36`);
      `SPEC.md:121-127` omits two `CameraState`s
      (`cameraState.ts:1-31`); `SPEC.md:77-79` documents 8 of ~42
      metadata keys (`sessionMetadata.ts:116-118`) and none of the
      ones the pilot verdict and round-2 rules read.
      **Fix:** update the ts block and state table; add "### The
      session metadata block" as a table (key | when written | value
      format | which reader consumes it); D6's contract test then
      asserts the SPEC key list equals `declared_keys()`. Pull 12.15
      forward.
      **Findings:** F-066, G-export/l-8.
      **Done:** 6 September 2026, roadmap 10.1f1: SPEC.md's ts block
      gains `baselineOverResting` and `pupilDiameterMm` and is now held
      to the CSV columns, which are the record's own field set; the
      state table gains `ended` and `cameraStopped`; and "### The
      session metadata block" is a 57-row table of key, when written,
      value format and reader, held to the writers from both languages.
      Three corrections to this item's own numbers: the keys are 57 not
      ~34, six modules write them not one, and `csv.ts` writes none of
      its own today.

- [ ] **B17. CHANGELOG's living Unreleased section publishes the
      superseded 87.7/83.3/85.4 figure outside every guard.**
      `low · downgraded · S`
      **What:** `CHANGELOG.md:15-25`, `:35`, `:53-55`, `:71-75`
      (stamped 15 August at `:3`, which is why the stamp guard is
      satisfied); `README.md:95-100` supersedes it; the guard does not
      read the file (`test/tools/resultGuard.test.ts:107`, `:176-180`).
      **Fix:** add `CHANGELOG.md` to the doc arrays; rewrite the
      Unreleased bullet with the current figures and the right count
      of superseded runs, or replace the numbers with a pointer to the
      generated README block; derive "Six checks" from disk or drop it.
      **Findings:** F-065, G-Build d-5.

- [x] **B18. The shipped notice attributes MediaPipe 1.0.0 (the page
      ships 1.0.1) and paraphrases the font licences; no test reads
      either half.** `medium · downgraded ×2 · S`
      **What:** `public/THIRD_PARTY_LICENSES.txt:11` vs
      `package-lock.json:344`; `MODEL_CARD.md:253` is right because
      `modelProvenance.mjs` recomputes it; `:90-92`, `:94-139` summarise
      the OFL where `:22` promises verbatim;
      `test/tools/licenses.test.ts:20-40` checks names only.
      **Fix:** `expect(notice).toContain(\`@mediapipe/tasks-vision
      ${lockfileVision(root).version}\`)`; correct line 11; paste the
OFL text and the three upstream copyright lines from
`node_modules/@fontsource/*/LICENSE`; assert "SIL OPEN FONT
LICENSE Version 1.1", "PREAMBLE" and each family
`src/styles.css:21-27`imports.
**Findings:** G-Build d-2, G-Build d-6.
**Done:** 6 September 2026, roadmap 10.0a2: the notice
attributes 1.0.1, held to`lockfileVision(root).version`rather
than to a typed number, and carries the OFL 1.1 verbatim with a
copyright line per family. The test reads the families out of
 `src/styles.css`, so a fourth typeface with no attribution is a
      red build.

- [x] **B19. The idle page asserts a measurement in progress, and the
      short caveat no longer sits beside the score.** `medium · confirmed
×2 (F-077); confirmed/high + downgraded/low (F-026) · S`
      **What:** `main.ts:4471-4495` seeds "Alertness score:
      measuring...", "Nothing is costing points.", "Blinks: 0" at load
      and `render()` (`:841-934`) never hides a box;
      `demoNoticeShort()` (`notice.ts:38-45`) is dead code, the comment
      at `:3869-3874` says the caveat travels with the number, and
      `box("Alertness", ...)` at `:4315` renders none.
      **Fix:** idle strings that say "not measuring", applied in
      `render()` when not running; re-add `p.caveat` under `scoreLabel`
      with an e2e that `#box-alertness` contains "not a safety or
      medical device" (or retire the rule honestly: delete the
      constant and its tests, rewrite `docs/UI.md:220-231`,
      `:527-529`, `LEARNING.md:500`, `MANUAL.md:64`); update UI.md.
      **Findings:** F-077, F-026.
      **Done:** 6 September 2026, roadmap 14.0b: the idle table in
      `core/idleStrings.ts` ("not measuring", never "measuring..." or
      "Blinks: 0"), seeded at load and re-applied whenever nothing runs
      and nothing is kept; the caveat is back under the score, pinned
      by an e2e on `#box-alertness`; uiGuard now holds docs/UI.md to
      every button label and every idle string.

- [ ] **B20. The guided-calibration refusals blame the person's eyelids
      for what is most likely reading time or a low-held phone.**
      `medium · downgraded ×2 · S`
      **What:** `main.ts:1766`, `:1768`, `:1770` ("This is the same
      limit the corpus showed") are unconditional; `stabilityMm` is
      null under the pose gate, so a phone below eye level starves the
      sample floor and is told to fix lighting.
      **Fix:** make the text conditional on what the run saw: report
      sample counts and pose rejections; "hold the camera closer to
      eye level" when rejections dominate; "the closure came late, try
      again and close as soon as the tone sounds" when the closed
      phase's first second reads open; reserve the corpus-ceiling
      sentence for plentiful, unseparated closed samples.
      **Depends on:** E3 (the tone).
      **Findings:** G-Guided b-3.

---

## Stage C. Accuracy levers, each with the harness that proves it

- [ ] **C1. Ask the camera for 60 fps and record what it can do; fold
      in the dim-room session.** `medium · confirmed/high + downgraded
· S · owner`
      **What:** the only `getUserMedia` call (`src/io/camera.ts:28-32`)
      constrains width/height/deviceId; nothing in `src/` calls
      `getCapabilities` or `applyConstraints`. Whether live blink
      accuracy is capped at 30 fps on every owned camera
      (`docs/blink-sample-rate.txt:176-178`, `:230-237`, `:661-666`;
      `docs/validation-dry-run.txt:53-59`, `:103-106`) is undecided
      and 13.2 (`ROADMAP.md:220-221`) sits ~26 rows back.
      **Fix:** read capabilities, `applyConstraints({frameRate:
{ideal: 60}})`, record declared max, negotiated rate and any
      resolution change in the export; one deliberate dim-room session
      so A16's pre-registered rule has its observation; move 13.2 to
      the front (before 11.1), then 13.4, then 13.8 (A2).
      **Harness:** per owned camera: declared max, negotiated rate,
      `sampled_fps`; on the one camera that negotiates above 30, the
      ten-blink protocol (or C4's cues) at 30 and 60 with the catch
      count compared against `blink-sample-rate.txt`'s sweep.
      **Findings:** F-025 (A16's precondition).

- [ ] **C2. Place the guided line from the measured gap, give PERCLOS
      and long closures a personal shut line, and name the two
      duration quantities.** `high · confirmed ×2 · M · corpus rule`
      **What:** guided line = (open+closed)/2
      (`guidedCalibration.ts:111`); passive = 0.5 × p90
      (`baseline.ts:107-111`, `constants.ts:152`); fully shut eyes read
      about a third of baseline and droop 45-50%
      (`longClosure.ts:28-33`), so the guided line sits above the
      passive one and "blink duration" is two quantities differing
      30-50% in one column (`blink.ts:106-113`, `blinkLog.ts:89-97`,
      `score.ts:41-48`); for the atypical case the guided line was
      built for, calibrating makes droop-reads-closed worse
      (`docs/blink-line-adoption.txt:86-93`,
      `docs/validation-dry-run.txt:203-228`). `EYES_SHUT_FRACTION =
0.4` (`longClosure.ts:21-35`, `perclos.ts:11-27`) is one face on
      one camera; a face whose floor is 0.45 B gets PERCLOS 0 forever
      while its measured floor (`guidedCalibration.ts:115-122`) sits
      unused (`main.ts:3529`, `:3683-3697`, `:3755-3760`).
      **Fix:** pre-register k from the noise floor; guided blink line
      and guided shut line both as `closed + k × (open − closed)`;
      adopt the shut line when a guided line exists and let it lift
      the PERCLOS/long-closure refusal as it does for blinks; record
      `shutBaselineMm`'s source; name the two duration quantities;
      write the floor-shift arithmetic as a committed 10.9 candidate.
      **Harness:** the owner's recorded droop session through both
      lines, published; the floor-shift prediction tested from
      existing `shutBaselineMm` / `apertureMm` columns of the dry-run
      exports; the P80 dry-run phone trace giving nonzero PERCLOS
      under its own floor; Eyeblink8 unchanged (no stored line on a
      clip).
      **Depends on:** A8, A9.
      **Findings:** F-005, F-030.

- [ ] **C3. Verify the stored line against three real blinks before
      announcing "your detector uses it now"; then measure the
      procedure on people.** `medium · confirmed/high + downgraded · M
· owner`
      **What:** `calibrationSessionStep` goes straight to done
      (`guidedCalibration.ts:240-243`); `main.ts:3462-3492` stores and
      announces (`:3480`) with no test on the event the line exists to
      detect. The pending regression run can only establish that the
      guided path was not reached
      (`docs/blink-line-adoption.txt:95-103`, `:107-123`), and
      `test/MANUAL.md:66` describes pre-adoption behaviour.
      **Fix:** after a ready resolve keep the overlay for "blink three
      times, normally" with the reducer's live count; store only if it
      caught at least two; otherwise show the separation and offer a
      retry (a failed verification is a refusal). Add a roadmap row
      that logs caught/missed per calibrated person with the
      separation ratio and sample counts, pre-registered bar, placed
      beside D10's regression run; correct MANUAL item 66.
      **Harness:** the verification outcome itself, exported per
      session (A8's rows), over the owner's devices first.
      **Depends on:** A8, A9.
      **Findings:** G-Guided b-5, G-Guided b-10.

- [ ] **C4. A cued ground-truth capture tool, so live claims stop
      resting on the contaminated count-ten protocol.** `low ·
confirmed/medium + downgraded · M`
      **What:** `docs/participant-instructions.md:55-59`;
      `docs/validation-round.txt:102-104`, `:181-200` record the
      contamination; 10.9, 11.6, 13.3 (`ROADMAP.md:175`, `:188`,
      `:221`, `:240`, `:248`) would inherit it; the overlay pattern
      exists (`src/core/lightSchedule.ts:22-29`).
      **Fix:** row 11.0a (pure cue schedule and scorer with refusals)
      and 11.0b (overlay and export rows); per-event caught / missed /
      latency; re-point 10.9, 11.6, 13.3, 14.5.
      **Harness:** it is the harness: catch rate and latency per
      device at zero privacy cost; C1's 30-vs-60 comparison and A7's
      phone check run on it.
      **Findings:** F-071.

- [ ] **C5. Droop-then-blink and re-crossing blinks: time the closed
      phase from the arm line, report fragmented durations honestly.**
      `medium · confirmed ×2 (F-039); confirmed/medium + downgraded
(F-038) · M · corpus rule`
      **What:** `blink.ts:100` latches `closedAtMs` at the droop's
      first sub-line frame so a 533 ms droop plus a 100 ms blink is
      refused for length, and `longClosure.ts:85` refuses it for depth:
      the drowsy phenotype vanishes with no event
      (`docs/max-blink-duration.txt:154-158`). `blink.ts:106-113`,
      `:136-140` report the first fragment's duration, so a slow
      reopener reads fast (`docs/blink-rearm.txt:11-14`).
      **Fix:** time the closed phase from the arm-line crossing or emit
      a "refused: over-length" event class; report first sub-line
      frame to the reopen that clears the re-arm line (or fragment
      and envelope) with a `fragmented` flag; consider arming on
      closing velocity (A14).
      **Harness:** pre-register against Eyeblink8's 9 long-closure
      misses (`docs/evidence/2026-08-21-rearm/eyeblink8_misses.csv`)
      and the dry-run traces; D10's regression run scores it; the
      probe traces from the review (Probe C, Probe D) become pinned
      unit tests.
      **Depends on:** A7, A19, D10.
      **Findings:** F-039, F-038.

- [ ] **C6. Fit a quadratic through the three steepest samples for peak
      closing velocity.** `low · reproduced · S · corpus rule`
      **What:** the single finite difference over a 33-40 ms gap reads
      an 80 ms close at 81-88% of true peak at 25-30 fps and inflates
      A/V ×1.12-1.20 (`blinkShape.ts:84-96`, `score.ts:50-56`).
      **Fix:** quadratic through the three steepest samples; attach the
      sampling interval to each row.
      **Harness:** the raised-cosine sweep at 25/30/60 fps committed
      beside `blink-sample-rate.txt` (predict < 5% residual bias at
      25); 12.8's check pinned at all three rates; DROZY/RLDD velocity
      rows re-caveated through B4's map.
      **Depends on:** A2, B12's statement.
      **Findings:** F-033.

- [ ] **C7. Export a blink-excluded PERCLOS beside the current one.**
      `medium · confirmed ×2 · M`
      **What:** every sub-line sample is closed (`perclos.ts:83`); at
      rest PERCLOS IS blink time and inherits blink-rate variance; the
      40-point weight (`score.ts:28-34`) rests on a literature that
      validated the other quantity.
      **Fix:** a second accumulator excluding closures shorter than
      `MAX_BLINK_DURATION_MS`; both columns exported; both carried into
      12.10.
      **Harness:** DROZY and RLDD refit with each variant from the
      retained CSVs (rho and AUC side by side); the score keeps the
      current one until 12.10 reads.
      **Findings:** F-029.

- [ ] **C8. Two RLDD refits over numbers already on disk: drop the three
      shape features; add a within-subject null and paired share.**
      `low · confirmed/medium + downgraded · S + M`
      **What:** duplicated frames scale velocity and A/V by exactly the
      duplication factor per video (`blinkShape.ts:83-95`), a
      recording-artefact route into the positive at
      `docs/uta-rldd-result.txt:112-120` not covered by the four
      leakage checks; `rldd.py:539-543` and `alertness.py:404-406`
      permute labels globally although the design is one video per
      state per subject (`docs/uta-rldd-plan.md:189-192`,
      `docs/alertness-score-plan.md:163-170`), while the docs call the
      per-person question unanswerable (`MODEL_CARD.md:34`).
      **Fix:** a fifth verification refitting without the shape
      features; pre-register then run within-subject permutation as a
      second null plus the paired share of subjects whose drowsy video
      scores drowsier, sign-test p and CI, reported beside the
      cross-subject numbers.
      **Harness:** the retained per-video CSVs; minutes of compute;
      either way the result is scored.
      **Findings:** G-Stepped-5, F-048.

- [ ] **C9. Gaze profile context and one definition of "off screen".**
      `medium · downgraded ×2 · M`
      **What:** the profile is four numbers
      (`calibrationProfile.ts:18-21`, `calibrationStore.ts:163-170`)
      solved in viewport fractions (`calibrationCapture.ts:17-28`,
      `main.ts:1643-1647`), loaded unconditionally (`:1627`), gated by
      the ±20/25° aperture limits (`validityGate.ts:31`,
      `constants.ts:196-203`) that are ~10× too loose for gaze; the
      exported `onScreen` uses the raw ±0.18 box
      (`gazeQuadrant.ts:32-37`, `main.ts:3220`, `:3837`) even when a
      profile exists, and `heatmap.ts:30` uses a third rule.
      **Fix:** store median pose, median iris px, viewport, DPR, screen
      and camera with the profile; null the calibrated point beyond
      ~5° or ~10% iris width with "head moved since calibration";
      refuse or flag on a different window/camera; with a profile,
      on-screen means the calibrated point within the margin; export
      `gaze_calibrated` and the threshold; say "window" not "screen".
      **Harness:** 14.9 logs the pose delta beside every error sample
      so drift and movement separate; the fixture pins the on-screen
      definitions agreeing.
      **Depends on:** A23, A24; lands with D12's reorder (14.9 before
      12.11-12.13).
      **Findings:** F-011, F-043.

- [ ] **C10. Engine agreement on a fixed clip: one commit, one machine,
      one prepared clip, two engines, paired.** `low · downgraded ×2 ·
M · owner`
      **What:** no roadmap row names the engine (`grep -ci engine
ROADMAP.md` is 0); Phase 13's phone rows (`ROADMAP.md:219-223`)
      will confound iOS/WebKit with Android/Chrome, repeating the dry
      run's ambiguity (`docs/validation-dry-run.txt:138-150`) on the
      unexplained 96 vs 149-166 ms duration gap.
      **Fix:** a row before 13.1 following the m5max template
      (`docs/eyeblink8-m5max.txt:27-40`) with the three outcome classes
      committed before the run; a precondition of 13.1.
      **Harness:** identical counts confirm engine-independence for the
      clip; a few blinks moving with identical coverage is the
      cross-engine numeric bound the project lacks; coverage differing
      stops the line. Decides D17's question of which engine the
      runner should use.
      **Findings:** G-Browser-6.

- [ ] **C11. `closureFraction` and a complete/incomplete label at the
      arm line.** `low · confirmed/medium + downgraded · S`
      **What:** 12.6 (`ROADMAP.md:201`) classifies on duration only;
      the detector's own misses are defined by depth
      (`docs/miss-character.txt:263-264`, min_ratio 0.91-0.996 against
      an arm line at 0.9 × line); the 1.5 mm grey line
      (`docs/validation-dry-run.txt:85-87`) is a different ruler per
      face (`blinkLog.ts:89-97`).
      **Fix:** 12.6b: `closureFraction = amplitude / frozen baseline`
      plus the label; retire the absolute grey line.
      **Harness:** the committed miss table's min_ratio distribution
      reproduces from the new column; 12.14/12.18 riders name it.
      **Findings:** F-076.

---

## Stage D. Process and guards

- [ ] **D1. The evaluator that produces 83.6% has zero tests; its three
      deliberate properties can be deleted with CI green.**
      `high · confirmed ×2 (mutations survived) · M`
      **What:** `analysis/tools/evaluate_eyeblink8.py:14-26`, `:73-98`,
      `:145-161`, `:166-179`; `analysis/tests/` names it nowhere; the
      analysis job (`.github/workflows/ci.yml:99-113`) stays green with
      the watched-mode skip, the coverage marker and the glasses split
      all removed.
      **Fix:** `analysis/tests/test_evaluate_eyeblink8.py` over
      `collect()` and `report()` with `tmp_path` fixtures: a
      watched-mode log is skipped visibly; a > 1% coverage gap emits
      the marker; a missing `frames_measured` header does NOT pass; the
      glasses split appears with its wording; pin the literal 0.01 / 5
      thresholds and A12's new refusals.
      **Findings:** G-Reproduc-2.

- [x] **D2. Refusal-threshold constants survive mutation; the mutation
      runner has been unrunnable since 20 August.** `high · confirmed ×2
(reproduced on scratch copies) · S`
      **What:** `MIN_BLINK_FPS` bends to 23, 24, 28, 30 and six other
      floors (`constants.ts:123`, `:140-141`, `:150`, `:166`;
      `perclos.ts:33-45`) move an order of magnitude with 962 green;
      the tests derive probes from the constants
      (`test/core/fpsGate.test.ts:23-27`, `:133-137`,
      `sessionVerdict.test.ts:96-99`, `blinkRate.test.ts:33-44`,
      `baseline.test.ts:51-56`, `perclos.test.ts:170-178`,
      `guidedCalibration.test.ts:31`, `:69-81`).
      `tools/mutationCheck.mjs:95-100`, `:155-165` bend
      `BASELINE_RISE_MIN_SAMPLES`, removed by 171b5f4;
      `REMEDIATION.md:155-172` says the check is runnable.
      **Fix:** one literal boundary probe per constant in its owning
      file (24.9/25/25.1; 59.9/60/64.9/65; 14 999/15 000 ms; 99/100
      samples; last+2000/2001; 29/30); drop the RISE entries, add
      these, make each entry run only the test file it expects to
      redden, derive the header count from the array, run it in CI,
      add a PR-template line.
      **Findings:** F-018, F-019.
      **Done:** 6 September 2026, roadmap 10.1c: literal boundary
      probes in each owning test (24.9/25/25.1; the 60/65 hysteresis
      pair in both directions including the held middle; 14 999/15 000
      ms; last+1999/2000/2001; 99/100 samples; 29 999/30 000 ms; 29/30
      guided; 20 and 25 degrees on the pose axes; 149/150 ms on the
      refractory). The RISE entries are gone, six entries for the
      frame-rate and guided constants are added, each entry names the
      one test file that must go red, and the whole list runs in CI in
      about two minutes. Narrowing the entries turned 10 of the 27
      from caught into SURVIVED before those two owning tests were
      fixed, and two entries had been pointed at the wrong file.

- [ ] **D3. Commit the anchor run's inputs and bind the committed miss
      table to the numbers it reproduces.** `medium · confirmed ×2 ·
M · owner (the eight logs)`
      **What:** `git ls-files | grep blinks.csv` returns four files of
      one clip from the superseded 9 August run; the anchor run
      (65e8e7c, `docs/eyeblink8-result.txt:34-39`, `:297`) has no
      committed input, and precision has no artefact naming the 65
      invented detections; `.gitignore:51-54`; the ruling at
      `DATASETS.md:394-403` already covers the artefact class.
      `docs/evidence/2026-08-21-rearm/eyeblink8_misses.csv` reproduces
      the miss column of `eyeblink8-result.txt:10-18` exactly and
      nothing in CI checks it (`resultGuard.mjs:74-77`).
      **Fix:** commit the eight `<clip>.blinks.csv` of the anchor run,
      the 408-row derived annotation table and the 65-row false-alarm
      table under `docs/evidence/<date>-anchor/`; a pytest running
      `collect()/report()` over them asserting the published strings
      verbatim (341/408, 65, 83.6/84.0/83.8, per-clip rows, glasses
      rows, coverage pairs); a ~20-line pytest asserting 67 rows,
      per-clip counts and 47/67 = 70.1% against the sentence
      `resultGuard` keys on.
      **Depends on:** D1 (the test file), A1 (a clean re-run if the
      logs are not to hand).
      **Findings:** G-Reproduc-1, G-Reproduc-7.

- [ ] **D4. The ratchet watches the browser half of the number only, its
      caveat is satisfied by a sha anywhere in the file, and the engine
      is pinned by nothing.** `medium · confirmed ×2 · S`
      **What:** `DETECTOR_SOURCES` (`tools/detectorRatchet.mjs:37-60`)
      is 16 core files plus the model and `landmarker.ts`; the scorer
      (`analysis/blinklab/blink_match.py:33`, tolerance pinned by no
      literal, `test_blink_match.py:22-27`), the evaluator, the runner
      (`tools/measure_corpus.mjs:51-56`, `:128` `webkit.launch()`), the
      stepper (`videoStepper.ts:245-367`), the gate wiring
      (`main.ts:3517-3573`) and `package-lock.json` are outside;
      `:146-148` matches the sha against the whole file; Dependabot
      groups `@playwright/test` (`.github/dependabot.yml:16-24`).
      **Fix:** add `blink_match.py`, `blink_log.py`, `eyeblink8.py`,
      `evaluate_eyeblink8.py`, `measure_corpus.mjs`, `videoStepper.ts`,
      `package-lock.json` and (after D3) the committed inputs; check
      the sha inside the caveat block; extract the gate wiring into
      core (D7); pin `DEFAULT_TOLERANCE_FRAMES` with a 4-matches /
      5-does-not pair; `modelProvenance.mjs` pins `@playwright/test`
      from the lockfile and the engine identifier from
      `measure_corpus.mjs` as MODEL_CARD lines; Playwright gets its own
      Dependabot entry; browser and Playwright version in the
      reproduction block at `eyeblink8-result.txt:34-39`.
      **Findings:** F-058, G-Reproduc-6, G-Browser-2, G-Build d-3.

- [x] **D5. GitHub Pages publishes four minutes before CI finishes and
      would publish a red merge.** `medium (downgraded/low once) · S`
      **What:** `deploy.yml:3-6` is `on: push: branches: [main]`; build
      (`:23-36`) runs only `npm ci` and `npm run build`; every guard
      (`ci.yml:50-92`) runs in a workflow with no power to stop the
      publish.
      **Fix:** `on: workflow_run: {workflows: [CI], types:
[completed], branches: [main]}` plus `workflow_dispatch`, guarded
      by `conclusion == 'success'`; pass `ref:
${{ github.event.workflow_run.head_sha }}` to checkout and set
      `GITHUB_SHA` in the build env, because `vite.config.ts:18` reads
      it for the E2 provenance stamp.
      **Findings:** G-Build d-1.
      **Done:** 6 September 2026, roadmap 10.1e: the deploy triggers on
      `workflow_run` of CI, completed, on main, plus
      `workflow_dispatch`, and the build job is guarded on
      `conclusion == 'success'` — without that guard the change would
      have been worse than the defect, since `types: [completed]` fires
      on failure and cancellation too. Checkout takes
      `github.event.workflow_run.head_sha` and the build step sets
      `GITHUB_SHA` to the same value, so the page's provenance stamp
      names the commit it was built from rather than the branch tip. A
      new `tools/deployGuard.mjs` reads both workflow files and holds
      all of it, including the CI workflow's own name, since a rename
      on one side alone would stop every deployment silently.

- [ ] **D6. A metadata contract across the language border: the ~42
      keys have no documented contract, no cross-language test, five
      absence policies, two unread honesty rows, and hand-written
      fixtures that have already drifted.** `medium · confirmed ×2
(l-8, l-9); downgraded (l-2, l-3, l-4, l-5) · M`
      **What:** only the 18 columns are tested
      (`analysis/tests/test_csv_contract.py:18-20`, `:99-118`); a
      renamed key leaves 962 + 376 tests green and turns a Python gate
      into a pass-through; `verdict.py:240-247` refuses a missing key,
      `blink_log.py:56-63`, `validation.py:63-77`, `round2.py:163-168`,
      `validation_checks.py:432-441` default; `feature_records_dropped`
      (`sessionMetadata.ts:399-423`, `main.ts:2367-2371`) has no reader
      (`loader.py:99-127`); `app_commit` and `protocol`
      (`sessionMetadata.ts:345-356`) are read by nothing, so a table
      can mix builds; `test/fixtures/verdict/*.csv` carry
      `# kss_before: 3` where `kss.ts:44-53` can only write
      `3 (Alert)`, and hold no boundary value.
      **Fix:** `test_metadata_contract.py` in the shape of
      `test_csv_contract.py` (regex `line("...")` and `# key:` out of
      the five TS writers; a hand-written EXPECTED_WRITTEN; a
      READ_BY_PYTHON list; a grep that every `metadata.get("...")`
      literal is in it); split keys into REQUIRED and CONDITIONAL with
      written presence rules, `loader.py` refusing a missing REQUIRED
      key, every CONDITIONAL default explicit at its read site,
      `round2._number` aligned with `verdict._finite`; carry
      `records_dropped`, `app_commit`, `protocol` on `Session` and have
      `validation_report.py`, `pilot.py`, `analyse_drozy.py`,
      `analyse_rldd.py` print the distinct commit set and refuse or
      state a mix; generate the verdict fixtures from
      `serializeRecords` with the real row builders (`main.ts:2341-2392`)
      and add 24.96 / 59.96; B16's SPEC table asserted equal to
      `declared_keys()`.
      **Depends on:** A3, B16.
      **Findings:** G-export/l-2, G-export/l-3, G-export/l-4,
      G-export/l-5, G-export/l-8 (guard half), G-export/l-9.
      **Half done:** 6 September 2026, roadmap 10.1f1 and 10.1f2.
      `analysis/tests/test_metadata_contract.py` and
      `tools/metadataKeys.mjs` read the keys out of the six writers from
      both languages and hold them to a hand-written list and to
      SPEC.md's table. Three corrections to this item's own fix text,
      each of which would have produced a reader that passed while
      reading almost nothing: the writers are six, not five; a
      `line("...")` regex misses the thirteen calls that wrap across
      lines, `sampled_fps` among them; and `# key:` appears in the
      comments that describe the format, so a reader that does not strip
      comments reports a key called `key`. Renaming `sampled_fps`
      reddened only the Python side until the TypeScript reader was
      added. Then 10.1f2 gave the three honesty rows their readers:
      `Session` carries `app_commit`, `protocol` and `records_dropped`,
      an unreadable dropped-row count is refused at load rather than
      defaulting to zero, and `cohort_commits` with `cohort_commit_line`
      say whether a table describes one instrument, several, or a set of
      files that predate the build stamp, printed above the round
      report's tables. `validation_report.py` had no test file of its
      own, so one was written. A fourth correction: `analyse_drozy.py`
      and `analyse_rldd.py` analyse DROZY and UTA-RLDD feature records
      rather than browser exports, so they carry no `app_commit` at all
      and a commit line there would promise a field that cannot exist.
      Then 10.1f3 split the keys by WHEN they are written: 21 that
      every export carries and 36 written only when the thing they
      describe happened, with SPEC.md's column exercised against the
      real row builders rather than described from reading them. That
      exercise found seven drifts in a column written four hours
      earlier, six of them one mistake: `line()` writes `unknown`
      rather than dropping a row, so a value that may be unknown had
      been described as a row that may be absent. A fifth correction to
      this item's own text follows from that: the split is not
      REQUIRED and CONDITIONAL as written here but always-written and
      conditional, because a key can be unconditional in the file and
      still say `unknown`, and a loader that refused an `unknown` value
      would refuse most healthy sessions. Then 10.1f4 gave every read
      site a stated absence policy and exercised it: nineteen readers,
      each called with a block it can read and then with the same block
      minus one key, and three kinds of answer named in words — a
      default where absence means the thing did not happen, an unknown
      where the analysis cannot answer that one question, a refusal
      where the file is not what it claims to be. `round2._number` and
      `verdict._finite` each name the other and say why they diverge.
      One reader's stated policy was the writer's opposite:
      `Session.records_dropped` said the row was on every export, so a
      missing key meant an older build, while the exporter writes it
      only when rows were dropped. A sixth correction to this item's
      own text: `loader.py` cannot refuse a missing always-written key
      without abandoning files this repository still reads. Its own
      committed session fixture carries two metadata keys of 57 and is
      loaded by two test modules, and the validation round's six files
      predate most of the block. Which generations the analysis track
      still accepts is the owner's decision, and it is roadmap row
      10.1f4b rather than a choice a test makes on their behalf. Then
      10.1f5 replaced the hand-typed verdict fixtures: each session is
      described once and both sides of the pin are derived from it, the
      CSV through the twelve row builders the page calls at export and
      the page-state inputs through the real rounding and a replay of
      the real ruler-fit accumulator. The mutation was run both ways.
      Renaming `pose_valid_fraction` now reddens all four fixture byte
      comparisons where before it left the whole pin green, and
      regenerating the fixtures under that rename reddens five Python
      tests, which is the mirror refusing to reproduce the committed
      verdict from bytes that lost a key. Two drifts beyond the one
      this item names: the files carried bare newlines where the
      exporter writes CRLF, and a header two columns behind. Then
      10.1f6 added the 59.96 fixture this item asks for and found that
      the boundary work of 10.15 had been half done: the refusal floor
      at 25 was pinned, the risk threshold at 60 crosses on the same
      rounding in the same way and was pinned nowhere. Handing the page
      the raw rate now reddens both boundary fixtures rather than one.
      The Python byte pin stopped naming its fixtures in the same
      increment and reads them off disk, because the other side now
      generates them and a fixture added there could otherwise be
      pinned on one side only. This closes D6 apart from the loader's
      floor, which is 10.1f4b and the owner's to decide.

- [ ] **D7. No automated test ever sees a face; the gate wiring in
      `processFrame` sits outside every coverage floor.**
      `medium · confirmed ×2 · M`
      **What:** `playwright.config.ts:3-11`, `test/fixtures/README.md:5-7`
      and `test/e2e/calibrationBlinks.spec.ts:6-14` say so in their own
      words; `main.ts:3559-3573` (the refusal wiring) is out of scope
      of `vitest.config.ts:28-38`; CI goes green with blink counting,
      aperture, PERCLOS and the fps refusal broken in the wiring.
      **Fix:** a DEV-only landmark-injection hook fed `session-01.json`
      or a scripted blink so an e2e asserts "Blinks: 2" and the 25 fps
      refusal; extract `blinkFeed` / `shutLineFeed` into `src/core`
      under the floor and the ratchet (D4); make the branch floor a
      ratchet (current − 0.5, raised on green runs).
      **Depends on:** A2 (the driver), A17.
      **Findings:** F-060.

- [ ] **D8. Clip exports drop the machine rows, and the executed
      delegate is unrecorded for every corpus run.** `medium · confirmed
×2 (l-4); downgraded ×2 (Browser-3, F-108) · S + M`
      **What:** `sessionMetadata.ts:120-126` returns only `camera: none`
      when `info` is null, so `user_agent`, cores, DPR never reach a
      clip export (`main.ts:1119`); every committed evidence CSV is
      unfalsifiable at the engine level
      (`docs/evidence/2026-09-02-awake-autopsy/README.md:11-18`).
      `landmarker.ts:12` hard-codes GPU with no CPU retry
      (`main.ts:1505-1522`, `:1532-1548`); CI runs CPU
      (`test/e2e/videoFile.spec.ts:106-107`); whether the corpus ran GPU
      or CPU is unknown (`MODEL_CARD.md:262-266`, `ROADMAP.md:223`).
      **Fix:** camera rows conditional, machine rows unconditional;
      pull 13.5's webgl2 probe forward and make it unconditional
      (delegate request and probe result as export rows, clip mode
      included), amend 13.5's Check; retry once on CPU when the GPU
      load rejects; correct the MODEL_CARD sentence; one line in
      `eyeblink8-result.txt`'s run header ("unknown, probe added after
      this run" if unrecoverable).
      **Findings:** G-Browser-4, G-Browser-3, F-108.

- [ ] **D9. A `connect-src 'self'` Content-Security-Policy closes the
      named residual risk at the network layer; the recorded objections
      do not survive the bundle.** `medium · confirmed ×2 · M`
      **What:** `SECURITY.md:38-42` and `ADR-0004:79-82`, `:109-112`
      call a CSP impossible; `vision_bundle.mjs`'s sender is a plain
      `fetch` in an `AbortController` with a `catch`, so a blocked
      request cannot stall the model; `index.html:3-7` has no policy;
      Dependabot proposes `tasks-vision` bumps weekly and a transport
      change is caught only by the 70 s e2e.
      **Fix:** add the meta CSP; run the full e2e including WebKit
      stepped clips; add `blob:` allowances only if needed; correct
      SECURITY.md and append to ADR-0004; keep the wrapper
      (`src/io/telemetryBlock.ts:7-8`).
      **Findings:** F-063.

- [ ] **D10. Row 10.8a, a regression run at HEAD, with the replay tool
      committed first.** `medium · confirmed ×2 (F-037 third path
probed) · M · owner`
      **What:** the '5 armed_then_dropped = re-arm/refractory' diagnosis
      (`docs/miss-character.txt:247-276`) rests on
      `crossed_line_gate_attribution.csv`, produced by no committed tool
      (`analysis/tools/miss_autopsy.py:120` does not emit it), and the
      real `blinkStep` offers a third drop path (`blink.ts:95-100`,
      `:112`); 10.8 (`ROADMAP.md:174`) is aimed at an unisolated
      mechanism. The guided-line prediction
      (`docs/blink-line-adoption.txt:107-123`) is unscored, the ratchet
      caveat (`docs/eyeblink8-result.txt:312-327`) grows with every
      detector commit, and no row clears it.
      **Fix:** commit the replay tool; per miss compute
      crossing-to-reopen span, distance to the previous event and the
      `rearmed` flag from a full-clip replay; publish before writing
      10.8's prediction; row 10.8a re-measures Eyeblink8 at HEAD, moves
      the anchor and scores the prediction (its third falsifier only,
      per C3), BEFORE any detector change on the corpus-rule list.
      **Depends on:** A1, A2, A8, A15's decision, D4 (so the caveat is
      demanded for the whole chain).
      **Findings:** F-037, F-075, G-Guided b-10 (regression half).

- [ ] **D11. A frozen build for 11.8, and a way to get a published
      `app_commit` back.** `medium · confirmed ×2 (F-073); downgraded
×2 (d-4) · M`
      **What:** `deploy.yml:4-6` redeploys on every merge, 19-20 a day
      at peak; a three-week n-of-1 (`ROADMAP.md:190`) would span ~150
      commits and confound the person with the detector; a CSV stamped
      `app_commit: d8f0dcd` (`sessionMetadata.ts:354-355`,
      `participantReport.ts:259`, `vite.config.ts:18`) has no page to
      compare against; `ROADMAP.md:141` declines the version tag on
      sound grounds and `ROADMAP.md:185` says "frozen" with nothing
      that freezes.
      **Fix:** row zero of 11.8: a tagged build at a stable path named
      in the frozen plan, intake refusing a differing `app_commit`,
      started after C1 and A7; tag and GitHub-release the exact commit
      of any run that becomes evidence with `dist` attached; a README
      "reproduce the exact page" section (`git checkout <app_commit>
&& npm ci && npm run build && npm run preview`); drop "frozen"
      from `ROADMAP.md:185` until the mechanism exists.
      **Findings:** F-073, G-Build d-4.

- [ ] **D12. One roadmap PR: instrument rows before claim rows, as the
      era rule says.** `medium · confirmed ×2 · S` - 14.9 (with C9's additions) ahead of 12.11-12.13
      (`ROADMAP.md:41`, `:206-208`, `:213`, `:244`); 12.18's gaze
      riders gated on a committed 14.9 number or dropped;
      blink-gating added to 12.12's refusals. (F-041) - 12.2 → 12.3 → 11.1-11.4, so a fused detector does not graduate
      on corpora already spent (`ROADMAP.md:35`, `:185-186`,
      `:197-198`). (F-072) - The CFR instrument (A1, A11) as a row before 12.18, and 12.18's
      parity gate rewritten as conditional on the container coverage
      check passing (`ROADMAP.md:213`, `:194`). (G-Stepped-8) - 13.2 first, then 13.4, then 13.8 (C1, A2); 13.6a split out
      (E6); C10's engine row before 13.1; A7's hysteresis row before
      Phase 12; D10's 10.8a before 10.8; C3's procedure row; C4's
      11.0a/b.
      **Findings:** F-041, F-072, G-Stepped-8, plus the roadmap halves
      of F-002, F-025, F-009, F-074, F-071, F-075, G-Browser-6.

- [ ] **D13. ADR-0005 on the priority pivot; the mobile ADR before Phase
      13; a CONTRIBUTING rule for measurement-definition changes.**
      `medium · confirmed ×2 · M`
      **What:** `PROJECT.md:3`, `:29`, `:42`, `:49` say explainability
      beats accuracy and mobile is out of scope; `ROADMAP.md:34`, `:38`,
      `:219` say the opposite; three measurement-definition changes and
      the era pivot have no ADR (`MODEL_CARD.md:286-290`,
      `ADR-0003:29-34`); `decisions/` cannot answer "why is the blink
      line what it is".
      **Fix:** ADR-0005 deciding the priority and updating PROJECT.md;
      the 13.1 mobile ADR; a CONTRIBUTING line that intent or
      measurement-definition changes get a one-page ADR; two lines
      recording the practised-but-unwritten disciplines (append-only
      ADRs, dated adversarial passes; the taken half of F-102).
      **Findings:** F-067, (F-102 half).

- [ ] **D14. One page that says where the project stands; close the
      August trackers in writing.** `medium · confirmed ×2 · M`
      **What:** `REMEDIATION.md:477-480` lists "Blocking the telemetry"
      under deliberately-not-doing while 8745468 shipped it;
      `REMEDIATION.md:412-417` says #178 et al. stay open, contradicted
      by GitHub; `NEEDS-REVIEW.md:1-12`, `:173`, `CONTRIBUTING.md:64`,
      `CHANGELOG.md:7-9`, `docs/log.md:113`, `STATE.md:18-21`,
      `:271-274`, `ROADMAP.md:139` disagree.
      **Fix:** a generated STATUS block at the top of `STATE.md`; mark
      `REMEDIATION.md` and `NEEDS-REVIEW.md` closed with a pointer to
      this file; retire `docs/log.md` in writing; adopt the one rule
      from F-070 worth adopting: a number that appears in more than one
      document is generated or appears once with links.
      **Findings:** F-069, (F-070 narrow half).

- [ ] **D15. `docs/UI.md` and `test/MANUAL.md` describe a page two
      redesigns old under a headings-only guard.** `medium · confirmed
×2 · M`
      **What:** `tools/uiGuard.mjs:36-44` sees nine `box("...")`
      headings; `docs/UI.md:21`, `:83-111`, `:243`, `:531-533` describe
      a full-window layout that no longer ships (`main.ts:4434-4440`,
      `styles.css:120-133`); `MANUAL.md:56-57`, `:64` cannot pass;
      `README.md:633` and `CONTRIBUTING.md:65` promise "every string";
      the PR template (`:16-17`) let both DoD items be waived.
      **Fix:** bring UI.md to the shipped design; extend `uiGuard` to
      button/label strings and the idle-string table (B19); add the
      missing MANUAL items with dated "superseded by" notes; require a
      reason for "n/a".
      **Findings:** F-068.

- [x] **D16. Four small guard repairs, one PR.** `low · confirmed · S` - `tools/claimGuard.mjs:22-35` uses `git grep -F`; `PROJECT.md:41`
      restates the retired absolute claim one word away
      (`README.md:587`, `ADR-0004:108-115`). Regex family with the
      same exempt list; reword `PROJECT.md:41` to the disclosure
      wording; scope `README:587` to "of ours". (F-061) - `tools/exportGuard.mjs:27` matches backtick calls only;
      `main.ts:816` downloads `"session-01.json"` (the 478-point face
      mesh) in double quotes, outside `.gitignore:47-51`. Match both
      quote styles; add `session-*.json` with a negation for the
      consented fixture. (F-097) - Every guard is armed only by its sibling test file
      (`ci.yml:78`, `vitest.config.ts:9`). `guardsArmed.test.ts`
      asserting a sibling per `tools/*Guard|Block|Ratchet.mjs` with a
      consciously bumped count. (F-098) - `npm ci` runs lifecycle scripts in both workflows (`ci.yml:67`,
      `deploy.yml:32`); only fsevents has one today. `--ignore-scripts`
      in both; note in CONTRIBUTING; verify the wasm assets still
      populate via `package.json:24-26`'s prepare step. (F-100)

- [ ] **D17. Make the stepped frame-count assertion the WebKit project's
      mandatory local test.** `low · downgraded ×2 · S`
      **What:** CI runs Chromium only (`ci.yml:92`,
      `playwright.config.ts:17-27`, `:47-60`); 100% of published
      detection numbers come from `webkit.launch()`
      (`measure_corpus.mjs:128`) and the runner's success check is a
      prefix match on "Measured" (`:161-169`); the config itself
      records that the engines differ on seeking (`:29-31`).
      **Fix:** `test/e2e/videoFile.spec.ts:147-190` mandatory for the
      WebKit project with a config comment naming it the corpus
      runner's only automated protection; after C10, decide from data
      whether the runner stays on WebKit.
      **Findings:** G-Browser-7.
      **Done:** 6 September 2026, roadmap 10.1c. `claimGuard` matches a
      family of wordings with `git grep -E` instead of one spelling
      with `-F`, and PROJECT.md's constraint says what actually
      happens; the September appendix joins the exempt list, since
      quoting the retired wording while filing the finding is its job.
      `exportGuard` reads all three quote styles, `.gitignore` refuses
      `session-*.json` with a negation for the one committed consented
      fixture, and the guard now asks git about five downloads rather
      than four. `guardsArmed.test.ts` demands a sibling test per
      guard, generator and ratchet in `tools/`, states the count so
      adding one is deliberate, and leaves out the `write*`
      regeneration commands by name. Both workflows install with
      `npm ci --ignore-scripts`; the flag is per invocation, so
      `npm run build` still runs `prepare-assets` and the wasm assets
      still populate, verified locally.

---

## Stage E. UX and demo

- [x] **E1. On a phone the Start camera button is below the fold behind
      a "measuring..." score and five disabled exports.** `medium ·
downgraded ×2 · S`
      `src/styles.css:284-306` orders alertness, session, source under
      1000 px; the comment says controls come second but they are in
      `#box-source` (`main.ts:4302-4313`, `:4318-4325`, `:4249-4261`).
      Reorder to Source first; fix the comment; a 375-wide Playwright
      project (`playwright.config.ts:17-27`) asserting Start camera is
      within the viewport at idle. (F-027)
      **Done:** 6 September 2026, roadmap 14.0b: Source first under
      1000 px, the comment corrected, a `phone` Playwright project at
      375 px asserting Start camera in the idle viewport.

- [ ] **E2. Keyboard users cannot leave the calibration or heatmap
      overlays; the KSS dialog has no focus trap and lands on rating 1.** `medium · confirmed ×2 · M`
      `main.ts:1670-1674`, `:1753-1757`, `:1988` register click only;
      the sole keydown is the light overlay's (`:4183-4187`);
      `:2244-2255`, `:2335-2338`. Escape closes the overlays; native
      `<dialog>` with `showModal()` intercepting cancel; initial focus
      on the prompt or Skip. WCAG 2.1.2 / 2.4.3 plus a wrong-label
      risk. (F-079)

- [ ] **E3. Guided calibration: a tone at each phase boundary, an
      explicit Cancel with a status line, and the run's quality in the
      result.** `medium · confirmed/downgraded · S`
      The closed phase's instruction, countdown and end are visual
      only (`main.ts:3494-3507`, `:3465`), the overlay has no
      `role="dialog"` / live region (`:1709-1750`, `:2211`, `:2246-2248`);
      a stray touch cancels silently (`:1716-1722`, `:1753-1757`,
      `:3454`, `:3492`); the status (`:3480`) shows two medians and not
      n_open / n_closed / separation (`constants.ts:166`, `:172`,
      `guidedCalibration.ts:87-92`). Three distinguishable WebAudio
      beeps plus guarded `navigator.vibrate`; `aria-modal` and an
      assertive live region; a Cancel button, "Calibration cancelled,
      nothing was stored", Escape handler; "from 88 open and 84 closed
      readings, closed 26 percent of open", worded "thin, consider
      running it again" near the floors; same three numbers into the
      export (A8). Rewrite `MANUAL.md:66` as a procedure a person with
      closed eyes can perform. (G-Guided b-2, G-Guided b-7,
      G-Guided b-8)

- [x] **E4. The refusal sentence is hidden behind the guided-line label,
      and the stored-data box lists four keys under "Nothing is
      stored".** `low · confirmed · S`
      `main.ts:3543-3552`'s ternary tests the stored line first so
      `CALIBRATION_REFUSED_SENTENCE` (`:3548`) is unreachable while
      `:3718-3721`, `:3764-3768`, `:3877-3878` withhold; render the
      sentence whenever `calibrationRefused`. `main.ts:1797-1803`
      builds the list unconditionally while `:1865-1874` sets the
      summary; render each item with its state or retitle "What this
      page can store, and why" (`docs/UI.md:419-420`). (F-087, F-106)
      **Done:** 6 September 2026, roadmap 14.0b: the refusal sentence
      is the first branch of the threshold line; each stored item is
      rendered with its state (`storedItemState`: stored now, not
      stored, cannot be read).

- [x] **E5. The camera path says nothing while the model downloads and
      the score headline goes blank.** `low · confirmed/downgraded · S`
      `main.ts:981` blanks the headline, `:1125-1141` fires
      `ensureLandmarker()` with no status write, only the clip path
      announces (`:1227`); the countdown lives in the last card
      (`:3543-3552`, `:4409`). Write a loading status on the camera
      path; keep "measuring..." in `resetSession`; put the countdown in
      `panelSummaryLabel`. (F-078)
      **Done:** 6 September 2026, roadmap 14.0b: the camera path says
      the model is loading until it is ready; the countdown to the
      first score sits under the score; "measuring..." stays the
      running page's word.

- [ ] **E6. Capability ladder 13.6a now: rate and iris-px verdicts,
      light unknown.** `medium · confirmed ×2 · S`
      `ROADMAP.md:38` defines capability per setup and `:224` renders
      it after 12.16 (`:211`); delivered rate and iris px
      (`aperture.ts:109-122`, `docs/validation-round.txt:50`,
      `MODEL_CARD.md:113-116`) exist today. Split 13.6a (now) from
      13.6b (after 12.16); derive boundaries from committed data.
      (F-074)

- [ ] **E7. A link from the page to the repository and to every doc
      path the page cites.** `low · confirmed/downgraded · S`
      `main.ts:405-418` has LinkedIn and mailto only; the conditions
      sentences cite bare paths (`samplingBounds.ts:142-165`,
      `fpsGate.ts:128-137`); `index.html:1-12` has no description or
      favicon. Repository icon-link; cited paths as GitHub blob links;
      meta description; favicon. (F-080)

- [ ] **E8. `facingMode`, wake lock and orientation.** `low · downgraded
×2 · S`
      `camera.ts:28-32` has no `facingMode`; no `wakeLock` anywhere in
      `src/`; the only orientation read is one-shot
      (`deviceInfo.ts:59`); 13.1 (`ROADMAP.md:219`) already names it.
      `facingMode: {ideal: "user"}` and untick Mirror on environment;
      `navigator.wakeLock.request("screen")` on start with re-request
      on `visibilitychange` (`main.ts:4238-4247`); record grant/refusal
      and orientation flips; scope 13.1 to laptops too. (F-081)

- [ ] **E9. Prefetch the 15.8 MB model at page idle; a load timeout
      landing in `modelFailed`.** `low · confirmed/downgraded · M`
      `landmarker.ts:5-18` fetches only after Start (`main.ts:1130`,
      `:1228`); no timeout (`:1505-1522`, the residue
      `REMEDIATION.md:104-105` accepted); no cache. `ensureLandmarker`
      at idle overlapping the permission prompt and KSS; a timeout;
      Cache API after first load; `docs/cold-load.txt` as 13.10
      (`ROADMAP.md:226`) asks. (F-084)

- [ ] **E10. Per-tick polish left after A2.** `low · downgraded · S`
      Cache last text per readout and early-return
      (`main.ts:4505-4528`); set `hidden` only on change
      (`:3714`, `:4564-4570`); write `modelStatus` on kind change
      (`:3066`); track running min/max in `detectFixations`
      (`fixation.ts:94-100`) and drop-from-front instead of
      spread+filter (`main.ts:3341-3349`, `:3904-3925`); pupil read
      with `willReadFrequently: true`, drawing only the source rect and
      skipping below the iris floor (`videoCanvas.ts:130-137`, `main.ts:502-503`, `:3798-3803`, `pupil.ts:268-298`);
      add the work to the latency benchmark and amend `ROADMAP:40`,
      `:258`. (F-082, F-044, F-109)

---

## Stage F. Confirmed and declined, with the reason

- [~] **F-083, a WebCodecs decode path for corpus runs.** DECLINED.
  The "hours per dataset" premise is contradicted by the repo's own
  measurement: `tools/measure_corpus.mjs:32-38` records ~58 frames
  per second, about 20 minutes for Eyeblink8, and that comment
  exists because an earlier "hours" estimate was wrong. Effort L,
  parity risk on the one externally validated number, and the seek
  path (`videoStepper.ts:301-359`) is the reference A1 is pinning.
  Reopen only if a corpus re-run is actually blocked on wall-clock
  time after D10 has run once.

- [~] **F-070, restructuring the documentation layer.** DECLINED as a
  restructure. The measurements hold (62% of touches are prose)
  but the repo's own rule applies: unmotivated changes are where
  its defects came from. The one rule worth adopting, single-source
  numbers, is in D14; archiving `docs/audit` was already declined
  on 15 August and nothing has changed.

- [~] **F-102, rewriting the written ritual.** DECLINED beyond the one
  line taken in B14 and the two lines in D13. Two of three legs
  were refuted: `CONTRIBUTING.md:45` already says branch, PR, green
  CI, and the branch reuse across #374-#403 harms nothing, the same
  finding as Stage H last time.

- [~] **F-035, I-DT thresholds in degrees and one ruler for replay.**
  DECLINED until 14.9 gives the geometry to state a degree; the
  thresholds are honest in eye-width units and the replay's second
  ruler (`main.ts:1936`, `:2104-2111`) is a display choice. Taken:
  word the panel "gaze shifts" when E-series copy is touched; C9
  and D12 put 14.9 first, which is the real fix.

- [~] **F-045, the One Euro filter's lag.** DECLINED as a code change.
  The lag reproduces (100-300 ms by step size, `gazeSmoothing.ts:
14-23`) and is the right trade for display and fixation. Taken
  as a constraint on the plan, not work now: 14.10 and 14.12 must
  log raw offsets and pre-register the modelled lag per amplitude
  before any pursuit number is read.

- [~] **F-088, per-eye iris offset bias.** DECLINED. The ~0.07 bias
  reproduces on `session-01.json` (`gazeOffset.ts:47-48`) and no
  consumer uses a single eye; the mean is what ships. Reopen the
  day a single-eye fallback, asymmetry or vergence feature is
  proposed; pinning the fixture numbers then is a ten-line test.

- [~] **G-Reproduc-4, frame alignment between stepper index and
  annotation frameID.** DECLINED as a separate item. The impact
  claim is contradicted by a committed artefact the finding did
  not consult: `docs/evidence/2026-08-09/tables-current-run/
eyeblink8_false_positives.csv` carries
  `framesToNearestAnnotatedBlink`, and 29 of 67 misses are
  `crossed_line` inside their windows. If D3 lands, the lag
  histogram is a ten-line rider on its pytest; the
  `load_annotation` lowest-frameID check
  (`analysis/blinklab/eyeblink8.py:198`) can go in the same PR.

- [~] **G-export/l-6, DROZY and UTA-RLDD stripping the metadata
  block.** DECLINED. The impact claim fails: for a clip the
  per-second `fps` column is measured on the media clock, so a
  watched run reads the source rate and the tools' own gate
  (`drozy.py:70-72`, `rldd.py:115-120`) already does the job the
  finding wanted. The `measurement_mode` and `calibration_refused`
  checks are absorbed into A11's manifest and coverage check for
  the next run of each corpus.

- [~] **F-054's track-ended half as its own state machine, F-057's
  "per-source wording" beyond one sentence, and E5's review-count
  setting.** DECLINED as separate items; the first two are inside
  A17/A26, the third is still the repository preference it was on
  15 August.

- [~] **The residue findings that are already inside a taken item and
  need no row of their own:** F-044 and F-082 (A2, E10), F-052 and
  G-Guided b-11 (A8), F-006 (A15), G-Stepped-2/6/7 (A1),
  G-Stepped-4/9 (A11), G-Reproduc-5 (A12), G-Reproduc-7 (D3),
  G-Reproduc-6 and G-Browser-2 and G-Build d-3 (D4), G-export/l-3,
  l-4, l-5 (D6), F-108 (D8), F-095 and F-055 (A17), G-Guided b-9
  (A10), G-Guided b-10 (C3, D10), F-043 (C9), F-026 (B19), F-096
  (B3), F-064 (B2), F-103 / F-099 / F-101 / G-Reproduc-8 (B14),
  G-Build d-5 (B17), G-Build d-6 (B18), F-050 / F-049 (B11),
  F-090 / F-094 / F-086 / F-034 / F-033's statement (B12).

---

## Order of the first ten pull requests

1. A1 (stepper), 2. A3 (rounding), 3. A4 (exports after Stop),
2. A5 (camera track), 5. A6 (light overlay), 6. A2 (delivered-frame
   driver), 7. A8 (line provenance), 8. B1 + B2 + B3 (the three honesty
   sentences a visitor reads first), 9. D2 (boundary probes and the
   mutation runner, so 1-7 are pinned), 10. A7 (hysteresis, first through
   the trace harness).

After those: A9-A12, D1, D4, D5, then D10's regression run, which is
the gate every corpus-rule item waits behind. Owner items (A11's
manifest, A24's one frame, C1, C3, C10, D3's logs, D10) can be
scheduled on any quiet day and block nothing above them.

---

## Deliberately not doing

- **A second review before the ladder is half done.** The August
  review found drift in prose; this one found it in wiring and in the
  border between the two languages. A third pass before A1-A12 and
  D1-D6 land would find the same classes wearing new numbers.
- **Rewriting `main.ts`.** Still correct, linted and honest about its
  size. A17 and D7 pull the two decisions that produced defects (the
  session boundary and the gate wiring) into `src/core`; nothing else
  moves.
- **Cutting v0.8.0.** Phase 8 is still not closed while E5 stands, and
  D11's evidence-run tags are the only tags the ladder needs.
