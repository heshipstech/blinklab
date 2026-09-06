# SPEC.md

The technical specification. The contract that code must follow. Updated whenever the contract changes.

## Data flow

camera frame → landmarker → landmark array → core functions → feature record → UI and CSV

- `src/io` owns the camera, the canvas and model loading. It is the impure edge.
- `src/core` owns all measurement logic. Pure functions only: no DOM (Document Object Model, the browser page), no camera, no browser globals.
- Rendering lives in `src/main.ts`. The `src/ui` folder this document originally planned was never created: the page is small enough that one wiring file has stayed readable, and every string it renders that carries meaning is produced by a tested pure function in `core` (blink log lines at 4.8, score panel lines at 6.6). The rule that survives is the one that matters: the renderer never computes a measurement.
- `core` never imports from `io` or `ui`. This rule is enforced by lint from increment 0.3.

## The FeatureRecord contract

One record describes what the system knows at one moment, assembled once per second since increment 6.4. Everything downstream (UI, CSV export, scoring, the Python analysis) agrees on this type, and `isFeatureRecord` in core/featureRecord.ts is its runtime schema: NaN and infinities refused, negatives refused where meaningless, missing keys refused, extra keys tolerated for forward compatibility.

The original seed here held three fields and planned to grow one per increment. The fields did each arrive through their increments; this document failed to record them as they landed, which increment 6.4's review caught. The full contract, now kept current:

```ts
export type FeatureRecord = {
  timestampMs: number;
  faceDetected: boolean; // face present AND landmark count valid
  fps: number | null; // the PROCESSING rate: animation pace live, media-clock pace on clips; not a camera measurement (D1)
  apertureMm: number | null;
  baselineMm: number | null; // the 4.2 baseline, frozen at birth since 2026-08-20 (blink line)
  shutBaselineMm: number | null; // first-ready baseline (shut line); equals baselineMm since the freeze, kept for contract stability
  blinkRatePerMin: number | null;
  lastBlinkDurationMs: number | null;
  lastBlinkAmplitudeMm: number | null;
  lastBlinkPeakVelocityMmPerS: number | null;
  perclos: number | null; // 0 to 1
  longClosureCount: number;
  fixationCount: number | null;
  fixationMedianMs: number | null;
  fixating: boolean | null;
  onScreen: boolean | null;
  baselineOverResting: number | null; // the frozen ruler over the running median aperture (roadmap 10.1f1: this landed on 2026-08-23 and this block did not record it until 6 September)
  pupilDiameterMm: number | null; // millimetres, or null when the estimator refuses
};
```

Null always means a gate refused, never zero. A row with `faceDetected: false` carries nulls: measured absence. Durations are computed from `timestampMs` spans, never from row counts, because the cadence is about one row per second, not exactly.

## The ScoreBreakdown contract

The demo score (increment 6.5) is the second contract everything downstream agrees on. It is derived from FeatureRecords, never stored, and its defining property is an identity a person can check by hand:

```ts
export type Contribution = {
  name: string;
  points: number; // whole points, never fractional
  available: boolean; // false: signal missing, contributes 0, says so
};

export type ScoreBreakdown = {
  score: number; // 100 - sum(contributions.points), exactly
  contributions: Contribution[];
};
```

`score = 100 - sum(points)` holds with no clamping, because the four penalty caps sum to exactly 100 and every contribution is an integer. Any future penalty must take its points from the existing caps, never add to the total, or the identity breaks and 6.6's panel starts lying.

Every ramp floor is priced above this instrument's own documented normal range (test/MANUAL.md items 24, 26 and 40), not from the literature's numbers, because this instrument reads differently from the ones the literature used. A resting person scores 100.

The score refuses rather than guesses: null when the newest record saw no face, and null until PERCLOS has a value.

## The CSV export contract

Increment 6.7 writes a session to a file, which is where this project's data becomes someone else's input. The rules, so a reader in another language can trust it:

