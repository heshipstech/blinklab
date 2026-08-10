# Chunk 2: core purity and the hard constraints

Part of the August 2026 audit. See `AUDIT_PLAN.md` for scope and method.

Covers checklist A4 (pure logic testable with no camera), A5 (no dead
code), A6 (no runtime third-party network calls), A7 (the page never
crashes), B2 and B3 (the core, io and ui boundary), and D4 (null over
zero) inside `src/core`.

Completed 10 August 2026. Findings below are final for this chunk.

---

## Method

Six auditors read `src/core` and `src/io` in parallel. Unlike Chunk 1,
they were allowed to **run experiments** against the code, writing scratch
files outside the repository. Proving a defect by executing it beats
arguing about it.

The purity auditor was told to try to break the claim that `src/core` is
pure, not to confirm it.

Forty-two findings were produced. The eight strongest went to skeptics
told to refute them. A ninth high-severity finding fell outside the cap
and was checked by hand instead.

---

## Headline

Two results dominate this chunk, and they point in opposite directions.

**The purity claim survived every attack, and the evidence is unusually
strong.** This is the best-verified negative in the audit so far.

**The no-network claim did not survive.** The shipped page makes a
third-party network call at runtime. Five published statements say it
does not.

---

## H1. The app makes a runtime third-party network call

**Severity: high. Verified three times independently.** (A6)

Sixty seconds after the face landmarker is created, MediaPipe sends a
`POST` to `https://odml.pa.googleapis.com/v1/log`.

How it was established:

1. The first auditor ran a headless Chromium page configured exactly as
   `src/io/landmarker.ts` configures it, ran 40 detections, waited 70
   seconds, and captured one external request.
2. A skeptic, told to refute it, wrote its own script over a static
   server and reproduced it **more strongly**: with **zero detections**,
   the call still fires and returns HTTP 200. It needs only graph
   construction, not use.
3. I confirmed the endpoint string is present in the built bundle:
   `grep -c "odml.pa.googleapis.com" dist/assets/index-SyxepCYv.js`
   returns 1.

This is not project code. It is inside the vendored dependency,
`node_modules/@mediapipe/tasks-vision/vision_bundle.mjs`, and it is
bundled at build time.

**What is sent.** A protobuf of usage statistics. No video, no image, no
landmark and no measurement. That distinction matters and the report
should not overstate it.

**What is claimed.** Five places say otherwise, including the notice on
the page itself:

| Where                   | The claim                                                                |
| ----------------------- | ------------------------------------------------------------------------ |
| `src/core/notice.ts:14` | "All processing happens in your browser and no data leaves your device." |
| `README.md:7`           | the same sentence, above the fold                                        |
| `README.md:478`         | "There is no backend, no analytics and no telemetry."                    |
| `MODEL_CARD.md:153`     | "no analytics and no telemetry"                                          |
| `PROJECT.md:28`         | "No user data leaves the browser. Ever."                                 |

`PROJECT.md:28` remains true: no _user data_ leaves. The other four are
false as written. `decisions/ADR-0002-model-hosting.md` also lists "zero
runtime third party calls" among the consequences of vendoring the model,
which was the decision's main justification.

**Why this is the most serious finding in the audit so far.** Not because
of what is sent. Because the project's entire claim to credibility is
that its statements about itself are checkable, and a stranger with the
network tab open can falsify one of them in sixty seconds. It is exactly
the class of defect this project exists to catch.

It is also, as far as this audit can tell, **nobody's mistake**. The
vendoring decision was made correctly, for the right reason, and recorded
in an ADR. The dependency's behaviour was simply never measured.

---

## H2. Every gate in the codebase fails open on NaN

**Severity: medium in aggregate. One instance verified, the pattern
confirmed across seven modules.** (D4)

This is seven findings that are really one.

The refusal guards in this project are written as comparisons:
`widthPx > 0`, `peakMmPerS <= 0`, `Math.abs(valueDeg) > limitDeg`,
`spread <= 0`. **Every comparison against NaN is false.** So each of these
guards, presented with the least trustworthy input there is, takes the
branch that means "this is fine".

Confirmed instances, each reproduced by execution:

- `aperture.ts:65-69`. A non-finite eyelid landmark with an intact iris
  ring returns `apertureMm = NaN` rather than null. `blinkStep`,
  `longClosureStep` and `perclosStep` then all record **eyes open**. A
  NaN frame arriving mid-closure mints a **false blink**.
