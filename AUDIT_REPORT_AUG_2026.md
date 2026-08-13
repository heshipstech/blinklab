# Engineering audit, August 2026

A full audit of `blinklab` against the original master prompt that started
the project, conducted 10 August 2026 at the owner's request.

The plan is `AUDIT_PLAN.md`. The six chunk reports and the complete
unedited finding lists are in `docs/audit/`. Every claim here traces to a
chunk file, and every chunk file traces to a command that was run.

**This report was itself audited.** Three critics attacked the first draft
for accuracy, completeness and the quality of its remediation plan. They
found seven factual errors in it, two verified findings it had dropped,
and two real defects the audit had never looked for. All are corrected
below, and the limitations they exposed are in section 7.

---

## How this audit was conducted

Six chunks, each a set of parallel auditors given one group of
constraints and told to attack it. Auditors ran experiments rather than
only reading: they mutated the source and re-ran the suite, froze
function arguments to prove purity, rebuilt the page and drove it with a
keyboard, and reimplemented the benchmark evaluation from scratch to see
whether it agreed.

**Every strong finding then went to a separate skeptic instructed to
refute it, defaulting to refuted when uncertain.**

| Chunk                                | Findings | Tested | Survived | Refuted |
| ------------------------------------ | -------- | ------ | -------- | ------- |
| 1. Documents, configuration, process | 61       | 17     | 10       | 7       |
| 2. Core purity, hard constraints     | 42       | 8      | 4        | 4       |
| 3. The test pyramid                  | 59       | 12     | 5        | 7       |
| 4. Measurement and mathematics       | 52       | 14     | 3        | 11      |
| 5. Interface and accessibility       | 53       | 12     | 6        | 6       |
| 6. Published claims against evidence | 48       | 4      | 3        | 1       |
| **Total**                            | **315**  | **67** | **31**   | **36**  |

**Fifty-four per cent of tested findings did not survive.** An audit that
published its first pass would have been half wrong.

That number is also the correct lens for the **248 findings never tested**.
They carry file, line and recomputed value, but they are leads. Every
untested item in this report is marked **[untested]**. Chunk 6 in
particular was run lean for budget reasons, so the chunk with the most
findings got the least verification.

**No finding survived at critical severity. Five survived at high.**

---

## 1. Executive summary

**The instrument is sound. The paperwork around it is not.**

### What is genuinely good

**The pure layer is pure, proven by execution rather than argued.** An
auditor deep-froze every argument to all 104 exported functions in
`src/core` and ran the whole suite: 473 of 473 passed. A canary run
proved the harness was live. A second harness called every function twice
with identical inputs and compared: identical every time. Zero argument
mutation, zero hidden state, zero clock reads, zero randomness, zero
`throw`.

One qualification the first draft omitted: **the lint rule credited with
holding that line catches one impurity in seven.** `no-restricted-globals`
names only `window`, `document` and `navigator`, so a `Date.now()` inside
`core` would ship without complaint. The purity is real. It was produced
by discipline, not by the gate.

**The tests would notice if the maths were wrong.** 122 deliberate
mutations, 98 caught, 80.3 per cent. **All fifteen mutations that turned
a refusal into a number were caught.**

**The tests assert properties, not mocks.** Searched for `vi.mock`,
`vi.fn`, `vi.spyOn`, `vi.stubGlobal`, `useFakeTimers`, jest and sinon
across the whole tree: **zero hits.** Inputs are built from real
arithmetic or from a parametric synthetic face generator. The only
"fake" anywhere is a Chromium launch flag for the camera stream, which
is a browser facility rather than a test double.

**The `CV(mm) < CV(px)` assertion exists and passes.**
`test/core/statistics.test.ts`, test named at line 44, assertion at line
69, strengthened at lines 70 and 71. Seven synthetic distances from 350
to 800 mm with the aperture held at 10 mm.