- The column list is `CSV_COLUMNS` in core/csv.ts, exported and tested against the FeatureRecord field set, so a field cannot join the record without joining the file.
- One header row, then one row per record, in that column order.
- Encoding follows RFC 4180: `CRLF` line endings including after the last row, a value containing a comma, quote or line break is wrapped in quotes, and a quote inside a quoted value is escaped by doubling it.
- **Null is an EMPTY field**, never the word "null" and never zero. A reader must treat an empty field as "not measured", which is the same rule the FeatureRecord contract states, carried across the border.
- Booleans are the bare words `true` and `false`. Numbers are written at full JavaScript precision, unrounded.
- An empty session exports nothing at all rather than a lone header, because a header-only file claims a recording happened.
- **`timestampMs` is not since the epoch, and which clock it counts depends on the source (7.0).** For a live camera session it is milliseconds since the page loaded. For an uploaded clip it is milliseconds into the CLIP, starting at zero, and deliberately not the wall clock: a ten minute recording processed in thirty seconds must still report ten minutes, or every rate, duration and rolling window derived from it is wrong by the ratio between the two. In both cases it is monotonic, correct for durations and for ordering rows WITHIN one file, and meaningless across files. The session's wall-clock start is carried in the filename as an ISO stamp instead, so files date and sort correctly on disk. A future increment may add an absolute column; until then a reader must not compare timestamps between files.
- **How completely the session was measured is recorded (7.4).** Four comment lines: `# measurement_mode:` is `live` for a camera, `played` for a clip watched in real time, or `stepped` for a clip walked frame by frame; `# frames_measured:` counts the frames the instrument actually looked at; `# clip_duration_s:` and `# measured_fps:` give the clip's length and the resulting rate, or `unknown` where a container carries no duration. This exists because a clip watched on a slow machine can be measured at a fraction of its own frame rate, and without these lines that file is indistinguishable from a complete one. Only `stepped` guarantees every frame was seen. A stepped session adds three more lines (`# frame_interval_s:`, `# frames_sought:`, `# inexact_landings:`): the step it was measured on, how many frames were sought, and how many of those the browser never placed on the clip's own clock. A run with more than two in a hundred of the last is refused rather than exported (`docs/stepper-honesty.txt`).
- **The frame source is recorded (7.0).** Two comment lines above the header say where the frames came from: `# source: camera` or `# source: file`, and `# clip: <filename>` or `# clip: none`. A reader that cannot tell a live webcam session from a dataset clip will eventually average across both without noticing. A clip name is written with any line breaks flattened to spaces, because a raw newline would end the comment and the remainder would parse as a data row. Exports made before 7.0 carry neither line, and a reader must treat their absence as unknown rather than as camera.
- **Session-level facts are comment lines, not columns.** The KSS answers (6.8) are written above the header as `# kss_before: N (anchor text)` and `# kss_after: ...`, or `skipped`. A per-session value must never become a per-second column: repeated three thousand times it would let a model treat one answer as three thousand independent observations. A reader skips these with pandas' `comment="#"`. Both lines are always present when the increment is available, because "asked and declined" is data and an absent line is not.
- Non-finite numbers (NaN, the infinities) are written as empty fields. The FeatureRecord schema refuses them upstream, so one reaching the serialiser means something broke; writing the word "NaN" would be worse than useless, since pandas reads it as a missing value and a broken computation would become indistinguishable from an honest "not measured".

### The blink log export

A second file, and deliberately separate. The per-second record answers
"what were the eyes doing during this second". The blink log answers
"when did each blink happen". Events cannot be squeezed into a
per-second table without losing every blink after the first in any
given second, and at a resting rate of fifteen a minute that is not
rare.

- Columns, in order: `startFrame`, `endFrame`, `atMs`, `durationMs`,
  `amplitudeMm`, `peakClosingVelocityMmPerS`, `amplitudeOverVelocityMs`.
- **The frame numbers are the reason it exists.** A human annotator
  marks blinks BY FRAME, so a comparison against ground truth has to
  happen in frames. Milliseconds cannot substitute, because our clock
  and theirs agree only if the frame rate is exactly what both assumed.
- `startFrame` and `endFrame` are **empty for a live camera**, where a
  frame number means nothing to anyone. They are populated for a clip.
- Same encoding rules as the per-second file: RFC 4180, CRLF endings,
  and an empty field means NOT MEASURED rather than zero. A blink whose
  shape could not be analysed writes empty amplitude and velocity, never
  zero, because a blink of zero amplitude is a real and very different
  claim about somebody's eyelid.
- A session with no blinks exports nothing rather than a lone header,
  for the same reason the per-second file does.
- Carries the same `source`, `clip` and coverage metadata block.

