# Chunk 3: the test pyramid

Part of the August 2026 audit. See `AUDIT_PLAN.md` for scope and method.

Covers checklist D1 to D10 and A3: whether tests assert properties rather
than mocks, whether every threshold has a below, at and above case,
whether refusals are asserted as null rather than zero, the five pyramid
layers, and what is not covered at all.

Completed 10 August 2026. Findings below are final for this chunk.

---

## Method

Six auditors, all permitted to run experiments in scratch copies of the
repository. The central one did **mutation testing**: it broke the code
deliberately, 122 separate ways, and ran the whole suite after each one.

A test that does not fail when the code is wrong is not a test. Mutation
testing is the only honest way to check the master prompt's first rule.

Fifty-nine findings. Twelve went to skeptics told to refute them, across
two passes.

**An integrity note.** Partway through this chunk, 57 documentation and
evidence files were found deleted from the working tree. All were
committed and pushed, nothing was lost, and they were restored. No
command in any agent transcript accounts for it and the cause is
unknown. It did not touch `src/`, `test/` or `analysis/`, which is
everything this chunk reads, and the tree was verified clean at
`750fa07` before and after the audit ran. Recorded here rather than
omitted.

---

## Headline

**The mutation score is 98 of 122, or 80.3 percent. Excluding seven
mutations that provably change nothing, 85.2 percent.**

For a hand-written suite with no mutation tooling in continuous
integration, that is a strong result, and it is now a number rather than
an impression.

**No high-severity finding survived verification.** Third chunk running.

**Seven of twelve verified findings were refuted**, the highest rate in
the audit so far, and the refutations are the most valuable material in
this chunk. Three separate worries about the published benchmark numbers
were each measured against the real corpus and found to change nothing
at all.

---

## The single best result

**All 15 refusal-removal mutations were killed.**

The mutation family that matters most in this codebase is changing a
`return null` into a number. That is the master prompt's fourth rule,
"null over guessing", and it is the discipline the whole project rests
on.

Every one of the fifteen was caught: `aperture` twice, `ear`,
`headPose`, `perclos` twice, `longClosure`, `blinkShape`, `blinkRate`
twice, `score`, `fixation`, `calibrationProfile` twice, `gazeOffset`.

**Null-over-guessing is the best-defended property in this repository.**

Six modules scored 100 percent: `aperture` 7/7, `ear` 4/4, `blinkRate`
6/6, `gazeOffset` 6/6, `statistics` 4/4, `headPose` 3/3, `fpsGate` 2/2,
`longClosure` 10/10.

Every arithmetic mutation on a published quantity was killed, including
inverting the millimetre conversion, swapping the standard-deviation
ratio, inverting the amplitude-over-velocity ratio, flipping the score
identity from minus to plus, and breaking the least-squares slope.

And the project has already done this once by hand:
`test/core/longClosure.test.ts:290` is literally
`describe("after the gap, found by mutation testing before the pull
request")`. That module scored 10 out of 10 here. The practice works. It
is simply not systematic.

---

## Surviving findings

### Medium

**M1. `baseline.ts` has three gates with no boundary test and no pinned
value.** (D3)

`BASELINE_LEARN_MS`, `BASELINE_MIN_SAMPLES` and
`BASELINE_RISE_MIN_SAMPLES` appear in no test file. A skeptic reproduced
every mutation independently: changing `>=` to `>` on all three left 473
of 473 passing, and **the 30 second learning window can be cut to 1
second with the entire suite green**.

This is the most consequential surviving gap in the chunk. The baseline
decides what "open" means for a person, and the blink threshold, the
shut line, PERCLOS and the long-closure detector are all fractions of
that number. Nothing records the omission: no amendment, no ADR, no
comment, no issue.

**M2. Both PERCLOS time boundaries are untested.** (D2, D3)

The staleness trio's "at" case lands **1.5 nanoseconds below the line**,
because the test accumulates `1000/30` across 1799 samples while the
expected value is computed in closed form. The three probes therefore
sit at 1998.9999999985, 1999.9999999985 and 2000.9999999985 milliseconds
against a 2000 ms boundary, so the "at" leg duplicates the "below" leg
and the `>` versus `>=` convention is unpinned. Flipping the comparison
leaves 473 of 473 passing.

The 60 second window edge has no test at all.

**M3. Issue #174, the reproducibility bug, was closed with no automated
check at any layer.** (D7)

`gh issue view 174` returns CLOSED COMPLETED. The fix is `git show
--stat 6e89eff`: `src/main.ts` and nothing else. `grep -rn '174' test/`
returns no matches.