An auditor challenged it as true by construction, and it is: the
generator places the iris and the eyelid at the same depth, so the
distance term cancels algebraically and the measured `cvMm` of 3.6e-15
is floating-point rounding. **A skeptic refuted the finding**, on four
grounds. That is what an answer key is, and the master prompt names
"synthetic face at a known angle" as valid ground truth. It still guards
against mutation: breaking the millimetre conversion fails eight tests.
It is disclosed verbatim at `LEARNING.md:233` and scoped to "on
synthetic data" at `ROADMAP.md:60`. And the real-world evidence is not
only a manual note: `test/core/aperture.test.ts:76-96` runs 300 real
recorded frames through `apertureMm`, and `test/MANUAL.md:22` records
the measured result, pixels varying 39 to 46 per cent against
millimetres at 13 to 17, about three to one.

**The published headline reproduces exactly** from a reimplementation
borrowing none of this project's code, and frame accounting matches the
MP4 container atoms at 71,356.

**The statistics are correct.** Holm matches R's `p.adjust` to zero
difference. The permutation p-value matches exhaustive enumeration. The
in-place shuffle two chunks flagged is provably uniform. The DROZY
pre-registration was not violated.

**The process was strong for most of its life.** Branch protection real
and API-verified. Nothing merged red across 118 pull requests.
Conventional Commits at 98 per cent. No threshold constant ever retuned
after being set, confirmed three times. And **the 25 fps floor was not
lowered to recover the 16 DROZY sessions the analysis most needed**,
which is the most creditable decision in the record.

### What is actually wrong

**One published claim is false.** The shipped page says "no data leaves
your device" while bundled MediaPipe posts telemetry to Google. No user
data is sent. The claim is still false, in six places.

**The prose has rotted while the numbers stayed right.** Your own
reproduction command prints 82.8 per cent against a headline of 87.7. A
paragraph that exists to withdraw a claim withdraws it using the very run
it says was defective, and reaches a backwards conclusion. The refractory
period is described as built and not built, 28 lines apart.

**Silent success happened a fifth time.** The frame counter increments as
the first line of `processFrame`, 21 lines before the check that a model
exists.

**The documentation trail stopped on 8 August.** Six findings share that
date. One event, six symptoms.

**Two things nobody had looked for**, found by the critic that audited
this report: a user's exported blink log is **not** gitignored while the
session export is, and **Apache-2.0 attribution for MediaPipe is absent
from the built output entirely.**

### The honest summary

A stranger who cloned this repository, ran the tests, read the core and
reproduced the benchmark would come away impressed.

The same stranger who read the README carefully and checked three claims
would find one command giving a different answer, one paragraph
contradicting itself, and one citation not supporting what it is cited
for. They would then trust the good parts less than those parts deserve.

**Nothing here is a competence problem. Everything here is a housekeeping
problem that has become a credibility problem.**

---

## 2. Constraint violations

| #   | Constraint                                  | Status                                                                                                                                                                                            |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Increment size                              | **Partial.** One pull request ticked two roadmap rows. The "and" metric was refuted: the approved roadmap uses "and" more often than the pull requests do.                                        |
| 2   | Every increment ends in a push              | **Met.**                                                                                                                                                                                          |
| 3   | Every increment adds an automated check     | **Violated.** Nine pull requests changed code and added none, three of them measurement-correctness fixes.                                                                                        |
| 4   | Pure logic testable with no camera          | **Met, proven by execution.**                                                                                                                                                                     |
| 5   | No dead code or commented-out code          | **Met.** Two sweeps found none.                                                                                                                                                                   |
| 6   | **No third-party network calls at runtime** | **VIOLATED.**                                                                                                                                                                                     |
| 7   | The demo must never crash the page          | **Partial.** All five documented degraded states pass, observed in a browser. But `calibrationStore.ts` can blank the page, and any throw in `processFrame` ends the only frame loop permanently. |
| 8   | Accessibility floor                         | **Substantially met.** Focus visible, fully keyboard operable, all text clears WCAG contrast. Missing: modal semantics, live regions, three text equivalents. Row 8.8 tracks these openly.        |
| 13  | No company branding or positioning          | **Met** in every issue title, pull request title and published document. One evidence file names the old folder "a previous project", where it is load-bearing for the finding it appears in.     |
| —   | **Explainability over accuracy**            | **Met, and it defended the code.** No increment was found where a more accurate but less explainable method won.                                                                                  |

