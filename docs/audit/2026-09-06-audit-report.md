# The September 2026 audit

The second full audit of blinklab, run on 6 September 2026 against
`main` at 8ad1c06, the day after the roadmap's amendment 16 set the
next era's goal: the most accurate, precise, honest and complete
browser prototype this class of hardware can deliver, on laptops,
tablets, phones and external webcams. The August audit
(`AUDIT_PLAN.md`, `chunk-1` to `chunk-6`) checked the repository
against its own constraints. This one asks a different question:
given everything the repository now contains, what is true about the
instrument, what is wrong, and what should be done first.

Three files carry the result.

- This file: the method, the counts, what was found and how each
  finding was tested, what was killed, what holds and must be
  protected, and what the audit could not do.
- `2026-09-06-appendix-all-findings.md`: every confirmed finding in
  full with both skeptics' evidence, the killed list, and the twelve
  lenses' own strategic paragraphs. The raw record.
- `2026-09-06-strategy.md`: the best path forward and a draft roadmap
  amendment 17, presented for the owner's ruling and not applied.

`REMEDIATION-2026-09.md` at the repository root is the ordered ladder
of fixes built from the confirmed findings, in the form the August
ladder used, so that the next increment is always the first unticked
item.

Completed 6 September 2026. Findings below are final for this audit.

---

## Method

The audit ran as one orchestrated workflow of 85 agent runs in five
phases, every agent read-only against the repository.

1. **Map.** Six agents each wrote a factual map with a file and line
   for every claim: the measurement pipeline, the wiring and product
   surface, the evidence behind every published number, the tests and
   guards, the process and trackers, and the August audit's findings
   and what became of them.
2. **Audit.** Twelve lenses read the maps and the repository and
   filed structured findings with evidence, claim, impact, fix,
   effort and confidence: oculometric science, blink and closure
   logic, gaze and attention, statistical evidence, core numeric
   correctness, wiring correctness, test quality, security and
   privacy, process and documentation, roadmap strategy, demo and UX,
   performance and platform. They were told the accepted limits in
   advance and forbidden from re-filing them as news.
3. **Verify.** One agent merged the 144 raw findings into 109
   canonical ones. Every canonical finding then went, in batches of
   six, to two independent skeptics. The REPRODUCE skeptic opened the
   cited lines and re-ran the numbers, with an instruction to default
   to refuted. The MATERIALITY skeptic assumed the mechanism and asked
   whether it matters against the project's own standards, with an
   instruction to refute anything already documented as an accepted
   limit. A finding died if either refuted it; a surviving finding
   took the lower of the two severities.
4. **Gaps.** A completeness critic read the maps, the survivors and
   the killed list and named six areas nobody had examined. Six gap
   finders ran on those, and their findings went through the same two
   skeptics.
5. **Synthesize.** Three writers produced the remediation ladder, the
   strategy, and the strengths record, from the confirmed findings and
   the lenses' strategic paragraphs.

The run was interrupted once by usage limits after the first 25 agents
and resumed from its journal, so the six maps, the twelve lenses and
the first three verification batches ran before the pause and the
remaining verification, the gap round and the synthesis after it.
Nothing was re-run or edited between the two halves.

---

## Headline

**One finding survived at critical. Sixteen survived at high.**

| Outcome                                                            | Count |
| ------------------------------------------------------------------ | ----- |
| Raw findings from twelve lenses                                    | 144   |
| Canonical findings after deduplication                             | 109   |
| Survived both skeptics, first round                                | 104   |
| Killed by a skeptic, first round                                   | 5     |
| Gap-round findings, six finders                                    | 50    |
| Survived both skeptics, gap round                                  | 50    |
| **Confirmed findings in total**                                    | 154   |
| Skeptic verdicts on the survivors: confirmed at the filed severity | 187   |
| Skeptic verdicts on the survivors: real but downgraded             | 121   |

Severity after verification: 1 critical, 16 high, 62 medium, 75 low.
Effort as estimated by the lenses: 106 small, 47 medium, 1 large.

