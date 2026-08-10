# Appendix: Chunk 3, all findings as produced

The complete, unedited output of the six Chunk 3 auditors and the twelve
skeptics who tested them. `chunk-3-tests.md` is the write-up; this file
is the raw record behind it.

Produced 10 August 2026.

---

## Verification key

- **SURVIVED** a skeptic told to refute it, severity as corrected.
- **REFUTED** as stated. The corrected statement is given.
- **UNTESTED**. No skeptic saw it. Treat as a lead, not a conclusion.

---

## All 59 findings

### C3-01. blinkShape tie-breaking is untested, and it swings the sluggish-lid number 2x

|                             |             |
| --------------------------- | ----------- |
| Constraint                  | D1          |
| Severity as filed           | high        |
| Verdict as filed            | violation   |
| Verification                | **REFUTED** |
| Severity after verification | **low**     |

**Evidence.** M57 src/core/blinkShape.ts:27 `) < (` -> `) <= (` SURVIVED; M60 line 37 `) > (` -> `) >= (` SURVIVED (full suite passed both times). Differential search (scratchpad/diffshape.mjs) found concrete distinguishing inputs: for M60, input [{0,5},{33,5},{66,1},{166,5},{266,0}] gives orig [amp 5, peak 121.2, A/V 41.25 ms] vs mutant [5, 50, 100].

**Detail.** Both loops pick the FIRST occurrence of the min and max aperture. No test contains a window with a repeated minimum or a repeated maximum, so the tie-break rule is free to flip. amplitudeOverVelocityMs feeds score.ts's sluggish-lids penalty whose ramp floor is 150 ms, so an unnoticed flip from 41 ms to 100 ms moves a published score. M57 also flips a refusal into an answer: a flat-then-dip window [2,2,3,2] returns null today and a shape under the mutant.

**Corrected statement.** blinkShape tie-break mutants survive, but the tie cannot occur in real data and moves no score

**Skeptic's reasoning.** I reproduced both mutations in a scratch copy and both do survive — that half is true. Baseline `npx vitest run` = 49 files / 473 tests passed; with line 27 `) < (` -> `) <= (` (M57): 473 passed; with line 37 `) > (` -> `) >= (` (M60): 473 passed. Everything else in the finding fails on inspection.

1. THE SCORE CLAIM IS ARITHMETICALLY FALSE. The detail says the 41 ms -> 100 ms flip "moves a published score". src/core/score.ts:55-56 set LID_SLUGGISH_RAMP_FLOOR_MS = 150, CEIL = 300, and rampPoints (score.ts:75) clamps `(value - floor)/(ceil - floor)` to [0,1]. Running it: `A/V 41.25 -> 0 points`, `A/V 100 -> 0 points`, `A/V 150 -> 0 points`. Both sides of the auditor's own distinguishing input score ZERO sluggish points. The score does not move. The finding's headline evidence refutes its own headline claim.

2. THE TIE IS UNREACHABLE ON REAL DATA. I swept the recorded fixture through both mutants (probe in scratchpad/work2/test/core/_probe.test.ts). Output: `PROBE frames= 300 usable= 300 nullFrames= 0 distinctApertureValues= 300` and `PROBE windows= 10920 M57 differs= 0 M60 differs= 0`. Every one of the 300 aperture values is distinct, and across 10,920 windows of length 2 to 40 both mutants are byte-identical to the original. apertureMm is an unrounded float from landmark geometry (`grep -n "Math.round|toFixed" src/core/aperture.ts` returns nothing), so exact bit-equality does not occur.

3. THE ONE REALISTIC TIE SHAPE IS A NO-OP. The only way an exact tie can enter this pipeline is a duplicated video frame. I tested that shape, duplicates on the pre-blink plateau AND at the blink bottom, `[0,8],[33,8],[66,8],[99,5],[132,2],[165,2],[198,6]`: `DUP orig`, `DUP M57` and `DUP M60` are all identical (`amp 6, peak 90.909, A/V 66`). The extra flat segment contributes velocity 0, so the peak is unchanged. Only the auditor's contrived double-dip with a bit-exact earlier maximum distinguishes them, and that is a measure-zero event.

4. D1 IS NOT THE RIGHT CONSTRAINT. AUDIT_PLAN.md:188 defines D1 as "Tests assert mathematical properties, not mocks." test/core/blinkShape.test.ts does exactly that: hand-computed amplitude 6 mm / peak 80 mm/s / ratio 75 ms on deliberately uneven timestamps, a descent-only test, a pre-closure-maximum test, four null-refusal cases (empty, single sample, flat, zero dt, honouring the null-over-guessing rule), and fixture property bounds. Nothing is mocked and nothing is tautological. A surviving mutant is not by itself a D1 violation, and mutation score is not a project gate anywhere in the master prompt.

What survives: no test pins the first-occurrence tie-break, so a refactor could silently change it. That is a one-line hardening test, not a high-severity defect. Severity corrected high -> low.

REPO STATE, AND A WARNING. All my work was in the scratchpad; I made zero writes to the audited worktree. `git status --porcelain -- src test package.json vitest.config.ts` is EMPTY, so all source and config is untouched. However the worktree is NOT clean: 57 paths, all of them deletions (`git status --porcelain | grep -cv "^ D "` = 0), covering docs/ entirely plus LEARNING.md, PROJECT.md, STATE.md. The cause is external, not me: `git reflog` shows `750fa07 HEAD@{0}: reset: moving to origin/main`, and the directory mtime is 12:04, the same minute a read-only `cp -R` of mine came back partial because files were vanishing underneath it. Something outside this session reset /Users/evannorus/Desktop/blinklab build/blinklab/.claude/worktrees/audit-fresh mid-audit. The parent should confirm that before trusting any concurrent auditor's file-level evidence.

### C3-02. PERCLOS staleness boundary trio never reaches the boundary, off by a float epsilon

|                             |              |
| --------------------------- | ------------ |
| Constraint                  | D2           |
| Severity as filed           | high         |
| Verdict as filed            | violation    |
| Verification                | **SURVIVED** |
| Severity after verification | **medium**   |

**Evidence.** M42 src/core/perclos.ts:102 `> PERCLOS_STALE_MS` -> `>=` SURVIVED despite test/core/perclos.test.ts:170 "runs the staleness boundary trio". node check: the trio's `lastSampleMs = 60*30*DT_MS - DT_MS` = 59966.666666666671517 but the accumulated last sample is 59966.666666668170365, so the at-the-line probe lands at 1999.9999999985 ms, not 2000. My probe with integer timestamps kills M42 immediately.

**Detail.** The test that exists to cover this boundary silently misses it because the fixture accumulates DT_MS = 1000/30 by repeated addition while the probe recomputes it by multiplication. A test that looks like it covers the line and does not is worse than a missing one. Same file, M36 (line 71) and M39 (line 89) `<= PERCLOS_WINDOW_MS` -> `<` also SURVIVED: nothing tests a sample sitting exactly 60000 ms old.

**Corrected statement.** Both PERCLOS time boundaries are untested: the staleness trio misses the line by a float epsilon and the 60 s window edge has no test at all

**Skeptic's reasoning.** CONFIRMED, but the severity is inflated. I reproduced every claim in an isolated copy at /private/tmp/.../scratchpad/skep-d2-perclos (node_modules symlinked to the repo root, which is where it actually lives, not in the worktree).

1. The float arithmetic is exactly as claimed. `node -e` accumulating DT_MS=1000/30 1799 times gives a last timestamp of 59966.666666668170365, while the trio's `60*30*DT_MS - DT_MS` gives 59966.666666666671517. The "at the line" leg of test/core/perclos.test.ts:170 therefore probes a staleness of 1999.9999999985011527 ms, not 2000. It is a second "below" probe, so the trio is really below/below/above.

2. M42 reproduced: changing src/core/perclos.ts:102 `> PERCLOS_STALE_MS` to `>=` and running `npx vitest run` gives "Test Files 49 passed (49) / Tests 473 passed (473)". Survives the whole suite.

3. M36 (line 71) and M39 (line 89) reproduced independently: `<= PERCLOS_WINDOW_MS` to `<`, each run alone, both give 473 passed. `grep -rn "60000" test/` shows no perclos test anywhere uses the 60000 ms window edge. This leg is worse than the staleness one: it has no test at all, not even a near-miss.

4. The fix is trivial and the auditor's integer probe works. A probe using `for (let t = 0; t <= 60000; t += 1000)` passes on unmutated code and fails on M42 ("expected null to not be null" at the exact-2000 assertion); a matching window probe fails on M39 ("expected +0 to be close to 0.01639...").

5. Not handled in writing. No ADR in decisions/, no ROADMAP amendment (amendments 5 and 6 cover the closed line, not the boundary convention), no code comment naming the tie-break for PERCLOS_STALE_MS or PERCLOS_WINDOW_MS (the PERCLOS_CLOSED_FRACTION comment does state its convention, and that trio at line 262 works), nothing in SPEC.md or test/MANUAL.md item 54, and `gh issue list --state all` shows nothing open on it. Unticked rows 8.6 and 8.7 are coverage and budget gates and are irrelevant: Section 10 rule 3 applies from the first threshold.

WHY MEDIUM, NOT HIGH. Two bounding facts the finding leaves out. First, the sibling trio in the same file, "runs the boundary trio at exactly the minimum span" (line 92, integer timestamps), DOES kill its mutant: `< PERCLOS_MIN_OBSERVED_MS` to `<=` gives "1 failed | 19 passed". So the discipline is real in this file and only the float-accumulating fixture defeats it. Second, the guard itself is genuinely defended: replacing the whole staleness condition with `false` fails 3 tests, so the #122 absence-drift regression is not at risk. What survives is only the exact-equality tie-break, and with performance.now()-derived frame timestamps a gap of exactly 2000.000000 or exactly 60000.000000 ms never occurs in production, so no user ever sees a different number. The harm is false assurance from a test that advertises a boundary it does not touch, in a safety-adjacent core module, fixable in three lines. That is a real D2 violation worth fixing, not a high-severity one.