The file is written to the user's own device through the browser's download path. There is no server, and the export does not change the project's privacy stance.

### The session metadata block

Above the header of every export sits a block of `# key: value` lines.
There are 57 keys, written by six modules under `src/core`, and this
table is the contract: what writes each one, when, in what format, and
which reader on the Python side consumes it.

It exists because until 6 September nothing checked that the two sides
of the border agreed. A renamed key left both suites green and turned a
Python gate into a pass-through: the reader found nothing, took its
default, and reported the session as fine.
`analysis/tests/test_metadata_contract.py` now reads the keys out of the
writers and holds this table to them in both directions, so a key added
here that nothing writes fails, and a key written there that this table
omits fails too.

Two reading rules that the contract test learned the hard way. A `line(`
call may wrap across lines — thirteen do, `sampled_fps` among them — so
a one-line pattern finds two thirds of them and reports success. And
`# key: value` appears in the comments that describe this format, so a
reader that does not strip comments reports a key called `key`.

`N` in a key name stands for an index: a session with two markers writes
`marker_1_seconds` and `marker_2_seconds`.

The "when written" column is a promise a reader can act on. A cell
reading exactly `Every export` means every session export carries the
row, so a file missing it has lost a line on its way here and may be
refused. Any other cell names a condition, and absence under it is an
ordinary session rather than a damaged file. `Every export, once a
baseline resolved` is one of those: it reads like a promise and is not.

Absent and unknown are different claims, and this column is about the
first. A row whose value could not be determined is still written, with
the value `unknown`, because a reader who finds no row cannot tell a
question that was asked and unanswered from one that was never put.
Rows that vanish do so because the thing they describe did not happen.

That distinction is why the column is exercised rather than described.
`test/core/metadataPresence.test.ts` calls the real row builders with
the arguments three sessions supply — a thin camera session where
nothing optional happened, a stepped clip, and a session where
everything optional happened at least once — and holds this column to
what comes out. It was written from reading the writers on 6 September
and was wrong about seven keys, six of them the same mistake: a value
that may be `unknown` described as a row that may be absent.

"Nothing" in the last column is a fact about today, not a judgement.
Most of those keys are written for a person reading the file. Three of
them were honesty rows that nothing read at all — `app_commit`,
`protocol` and `feature_records_dropped` — and roadmap row 10.1f2 gave
them readers: a cohort table now says which builds recorded it, and a
dropped-row count that cannot be parsed refuses the file rather than
defaulting to zero.