- `headPose.ts:31`. The gimbal-lock refusal misses NaN, so
  `eulerFromMatrix` returns a NaN pose and `poseValidity` declares it
  `valid`. The one module whose stated job is refusing untrustworthy
  poses fails open on the worst input.
- `blinkShape.ts:65` and `score.ts:153`. `analyzeClosing` returns NaN
  velocity, `scoreRecords` returns `score: NaN` with the contribution
  flagged `available: true`, which is an explicit claim the signal was
  trustworthy.
- `calibrationProfile.ts:54` and `gazeQuadrant.ts:41`. A NaN gaze
  produces a named quadrant, confidently. "bottom right" from nothing.
- `baseline.ts`. A learning window of NaN apertures reaches
  `kind: "ready"` with a NaN baseline.

**The trigger is unproven.** No auditor established that MediaPipe can
actually emit a non-finite landmark. That is why the skeptics corrected
these to low individually, and it is the honest position: these are
latent, not observed.

**But the pattern is the finding.** `frameClock.ts` already shows the
correct approach, calling `Number.isFinite` on every number arriving from
outside, at six separate lines. The rest of core does not. One helper
applied at the landmark boundary would close the whole family.

Contrast: `isFeatureRecord` **does** refuse NaN and both infinities on
every numeric field, verified by execution. The schema is right. It is
just not on the path where the landmarks arrive.

---

## M1. `calibrationStore.ts` is unguarded in both directions

**Severity: medium. Two symptoms verified by skeptics, the third
confirmed by hand.** (A6, A7, A4)

Forty-three lines, three separate defects, one root cause: the storage
boundary has no error handling and no validation.

**Reading throws, and blanks the page.** `localStorage.getItem` at lines
17 and 33 sits **outside** the `try`, which wraps only `JSON.parse`.
`main.ts:909` calls `loadCalibrationProfile()` at module top level. A
skeptic built the app fresh from source and ran it under Playwright:
baseline renders 7 buttons and 1,251 characters of text; with
`localStorage` throwing, the page renders **nothing at all**. No message,
no degraded state, a white screen.

That is a browser with site data blocked, or the page in a sandboxed
embed. The master prompt says the demo must never crash the page. This is
the total case.

**Writing throws, and freezes the app permanently.**
`localStorage.setItem` at lines 13 and 29 has no guard, and
`main.ts:1892` calls `saveCalibrationProfile` from inside `processFrame`.
`src/io/frameLoop.ts:2-5` re-schedules only _after_ `onFrame` returns, so
a throw ends the only animation frame loop in the application forever. A
skeptic proved this with stubbed frames: threw on tick 3, got exactly 3
ticks delivered and 0 queued.

On a browser with a full storage quota, finishing a calibration freezes
the camera view with nothing on screen explaining it. Silent stop is the
failure mode this project has identified as its worst, repeatedly.

**What comes back is never validated.** `JSON.parse(raw) as
CalibrationProfile` at line 38 is an unchecked assertion. I read the
consuming path: `calibrationProfile.ts:95-105` dereferences
`profile.horizontal.slope` with no guard. A stored profile missing
`vertical` throws a `TypeError` inside core. String slopes produce string
concatenation, so `calibratedPoint` returns `{x: "-0.20.5"}` and
`calibratedQuadrant` compares a string against 0.5 and answers "bottom
right".

`FeatureRecord` has `isFeatureRecord` as its runtime schema.
`CalibrationProfile` and `CompletedTarget` have no equivalent, so
untrusted data enters core typed but unchecked. This breaks "the page
never crashes" and "null over guessing" in the same three lines.

---

## M2. The lint rule catches one impurity in seven

**Severity: medium. Not separately verified.** (B3)

An auditor fed a probe file to the linter containing `Date.now()`,
`performance.now()`, `Math.random()`, `localStorage`, `fetch`,
`requestAnimationFrame`, `console.log` and `document.title = "x"`.

ESLint reported **one** error: the use of `document`.

`no-restricted-globals` names only `window`, `document` and `navigator`.
A `Date.now()` inside `src/core` would ship without a complaint from
lint, typecheck or continuous integration.

This does not mean core is impure. The purity auditor proved by execution
that it is not. It means **the gate the project credits with holding the
line is not what is holding it.** Discipline is. That works until it
does not, and it is the cheapest finding in this chunk to fix: six more
names in a list already present.

---

## M3. `SPEC.md`'s justification for skipping `src/ui` is false today

**Severity: medium. Not separately verified.** (B2)

`SPEC.md:11` argues the missing folder is acceptable because "every
string it renders that carries meaning is produced by a tested pure
function in core".