### The explainability rule, which turned out to be a shield

The master prompt says: "When a simple explainable method and a complex
accurate one compete, choose the simple one and write down why."

The audit looked for violations and found none. More interesting is what
happened instead: **skeptics invoked this rule at least four times to
knock findings down**, each time correctly.

The peak-velocity estimator is a single finite difference, which an
auditor called mathematically wrong. `blinkShape.ts:3` defines it
operationally as "the fastest adjacent-sample drop on the way down", so
the code computes exactly what it says it computes, `MODEL_CARD.md:27`
labels it unvalidated, and no absolute value is published anywhere.
Simple, explainable, honestly labelled, and the finding died.

The same defence held for the 11.7 mm iris constant, the score's
hand-chosen weights, and the hand-written rank statistics.

**A rule that repeatedly defeats an auditor is a rule doing its job.**
That is worth knowing, because this is one of the few rules in the master
prompt that costs something to follow.

### The one that matters: runtime telemetry

**Verified three times independently**, including by a skeptic sent to
refute it who reproduced it more strongly.

Sixty seconds after the face landmarker is created, MediaPipe sends a
`POST` to `https://odml.pa.googleapis.com/v1/log`. Zero detections
needed. The endpoint is in the shipped bundle.

**What is sent:** a protobuf of usage statistics. No video, no image, no
landmark, no measurement.

**What is claimed:**

| Where                   | Claim                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `src/core/notice.ts:14` | "All processing happens in your browser and no data leaves your device."             |
| `README.md:7`           | the same sentence, above the fold                                                    |
| `README.md:478`         | "There is no backend, no analytics and no telemetry."                                |
| `MODEL_CARD.md:153`     | "no analytics and no telemetry"                                                      |
| `PROJECT.md:28`         | "No user data leaves the browser. Ever. **No backend, no analytics, no telemetry.**" |
| `ADR-0002`              | "zero runtime third party calls", the justification for vendoring                    |

The first draft of this report exonerated `PROJECT.md:28` by quoting only
its first sentence. Its second sentence carries the same defect. Six
places, not five.

This is nobody's mistake. The vendoring decision was correct and
recorded. The dependency's behaviour was never measured.

### Two documented deviations

**`src/ui` was never created.** `SPEC.md:11` argues this is acceptable
because "every string it renders that carries meaning is produced by a
tested pure function in core". That is **false today**: 16 readouts are
formatted inline in `main.ts`, about 8 come from core.
`ARCHITECTURE.md:139` already admits the file is too long, so the
deviation is disclosed; only its justification fails.

**Three required root files are missing.** `CHANGELOG.md` is row 8.3 and
a security policy is part of 8.5, both openly unticked. **Only
`CONTRIBUTING.md` is a genuine gap**, with no roadmap row anywhere.

---

## 3. Missing or incomplete increments

### Ticked but not fully delivered

**Row 7.7, the negative control.** The row's check reads "test asserting
the collapse". No test exists; the artefact prints to standard output.
The maths is sound — a skeptic proved reusing the p-value's own draws is
correct by design, and 500 independent seeds bracket the published
figures. **The test is absent**, and an untested silent-zero branch in
the same path would produce a passing-looking control.

**Row 8.2, `ARCHITECTURE.md`.** States a wrong test count and claims the
browser tests run on two engines; continuous integration runs Chromium
alone.

**Row 8.4, `MODEL_CARD.md`.** Publishes the retired 78.6 per cent miss
figure. Mitigated by its dated stamp, discussed in section 6.