| Key                              | When written                           | Value format                                                                                     | Read by                                                                         |
| -------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `app_commit`                     | Every export                           | The build's short commit, or `unknown` for a build from a working tree                           | `loader.py` (`Session.app_commit`); the round report names the cohort's builds  |
| `blinks_detected`                | Blink log only                         | Integer count of blinks the detector reported                                                    | `blink_log.py`                                                                  |
| `blinks_recorded`                | Blink log only                         | Integer count of blinks the file actually holds; below `blinks_detected` when the buffer overran | `blink_log.py`                                                                  |
| `calibration_ceiling_bound`      | Every export, once a baseline resolved | `true` or `false`: whether the learned ruler hit its median ceiling                              | Nothing                                                                         |
| `calibration_refused`            | Every export, once a baseline resolved | `true` or `false`                                                                                | Nothing                                                                         |
| `calibration_samples`            | Every export, once a baseline resolved | Integer count of samples the baseline was solved from                                            | `validation.py`, `validation_checks.py`                                         |
| `calibration_spread_ratio`       | Every export, once a baseline resolved | Ratio to three decimals                                                                          | `validation.py`, `validation_checks.py`                                         |
| `camera`                         | Every export                           | The camera's label, or `none, not a camera session` for a clip                                   | Nothing                                                                         |
| `camera_declared_fps`            | Camera sessions                        | The rate `getSettings` claims, to two decimals, or `unknown`                                     | Nothing                                                                         |
| `camera_delivered_fps`           | Camera sessions, once measurable       | Frames per second to one decimal, or `unknown`                                                   | Nothing                                                                         |
| `camera_resolution`              | Camera sessions                        | `WIDTHxHEIGHT`, or `unknown`                                                                     | Nothing                                                                         |
| `clip`                           | Every export                           | The clip's filename with line breaks flattened, or `none`                                        | Nothing                                                                         |
| `clip_duration_s`                | Every export                           | Seconds to three decimals, or `unknown` where the source carries none                            | Nothing                                                                         |
| `delivered_frames_read_fraction` | Camera sessions, once measurable       | `sampled_fps` over `camera_delivered_fps` to three decimals, at most 1.000                       | Nothing                                                                         |
| `device_pixel_ratio`             | Camera sessions                        | A number, or `unknown`                                                                           | Nothing                                                                         |
| `face_detected_fraction`         | Every export                           | Share of records with a face, to three decimals                                                  | Nothing                                                                         |
| `facing_mode`                    | Camera sessions                        | `user` or `environment`, or `unknown`                                                            | Nothing                                                                         |
| `feature_records_dropped`        | Only when rows were dropped            | Integer count of per-second rows lost to the 3600-row buffer                                     | `loader.py` (`Session.records_dropped`); an unreadable count is refused at load |
| `feature_records_note`           | Only when rows were dropped            | A sentence naming the count and the buffer size                                                  | Nothing                                                                         |
| `frame_interval_s`               | Stepped clips                          | The calibrated step in seconds                                                                   | Nothing                                                                         |
| `frames_measured`                | Every export                           | Integer count of frames the instrument looked at                                                 | `blink_log.py`, `miss_autopsy.py`                                               |
| `frames_recorded`                | Frame trace only, when truncated       | Integer count of rows the file holds                                                             | Nothing                                                                         |
| `frames_sought`                  | Stepped clips                          | Integer count of frames sought                                                                   | Nothing                                                                         |
| `hardware_concurrency`           | Camera sessions                        | Integer core count, or `unknown`                                                                 | Nothing                                                                         |
| `inexact_landings`               | Stepped clips                          | Integer count of seeks the browser never placed on the clip's clock                              | Nothing                                                                         |
| `interruption_N_seconds`         | One row per interruption               | Seconds to three decimals, or `unknown` where the moment was not stamped                         | Nothing                                                                         |
| `kss_after`                      | Every export                           | `N (anchor text)` or `skipped`                                                                   | `loader.py`, `validation.py`                                                    |
| `kss_after_at_seconds`           | Every export, once answered            | Seconds to three decimals                                                                        | Nothing                                                                         |
| `kss_before`                     | Every export                           | `N (anchor text)` or `skipped`                                                                   | `loader.py`, `validation.py`                                                    |
| `light_cycles`                   | Light-response sessions                | Integer count of dark/bright cycles                                                              | Nothing                                                                         |
| `light_phase_ms`                 | Light-response sessions                | Milliseconds per phase                                                                           | Nothing                                                                         |
| `light_settle_ms`                | Light-response sessions                | Milliseconds of settle before the first phase                                                    | Nothing                                                                         |
| `light_stimulus`                 | Light-response sessions                | A sentence naming the schedule and its plan document                                             | Nothing                                                                         |
| `light_stimulus_start_ms`        | Light-response sessions                | Milliseconds on the record clock                                                                 | `light_response.py`                                                             |
| `marker_N_seconds`               | One row per marker                     | Seconds to three decimals                                                                        | `validation.py`, `round2.py`                                                    |
| `marker_N_visibility_changes`    | One row per marker                     | Integer count of tab switches up to that marker                                                  | `validation.py`, `round2.py`                                                    |
| `markers`                        | Every export                           | Integer count of markers                                                                         | `validation.py`, `round2.py`                                                    |
| `measured_fps`                   | Every export                           | Frames per second to two decimals, or `unknown`                                                  | Nothing                                                                         |
| `measurement_frame`              | Every export                           | `WIDTHxHEIGHT` of the frame the MODEL read, not the canvas, or `unknown`                         | Nothing                                                                         |
| `measurement_mode`               | Every export                           | `live`, `played` or `stepped`                                                                    | `blink_log.py`, `miss_autopsy.py`                                               |
| `median_iris_width_note`         | Only when the sample cap bound         | A sentence naming the cap                                                                        | Nothing                                                                         |
| `median_iris_width_px`           | Every export                           | Pixels to one decimal, or `unknown`                                                              | Nothing                                                                         |
| `observed_duration_seconds`      | Every export                           | Seconds to three decimals                                                                        | Nothing                                                                         |
| `orientation`                    | Camera sessions                        | The screen orientation, or `unknown`                                                             | Nothing                                                                         |
| `participant_pseudonym`          | Only when one was set                  | The pseudonym as typed                                                                           | `validation.py`, `pilot.py`                                                     |
| `perclos_min_observed_ms`        | Every export                           | Milliseconds of valid span a PERCLOS value must clear                                            | Nothing                                                                         |
| `perclos_min_samples`            | Every export                           | Valid samples a PERCLOS value must clear                                                         | Nothing                                                                         |
| `pose_valid_fraction`            | Every export                           | Share of records with an acceptable head pose, to three decimals                                 | `validation_checks.py`                                                          |
| `protocol`                       | Every export                           | The protocol document and its date                                                               | `loader.py` (`Session.protocol`)                                                |
| `records`                        | Every export                           | Integer count of per-second rows in the file                                                     | Nothing                                                                         |
| `sampled_fps`                    | Camera sessions, once measurable       | Distinct camera frames read per second, to one decimal, or `unknown`                             | `verdict.py`, `validation_checks.py`                                            |
| `screen`                         | Camera sessions                        | `WIDTHxHEIGHT`, or `unknown`                                                                     | Nothing                                                                         |
| `source`                         | Every export                           | `camera` or `file`                                                                               | `blink_log.py`, `miss_autopsy.py`                                               |
| `user_agent`                     | Camera sessions                        | The reduced browser string, or the full one when asked for                                       | Nothing                                                                         |
| `user_agent_form`                | Camera sessions                        | `reduced` or `full`                                                                              | Nothing                                                                         |
| `viewport`                       | Camera sessions                        | `WIDTHxHEIGHT`, or `unknown`                                                                     | Nothing                                                                         |
| `visibility_changes`             | Every export                           | Integer count of tab switches during the session                                                 | `validation.py`, `round2.py`                                                    |