`grep -c "no valid measurement" src/main.ts` returns 22. The same grep
over `src/core` returns 0. About 16 readouts are formatted inline in
`main.ts` with their units and values; roughly 8 come from core.

The deviation from the planned layout is documented and admitted, which
Chunk 1 established. The _reason given for it_ does not hold. The rule
that was supposed to survive the missing folder is followed for about a
third of the interface text.

Related, and sharper: `main.ts:1631-1634` and `:1669-1672` compute the
combined two-eye aperture in the renderer, and that value feeds the
baseline, the blink detector, PERCLOS, the score and the CSV export. It
is one line, it very likely matches core's equivalent combiner at
`gazeQuadrant.ts:17`, and it is the most load-bearing number in the
application. It lives in the only file with no unit test.

---

## Lower findings worth carrying

- A pure decision rule is trapped inside `io`.
  `videoStepper.ts:185-209` takes a list of numbers and returns the
  smallest gap, which becomes the clip's published frame rate. It is
  pure arithmetic in a browser-only module with no unit test, and its
  own comments record two past bugs in exactly that rule. The skeptic
  correctly refuted the claim that `core/fps.ts` is an equivalent, and
  correctly noted a cross-browser regression test covers the outcome.
  The extraction is still the right move. (low)
- `BLINK_CSV_COLUMNS` has no compile-time guard. A skeptic added an
  eighth column in a scratch copy: `tsc` passed, all 473 tests passed,
  and the file went ragged. Refuted down to low **because the Python
  reader refuses a ragged file loudly and that guard is tested**, so the
  failure is caught, just one layer later than for the other export.
  (low)
- A score contribution can be fractional, breaking the stated integer
  half of the score contract, reachable only through the loader path.
  (low, unverified)
- `isFeatureRecord`, `demoNoticeShort()` and `loadCalibrationSamples()`
  have no production caller. The first is the notable one: three
  comments read as if it runs in the export path. It does not. (low)
- Four unit-in-name violations: `IrisOffset`, `DisplaySize`,
  `FeatureRecord.perclos`, and the thresholds derived from iris offset.
  (low, unverified)
- `tools/bundleGuard.mjs` is never typechecked and its hand-written
  `.d.mts` is unverified against it. (low, unverified)

---

## Refuted findings

Recorded so a later session does not raise them again.

**"`isFeatureRecord` has no production caller, so NaN reaches the
export."** The first half is true. The second does not reproduce: the
skeptic ran the repo's own gates with degenerate inputs and they refused
correctly upstream. Corrected to a documentation defect, low.

**"`baselineStep` reaches ready with a NaN baseline forever."** The
mechanism reproduces only at a step size the original auditor did not
use, and "forever" is wrong: an already-ready baseline is immune, proven
by 1,000 consecutive NaN frames leaving it intact. Latent gap, no
reachable producer. Low.

**"`videoStepper` computes the published frame rate, and `core/fps.ts` is
the equivalent."** The second claim is wrong. `measureFps` is an
_average_ estimator over wall-clock timestamps; the stepper uses a
_minimum_ gap over media times. The file's comments record that the
averaging family was tried and produced the 60-measured-as-27 bug. The
bug history was also misattributed. Low.

**"The blink log can go ragged in silence."** Not silent. The Python
reader refuses it loudly and that guard has a test. Low.

---

## What is compliant

### Purity, proven by execution

This is the strongest verified negative in the audit. The method matters
as much as the result.

An auditor wrote a Vite plugin that **deep-freezes every argument to all
104 exported core functions** and ran the entire test suite through it.
ECMAScript modules run in strict mode, so any `sort`, `push`, `splice` or
property write on a passed value throws a `TypeError`.

**473 of 473 tests passed.**

Then, because a harness that does nothing also passes, they ran a
**canary**: the guard itself wrote a property after freezing. 349 tests
failed with `Cannot add property __canary, object is not extensible`. The
harness was reaching real call sites.

A second harness called every exported core function **twice with
identical arguments** and compared serialised results. 473 of 473 passed.
Any cache, counter, clock read or randomness would have differed.

Static results, each verified with a scanner shown to work by finding
hits in `src/io`:

| Attacked                             | Result                                    |
| ------------------------------------ | ----------------------------------------- |
| Argument mutation                    | zero, proven by execution                 |
| Non-determinism                      | zero, proven by execution                 |
| Module-level mutable state           | zero (`src/io` has 1, so the scan works)  |
| Hidden clock reads                   | zero                                      |
| Randomness, identity-keyed iteration | zero                                      |
| `throw` as control flow              | zero in all of core                       |
| Imports outside core                 | zero, all 45 modules import only siblings |
| Browser types in signatures          | zero                                      |

