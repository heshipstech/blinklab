# Chunk 4: measurement and mathematics

Part of the August 2026 audit. See `AUDIT_PLAN.md` for scope and method.

Covers E1 to E7: the alertness score, blink closing velocity, the iris
ruler and eye aspect ratio, every magic number, the four constants added
under pressure, the Python statistics, and whether the published
benchmark comes from the code this repository holds now.

Completed 10 August 2026. Findings below are final for this chunk.

---

## Method

Six auditors, told to **re-derive rather than trust**. That the tests
pass was not the question. Every claim was recomputed independently, by
hand or by a separate implementation, and compared against what the code
produces.

Each finding had to be labelled as one of three kinds, because these get
blurred and they are very different problems:

- **maths-wrong**: the arithmetic is incorrect.
- **claim-mismatch**: the arithmetic is right but the documentation says
  it is something else.
- **unstated-assumption**: right and honest, but resting on an
  assumption nobody wrote down.

Fifty-two findings. **Fourteen tested by skeptics across two passes.
Three survived. Eleven were refuted.**

---

## Headline

**The mathematics is right.** Almost everything the auditors reached for
turned out to be either correct, already disclosed, or without
measurable consequence.

The single most important result: **the published headline reproduces
exactly from an independent reimplementation.** A skeptic rewrote the
evaluation from the stated rules alone, importing none of the project's
own code, ran it over the measured corpus, and got the published recall
and precision. The 72.0 percent miss claim re-derives too, and its set of
50 misses matches.

**Frame accounting is exact.** Parsing the MP4 container atoms directly
gives 15784 + 11182 + 9216 + 5405 + 10663 + 5134 + 9077 + 4895 =
**71,356**, identical to the header the instrument wrote.

**The measurement code has not moved since the published run.**
`git diff --stat 5e7af7e..HEAD -- src/ public/` is three files, 147
insertions, 3 deletions, all additive.

---

## Surviving findings

### M1. A blink can be published with the previous blink's shape

**Medium. maths-wrong. Verified.** (E2)

The window `main.ts` builds to analyse a blink's closing shape can reach
back far enough to cover the blink before it. A skeptic rebuilt the
pipeline in a scratch copy, drove the real `blinkStep` and the real
`analyzeClosing` through the exact window `main.ts:1948-1951`
constructs, on a synthetic 30 fps trace where the answer is known by
hand, and confirmed it.

This is the only genuine arithmetic error found in the chunk. It affects
the `amplitudeMm`, `peakClosingVelocityMmPerS` and
`amplitudeOverVelocityMs` columns of an exported blink log when two
blinks fall close together.

### M2. The displayed eye aspect ratio is computed in the wrong space

**Medium. claim-mismatch. Verified, and sharper than filed.** (E3)

`src/core/ear.ts:24-33` never converts to pixels. `src/core/aperture.ts:15-21`
does. So the ratio printed on the page is computed in anisotropic
normalised coordinates, where a unit of `y` is not a unit of `x`.

Measured on the repository's own 300 recorded frames at 1280x720:

|                        | Median right EAR |
| ---------------------- | ---------------- |
| As the app computes it | 0.4834           |
| In true pixel geometry | 0.2787           |

The factor is 1.74, which is the frame aspect ratio. This is precisely
the trap `aperture.ts:10-13` warns about: it "would skew every
millimetre by that factor, silently".

The skeptic found the consequence is worse than a constant relabel.
Rotating the real eye landmarks about their own centre, **the displayed
EAR moves 13 to 27 percent at the pose gate's own 25 degree roll limit**,
while the pixel-space EAR is invariant to five decimals.

That falsifies `SPEC.md:137`, which states EAR is "invariant under head
roll by construction, proven at 0, 15 and 30 degrees". The proof at
`test/core/tiltInvariance.test.ts` runs at a square 1000x1000 frame,
where the anisotropy cannot appear.

Three further contradictions: `ear.ts:5` and `LEARNING.md:199` cite the
literature's ~0.3 open value while the owner's own frames display ~0.50,
and `test/MANUAL.md:19`'s stated band of 0.25 to 0.45 is violated by
**239 of 300 fixture frames** under the app formula, and by none under
pixel geometry.

**No published number moves.** EAR is absent from `FeatureRecord`, from
the CSV export, from the score, and from every evidence pipeline, all of
which use the pixel-converted `apertureMm`. It is a displayed number
only.