Two numbers in that table matter for how the rest reads. First, the
skeptics lowered the severity on 121 of 308 verdicts, so the lenses
over-rated roughly four findings in ten and the severities here are
the corrected ones, not the filed ones. Second, only five findings
died outright, and the gap round lost none. That is a lower kill rate
than the August audit's, and the reason is method rather than
leniency: every lens was handed six factual maps first and told the
accepted limits, so the findings it filed were grounded before a
skeptic saw them. The reader should still treat a low-severity finding
whose two skeptics disagreed as weaker than one they both confirmed;
the appendix shows both verdicts for each.

The verdict in one sentence: **the published corpus numbers hold, and
the defects cluster at two seams the corpus never exercises, the live
camera path's clock and the person's own ruler, plus one instrument
the corpus does exercise, the frame stepper on a variable-rate clip.**

---

## The critical finding

**G-Stepped-1. A mis-calibrated step silently re-measures frames under
fabricated timestamps and inflates the reported rate, opening the 25
fps gate on clips that should be refused.** `src/io/videoStepper.ts`
calibrates its step from the smallest gap among the first six probed
frames. One short gap sets a step shorter than the clip's true period;
every later schedule slot that lands inside a frame already showing is
measured again, same pixels, same landmarks, a new invented timestamp,
and counted as a new frame. A 200-frame clip at 20 fps reports 399
frames at 40.0 fps with `stoppedEarly:false`. The 25 fps refusal
passes, and blink rate, PERCLOS, long closures and the score are all
published for a recording the instrument has declared unmeasurable.
Both skeptics reproduced it digit for digit through the real stepper
against a fake decoder with an explicit frame-time list. The
materiality skeptic added that the calibration takes the smallest gap,
so the reported rate is the clip's peak rate and the error runs toward
false inclusion: a phone video that drops below 25 fps in a dim room
still reports 30 and passes.

Why it is critical and not high: it fabricates a measurement and it
defeats the project's flagship refusal. Why it did not move a
published number: all eight Eyeblink8 clips are constant-rate, and
that corpus has a container cross-check that would have shown it. The
exposure is UTA-RLDD, which has no such check, is phone-recorded, and
whose 30 exclusions were decided by this calibration (G-Stepped-3,
high). The fix is ladder item A1: count inexact landings, refuse the
run by name above a pre-registered fraction, and write the stepping
witness into every stepped export. The prediction for the Eyeblink8
re-run under the fix is zero inexact landings and a byte-identical
result, and that prediction is committed before the change.

---

## The sixteen high findings

Grouped by the seam they sit on. Ids refer to the appendix; ladder
items refer to `REMEDIATION-2026-09.md`.

### Ticks, not photographs

**F-001.** On the live camera path `processFrame` runs on every
display refresh, and the frame is re-read two to four times per
delivered photograph on a fast machine. `analyzeClosing` divides the
largest aperture drop by the adjacent tick gap, so peak closing
velocity and the amplitude-over-velocity ratio scale with display
refresh over camera delivery. Both skeptics reproduced the scaling
with the repository's own function: the same 30 fps blink read at 30,
60 and 120 Hz gives velocities in the ratio 1:2:4. The score's
sluggish-lid penalty is priced from this column and can essentially
never fire on a 120 Hz display. Committed corpus numbers are
unaffected because the stepped path reads each decoded frame once,
and the inflation is recoverable after the fact because the export
header records both rates. Ladder A2; the strategy's first lever.

**F-002.** The same mechanism as a priority: three of four inferences
on a fast machine and about 45% on phones carry no information and
are the thermal load phones throttle under. Roadmap row 13.8 is this
change and is filed as performance; it is a correctness row. Ladder
A2, roadmap move in D12.

### The frame stepper and the corpus

**G-Stepped-3.** UTA-RLDD's 25 fps exclusion is a property of the
stepper's six-frame calibration on each file, not of the file, and
nothing cross-checks it against the container. The materiality
skeptic's addition is the important one: the error runs toward false
inclusion and is label-correlated on that corpus, because the drowsy
sessions are the late, dim ones. No evidence shows it fired; the
count and class balance are plausible. Ladder A11, owner half.

**G-Reproduc-2.** The evaluator that turns blink logs into the 83.6%
headline has no test file. Its three deliberate safety properties
(skip watched-mode logs, flag a coverage gap, split by glasses) can
all be deleted with the analysis CI job green; the reproduce skeptic
did so on a scratch copy. No published number is currently wrong; the
run reproduced twice on independent hardware. Ladder D1, the cheapest
high-leverage repair on the list.