The two `sort()` calls in core are on fresh arrays. The one indexed write
is on a copy. All 45 modules imported cleanly **in a bare Node process
with `typeof document === "undefined"`**, and 13 presentation functions
were called successfully there.

### Null over zero

- No `|| 0` anywhere in core. No `return 0`, `return -1` or `return NaN`
  anywhere in core.
- All 44 division sites audited; every denominator guarded against
  literal zero except `sparkline.ts:75-76`.
- `isFeatureRecord` refuses NaN and both infinities on every numeric
  field, verified by execution.
- 99 `toBeNull()` assertions across the tests. `fpsGate.test.ts:27-33`
  asserts the rule in the master prompt's own words, with an explicit
  `.not.toBe(0)`.
- The export border refuses rather than invents: an empty session exports
  nothing rather than a lone header, in both writers.

### Dead code

- **No orphan modules.** A full AST import graph shows all 53 source
  files reachable from the single entry point.
- **No commented-out code** in `src/core` or `src/io`, by two separate
  sweeps.
- `fixtureRecording.ts` does not ship: it is gated behind
  `import.meta.env.DEV`.
- No unused parameters, no unreachable statements, no redundant
  assertions, no empty blocks, no debug leftovers, no `TODO`, `FIXME`,
  `HACK` or `XXX` anywhere in core or io.
- The earlier "19 unused exports" figure was **wrong** and was corrected
  by a full AST scan: of 250 exported symbols, 23 are imported nowhere
  else and 45 more only by tests, but almost all are types, erased at
  build.
- Exactly one declared property in 186 is never read.

### Type safety

- `tsc --noEmit` exits 0. `eslint .` exits 0.
- **Zero `any` in type position** anywhere in `src`.
- **Zero non-null assertions** in `src` or `test`, with
  `noUncheckedIndexedAccess` on. That is real discipline.
- Zero `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`.
- The `CSV_COLUMNS` guard `SPEC.md` claims is real. A skeptic broke it
  deliberately by adding a 17th field and got a compile error.
- The `FeatureRecord` contract agrees four ways: the type, the runtime
  schema, `CSV_COLUMNS` and the `SPEC.md` listing all hold 16 fields.
- The four score caps sum to exactly 100, pinned by its own test, and
  the `score = 100 - sum` identity is asserted from six scenarios.

### The impure edge

- **No network code in `src/` at all.** The telemetry is entirely inside
  the dependency.
- The model and wasm resolve to local paths, verified in the built
  bundle. A fresh clone works: the 3.7 MB model is tracked in git.
- `ADR-0002` records the decision, names the CDN option and rejects it.
- Both `io` to `core` imports are `import type`, so nothing crosses at
  runtime.
- The stepper refuses rather than guesses: it returns null and
  `stoppedEarly` when calibration fails, instead of the old 60 fps
  assumption.
- Every `io` entry point that throws has a caller that catches, except
  the two named in M1.

---

## What could not be checked

- Branch-level coverage of the freeze harness. No coverage provider is
  installed, so the claim is that 103 of 104 exported functions were
  entered, not which branches. The static scan is path-insensitive and
  covers every statement, which is the stronger of the two results.
- Whether `main.ts` hands core a live browser object that behaves
  differently from the plain objects the tests pass. `main.ts` is Chunk 5.
- Whether MediaPipe can actually emit a non-finite landmark. This is the
  unproven trigger for the entire NaN family and it should be settled
  before anyone spends effort on it.
- Floating-point associativity across re-ordered inputs. A measurement
  question for Chunk 4.
- Whether the telemetry call can be blocked at build time, and at what
  cost. Not investigated. It belongs in remediation, not in this chunk.

---

## Carried into the final report

1. **The telemetry call falsifies a claim printed on the page.** It
   needs either a fix or an honest correction to five documents, and the
   correction is owed whether or not the fix is possible.
2. **Guards that fail open on NaN are a single systematic pattern**, not
   seven bugs. `frameClock.ts` already shows the fix. The trigger is
   unproven and should be established first.
3. **`calibrationStore.ts` can blank the page and can freeze the app
   permanently.** Forty-three lines, no error handling, no validation.
   The cheapest real fix in the audit.
4. **The purity result should be published.** Not as a defence, as a
   claim. Very few projects of this size can say their pure layer was
   attacked by execution and held. The freeze-harness method is worth a
   `LEARNING.md` entry on its own.