**Row 3.7, tilt invariance.** `SPEC.md:137` claims the eye aspect ratio is
"invariant under head roll by construction, proven at 0, 15 and 30
degrees". Measured on real landmarks, the displayed value **drifts 13 to
27 per cent** at the pose gate's own roll limit. The test proving the
claim runs on a square 1000x1000 frame **where the defect cannot appear**.

### Work invented during the build that never reached the roadmap

Fifty-six of 118 merged pull requests name no increment, nearly all in
the final three days. The eight campaigns, from
`appendix-chunk-1-all-findings.md`:

| Campaign                                    | Pull requests |
| ------------------------------------------- | ------------- |
| The interface redesign                      | 16            |
| The corpus and Track A measurement pipeline | 12            |
| Documentation-correction sweeps             | 12            |
| Detector defect rework                      | 9             |
| The DROZY analysis                          | 3             |
| The audit itself                            | 2             |
| Dataset permissions                         | 1             |
| One day-one fix                             | 1             |

Neither "Eyeblink8" nor "corpus" appears anywhere in `ROADMAP.md`.

None of this was wasted work; most of it is the best work in the
repository. But **half of what the project built is not in its own record
of what it built.**

### Unticked but partly done

Row 8.3 is unticked while seven tags and seven releases exist.

---

## 4. Measurement and mathematics flaws

**Eleven of fourteen tested findings were refuted.** What survived:

### Real errors

**A blink can be published carrying the previous blink's shape.** The
window `main.ts:1948-1951` builds can reach back over the preceding
blink. Reproduced on a synthetic trace where the answer was known by
hand. **The only genuine arithmetic error the audit found.** It corrupts
three columns of an exported blink log.

**The displayed eye aspect ratio is computed in the wrong space.**
`ear.ts` never converts to pixels; `aperture.ts` does. Median on 300 real
frames: **0.4834** displayed against **0.2787** in true geometry. The
factor is the frame aspect ratio, exactly the trap `aperture.ts:10-13`
warns about in its own comment. No published number moves; EAR is
display-only.

**The frames-per-second readout is not the camera's rate.** It is the
animation-frame call rate. On a 20 fps device the page displayed 70. This
holds the 25 fps blink gate open on a camera below threshold, in healthy
sessions.

### Gaps that are not errors

**Guards fail open on NaN**, across seven modules. **The trigger is
unproven** — nobody established a non-finite landmark can occur — which is
why each scored low. One pattern, one fix, and `frameClock.ts` already
shows it.

**The within-subject agreement bar fires on pure noise 97.5 per cent of
the time.** No published text uses it, so nothing is wrong today.

**The permutation test's two-sidedness is unasserted.** Measured
consequence: the published null sits seven times from the correction bar
and does not move.

**Both PERCLOS time boundaries are untested**, one of them by 1.5
nanoseconds of float accumulation, so the "at" leg duplicates the "below"
leg.

**Thirty of the hundred score points can be charged from a blink of
unbounded age**, while the closure penalty is correctly windowed.

### Blink closing velocity, examined in full

The master prompt names this specifically, so here is the whole verdict.

**The arithmetic is correct.** The sign is right, so a closing lid reads
positive. Non-monotonic descents are handled: a rising interval inside
the closure produces a negative slope that the maximum discards, giving
the true steepest drop rather than an average across the span. Amplitude
is anchored at the pre-closure maximum, not the window start. The unit
algebra checks out: millimetres divided by millimetres-per-second gives
seconds, and the amplitude-over-velocity ratio is reported in
milliseconds correctly. Every degenerate case refuses rather than
guesses: fewer than two samples, no descent, a non-advancing clock,
backwards timestamps.

**The sampling limit is real and quantified.** A blink's closing phase
lasts roughly 50 to 100 ms; at 30 fps a frame arrives every 33 ms, so the
phase is sampled two or three times. Simulated against two standard
closing models over many random sampling phases, **the measured peak runs
22 to 38 per cent below the true peak at 30 fps.** The same blink reads
about 33 per cent faster at 60 fps than at 25. The amplitude-over-velocity
ratio has a hard floor at exactly one frame interval.