**G-export/l-1.** `sampled_fps` crosses the export border rounded to
one decimal while the page's verdict reads the raw double, so in the
band just under 25.0 the page says refused and the Python mirror says
warned, and just under 60.0 the page says warned and the mirror says
ok. `pilot.py` treats that disagreement as an instrument defect and
halts the whole cohort. Ladder A3, one line plus two fixtures.

### The person's own ruler

**F-005.** The guided calibration places the blink line at the
midpoint of the person's measured open and closed apertures. The
instrument's own committed measurement says fully shut eyes read
about a third of baseline, so the guided line sits 30 to 50% above the
passive half-of-open line, and the single `blink duration` column
carries two definitions with no mark saying which. The pre-registered
adoption document's premise that the two lines nearly coincide is
refuted by the repository's own numbers. Ladder C2.

**G-Guided b-4.** The guided line has no soundness ceiling. The
resolve step checks two sample counts and one separation ratio and
returns the bare midpoint, so a line at 0.85 of the open eye passes,
inside the droop band the instrument documents. The one soundness
ceiling in the codebase guards the passive ruler the guided line
supersedes. Ladder A9.

**F-007 and G-Guided b-6.** Which line produced a session's numbers
is absent from the per-second CSV and the blink log; a stored line
follows the browser onto clips and onto other faces; it lifts the
refusal for blinks but not for PERCLOS or the score; and the Python
plotting track redraws a threshold the detector did not use, under a
comment that says the opposite. Round II's frozen plan cannot read a
guided session. Ladder A8, and it must land before the pending
regression run.

**F-009.** The long-closure reducer has no hysteresis while its
sibling, the blink reducer, does. One six-second closure fired three
and two long-closure events on two iPhones in the dry run. The
reproduce skeptic corrected two impact figures: the score penalty is
capped at 30 points, not 45, and the alert has a five-second debounce.
It also found the opposite failure, zero events under independent
noise, so the missing band produces both over- and under-counts.
Ladder A7, prediction first through the trace harness.

### Honesty drift under fresh stamps

**F-014.** `MODEL_CARD.md`, revised the day after the UTA-RLDD
alertness result landed, still says the score was tested against
nothing external; the README reports AUC 0.70; the participant report
carries the card's stale sentence twice, and the quote-pin machinery
enforces it because it pins to the card rather than to the result
file. Ladder B1.

**F-020.** `drozyGuard` watches one file while all seven DROZY rows
were measured by code that has since moved; three are declared stale
and four, including the largest correlation, are presented as
current-code numbers under a caveat the guard cannot see is false.
Ladder B4.

**F-023.** The README's privacy section names two localStorage keys
as the only storage the app touches; the app writes four, and the two
omitted are a pseudonym and a personal blink line. This is the class
of failure the paragraph beneath it apologises for, and the stamp
guard blesses it because it checks dates, not content. Ladder B2.

### Sessions that lose data

**F-015.** Stop camera disables both exports; Start, run, Stop, export
loses the session, contradicting the handler's own comment. Ladder A4
as an interim, A17 for the missing `ended` state.

**F-017.** A superseded camera start attaches its stream and never
stops it. Two picker changes inside `getUserMedia` latency, or Start
then a clip pick while the permission prompt is up, leave a live track
the page cannot turn off, with the recording light on after the page
says the camera is off. Category corrected from security to honesty by
the materiality skeptic; nothing leaves the browser. Ladder A5.

**F-028.** On a phone without `Element.requestFullscreen` on a `div`,
Light response throws after the black overlay is shown and leaves a
textless screen with no touch exit; the only way out is a reload,
which discards the session. The materiality skeptic found a second
trap: even where fullscreen works, a touch user has no exit because
the only handler is a keydown. Ladder A6.

### Guards that hold the wrong thing

**F-018.** Six refusal constants survive mutation: `MIN_BLINK_FPS`
bends to 23 or 28 and every other floor moves an order of magnitude
with all 962 vitest tests green, because the tests derive their probes
from the constants. The mutation runner built in August to close this
class has been unrunnable since 20 August. Ladder D2.

---

