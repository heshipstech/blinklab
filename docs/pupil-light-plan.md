# Pupil light-response plan: does the estimate detect the light reflex? — written before the experiment is run

This document is written and committed **before the experiment is run**, and
before the instrument that runs it (row 9.3b) is even wired, the same
discipline as `docs/uta-rldd-plan.md`, `docs/drozy-analysis-plan.md`, and
`docs/alertness-score-plan.md`. It is roadmap row 9.4.

The commit that adds this file contains **no result**. The result arrives
later, after the maintainer runs the session on their own camera, and can be
checked against what is written here.

## The question

Does blinklab's pupil-diameter estimate (`src/core/pupil.ts`, rows 9.2/9.3a,
wired live in 9.3b) detect the **pupillary light reflex** — the pupil
constricting when the screen goes bright — on a real webcam?

## Why this experiment, and why it is the honest test

The synthetic tests prove the arithmetic: a dark disc of known size on a
grey iris comes back at the right millimetres, and the estimator refuses a
flat, occluded, or implausible eye. What they cannot prove is that a webcam
in a real room ever gives the estimator a dark disc to measure. The light
reflex is the right ground truth for that, because it is one of the
**largest and most reliable signals the eye produces**: raise the light and
the pupil constricts, in everyone, within a second, by a wide and
well-documented margin. So if the estimate can track anything real, it can
track this; and if it cannot detect even the light reflex, then webcam
pupillometry through this path is **not viable**, and that is a genuine,
publishable negative about the instrument rather than a failure of the
experiment. This experiment tests the instrument, using physiology as the
reference.

## The data

The **maintainer**, one camera, one session, in a room where **the screen is
the dominant light source** (blinds drawn, no strong lamp), so the stimulus
below actually changes how much light reaches the eye. The safeguards are
unchanged from every other measurement here: **numbers only, never a frame.**
The analysis reads the `pupilDiameterMm` column the app exports at about one
row per second, and its `null` rows (the estimator's refusals) are data, not
gaps to paper over.

## The stimulus, fixed in advance

A full-screen brightness alternation the maintainer runs on this fixed
schedule: **six cycles of 20 seconds dark (near-black screen) then 20
seconds bright (near-white screen)**, 240 seconds total, after a 20-second
settle that is discarded. The phase of every second (dark or bright) is
known from the schedule. The exact mechanism — a minimal in-app stimulus
screen or a manual full-screen toggle on a timer — does not matter to the
analysis as long as the schedule is the one recorded here and the schedule
is logged beside the readings.

## The measurement and the usable-data gate, fixed in advance

Each second contributes its `pupilDiameterMm` where the estimator returned a
value, and is dropped where it refused (null). Because a session in which
the estimator refuses most frames cannot answer the question either way, the
result is reported as **inconclusive (instrument could not resolve the
pupil)** rather than as a null if fewer than **half** the in-window seconds
carry a value, or if either phase has fewer than **20** usable seconds. This
gate is fixed here, before the data, exactly like the 25 fps floor.

## The metric and the negative control, fixed in advance

The pupil should be **smaller in the bright phase than the dark phase**.

- **Primary statistic:** the median `pupilDiameterMm` over all usable dark
  seconds minus the median over all usable bright seconds. The reflex
  predicts this is **positive** (dark pupils larger).
- **Negative control:** the per-second phase labels are permuted 1000 times
  from one fixed seed, and the same dark-minus-bright median difference is
  recomputed on each shuffle. The observed difference must lie **above the
  97.5th percentile** of that shuffled null (a one-sided permutation p below
  0.025). One-sided because the reflex's direction is fixed in advance;
  a constriction the wrong way (bright pupils larger) is not a success.

## The decision rule, fixed in advance

- **Detected** — the reflex is measurable — only if the dark-minus-bright
  median difference is positive AND above the 97.5th percentile of the
  shuffled null (p < 0.025), with the usable-data gate cleared.
- **Null** — the estimate did not detect the reflex — if the difference does
  not clear that bar while the usable-data gate was cleared. Published as
  readily as a detection.
- **Inconclusive** — if the usable-data gate was not cleared: the estimator
  refused too often to say anything, which is a fact about the instrument in
  this room, reported as such.

## The expectation, committed in advance (predict-then-verify)

Stated before the run: **I expect a detection — the pupil constricts to the
bright screen and the difference survives the shuffle.** The reason is that
the light reflex is large and robust, so if the estimator resolves real
pupils at all, this is the signal it should catch. The honest counterweight:
webcam pupil segmentation is genuinely hard, and the most likely way this
comes back NOT a detection is the **inconclusive** branch — the estimator
refusing most frames because a webcam iris interior is small, low-contrast,
and often lash-occluded. If that happens, the finding is that this path to
pupillometry does not work on this hardware, and it is recorded as plainly
as a detection would have been. A clean null (enough usable data, but the
pupil does not track the light) would be the more surprising outcome and
would equally stand.

## What this cannot answer

- **One person, one camera.** A detection shows the instrument can sense a
  strong relative change on this eye and rig, not that it works across
  people or rooms.
- **Relative, not absolute.** This tests whether the pupil gets smaller in
  bright light, not whether the millimetre value is accurate. This is not a
  clinical pupillometer.
- **The screen must be the dominant light.** If ambient light swamps the
  screen, the stimulus is weak and a null would be uninformative about the
  estimator; hence the room condition above is part of the protocol.

## What would count as this being wrong

Stated in advance and still binding. If a later run — a corrected sampling
region, a brighter stimulus, a better-lit iris — reverses a conclusion drawn
here, that reversal belongs on the result page in writing, the way the
UTA-RLDD reversal was recorded on its own. A detection later traced to an
artefact (the sampled region tracking the screen's reflection on the eye or
skin rather than the pupil, say) is retracted here, not quietly dropped.