**Its consequence was measured, not assumed.** The attenuation is
monotone, so it compresses contrast rather than scrambling order, and it
moves the published Spearman correlations by about 0.04. No verdict
changes.

**And it is disclosed.** `blinkShape.ts:3` defines the quantity
operationally as "the fastest adjacent-sample drop on the way down", so
the sampling grid is written into the definition rather than hidden
behind it. `MODEL_CARD.md:27` lists closing velocity as validated against
"nothing external", result "unvalidated". No absolute millimetres-per-second
figure is published anywhere in the repository.

What is **not** written down is the magnitude. A reader learns the
quantity is unvalidated but not that it under-reads by a quarter to a
third at the frame rate most webcams deliver.

### Magic numbers

Every numeric constant affecting a measurement was inventoried and
classified. Almost all carry a written origin, and `src/core/constants.ts`
is mostly prose for exactly this reason.

**The unexplained ones**, all low severity, none touching an exported
value **[untested]**:

- `gazeSmoothing.ts:14,19,23`. `MIN_CUTOFF_HZ` and `DERIVATIVE_CUTOFF_HZ`
  are the One Euro filter paper's own defaults, and `SPEED_COEFFICIENT`
  is its beta rescaled to offset units. **Literature values presented as
  though invented here.** The smoother shapes the gaze offsets that feed
  fixation detection.
- `headPose.ts:16`, `GIMBAL_EPSILON = 1e-6`, no comment at all.
- `main.ts:1455` and `:1472`, display axis half-scales, no origin, and
  they silently clip anything beyond them.
- `constants.ts:23-24`, the calibration settle time and sample count
  explain the need but not the values.
- `main.ts:1949`, the bare `400` millisecond shape lead-in. Swept 0 to
  2000: peak velocity is bit-identical from 100 to 800, so **it sits
  mid-plateau rather than on a knife edge.**

### Three worries measured and found inert

- **The four-frame match tolerance.** Swept 0 to 30 over the real corpus:
  results byte-identical from 0 through 18.
- **Greedy matching.** A validated optimal matcher gives **358 against
  greedy's 358**, on every clip of all four runs.
- **The 11.7 mm iris assumption.** A wrong iris size is one multiplier on
  the whole feed, and every decision is a ratio against the person's own
  baseline from that same feed. **It cancels exactly.**

---

## 5. Technical debt and bugs, prioritised

### Priority 1: makes a published claim false

1. **Runtime telemetry against six "no telemetry" claims.**
2. **The reproduction command prints 82.8 per cent, not 87.7.** Verified
   by running it.
3. **The withdrawn-glasses paragraph uses the withdrawn run's figures**,
   labels a precision as a recall, and states a backwards conclusion.
   **[untested]**
4. **The refractory period is described as built and not built.**
5. **A citation supports a different run.** "45 of 72" cites a file
   saying "45 of 53". The companion figure, published as "41 of 53", is
   really 61 of 72. **[untested]**
6. **`STATE.md` says the sleepiness result is not in this repository.**
7. **`SPEC.md:137`'s roll-invariance claim is false** for the displayed
   value.

### Priority 2: corrupts data, hides failure, or leaks

8. **A user's exported blink log is not gitignored.** `.gitignore:51`
   excludes `blinklab-session-*.csv` because "an exported CSV is
   measurements of somebody's eyes". `src/main.ts:1398` writes the second
   export as `blinklab-blinks-*.csv`, which `git check-ignore` confirms is
   **not** excluded. Five-minute fix.
9. **The frame counter runs before the model exists.** Silent success,
   fifth instance. A cold start counted about 3,000 frames before the
   model loaded against roughly 1,460 after, and wrote the total into the
   export header.
10. **A failed model load is never reported.** Camera path runs forever
    looking healthy; clip path prints a completed measurement and
    misdiagnoses the missing model as a frame-rate refusal.
