# UTA-RLDD drowsiness-classification plan (Track B), written before any classifier is fit

This document was written and committed **before any UTA-RLDD feature was
fed to a classifier**, and before the classifier code exists. That is its
whole purpose. It is roadmap rows 7.5 (a baseline classifier with a stated
train/test split and a fixed seed) and 7.6 (leave-one-subject-out
evaluation, per-subject scores).

Those rows were HELD under amendment 8, for want of a dataset large enough
to train a classifier and still hold out whole subjects; DROZY yields only
20 sessions from 13 subjects. Amendment 10 removed the other half of the
block: Professor Vassilis Athitsos granted written permission to publish
features and results derived from UTA-RLDD, which is large enough for a
defensible leave-one-subject-out. So the data gate is cleared; what remains
is to do the thing honestly.

The DROZY track (`docs/drozy-analysis-plan.md`) asked whether the features
_correlate_ with a graded sleepiness rating, and the answer was a published
null (`docs/drozy-result.txt`). This asks a different question — whether the
same features can _classify_ a coarser, larger-sample drowsiness label
across strangers — and it is pre-registered for the same reason, only more
so: a classifier is easier to fool than a correlation, above all through
**subject-identity leakage**, where a model that has quietly learned to
recognise people scores well until the day someone checks whether it
generalises to a person it never saw.

The commit that adds this file contains **no results and no classifier
code**. Both arrive in a later commit, after the owner runs the UTA-RLDD
videos through the feature extractor, and can be checked against what is
written here.

## The question

Can the per-second features blinklab already computes classify UTA-RLDD's
self-reported drowsiness state better than chance, **when no subject appears
in both the training and the test set**?

## The data

UTA-RLDD, the Real-Life Drowsiness Dataset, used under written permission
from Professor Vassilis Athitsos recorded in `DATASETS.md`. The condition of
that permission, and the citation required wherever results appear in any
form: Ghoddoosian, Galib and Athitsos, "A Realistic Dataset and Baseline
Temporal Model for Early Drowsiness Detection," CVPR Workshops 2019.

- **The label is a coarse self-reported state, not a scale.** Each subject
  recorded three videos of themselves and declared each one **alert**, **low
  vigilant**, or **drowsy**. Unlike DROZY, UTA-RLDD carries no Karolinska
  Sleepiness Scale rating; the label is the subject's own three-way state
  declaration for the whole video, not a per-second annotation. The
  three classes are balanced by construction: one video per state per
  subject.

- **The safeguards stay in force regardless of the permission**
  (`DATASETS.md`), because the participants recorded themselves and their
  consent terms are published nowhere, so no author can grant rights over a
  face beyond what its owner allowed: **numbers only, never a frame**;
  pseudonymous subject identifiers; the source video deleted once its
  per-second features are computed; the 2019 paper cited prominently. This
  analysis reads only the feature CSVs the app produced. It never sees a
  pixel, exactly as `analysis/` never sees a pixel of DROZY.

- **The 25 fps floor decides who is measurable, before any label is
  consulted.** blinklab refuses to measure blinks below 25 frames per second,
  because at 15 fps a 100 ms blink spans a frame and a half. Any UTA-RLDD
  video below 25 fps is excluded, and the exclusion is a property of the
  frame rate alone, fixed before a single label is read, exactly as DROZY's
  was. The surviving count of subjects and videos is whatever that rule
  leaves, and it is printed above any accuracy, not buried beneath one. If
  the floor removes subjects unevenly across the three states, that bias is
  stated the way DROZY's excluded-16 bias was.

- **One example per video.** Each surviving video contributes a single
  feature vector: the seven features below, each taken as its **median over a
  fixed window** — seconds 60 to 360, a five-minute window after a
  one-minute settle, identical for every video, so recording length cannot
  masquerade as a signal (the DROZY plan's concern, met here by both a fixed
  window and a median). A video with fewer than five measured minutes after
  the settle is excluded, by the same before-the-label rule as the fps floor.
  The unit of classification is therefore the video, and the label is the
  video's declared state.

## The features

The same seven the app already exports per second, the identical list the
DROZY analysis used. No new measurement is invented for this analysis.

1. **Blink rate**, blinks per minute
2. **Blink duration**, mean closed phase in milliseconds
3. **Blink amplitude**, mean lid travel in millimetres
4. **Closing velocity**, mean peak speed in millimetres per second
5. **Amplitude over velocity**, mean ratio in milliseconds, the shape the
   literature associates with drowsiness
6. **PERCLOS**, mean share of the minute with eyes closed
7. **Long closures**, count of closures beyond half a second

## The model, fixed in advance

- **The baseline classifier (row 7.5)** is multinomial logistic regression
  with L2 regularisation on the seven features. It is deliberately simple and
  interpretable: it is the baseline a future learned model would have to
  beat, and it must itself clear the floor below. Its coefficients are
  reportable, so a positive result can be read as a claim about which
  features carried it rather than an oracle.

