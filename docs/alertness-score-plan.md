# Alertness-score plan: does a learned weighting beat the demo heuristic? — written before any comparison is run

This document is written and committed **before the comparison it describes
is run, and before the comparison code exists**. That is its whole purpose,
the same discipline as `docs/uta-rldd-plan.md` and `docs/drozy-analysis-plan.md`.

It is roadmap Phase 9's line: _"a small learned model to replace one
heuristic, with the heuristic kept as the baseline it must beat."_ The
heuristic in question is the demo alertness score (`src/core/score.ts`,
roadmap 6.5): a 0–100 number a person glances at, built as `100 − penalties`
from four named, hand-tuned ramps (PERCLOS, long closures, slow blinks,
sluggish lids). The README now states plainly that this score _"has never
been shown to correspond to anyone's actual sleepiness."_ This plan is how
that sentence gets tested rather than left standing.

The commit that adds this file contains **no result and no comparison
code**. Both arrive in later commits and can be checked against what is
written here.

## The question

For reducing blinklab's per-second eyelid features to a single alertness
number, does a **learned** weighting separate self-reported drowsiness
better than the **hand-tuned demo heuristic** — and is the demo heuristic
even above chance in the first place?

Two sub-questions, both pre-registered:

1. **Is the demo heuristic meaningful at all?** Does the current 0–100 score
   separate UTA-RLDD's alert videos from its drowsy videos better than
   chance? The README admits this was never checked.
2. **Does a learned model beat it?** Does a model actually trained on the
   drowsiness label out-separate the heuristic by a margin that survives a
   label-shuffle control?

## The data

UTA-RLDD, under the written permission recorded in `DATASETS.md`, cited
wherever results appear: Ghoddoosian, Galib and Athitsos, "A Realistic
Dataset and Baseline Temporal Model for Early Drowsiness Detection," CVPR
Workshops 2019. This reuses the **exact usable set** the UTA-RLDD
classification already fixed (`docs/uta-rldd-result.txt`): the same
per-second feature CSVs, the same 25 fps floor and five-minute-window gates
applied before any label is read, the same 60–360 s window, the same
pseudonymous subject ids. The safeguards are unchanged: **numbers only,
never a frame.** No new measurement is taken and no video is touched; this
analysis reads the same CSVs the UTA-RLDD run did.

The unit is the video, and the two extremes — **alert vs drowsy** — are the
primary contrast, because a 0–100 alertness score is a one-dimensional
alert↔drowsy quantity and the low-vigilant middle is the noisiest
self-report (the same reason the UTA-RLDD plan named the binary collapse a
secondary).

## The two things being compared

**The baseline — the demo heuristic, unchanged.** `src/core/score.ts`
scored the last minute of feature records as `100 − penalties` from four
ramps. For this comparison it is reimplemented in Python **faithfully and
per-second**: at each second it is fed that second's PERCLOS, the growth of
the long-closure counter over the preceding 60 s, that second's last blink
duration, and that second's amplitude-over-velocity ratio, and it returns
the same whole-point `100 − penalties` the TypeScript returns. The video's
heuristic scalar is the **median of that per-second score over 60–360 s**,
the identical window and reduction the learned model's features use, so the
two are compared on the same videos over the same window.

- **The port is pinned to the TypeScript, not merely re-derived from the
  same prose.** Its test asserts the documented ramp outputs the
  TypeScript's own tests already fix (e.g. PERCLOS 0.10 → 20 points, two
  in-window long closures → the 30-point cap, a 350 ms blink → 8 points),
  so a port that drifts from `score.ts` reddens the build. The heuristic
  takes **no** training and no labels, so it is applied once; there is
  nothing to hold out.

**The contender — the learned model, unchanged.** The same numpy
multinomial logistic regression the UTA-RLDD run used
(`analysis/blinklab/rldd.py`): standardised and median-imputed **inside
each fold**, fit deterministically from zero, evaluated
**leave-one-subject-out** so no subject is in both splits. For a
threshold-free comparison it is read out as the **out-of-fold probability
of the drowsy class** for each held-out video, not its argmax label.

## The metric, fixed in advance

**AUC — the area under the ROC curve — for alert vs drowsy**, computed by
hand as the Mann–Whitney concordance (the share of alert/drowsy video pairs
the score orders correctly, ties counted as a half), because the analysis
venv carries no scikit-learn or scipy. AUC is chosen because it is
**threshold-free**: it asks whether the score _ranks_ drowsy above alert,
without picking a cutoff, which is the right question for a 0–100 dial whose
cutoff is a separate product choice. Chance is 0.5.