11. **`calibrationStore.ts` is unguarded in both directions.** Reading
    throws outside the `try` and blanks the page. Writing throws inside
    `processFrame` and ends the only frame loop forever.
12. **The blink shape window can reach over the previous blink.**
13. **Apache-2.0 attribution is missing from the built output.**
    MediaPipe is Apache-2.0, bundled into `dist/assets/index-*.js`, which
    contains zero occurrences of "Copyright", and no `NOTICE` or licence
    file is emitted. Apache-2.0 requires attribution to survive
    redistribution, and this page is published.

### Priority 3: the tests would not catch a regression

14. **`baseline.ts` has three gates with no boundary test.** The 30
    second learning window can be cut to **1 second** with all 473 tests
    green.
15. **Issue #174 was closed with no check at any layer.** A full revert
    of the reproducibility fix passes everything.
16. **`src/io` has no unit test at all.** Coverage: `src/core` 98.07 per
    cent of statements, `src/io` and `main.ts` **zero**, overall 35.6.
17. **Row 7.7's negative control has no test.**
18. **`BLINK_REFRACTORY_MS`, `POSE_LIMITS` pitch and roll have no "at"
    case**, and seven cosmetic constants can be changed with the suite
    green. The fix exists at `score.test.ts:143-149` and was never
    generalised.
19. **None of `SPEC.md`'s five degraded states has an end-to-end test**,
    although all five were observed to work.

### Priority 4: hygiene and record-keeping

20. A returning visitor with a stored calibration profile **can never open
    the heatmap** and must redo the full nine-dot calibration to reach
    increments 5.9 and 5.10.
21. `docs/UI.md` has never been updated since its single commit, voiding
    the compensating control `SPEC.md` relies on.
22. Seven of twenty evidence scripts can no longer run. **[untested]**
23. The miss table withheld on licence grounds is committed. **[untested]**
24. The browser-agreement table's nine numbers rest on no saved export.
    **[untested]**
25. Three documents publish two different test counts, 442 and 461; the
    suite reports 473.
26. `STATE.md` is 405 lines against a ten-line specification, missing one
    required field.
27. `LEARNING.md` and `docs/log.md` stop on 8 August, 35 pull requests
    ago.
28. The Definition of Done was abandoned at #134. `LEARNING.md` notes on
    code pull requests fell from 51 of 52 to 10 of 36.
29. `CONTRIBUTING.md` has no roadmap row.

---

## 6. Remediation action plan

Fourteen increments. Each is one branch, one pull request, one push, and
each states a check **that can actually fail**. The first draft of this
plan contained four checks that could not, which is the defect this audit
found repeatedly.

Ordered by the stated principle: published falsehoods first, then data
corruption, then missing tests, then record-keeping.

**On the count.** The request suggested five to ten increments. This is
fifteen, because the critic's review split four bundles that broke the
project's own one-thing-per-increment rule. Nothing was added; four
things were separated.

---

**R1. Correct the six telemetry claims.**
`README.md` twice, `MODEL_CARD.md`, `PROJECT.md`, `src/core/notice.ts`,
and `ADR-0002`'s consequences. State what the dependency sends and that
no user data is included.
_Check:_ a continuous-integration grep asserting the phrases "no data
leaves your device", "no telemetry", "no analytics" and "zero runtime
third party calls" appear in no tracked markdown or source file. Pins all
six sites, not one.

**R2. Gitignore the blink export.**
Add `blinklab-blinks-*.csv` beside the existing pattern.
_Check:_ `git check-ignore -v` on a sample filename, asserted in a test.
_Why this early:_ five minutes, and it is the cheapest real-harm fix in
the audit.