A skeptic confirmed the sharper version: **a full revert of the
model-clock fix passes lint, typecheck, all 473 tests and the build.**
`test/MANUAL.md` has no repeat-the-run step either.

This was the defect that made every measurement unrepeatable and moved a
published number. The commit message claims "three runs are byte for
byte identical" and nothing in the repository asserts it. It is also an
A3 miss: the fix increment added no check.

**M4. The permutation test's two-sidedness is untested.** (D1)

Making it one-sided halves every p-value and the suite still reports 95
passed. `stats.py:73` promises "Two sided p from shuffling" and nothing
enforces it.

The skeptic did the work that makes this usable: it rebuilt the DROZY
setup faithfully, reproducing the published rho values, and measured the
consequence. The bug moves the smallest raw p from 0.0511 to 0.0249 and
the smallest Holm-corrected p from 0.3535 to 0.1743. With seven
comparisons the smallest raw p must fall below 0.00714 to clear the bar.
**Nothing crosses. Every verdict line in `docs/drozy-result.txt` is
byte-identical.**

So: a real, undocumented test gap with no effect on any published
number. The remedy is five lines, and the skeptic wrote and verified it.

### Low, worth carrying

**Seven core constants can be changed with all 473 tests still
passing.** `HEATMAP_COLS`, `HEATMAP_ROWS`,
`CALIBRATION_SAMPLES_PER_TARGET`, `CALIBRATION_SETTLE_MS`,
`ALERT_DISPLAY_MS`, `SPEED_COEFFICIENT`, `MIN_CUTOFF_HZ`.

The cause is a single pattern: every test imports the constant and
computes its own expectation from it, so **the test moves with the
code**. This is a systemic issue, not seven separate ones.

The project has already diagnosed and fixed it elsewhere.
`test/core/score.test.ts:143-149` says in its own words: _"Without
these, nudging a constant leaves every ramp test passing because they
all derive from the constant"_, and pins the literals. The fix exists in
the repository. It was applied twice and then not generalised.

Also carried: `BLINK_REFRACTORY_MS` has no "at" case, confirming the
earlier lead. `POSE_LIMITS` pitch and roll have no "at" case and neither
value is pinned. The synthetic generator's yaw sign can be reversed with
the suite green, while roll gets a whole dedicated file. One exported
core function, `learningSecondsLeft`, has no test at all.

---

## Refuted findings

Seven of twelve. The measurements behind these are the most valuable
work in the chunk, because each one closes a question that would
otherwise have sat open.

**"No boundary triad on the four-frame match tolerance, the constant
that sets the headline recall."** → **low**

The triad really is missing, and the suite pins the constant only to the
window 3 to 22. But the stated consequence is false. A skeptic found the
published run on disk and **swept the tolerance from 0 to 30 over the
real Eyeblink8 corpus**. True positives, false positives and false
negatives are byte-identical at every value from 0 through 18. Per-clip
counts are identical too.

**Setting the constant to zero would leave every published table
unchanged.** The slack is doing no work, because the detector exports a
multi-frame closure span that genuinely overlaps the annotation.

**"Greedy matching under-counts true positives and deflates the
published recall."** → **low**

A skeptic built a Kuhn maximum-bipartite matcher, validated it against
exhaustive brute force with zero mismatches over 3,000 instances, and
ran it against the real corpus.

**Pooled greedy 358, pooled optimal 358, difference 0.** Identical on
every clip of all four measured runs. The auditor's smallest
counterexample was a shape a blink log cannot produce, two overlapping
detections out of time order.

Greedy can also only ever under-count, never inflate, which is the
conservative direction for a matcher whose stated purpose is to stop the
evaluation being rigged. What survives is one sentence of missing
documentation.

**"The CV(mm) < CV(px) headline is exact by construction, not
discovered."** → **no defect**

The arithmetic reproduces. The synthetic face does cancel the distance
term algebraically, and the measured `cvMm` of 3.6e-15 is floating-point
rounding.

Every inference from it fails.

- That is what an answer key **is**. The master prompt's rule 2 names
  "synthetic face at a known angle" as a valid ground-truth form.
- Rule 1's criterion is met: mutating the millimetre conversion fails 8
  tests.
- It is disclosed, not hidden. `LEARNING.md:233` says verbatim _"On
  perfect synthetic data the ruler cancels distance exactly, real faces
  will be noisier, which is why the live stability line exists"_.
  `ROADMAP.md:60` scopes row 3.5 to "on synthetic data".
- **The claim that the only real-world evidence is a manual test is
  factually wrong.** `test/core/aperture.test.ts:76-96` runs 300 real
  recorded frames through `apertureMm` and asserts the median lands in a
  human range. `test/MANUAL.md:22` records the real result with numbers:
  pixels varied 39 to 46 percent, millimetres 13 to 17 percent, about
  three to one, along with the reason the millimetre figure was not
  lower.