- **Standardisation happens inside the fold, never across it.** Each feature
  is centred and scaled using **only the training fold's** mean and standard
  deviation, applied unchanged to the held-out subject. Fitting the scaler on
  all the data first is a small, common, invisible leak, and it is exactly
  the kind this plan exists to forbid.

- **The floor it must clear** is the majority-class baseline: predict the
  most common class always. With three balanced classes, chance and the
  majority baseline both sit at a balanced accuracy of **1/3**. A classifier
  that does not clear 1/3 under the evaluation below has found nothing.

- **The fixed seed (row 7.5's check).** The solver and any internal shuffling
  run from one recorded seed, so the whole analysis reproduces bit for bit.
  The leave-one-subject-out fold assignment is deterministic from the subject
  id and needs no seed; the seed governs only the label-shuffle control and
  the solver.

## The evaluation, fixed in advance

- **Primary: leave-one-subject-out (row 7.6).** Each fold holds out **every**
  video of one subject; the model trains on all other subjects and predicts
  the held-out subject's videos. No subject is ever in both splits. This is
  the check the row exists for, and the one that separates a model that has
  learned drowsiness from one that has learned to recognise faces, framing or
  webcams. **Per-subject scores are reported**, not only a pooled number, so
  a result that rides on a handful of subjects cannot hide inside an average.

- **The metric is balanced accuracy** — the mean of the per-class recalls —
  computed over the pooled out-of-fold predictions, with the full confusion
  matrix printed beside it. Balanced accuracy because a single fold's
  held-out subject contributes only three videos, so per-fold accuracy is too
  granular to read; the pool is where the number lives.

- **A pre-specified secondary: the binary collapse.** Alert versus drowsy —
  the two extremes, dropping the low-vigilant middle, which is the noisiest
  self-report — run through the identical leave-one-subject-out and reported
  _beside_ the three-class result, never instead of it. It is named here in
  advance so it cannot become the one that "worked" chosen after the fact.

- **The negative control (row 7.7's discipline, applied here).** The labels
  are permuted across videos 1000 times from the fixed seed, and the whole
  leave-one-subject-out is re-run on each permutation. The observed balanced
  accuracy must sit outside that shuffled null distribution to count. This
  control does double duty: it catches a pipeline that finds a signal in pure
  noise, and it catches leakage, because a held-out accuracy that survives
  having its labels shuffled was never reading drowsiness in the first place.

## The decision rule, fixed in advance

The classifier is reported as **detecting drowsiness** only if BOTH hold:

1. its leave-one-subject-out balanced accuracy lies **above the 97.5th
   percentile** of the shuffled-label null (a one-sided permutation p below
   0.025), and
2. it clears the **1/3 majority floor** by a margin the null distribution's
   own spread shows is not chance.

Anything that clears one and fails the other is reported as **suggestive and
unconfirmed**, in those words.

If nothing clears the bar, **that is the result**, and it is published
exactly as readily as a positive one would have been.

## The expectation, committed in advance (predict-then-verify)

Stated before the classifier is fit, so it can be checked against later:
**I expect this to return a null — the classifier does not beat chance under
leave-one-subject-out.** The reason is the evidence already in hand: the
DROZY analysis found no blink feature tracking a graded sleepiness rating
(`docs/drozy-result.txt`), and a coarser, self-reported three-way label is
unlikely to be easier to recover than the scale was. UTA-RLDD's larger sample
(roughly 60 subjects against DROZY's 13) is the one way a genuine weak signal
could surface here that DROZY was too small to see — that is the honest route
to a positive result. The dishonest route is subject leakage, and a high
accuracy that **collapses** under the label-shuffle control is leakage, not
drowsiness. A leave-one-subject-out accuracy well above 1/3 that **survives**
the shuffle would be the surprising, genuine finding, and it would be
reported as surprising.

## What this cannot answer

- **The label is a coarse, self-reported state**, not a graded scale, and
  people judge their own drowsiness poorly. Its noise cannot be separated
  from measurement noise.
- **One video per state per subject** means the alert and drowsy videos
  differ in more than drowsiness — time of day, session order, how the person
  sat — and the classifier cannot separate drowsiness from those confounds.
- **Self-recorded video in unknown lighting and framing.** Every limitation
  the six-person validation round found in live-camera measurement
  (`docs/validation-round.txt`) applies per video, and the frame-rate floor
  is the only one this plan controls for.
- **This is classification, not causation, prediction, or driving-relevant
  drowsiness.** Nobody in UTA-RLDD was driving.

## What would count as the analysis being wrong

Stated in advance so it can be checked later. If a later run — more subjects,
a different window, a corrected frame-rate floor, or a leak found after the
fact — reverses any conclusion drawn here, that reversal belongs on the same
page as the original, in the same way the three Eyeblink8 numbers do. In
particular, **any positive result a later audit traces to subject leakage is
retracted here, in writing, not quietly dropped.**