- The heuristic's AUC uses `100 − heuristic_scalar` (higher = drowsier)
  against the true labels; no fold is needed, as it is not fit.
- The learned model's AUC uses the out-of-fold drowsy probability against
  the same labels.

## The negative controls, fixed in advance

Two label-shuffle controls, each 1000 permutations from one fixed seed, the
same discipline as the UTA-RLDD run:

- **Is the heuristic above chance?** Its AUC against the true labels is
  compared to its AUC against 1000 shuffled labelings. The heuristic's
  scores are fixed, so under shuffling its AUC collapses to ≈0.5; the
  observed must sit above that null.
- **Does the model beat the heuristic?** The observed **difference**
  `AUC(model) − AUC(heuristic)` is compared to the same difference computed
  under 1000 shuffled labelings, with the model **refit leave-one-subject-out
  on each shuffle**. Under shuffling both AUCs fall to ≈0.5 and the
  difference centres on 0; the observed difference must sit above that null.

## The decision rule, fixed in advance

- **Bar 1 — the heuristic is meaningful:** its alert-vs-drowsy AUC lies
  above the 97.5th percentile of its shuffled null (one-sided permutation
  p < 0.025).
- **Bar 2 — the learned model beats it:** the observed
  `AUC(model) − AUC(heuristic)` is positive **and** above the 97.5th
  percentile of the shuffled-difference null (one-sided permutation
  p < 0.025).

The four honest outcomes, each reported in these words:

- **Both bars** → "the demo heuristic already tracks drowsiness above
  chance, and a learned weighting beats it" — which _recommends_, in a
  separate later increment, adopting a learned score with the heuristic kept
  as the baseline it beat. This plan does **not** change `src/core`.
- **Bar 1 only** → "the demo heuristic already tracks drowsiness above
  chance, and the learned model does not beat it beyond the shuffle" — keep
  the heuristic; it was doing its job.
- **Bar 2 only** → "the heuristic is at or below chance, and the learned
  model out-separates it" — the demo score is close to meaningless and
  should be reconsidered.
- **Neither** → nothing separates these labels through either route, and it
  is published exactly as readily as a positive would have been.

A pre-specified **secondary**, reported beside the primary and never instead
of it: the **Spearman rank correlation** of each score with the ordinal
label (alert < low-vigilant < drowsy) across all three states, testing
whether either score orders the middle state where it belongs.

## The expectation, committed in advance (predict-then-verify)

Stated before the comparison is run, so it can be checked against later:

**I expect Bar 1 to hold and Bar 2 to hold modestly.** The heuristic already
leans on PERCLOS and long closures, which the UTA-RLDD run found were the
two features carrying the signal, so I expect the demo score to be **clearly
above chance** — the "never been shown to correspond" sentence is a gap in
evidence, not evidence of a meaningless score, and I expect this to show the
former. I expect the learned model to **beat it**, because it is fit to
exactly this label and uses all seven features rather than four, but by a
**modest margin** for the same reason the heuristic does well: the dominant
features are already in the heuristic. The genuinely open part is whether
that modest edge **survives the shuffle control** — if it does not, the
honest conclusion is that the explainable hand-tuned score is as good as the
learned one here, and there is no case for replacing it.

## What this cannot answer

- **Cross-subject classification is not a live per-person meter.** UTA-RLDD
  asks whether a score separates _one stranger's alert video from another
  stranger's drowsy video_. The demo score in the app is a live dial for
  _one person over time_. Beating the heuristic here does **not** show the
  learned score is a good live per-person alertness meter; it shows only
  which fixed weighting of these features better separates a coarse
  self-reported label across strangers. That gap is not closed by this work
  and must not be claimed closed.
- **The heuristic was never fit to any label.** It was tuned for
  explainability and to score a resting person 100, not to maximise
  separation on UTA-RLDD. "The learned model beats it" is therefore the
  _expected_ direction; the interesting quantities are the size of the gap,
  whether it survives the control, and whether the heuristic is above chance
  at all — not the mere sign of the difference.
- **Every UTA-RLDD limit still applies:** a coarse self-reported label, one
  video per state so confounds cannot be proven separate, self-recorded
  conditions, and nobody was driving. This is classification, not causation,
  prediction, or driving-relevant drowsiness.

## What would count as this being wrong, and what happens next

Stated in advance. If a later run — more data, a corrected window, a leak
found after the fact — reverses a conclusion drawn here, that reversal
belongs on the result page in writing, the way the UTA-RLDD reversal was
recorded on its own page. **Adopting a learned score into `src/core` is a
separate increment that happens only if Bar 2 is met**, is its own decision,
and carries its own measurement-neutrality gate; this plan authorises the
comparison, not a change to the app.