REPO UNTOUCHED BY ME. All mutation work happened in the scratch copy; the original src/core/perclos.ts was restored there and the copy is green again (473 passed). `git -C "<repo>" status --porcelain` reports 58 deleted files (LEARNING.md, PROJECT.md, STATE.md, docs/**), which I did NOT cause: my scratch copy was taken at 12:04 before any mutation and already lacks those paths, so they were deleted before my first command by something else in this run. Every command I ran against the real worktree was read-only (sed -n, grep, cat, wc, ls, cp -R out of it, git status).

### C3-03. baseline.ts holds four thresholds with no boundary test of any kind, and no value pin

|                             |              |
| --------------------------- | ------------ |
| Constraint                  | D3           |
| Severity as filed           | high         |
| Verdict as filed            | violation    |
| Verification                | **SURVIVED** |
| Severity after verification | **medium**   |

**Evidence.** `grep -rl BASELINE_LEARN_MS test/` -> empty; same for BASELINE_MIN_SAMPLES, BASELINE_RISE_MIN_SAMPLES, BASELINE_RECENT_CAP. Mutations run in a scratch copy against `npx vitest run` (baseline 473 passed): `elapsed >= BASELINE_LEARN_MS` -> `>` = 473 passed; `samples.length >= BASELINE_MIN_SAMPLES` -> `>` = 473 passed; `recent.length >= BASELINE_RISE_MIN_SAMPLES` -> `>` = 473 passed; 30000 -> 15000 = 473 passed; 100 -> 40 = 473 passed; 300 -> 150 = 473 passed; 600 -> 400 = 473 passed.

**Detail.** src/core/baseline.ts:47, :48 and :63 are the readiness and rise gates that decide what OPEN means for this person, and every downstream line (blink threshold, shut line, PERCLOS, long closures) is a fraction of that number. None of the four has below, at or above. Not recorded anywhere: no ROADMAP amendment, no ADR, no code comment, and AUDIT_PLAN.md finding 10 does not mention baseline.

**Corrected statement.** baseline's three readiness and rise gates (LEARN_MS, MIN_SAMPLES, RISE_MIN_SAMPLES) have no boundary triad and no pinned value: the 30 s learning window can be cut to 1 s with all 473 tests green

**Skeptic's reasoning.** CONFIRMED, but narrowed from four constants to three and downgraded from high to medium.

Reproduced independently. Scratch copy at scratchpad/work (repo + real node_modules), baseline `npx vitest run` = 49 files, 473 passed. Every mutation the auditor claimed survives, verbatim: baseline.ts:47 `elapsed >= BASELINE_LEARN_MS` -> `>` = 473 passed; :48 `samples.length >= BASELINE_MIN_SAMPLES` -> `>` = 473 passed; :63 `recent.length >= BASELINE_RISE_MIN_SAMPLES` -> `>` = 473 passed; constants.ts:135 30000 -> 15000, :136 100 -> 40, :140 300 -> 150, :139 600 -> 400 all = 473 passed. I went further and it is worse than reported: BASELINE_LEARN_MS 30000 -> 1000 = 473 passed, and BASELINE_MIN_SAMPLES 100 -> 11 = 473 passed. The thirty second learning window can be cut to one second and CI stays fully green. `grep -rl BASELINE_LEARN_MS test/` exits 1, same for the other three; test/core/constants.test.ts pins only landmark index sets, no numeric threshold.

Not documented anywhere. AUDIT_PLAN.md:369-374 finding 10 lists the triads it verified and names `BLINK_REFRACTORY_MS` as the one gap; baseline is absent from that list. No ADR (decisions/ has only ADR-0001..0003), no SPEC.md entry, no code comment in baseline.ts. Not unreached roadmap work either: ROADMAP.md:122-123 rows 8.6 and 8.7 are unticked, but a coverage floor would not catch this, since all four lines execute today. Row 4.2 is ticked and its own stated Check, "baseline rises but never falls", genuinely is tested (baseline.test.ts:69-90).

Two corrections to the finding, which is why the title and severity change:

1. BASELINE_RECENT_CAP does not belong. It is a window size handed to `pushBounded`, whose below/at/above triad exists at test/core/ringBuffer.test.ts:6-21, and my mutation 600 -> 60 FAILED 3 tests. Calling it untested is wrong.
2. "No boundary test of any kind" overstates. test/core/baseline.test.ts:49-54 "keeps learning past the deadline when samples are too few" is a real below-case for BASELINE_MIN_SAMPLES: 10 samples with elapsed 34,900 ms, so it isolates the sample gate past the time gate. It is just far too loose, which is why 100 -> 11 survives. The at and above legs are still missing.

Severity medium, not high. It is a regression-protection gap with no demonstrated live defect, in a module that is otherwise unusually well tested (15 tests, a named fix #126 regression suite, and `it("pins the ceiling factor")` pinning BASELINE_MEDIAN_CEILING_FACTOR to 1.4, which shows the project's own pinning convention was applied here and just not extended to these three). BASELINE_LEARN_MS additionally has a designated human check before each phase tag, test/MANUAL.md:27 item 23, which states the thirty second countdown explicitly. What is genuinely unguarded at every pyramid layer is BASELINE_MIN_SAMPLES and BASELINE_RISE_MIN_SAMPLES, plus the three off-by-one operators, and those do sit upstream of the blink line, the shut line, PERCLOS and long closures. Real, cheap to close with the file's existing injected-clock `feed` helper, but not high.

REPO STATE, important. I made no write, no git-mutating command and no formatter run against the audited worktree; my only commands there were cat, grep, sed -n, ls, du, read-only git, and a tar-create piped into scratch. The worktree is nevertheless NOT clean: `git status --porcelain` reported 59 deleted paths (docs/**, LEARNING.md, PROJECT.md, STATE.md), and on re-running seconds later the count had dropped to 57, so another process is actively restoring files while I watched. `git worktree list` shows the branch is worktree-audit-fresh, not the worktree-full-project-audit named in my session-start snapshot, and `git reflog` HEAD@{0} is "reset: moving to origin/main". ARCHITECTURE.md (09:24) and AUDIT_PLAN.md (11:36) predate my session start (12:04). A concurrent agent, not this audit, is churning that tree.

### C3-04. The PERCLOS staleness "at" case misses the boundary by 1.5 nanoseconds, so the trio does not discriminate

|                             |              |
| --------------------------- | ------------ |
| Constraint                  | D3           |
| Severity as filed           | high         |
| Verdict as filed            | violation    |
| Verification                | **SURVIVED** |
| Severity after verification | **low**      |

**Evidence.** test/core/perclos.test.ts:170 "runs the staleness boundary trio" probes `lastSampleMs + PERCLOS_STALE_MS`. Flipping src/core/perclos.ts:102 `nowMs - last.timestampMs > PERCLOS_STALE_MS` to `>=` leaves 473 passed. Cause proven with node: the test computes `lastSampleMs = 60*30*DT_MS - DT_MS` in closed form (59966.666666666671517) while the state's last sample was accumulated by 1799 additions of 1000/30 (59966.666666668170365), so the "at" probe asks an age of 1999.9999999985 ms, not 2000.

**Detail.** All three legs of the trio therefore sit on the same side of the line as far as the operator is concerned: 1999.0, 1999.9999999985, 2000.9999999985. A trio that reads complete and is not is worse than an absent one, because it stops anyone looking. Fix is to derive `lastSampleMs` from the state rather than recomputing it.

**Corrected statement.** The PERCLOS staleness trio's "at" leg lands 1.5 nanoseconds below the line, so it duplicates the "below" leg and leaves the > vs >= convention unpinned

**Skeptic's reasoning.** Reproduced and confirmed, but the severity and the framing are overstated. Verified with node that the accumulated last sample is 59966.666666668170365 while the test's closed-form lastSampleMs is 59966.666666666671517, a -1.4988e-9 gap, so the three probes are ages 1998.9999999985, 1999.9999999985 and 2000.9999999985. Copied the repo to scratch, flipped src/core/perclos.ts:102 from > to >=, ran npx vitest run: "Test Files 49 passed (49) / Tests 473 passed (473)". So the leg named "at" is not at the line, and the > vs >= convention is unpinned. Not accounted for anywhere in writing: only three ADRs exist (decisions/ADR-0001..0003), none relevant; gh issue list shows 7 open issues, none about PERCLOS staleness; the PERCLOS_STALE_MS comment at src/core/perclos.ts:36-45 explains the two seconds but, unlike the PERCLOS_CLOSED_FRACTION comment above it, never states an at-the-line convention; test/MANUAL.md:58 item 54 checks the behaviour at "about two seconds", which cannot pin equality; roadmap 8.6/8.7 are coverage and budget gates, irrelevant. That makes it a real miss of master prompt rule 3, fixable in one line by deriving lastSampleMs from the state's final sample. But two claims in the finding are wrong. "The trio does not discriminate" is false: I tested stale windows of 1999, 1999.5, 2000, 2000.5 and 2001, and only 2000 and 2000.5 pass the trio, so it still pins the window to (1999.9999999985, 2000.9999999985] and would catch a genuinely wrong constant. "All three legs sit on the same side of the line" is also false: two do, the third (2000.9999999985) does not, so the trio degrades to a below/above pair rather than to three identical probes. Severity "high" is inflated: the only implementation this fails to reject refuses a PERCLOS value at exactly 2000.000000 ms of staleness instead of just past it, and since nowMs and timestampMs are float frame-clock values, exact equality is a measure-zero event whose worst outcome is one reading withdrawn a frame early. grep confirms perclosValue has one non-test caller, src/main.ts:2086. Contrast the sibling trio at test/core/perclos.test.ts:264, built from exact integers, which does discriminate the shut line where the convention is load-bearing because two detectors share it. Test hygiene, not a shipping risk, so low. Protected repo: I never wrote to, staged or deleted anything in audit-fresh; all mutation work was in scratchpad/skeptic-d3/work. git status --porcelain -- src test is empty and git diff on src/core/perclos.ts and test/core/perclos.test.ts is empty, so the audited code is intact. WARNING for the orchestrator: that worktree is nonetheless NOT clean. git status --porcelain reports 57 unstaged deletions (STATE.md, PROJECT.md, LEARNING.md, the whole docs/ tree). Earlier in this same session a grep inside the worktree still matched docs/log.md and docs/audit/chunk-1-docs-config-process.md, and the directory mtime is 12:04:00, mid-session. Something removed them while I worked and it was not me; a concurrent sibling auditor is the likely cause, since the shared scratchpad already holds other agents' copy/ and d3-boundary/repo/ directories.

### C3-05. Issue #174, the reproducibility bug, was closed COMPLETED with zero automated check

|                             |              |
| --------------------------- | ------------ |
| Constraint                  | D7           |
| Severity as filed           | high         |
| Verdict as filed            | violation    |
| Verification                | **SURVIVED** |
| Severity after verification | **medium**   |

**Evidence.** `gh issue view 174` -> CLOSED COMPLETED 2026-08-09T17:53:19Z, title "Reproducibility: the same clip measured twice gives different answers". Fix commit: `git show --stat 6e89eff` -> ` src/main.ts | 35 ++++++++++++++++++++++++++++++-----` and nothing else. `grep -rn '174' test --include='*.ts'` -> no matches.

**Detail.** The commit message claims "three runs are byte for byte identical" and nothing in the repository asserts it. The fix is the `clipModelClockBaseMs` offset at src/main.ts:744 and :755, which is pure arithmetic that could be extracted to core and tested. The similar-sounding test at test/core/frameClock.test.ts:93 predates this fix (added in 8a6b70e, `git log -S frameTimestampMs`) and covers a different function. This is also an A3 miss: the fix increment added no automated check.

**Corrected statement.** Issue #174 closed COMPLETED with no check at any layer: a full revert of the model-clock fix passes lint, typecheck, 473 tests and build, and test/MANUAL.md has no repeat-the-run step

**Skeptic's reasoning.** Verified and confirmed, but the severity and the proposed remedy are wrong. Facts check out: `gh issue view 174 --json stateReason` -> COMPLETED, closed by PR #189; `gh pr view 189 --json files` -> ['src/main.ts'] only, one commit, no test; `grep -rn "174\|modelClock" test/` -> no matches; no ADR (decisions/ has only ADR-0001/2/3), no ROADMAP row, no open issue, and test/MANUAL.md (65 items) has no repeat-the-run step. The auditor is also right that test/core/frameClock.test.ts:93 predates the fix (`git log -S "keeps a file's time axis independent"` -> 8a6b70e, increment 7.0) and covers frameTimestampMs, the pipeline clock, not the model clock. I reproduced the mutation in a scratch copy: deleting clipModelClockBaseMs and restoring `processFrame(nowMs, performance.now(), index)` at src/main.ts:756 gives typecheck clean, lint clean, vitest 49 files / 473 tests passed, build OK. Nothing guards it. Two corrections that lower severity from high to medium. First, the auditor's remedy is wrong: extracting `base + nowMs` to core would not catch this mutation, because the revert is at the call site in src/main.ts and no test imports main.ts. The bug lives inside MediaPipe's VIDEO-mode tracking, so no unit, synthetic or recorded-landmark layer can reproduce it, and the only committed clip is faceless by design (test/fixtures/README.md: "No faces, no people, just a test pattern"), so an e2e determinism assertion on it would be vacuous. The real missing artefact is a test/MANUAL.md step (run one clip twice, compare checksums), the layer the master prompt assigns to exactly this, and that is genuinely absent. Second, this is regression risk rather than a live defect: the code is correct today with three byte-identical checksummed runs recorded in PR #189 and STATE.md:81, a partial revert IS caught by the existing gates (TS6133 and @typescript-eslint/no-unused-vars), and a 17-line comment at src/main.ts:1509-1533 names issue #174 at the exact line a revert would touch. Medium. The A3 observation stands: PR #189 was not documentation-only and added no automated check. Repo state note: `git -C .../audit-fresh status --porcelain` now shows ~59 deletions (STATE.md, LEARNING.md, PROJECT.md, all of docs/). They are not mine. All my writes went to the scratchpad copy, and the deletions were already present when I ran cp -R, after I had read STATE.md and docs/log.md earlier in the session; `git show HEAD:STATE.md` still returns content, so HEAD is intact and another process removed them from the working tree.

### C3-06. The two newest "silent success" refusals are decided in untested main.ts, while only their message text is tested

|                             |             |
| --------------------------- | ----------- |
| Constraint                  | D10         |
| Severity as filed           | high        |
| Verdict as filed            | violation   |
| Verification                | **REFUTED** |
| Severity after verification | **low**     |

**Evidence.** src/main.ts:796 `if (summary.framesMeasured === 0)` and src/main.ts:826 `framesMeasured > 0 && framesBlinkMeasurable === 0`, both inside a file measured at 0% statements / 0% branches (v8: `main.ts | 0 | 0 | 0 | 0 | 162-2763`). The messages they emit ARE tested: test/core/fpsGate.test.ts:61-91 covers `clipRefusedMessage`, test/core/frameClock.test.ts covers `steppingWarning`.

**Detail.** Commits a257203 (#198) and 39bb021 (#197) added these two refusals precisely because a bad clip reported a comfortable number. The formatter half went into src/core with tests; the predicate half stayed in main.ts with none, so nothing fails if the condition is inverted or dropped. This is the highest-value gap in the suite.

**Corrected statement.** One untested inline boolean in main.ts gates the whole-clip refusal sentence; the sibling #197 predicate is tested in core and the zero-frame predicate is caught by e2e

**Skeptic's reasoning.** Refuted on three independent grounds, all checked by command.

(a) MISATTRIBUTION. `git blame -L 793,800 src/main.ts` gives `c9443669 (2026-08-08) 796) if (summary.framesMeasured === 0) {`, i.e. commit c944366 "fix: Safari measured zero frames, and called it a measurement (#154)" — not a257203 (#198) nor 39bb021 (#197), and two days older than both. The title "the two newest silent success refusals" is factually wrong.

(b) THE #197 PREDICATE IS IN CORE AND IS TESTED. It is `checkStepping` at src/core/frameClock.ts:235, merely CALLED from main.ts:815. test/core/frameClock.test.ts:246-292 gives it six tests: equal counts ok, the real 3600-sought/1800-measured DROZY case with trueRate 15, the 3580 tolerance case, the null-duration case, the 0/0 empty-run case, plus the warning text. So "the predicate half stayed in main.ts with none" is false for one of the two cited commits.

(c) THE CORE CLAIM "nothing fails if the condition is inverted or dropped" IS DISPROVEN BY EXPERIMENT. In a scratch copy at .../scratchpad/work: inverting main.ts:796 to `!== 0` FAILS the Playwright stepping test — test-results/videoFile-stepping-.../error-context.md:17 `Locator: getByText('Measured')` and :33 `paragraph: No frames could be read from this clip.` Dropping the main.ts:826 predicate FAILS lint — `npx eslint src/main.ts` gives `315:5 error 'framesBlinkMeasurable' is assigned a value but never used`, and `npm run lint` is a required PR gate per ARCHITECTURE.md:125.

ALREADY HANDLED IN WRITING. test/MANUAL.md item 58 covers the zero-frame case by name ("If a clip ever reports zero frames... that is this class of bug returning") and states the automated WebKit clip test is what should catch it first; playwright.config.ts adds the WebKit project for exactly that bug. SPEC.md:11 records the architectural rule this code obeys: every meaning-carrying string is produced by a tested pure function in core and the renderer never computes a measurement. AUDIT_PLAN.md:364 already records "src/io and src/main.ts have no unit tests at all".

STANDARD MISREAD. Master prompt Section 10 assigns app-shell behaviour to the Playwright e2e row, not the unit row; the unit row's duty is "every pure function" on core, which clipRefusedMessage, steppingWarning and checkStepping all satisfy. The 0%-coverage evidence also leans on tooling that does not exist here (@vitest/coverage-v8 is not installed) and on ROADMAP.md:122-123 rows 8.6/8.7, both UNTICKED, so coverage measurement is unreached roadmap work.

RESIDUAL KERNEL, kept but downgraded. Inverting ONLY main.ts:826 (`=== 0` to `>= 0`) does survive everything: 49 files / 473 tests pass, `tsc --noEmit` exits 0, eslint clean (the variable stays used), and the e2e assertion `/Measured (\d+)/` still matches because the refusal is appended to the same status line. That is one genuinely untested two-term boolean, but it gates a WARNING SENTENCE, not a measurement: the measurement gate is `measurableAtFps` at src/core/fpsGate.ts:7 (tested), blink metrics already return null through it, and the per-frame `fpsGateMessage` still renders. A dropped sentence is not a wrong number, so "high" and "the highest-value gap in the suite" are inflated; low is right.

Real repo untouched: `git -C "/Users/evannorus/Desktop/blinklab build/blinklab/.claude/worktrees/audit-fresh" status --porcelain` returned no output at the end of this work.

### C3-07. analysis/tools/ is 368 Python statements at 0% coverage with no test file, and it produces the published corpus numbers

|                             |             |
| --------------------------- | ----------- |
| Constraint                  | D10         |
| Severity as filed           | high        |
| Verdict as filed            | violation   |
| Verification                | **REFUTED** |
| Severity after verification | **low**     |

**Evidence.** `uv run pytest --cov=blinklab --cov=tools` in the copy: `tools/analyse_drozy.py 130 130 0%`, `tools/audit_frame_loss.py 110 110 0%`, `tools/evaluate_eyeblink8.py 82 82 0%`, `tools/prepare_eyeblink8.py 46 46 0%`. No `analysis/tests/test_*` file names any of them.

**Detail.** analysis/tools/evaluate_eyeblink8.py:84 holds the refusal that decides which clips enter the published recall figure (`if not log.measured_completely: continue`), and report() at lines 101-180 formats the table quoted in README/STATE. The library it calls (analysis/blinklab) is 96.4% covered; the layer that turns it into a published number is 0%.

**Corrected statement.** analysis/tools/ has no unit tests, so a few glue decisions survive mutation, but D10's coverage floor names src/core and row 8.6 is unticked, so this is not a CI-gate violation

**Skeptic's reasoning.** The numbers are correct and I reproduced them, but the finding is misfiled and its severity is inflated.

WRONG CONSTRAINT. D10, as the audit's own plan defines it (AUDIT_PLAN.md:199-201), is "Continuous integration gates: lockfile install, lint, typecheck, test, build. Coverage floor on `src/core` from 8.6. Bundle and inference budgets from 8.7." Every gate D10 actually requires is present and green: .github/workflows/ci.yml runs `npm ci`, lint, typecheck, test, build, format:check, e2e, and a separate `analysis` job runs `uv sync --locked`, `ruff check .`, `ruff format --check .`, `uv run pytest`. The only coverage requirement in the whole standard names `src/core` and is gated on ROADMAP.md:122 row 8.6, which is UNTICKED. There is no coverage floor in force for any directory, least of all Python analysis tooling. This is the "unreached roadmap work, not a violation" case the brief asks to separate out.

THE HEADLINE OVERSTATES. "it produces the published corpus numbers" is not accurate. Recall/precision/F1 come from MatchResult and `combine` in blinklab/blink_match.py (99% covered, tested in tests/test_blink_match.py); the rank statistics, permutation and Holm come from blinklab/stats.py (100%); the fps exclusion from blinklab/drozy.py (93%); and the refusal predicate itself, `measured_completely`, is tested both ways at tests/test_blink_log.py:42 (stepped True) and :54 (watched False). What is at 0% in tools/ is argparse plumbing, rglob file discovery, print formatting, and a small amount of glue.

THE NAMED EXAMPLE IS SELF-DETECTING. All 8 clips in the committed docs/eyeblink8-result.txt passed the guard at evaluate_eyeblink8.py:84, so inverting it empties `results`, report() returns "No clips could be evaluated." (line 103) and main() returns 1 (line 191). Not a silent wrong number, a loud empty one. The whole report, clip count, per-clip table and coverage table is committed verbatim to docs/eyeblink8-result.txt and docs/drozy-result.txt, so any change in what was included shows in a diff.

WHAT SURVIVES, AND IT IS SMALLER THAN CLAIMED. I confirmed by mutation in my scratch copy that `if not log.measured_completely` -> `if log.measured_completely` and `MIN_AGREEING_SUBJECTS = 3` -> `99` both leave the suite at "92 passed, 2 skipped" and ruff at "All checks passed!". The substantive residue is in analyse_drozy.py, not evaluate_eyeblink8.py: `_within_subject_agreement` (lines 66-94) and `_shuffled_null` (97-116) are untested judgement logic behind the published DROZY verdict, MIN_AGREEING_SUBJECTS = 3 (line 42) is a threshold with no below/at/above triad, and `_shuffled_null` returns `0.0, 0.0` on fewer than 3 pairs, which is a zero-instead-of-null shape. That belongs under D3 and D4 at low severity, not under D10 at high. It ships nothing, gates nothing, and cannot touch the instrument.

Not accounted for in writing: correct, no ROADMAP amendment, ADR, open issue or STATE.md line names it. That makes it worth a low note, not a high violation.

REPO STATE: `git -C "/Users/evannorus/Desktop/blinklab build/blinklab/.claude/worktrees/audit-fresh" status --porcelain` is NOT clean at the end of my work: 57 unstaged deletions (all ` D`), nothing staged, covering STATE.md, PROJECT.md, LEARNING.md and the entire docs/ tree. I did not cause them. Every command I ran against that path was read-only (ls, grep, sed, wc, cat, git show, git status, gh, and a cp -R reading out of it); all edits and the pytest runs happened in /private/tmp/.../scratchpad/skeptic. `ls docs docs/audit` succeeded early in my session and listed contents, a later `ls docs` failed, so another process deleted them mid-session. Flagging it: something else is writing to that worktree.

### C3-08. The tests cannot tell Holm from Bonferroni, which is the whole reason Holm was chosen

|                             |             |
| --------------------------- | ----------- |
| Constraint                  | D1          |
| Severity as filed           | high        |
| Verdict as filed            | violation   |
| Verification                | **REFUTED** |
| Severity after verification | **low**     |

**Evidence.** Mutation S9: analysis/blinklab/stats.py:124 `adjusted = min(1.0, (m - index) * p_raw)` -> `min(1.0, m * p_raw)` (plain Bonferroni). Result: SURVIVED, 95 passed, 2 skipped. The only value assertion is analysis/tests/test_stats.py:93-97, which asserts out[0] alone, and at index 0 Holm and Bonferroni are identical by construction.

**Detail.** For the test's own input holm([('a',0.9,0.001,20),('b',0.1,0.5,20)]) the second entry's p_holm is 0.5 under Holm and 1.0 under Bonferroni, and no test looks at it. The docstring at stats.py:105-112 justifies Holm as "uniformly more powerful"; nothing in the suite would notice if that power were silently discarded from the published DROZY table.

**Corrected statement.** One missing assertion in TestHolm: nothing pins the step-down factor, so plain Bonferroni survives (no published verdict changes)

**Skeptic's reasoning.** FACT CONFIRMED, FRAMING REFUTED. I reproduced the mutation in a scratch copy (/private/tmp/.../scratchpad/skep/analysis). Baseline `./.venv/bin/python -m pytest -q` = "95 passed, 2 skipped". After changing stats.py:124 `adjusted = min(1.0, (m - index) * p_raw)` -> `min(1.0, m * p_raw)`, output was identical: "95 passed, 2 skipped". So the mutant does survive, and the index-0 argument is correct. But the finding's verdict, its constraint, and its severity are all wrong.

(1) WRONG CONSTRAINT. D1 in AUDIT_PLAN.md:188 is "Tests assert mathematical properties, not mocks" - i.e. no tautologies. TestHolm is not tautological. I ran three more mutants on the same line and every one DIED: `adjusted = p_raw` (no correction) kills test_corrects_and_keeps_the_raw_value; `(m - index - 1) * p_raw` kills two tests; `(index + 1) * p_raw` kills one. The class asserts a hand-worked ground-truth value (test_stats.py:97), a monotonicity invariant (:110), a <=1 bound (:115), and the m=1 identity (:119). That is exactly what D1 and D2 ask for. What is actually missing is one assertion on `out[1]`. A single missing assertion in an otherwise-real maths test is a test-hardening nit, not a D1 violation.

(2) SEVERITY INFLATED, AND CONTRADICTED BY THE PUBLISHED DATA. I recomputed both corrections on the real published table (`git show HEAD:docs/drozy-result.txt`, seven raw p values 0.0490 to 0.9990, m=7). Holm gives 0.3430 / 0.3430 / 0.4695 / 0.5276 / 0.5276 / 1.0 / 1.0; Bonferroni gives 0.3430 / 0.3430 / 0.6573 / 0.9233 / 1.0 / 1.0 / 1.0. Three printed numbers change; ZERO verdicts change - everything is 7x to 20x above the 0.05 alpha. The published null result and all seven per-feature verdicts are unchanged by the mutation. The auditor's claim that the suite "would not notice if that power were silently discarded from the published DROZY table" is technically true and practically empty: there is no power to discard at these p values.

(3) THE ERROR DIRECTION IS SAFE. Bonferroni >= Holm for every entry, always. The mutation can only cost sensitivity (a false negative), never manufacture a false positive. For a project whose headline output is a deliberately conservative null result, that is the harmless direction.

(4) ALREADY MITIGATED IN WRITING AND IN CODE. stats.py:110-112 states the raw p is printed beside the corrected one "so a reader can see what the correction cost", and analyse_drozy.py:212 actually prints both columns. Any reader can recompute the correction from the published raw p, so a wrong correction is externally auditable, not silent.

(5) SCOPE. This is analysis/ research tooling that loads CSVs, not the shipped blink detector. Per the audit brief's own caution, a surviving mutant here is not equivalent to one in the blink detector.

I am NOT excusing it via rows 8.6/8.7 - those are a coverage floor on src/core and would not cover analysis/, and no roadmap row or ADR covers hardening this test. The genuine residue is real but small: TestHolm.test_corrects_and_keeps_the_raw_value should also assert `out[1].p_holm == pytest.approx(0.5)`, which is one line and would kill the mutant. Low, not high.

REPO CLEANLINESS - IMPORTANT: I made no writes, edits, or git operations in /Users/evannorus/Desktop/blinklab build/blinklab/.claude/worktrees/audit-fresh. All my work was in the scratchpad copy. HOWEVER, `git -C .../audit-fresh status --porcelain` now reports 57 entries, ALL of them " D" deletions (no modifications, no additions): LEARNING.md, PROJECT.md, STATE.md, and the whole docs/ tree. These are not mine and I cannot restore them. Evidence they were deleted by something else DURING my session: my second tool call successfully read `docs/drozy-analysis-plan.md` from that worktree, and two calls later `cd .../docs` failed with "no such file or directory". Something concurrent is deleting tracked files in audit-fresh. The parent should investigate before trusting any file-presence-based finding from this run.

### C3-09. The two-sidedness of the permutation p-value is unasserted; a factor-of-two error passes

|                             |              |
| --------------------------- | ------------ |
| Constraint                  | D1           |
| Severity as filed           | high         |
| Verdict as filed            | violation    |
| Verification                | **SURVIVED** |
| Severity after verification | **medium**   |

**Evidence.** Mutation S8: stats.py:89 `if abs(spearman(xs, shuffled)) >= observed` -> `if spearman(xs, shuffled) >= observed` (one sided). SURVIVED, 95 passed. Mutation S6: `>=` -> `>`. SURVIVED, 95 passed. The only p assertions are test_stats.py:70-77, `p < 0.01` for a perfect correlation and `p > 0.05` for noise.

**Detail.** Those two bands are wide enough that halving every p still passes, and stats.py:74 explicitly promises "Two sided p from shuffling". With tied ordinal KSS data exact ties in |rho| are common, so the >= versus > choice also moves the number. No test pins either property.

**Corrected statement.** permutation_p's two-sidedness is untested: a one-sided mutation halves every p and survives the suite, though the published null result is 7x from the Holm bar and does not change

**Skeptic's reasoning.** The experiment reproduces exactly. Baseline `uv run pytest -q` in analysis/ gives "95 passed, 2 skipped"; applying S8 (stats.py:89 `abs(spearman(xs, shuffled)) >= observed` -> `spearman(xs, shuffled) >= observed`) still gives "95 passed, 2 skipped", and S6 (`>=` -> `>`) also gives "95 passed, 2 skipped", so both mutants survive and the coverage gap is real and undocumented (the only mention is the stats.py:73 docstring promise "Two sided p from shuffling", which nothing enforces; AUDIT_PLAN.md:476 flags a different permutation_p issue, the in-place shuffle, not this one). The remedy master prompt rule 2 prescribes is five lines and works: I appended `assert permutation_p(xs, ys, 2000) == permutation_p(xs, [-y for y in ys], 2000)` on xs=[1..8], ys=[2,1,4,3,6,5,8,7], which gives "20 passed" on shipped code and "1 failed" under S8 (0.0024987 vs 0.0019990). But the finding overstates its consequence, so I am correcting the severity down. I rebuilt the DROZY setup faithfully (n=20 tied KSS vector, feature vectors fitted to each published rho; my p_two of 0.0511/0.0505/0.1177 reproduces the published 0.0490/0.0490/0.0939) and the one-sided bug moves min raw p from 0.0511 to 0.0249 and min Holm p from 0.3535 to 0.1743 — with m=7 the smallest raw p must be below 0.05/7 = 0.00714 to clear, so nothing crosses, every verdict line in docs/drozy-result.txt is byte-identical, and the "suggestive and unconfirmed" labels come from the within-subject agreement bar that permutation_p never touches. The S6 half is weaker still: exact |rho| ties occur only 3 to 28 times per 10000 shuffles, moving p by at most ~0.003 (0.9988 -> 0.9961, 0.1177 -> 0.1170) and never changing a verdict, so bundling it with S8 inflates the finding, and the Holm correction has five tests of its own and does not rest on sidedness at all.

### C3-10. No boundary triad on DEFAULT_TOLERANCE_FRAMES = 4, the constant that sets the headline recall

|                             |             |
| --------------------------- | ----------- |
| Constraint                  | D3          |
| Severity as filed           | high        |
| Verdict as filed            | violation   |
| Verification                | **REFUTED** |
| Severity after verification | **low**     |

**Evidence.** Mutations B3 (4->5) and B4 (4->3) both SURVIVED, 95 passed each; only B5 (4->40) was killed. analysis/blinklab/blink_match.py:33. The existing test at analysis/tests/test_blink_match.py:22-29 uses a gap of 2 empty frames (inside) and 22 (far outside). Measured reach: gap 0,1,2,3 -> TP 1; gap 4,5,6,7 -> TP 0.

**Detail.** Rule 3 requires below, at and above for every threshold. The at-boundary (gap 3) and just-above (gap 4) cases are both absent, so the tolerance can be changed by plus or minus one with the suite green. The reach itself is correct and matches README.md:286-289, so this is a test gap, not a maths bug.

**Corrected statement.** Missing boundary triad on DEFAULT_TOLERANCE_FRAMES, a constant that is provably inert on the published corpus (recall and precision unchanged for tolerance 0 through 18)

**Skeptic's reasoning.** The mutation experiment reproduces, but the finding's load-bearing claim does not. In my own copy at scratchpad/skeptic/work I swept the constant and ran the suite: `for V in 0 1 2 3 4 5 6 40; do ... python -m pytest -q; done` gave "1 failed" at 0/1/2, "95 passed, 2 skipped" at 3, 4, 5 and 6, and "1 failed" at 23 and 24, so the suite pins the tolerance only to the window [3,22] — even wider than the auditor's plus-or-minus one. But the stated consequence, "the constant decides which detections count as hits, and therefore the published 87.7% recall and 83.3% precision", is false: I found the published run on disk (datasets/eyeblink8-measured-refractory, tp=358 fp=72 fn=50, recall 87.75%, precision 83.26%, matching README and docs/evidence/2026-08-09/tables-current-run/eyeblink8_clip_summary.csv exactly) and swept tolerance 0..30 over the real Eyeblink8 corpus; tp/fp/fn are byte-identical at every value from 0 through 18, and the first change is at tolerance 19, which moves recall by one blink to 87.99%. A per-clip check confirms no offsetting: all eight clips report tp of [31,69,38,80,50,25,28,37] identically at tolerance 0, 3, 4, 5 and 6, so setting the constant to zero would leave every published table unchanged — the slack is currently doing no work, because the detector exports a multi-frame closure span that genuinely overlaps the annotation. The residual is a real but cosmetic Rule 3 gap (no at-boundary gap-3 or just-above gap-4 test, and it is not among the missing triads AUDIT_PLAN.md:369-371 already names), worth a test only because the module docstring anticipates a detector that reports the reopening instant, at which point the constant would become load-bearing; `git -C .../audit-fresh status --porcelain` is empty and blink_match.py:33 still reads 4.

### C3-11. Greedy matching under-counts true positives against optimal, and neither a test nor a doc says so

|                             |             |
| --------------------------- | ----------- |
| Constraint                  | D1          |
| Severity as filed           | high        |
| Verdict as filed            | violation   |
| Verification                | **REFUTED** |
| Severity after verification | **low**     |

**Evidence.** blink_match.py:112-141. Brute-force maximum bipartite matching against match_blinks over 4001 clips: 234 cases (5.8%) where greedy < optimal. Smallest: detected [(0,20),(0,2)], annotated [(0,2),(18,20)] -> greedy TP 1, pairs [(0,0)]; optimal TP 2. No test in test_blink_match.py covers it.

**Detail.** Largest-overlap-first is a maximal matching, not a maximum one, so it can strand a detection that had the only remaining partner. This deflates both the published recall and the published precision. The docstring at blink_match.py:116-121 defends greedy against time-order pairing but never acknowledges greedy is not optimal.

**Corrected statement.** Greedy matching is maximal rather than maximum, which is undocumented but changes no published number (0 of 358 true positives on the real corpus)

**Skeptic's reasoning.** I reproduced the experiment with my own Kuhn maximum-bipartite matcher, first validating it against an exhaustive brute force ("kuhn vs exhaustive brute force: 0 mismatches over 3000 random instances"), so the optimal side is trustworthy. The abstract math holds — greedy is maximal, not maximum — but the auditor's own numbers do not: at my seed the unconstrained sweep gave 72/4001 = 1.80%, not 5.8%, and their smallest counterexample detected [(0,20),(0,2)] is a shape a blink log cannot produce, since the two detections overlap each other and are out of time order (my real-corpus run printed no "not disjoint" note for any clip, so both sides are always pairwise disjoint and time-ordered in practice). The decisive test is the real data, which is on disk at /Users/evannorus/Desktop/blinklab build/datasets/eyeblink8: running match_blinks against optimal_tp over all 8 clips of all four measured runs gives greedy TP == optimal TP on every single clip — published run "POOLED greedy TP 358, optimal TP 358, difference 0" (87.7% recall, 83.3% precision, identical either way), and likewise 284/284, 338/338, 358/358 for the earlier runs. A tolerance sweep on the published run gives diff 0 at tol=0,1,2,3,4,8, and only at tol=16 (four times the configured DEFAULT_TOLERANCE_FRAMES) does a single blink differ. So "this deflates both the published recall and the published precision" is false by direct measurement — the deflation is exactly zero blinks — and even in principle greedy can only under-count, never inflate, which is the conservative direction for a matcher whose documented purpose (blink_match.py:13-17) is to stop the evaluation being rigged. What survives is only that no docstring, ADR, SPEC.md or test says greedy is not optimal (grep for greedy/bipartite/maximum match across the repo hits only blink_match.py:13,114,116,131), a one-sentence documentation gap with no measurable consequence; git -C .../audit-fresh status --porcelain is empty, I changed nothing in the worktree.

### C3-12. Four baseline boundaries are never tested at the line

|                   |              |
| ----------------- | ------------ |
| Constraint        | D2           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** All SURVIVED the full suite: M20 baseline.ts:47 `elapsed >= BASELINE_LEARN_MS` -> `>`; M21 line 48 `samples.length >= BASELINE_MIN_SAMPLES` -> `>`; M24 line 63 `recent.length >= BASELINE_RISE_MIN_SAMPLES` -> `>`; M26 line 101 `Math.ceil(` -> `Math.floor(`. My probe tests (readiness at exactly 30000 ms, at exactly 100 samples, a rise at exactly 300 recent samples, countdown 1500 ms -> 2 s) kill all four.

**Detail.** baseline.ts scored 3/7, the second-worst module. It defines personalThresholdMm, which is the line every blink, PERCLOS and long-closure number is measured against, so its readiness and ratchet conditions are load-bearing. LEARNING.md:185 states the project's own rule, thresholds get all three sides tested, our oldest QA rule; these four have below and above but not at.

### C3-13. The blink refractory period has no at-the-line test

|                   |              |
| ----------------- | ------------ |
| Constraint        | D2           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** M15 src/core/blink.ts:85 `nowMs - state.lastBlinkEndedAtMs < BLINK_REFRACTORY_MS` -> `<=` SURVIVED the full 473-test suite. test/core/blink.test.ts:240 has describe("the refractory period of #176") but no probe at exactly BLINK_REFRACTORY_MS (150). My probe, a second closure reopening exactly 150 ms after the first ended, kills it.

**Detail.** Every other threshold in blink.ts is properly bracketed: M12 (aperture line), M13 (arm line) and M14 (max duration) were all killed by named boundary-trio tests. The refractory line, added by fix #176 precisely to stop double counting, is the one that got no trio, and blink count and blink rate are both published numbers.

### C3-14. The score window's start edge is not tested, and the miss is worth 30 points

|                   |              |
| ----------------- | ------------ |
| Constraint        | D2           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** M78 src/core/score.ts:101 `record.timestampMs >= windowStartMs` -> `>` SURVIVED. My probe with rows at 0 (0 closures), 30000 (2) and 60000 (2) scores the long-closure contribution at 30 points today and 0 under the mutant, and it kills M78.

**Detail.** The long-closure penalty is a delta between the oldest row in the window and the newest, so whether a row landing exactly on windowStartMs is inside decides whether closures are charged at all. score.ts is otherwise the best-tested module here at 11/12, including the Math.round half-up convention and the caps-sum-to-100 identity.

### C3-15. fixation.ts's published default constants are pinned by no test

|                   |              |
| ----------------- | ------------ |
| Constraint        | D1           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** M105 src/core/fixation.ts:14 `FIXATION_DISPERSION_THRESHOLD = 0.02` -> `0.03` SURVIVED; M106 line 18 `MIN_FIXATION_DURATION_MS = 120` -> `130` SURVIVED. Cause: test/core/fixation.test.ts:145-167 builds every fixture from the constants themselves, e.g. `const just = [at(0,0,0), at(0,0,MIN_FIXATION_DURATION_MS)]`, so changing the constant moves code and fixture together.

**Detail.** The trios pin the convention (exactly at the line counts) but not the value, so either published I-DT threshold can be edited to any number without a red test. Compare longClosure.ts:35 EYES_SHUT_FRACTION = 0.4, where M54 -> 0.45 was killed, and score.ts, where M83/M84 were killed by a test literally named "pins the floor and ceiling values themselves". The discipline exists elsewhere in the suite; fixation is the outlier.

### C3-16. The calibration median convention survives being changed to a p60

|                   |              |
| ----------------- | ------------ |
| Constraint        | D1           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** M113 src/core/calibrationProfile.ts:69 `50,` -> `60,` SURVIVED, including test/core/calibrationProfile.test.ts "survives one wild outlier sample, the median holds". My probe (three dots, six samples each, a differently sized outlier per dot so the fit tilts rather than shifts) kills it.

**Detail.** The module comment claims each dot's stay is summarized by its MEDIAN offset, the robust middle a stray blink cannot drag. The existing outlier test uses one outlier on one dot with an equal structure across dots, so stepping off the median shifts the intercept rather than the slope and the assertion still passes. The robustness claim is therefore asserted but not actually tested.

### C3-17. The stepping duplicate-tolerance boundary is untested

|                   |              |
| ----------------- | ------------ |
| Constraint        | D2           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** M96 src/core/frameClock.ts:240 `measured >= sought * STEPPING_DUPLICATE_TOLERANCE` -> `>` SURVIVED. My probe `checkStepping(100, 98, 10).kind === "ok"` kills it.

**Detail.** This guard is issue #193's own fix, the check that tells the operator the step interval was wrong. The constant itself is well tested (M95, 0.98 -> 0.5, was killed by three tests) but the comparison at exactly the tolerance is not, so a run sitting exactly on the line could start warning or stop warning unnoticed.

### C3-18. The fixation extension boundary is untested, only the seed boundary is

|                   |              |
| ----------------- | ------------ |
| Constraint        | D2           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** M104 src/core/fixation.ts:96 `extended > dispersionThreshold` -> `>=` SURVIVED, while M103 (line 90, the seed comparison) was killed by "runs the dispersion boundary: exactly the threshold still fixates". My probe, a seed point extended by a sample landing exactly on the box edge, kills M104.

**Detail.** detectFixations checks dispersion twice, once to seed the window and once on each extension, and the comment says exactly at the threshold still counts as boxed for both. Only the seed check has a boundary test, so a fixation's reported endMs and centroid can be truncated by one sample with no test objecting.

### C3-19. BLINK_REFRACTORY_MS 150 has no "at" case — lead confirmed

|                   |              |
| ----------------- | ------------ |
| Constraint        | D3           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** src/core/blink.ts:85 `nowMs - state.lastBlinkEndedAtMs < BLINK_REFRACTORY_MS`. `grep -rl BLINK_REFRACTORY_MS test/` -> empty. The four tests in test/core/blink.test.ts:240-315 produce gaps of 80, 130, 160, 200 and 300 ms; none is 150. Flipping `<` to `<=` leaves 473 passed. Changing 150 -> 200 does fail 1 test, so the value has some upper bound.

**Detail.** Below (gap 80, blink.test.ts:260) and above (gap 160, :291) exist; the exact-150 case does not, so which side of the line a 150 ms gap falls on is unspecified by the suite. Already written down as AUDIT_PLAN.md:373 finding 10, so this is a known gap rather than a surprise, but it is still unfixed.

### C3-20. The Python match tolerance of 4 frames is untested at its boundary and any value from 3 to 22 passes

|                   |              |
| ----------------- | ------------ |
| Constraint        | D3           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** analysis/blinklab/blink_match.py:33 `DEFAULT_TOLERANCE_FRAMES = 4`. Baseline `pytest -q` = 95 passed, 2 skipped. Mutations: 4 -> 3 = 95 passed; 4 -> 10 = 95 passed; 4 -> 22 = 95 passed. analysis/tests/test_blink_match.py:22 uses detected i(20,21) against annotated i(14,17) (a 3-frame gap, strictly below) and i(40,41) (a 23-frame gap, far above). The exact boundary case, detected i(21,22), is absent.

**Detail.** This tolerance is the denominator of every published recall and precision figure in docs/eyeblink8-result.txt. Being able to move it from 4 to 22 with a green suite means the benchmark result is not protected by the tests at all on this axis. `overlap`'s `shared > 0` guard is covered (flipping to `>= 0` fails 4 tests).

### C3-21. STEPPING_DUPLICATE_TOLERANCE 0.98 has no "at" case and its value is completely free

|                   |              |
| ----------------- | ------------ |
| Constraint        | D3           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** src/core/frameClock.ts:240 `measured >= sought * STEPPING_DUPLICATE_TOLERANCE`. `grep -rl STEPPING_DUPLICATE_TOLERANCE test/` -> empty. Mutations: `>=` -> `>` = 473 passed; 0.98 -> 0.9 = 473 passed. test/core/frameClock.test.ts:246-260 covers 3600/3600 and 3580/3600 (both above the 3528 line) and 1800/3600 (far below). Nothing sits at 3528.

**Detail.** This is the #193 gate that catches a clip stepped at the wrong interval, added after the DROZY run reported 3600 frames when 1800 were measured. The threshold's own comment at frameClock.ts:216 calls it "deliberately tight", but nothing in the suite holds it there.

### C3-22. No unit test imports src/io or src/main.ts, so the thresholds living there have no triads at all

|                   |              |
| ----------------- | ------------ |
| Constraint        | D3           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** `grep -rln "src/io\|src/main" test/` -> no matches; every import in test/core resolves to src/core. Untested thresholds: src/io/videoStepper.ts:207 `smallest <= 0.001 || smallest > 1`, :40 SEEK_TIMEOUT_MS 2000, :43 CALIBRATION_FRAMES 6, :49 CALIBRATION_ATTEMPTS 60, :54 CALIBRATION_STEP_S 0.01, :62 FRAME_GRACE_MS 200; src/main.ts:2097 `nowMs - lastRecordAtMs >= 1000`, src/main.ts:2133 `featureRecords.length >= 3600`.

**Detail.** test/e2e/videoFile.spec.ts:131 exercises the stepper end to end on a 60-frame fixture with a plus-or-minus-one tolerance, which is one happy-path case, not a triad on any of these numbers. Already recorded as AUDIT_PLAN.md:364 finding 8, and ARCHITECTURE.md:10 states the pure-core rule that produces it, so the shape is deliberate; the specific numeric thresholds still have no below, at or above.

### C3-23. POSE_LIMITS pitch (20) and roll (25) have no "at" case and neither value is pinned

|                   |              |
| ----------------- | ------------ |
| Constraint        | D3           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** test/core/validityGate.test.ts:13 runs a full trio on yaw only (limit-1, limit, limit+0.1). Pitch and roll appear once each at :22-32, both at limit+5. Mutations: `maxPitchDeg: 20` -> `25` = 473 passed; `maxRollDeg: 25` -> `35` = 473 passed.

**Detail.** src/core/validityGate.ts:29 checks all three axes in one loop, so the yaw trio does pin the `>` operator for all of them. What is unpinned is each axis's own number, and pitch's 20 differs from the other two, so it is a distinct threshold that no test constrains.

### C3-24. Seven core constants can be changed and all 473 tests still pass

|                   |              |
| ----------------- | ------------ |
| Constraint        | D2           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** Mutation runs in a scratch copy, each reverted, each reporting `Tests 473 passed (473)`: HEATMAP_COLS 16->12, HEATMAP_ROWS 9->7 (src/core/heatmap.ts:9,10), CALIBRATION_SAMPLES_PER_TARGET 30->20, CALIBRATION_SETTLE_MS 800->500 (src/core/constants.ts:23,24), ALERT_DISPLAY_MS 3000->2000 (src/core/alert.ts:14), SPEED_COEFFICIENT 5->3, MIN_CUTOFF_HZ 1->2 (src/core/gazeSmoothing.ts:19,23). Control mutations died: OFF_SCREEN_OFFSET_THRESHOLD (4 failed), BLINK_LOG_DISPLAY_CAP (2 failed), PERCLOS_WINDOW_MS (3 failed).

**Detail.** Every boundary and range test for these constants imports the constant and computes its own expectation from it, so the test moves with the code (test/core/alert.test.ts:74-76 and :115-117, test/core/calibrationCapture.test.ts:47-56, test/core/heatmap.test.ts:14-15). The project already invented the fix and applied it elsewhere: test/core/score.test.ts:143-149 says "Without these, nudging a constant leaves every ramp test passing because they all derive from the constant" and pins the literals; test/core/longClosure.test.ts:46 and test/core/perclos.test.ts:213 do the same. The two gazeSmoothing survivors are the mildest case, because the invariants those tests assert (jitter ratio < 0.5 at line 82, step coverage >= 0.9 at line 94) genuinely still hold at the mutated values; the heatmap, calibration and alert survivors are pure self-reference.

### C3-25. Two src/io fixes closed with no test of any kind

|                   |              |
| ----------------- | ------------ |
| Constraint        | D7           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** `git show --stat 42fc8d9` ("fix(io): refuse an unknown frame rate instead of guessing 60 (#169)") -> src/io/videoStepper.ts, src/main.ts only. `git show --stat 1de3ae4` ("fix(io): stop counting the last frame twice, and publish the numbers (#156)") -> README.md, src/io/videoStepper.ts only. `ls test/` -> MANUAL.md core e2e fixtures tools; there is no test/io.

**Detail.** Six of the 22 `fix` commits on main changed src/ without touching any test file; three are `fix(ui)` visual changes that ROADMAP amendment 1 legitimately routes to test/MANUAL.md, but #156 and #169 are frame-counting logic, exactly the class the rule exists for. The underlying coverage gap is already recorded in writing (AUDIT_PLAN.md:364, "src/io and src/main.ts have no unit tests at all"), so this is the D7 consequence of a known hole rather than a new one.

### C3-26. The CV(mm) < CV(px) headline is exact by construction, not discovered

|                             |             |
| --------------------------- | ----------- |
| Constraint                  | D9          |
| Severity as filed           | medium      |
| Verdict as filed            | partial     |
| Verification                | **REFUTED** |
| Severity after verification | **none**    |

**Evidence.** test/core/statistics.test.ts:44-73 passes. Probe run in the scratchpad copy: cvMm = 3.56e-15, cvPx = 0.2836, and aperturePx/irisPx = 0.8547008547 identical to 13 significant figures at all 7 distances. Mutating src/core/aperture.ts:84 to divide by a constant instead of the iris fails 6 tests including this one.

**Detail.** syntheticFace.ts puts the iris ring at +/-IRIS_DIAMETER_MM/2 (lines 99-102) and the lid chords at +/-apertureMm/2 (lines 113-132), both at local z=0, then divides both by the same depth (line 156), so the 1/d factor cancels algebraically and cvMm is float rounding, not a measurement. It is still a real mutation guard, not a worthless test, and the construction is stated in writing at LEARNING.md:192 and :216, so this is not a Rule 1 violation. The gap is that the only real-world number for the claim is a manual note, test/MANUAL.md:22 "Observed 2026-07-31: px 39 to 46% versus mm 13 to 17%", and no automated test encodes that 13-17% reality or feeds any core function jittered landmarks.

**Corrected statement.** Synthetic CV test is a correctly scoped answer key, disclosed in LEARNING.md, ROADMAP.md, MODEL_CARD.md and MANUAL.md, with real-frame coverage in aperture.test.ts

**Skeptic's reasoning.** The arithmetic reproduces but every inference fails. My probe in a scratch copy printed cvMm 3.559685383028968e-15, cvPx 0.2835863643752094 and the aperturePx/irisPx ratio constant at 0.8547008547008 across all 7 distances, confirming the 1/d cancellation; however that is the definition of an answer key, and master prompt rule 2 explicitly names "synthetic face at a known angle" as a valid ground-truth form, while rule 1's own criterion is met since mutating src/core/aperture.ts:84 to IRIS_DIAMETER_MM/100 and running npx vitest run gave "Test Files 5 failed | 44 passed, Tests 8 failed | 465 passed". The gap is documented rather than silent: LEARNING.md:233 states verbatim "On perfect synthetic data the ruler cancels distance exactly, real faces will be noisier, which is why the live stability line exists", ROADMAP.md:60 scopes row 3.5 to "on synthetic data", and LEARNING.md 3.3 says synthetic fixtures "know the answer because we built the input from the answer". The finding's central premise that the only real-world evidence is a manual test item is factually wrong: test/core/aperture.test.ts:76-96 runs 300 real recorded frames from test/fixtures/session-01.json through apertureMm and asserts the median lands in a plausible human range, and LEARNING.md 3.4 records that real median as 7.1 mm dipping to 2.5 mid-blink. No public text overclaims: MODEL_CARD.md:26 lists eyelid aperture as "not validated against a physical measurement" and states blink detection "is the only thing here that has been checked against somebody else's ground truth", neither README.md nor MODEL_CARD.md quotes any CV figure, and test/MANUAL.md:22 records the honest real-world result (px 39 to 46% versus mm 13 to 17%, about three to one) along with its cause and the admission that "very close range bends the flat face assumption behind the iris ruler". Nothing measurable can go wrong because no published number depends on cvMm; the audit-fresh worktree is untouched and git status --porcelain returned empty at the end.

### C3-27. The generator's yaw axis is untested: its sign can be reversed with the suite still green

|                   |              |
| ----------------- | ------------ |
| Constraint        | D8           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** Reversing the yaw rotation at test/fixtures/syntheticFace.ts:62-63 in the scratchpad copy left 473/473 passing. Disabling yaw entirely failed exactly one test, syntheticFace.test.ts:84, which asserts only `Math.abs(ratioTurned - 1) > 0.05` (line 94). By contrast a pitch sign flip failed 4 tests and removing roll failed 2.

**Detail.** src/core/headPose.ts:5-8 documents a rotation convention "matching the synthetic generator" and syntheticFace.ts:20-22 documents the same, but nothing verifies the yaw half of that agreement, so a mirrored yaw would silently invalidate every synthetic yaw assertion. Related and also unasserted: apertureMm reads 11.33 mm for a true 10 mm at 25 degrees yaw (measured), a 13% error, while roll gets a whole dedicated file at test/core/tiltInvariance.test.ts.

### C3-28. The synthetic layer is structurally blind to the aspect-ratio trap its own source calls the silent killer

|                   |              |
| ----------------- | ------------ |
| Constraint        | D8           |
| Severity as filed | medium       |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** Mutating src/core/aperture.ts:20 to scale y by frameWidthPx left all 30 synthetic-fixture tests green (statistics, aperture, syntheticFace, tiltInvariance, gazeQuadrant). Only test/core/blink.test.ts and test/core/blinkShape.test.ts, both recorded-fixture tests, caught it.

**Detail.** aperture.ts:10-13 warns this trap "would skew every millimetre by that factor, silently", yet the generator emits square normalised space by construction (syntheticFace.ts:23) so every synthetic test passes W=H=1000. The one non-square test, test/core/aperture.test.ts:76-96 at 1280x720, cannot catch it either: the mutation turns a 10 mm reading into 5.625 (measured), still inside its `>4 and <16` band. The guard exists but lives entirely in the layer that has no ground truth.

### C3-29. None of SPEC.md's five documented degraded states is covered end to end

|                   |              |
| ----------------- | ------------ |
| Constraint        | D8           |
| Severity as filed | medium       |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** SPEC.md:117-127 lists no camera, permission denied, no face, low frame rate, wrong landmark count. The 5 Playwright tests are: calibration opens on dot 1 and cancels, demo notice permanent, clip loads and runs, undecodable file message, stepping measures every frame. Grepping test/e2e/*.ts for permission/no face/denied/no camera/not measurable/468/478 returns comment lines only, zero assertions.

**Detail.** All five states do have unit coverage with proper boundary trios (test/core/fpsGate.test.ts:16, landmarkGuard.test.ts:19-29, cameraState.test.ts:10-17, facePresence.test.ts:13-25), so this is a missing E2E layer rather than untested behaviour. The uncovered five end to end are exactly the five named above.

### C3-30. The manual layer is maintained but has no evidence of being run since v0.3.0

|                   |              |
| ----------------- | ------------ |
| Constraint        | D8           |
| Severity as filed | medium       |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** test/MANUAL.md holds 61 numbered items and zero checkboxes. `grep -oE "\(Observed [^)]*"` returns exactly 3 hits, all dated 2026-07-31 (items 15, 18, 19), which is the v0.3.0 window. MANUAL.md was edited in 6 of the 7 tag commits (v0.2.0 to v0.7.0).

**Detail.** Editing the list at each tag is evidence of maintenance, not of execution; there is no run log, pass/fail column, or last-run line, so for phases 4 through 7 nothing records that the 61 items were walked. The honest counterweight is that items 43 to 46 and 54 to 59 are written as owner regression checks tied to specific fix numbers, which reads like a list someone genuinely uses rather than pure decoration.

### C3-31. framesMeasured, printed in every exported CSV, comes from an untested counter inside a 733-line function

|                   |              |
| ----------------- | ------------ |
| Constraint        | D10          |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** src/main.ts:1542 `framesMeasured += 1` sits inside `processFrame`, src/main.ts:1533-2265 (733 lines, 0% covered). It is consumed at src/main.ts:1341 and :1384 by `coverageMetadataRows`, and at :830 as `framesMeasured / loadedClipDurationSeconds`.

**Detail.** `coverageMetadataRows` is unit-tested, so the CSV comment line is well formed; nothing tests that the number inside it counts the right frames. The divide at :830 that publishes the clip's true frame rate is also untested arithmetic living outside src/core.

### C3-32. src/io and src/main.ts together are 63.7% of the TypeScript statements at 0% unit coverage

|                   |              |
| ----------------- | ------------ |
| Constraint        | D10          |
| Severity as filed | medium       |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** v8 summary: `src/core stmt 98.07% (659/672)`, `src/io stmt 0.00% (0/196)`, `src/main stmt 0.00% (0/983)`. Overall `Statements 35.6% (659/1851)`, `Branches 53.66% (498/928)`, `Functions 55.81% (144/258)`, `Lines 35.5% (642/1808)`.

**Detail.** Marked partial, not a clean violation: the split is written down (ARCHITECTURE.md:10-16, "src/core is pure... main.ts is the wiring") and ADR-0003 puts wiring under Playwright deliberately. But 5 e2e tests over 402 uncovered branches and 113 uncovered functions is thin, and the master prompt's pyramid names no layer that owns io error paths.

### C3-33. A non-numeric DROZY value is silently dropped by an untested except branch

|                   |              |
| ----------------- | ------------ |
| Constraint        | D10          |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** analysis/blinklab/drozy.py:157-158 `except ValueError: continue`, reported uncovered by pytest-cov (`drozy.py 115 8 93% 75, 114, 122-123, 157-158, 184, 188`).

**Detail.** A bad cell shrinks the sample the published DROZY correlation runs over and says nothing. Given the project's own history of defects that looked like success, an untested silent `continue` on the path to a published null result deserves a test that asserts the drop is visible or refused.

### C3-34. The tolerance asymmetry is real and moves the number, and flipping it leaves the suite green

|                   |              |
| ----------------- | ------------ |
| Constraint        | D1           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** blink_match.py:57-58 widens only `self` (the detection). Mutation B2, swapping the widening to `other` (the annotation), SURVIVED, 95 passed. Over a 25,600 interval-pair grid the eligibility boolean disagrees 0 times but the overlap magnitude disagrees 9,604 times; over 20,000 random clips the resulting TP count differed in 759 (3.8%) and the pairing in a further 4,072 (20%).

**Detail.** So the asymmetry cannot change which pairs are legal, only their rank, but rank drives the greedy order and therefore the published count. Partly documented: README.md:286-289 says "Widen the detection by four frames at each end" for the false-positive analysis; nothing states it for Interval.overlap, and AUDIT_PLAN.md:473-475 lists it as an open question rather than a recorded decision.

### C3-35. 833 lines of analysis/tools/, including the two scripts that produce the published numbers, have no tests

|                   |              |
| ----------------- | ------------ |
| Constraint        | D1           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** `wc -l analysis/tools/*.py` = 833 (analyse_drozy.py 253, audit_frame_loss.py 232, evaluate_eyeblink8.py 195, prepare_eyeblink8.py 153). `grep -rn import analysis/tests/*.py | grep -i 'tool|evaluate|analyse|prepare|audit'` returns nothing; no test imports any of them.

**Detail.** tools/analyse_drozy.py produces the DROZY table and carries a second, independent permutation loop of its own at :98-115 with its own SHUFFLE_SEED; tools/evaluate_eyeblink8.py produces the recall and precision figures on the README. The library beneath them is well covered; the layer that turns it into a published claim is not covered at all.

### C3-36. Two computed outputs have no value assertion anywhere: long_closures and non_frontal_frames

|                   |              |
| ----------------- | ------------ |
| Constraint        | D1           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** Mutation D7: drozy.py:193 `int(max(closures))` -> `int(sum(closures))`. SURVIVED, 95 passed. Mutation E9: eyeblink8.py:157 `parts[2].strip().upper() == "N"` -> `== "Y"` (flag inverted). SURVIVED, 95 passed. `grep -rn long_closures analysis/tests/` hits only the FEATURE_NAMES tuple at test_drozy.py:206; `grep -rn non_frontal analysis/tests/` returns nothing.

**Detail.** long_closures is one of the seven pre-registered DROZY features and its source column is a cumulative counter, so max, sum and last-row give wildly different answers with nothing to decide between them. non_frontal_frames is the head-pose caveat on the Eyeblink8 result and could be reporting the exact complement of the truth.

### C3-37. MIN_USABLE_FPS has a pinned value but an unpinned comparison; nothing sits at 25

|                   |              |
| ----------------- | ------------ |
| Constraint        | D3           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** Mutation D5: drozy.py:72 `>=` -> `>`. SURVIVED, 95 passed. Mutation D4 (constant 25 -> 24) was KILLED, by the literal `assert MIN_USABLE_FPS == 25` at test_drozy.py:136. Fixtures use fps 15 (below) and 30 (above); no fixture uses 25.

**Detail.** This is the filter that decides which DROZY sessions enter the published analysis, and per commit f859bd2 the excluded group is systematically 1.78 KSS points sleepier, so the boundary is load-bearing. Rule 3's at-boundary case is missing.

### C3-38. KSS scale bounds tested only far outside the range, so 10 would be accepted onto a 1-to-9 scale

|                   |              |
| ----------------- | ------------ |
| Constraint        | D3           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** Mutation D2: drozy.py:129 `if not 1 <= value <= 9` -> `if not 0 <= value <= 10`. SURVIVED, 95 passed. The only guard test, test_drozy.py:72-76, uses 12.

**Detail.** No at-boundary (1 and 9) or just-outside (0 handled separately, 10) cases exist, so the scale contract holds only against grossly wrong input. The low end is additionally masked by the zero-means-never-happened skip at drozy.py:126-127, which is itself well tested.

### C3-39. measured_fps uses a median, but every fixture writes a constant frame rate so mean and median are indistinguishable

|                   |              |
| ----------------- | ------------ |
| Constraint        | D1           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** Mutation D6: drozy.py:189 `statistics.median(fps_values)` -> `statistics.fmean(fps_values)`. SURVIVED, 95 passed. analysis/tests/test_drozy.py:183-193 (`write_seconds`) emits a single fps string for every row, defaulting to "30".

**Detail.** Median is the right choice precisely because DROZY sessions drop frames, and the choice feeds the usable/not-usable filter, but no fixture has a varying or spiky frame rate so the choice is never exercised. This is rule 2's "ground truth or a property" failing: the test asserts a number the mock trivially returns.

### C3-40. humanDuration's 90 second switch point is untested

|                   |              |
| ----------------- | ------------ |
| Constraint        | D2           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** M87 src/core/frameClock.ts:70 `if (seconds < 90)` -> `<=` SURVIVED. My probe `steppingProgress(10, 50, 100, 90000)` expects "2 min" and kills it.

**Detail.** Cosmetic only: the progress line would read "90 s left" instead of "about 2 min left". Worth one line of test for consistency with the project's stated boundary rule, not worth more.

### C3-41. Two blinkShape guards are mutually redundant, so neither is independently exercised

|                   |              |
| ----------------- | ------------ |
| Constraint        | D1           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** M58 (line 31 `minIdx === 0` -> `-1`) and M62 (line 48 `amplitudeMm <= 0` -> `< 0`) both SURVIVED and both are provably equivalent alone: 400k random windows in scratchpad/diffshape.mjs found no distinguishing input, because whenever minIdx is 0 the amplitude is exactly 0 and the other guard refuses. Same for M55 (line 21 `< 2` -> `< 1`), M59 (line 36) and M65 (line 65).

**Detail.** These are not test gaps, they are dead or doubled defences, and I am reporting them as an observation rather than a violation. The risk is only that a future refactor removing either one alone looks safe and stays green while removing both would return a zero-amplitude blink shape. No action needed beyond awareness.

### C3-42. CALIBRATION_SETTLE_MS 800 has no "at" case and the value can be changed freely

|                   |              |
| ----------------- | ------------ |
| Constraint        | D3           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** src/core/calibrationCapture.ts:63 `nowMs - state.targetStartedAtMs <= CALIBRATION_SETTLE_MS`. test/core/calibrationCapture.test.ts:47 feeds at t=0 (below), :52 at SETTLE+1 (above); nothing at exactly 800. Mutations: `<=` -> `<` = 473 passed; 800 -> 500 = 473 passed.

**Detail.** The sibling threshold in the same reducer, CALIBRATION_SAMPLES_PER_TARGET, is done properly at :65 ("advances the target at exactly the quota, not before") and flipping its `<` to `<=` fails 2 tests, so the module knows the pattern and applied it to one gate but not the other.

### C3-43. Python MIN_USABLE_FPS 25 has no "at" case

|                   |              |
| ----------------- | ------------ |
| Constraint        | D3           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** analysis/blinklab/drozy.py:72 `return self.measured_fps >= MIN_USABLE_FPS`. analysis/tests/test_drozy.py:125 covers fps=15 (not usable) and the default fps=30 (usable). Mutation `>=` -> `>` = 95 passed, 2 skipped. The value itself is pinned by `assert MIN_USABLE_FPS == 25` at test_drozy.py:137.

**Detail.** Low because the browser-side twin of this gate, src/core/fpsGate.ts:8, does have a full discriminating trio (test/core/fpsGate.test.ts:16; flipping `>=` to `>` fails 2 tests), and the Python constant's value is pinned. Only the Python mirror's at-case is missing.

### C3-44. Three window and cap edges have below and above but no "at": PERCLOS_WINDOW_MS, SCORE_WINDOW_MS, BLINK_LOG_DISPLAY_CAP

|                   |              |
| ----------------- | ------------ |
| Constraint        | D3           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** Mutations all leave 473 passed: src/core/perclos.ts:71,89 `nowMs - sample.timestampMs <= PERCLOS_WINDOW_MS` -> `<`; src/core/score.ts:100 `record.timestampMs >= windowStartMs` -> `>`; src/core/blinkLog.ts:41 `events.length <= BLINK_LOG_DISPLAY_CAP` -> `<` (and 50 -> 20 also passes).

**Detail.** All three values are otherwise bounded (PERCLOS_WINDOW_MS 60000 -> 30000 fails 3 tests; score.test.ts:323 pins SCORE_WINDOW_MS to 60000), and the sibling window primitive src/core/fps.ts `keepRecent` does have a discriminating trio at test/core/fps.test.ts:31-42 (flipping its `<=` to `<` fails 3 tests). So the convention is right where it is stated, just not stated in these three places.

### C3-45. Two frameClock display thresholds have no boundary test

|                   |              |
| ----------------- | ------------ |
| Constraint        | D3           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** src/core/frameClock.ts:70 `if (seconds < 90)` -> `< 120` = 473 passed; src/core/frameClock.ts:114 `if (remainingSeconds < 1)` -> `< 3` = 473 passed. The neighbouring guard at :109 `fraction < 0.05` is covered (0.05 -> 0.2 fails 1 test).

**Detail.** These pick the wording of the progress line (seconds versus minutes, and the "almost done" phrasing). Presentation only, no measurement rides on them, which is why this is low rather than medium.

### C3-46. FIXATION_DISPERSION_THRESHOLD: the strictly-below lead is half right, and the guard is one-sided

|                   |              |
| ----------------- | ------------ |
| Constraint        | D3           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** test/core/fixation.test.ts:154 "runs the dispersion boundary" has only two legs: `fits` (spread*2 = exactly 0.02) and `exceeds` (0.021). A strictly-below case does exist elsewhere at :84, the staged scanpath with jitter 0.004 — proven by mutating 0.02 -> 0.005, which fails 2 tests. The at-case is genuine: flipping `seedDispersion <= dispersionThreshold` to `<` fails 2 tests. But 0.02 -> 0.06 leaves 473 passed, because `exceeds` is derived as `spread + 0.001` from the constant itself.

**Detail.** So the lead is refuted on the operator (the at-case discriminates) and confirmed on the trio's shape (the named boundary test has two legs, not three). The practical gap is directional: the box can be widened three times over undetected. test/core/score.test.ts:144 "pins the floor and ceiling values themselves" is the project's own answer to exactly this trap, applied there but not here.

### C3-47. test/core/notice.test.ts carries one vacuous and one unfailable assertion

|                   |              |
| ----------------- | ------------ |
| Constraint        | D2           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** test/core/notice.test.ts:17 `expect(notice).toContain("not")`, three lines after :15 already asserted `toContain("not a safety or medical device")`. test/core/notice.test.ts:22-23 `expect(demoNoticeText()).toBe(DEMO_NOTICE)` against src/core/notice.ts:25-27 `export function demoNoticeText(): string { return DEMO_NOTICE; }`.

**Detail.** Line 17 cannot fail while line 15 passes, and it inflates the "four things" count to five expects. Line 22 restates a one-line getter and cannot fail at all; worse, its name ("is one string, used everywhere, so the wording cannot drift") claims a property about the page, README and export that the assertion never touches. The rest of the file is good: :29-30 bound the length in both directions and :51 asserts the short notice is deliberately not a substring of the long one.

### C3-48. Restatement lines that assert an expression against itself

|                   |              |
| ----------------- | ------------ |
| Constraint        | D2           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** test/core/csv.test.ts:107 `expect(csvHeader()).toBe(CSV_COLUMNS.join(","))` against src/core/csv.ts:77-78 `return CSV_COLUMNS.join(",")`. test/core/heatmap.test.ts:14-15 asserts `grid.cols`/`grid.rows` equal the constants that src/core/heatmap.ts:20-21 uses as the defaults. test/core/featureRecord.test.ts:66 `expect(assembleFeatureRecord(FULL)).toEqual(FULL)` against a `return { ...fields }`.

**Detail.** Each is the same expression on both sides, but each sits in a file that carries the real load elsewhere, so none is a hole. Verified by mutation: swapping two CSV_COLUMNS entries is caught (1 failed) by the pinned row string at csv.test.ts:131, and changing the separator to `;` is caught (2 failed). The featureRecord identity is documented as intentional at src/core/featureRecord.ts:37-40 and the load-bearing test is the next one (:70, fresh object per call).

### C3-49. Three tests bundle unrelated assertion concepts, and say so in their own names

|                   |              |
| ----------------- | ------------ |
| Constraint        | D5           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** test/core/calibrationCapture.test.ts:31 "are nine, spread across the viewport, none duplicated" (three concepts, 6 expects). test/core/notice.test.ts:10 "says the four things it exists to say" (5 expects for 4 claims, one vacuous). test/core/scorePanel.test.ts:175 "reports unavailable signals rather than hiding them" (singular wording, plural wording, and a separately documented clause-ordering rule at :184-189).

**Detail.** Runners-up: test/core/scorePanel.test.ts:194 renders four independent staged cases in one `it`, and test/core/fixation.test.ts:88 names three behaviours ("finds exactly the three staged fixations, in order, sweeps in neither"). Severity is low because the suite as a whole is unusually tight: mean 1.85 `expect` calls per test across 473 tests, maximum 7, and zero tests with 8 or more.

### C3-50. Issue #112's regression test reproduces the bug but is filed under the amendment, not the bug

|                   |              |
| ----------------- | ------------ |
| Constraint        | D7           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** test/core/longClosure.test.ts:44 `describe("the shut line, roadmap amendment 5")` and :51 `it("replays the owner's reading droop: lids low is not eyes shut")`, with the owner's measured numbers in the comment at :52-62. `grep -rn '#112' test` -> no matches; #113, #114, #122, #126, #145, #176, #192 and #193 are all cited by number in test files.

**Detail.** The scenario itself is reproduced faithfully (baseline 7.2 mm, droop at 3.4 mm chosen below the old blink line so the stream provably false-fired under the old wiring), so the protection exists. Only the naming convention slipped, and the amendment reference is a defensible substitute since ROADMAP amendment 5 records the same decision.

### C3-51. A pocket of test names states the test's own mechanism rather than the code's behaviour

|                   |              |
| ----------------- | ------------ |
| Constraint        | D5           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** test/core/score.test.ts:143, :173, :211 all named "pins the floor and ceiling values themselves"; test/core/score.test.ts:135, :161, :199 all named "runs the ramp trio: floor, midpoint, ceiling"; test/core/blink.test.ts "brackets the fraction behaviorally, not only by restating it"; test/core/longClosure.test.ts:83 "brackets the line with measured probes, not only the constant"; analysis/tests/test_stats.py:121 `test_returns_the_declared_type`.

**Detail.** In a 20-name sample spread across phases 1 to 7 plus Python, 17 state a behaviour in plain English and 3 state test-suite mechanism. The offenders are concentrated in the meta-tests that exist to protect the suite from itself, where naming the mechanism is arguably the honest choice; the sibling names that do the same job well add the behaviour after the colon ("runs the boundary trio: below closes, at and above stay open").

### C3-52. One exported core function has no test at all

|                   |              |
| ----------------- | ------------ |
| Constraint        | D8           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** A script over every exported function in src/core found 104 exports, of which 103 are invoked by at least one file under test/. The exception is `learningSecondsLeft` at src/core/baseline.ts:92, called only from src/main.ts:1923.

**Detail.** It computes the user-facing baseline countdown with a Math.ceil and a Math.max(0, ...) clamp, so an off-by-one or a sign error in the clamp would reach the screen untested. Everything else in the layer passes the every-exported-function bar.

### C3-53. learningSecondsLeft is the only exported src/core function with zero tests

|                   |              |
| ----------------- | ------------ |
| Constraint        | A3           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** `grep -rln learningSecondsLeft test/` returns nothing. v8 reports src/core/baseline.ts functions at 80% (4/5) with lines 96-99 uncovered, which is the whole function body. It renders user-visible text at src/main.ts:1928 (`Learning your open eyes: N s left`).

**Detail.** Every other one of the 145 functions in src/core is reached. This one produces a countdown a user reads, and its `state.kind !== "learning"` null path (baseline.ts:96-97) is never asserted, so D4's null-over-guessing rule is unverified here.

### C3-54. Refusal branches in src/core that return null are never exercised

|                   |              |
| ----------------- | ------------ |
| Constraint        | D10          |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** Uncovered lines from the v8 run: src/core/ear.ts:54 (missing landmark index -> null), src/core/aperture.ts:32-33 (`ring[0] ?? -1`, a short iris ring), src/core/calibrationCapture.ts:61 (`isCaptureDone` guard, no-op after nine targets), src/core/fixtureRecording.ts:43 (`?? 0` for an empty recording).

**Detail.** Four refusal or guard paths that D4 says must be asserted. None decides a published number on its own, but each is the branch that stops a malformed input from becoming a number, which is exactly the class the project claims to test hardest.

### C3-55. steppingWarning's "unknown" rate arm is uncovered in an otherwise 98%-branch file

|                   |              |
| ----------------- | ------------ |
| Constraint        | D10          |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** src/core/frameClock.ts:256 `check.trueRate === null ? "unknown" : ...` uncovered; v8 reports `frameClock.ts | 100 | 98 | 100 | 100 | 256`.

**Detail.** This is the only uncovered branch in the file that owns stepping honesty, and it is the arm that runs when the clip's real rate cannot be established. The wrong-interval warning is user-visible text, so the untested arm can print a malformed sentence at the exact moment the operator most needs it.

### C3-56. blink_match.f1 returns 0.0 at the precision+recall==0 boundary with no test

|                   |              |
| ----------------- | ------------ |
| Constraint        | D10          |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** analysis/blinklab/blink_match.py:105 `return 0.0`, the single uncovered statement in that file (`blink_match.py 67 1 99% 105`).

**Detail.** A clip where nothing matched publishes F1 = 0.0 rather than null. That is defensible arithmetic, but D3 asks for below/at/above on a threshold and D4 asks the null question, and neither is asserted at this boundary.

### C3-57. A coverage/ folder is reserved in .gitignore but nothing ever writes one

|                   |              |
| ----------------- | ------------ |
| Constraint        | D10          |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** .gitignore:4 `coverage/`; `grep -rn coverage vitest.config.ts vite.config.ts package.json .github/workflows/ci.yml playwright.config.ts` returns no match; `ls -d coverage` reports no such directory.

**Detail.** Harmless dead configuration, and row 8.6 would give it a purpose. Worth one line in the report only because it makes the repo look like it has coverage tooling when it has none.

### C3-58. Determinism is otherwise good, but the published seed, the iteration count and the corpus sort are all unpinned

|                   |              |
| ----------------- | ------------ |
| Constraint        | D6           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** Mutation S13 (stats.py:71 seed 20260809 -> 1) SURVIVED. Mutation S14 (stats.py:70 iterations 10000 -> 100) SURVIVED. Mutation E10 (eyeblink8.py:211 `sorted(root.rglob(...))` -> `list(...)`) SURVIVED. Mutation B12 (blink_match.py:141 `pairs.sort()` -> `pairs.sort(reverse=True)`) SURVIVED.

**Detail.** stats.py:80-82 states the seed was "chosen before any result was seen and never changed after", which is exactly the kind of claim a pinning assertion exists to protect, and both defaults set every published p-value. Against that, no Python test touches the clock, sleeps, or depends on dict order; every fixture is written into tmp_path by the test itself; blink_match.py:132 breaks ties by index with a comment saying why; and the corpus tests skip loudly with a stated reason at test_eyeblink8.py:162-190.

### C3-59. No Python regression test is named after a bug, and the one fix commit on the track shipped without one

|                   |              |
| ----------------- | ------------ |
| Constraint        | D7           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** `grep -rniE 'regression|issue #|bug' analysis/tests/` returns one hit, a rationale comment at test_drozy.py:131. `git show --stat --format='' f859bd2` ("fix(analysis): report the DROZY exclusion bias before any correlation (#196)") touched analysis/tools/analyse_drozy.py (+33) and docs/drozy-analysis-plan.md (+19), and zero test files.

**Detail.** Rule 7 says a fix increment starts with a failing test that reproduces the problem. The added logic computes a mean-KSS gap and warns above a threshold, which is testable arithmetic, and it landed in the one directory with no tests. Mitigating: the decision itself is documented as a plan amendment in docs/drozy-analysis-plan.md, and the Python track is young enough that no other defect has been found in real use.

---

## Compliance, as reported by each auditor

### Mutation testing of src/core (checklist D1, D2)

- OVERALL SCORE: 98 of 122 mutations killed by the untouched suite (80.3%). Excluding 7 provably equivalent mutants, 98/115 = 85.2%. This is a strong result for a hand-written suite with no mutation tooling in CI, and the suite ran the whole 473-test set in 2.75 s per mutation, which is what made 122 runs practical.
- MASTER PROMPT RULE 4 IS PERFECT: all 15 refusal-removal mutations (`return null` -> a number) were KILLED. M02/M06 aperture, M09 ear, M35 headPose, M41/M43 perclos, M53 longClosure, M56 blinkShape, M69/M72 blinkRate, M76 score, M99 fixation, M108/M110 calibrationProfile, M119 gazeOffset. Null-over-guessing is the single best-defended property in this codebase.
- Six modules scored 100%: aperture 7/7, ear 4/4, blinkRate 6/6, gazeOffset 6/6, statistics 4/4, headPose 3/3, fpsGate 2/2, longClosure 10/10.
- The aspect-ratio trap the aperture comment warns about is genuinely defended: M07, swapping frameWidthPx and frameHeightPx in aperture.ts:20 toPixels, was killed by both the recorded-fixture test and blink.test.ts's fixture timing test.
- Every arithmetic and operand-swap mutation on a published quantity was killed: M05 (mm conversion * -> /), M25 (threshold fraction), M30 (sd/m -> m/sd), M34 (headPose atan2 operands), M61 (blink amplitude sign), M66 (A/V ratio inverted), M82 (score identity 100 - penalty -> 100 +), M111 (least-squares slope), M121/M122 (gaze projection). Rule 1, test the maths not the mock, holds.
- Boundary trios are real and they work in most places. Killed by named at-the-line tests: M12/M13/M14 (blink), M31 (fps gate), M38/M40 (perclos), M46/M48/M50 (long closure), M68 (blink rate), M102/M103 (fixation), M115/M116 (calibrated quadrant). Several test names literally say "runs the boundary trio".
- Every logical-operator mutation was killed: M17, M32, M37, M49, M51, M114. Compound conditions are exercised at both branches, not just the happy path.
- Named constants are mostly pinned by value, not only by relationship: M54 (EYES_SHUT_FRACTION 0.4 -> 0.45), M83 (PERCLOS_PENALTY_MAX 40 -> 41), M84 (ramp floor 0.05 -> 0.06), M91 (toFixed(2) -> (1)), M95 (0.98 -> 0.5) were all killed.
- Recorded-fixture tests earn their keep rather than just existing. session-01.json killed mutations that synthetic tests missed, e.g. M11 (EAR chord sum) was caught by "yields a sane ratio on every one of the 300 real frames", and M64 by "reads both recorded blinks as physiologically plausible shapes".
- The project has already used mutation testing at least once by hand: test/core/longClosure.test.ts:290 is `describe("after the gap, found by mutation testing before the pull request")`, and that module scored 10/10 here. The practice works; it just is not systematic yet.
- Regression tests are named after their bugs, per rule 7, and they hold: fix #114 depth arming (M17, M19), fix #122 staleness (M43), fix #126 ceiling (M23), issue #192/#193 (M94, M95), #176 refractory. M94, the bare carriage return in a clip name, was killed by a test named exactly for it.
- The real repository was never modified. `git -C "/Users/evannorus/Desktop/blinklab build/blinklab/.claude/worktrees/audit-fresh" status --porcelain` returned empty at the end of the run. All work was done in a copy at scratchpad/mut, which also ends clean and back at 473/473 passing.

### D3 — boundary triads: every threshold gets three tests (below, at, above)

- FULL THRESHOLD TABLE (b = strictly below, at = exactly equals the constant, a = strictly above; 'at*' = present but proven non-discriminating).
  | Threshold | Value | Site | b | at | a |
  | INFERENCE_BUDGET_MS | 30 | timing.ts:29 | Y | Y | Y |
  | BLINK_APERTURE_THRESHOLD_MM | 4 | blink.ts:60 | Y | Y | Y |
  | APERTURE_HYSTERESIS_FRACTION | 0.1 | blink.ts:61 | Y | Y | Y |
  | MAX_BLINK_DURATION_MS | 500 | blink.ts:76 | Y | Y | Y |
  | BLINK_REFRACTORY_MS | 150 | blink.ts:85 | Y | N | Y |
  | LONG_CLOSURE_THRESHOLD_MS | =500 | longClosure.ts:86,107 | Y | Y | Y |
  | EYES_SHUT_FRACTION | 0.4 | longClosure.ts:88 / perclos.ts:76 | Y | Y | Y |
  | MIN_BLINK_FPS | 25 | fpsGate.ts:8 | Y | Y | Y |
  | BLINK_RATE_WINDOW_MS | 60000 | via fps.ts keepRecent | Y | Y | Y |
  | BLINK_RATE_MIN_OBSERVATION_MS | 15000 | blinkRate.ts:39 | Y | Y | Y |
  | PERCLOS_MIN_OBSERVED_MS | 15000 | perclos.ts:96 | Y | Y | Y |
  | PERCLOS_STALE_MS | 2000 | perclos.ts:102 | Y | at* | Y |
  | PERCLOS_WINDOW_MS | 60000 | perclos.ts:71,89 | Y | N | Y |
  | SCORE_WINDOW_MS | 60000 | score.ts:100 | Y | N | Y |
  | OFF_SCREEN_OFFSET_THRESHOLD | 0.18 | gazeQuadrant.ts:34,35 | Y | Y | Y |
  | quadrant midline | 0 | gazeQuadrant.ts:41,42 | Y | Y | Y |
  | calibration midline | 0.5 | calibrationProfile.ts:111,112 | Y | Y | Y |
  | POSE_LIMITS.maxYawDeg | 25 | validityGate.ts:29 | Y | Y | Y |
  | POSE_LIMITS.maxPitchDeg | 20 | validityGate.ts:29 | Y | N | Y |
  | POSE_LIMITS.maxRollDeg | 25 | validityGate.ts:29 | Y | N | Y |
  | ALERT_DEBOUNCE_MS | 5000 | alert.ts:43 | Y | Y | Y |
  | ALERT_DISPLAY_MS | 3000 | alert.ts:63 | Y | Y | Y |
  | FIXATION_DISPERSION_THRESHOLD | 0.02 | fixation.ts:88,92 | Y (remote) | Y | Y |
  | MIN_FIXATION_DURATION_MS | 120 | fixation.ts:81 | Y | Y | Y |
  | CALIBRATION_SETTLE_MS | 800 | calibrationCapture.ts:63 | Y | N | Y |
  | CALIBRATION_SAMPLES_PER_TARGET | 30 | calibrationCapture.ts:70 | Y | Y | n/a |
  | BLINK_LOG_DISPLAY_CAP | 50 | blinkLog.ts:41 | Y | N | Y |
  | BLINK_LOG_RECORD_CAP | 20000 | blinkLog.ts:25 | Y | Y | Y |
  | BASELINE_LEARN_MS | 30000 | baseline.ts:47 | N | N | N |
  | BASELINE_MIN_SAMPLES | 100 | baseline.ts:48 | Y | N | N |
  | BASELINE_RISE_MIN_SAMPLES | 300 | baseline.ts:63 | N | N | N |
  | BASELINE_RECENT_CAP | 600 | baseline.ts:62 | N | N | N |
  | BASELINE_MEDIAN_CEILING_FACTOR | 1.4 | baseline.ts:82 | n/a (clamp) | value pinned | n/a |
  | BASELINE_THRESHOLD_FRACTION | 0.5 | baseline.ts:88 | n/a (factor) | value pinned | n/a |
  | STEPPING_DUPLICATE_TOLERANCE | 0.98 | frameClock.ts:240 | Y | N | Y |
  | frameClock ETA floor | 0.05 | frameClock.ts:109 | Y | ? | Y |
  | frameClock minutes switch | 90 s | frameClock.ts:70 | N | N | N |
  | frameClock last-second switch | 1 s | frameClock.ts:114 | N | N | N |
  | heatmap unit-square bounds | 0,1 | heatmap.ts:30 | Y | Y | Y |
  | PANEL_DRIVER_LIMIT | 3 | scorePanel.ts:9 | Y | Y | Y |
  | KSS valid range | 1..9 | kss.ts:39,40 | Y | Y | Y |
  | statistics CV guard | m<=0 | statistics.ts:48 | Y | Y | Y |
  | score PERCLOS ramp | 0.05/0.15 | score.ts:33,34 | Y | Y | Y |
  | score blink-duration ramp | 250/450 | score.ts:47,48 | Y | Y | Y |
  | score sluggish-lid ramp | 150/300 | score.ts:55,56 | Y | Y | Y |
  | py DEFAULT_TOLERANCE_FRAMES | 4 | blink_match.py:33 | Y | N | Y |
  | py MIN_USABLE_FPS | 25 | drozy.py:72 | Y | N | Y |
  | py stats minimum n | 3 | stats.py:52 | Y | Y | Y |
  | io/main thresholds (8 of them) | various | src/io, src/main.ts | N | N | N |
- MAX_BLINK_DURATION_MS 500 is the best-tested threshold in the repo and the partition it defines is tested as a property. blink.test.ts:70 counts a closure at exactly 500, :102 refuses 600; longClosure.test.ts:130 fires nothing at exactly 500 and fires at 501; :252 runs the reopen trio at 499/500/501; :268 feeds spans 150,400,500,501,533,600,2000 through BOTH reducers and asserts blinkCount+longCount==1. Flipping `<=` to `<` in blink.ts fails 2 tests, `>` to `>=` in longClosure.ts fails 2 tests each at :86 and :107.
- EYES_SHUT_FRACTION 0.4 is aliased rather than copied (perclos.ts:29 `PERCLOS_CLOSED_FRACTION = EYES_SHUT_FRACTION`, asserted against the raw source text at perclos.test.ts:255) and both consumers carry a discriminating trio: longClosure.test.ts:101 and perclos.test.ts:264 both run below/at/above at the shut line. Flipping either `<` to `<=` fails tests, and 0.4 -> 0.5 fails 5.
- The APERTURE_HYSTERESIS_FRACTION arm line is the strongest example of a trio that also pins its value behaviourally. blink.test.ts:158 runs armMm+0.001 / armMm / armMm-0.001, and :167 adds "brackets the fraction behaviorally, not only by restating it": 3.61 must not count and 3.60 must, which kills both a 5 percent and a 20 percent gap. Flipping `<=` to `<` fails 2 tests; 0.1 -> 0.2 fails 1.
- MIN_BLINK_FPS 25 has a clean trio at fpsGate.test.ts:16 using MIN_BLINK_FPS-0.1 / MIN_BLINK_FPS / MIN_BLINK_FPS+0.1, and it discriminates: `>=` -> `>` fails 2 tests, 25 -> 15 fails 2 tests.
- The alert governor has both its windows covered. alert.test.ts:68 runs DEBOUNCE-1/DEBOUNCE/DEBOUNCE+1 and :113 runs DISPLAY-1/DISPLAY/DISPLAY+1. Flipping either `<=` to `<` fails 1 test each. Only the raw values 5000 and 3000 are unpinned.
- OFF_SCREEN_OFFSET_THRESHOLD 0.18 runs two trios, one per axis including the negative side, at gazeQuadrant.test.ts:81 and :87, written against a literal T=0.18 rather than the imported constant, so the value is pinned too: `<=` -> `<` fails 1 test and 0.18 -> 0.25 fails 4.
- BLINK_RATE_MIN_OBSERVATION_MS and BLINK_RATE_WINDOW_MS both have explicit trios at blinkRate.test.ts:33 and :46, and the window edge is enforced by the shared primitive fps.ts keepRecent, which has its own three tests at fps.test.ts:31,35,39. Flipping keepRecent's `<=` to `<` fails 3 tests across two modules.
- The score ramps carry floor, midpoint and ceiling plus a below-floor and an above-ceiling case, and score.test.ts:144, :172 and :212 each add a "pins the floor and ceiling values themselves" test with the reason stated in a comment: "Without these, nudging a constant leaves every ramp test passing because they all derive from the constant." That is precisely the trap the fixation dispersion test falls into.
- MIN_FIXATION_DURATION_MS 120 has a real trio at fixation.test.ts:145 (MIN-1 gives 0 fixations, MIN gives 1, MIN+1 gives 1), and flipping `>=` to `>` fails 3 tests.
- The heatmap unit-square bounds, the quadrant midline at zero, the calibration midline at 0.5, the KSS 1..9 range, the CV guard at m<=0, BLINK_LOG_RECORD_CAP 20000 and PANEL_DRIVER_LIMIT 3 all have at-cases that discriminate: flipping each comparison in a scratch copy fails at least one test (heatmap.test.ts:35, gazeQuadrant.test.ts:67, calibrationProfile.test.ts:157, kss.test.ts, statistics.test.ts, blinkLog.test.ts:55, scorePanel.test.ts).
- Rows 8.6 and 8.7 of ROADMAP.md are unticked, so the absence of a coverage floor on src/core and of bundle and inference budgets is unreached roadmap work, not a D3 violation. Everything reported above is a missing or non-discriminating test in the suite as it stands, independent of those gates.

### Assertion quality (D1, D2, D5, D6, D7, plus A3 where a fix carried no check)

- D6 is clean at the source: `grep -rn 'setTimeout|setInterval|Date.now|performance.now|new Date(|sleep(|waitForTimeout|vi.useFakeTimers|await new Promise' test --include='*.ts'` returns only two hits, both `test.setTimeout` budgets in test/e2e/videoFile.spec.ts:35 and :145. Every core function takes time as a parameter; test/core/gazeSmoothing.test.ts:12-14 states the rule out loud.
- D6, no order dependence: `npx vitest run --sequence.shuffle` in a scratch copy -> `Test Files 49 passed (49) / Tests 473 passed (473)`, seed 1786351425653.
- D6, `retries: 2` is masking nothing. 14 CI runs sampled with `gh run view <id> --log`, from 31313986401 (9 Aug) to 31370797498 (10 Aug): every one reports `5 passed (15.1s to 18.9s)`. No `flaky`, no `retry #`, no failed e2e job.
- D6, the Playwright specs use web-first assertions throughout. Zero `waitForTimeout` in test/e2e; the only waits are `await expect(...).toBeVisible({ timeout })`, which poll and exit early. CI e2e finishes in 15-19 s against budgets of 30-240 s, a 12x margin.
- D6, the one real local flake trap is handled in writing and in code: playwright.config.ts documents `reuseExistingServer` serving a stale bundle as issue #175, and tools/bundleGuard.mjs plus a 128-line test/tools/bundleGuard.test.ts refuse to measure a mismatched server (test at :98, "refuses the 9 August case, a stale server answering happily").
- D6 on the Python side: the permutation seed is fixed by default at analysis/blinklab/stats.py:71 (`seed: int = 20260809`, documented as chosen before any result was seen), and analysis/tests/test_stats.py:84 pins reproducibility. `uv run pytest -q` -> 95 passed, 2 skipped.
- D1, there are no mocks to test. `grep -rn 'vi.mock|vi.fn|vi.spyOn|jest\.' test --include='*.ts'` returns nothing across the whole tree.
- D1, the maths tests kill real mutants. Four logic mutations run one at a time in a scratch copy: stddev population -> sample n-1 (2 failed), heatmap row-major -> column-major (2 failed), replayIndex at-or-before -> strictly-before (3 failed), geometry hypot -> max (12 failed). Python: `ranks` sort ascending -> descending (2 failed).
- D2, strong ground-truth examples exist across phases: test/core/ear.test.ts:30 solves a hand-built eye to exactly 1/3; test/core/calibrationProfile.test.ts:46 recovers a known generating line to 6 decimals using noise designed so the median is exact (:33); test/core/score.test.ts:104 scores the owner's documented resting numbers from test/MANUAL.md at exactly 100; test/core/csv.test.ts:131 pins the whole serialized row as a literal string.
- D2, strong invariant examples exist too: test/core/statistics.test.ts:44 asserts CV(mm) < CV(px) with both sides bounded (< 0.001 and > 0.25) rather than just compared; test/core/replay.test.ts:27 checks a binary search against an independent naive filter at eight probes; test/core/gazeSmoothing.test.ts:98 runs a counterfactual fixed filter to prove the adaptivity is load-bearing; test/core/tiltInvariance.test.ts:48 is a whole describe block named "the counterfactual: the bug we did not write".
- D2, weak assertions are rare and mostly honest: 46 loose assertions in 905 `expect` calls (5.1%). 32 of those are `not.toBeNull()` used as a TypeScript narrowing guard immediately followed by a tight assertion (test/core/blinkShape.test.ts:35-37 is the pattern). Zero `toBeTruthy`, zero `toBeFalsy`, zero snapshots. The `toBeGreaterThanOrEqual(0)` uses are half of a real range invariant (test/core/constants.test.ts:23-24).
- D7, 10 of the 13 closed issues whose fix changed src/ carry a regression test naming the bug: #22 (test/core/videoLayout.test.ts:5), #113 (perclos.test.ts:206, :265), #114 (blink.test.ts:43, :129, :233), #122 (perclos.test.ts:125), #126 (baseline.test.ts:107), #145 (frameClock.test.ts:171), #175 (test/tools/bundleGuard.test.ts:98), #176 (blink.test.ts:240), #192 (fpsGate.test.ts:65), #193 (frameClock.test.ts:254). #38 needed none: `gh issue view 38 --comments` shows it was closed "Not a bug" with no fix.

### D8/D9 — the five test pyramid layers and whether the foundations are sound

- Suite is green and fast: `npx vitest run` in the scratchpad copy gives 473 passed, 49 files, 2.90s. The CV assertion at test/core/statistics.test.ts:44 exists and passes, asserting cvMm < cvPx AND cvMm < 0.001 AND cvPx > 0.25.
- Rule 6, no flaky tests: grep for setTimeout, Date.now(), performance.now() and await-new-Promise across test/core/ returns nothing. Clocks are injected everywhere.
- Rule 7, regression tests named after the bug: test/core references issue #22, #113, #114, #122, #126, #145, #176, #192, #193 by number.
- Rule 1 at its strongest: test/core/tiltInvariance.test.ts:48-79 implements the WRONG algorithm locally (vertical drop instead of distance) and proves it shrinks by exactly cos(roll) while the shipped one does not. A counterfactual test is the best possible answer to "test the maths, not the mock".
- Rule 3, boundary trios where thresholds live: fpsGate.test.ts:16 "runs the boundary trio at the minimum", landmarkGuard.test.ts:19-29 accepts 478 and rejects one below and one above, gazeQuadrant.test.ts runs the trio on both axes.
- Rule 4, null over guessing: aperture.test.ts:54-73 asserts null on a zero-width iris and on empty landmarks; statistics.test.ts:36-40 asserts null for empty, zero-mean and negative-mean inputs.
- The recorded fixture is not integrity-only. sessionFixture.test.ts asserts integrity (300 frames, 478 landmarks, monotonic timestamps, coordinate range, face present), and 6 further files consume it for measurement outcomes: blink, aperture, ear, sparkline, blinkShape, gazeOffset. blink.test.ts pins "the owner's two blinks at 133 and 117 ms".
- The generator's iris scale and roll ARE pinned by mutation: drawing the iris 20% too large fails 6 tests, removing roll fails 2.
- headPose.test.ts:5-48 builds its rotation matrices by an independent multiplication path rather than reusing the decomposition, and covers one axis at a time plus a combined rotation plus gimbal-lock refusal (headPose.test.ts:116). ROADMAP.md:61's stated check for 3.6 is genuinely met.
- The E2E specs are honest about their own scope rather than overclaiming: videoFile.spec.ts:70-80 explains the weak predecessor assertion it replaced, and :89-96 states what is deliberately NOT asserted and why.
- Known traps are documented at the point that causes them, not hidden: the WebKit CI exclusion with its reasoning (playwright.config.ts:29-46) and the stale-server trap as issue #175 (playwright.config.ts:73-81).
- Rows 8.6 and 8.7 are unticked at ROADMAP.md:122-123, so the missing src/core coverage floor and the missing bundle/inference budgets are unreached roadmap work, not violations. CI already gates lockfile install, lint, typecheck, test, build, format:check and Chromium e2e (.github/workflows/ci.yml).

### D10 + A3 — what is not tested at all (measured coverage, uncovered refusal branches, the src/io + src/main.ts gap)

- src/core passes the 70% floor row 8.6 specifies, with a large margin and on all four metrics: `SRC/CORE stmt 98.07% (659/672)  branch 94.68% (498/526)  func 99.31% (144/145)  line 98.02% (642/655)`. The gate would go green the day it is added.
- Every one of the 45 modules in src/core has a same-named test file in test/core/. Checked with a loop over `src/core/*.ts` asserting `test/core/<name>.test.ts` exists: zero misses.
- Ten lowest-covered src/core files, and none is alarming: baseline.ts 85.18/84.61/80/85.18, calibrationCapture.ts 87.5/80/100/87.5, blinkShape.ts 88.57/73.33/100/87.5, ear.ts 92.3/90/100/92.3, score.ts 96.87/92.85/100/96.77, fixation.ts 97.95/90/100/97.95, fixtureRecording.ts 100/75/100/100, replay.ts 100/75/100/100, headPose.ts 100/83.33/100/100, kss.ts 100/87.5/100/100 (stmt/branch/func/line).
- D10's reached half is fully met. .github/workflows/ci.yml runs `npm ci` (lockfile, no floating versions), `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run format:check`, `npx playwright install --with-deps chromium` + `npm run e2e`, plus `uv sync --locked`, `uv run ruff check .`, `ruff format --check .`, `uv run pytest`.
- Rows 8.6 and 8.7 are genuinely unticked in ROADMAP.md:122-123, so the missing coverage floor and budget gates are unreached work, not violations.
- src/io is not entirely untested despite reading 0% under Vitest. test/e2e/videoFile.spec.ts:131-164 drives `stepThroughVideo` end to end and asserts `measured` is within +/-1 of the fixture's frame count; test/e2e/calibration.spec.ts exercises camera start, landmarker load, the frame loop and calibrationStore.
- The core/io boundary is a written decision, not an accident. ARCHITECTURE.md:10-16 states src/core is pure and main.ts is wiring, and ADR-0003 records the e2e limit in one sentence: a headless browser can fake a camera but not a face, so e2e proves wiring only.
- The Python library layer is well covered: `analysis/blinklab` is 481/499 statements, 96.4%, with plot.py, stats.py and **init**.py at 100%, and every one of the 7 modules has a matching test file in analysis/tests/.
- The Vitest suite passes clean under instrumentation, so the coverage numbers are not measured against a broken run: `Test Files 49 passed (49)`, `Tests 473 passed (473)`, 4.66s. Python: `95 passed, 2 skipped in 12.65s`.
- Uncovered lines in blinkShape.ts (45, 49, 57, 66) and score.ts:105 are unreachable defensive returns, not skipped tests. In blinkShape, minIdx>0 forces samples[maxIdx] > samples[minIdx], so `amplitudeMm <= 0` at line 48 cannot fire; in score.ts, `windowed` always contains `newest`, so `oldest === undefined` cannot fire. The reachable refusal at blinkShape.ts:60-61 (dtS <= 0, duplicate timestamps) IS covered.
- No file in src/core is below 73% on any metric, so there is no dark corner of core, only thin edges.
- The real repository is untouched. `git -C "/Users/evannorus/Desktop/blinklab build/blinklab/.claude/worktrees/audit-fresh" status --porcelain` prints nothing, `git diff --stat` prints nothing, `node_modules/@vitest/coverage-v8` does not exist there, and `analysis/.venv/.../pytest_cov` does not exist there. Both providers were installed only into the scratchpad copy at /private/tmp/.../scratchpad/cov.

### Python test track (analysis/), checklist D1, D2, D3, D6, D7. Paths are relative to /Users/evannorus/Desktop/blinklab build/blinklab/.claude/worktrees/audit-fresh. MUTATION RESULT: 46 mutations applied to the 4 highest-value library files, run in a copy at scratchpad/mutroot/analysis (baseline 95 passed, 2 skipped, 0.51s). 30 killed, 16 survived, kill rate 65%. Per file: eyeblink8.py 7/10 (70%), blink_match.py 9/13 (69%), stats.py 8/13 (62%), drozy.py 6/10 (60%). Survivors: S6, S8, S9, S13, S14 (stats), B2, B3, B4, B12 (blink_match), D2, D5, D6, D7 (drozy), E8, E9, E10 (eyeblink8). Two of the sixteen (E8 glasses flag, E10 corpus sort) are arguably equivalent mutants on realistic input; excluding them the rate is 68%. The real repo was NOT modified: `git -C "<worktree>" status --porcelain` at the end of this work returned zero lines.

- THE IN-PLACE SHUFFLE IS NOT A DEFECT, and AUDIT_PLAN.md:476-477 can be closed as correct. stats.py:85-90 reuses one progressively shuffled list. Fisher-Yates applied to any arrangement yields a uniform permutation, so each iteration is marginally uniform AND conditionally uniform given the last, hence independent. Measured: 240,000 in-place shuffles of a 4-element list hit all 24 permutations, min 9,796 max 10,236 against an expected 10,000, statistically indistinguishable from 240,000 fresh-copy shuffles (min 9,804, max 10,174); all 576 lag-1 pairs occurred. On 20 tied points across 40 seeds the two variants gave mean p 0.1158 (in place) versus 0.1167 (fresh copy), inside Monte Carlo noise. Same pattern at tools/analyse_drozy.py:109-114, same verdict.
- D2 SATISFIED ON THE STATISTICS: the tests use independently derivable values, not self-consistency. test_stats.py:47-49 asserts spearman([1,2,2,3],[1,2,3,4]) == 0.9486. Hand check: ranks [1,2.5,2.5,4] and [1,2,3,4], numerator 4.5, dx 4.5, dy 5, so 4.5/sqrt(22.5) = 0.94868, which is the value scipy returns. test_stats.py:16-25 pins ranks([1,5,5,9]) == [1,2.5,2.5,4] and ranks([7,7,7]) == [2,2,2], both computable by hand.
- ALL THREE NAMED STATISTICS EDGE CASES ARE COVERED. Tied ranks: test_stats.py:18-25 and :40-49. Constant input: test_stats.py:51-56 asserts spearman returns 0.0, not NaN and not an exception, matching stats.py:60-63. n below 3: test_stats.py:58-60 asserts ValueError for n=2, and mutation S3 (`len(xs) < 3` -> `< 2`) was KILLED.
- The one-to-one matching rule, the anti-rigging guard, is genuinely defended. Mutation B7 (drop the used_detected half) KILLED, 1 failure; mutation B8 (drop the used_annotated half) KILLED, 3 failures. test_blink_match.py:63-73 fires 500 single-frame detections at 4 real blinks and asserts precision < 0.01 and f1 < 0.02. This is rule 1 done properly: the assertion breaks if the maths is wrong.
- eyeblink8.py is the best-tested file on the track, 7 of 10 mutations killed. Killed: the -1 sentinel (E1), the closed-interval +1 on frame_count (E2), the gapped-interval refusal (E3), the duplicate-frame refusal (E4), the 19-field line contract (E5, 10 failures), either-eye closure counting (E6), and frame_count = highest + 1 (E7).
- NULL OVER GUESSING IS ASSERTED, NOT ASSUMED, AND BOTH ASSERTIONS BITE. Mutation B9 (blink_match.py:87, recall None -> 0.0 on an empty clip) KILLED. Mutation D10 (drozy.py:180, _mean_or_none returning 0.0 instead of None) KILLED. The tests are test_blink_match.py:95-104 and test_drozy.py:105-120, and both carry a comment explaining why zero would be a false claim.
- The overlap arithmetic including the +1 IS pinned. Mutation B1 (blink_match.py:60, `end - start + 1` -> `end - start`) KILLED. Mutation B10 (`if shared > 0` -> `>= 0`) KILLED with 4 failures. test_blink_match.py:134-135 asserts a single-frame interval overlaps itself by exactly 1 frame.
- CI runs the Python track with a lockfile and no floating versions: .github/workflows/ci.yml:44-47 runs `uv sync --locked`, `uv run ruff check .`, `uv run ruff format --check .`, `uv run pytest`, in working-directory analysis. pyproject.toml selects E, W, F, I, B, C4, UP, PD, and the comment there calls the linter "a contract, not a suggestion".
- The cross-language CSV contract is asserted from the consuming side. analysis/tests/test_csv_contract.py:29-63 reads CSV_COLUMNS out of src/core/csv.ts by regex and compares it against a hand-written list, plus a separate test that timestampMs comes first. This is the border test the pyramid asks for and I could find no equivalent gap.
- Fixtures are written by the tests themselves into tmp_path rather than committed, so no Python test depends on a checked-in file's state or on filesystem ordering, and the corpus-dependent tests at test_eyeblink8.py:176-197 skip with an explicit reason and a documented environment variable rather than silently. The docstring at :162-171 says out loud that a silently skipping test stops protecting anything.
- Test naming follows rule 5 throughout: names state a behaviour in English (test_two_detections_on_one_blink_leave_one_invented, test_a_clip_with_no_blinks_reports_no_recall_rather_than_zero, test_zero_means_the_session_never_happened, test_blank_cells_are_skipped_rather_than_read_as_zero). Mutation D8 (blank cell read as 0.0) and D9 (rate per second not per minute) were both KILLED, so those names are backed by real assertions.
- THE REAL REPOSITORY WAS NOT TOUCHED. All 46 mutations ran in a copy at scratchpad/mutroot/analysis with a symlinked src/ so the CSV contract test still resolved. Final check: `git -C "/Users/evannorus/Desktop/blinklab build/blinklab/.claude/worktrees/audit-fresh" status --porcelain` printed nothing and `git status --short | wc -l` returned 0.

---

## What each auditor could not check

### Mutation testing of src/core (checklist D1, D2)

- Coverage floor on src/core: ROADMAP.md:122 row 8.6 is UNTICKED, so there is no coverage gate to audit. Absent coverage reporting is unreached roadmap work, not a violation. My mutation score is a stronger signal than line coverage would be anyway.
- Bundle size and inference time budgets: ROADMAP.md:123 row 8.7 is UNTICKED, same status, unreached roadmap work rather than a violation.
- Mutation coverage was limited to the 16 named high-value modules (122 mutations). Not mutated: alert, kss, heatmap, projection, transform, validityGate, landmarkGuard, csv, ringBuffer, gazeSmoothing, gazeQuadrant, fixationStats, facePresence, replay and others. Their kill rates are unknown.
- The 2 Playwright specs and the 97 Python test functions were out of scope for this dimension; no mutation was applied to analysis/blinklab or to the e2e layer.
- The GENUINE verdicts are certain, since each is backed by a concrete distinguishing input plus a written probe test that fails under the mutant and passes on clean code. The EQUIVALENT verdicts (M55, M58, M59, M62, M65, M97, M107) rest on 300-400k random-input differential searches plus reachability reasoning, not on formal proof.
- M97 (frameClock.ts:240 `sought <= 0` -> `< 0`) is equivalent only for reachable inputs: exhaustive integer search found it differs solely when sought is 0 and measured is negative, which no monotonic frame counter can produce. If that assumption is ever broken the mutant becomes genuine.

### D3 — boundary triads: every threshold gets three tests (below, at, above)

- The two Playwright specs (5 tests) were not executed; they need a browser and a dev server. I read them instead. test/e2e/videoFile.spec.ts:131 exercises src/io/videoStepper.ts end to end on a 60-frame fixture with a plus-or-minus-one tolerance, so it touches CALIBRATION_FRAMES, CALIBRATION_ATTEMPTS, CALIBRATION_STEP_S and the 0.001-to-1-second interval guard, but as one happy path, not as a triad on any of them.
- src/core/frameClock.ts:109 `fraction < 0.05` is partly covered (0.05 -> 0.2 fails 1 test) but I could not establish whether the failing test sits exactly at 0.05 or merely near it, so its at-case is marked '?' in the table rather than yes or no.
- Whether main.ts's 1000 ms record cadence and 3600-row cap are exercised by the e2e run at all: the specs assert on rendered text, and a run long enough to reach either threshold would take an hour of wall clock.
- Coverage percentages per threshold branch: no coverage tooling is installed (no @vitest/coverage dependency, no script), so 'the branch is never taken by any test' could only be established by mutation, which is what I did, rather than by instrumentation.

### Assertion quality (D1, D2, D5, D6, D7, plus A3 where a fix carried no check)

- Whether any e2e job ever passed on a retry before 9 August 2026. `gh run view --log` only returns logs for runs still in GitHub's retention window; the 14 runs I could read all show `5 passed` with no retry line, but earlier history is unreadable from here.
- Whether the local-only WebKit Playwright project is flaky. playwright.config.ts excludes it on CI by deliberate decision (documented at length in the config comment), and I cannot launch browsers in this environment, so its stability is asserted only by the config's own narrative.
- Whether the surviving heatmap and calibration constants are pinned by a human anywhere. test/MANUAL.md item 38 describes the heatmap qualitatively ("the grid is quadrant-coarse on purpose") and names no grid size, and no manual item mentions the settle window or the 30-sample quota, but I did not read all 60 manual items closely enough to rule out an oblique reference.
- A full mutation sweep of analysis/. I killed one mutant in blinklab/stats.py to prove the Python assertions bite, but I did not sweep the fixture-driven loaders (test_drozy.py, test_eyeblink8.py, test_loader.py), which are the largest Python files.

### D8/D9 — the five test pyramid layers and whether the foundations are sound

- Whether the 61 manual items were actually executed at each phase tag. Absence of a run log is not proof they were skipped, only that no evidence survives.
- Whether the Playwright suite passes right now. I did not run it: it needs a production build plus a ~15 MB model download, and the config's own reuseExistingServer trap (playwright.config.ts:73-81, issue #175) makes a local pass untrustworthy without the bundle-name check.
- The Python analysis track (analysis/tests/, 8 files) sits outside the five-layer pyramid and was not audited in this dimension.
- Whether session-01.json is used as ground truth. It cannot be: 300 frames of a real face carry no labels, so the recorded layer can only pin plausibility ranges and regressions, which is what it does.

### D10 + A3 — what is not tested at all (measured coverage, uncovered refusal branches, the src/io + src/main.ts gap)

- Whether the 5 Playwright tests actually execute the two refusal predicates at src/main.ts:796 and :826. I proved zero UNIT coverage; I did not instrument the browser run with v8, because the stepping spec carries a 240s timeout and needs a ~100 MB Chromium download. So 'zero coverage of any kind' is unproven for those two lines.
- Line-level coverage of src/io contributed by the e2e suite, for the same reason. The 0% figures for src/io are Vitest-only.
- Whether any CI job outside `uv run pytest` exercises analysis/tools/. I measured only the pytest run; ci.yml lines 44-47 show no other Python invocation, but I did not check for a separate manual runbook that exercises them.
- Whether test/MANUAL.md claims manual coverage of the main.ts refusal paths. I did not read it in full for this dimension; a reviewer should check before treating finding 1 as wholly unguarded.
- Branch coverage attribution inside main.ts's 323 branches, i.e. which specific ones decide published numbers. Reading a 2,764-line file line by line was out of budget; I sampled the arithmetic (toFixed/Math./division) and followed framesMeasured and framesBlinkMeasurable only.
- Whether the 4 uncovered analysis/tools scripts are covered by the `docs/evidence` or `docs/audit` material as recorded manual runs.

### Python test track (analysis/), checklist D1, D2, D3, D6, D7. Paths are relative to /Users/evannorus/Desktop/blinklab build/blinklab/.claude/worktrees/audit-fresh. MUTATION RESULT: 46 mutations applied to the 4 highest-value library files, run in a copy at scratchpad/mutroot/analysis (baseline 95 passed, 2 skipped, 0.51s). 30 killed, 16 survived, kill rate 65%. Per file: eyeblink8.py 7/10 (70%), blink_match.py 9/13 (69%), stats.py 8/13 (62%), drozy.py 6/10 (60%). Survivors: S6, S8, S9, S13, S14 (stats), B2, B3, B4, B12 (blink_match), D2, D5, D6, D7 (drozy), E8, E9, E10 (eyeblink8). Two of the sixteen (E8 glasses flag, E10 corpus sort) are arguably equivalent mutants on realistic input; excluding them the rate is 68%. The real repo was NOT modified: `git -C "<worktree>" status --porcelain` at the end of this work returned zero lines.

- Whether the published DROZY p-values and the Eyeblink8 recall/precision on README.md were actually produced by the current stats.py and blink_match.py. The corpora are not committed, so TestTheRealCorpus (test_eyeblink8.py:176-197) skips and the tools/ scripts cannot be run end to end here.
- Coverage percentage on analysis/. No coverage tool is configured in pyproject.toml and no CI step measures it. ROADMAP rows 8.6 and 8.7 are UNTICKED, so this is unreached roadmap work, not a violation, and my mutation kill rate of 65% is the closest proxy I could produce.
- Whether ruff would have rejected any of my 16 surviving mutants on style grounds before they could reach a human. I ran pytest only, not `ruff check`, so a survivor that ruff would flag is counted here as surviving when CI would have stopped it.
- Two of the sixteen survivors may be equivalent mutants rather than test gaps. E8 (eyeblink8.py:69, `== "YES"` -> `!= "NO"`) differs only on a third header value that Eyeblink8 does not use, and E10 (`sorted` -> `list` on rglob) may be behaviourally identical on APFS. I could not rule either in or out without the real corpus.
- Whether the greedy-versus-optimal gap I measured on random intervals actually occurs in the Eyeblink8 run. My 5.8% figure is over synthetic clips with deliberately overlapping detections; the real rate depends on how often blinklab emits nested or straddling detections, which needs the corpus.
- analysis/tools/audit_frame_loss.py (232 lines) and prepare_eyeblink8.py (153 lines) read video and timestamp files I do not have, so beyond confirming they have no tests I could not assess whether their logic is correct.
