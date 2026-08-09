# Issue #176: one real blink reported twice

This is the written record of what was measured on 9 August 2026.

## What was found

Most of the app's false alarms are not imagined blinks. They are one real blink
counted twice.

On the corrected Eyeblink8 run the app invented 53 blinks. 45 of those 53 land on
top of a blink the human marked, not on an open eye. They are short. 41 of the
53, which is 77%, are 3 frames long or shorter. The median length is 3 frames,
which is 100 milliseconds at 30 frames per second.

## The cause in the code

`src/core/blink.ts` arms the detector with depth. The file's own header comment
states the trade plainly: "Closing and reopening are unchanged, both at the same
threshold". There is no reopen hysteresis, no minimum hold above the line, and no
refractory period.

Hysteresis means requiring the eye to open further than the level at which it was
called closed. A refractory period means a short window after a blink in which a
second blink cannot be reported.

One frame above the line ends the closure and reports a blink. The next frame
below the line starts a new one.

## Measured on the shipped export, no replay involved

Of 321 consecutive pairs of detections, 22 sit exactly 0 frames apart, 11 more
sit 1 frame apart, and 3 sit 2 frames apart. 41 of the 284 matched blinks in the
first run, which is 14.4%, received two or three detections between them. That
spends 43 extra detections.

It is not noise around the line. For each of the 22 pairs 0 frames apart, the
eyelid opening at the exact frame where the app declared a reopen was read back.
The median was 0.320 of the person's baseline, with a range of 0.124 to 0.592. 19
of the 20 measurable cases were below the 0.50 line. The eye was still deep
inside the closure and the app said it had reopened.

Adding random noise to the replay reproduces the false alarm count but never
reproduces the split rate, 1.1% against 14.4%. So the cause is single frame
spikes in the landmark positions, not drift.

## What the gain would be

Merging detections that sit 2 frames apart or closer, on the first run's exported
file, moved false alarms from 45 to 9 and precision from 86.3% to 96.9%, with
true positives unchanged at 284.

**This number is an estimate and it must not be published until it has been
earned.** It was computed by merging rows after the fact, not by running the app
with a refractory period in it.

## How the replay was built

A Python reimplementation of the detector was built the same day. It replayed all
71,354 frames of the corpus. It ported `aperture.ts`, `headPose.ts`,
`validityGate.ts`, `baseline.ts` and `blink.ts` line for line, and it read the
project's own `public/models/face_landmarker.task` model file.

Its eyelid measurement agreed with the app's own exported column to within 0.6%
to 1.5% per clip, with no bias in either direction. The signed bias is -0.0044 mm
on open samples and +0.0098 mm on low samples, so the replay is if anything
slightly less sensitive at closure than the app.

One caveat matters. The replay runs the model on the processor through Python.
The shipped app runs it on the graphics processor inside WebKit. The single frame
spikes that split 14.4% of the shipped blinks do not appear in the replay at all.

## Files in this folder that support it

- `../tables/eyeblink8_false_positives.csv`, 45 rows, one per false alarm of the
  first run, each labelled. Most rows carry `double_fire_on_a_real_blink`.
- `../scripts/replay/` the Python reimplementation. `trace.py` writes the
  per frame eyelid signal, `sim.py` is the ported state machine, and `verify.py`
  and `exp*.py` run the experiments over it.