- Nothing overclaims. `MODEL_CARD.md:26` lists eyelid aperture as "not
  validated against a physical measurement" and states that blink
  detection "is the only thing here that has been checked against
  somebody else's ground truth". Neither `README.md` nor
  `MODEL_CARD.md` quotes a CV figure at all.

**"The tests cannot tell Holm from Bonferroni."** → **low**

The mutant does survive, so one assertion is missing. But Holm has five
tests of its own, the step-down factor is the only unpinned part, and no
published verdict changes.

**"The blink shape tie-break is untested and swings the sluggish-lid
number by two."** → **low**

Both mutants survive. The score claim is arithmetically false: the ramp
floor is 150 ms and the values in question are 41 and 100 ms, both below
it, so the contribution is zero either way. The tie also cannot occur in
real data.

**"`analysis/tools/` is 368 statements at zero coverage."** → **low**

The numbers are right and the finding is misfiled. D10 as this audit
defines it names a coverage floor on `src/core`, and roadmap row 8.6 is
unticked, so this is unreached work rather than a gate violation.

**"The two newest silent-success refusals are decided in untested
`main.ts`."** → **low**

Misattributed by `git blame` to a commit two days older than claimed,
and one of the two predicates is in core and is tested while the other
is caught by an end-to-end test.

---

## Coverage, measured for the first time

No coverage tooling exists in this project. Row 8.6 would add it and is
unticked, so its absence is unreached roadmap work rather than a
violation. But the number has never existed, and now it does.

| Area          | Statements              |
| ------------- | ----------------------- |
| `src/core`    | **98.07%** (659 of 672) |
| `src/io`      | **0.00%** (0 of 196)    |
| `src/main.ts` | **0.00%** (0 of 983)    |
| Overall       | 35.6% (659 of 1,851)    |

Branches 53.66 percent, functions 55.81 percent.

`src/core` would clear the 70 percent floor row 8.6 specifies, with room
to spare.

`src/io` and `src/main.ts` are **63.7 percent of the TypeScript
statements at zero unit coverage**, covered only by five browser tests
across 402 uncovered branches and 113 uncovered functions. The split is
deliberate and written down in `ARCHITECTURE.md` and `ADR-0003`, which
is why this is partial rather than a clean violation. It remains thin,
and the master prompt's pyramid names no layer that owns the `io` error
paths.

---

## The pyramid, layer by layer

**Unit tests on core.** Every module covered, and 98.07 percent of
statements. One exported function untested.

**Synthetic fixtures.** Real, documented and correctly scoped. One gap:
the generator emits square normalised space by construction, so the
aspect-ratio trap that `aperture.ts:10-13` calls out as one that would
"skew every millimetre by that factor, silently" cannot be caught by any
synthetic test. It was caught, by the recorded-fixture tests.

**Recorded fixtures.** These earn their keep rather than merely
existing. `session-01.json` killed mutations the synthetic tests missed,
including the aspect-ratio swap and the eye-aspect-ratio chord sum.

**End to end.** Five tests. **None of `SPEC.md`'s five documented
degraded states is covered**: no camera, permission denied, no face, low
frame rate, wrong landmark count. The specs prove wiring, which they say
themselves.

**Manual.** Maintained, 61 numbered items, several carrying dated
observations with real numbers. But no evidence of being run since
v0.3.0, against a rule that says "run before every phase tag".

---

## What could not be checked

- Mutation coverage reached 16 high-value modules. Fourteen others were
  not mutated and their kill rates are unknown.
- The Playwright layer was not mutated.
- Seven mutations were judged equivalent by 300,000-input differential
  search plus reachability argument, not by formal proof.
- Whether the manual script was actually performed at any phase tag.
  Nothing records a run.

---

## Carried into the final report

1. **The mutation score belongs in the README.** 80.3 percent, and 15 of
   15 on refusal removal, is a stronger statement about test quality
   than any coverage percentage. The project already invented the
   technique for itself once.
2. **`baseline.ts` is the real gap.** Three unpinned gates under the
   number every other threshold derives from.
3. **Issue #174 closed with nothing asserting the fix.** A full revert
   passes every gate. That is the single most alarming line in this
   chunk.
4. **Constants that tests derive their own expectations from are a
   systemic pattern**, and the fix already exists in
   `score.test.ts:143-149`. Generalise it.
5. **Three benchmark worries were measured and are inert.** The
   tolerance constant, the greedy matcher and the synthetic CV
   construction all turned out to change no published number. The report
   should say so plainly, because each is the kind of thing a hostile
   reader would raise.