**R3. Fix the five stale prose claims.**
The reproduction command, the withdrawn-glasses paragraph, the refractory
contradiction, the false citation, `STATE.md`'s DROZY sentence.
_Check:_ a continuous-integration script asserting the numbers in
`README.md`, `STATE.md` and `MODEL_CARD.md` match the committed result
file in `docs/evidence/`. **Not** a re-run of the corpus command: the
corpus is not in the repository and that check could never execute.
Record the corpus re-run separately as a dated local gate.

**R4. Correct `SPEC.md:137` and make its test able to fail.**
Say the roll-invariance claim holds in pixel space and not in the
displayed value. Change `test/core/tiltInvariance.test.ts` to a 1280x720
frame.
_Check:_ the changed test must fail against today's `ear.ts`. Verify that
before deciding whether to fix `ear.ts` itself.

**R5. Add a dated stamp to `README.md` and `STATE.md`.**
`MODEL_CARD.md:6-7` already carries one, and it converted what would have
been a contradiction into a correctly-scoped snapshot.
_Check:_ assert both files contain a parseable stamp, and that it is not
older than the last commit touching a published number.

**R6. Emit third-party licence attribution.**
Add a `THIRD_PARTY_LICENSES` file and emit it into `dist` at build time.
_Check:_ a build assertion that the file exists in `dist` and names
MediaPipe's Apache-2.0 licence.

**R7. Count frames only when a frame was measured.**
Move `framesMeasured += 1` inside the landmarker guard.
_Check:_ a test asserting the counter does not advance without a
landmarker. **Regression surface to watch:** the same variable feeds
`checkStepping` at `main.ts:815-819` and a division at the clip summary.

**R8. Report a failed model load.**
A sixth degraded state, with a message and a retry.
_Check:_ a Playwright test that blocks the model request and asserts a
readable message appears.

**R9. Contain failures in the frame loop and guard storage.**
Wrap both `localStorage` reads and writes. Wrap `onFrame` in a
`try`/`catch` that **enters a visible degraded state and stops appending
feature records** — not one that silently resumes, which would be this
project's own recurring defect wearing a fix's clothing.
_Check:_ a Playwright test injecting one throw, asserting both that a
readable message appears **and that the record count stops advancing**.

**R10. Fix the blink shape window.**
_Check:_ a fixture built from the skeptic's synthetic 30 fps two-close-blinks
trace, asserting the second blink's three shape columns do not equal the
first's.

**R11. Pin the safety-relevant constants.**
`BLINK_REFRACTORY_MS`, `POSE_LIMITS` pitch and roll, the three
`BASELINE_` constants, the two PERCLOS time boundaries, and the missing
`learningSecondsLeft` test.
_Check:_ mutating each must fail at least one test. Verify by doing it,
then keep the mutation list in a file so the next person can repeat it.

**R12. Give row 7.7 the test its own row demands.**
In `analysis/tests/test_drozy.py`, importing `_shuffled_null`, asserting
the shuffled result collapses to chance **and** that the silent-zero
branch raises rather than returning zero.
_Check:_ the test itself, in the `analysis` continuous-integration job.

**R13. Correct or relabel the frames-per-second readout.** _(highest
risk, do last of the code changes)_
Today's readout is the animation-frame rate. Correcting it will begin
refusing live sessions that currently succeed, on an unknown number of
real machines. **Split it:** first relabel the displayed number honestly
as a processing rate, which is readout-only and safe. Only then, and only
after measuring the blast radius on real hardware, wire a true camera
rate into the 25 fps gate.
_Check:_ stage one, a test that the label matches what is computed. Stage
two, a test that the gate closes on a 20 fps source, plus a recorded
measurement of what that does to a real session.

**R14. Restart the record.**
Backfill `LEARNING.md` and `docs/log.md` for 8 to 10 August. Reinstate
the Definition of Done.
_Check:_ a continuous-integration check that a pull request touching
`src/` also touches `LEARNING.md` or says why not.

**R15. Decide what the roadmap is.** _(a decision, not an increment)_
Either amend the roadmap to absorb the 56 unplanned pull requests, or
state that the ladder ended at Phase 7 and the project now runs on
issues. Also decide the miss table: retire the withholding rule in
writing, or remove the file.

