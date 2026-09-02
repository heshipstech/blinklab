# The awake corpus autopsy, 2 September 2026

`eyeblink8_miss_autopsy.csv` is the per-miss mechanism verdict for the
67 Eyeblink8 blinks the detector misses, from the first **awake**
corpus trace run — the one `docs/miss-trace.txt` had been owed since
the first attempt was quarantined for a mid-run machine sleep.

## Provenance

- The run drove the real built app through WebKit, stepping every
  frame, on a new machine (the project's second piece of hardware).
  All eight clips measured, zero failed.
- It reproduced the **same 67 misses**, blink-for-blink, as the
  committed `docs/evidence/2026-08-21-rearm/eyeblink8_misses.csv`. The
  detector's output is therefore hardware-independent for this corpus:
  a different CPU, OS and browser build produced the identical miss
  set, so the earlier single-machine results were not an artefact of
  that machine.
- The verdict table is `tools/measure_corpus.mjs`'s per-frame traces
  joined to the published miss table by `analysis/tools/miss_autopsy.py`.
  The raw per-frame traces are not committed (they carry the clip
  filename in a metadata comment and run to tens of thousands of rows);
  this verdict table is the joinable summary.

## Columns

`clip, blink_id, mechanism, min_ratio, measured_frames,
fully_closed_frames`. `mechanism` is one of `not_measured`,
`no_trusted_face`, `crossed_line`, `above_line`. `min_ratio` (smallest
apertureMm / blinkLineMm over the closed span) is filled ONLY for
`above_line`; it is empty for every other verdict, never 0.

## Summary

| mechanism       | n   | closed-frame share |
| --------------- | --- | ------------------ |
| not_measured    | 0   | —                  |
| no_trusted_face | 4   | 75.0%              |
| crossed_line    | 29  | 96.6%              |
| above_line      | 34  | 47.1%              |

`above_line` min_ratio: closest 1.02, median 1.24, farthest 1.66.

Of the 47 misses that contain a frame a human marked fully closed:
28 are `crossed_line`, 16 are `above_line`, 3 are `no_trusted_face`.

## What it means

Recorded, with the pre-committed prediction it was scored against, in
`docs/miss-character.txt` (section "THE AUTOPSY, VERIFIED"). In short:
the predicted landmark failure is refuted; the largest mechanism is
`crossed_line` — a real closure the aperture registered and the
detector's re-arm/refractory state machine dropped.