### L1. The score's two blink-shape penalties read an unbounded-age snapshot

**Low. unstated-assumption. Verified.** (E1)

Thirty of the hundred points can be charged from a blink of any age,
while the long-closure penalty is correctly windowed. A freshness
assumption rather than a windowing error, and it moves no published
number.

---

## Refuted findings

Eleven of fourteen. Several of these close questions that would
otherwise have sat open, and two are more valuable than any finding.

**"The negative control walks the same 1000 permutations the p-value
already counted."** → **low**

The stream claim is true. The inference is not.

A permutation p-value **is** a summary of a shuffled-label null. The
control prints two more summaries, the maximum and the median, of the
same distribution. Using an independent seed would print a distribution
the p-value did not come from, which would be worse, not better.

The skeptic tested whether the published statement is a seed artefact:
over **500 independent seeds**, the chance maximum ran 0.595 to 0.909
and the null median 0.141 to 0.176, bracketing the published values.
Seeds where the chance maximum fell below the observed 0.444: **0 of
500**. The README's statement is a structural property of n=20 with 1000
draws, not luck.

Only residue: `docs/drozy-analysis-plan.md:89-92` says the labels are
shuffled "and the whole analysis re-run", which is looser than what the
roadmap row and the code actually deliver.

The skeptic also ran the full-pipeline null nobody had run: 400 trials,
7 features, Holm and the within-subject check on shuffled labels. The
"suggestive and unconfirmed" label fires in 97.5 percent of pure-noise
runs, because 3-of-5 is a coin flip. **No published text uses that
label**, so nothing rests on it, and the headline "nothing survives it"
is untouched. It is a real observation about the within-subject bar and
belongs in the report as one.

**"The analysis deviates from its pre-registration."** → **low**

Factually wrong on the sequencing. On the branch, the plan landed at
23:32:57 and the code at 23:37:38, and `git diff` between them shows the
code commit never touched the plan. The result arrived the next day,
exactly as the plan promised.

The skeptic reimplemented the app's blink-rate estimator from
`src/core/blinkRate.ts` and reproduced the app's own exported column to
`max|diff| = 0.000000`. The two estimators differ by 5 to 7 percent and
rank-correlate at 0.96. Reaching significance would need a shift of
0.51; the worst case observed in 2,000 simulations was 0.455, once.

**"The 11.7 mm iris assumption is undisclosed and costs accuracy."** →
**low**

The most elegant result in the audit. `IRIS_DIAMETER_MM` has exactly one
production use, so a wrong iris size is a single multiplicative factor
on the whole millimetre feed. **Every downstream decision is a ratio
against the person's own baseline computed from that same feed, so the
factor cancels exactly.**

The architecture was already immune. It affects only the absolute
millimetre columns, which `MODEL_CARD.md` already lists as unvalidated.

**"'Identical, byte for byte' is claimed with no evidence."** → **low**

A post-fix run did happen and is recorded with checksums, in pull
request #189's body and in the commit message: three runs before at 43
detections with three different checksums, three runs after at 54
detections all `719ebe5c...`. The skeptic reproduced that checksum
independently from the dataset on disk.

What survives is that the evidence lives in a pull request body rather
than in `docs/evidence/`, and only the blink rows were hashed.

**"`MIN_BLINK_FPS = 25`'s written reason is arithmetically false."** →
**low**

The comment is hedged ("can be", "may fall"), and a 30 to 35 ms closed
phase at 24 fps really is missed entirely 16 to 28 percent of the time.
The "two frames" derivation the auditor offered as the correct
alternative is **already stated, correctly, in four places**, including
the shipped refusal string in `fpsGate.ts:50`.

**"A bare 400 in `main.ts` moves published amplitude and velocity."** →
**low**

Real as an unnamed literal with no derivation. But a sweep from 0 to
2000 ms shows peak velocity is bit-identical from 100 to 800 ms and
amplitude changes by 0.00 to 2.88 percent. **400 sits mid-plateau**, not
on a knife edge.

Also refuted: the peak-velocity attenuation is real, 22 to 38 percent at
30 fps, but monotone, so it moves the published Spearman correlations by
about 0.04. The ramp-floor and weight findings failed on chronology and
on a post-hoc statistical move the pre-registration exists to forbid.

---

## What is compliant

### The statistics are exactly right

Every one verified against an independent implementation.

