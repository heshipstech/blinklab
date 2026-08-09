# Issue #178: the 500 millisecond ceiling, and the two results that disagree

This is the written record of the replay result cited by issue #178.

## The constant

`src/core/constants.ts` sets `MAX_BLINK_DURATION_MS = 500`. It is used twice.
`src/core/blink.ts` refuses to count a closure longer than 500 milliseconds as a
blink. `src/core/longClosure.ts` reuses the same value as
`LONG_CLOSURE_THRESHOLD_MS`. So the constant is also the boundary between two
detectors.

## What the replay measured

The Python reimplementation described in
[issue-176-double-counting.md](issue-176-double-counting.md) replayed all 71,354
frames of the corpus. In that replay, raising `MAX_BLINK_DURATION_MS` from 500 to
1000 recovered **13 detections** and moved F1 from 92.1 to **93.6**. F1 is the
single number that puts recall and precision together.

The replay tested eight ideas about the detector and refuted six of them. The
duration ceiling was the largest single remaining cost it found.

| idea tested                                                 | verdict                                    | measurement                                                                                                                                                                                                                              |
| ----------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the 30 second baseline warm up suppresses detection         | refuted, costs 0                           | setting the learning time to 0 gives 357 true positives and 9 false, against 357 and 10. The fixed 4 mm fallback used before the baseline exists is at or above the learned line in 6 of 8 clips, so warm up is the more sensitive state |
| the baseline rises and never falls, so it drifts wrong      | refuted, the rise helps                    | freezing the baseline at its first ready value costs 10 detections, recall 87.5% down to 85.0%                                                                                                                                           |
| the ceiling added by issue #126 distorts the baseline       | refuted, never binds                       | raising that ceiling to a huge number gives an identical result                                                                                                                                                                          |
| half of the personal baseline is an indefensible threshold  | refuted, 0.50 is at the measured best      | sweeping the fraction gives F1 89.1 at 0.40, 90.8 at 0.45, 92.1 at 0.50, 92.2 at 0.55, 90.8 at 0.60, 83.7 at 0.70                                                                                                                        |
| arming depth or a minimum duration throws away short blinks | partly, and the ceiling is the bigger half | there is no minimum duration, and the shortest blink the human marked is 4 frames. Raising `MAX_BLINK_DURATION_MS` to 1000 recovers 13 detections, F1 92.1 to 93.6                                                                       |
| the frame rate gate drops frames on a variable rate clip    | refuted, never fires                       | frame rate is a constant 30 in all eight clips and the gate sits at 25                                                                                                                                                                   |
| the head pose gate refuses frames                           | refuted, costs 4                           | disabling it entirely gains 4 true positives. The non frontal flag is 0 in all eight clips                                                                                                                                               |

The finding is consistent with a second result from the same work. Of the corpus
blinks the replay missed, 40% armed the detector and were then lost to the 500
millisecond ceiling or to the matcher.

## Why this does not settle the question

Closed issue #126 already refutes raising the constant, in writing, with a
reproduced case. Two owner comments there say the constant is doing unadvertised
work as a noise filter, and that it is a partition between two detectors rather
than a label.

The two results were gathered under different conditions, and that is probably
the answer.

- #126 was measured on a live camera session where the learned baseline had
  ratcheted up above the resting eyelid opening. In that state the eye counts as
  closed while at rest, so noise dips look like long closures, and the 500
  millisecond ceiling is the only thing throwing them away.
- The replay ran on eight recorded clips of alert people, where the baseline
  behaves. In that state the ceiling has nothing bad to throw away, so it only
  throws away real long blinks.

If that is right, 500 is neither too low nor correct. It is doing two jobs at
once, and the second job is undocumented.

## Files in this folder that support it

- `../scripts/replay/` the Python reimplementation and the experiment scripts.
  `exp.py` through `exp7.py` are the sweeps in the table above.

## What is not here

The 13 detections came from the replay, not from the shipped app. That number has
to be earned by a real run before it is quoted anywhere.