---

### Deliberately not in this plan

**Blocking the telemetry.** Whether MediaPipe can be configured, patched
or blocked by a Content Security Policy is an open question with an
unknown answer, and it may break the model. **Timebox it to one day**,
after R1 has already told the truth. If it is attempted, the check must
be a Playwright test with an explicit timeout **above sixty seconds**,
asserting the elapsed wait, against a checked-in allowlist of permitted
hosts. Written naively that test passes today with the telemetry firing.

**The NaN family.** Establish whether a non-finite landmark can occur
before spending anything. If it cannot, this is dead code.

**Rewriting `main.ts`.** Correct, linted, and honest about its own size.
No defect motivates the change, and this project's history is that
unmotivated changes are where its defects came from.

**Accessibility beyond the floor.** Row 8.8 tracks it and the floor is
met better than anyone assumed.

**Housekeeping items 21, 22, 24, 25, 26, 29 and `CONTRIBUTING.md`,
coverage gates, Dependabot, the changelog.** Real, small, and belonging
to Phase 8. Do them as Phase 8.

---

## 7. What this audit did not examine

The first draft omitted this section and a critic was right to insist on
it. A report that reads as total coverage would be its own kind of false
claim.

**Out of scope by decision** (`AUDIT_PLAN.md:118-128`): `node_modules`,
`dist`, both lockfiles, the vendored model weights, the 4.9 MB landmark
fixture, and anything outside the repository.

**Never looked at, and worth doing:**

- **The dependency supply chain.** No chunk ran `npm audit`, checked a
  CVE, or asked what 170 npm and 21 Python packages contain. One command
  each. The natural companion to row 8.5.
- **The deployed page.** Nobody fetched
  `https://heshipstech.github.io/blinklab/`. Every claim about "the
  shipped page", including the telemetry, was measured against a locally
  built bundle. Nothing records which commit is live. Fifteen minutes to
  close.
- **Data at rest.** The audit asked what leaves the device and never what
  stays. Two permanent `localStorage` keys are written and there is **no
  way for a user to erase a stored gaze profile from within the app**.
- **The licence chain for derived dataset artefacts.** `DATASETS.md` is a
  strong document, but nobody audited the repository against it. Per-blink
  frame numbers derived from a GPL3-annotated corpus sit in an
  MIT-licensed public repository.
- **GitHub server-side settings** beyond branch protection: Dependabot
  alerts, secret scanning, default token permissions, and the fact that
  `required_approving_review_count` is 0. Also, the six actions in the
  workflows are pinned to tags rather than commit SHAs.
- **The master prompt itself is not in the repository**, by decision, so
  no reader can check any constraint verdict against its source. The
  checklist covers Sections 3, 5, 6, 8, 9, 10 and 13; other sections were
  not turned into checklist items.

**One event during the audit, disclosed for completeness.** Partway
through Chunk 3, 57 documentation and evidence files were found deleted
from the working tree. All were committed and pushed, nothing was lost,
and they were restored and verified against `750fa07`. No command in any
agent transcript accounts for it and **the cause is unknown**. `src/`,
`test/` and `analysis/` were untouched, which is everything Chunk 3 read.

---

## Closing

The best evidence in this audit is not any finding. It is that **54 per
cent of what the auditors reached for did not survive contact with a
skeptic**, and that most of what did survive is sentences rather than
code.

A repository where the auditors' best attacks are refuted by the
repository's own written record is a repository that was built carefully.

The gap between how good the instrument is, and how much a careful reader
would trust it after checking three claims and finding two broken, is the
most valuable thing this audit found. It is also the cheapest to close.

---

_Audit conducted 10 August 2026. Plan: `AUDIT_PLAN.md`. Chunk reports and
complete finding lists: `docs/audit/`. No source file was modified during
the audit. This report was reviewed by three critics and corrected; their
findings are reflected throughout and in section 7._
