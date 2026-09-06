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

## Conventions

- Coordinates: MediaPipe normalised image coordinates. Origin top left, x grows right, y grows down, values 0 to 1. Convert to pixels only at the drawing edge.
- Units: every measured value carries its unit in its name. `apertureMm`, not `aperture`. `durationMs`, not `duration`.
- Time: milliseconds from `performance.now()`, always passed in as a parameter so tests can control the clock.
- Trust: a function that cannot produce a trustworthy number returns `null`. Never zero, never a guess.

## Error and degraded states

Each state renders a readable message. The page never crashes and never shows stale numbers.

| State                                    | Behaviour                                           |
| ---------------------------------------- | --------------------------------------------------- |
| No camera found                          | Message with what to check                          |
| Permission denied                        | Message with recovery steps                         |
| No face in frame                         | "No face detected", measurements stop               |
| Low frame rate, under 25 fps             | Blink metrics return null, UI says "not measurable" |
| Wrong landmark count, 468 instead of 478 | On screen error naming the cause, no crash          |

## Performance budget

- Model inference under 30 milliseconds per frame on a modern laptop.
- The UI never blocks the frame loop.

## Assumptions

- Gaze features assume the head stays reasonably still. The head pose gate (increment 3.8) marks gaze invalid when the head moves beyond its range.
- Aperture and EAR are distances between landmarks, never vertical drops, and both convert every landmark to pixel coordinates before mixing directions. Together those two choices make them invariant under head roll by construction. No roll correction exists because none is needed, proven at 0, 15 and 30 degrees in the tilt invariance tests, on a 1280x720 frame, because normalised coordinates are anisotropic on a widescreen camera and a square test frame cannot see a measurement that skips the conversion. Until 11 August 2026 the displayed EAR did skip it, read about 1.8 times the standard definition, and fell 27 percent across the roll range this sentence declared invariant; the August audit caught it, and the old normalised-space formula is kept in the tilt test as a pinned counterfactual.