## Conventions

- Coordinates: MediaPipe normalised image coordinates. Origin top left, x grows right, y grows down, values 0 to 1. Convert to pixels only at the drawing edge.
- Units: every measured value carries its unit in its name. `apertureMm`, not `aperture`. `durationMs`, not `duration`.
- Time: milliseconds from `performance.now()`, always passed in as a parameter so tests can control the clock.
- Trust: a function that cannot produce a trustworthy number returns `null`. Never zero, never a guess.

## Error and degraded states

Each state renders a readable message. The page never crashes and never shows stale numbers.

The full list of `CameraState` kinds is in `core/cameraState.ts`. Two of
them, `ended` and `cameraStopped`, arrived on 6 September 2026 and are
recorded here on the same day the metadata contract was written down,
because this table had the same defect the metadata block had: it was
kept current by intention.

| State                                       | Behaviour                                                                                                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No camera found                             | Message with what to check                                                                                                                                |
| Permission denied                           | Message with recovery steps                                                                                                                               |
| No face in frame                            | "No face detected", measurements stop                                                                                                                     |
| Low frame rate, under 25 fps                | Blink metrics return null, UI says "not measurable"                                                                                                       |
| Wrong landmark count, 468 instead of 478    | On screen error naming the cause, no crash                                                                                                                |
| Session ended (`ended`)                     | Stop, or a clip that finished. The picture, the exports, the report and the record all stay; the calibrations, the marker and the light stimulus turn off |
| Camera stopped delivering (`cameraStopped`) | Named as the camera's silence rather than the browser's. The session ends, the record is kept, and no row is written from a frozen frame                  |

## Performance budget

- Model inference under 30 milliseconds per frame on a modern laptop.
- The UI never blocks the frame loop.

## Assumptions

- Gaze features assume the head stays reasonably still. The head pose gate (increment 3.8) marks gaze invalid when the head moves beyond its range.
- Aperture and EAR are distances between landmarks, never vertical drops, and both convert every landmark to pixel coordinates before mixing directions. Together those two choices make them invariant under head roll by construction. No roll correction exists because none is needed, proven at 0, 15 and 30 degrees in the tilt invariance tests, on a 1280x720 frame, because normalised coordinates are anisotropic on a widescreen camera and a square test frame cannot see a measurement that skips the conversion. Until 11 August 2026 the displayed EAR did skip it, read about 1.8 times the standard definition, and fell 27 percent across the roll range this sentence declared invariant; the August audit caught it, and the old normalised-space formula is kept in the tilt test as a pinned counterfactual.
