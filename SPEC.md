# SPEC.md

The technical specification. The contract that code must follow. Updated whenever the contract changes.

## Data flow

camera frame → landmarker → landmark array → core functions → feature record → UI and CSV

- `src/io` owns the camera, the canvas and model loading. It is the impure edge.
- `src/core` owns all measurement logic. Pure functions only: no DOM (Document Object Model, the browser page), no camera, no browser globals.
- `src/ui` renders numbers and controls. It never computes a measurement.
- `core` never imports from `io` or `ui`. This rule is enforced by lint from increment 0.3.

## The FeatureRecord contract

One record describes what the system knows at one moment. Everything downstream (UI, CSV export, scoring) agrees on this type. It grows one field per increment, never more.

```ts
export type FeatureRecord = {
  timestampMs: number;
  faceDetected: boolean;
  fps: number;
};
```

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