- **Spearman**: re-derived two ways, exact-rational Pearson-on-ranks and
  the tie-corrected shortcut, matching on 600 inputs including heavy
  ties. Average-rank tie handling correct.
- **Holm**: 400 random p-vectors, ties in 85, hitting the 1.0 clamp in 301. Maximum difference against R's `p.adjust(method="holm")`:
  **0.000e+00**. The running maximum that enforces monotonicity is
  present, and its effect is visible in the published table.
- **The permutation test**: `(hits+1)/(iterations+1)` is the correct
  unbiased form and the `+1` is in both places. Matched against
  **exhaustive enumeration** of all 720 permutations at n=6.
- **The in-place shuffle**, flagged as a worry in two earlier chunks, is
  **correct**. 240,000 in-place shuffles of a 4-element list hit all 24
  permutations, 9789 to 10166 each.
- 1000 iterations is not a trap: the smallest attainable raw p is
  0.000999, which survives the worst Holm multiplier.

### The ruler

- The ruler is the **horizontal** iris diameter only, never averaged
  with the vertical pair, and the reason is written down. Under 20
  degrees of pitch the width ruler errs 6 percent where a width/height
  average would err more.
- The EAR formula is the published Soukupova and Cech definition
  exactly, with no deviation.
- `apertureMm` converts to pixels before mixing directions, verified by
  re-projecting synthetic faces into 16:9.
- The pose gate is a real refusal that names the axis, the angle and the
  limit.
- `README.md:16` scopes the headline claim correctly to distance only.

### The constants

- `BLINK_APERTURE_THRESHOLD_MM = 4` corroborated by independent replay
  of the fixture.
- The claimed 133 and 117 ms blink durations reproduce exactly.
- Amendment 5's premise holds: 0 of 300 fixture frames fall below 20
  percent of baseline, and the floor sits at 27.2 percent, so the
  literature's line really was unreachable.
- **The refractory period's disclosure is verbatim and accurate**, and
  it was not fitted: merging detections 2 frames apart already captured
  every close pair, and it cost zero recall.
- Aliased constants cannot drift: PERCLOS aliases the shut line, and the
  long-closure threshold aliases the maximum blink duration.
- **No threshold constant was ever retuned after being set**, confirmed
  a third time by independent pickaxe search.

### Provenance

- The headline reproduces from an independent reimplementation.
- Frame accounting exact, from the container atoms.
- The bundle guard is **automatic**, called before the browser launches
  and exiting non-zero on mismatch.
- No float drift in the seek schedule: each seek is computed from the
  index, not from the previous answer.
- The exported frame rate is a property of the clip, not the machine.
- The model is pinned in git, and the library is pinned with an
  integrity hash.
- `STATE.md:235-238` already names the project's own provenance gap.

### The score

- A resting person scores exactly 100, computed on the real module.
- All 101 integers are reachable with no clamping and no gaps.
- Two of the three ramp floors are derived from recorded observations as
  `SPEC.md` claims, re-derived independently with real margin.
- `scorePanel` computes nothing, so panel and score cannot disagree.
- `MODEL_CARD.md:30` calls the score "a heuristic, not a measurement"
  and says it "has never been shown to correspond to how sleepy anyone
  actually is". `README.md:423-425`, written after the null result,
  repeats that rather than spinning it.

---

## What could not be checked

- The true human lid-closing trajectory. The sampling estimates use two
  standard models, not measurement. The direction is robust; the
  percentages are model-based.
- Whether real resting PERCLOS stays below the 5 percent ramp floor.
  Needs a live session with a real face.
- Whether the DROZY nulls would change under a resolution-aware
  estimator. The source video is deleted by the licence safeguard, so
  the analysis cannot be re-run here.
- Any alternative score weighting ever considered. No ADR, no amendment,
  no record.

---

## Carried into the final report

1. **The mathematics is sound.** Eleven of fourteen tested findings
   refuted, the headline reproducing from an independent
   reimplementation, the statistics matching R to zero difference. That
   is the finding.
2. **Two real defects**: a blink can carry its predecessor's shape, and
   the displayed EAR is computed in the wrong space and drifts with head
   roll against a written invariance claim.
3. **The within-subject bar fires on pure noise 97.5 percent of the
   time.** Nothing published uses it, so nothing is wrong today, but it
   should not be used in future without a fix.
4. **The 400 ms lead-in, the score weights and the plan's "whole
   analysis re-run" phrasing** are all loose rather than wrong. Each is
   a one-line correction.