## Medium and low

Sixty-two medium and 75 low findings. By category, with the high and
critical counts alongside so the shape is visible:

| Category           | Critical | High | Medium | Low | Total |
| ------------------ | -------- | ---- | ------ | --- | ----- |
| defect             | 1        | 9    | 21     | 11  | 42    |
| risk               |          | 2    | 8      | 16  | 26    |
| overclaim          |          | 2    | 9      | 11  | 22    |
| missing capability |          |      | 6      | 9   | 15    |
| science            |          | 1    | 1      | 12  | 14    |
| process            |          | 1    | 8      | 4   | 13    |
| wrong priority     |          |      | 5      | 4   | 9     |
| ux                 |          |      | 4      | 5   | 9     |
| performance        |          |      |        | 3   | 3     |
| security           |          | 1    |        |     | 1     |

The medium findings that the ladder places in Stage A, because they
change numbers people will see: the blink rate divides by elapsed time
rather than observed time, so a face-loss gap reads as calm (F-004);
blink counting goes silently dead during a droop below the re-arm line
and prints 0 per minute (F-031); refusal withholds the rate but not
durations, amplitude, velocity or the blink log (F-008); the first 30
seconds of every session count blinks against the owner's fixture line
(F-006); the 25 fps refusal judges the processing rate and the report
can assert withholding while printing the numbers (F-003); one
untrusted frame splits a closure into two long closures, pinned by a
test as intended (F-036); the guided calibration's own three-second
closed phase is scored as a microsleep (F-040); delivery rates are
memoised at the first consumer so the report's evidence rate depends
on click timing (F-053); a finished clip never reaches an ended state
(F-057); the head-pose matrix is read row-major where the upstream
proto is column-major (F-032); blinks are not excluded from fixations
(F-042); and a crashed stepped clip exports as a camera session
(F-016).

The low findings are mostly stated bounds that are known and unwritten
(the PERCLOS definition includes blink time; peak velocity is biased
12 to 28% at 25 to 30 fps by the single finite difference; the iris
constant carries no citation and no spread; aperture is not
pose-invariant inside the gate), small guard holes, and documentation
that describes a page two redesigns old. They are grouped into
one-PR bundles in the ladder (A27, B11, B12, D16) rather than listed
as rows.

The six gap lenses produced 50 findings between them: the guided
calibration as a procedure (11), the stepper's constant-rate
assumption and the corpus exclusion mechanism (9), the export and
loader border (9), reproducibility of the headline (8), browser-engine
conditioning of the published numbers (7), and the build, deploy and
notice path (6). Every published detection number comes from one
WebKit binary; no roadmap row names the engine; the deploy workflow
publishes four minutes before CI finishes and would publish a red
merge, though 40 of 40 recent runs on `main` were green so it never
has.

---

## Killed

Five canonical findings did not survive. Each is in the appendix with
both verdicts.

- **F-085**, "eyelid aperture is a mean of two off-centre chords, not
  palpebral fissure height." Facts hold; `aperture.ts` says so in its
  own words and `MODEL_CARD.md` already declares the row not validated
  against a physical measurement. A re-find of an accepted limit.
- **F-089**, "README answers 'track reported sleepiness?' with a bare
  yes." The bare yes does not exist in the file; every mitigation the
  finding asked for is already present.
- **F-092**, "the Eyeblink8 headline never states how many faces the
  clips contain." The reproduce skeptic found the real defect is the
  opposite one, an unsourced 8-clips-as-8-people conversion already on
  record from August; the materiality skeptic upgraded that. The
  corrected statement lives in ladder B14.
- **F-104**, "five demo-surface rows cost PRs without moving accuracy."
  Judges rows against a two-goal contract when amendment 16 has three;
  both skeptics refuted it.
- **F-107**, "the status line is not a live region." Correct as code,
  and a dated, twice-reviewed decline in the roadmap with a demonstrated
  reopen path. Not a finding by the audit's own rule.

---

## What the critic considered and left

