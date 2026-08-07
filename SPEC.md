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
  fps: number | null;
  apertureMm: number | null;
  baselineMm: number | null; // the live 4.2 baseline (blink line)
  shutBaselineMm: number | null; // frozen first-ready baseline (shut line)
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
- Aperture and EAR are distances between landmarks, never vertical drops, which makes them invariant under head roll by construction. No roll correction exists because none is needed, proven at 0, 15 and 30 degrees in the tilt invariance tests.