The completeness critic listed fifteen areas it examined and rejected
as gaps, with the reason for each. The ones a reader might expect to
see: the NaN fail-open family from the August audit (still no
`isFinite` in six modules, carried by prior item 2 rather than
re-filed); a possible one-frame offset between stepper index and
annotation frame id (inside the four-frame tolerance); font and
third-party attribution (vendored and licensed); the dataset licence
chain (thorough, with written permissions recorded); locale and units
(English only, decimal point always); the Python analysis broadly (22
test modules, matching rule re-implemented in August); the small core
modules nobody opened (clean); the KSS path; camera error states; and
deploy-on-red as a standalone gap (folded into the build lens). The
full list is in the appendix.

---

## What holds and must be protected

The strengths record, condensed from what all eighteen lenses named as
holding. A recommendation that breaks one of these is a net loss.

### Measurement honesty

- Null never becomes zero, in either language. An untrusted frame
  breaks the blink cycle, joins neither side of PERCLOS and abandons a
  long closure; a clip with no annotated blinks returns `None`
  (`src/core/blink.ts:86-90`, `perclos.ts:80-82`,
  `longClosure.ts:73-84`, `analysis/blinklab/blink_match.py:79-90`).
- Refusal is always an available outcome and always carries its
  reason: the fps floor, the passive ruler, the guided-line separation,
  the pupil's seven gates, and every loader seam name what was missing
  (`fpsGate.ts:11-13`, `calibrationWindow.ts:67-75`,
  `guidedCalibration.ts:101-106`, `pupil.ts:40-56`,
  `analysis/blinklab/loader.py:118-150`).
- Every quotient in `src/core` sits behind a positivity guard that
  returns null, so the rule is mechanical rather than remembered
  (`statistics.ts:48`, `fps.ts:15`, `aperture.ts:34,102`,
  `pupil.ts:98-106`).
- Signals are defined in the geometry the cited literature names: EAR
  in pixel space, the iris ruler on the horizontal rim chord the lids
  never occlude, gaze projected onto the eye's own corner axis
  (`ear.ts:34-56`, `aperture.ts:17-35,109-122`,
  `gazeOffset.ts:45-55`).
- The instrument-adjusted shut line is aliased, not copied, so PERCLOS
  and long closure cannot drift apart (`perclos.ts:27`,
  `longClosure.ts:35`).
- Limits are stated where they bite: "GPU" is a request not an
  observation, the heatmap says why it is coarse, every gaze answer is
  labelled calibrated or not (`MODEL_CARD.md:263-266`,
  `heatmap.ts:5-8`, `main.ts:2145-2157`).

### Engineering discipline

- Backwards-clock refusal has one door and the same shape in every
  stateful reducer, and the three clocks are kept apart so a corpus
  number is a property of the file, not the machine
  (`frameClock.ts:47-58`, `modelClock.ts:49-66`).
- The `sourceRunToken` supersession pattern is re-checked at every
  await and bumped by both crash handlers; the frame loops stop on the
  first throw and report once while keeping exports alive
  (`main.ts:1076,1194,1310,1451,4614`, `frameLoop.ts:8-22`).
- Memory is flat by construction: every rolling buffer is bounded by
  milliseconds, every long-session store has a declared cap the export
  announces (`sparkline.ts:12-34`, `deliveryRate.ts:35-45`,
  `frameTrace.ts:50-70`).
- Measurement on a file is driven by decoded frames and the stepper
  refuses rather than guesses (`frameLoop.ts:24-39`,
  `videoStepper.ts:221-236,271-285`, `frameSearch.ts:86-151`). The
  critical finding is a hole in this discipline, not its absence.
- Telemetry is blocked at all three transports with the URL policy
  pure in core, verified against the vendored bundle, and proved by a
  live 70-second end-to-end test (`telemetryBlock.ts`,
  `telemetryPolicy.ts`, `test/e2e/telemetryBlock.spec.ts:81-110`).
- Tests pin operators by literal millimetres and milliseconds, guards
  carry their own "would notice if it broke" probes, and the e2e layer
  proves the wire is live before asserting silence
  (`test/core/blink.test.ts:42-56`, `test/tools/claimGuard.test.ts:55-61`,
  `test/e2e/framesMeasured.spec.ts`).

### Evidence discipline

- Pre-registration is enforced as commit order, not prose; the
  prediction lands in its own commit before the number exists
  (`ROADMAP.md:41`; `docs/iris-occlusion.txt:59-73` then `:103-110`).
- Wrong answers and refuted predictions stay on the page with dated
  corrections (`README.md:95-143,312-328`,
  `docs/validation-dry-run.txt:155-187`,
  `docs/miss-character.txt:188-217`).
- Published numbers are recomputed on every run via generated blocks
  and tests that regenerate committed tables from fresh fixtures
  (`tools/resultsBlock.mjs`, `tools/modelProvenance.mjs`,
  `test/core/apertureNoise.test.ts:82-126`,
  `test/core/samplingBounds.test.ts:127-167`).
- The session verdict is pinned byte for byte from two independent
  implementations, TypeScript from page state and Python from the CSV
  alone (`test/core/sessionVerdictFixture.test.ts:57-107`,
  `analysis/blinklab/verdict.py:81-91`).
- The evaluator is rigging-resistant by design: one-to-one
  best-overlap matching with deterministic tie-breaks and pooled
  counts, classifier preprocessing strictly inside each fold
  (`blink_match.py:109-167`, `rldd.py:303-325`).
- Exclusions are properties of the recording fixed before any label,
  and the exclusion bias is printed above the correlations it weakens
  (`analyse_drozy.py:156-186`, `docs/uta-rldd-result.txt:36-43`).

### Product

- Refusals reach the visitor as sentences, never blanks or zeros, down
  to two different disabled messages for "nothing stored" versus
  "cannot look" (`fpsGate.ts:50-57`, `main.ts:1763-1772`).
- Disabled controls carry their reason in the label and every export
  outcome says what happened (`exportStatus.ts:23-41`).
- Scope travels with the number on screen: the conditions lines built
  in core stand beside the values they qualify
  (`samplingBounds.ts:142-165`, `main.ts:4327-4348`).
- Layout and accessibility are mechanised rather than promised: a
  fixed-height status strip, a firing-edge `role=alert` region,
  contrast-guarded tokens on both grounds, self-hosted fonts, a single
  column under 1000 px (`tools/contrastGuard.mjs`,
  `styles.css:29-57,288-321`).

---

## What this audit could not do

- **No owner hardware, no corpus re-run.** Findings about live
  cameras were reproduced through the repository's own functions and
  committed exports, not by running a camera. F-015 and F-017 were
  read from code; the skeptics judged the paths deterministic but did
  not drive a browser. F-028 was reproduced headless.
- **The gap round lost nothing.** Fifty of fifty gap findings
  survived. The same skeptic pair, prompts and rules applied, so this
  is more likely the critic's targeting than leniency, but the reader
  should weigh gap findings whose materiality verdict was "downgraded"
  as the weaker half of the record.
- **Agents' counts are their own.** Where a finding quotes a number
  the repository does not publish (962 vitest tests against the
  README's 952 `it(` tokens, the 62% prose share of recent file
  touches, the 283 commits in 30 days), the number was computed by the
  agent and confirmed by a skeptic, not by a committed tool. The
  ladder's B15 makes the test count re-derivable; the others are
  stated as observations.
- **Severities are corrected but not calibrated.** The four-level
  scale is the audit's; the skeptics disagreed with the lenses on 121
  of 308 verdicts and with each other on a smaller number. Where they
  disagreed, the lower severity was taken.
- **The synthesis writers had the findings, not the repository's
  future.** The draft amendment 17 in the strategy file re-orders the
  era's ladder around the live instrument; it is a proposal with its
  reasons attached, and the owner's ruling is the next event.

---

## What happens next

`REMEDIATION-2026-09.md` names the order: A1 (the stepper), A3
(rounding at the border), A4 (exports after Stop), A5 (the camera
track), A6 (the light overlay), A2 (the delivered-frame driver), A8
(line provenance), the three honesty sentences a visitor reads first
(B1, B2, B3), D2 (boundary probes and the mutation runner), then A7
(hysteresis, first through the trace harness). Owner items (the RLDD
manifest, one head-pose frame, the 60 fps question, the guided-line
verification, the engine comparison, the anchor logs, the regression
run) can be scheduled on any quiet day and block nothing above them.

The strategy file's draft amendment 17 is the roadmap change the
ladder implies. It is not applied. Until the owner rules, the roadmap
stands as amendment 16 wrote it, and this audit is a record beside it.
