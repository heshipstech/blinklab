# Appendix: Chunk 4, all findings as produced

The complete, unedited output of the six Chunk 4 auditors and the
fourteen skeptics who tested them. `chunk-4-measurement.md` is the
write-up; this file is the raw record behind it.

Produced 10 August 2026.

---

## Verification key

- **SURVIVED** a skeptic told to refute it, severity as corrected.
- **REFUTED** as stated. The corrected statement is given.
- **UNTESTED**. No skeptic saw it. Treat as a lead, not a conclusion.

Each finding also carries its KIND: `maths-wrong` (the arithmetic is
incorrect), `claim-mismatch` (the arithmetic is right but the
documentation says otherwise), or `unstated-assumption` (right and
honest, resting on something nobody wrote down).

---

## All 52 findings

### C4-01. Thirty of the hundred points can be charged for a blink of unbounded age, while the closure penalty is correctly windowed

|                             |              |
| --------------------------- | ------------ |
| Constraint                  | E1           |
| Kind                        | maths-wrong  |
| Severity as filed           | high         |
| Verdict as filed            | violation    |
| Verification                | **SURVIVED** |
| Severity after verification | **low**      |

**Evidence.** score.ts:22-25 and :119-121 state the window discipline and apply it to closures. But score.ts:137 and :151-158 read newest.lastBlinkDurationMs / lastBlinkAmplitudeMm / lastBlinkPeakVelocityMmPerS, which carry no timestamp and whose producers are sticky: blink.ts:92-95 keeps the last duration until the NEXT counted blink, and main.ts:2099 takes blinkEvents[length-1] from a COUNT-bounded log (blinkLog.ts:25, BLINK_LOG_RECORD_CAP), never a time-bounded one. Computed against the real module, records spanning 600-660 s with one blink at t=60 s: old long closure -> score 100 (correctly forgotten); old 450 ms / 300 ms-A-over-V blink -> score 70, still charging slow blinks=15 and sluggish lids=15.

**Detail.** The score's own comment says a row window 'would silently bridge gaps and charge closures from ten minutes ago', and then two of its four penalties do exactly that with blinks. Blink suppression is a documented state of this instrument's subject (MANUAL item 25, staring contest). I found no written reason for the asymmetry in SPEC.md, ROADMAP.md, LEARNING.md or the tests. Related: score 0 is reachable by exactly ONE integer combination, and it needs a 450 ms blink, a 300 ms A/V, 9 s of closure and two long closures in the same minute, so in practice the only route to 0 runs through this staleness.

**Corrected statement.** The score's two blink-shape penalties read an unbounded-age snapshot, an unstated freshness assumption rather than a windowing error, and it moves no published number

**Skeptic's reasoning.** MECHANISM REPRODUCES, CLASSIFICATION AND SEVERITY DO NOT. I re-ran the real module with npx tsx (script in scratchpad/skeptic-e1/probe.ts, worktree untouched) and got exactly the auditor's three numbers: rows spanning 600-660 s with longClosureCount frozen at 3 -> score 100; the same rows carrying lastBlinkDurationMs 450 and 3 mm / 10 mm/s (A/V 300 ms) -> score 70 with "slow blinks" 15 and "sluggish lids" 15; the same rows with those fields nulled -> 100. My own enumeration over (0..40, {0,15,30}, 0..15, 0..15) finds exactly ONE integer combination summing to 100, confirming that leg too. Stickiness is real: blink.ts:92-95 carries lastBlinkDurationMs forward, main.ts:2099 takes blinkEvents[length-1] from a count-bounded log, and blinkStep on a null aperture (blink.ts:56-58) preserves the duration.

(a) IT IS NOT MATHS-WRONG. Every ramp, the window selection and the 100-minus-sum identity are arithmetically correct. The finding belongs in the audit's third category: right and honest, resting on an assumption that is not stated. The asymmetry also has a structural cause the finding does not consider. longClosureCount is a MONOTONE COUNTER, so it can only be read as a delta between two rows, and that delta is what forces the window comment at score.ts:119-126. perclos and the blink fields are already-reduced snapshots on the newest row, and PERCLOS is fresh by construction because perclos.ts carries its own 60 s window and 2 s staleness rule. So this is one missing freshness rule on two snapshot inputs, not a window discipline applied once and abandoned twice. The unstated assumption is "the subject blinks at least once per scored minute".

(b) NO PUBLISHED NUMBER MOVES. score is not a FeatureRecord field and is absent from CSV_COLUMNS (src/core/csv.ts:10-27), so it is never exported. No analysis module reads it: drozy.py's seven pre-registered features come from the per-second and blink-event CSVs, and eyeblink8 recall/precision are event matching. MODEL_CARD.md:30 already lists the score as validated against "nothing external", "a heuristic, not a measurement".

(c) REACHABILITY IS NOT DEMONSTRATED, AND THE REAL DATA ARGUES AGAINST IT. The regime needs 60+ s with a face detected, live PERCLOS and no counted blink. The repository's only real blink event log (docs/evidence/2026-08-09/repeatability/published-run/27122013_154548_cam.blinks.csv, 43 blinks) has a maximum inter-blink gap of 9,633 ms and p95 7,900 ms, an order of magnitude short of the window. The blink-suppression exercise the finding cites, test/MANUAL.md item 25, is a TWENTY second staring contest, a third of the window, so the cited evidence does not reach the failure it is offered for.

(d) "NO WRITTEN REASON" IS PARTLY WRONG. analysis/blinklab/drozy.py:194-197 states the semantics explicitly, "the per-second file carries only the LAST blink's numbers, repeated until the next one, so averaging it would weight a blink by how long it happened to stay the most recent", and the published analysis deliberately avoids the column for that reason. test/MANUAL.md item 28 asserts the persistence as REQUIRED behaviour ("the last duration must not change" through a five second hold). What is genuinely missing is any statement that the SCORE inherits that persistence.

(e) THE "RELATED" CLAIM IS FALSE AND BACKWARDS. Score 0 does need all four penalties maxed, but nothing about it requires a stale blink. A minute with PERCLOS >= 15%, two closures beyond 500 ms, and a 450 ms blink at A/V >= 300 ms reaches 0 with every input fresh, and those are mutually consistent (MAX_BLINK_DURATION_MS is 500, so a 450 ms blink and a >500 ms closure coexist). Staleness makes 0 LESS likely, not more, because the stale regime is a blink-free minute in which PERCLOS tends to zero and the closure delta is zero.

WHAT SURVIVES: a low-severity, category-(c) finding. The score's two blink-shape inputs carry no age bound, so in a blink-free minute the panel can charge up to 30 points for an event of unbounded age, and no document states that the score assumes a blink inside its window. Cheap fix, one freshness rule mirroring PERCLOS_STALE_MS. Not high: no exported or published number changes, and the only real data in the repository never enters the regime.

PROTECTED REPO: I never wrote to, staged or deleted anything in audit-fresh; all work was read-only plus one scratchpad script. `git -C "/Users/evannorus/Desktop/blinklab build/blinklab/.claude/worktrees/audit-fresh" status --porcelain | wc -l` returns 0, so the worktree is clean.

### C4-02. The PERCLOS ramp floor is priced against a resting figure the manual itself marks superseded

|                             |                     |
| --------------------------- | ------------------- |
| Constraint                  | E1                  |
| Kind                        | unstated-assumption |
| Severity as filed           | high                |
| Verdict as filed            | partial             |
| Verification                | **REFUTED**         |
| Severity after verification | **low**             |

**Evidence.** score.ts:29-31 cites 'The owner's documented resting reading is one to three percent (MANUAL item 40)' and sets PERCLOS_RAMP_FLOOR = 0.05. MANUAL item 40's own amendment note says fix #113 changed the closed line 'so the resting number reads somewhat higher than under the original unreachable 20 percent line', and item 46 gives the new resting only as 'low single digits'. No re-measured number exists anywhere in the repo. MANUAL item 48, the check that guards this floor ('If sitting still and awake ever costs you points, the ramps are mispriced'), still carries only '(6.5)' with no #113 amendment note.

**Detail.** The margin of the 5% floor over the TRUE post-#113 resting PERCLOS is unknown and may be zero. Computed sensitivity: the first point is charged at PERCLOS 5.125%, then 4 points per further percentage point. So if real resting is 6%, an awake person reads 96 permanently. This is not the maths being wrong, it is a live assumption that the manual flags as stale and no document restates.

**Corrected statement.** score.ts cites MANUAL item 40's amended body for resting PERCLOS instead of item 46's post-fix restatement, a stale cross-reference with no measured consequence

**Skeptic's reasoning.** REFUTED on three independent checks; the arithmetic in the finding is correct but its premise is not.

1. CHRONOLOGY REVERSES THE CLAIM. The floor was priced AFTER the supersession, not against a stale figure. `git log`: the PERCLOS closed-line change is `119c66d fix(core): PERCLOS learns to see, amendment 6 (#118)`, 2026-08-07; the score file was added by `7aea481 feat(core): the demo score, priced against our own instrument (#123)`, 2026-08-08, a descendant commit. docs/log.md:53 dates fix #113 to 2026-08-06 and log.md:55 dates 6.5 to 2026-08-08. The finding's supporting evidence, that MANUAL item 48 "still carries only (6.5) with no #113 amendment note", is therefore backwards: item 48 was written in the post-#113 world, so there is nothing to amend.

2. THE AMENDMENT IS MISREAD. test/MANUAL.md:44 says resting "reads somewhat higher than under the original unreachable 20 percent line". Item 46 (test/MANUAL.md:50) states what that old reading was: "Before this fix this provably left PERCLOS at 0.0%", and then restates the new resting band itself, post-fix: "The resting value itself sits higher than the old zero, low single digits." Higher-than-zero, low single digits, contains 1 to 3 percent. The amendment corroborates the cited band, it does not supersede it, and item 46 IS a post-fix restatement, contradicting "No re-measured number exists anywhere in the repo".

3. THE REPO DOES HOLD POST-FIX MEASURED PERCLOS, AND IT SITS BELOW THE FLOOR. docs/evidence/2026-08-09/repeatability/*/27122013_154548_cam.seconds.csv are four post-#113 runs on a real face (eyeblink8, glasses, 30 fps). I parsed the perclos column independently: n=119 scored seconds, min 1.62%, median 3.72 to 3.81%, mean 3.6%, max 6.49%, stable across all four re-runs. The blinks file gives 43 blinks, median 167 ms closed; 15/min x 167 ms = 4.2% by hand, matching the measured median's neighbourhood, so the ramp floor's margin over ordinary blinking is real and positive.

4. THE PREDICTED CONSEQUENCE DOES NOT OCCUR. I ran the real code (`npx tsx` on a copy, src/core/score.ts): 0.05124 -> 100, 0.05126 -> 99, 0.06 -> 96, 0.0649 -> 94. The finding's sensitivity algebra is exactly right. But applied to the measured seconds, 107 of 119 score 100 and only 12 (10.1%) cost anything, max 6 points of the 40 cap. All twelve are the final 12 seconds of the clip, where blinkRatePerMin rises to 20-21 and lastBlinkDurationMs reads 400 and 500 ms. That is the ramp charging genuinely elevated closure, not "sitting still and awake costing points". Nothing resembling the hypothesised permanent 96 appears.

5. NO PUBLISHED NUMBER MOVES. The score does not enter docs/eyeblink8-result.txt or docs/drozy-result.txt; DROZY correlates mean PERCLOS itself (analysis/blinklab/drozy.py:191), not the score.

6. THE ASSUMPTION IS STATED, NOT UNSTATED, which is the finding's own claimed kind. SPEC.md:62 "Every ramp floor is priced above this instrument's own documented normal range (test/MANUAL.md items 24, 26 and 40)... A resting person scores 100." src/core/score.ts:15-20 states the same and names the adversarial review that caused it. LEARNING.md:470 narrates it. MANUAL item 48 is the written falsification test, and it already tolerates "exactly 100, or within a point or two of it". MODEL_CARD.md:44-50 and 82-87 disclose that the score is a heuristic never shown to track sleepiness and that the PERCLOS line is instrument-adjusted and not comparable across systems.

RESIDUE, honestly stated and small: score.ts:29-31 cites item 40, whose body text carries an amendment note, rather than citing item 46 which restates the band post-fix; and no exact numeric owner resting figure was re-recorded after #113. That is a one-line cross-reference, a documentation nicety at low severity, not a high-severity live assumption. Per the default, uncertain to my eye only on that residue, and refuted on the substance.

Worktree confirmed clean: `git -C .../audit-fresh status --porcelain` produced no output at the end. No files in the worktree were modified, no npm install was run; the only code execution was `npx tsx` against a copy under the scratchpad.

### C4-03. The weights 40/30/15/15 are an assertion, and the repo's only measurement does not support the ordering

|                             |                     |
| --------------------------- | ------------------- |
| Constraint                  | E1                  |
| Kind                        | unstated-assumption |
| Severity as filed           | high                |
| Verdict as filed            | partial             |
| Verification                | **REFUTED**         |
| Severity after verification | **low**             |

**Evidence.** score.ts:28-29 'the most validated drowsiness proxy carries the most weight'; LEARNING.md:468 'PERCLOS carries forty points because it is the most validated signal in the drowsiness literature ... chosen and defended, not learned'. No citation exists in src/core (grep for wierwille|dinges|citation|'et al.' over src/core/*.ts returns nothing). docs/drozy-result.txt ranks PERCLOS LAST of seven features against KSS (rho -0.001, p raw 0.9990, below its own shuffle median of 0.147) and blink duration FIRST (rho 0.444) — the 40-point signal weakest, a 15-point signal strongest.

**Detail.** Not a violation of honesty: LEARNING.md:468 states plainly the weights are chosen not learned, and MODEL_CARD.md:30 lists the score's external validation as 'nothing external'. Two things are still missing. There is no citation anywhere for the literature claim that carries 40 points, so 'most validated' is unauditable inside the repo. And nothing in score.ts, SPEC.md, MODEL_CARD.md or README notes that Phase 7 has now RUN and did not support the ordering. DROZY is a null result on a sleepiness-truncated sample, so it does not prove PERCLOS worthless — but it means the repo holds zero evidence for the ordering and one measurement inconsistent with it.

**Corrected statement.** MODEL_CARD.md:49 still says the DROZY results are not yet published, one commit after they were, and the 40-point PERCLOS weight carries no bibliographic citation

**Skeptic's reasoning.** REFUTED. The finding's load-bearing claim is factually wrong, and its statistical reading is the exact post-hoc move the repo's pre-registration exists to forbid.

1. "Nothing in ... README notes that Phase 7 has now RUN" is FALSE. README.md:355-433 is a full section headed "Does any of it track how sleepy somebody actually is?" answering "**No, not on the evidence available. This is a null result and it is published...**", printing all seven features with PERCLOS at -0.00, stating "The two most commonly cited drowsiness measures, blink rate and PERCLOS, were flat. Not weak. Effectively zero.", and then at README.md:423 "**What this means for the alertness score on this page.** It remains a documented heuristic that has never been shown to correspond to anyone's actual sleepiness." ROADMAP.md:18 (amendment 8) records the same in writing. LEARNING.md:468 pre-declared it: "Phase 7 exists to embarrass these weights with data."

2. THE ORDERING IS NOT A MEASUREMENT. I re-derived it. Fisher z, n=20, se = 1/sqrt(17) = 0.2425. 95% CI on the top feature (0.444) is [0.002, 0.741]; on PERCLOS (-0.001) it is [-0.443, 0.442]. Even the most extreme pair in the whole table tests at z = 1.394, two-sided p = 0.163, and that is the INDEPENDENT-samples comparison. No pair in that table is distinguishable from any other. The repo's own negative control says the same: the top feature's OBSERVED 0.444 sits below its own shuffle chance max of 0.747. Under the pre-registered verdict that all seven are null, PERCLOS landing last of the four scored features is a 1-in-4 coincidence, p = 0.25.

3. THE FINDING CHERRY-PICKS ONE OF TWO PRE-REGISTERED COLUMNS. docs/drozy-analysis-plan.md fixed a two-part rule: Holm p AND within-subject agreement in >=3 of 5 subjects. On the second half the ordering does not put PERCLOS last: PERCLOS 2/5 TIES blink duration 2/5 (the 15-point feature called "strongest") and BEATS long closures 1/5 (the 30-point feature) and blink rate 1/5. An ordering that reverses depending on which pre-registered column you read is not evidence of an ordering.

4. CATEGORY ERROR. A single feature's marginal Spearman rho against KSS is not its correct weight in a composite penalty. docs/drozy-analysis-plan.md:60-70 names seven features and never scores the composite; the repo nowhere claims weights should equal marginal correlations.

5. Already disclosed three ways: MODEL_CARD.md:15 "Alertness score | 0 to 100 | nothing external | **a heuristic, not a measurement**"; LEARNING.md:468 "chosen and defended, not learned"; README.md:423. This is a simple explainable method being honest about being simple, which the master prompt explicitly prefers.

WHAT SURVIVES, both low, and one of them the finding did not name:
(a) Missing citation, confirmed: grep -rniE "wierwille|dinges" over the whole repo (excluding node_modules/dist) returns nothing. But this is an absent footnote on an uncontroversial fact, attached to a constant already labelled unvalidated in three places, and it changes no published number.
(b) THE REAL DEFECT, which is category (b) not (c): MODEL_CARD.md:49 still reads "its results are not yet published. Until they are, treat the score as an illustration...". They WERE published on 2026-08-10 in commit d8d250c (README.md:355-433, docs/drozy-result.txt). `git log --oneline c8554de..HEAD -- MODEL_CARD.md | wc -l` returns 0, so the model card has not been touched since before publication. A one-paragraph edit, no number affected.

Worktree confirmed clean: `git status --porcelain` in /Users/evannorus/Desktop/blinklab build/blinklab/.claude/worktrees/audit-fresh returned empty output at both the start and the end of this audit. I read only; all computation ran via `node -e` outside the repo. No npm install was run.

### C4-04. A "peak" velocity can be computed from a single finite difference; there is no minimum-samples refusal on the descent

|                             |             |
| --------------------------- | ----------- |
| Constraint                  | E2          |
| Kind                        | maths-wrong |
| Severity as filed           | high        |
| Verdict as filed            | violation   |
| Verification                | **REFUTED** |
| Severity after verification | **low**     |

**Evidence.** src/core/blinkShape.ts:21-23 guards only `samples.length < 2` (the WINDOW), while the peak loop at :53-64 runs over `minIdx - maxIdx` intervals, which may be 1. `npx tsx` probe: analyzeClosing([{0,8},{33.33,2}]) -> A=6.00 V=180.0 A/V=33.3, no null. Corpus: 6 of 174 blink rows across docs/evidence/2026-08-09/repeatability/*/27122013_154548_cam.blinks.csv have A/V within 1 ms of 33.333 ms, and 13 of 174 have a closed phase of exactly one frame (durationMs 33.3).

**Detail.** A maximum over one observation is not a peak, it is that observation. Every other degenerate case in this function refuses (null over guessing), so the omission is a gap in an otherwise complete refusal set, not a policy choice. The fixture confirms how thin the descent is in practice: at the fixture's own 58.8 fps the second blink's fall is carried by ONE slope of 185.8 mm/s between neighbours of 18.2 and 42.8 mm/s.

**Corrected statement.** The finite-difference closing velocity is sample-rate dependent and A/V has an undisclosed floor at one frame interval, and that rate sensitivity is not stated

**Skeptic's reasoning.** REFUTED as maths-wrong/high.

(1) THE MATHS IS NOT WRONG. src/core/blinkShape.ts:3 and LEARNING.md:296 both define the quantity as "the fastest adjacent sample drop on the way down", and the code computes exactly that. A max over a one-element set is that element, which is a correct maximum, not an error. Reproduced probe via npx tsx: analyzeClosing([{0,8},{33.33,2}]) -> A=6.000, V=180.018, A/V=33.330, all three arithmetically right for the stated definition. I also proved the loop can never run zero times: if maxIdx===minIdx then amplitudeMm===0 and :48 refuses, so minIdx-maxIdx>=1 always.

(2) THE REFUSAL SET IS NOT INCOMPLETE. Every other refusal in the function (length<2, minIdx===0, amplitude<=0, dtS<=0, peak<=0) covers a case where the quantity is UNDEFINED. A one-interval descent has a well-defined amplitude and a well-defined positive drop; the value is measured, not guessed, so "null over guessing" does not reach it. LEARNING.md:301 enumerates the refusals exactly as implemented: "too few samples, no fall, or a clock that did not advance". No documented refusal is missing.

(3) BOTH PIECES OF EVIDENCE ARE MISREAD. "13 of 174 have a closed phase of exactly one frame" uses durationMs, the time below threshold (LEARNING.md:284), a different quantity from the descent the peak loop runs over; my independent recount of docs/evidence/2026-08-09/repeatability/*/27122013_154548_cam.blinks.csv gives only 4 of 174 rows at A/V exactly 33.333, and 2 of the claimed 6 (34.027, 34.244) are ordinary multi-interval descents. The fixture example is backwards: the fixture is 59.99 fps not 58.8, and that second blink's descent spans SEVEN intervals, slopes [0.0, 12.4, 18.2, 185.8, 42.8, 11.7, 0.8]. Having neighbours at all proves it is not a single-interval descent; it would pass any minimum-samples refusal.

(4) NO PUBLISHED NUMBER MOVES. 4 of 174 rows (1 per run) are single-interval. Excluding them shifts the published run's mean A/V 51.332 -> 51.760 ms (+0.8%) and mean closing velocity 81.93 -> 81.45 mm/s (-0.6%). DROZY's published figures are Spearman rank correlations on session means with Holm p=0.5275 for A/V (docs/drozy-result.txt); a sub-1% shift in one session mean cannot cross that bar.

(5) SCORE IMPACT IS EXACTLY ZERO AND THE PROPOSED FIX WOULD ADD BIAS. src/core/score.ts:81 clamps rampPoints at 0 below the floor, and LID_SLUGGISH_RAMP_FLOOR_MS=150 (:55) sits under the written note at :50-52 that "MANUAL item 26 documents this instrument's NORMAL blinks at 30 to 150 ms A/V". So 33.3 ms is inside the documented normal band, at its low end, and contributes 0 penalty; it cannot manufacture drowsiness. Refusing single-interval descents would preferentially discard the fastest blinks and raise mean A/V, i.e. make the instrument report sleepier. MODEL_CARD.md:27 already lists blink amplitude and closing velocity as "unvalidated" against "nothing external".

WHAT SURVIVES is a different and milder point, kind assumption-unstated rather than maths-wrong: the finite-difference peak is strongly sample-rate dependent at ANY interval count. Decimating the 60 fps fixture to 30 fps moves the two blinks' velocities 127.3 -> 72.6 and 185.8 -> 114.3 mm/s, and A/V 44.4 -> 82.9 and 24.7 -> 40.2 ms. A/V also has an undisclosed hard floor at one frame interval (corpus minimum is exactly 33.333 in all four runs). Neither is a missing refusal, neither changes a published number, and the code comment's "so frame rate cannot silently rescale it" addresses units, not the estimator's rate sensitivity.

Worktree confirmed clean: git -C "/Users/evannorus/Desktop/blinklab build/blinklab/.claude/worktrees/audit-fresh" status --porcelain returned empty output. No npm install was run; all work used npx tsx against symlinks in the scratchpad.

### C4-05. The shape published for a blink can be the previous blink's shape

|                             |              |
| --------------------------- | ------------ |
| Constraint                  | E2           |
| Kind                        | maths-wrong  |
| Severity as filed           | high         |
| Verdict as filed            | violation    |
| Verification                | **SURVIVED** |
| Severity after verification | **medium**   |

**Evidence.** src/main.ts:1948-1958 builds the analysis window as `nowMs - lastBlinkDurationMs - 400`, but BLINK_REFRACTORY_MS (src/core/constants.ts:99) is only 150 ms, so a legal second blink sits inside the window and analyzeClosing takes the GLOBAL minimum. In docs/evidence/2026-08-09/repeatability/published-run/...blinks.csv, 5 of 43 rows carry the previous row's peakClosingVelocityMmPerS to all 16 digits (re-run-A: 7 of 45). Rows 1710-1713 and 1714-1716 are bit-identical in amplitude, velocity AND ratio.

**Detail.** SPEC.md:92 defines these columns against the row's own startFrame/endFrame, so the number is attributed to a blink that did not produce it; two physically distinct blinks cannot yield bit-identical floats. Reconstructed: the second blink's window opens 333-367 ms before the first blink ended. analysis/blinklab/drozy.py:215-216 takes means of exactly these two columns, so the contamination reaches the published DROZY correlations.

**Corrected statement.** The blink shape window can reach back over the previous blink, so a blink can be published with its predecessor's closing velocity

**Skeptic's reasoning.** SURVIVES as a real maths error, but the severity and two of its three evidence claims do not.

WHAT I CONFIRMED INDEPENDENTLY (maths is wrong, category a). I rebuilt the pipeline in a scratchpad copy, driving the real `blinkStep` (src/core/blink.ts:132) and the real `analyzeClosing` (src/core/blinkShape.ts:18) through the exact window main.ts:1948-1951 builds, on a synthetic 30 fps V-shaped trace where I know the answer by hand. Two blinks whose reopen times are 400 ms apart, i.e. well outside the 150 ms refractory: blink 1 falls 8.0 to 1.5 mm in 66 ms (analytic slope 6.5/66 = 98.485 mm/s), blink 2 falls 8.0 to 0.5 mm in 233 ms (analytic slope 7.5/233 = 32.189 mm/s). Output: `atMs=566.7 vel=98.4848484848482` then `atMs=966.7 vel=98.4848484848482`, bit-identical, while the same function on blink 2's own descent returns `32.18884120171675`. The published velocity for blink 2 is its predecessor's, wrong by 3.06x, and its A/V ratio reads 76 ms instead of 233 ms. A control run with the blinks 1100 ms apart returns the correct 32.189. So the mechanism is live in current code, the refractory does not gate it, and the algebra is: contamination occurs whenever the inter-blink open gap g satisfies 150 - d2 <= g <= 400 - d1, a band that is non-empty for ordinary durations. This is not a simple-over-complex tradeoff the master prompt protects, because the fix is one `Math.max` clipping the window at `lastBlinkEndedAtMs`, and main.ts:1946 states the intent as "the descent that just ended", which a global minimum over a two-blink window does not compute. Not disclosed anywhere: LEARNING.md:516 mentions "the 400 millisecond shape window" only for the threshold pathology, and LEARNING.md:567 records the project fixing the same family of bug (a clip's first shape taken from the previous session's trace) as a defect, not documenting it as a limitation.

WHAT DOES NOT SURVIVE. (1) The lead example is stale. Of the 5 duplicate pairs in the published CSV, four have reopen-to-reopen gaps of 100, 100, 133.3 and 133.3 ms, below BLINK_REFRACTORY_MS = 150, and the refractory landed in 5e7af7e (#190) AFTER the evidence commit 8640bfd (#180). The finding's showcase pair, frames 1710-1713 then 1714-1716 at a 100 ms gap, is not "a legal second blink" today; it is not a second blink at all. Only one pair, 4530-4533 then 4534-4546 at a 433.3 ms gap, would still be produced. So the rate is 1 of 43, not 5 of 43. (2) The DROZY consequence is asserted, not measured. No DROZY CSV exists in the repository by design (README.md:367, "No frame of it is in this repository"), so drozy.py:215-216 cannot be re-run. Measuring the effect on the one clip that does exist: dropping all five contaminated rows moves mean closing velocity 81.93 to 81.04 (1.11%) and mean A/V 51.33 to 52.17 (1.60%), and post-refractory only a fifth of that survives. The published DROZY table (README.md:379-386) is a null result where the strongest observed r is 0.44 against a shuffled control reaching 0.75; a sub-1% shift in a per-session mean cannot move it. MODEL_CARD.md:27 already marks amplitude and closing velocity as validated against "nothing external, unvalidated".

WHY MEDIUM, NOT HIGH. The per-row error is large (3x) and lands in the one export whose stated purpose is frame-level comparison against human annotation (SPEC.md:92-95), and it feeds the score's "sluggish lids" contribution worth 15 of 100 points (src/core/score.ts:150-162, via lastBlinkAmplitudeMm / lastBlinkPeakVelocityMmPerS). But it affects a few percent of blinks under current code and every published number it touches moves by about 1% or less, against a result that is null either way.

### C4-06. At 30 fps the measured peak is 22-38 per cent below the true peak, and the bias itself depends on blink speed, compressing the drowsiness contrast by ~58 per cent

|                             |                     |
| --------------------------- | ------------------- |
| Constraint                  | E2                  |
| Kind                        | unstated-assumption |
| Severity as filed           | high                |
| Verdict as filed            | violation           |
| Verification                | **REFUTED**         |
| Severity after verification | **low**             |

**Evidence.** Monte Carlo, 5000 trials per cell, random sampling phase, min-jerk and half-cosine closing profiles, A=4.0 mm (corpus median): at 30 fps with T=75 ms the closing phase gets 2.26 samples and measured/true peak = 0.778 mean, sd 0.085, p5 0.622, p95 0.875. At T=50 ms: mean 0.617, p5 0.427. Contrast run: true 2.00x peak-velocity difference between a 50 ms and a 100 ms closing phase reads as 1.42x measured; true 2.00x A/V difference reads as 1.38x.

**Detail.** The finite difference over 33.3 ms averages the velocity, so it under-reads the peak, and it under-reads a FAST blink more than a slow one. That systematically shrinks exactly the alert-versus-tired contrast the ratio was chosen to detect. README.md:378-385 publishes the DROZY closing-velocity (-0.44) and A/V (+0.36) nulls with no mention that the estimator attenuates the effect it was testing for; the analysed sessions are the ones just above the 25 fps gate (docs/drozy-analysis-plan.md:27-29). Magnitudes are model-based, not measured.

**Corrected statement.** The finite-difference peak-velocity bias is real (22-38 per cent at 30 fps) but monotone, so it moves the published Spearman correlations by about 0.04; only its magnitude is undocumented

**Skeptic's reasoning.** The physics is right, the consequence is wrong. I reproduced the Monte Carlo independently by porting analyzeClosing (src/core/blinkShape.ts:52-63) into my own script: min-jerk, A=4.0 mm, 30 fps, T=75 ms gives measured/true peak mean 0.778, sd 0.084, p5 0.622, p95 0.875, and T=50 ms gives 0.613, matching the finding's 0.778/0.085/0.622/0.875 and 0.617. A true 2.00x contrast does read as 1.42x. So the attenuation is real and correctly computed.

But it does not touch the published numbers, because every DROZY figure at README.md:378-385 is a Spearman rank correlation on session means (analysis/blinklab/stats.py:44 spearman, analysis/blinklab/drozy.py:232 _mean_or_none), and Spearman sees only ranks. I verified the estimator is strictly monotone decreasing in closing duration T over 40-260 ms at fixed amplitude (20,000 random phases per point), so the deterministic part of the bias cannot reorder sessions at all. Simulating 20 sessions x 30 blinks over 60 runs, the mean change in rho was +0.036 from the deterministic attenuation and +0.050 including per-blink sampling-phase noise. Not 58 per cent.

Measured against the pre-registered rule: calibrating the repo's own permutation null on an n=20 KSS proxy (mean 4.6, range 2 to 8) reproduces the published raw p exactly (|rho| >= 0.446 for p=0.05; published closing velocity is 0.443 at p=0.0490) and gives |rho| >= 0.589 for Holm significance across m=7. Removing the bias moves 0.443 to roughly 0.48, still 0.11 short of the bar and still deep inside the shuffled-control ceiling of 0.743 (docs/drozy-result.txt:32). The second bar, within-subject direction agreement, is also rank-based and also unaffected. The bias is conservative in direction: it shrinks toward the null that was already published and cannot manufacture a positive.

The assumption is also not unstated. blinkShape.ts:3-4 and LEARNING.md:296 both define the quantity operationally as "the fastest adjacent-sample drop", MODEL_CARD.md:27 lists closing velocity as validated against "nothing external" with result "unvalidated", and src/core/constants.ts:120-123 gives the written reason for the 25 fps gate in exactly these temporal-resolution terms ("below 25 fps it may fall entirely between frames"). No absolute mm/s magnitude is published anywhere in the repo, so the 22-38 per cent under-read has no published value to corrupt. This is the simple explainable estimator the master prompt asks for, honestly named and honestly labelled unvalidated.

Two smaller inaccuracies in the finding: 75 ms at 30 fps is 2.25 intervals, not "2.26 samples"; and calling 30 fps "just above the 25 fps gate" is rhetorical, since 30 fps is the ordinary webcam rate the whole instrument targets and the same rate as Eyeblink8, not a DROZY-specific hazard.

What survives is small: the magnitude of the discretization bias and its dependence on blink speed is nowhere written down. That is a one-line documentation gap in MODEL_CARD, worth a low, not a high. Worktree confirmed clean: git -C "/Users/evannorus/Desktop/blinklab build/blinklab/.claude/worktrees/audit-fresh" status --porcelain returned empty.

### C4-07. "Frame rate cannot silently rescale it" is false: the same blink reads 33 per cent faster at 60 fps than at 25 fps

|                             |                |
| --------------------------- | -------------- |
| Constraint                  | E2             |
| Kind                        | claim-mismatch |
| Severity as filed           | high           |
| Verdict as filed            | violation      |
| Verification                | **REFUTED**    |
| Severity after verification | **low**        |

**Evidence.** src/core/blinkShape.ts:3-4 and LEARNING.md:296 both claim the mm-per-second unit stops the frame rate rescaling the value. Simulation of ONE physical blink (A=4.0 mm, T=75 ms, true peak 100.0 mm/s): 25 fps -> 70.6 mm/s, 30 fps -> 77.8, 60 fps -> 93.6, 120 fps -> 98.4. A/V for the same blink: 57.9 / 52.1 / 42.8 / 40.7 ms.

**Detail.** The per-second unit removes the trivial per-frame scaling, which is what the comment probably meant, but a reader takes it as frame-rate invariance of the number, and the number moves 33 per cent across ordinary webcam rates. Two sessions on two cameras are not comparable on this metric, and nothing says so.

**Corrected statement.** Closing velocity is only comparable within one frame rate, and unlike PERCLOS the model card never says so

**Skeptic's reasoning.** The arithmetic reproduces, the accusation does not. I re-derived it independently with a minimum-jerk descent (A=4.0 mm, T=75 ms, peak = 1.875*A/T = 100.0 mm/s exactly) fed through the real `analyzeClosing` from src/core/blinkShape.ts, averaged over 200 sampling phases: 25 fps -> 70.7, 30 -> 77.8, 60 -> 93.7, 120 -> 98.4 mm/s; A/V 57.9 / 52.1 / 42.7 / 40.7 ms. Matches the finding to one decimal. But three things refute it.

(1) THE CLAIM IS TRUE UNDER ITS OWN TERMS. "Rescale" means the mm-per-FRAME trap: the identical sampled data reported per frame changes by an exact factor of fps, pure reporting convention, no physics. Per-second kills that. What is left is discretisation bias, a different animal, and demonstrably not a rescale: 2.4x the frame rate (25->60) moves the number 1.33x, and it converges on the true 100.0 mm/s (240 fps -> 99.6, 1000 fps -> 100.0) rather than scaling without bound. A rescale would have given 2.4x. The finding calls a bounded, converging bias a "rescale" and then reports that the sentence denying a rescale is "false".

(2) THE SAME SENTENCE DISCLOSES IT. src/core/blinkShape.ts:2-3 and LEARNING.md:296 both define the quantity operationally in the clause immediately before the disputed one: "the fastest ADJACENT-SAMPLE drop on that descent". The sample grid is written into the definition. That is the master prompt's simple-explainable method with its own limitation on the face of it, not a hidden assumption. The 25 fps floor (src/core/constants.ts:120-123, MIN_BLINK_FPS = 25, with its written reason) also bounds the exposure, so 25 vs 60 is the practical worst case, not 15 vs 120.

(3) IT CHANGES NO PUBLISHED NUMBER, AND CANNOT. Closing velocity appears in exactly one published result, docs/drozy-result.txt ("closing velocity, mm/s 20 -0.443 ... suggestive and unconfirmed"). Every one of those 20 sessions is at 30 fps: docs/drozy-analysis-plan.md:25-29 fixes the exclusion as exactly DROZY's 16 fifteen-fps recordings, 36 - 16 = 20, and the Eyeblink8 evidence run shows the same stepped mode at a clip's native rate (docs/evidence/2026-08-09/repeatability/published-run/*.blinks.csv header: `# measurement_mode: stepped`, `# measured_fps: 30.00`). Frame rate is CONSTANT across the whole comparison, so the bias is one identical multiplicative factor (~0.78) on every session. And the statistic is Spearman (analysis/tools/analyse_drozy.py:193), rank-based, invariant to any monotone transform. Even a varying factor would have to break the ranking to matter, and a constant one provably cannot move rho at all. Eyeblink8's F1/precision/recall never touch velocity. The Chrome/Safari repeatability check is 59.99 vs 60.00 (README.md:445), a 0.02 per cent difference.

Also checked and rejected as a mitigation-or-aggravation: no smoothing sits in front of this. src/main.ts:1669-1672 feeds raw per-frame mean aperture, so my model matches the pipeline exactly, no filter hiding or worsening the effect.

WHAT ACTUALLY SURVIVES, and it is small. MODEL_CARD.md:87 goes out of its way to say the PERCLOS figure "is not comparable to a PERCLOS figure from another system", and no equivalent sentence exists for closing velocity, even though the same reasoning applies to recordings at different frame rates. That is a category (c) gap, an assumption worth stating and not stated, not category (b). It is already half-covered: MODEL_CARD.md:27 lists "Blink duration, amplitude, closing velocity | ms, mm, mm/s | nothing external | unvalidated". A one-line addition to MODEL_CARD would close it. One incidental observation, not the finding: phase alignment alone spreads the same blink 59.8 to 87.6 mm/s at a fixed 30 fps, a wider within-session spread than the cross-fps bias, which is averaged out by drozy.py:232 taking the session mean.

git -C "/Users/evannorus/Desktop/blinklab build/blinklab/.claude/worktrees/audit-fresh" status --porcelain returned empty. The worktree is clean; all work was done in a scratchpad script importing the worktree read-only.

### C4-08. The 11.7 mm iris is a population mean and the per-person error it causes is stated nowhere

|                             |                     |
| --------------------------- | ------------------- |
| Constraint                  | E3                  |
| Kind                        | unstated-assumption |
| Severity as filed           | high                |
| Verdict as filed            | violation           |
| Verification                | **REFUTED**         |
| Severity after verification | **low**             |

**Evidence.** src/core/constants.ts:10-12 fixes IRIS_DIAMETER_MM = 11.7; src/core/aperture.ts:84 returns openingPx * (11.7 / rulerPx). Algebra: reported/true = 11.7 / D_true, so D_true = 12.5 mm gives 11.7/12.5 = 0.936, every millimetre reading 6.4% LOW (a genuine 7.00 mm aperture prints 6.55 mm); D_true = 10.9 mm gives +7.3%. MODEL_CARD.md:60-95 'Where it fails' names frame rate, missed blinks, double counts, PERCLOS, lenses and thresholds, and says nothing about iris size.

**Detail.** Working from memory of white-to-white / HVID surveys (Ruefer, Schroeder and Erb, Cornea 2005, Orbscan II) the population mean is about 11.71 mm with SD near 0.42 mm, so plus or minus one SD is about 3.6% and the 95% band about 7% on every millimetre this instrument prints. MODEL_CARD.md:26 honestly says the aperture is 'not validated against a physical measurement', which is a statement about validation, not about a known systematic per-person bias of that size, and the failure list never mentions it.

**Corrected statement.** MODEL_CARD's failure list could restate the iris-size spread that LEARNING.md:224 already quantifies, for the unvalidated absolute mm columns only

**Skeptic's reasoning.** The algebra is correct (reported/true = 11.7/D_true) but the consequence claim fails on two counts.

(1) NO PUBLISHED NUMBER CHANGES, proven by execution. IRIS_DIAMETER_MM has exactly one production use, src/core/aperture.ts:84, so a wrong iris is one multiplicative factor k on the whole mm feed. Every downstream decision is a ratio against the person's own baseline computed from that same feed, so k cancels exactly: baseline.ts:88 personalThresholdMm = baselineMm * 0.5; blink.ts:59,62 apertureMm < thresholdMm with hysteresis as a fraction of the threshold; perclos.ts:76 apertureMm < PERCLOS_CLOSED_FRACTION * baselineMm; longClosure.ts:38 EYES_SHUT_FRACTION * baselineMm; score.ts:158 amplitudeMm / velocityMmPerS, mm over mm/s, dimensionally ms. I ran the real core modules read-only over a 300 s / 9000-frame trace scaled by the finding's own two people. D_true 11.7 (k=1.0000), 12.5 (k=0.9360) and 10.9 (k=1.0734) all give blinks=74, longClosures=2, PERCLOS=0.008333, and the blink event TIMES are identical, not merely the counts, including the 900 frames on the fixed 4 mm fallback during the 30 s learning window. The alertness score is invariant even at D_true 9 and 14 mm (k=1.30 and 0.836): score 32, identical four contributions. So recall 87.7 per cent, precision 83.3 per cent, F1 85.4 per cent, PERCLOS, long closures and the score are all untouched.

(2) THE ASSUMPTION IS STATED AND ITS MAGNITUDE QUANTIFIED. LEARNING.md:224 says the visible iris is "within a few percent of 11.7 millimetres across in nearly all adults", which is the finding's own plus or minus 3.6 per cent at one SD, in writing. Also src/core/constants.ts:10-12 ("close to 11.7 mm across in almost every adult") and LEARNING.md:168. The finding's own literature recall (population mean about 11.71 mm) confirms the constant is the population mean, the correct single-value estimator, and the master prompt prefers the simple explainable method.

Two further weaknesses. The finding inflates the error by illustrating with D_true 12.5 and 10.9, both about two SD from the mean, presenting 6.4 to 7.3 per cent as the per-person figure when one SD is 3.6 per cent. And it dismisses MODEL_CARD.md:26 "not validated against a physical measurement" as being about validation rather than bias, but an unknown multiplicative scale offset on a physical quantity is precisely what that disclaimer covers; MODEL_CARD.md:27 additionally marks amplitude and closing velocity "unvalidated".

What genuinely survives is small: docs/evidence/2026-08-09/tables-current-run/*.csv publish absolute apertureMmAtThatSecond and baselineMmAtThatSecond per subject, and those scale with each person's own iris. A one-line addition to MODEL_CARD.md "Where it fails" restating what LEARNING.md:224 already says would be an improvement. That is a low, not a high: a documentation placement gap on values already labelled unvalidated, with zero measurable effect on any published result.

Worktree confirmed clean, git status --porcelain empty. No npm install run; only npx tsx against read-only imports, with scratch scripts written under the scratchpad.

### C4-09. The pose gate admits a 10 to 13 per cent yaw inflation of every millimetre reading

|                   |                     |
| ----------------- | ------------------- |
| Constraint        | E3                  |
| Kind              | unstated-assumption |
| Severity as filed | high                |
| Verdict as filed  | violation           |
| Verification      | **UNTESTED**        |

**Evidence.** VERIFIED. npx tsx on a copy, synthetic face at distance 500 mm, true aperture 10.000 mm: yaw 10 deg -> 10.2653 (+2.65%), yaw 20 -> 10.8710 (+8.71%), yaw 25 -> 11.3275 (+13.27%) for the right eye; the two-eye mean at yaw 25 is 11.0337, which is 1/cos(25 deg) = 1.10338 to five digits. Pitch 20 deg gives 9.3996 (-6.00%). src/core/validityGate.ts:30 rejects only when Math.abs(value) > limit, and src/core/constants.ts:163-167 sets maxYawDeg 25, maxPitchDeg 20, so exactly 25 and exactly 20 are admitted as valid.

**Detail.** The iris foreshortens as cos(yaw) while the vertical lid chords do not, so the ruler shrinks and the opening does not, and the earlier chunk's 11.33 mm for a true 10 mm at 25 degrees reproduces exactly. The gate is loose enough to admit a mean-of-both-eyes band from -6.0% to +10.3% and a per-eye readout band to +13.3%; the flat face assumption is named only once in the whole repository, at test/MANUAL.md:22 and only about close range, never about head angle, and MODEL_CARD.md says nothing.

### C4-10. The displayed eye aspect ratio falls into the exact anisotropy trap aperture.ts warns about

|                             |                |
| --------------------------- | -------------- |
| Constraint                  | E3             |
| Kind                        | claim-mismatch |
| Severity as filed           | high           |
| Verdict as filed            | violation      |
| Verification                | **SURVIVED**   |
| Severity after verification | **medium**     |

**Evidence.** src/main.ts:1621-1624 passes the raw normalised landmark array to eyeLandmarksFromFace then eyeAspectRatio; src/core/ear.ts:24-33 never converts to pixels, unlike src/core/aperture.ts:15-21. Measured on the repository's own 300 recorded frames at 1280x720: median EAR as the app computes it 0.4834, median EAR in true pixel geometry 0.2788, ratio 1.734 against W/H = 1.778. src/core/ear.ts:5 says 'near 0.3 for an open eye' and LEARNING.md:199 says 'roughly 0.3'; test/MANUAL.md:22 records the owner observing 'EAR 0.53 to 0.60' live without flagging it.

**Detail.** The pixel-space value 0.2788 matches the literature and the comment; the number actually printed on the page and drawn in the sparkline is about 1.73 times that, and the factor is the frame aspect ratio, which is precisely what src/core/aperture.ts:10-13 says would 'skew every millimetre by that factor, silently'. The maths of the ratio is right and the EAR is display-only (blink detection runs on millimetres), so nothing downstream is corrupted, but the number shown is not the quantity the code comment, LEARNING.md and Soukupova and Cech define; src/core/ear.ts:25 also names the variable widthPx while it holds a normalised fraction, against SPEC.md:113.

**Corrected statement.** The displayed EAR is computed in anisotropic normalised units, so it reads about 1.74x the literature value and drifts up to 27% with head roll, contradicting SPEC.md's roll-invariance claim

**Skeptic's reasoning.** I re-derived it with my own Python (no auditor script): `python3 .../ear_check.py` over the repo's own 300-frame fixture at the camera's requested 1280x720 (src/io/camera.ts:13-14) gives app-formula median right EAR 0.4834 vs pixel-geometry 0.2787, mean-of-eyes 0.4966 vs 0.2856, per-frame ratio median 1.740; a third check, `iso_check.py`, shows the iris ring spans 1.638x more normalised y than x (isotropic would be 1.00), so MediaPipe normalisation really is x/W, y/H and ear.ts:25-33 never divides it out while aperture.ts:15-21 does. The consequence is bigger than a constant relabel: `roll_check.py` rotates the real eye landmarks in pixel space about their own centre and the displayed EAR moves -13.0% to -27.1% at the pose gate's own 25 degree roll limit (POSE_LIMITS.maxRollDeg), while the pixel EAR is invariant to five decimals, which directly falsifies SPEC.md:137 "Aperture and EAR ... invariant under head roll by construction ... proven at 0, 15 and 30 degrees", since test/core/tiltInvariance.test.ts:18-19 runs at a square 1000x1000 where the anisotropy cannot appear. Nothing discloses it and three written claims contradict it: aperture.ts:10-13 and LEARNING.md:225 state every measurement converts to pixels first, ear.ts:5 and LEARNING.md:199 cite the literature ~0.3 open value while the owner's own frames display ~0.50, and test/MANUAL.md:19's stated band 0.25 to 0.45 is violated by 239 of 300 fixture frames under the app formula versus 0 above the band under pixel geometry; git log on ear.ts is one commit with no reason, and prior finding C1-31 only calls the tilt test square-only, wrongly asserting the app path passes canvas.width/height. But no published number moves: EAR is absent from FeatureRecord (src/core/featureRecord.ts:13-35), the CSV, the score, and every DROZY/EyeBlink8/evidence pipeline, which all use pixel-converted apertureMm (docs/evidence/2026-08-09/scripts/replay/trace.py:74-80), and the constant factor cancels in the blink and wink separation the fixture tests actually assert (min < 0.5*median, 0<ear<1), with no sparkline clipping (0 of 300 frames above SPARK_EAR_MAX 0.6). So it is a real, undisclosed defect in a display-only number plus a false invariance claim in SPEC.md, which is medium, not high.

### C4-11. MIN_BLINK_FPS = 25: the written reason is arithmetically false; the number is defensible from a derivation that is never written down

|                             |                |
| --------------------------- | -------------- |
| Constraint                  | E4             |
| Kind                        | claim-mismatch |
| Severity as filed           | high           |
| Verdict as filed            | violation      |
| Verification                | **REFUTED**    |
| Severity after verification | **low**        |

**Evidence.** src/core/constants.ts:120-123 "A fast blink's closed phase can be under 100 ms; below 25 fps it may fall entirely between frames". A closure of length T falls entirely between two samples only if T < 1/f, i.e. 100 ms needs f < 10 fps. At 24 fps a 100 ms closure gets 2 or 3 samples (100/41.7 = 2.4). docs/drozy-analysis-plan.md:26-27 states it correctly for the case it applies to ("at that rate" = 15 fps, 100/66.7 = 1.5).

**Detail.** The gate itself is sound and 25 lands on an exact first-principles boundary, but not the one claimed: at least two samples inside the shortest natural blink documented by the project (80 ms, test/MANUAL.md:28 item 24) requires f >= 2/0.080 = 25 fps exactly, and two closed samples is the minimum for the duration (reopen minus first-closed) not to be halved. Nothing in constants.ts, SPEC.md, ROADMAP.md or the DROZY plan makes that derivation. This matters because the stated reason excludes 16 of 36 DROZY sessions and, being wrong, cannot be argued with.

**Corrected statement.** MIN_BLINK_FPS = 25 is correctly justified in four places; the constants.ts restatement is the loosest wording of the same rule

**Skeptic's reasoning.** I re-derived the sampling arithmetic myself (own script, /private/tmp/.../scratchpad/skeptic-e4/derive.py, 200k random phases per case): a 100 ms closure gets min 2 / max 3 samples at 24 fps and is only ever missed entirely below 10.00 fps, so the auditor's narrow point is arithmetically right — but the comment at src/core/constants.ts:120-122 says a closed phase "can be under 100 ms" and "MAY fall entirely between frames", which is existential, not universal, and my same script shows a 30-35 ms closed phase at 24 fps is missed entirely 28% / 16% of the time, so the hedged sentence is not false as written. Decisively, the "two frames" derivation the auditor presents as the alternative is not the auditor's: `grep -rn "100 ms blink|one and a half|fewer than two"` finds it already stated, correctly, in four places — src/core/fpsGate.ts:50, the SHIPPED refusal string, "At that rate a 100 ms blink spans fewer than two frames and timing it would be a guess"; MODEL_CARD.md:63 "At 15 fps a 100 ms blink spans one and a half frames, so refusing is correct"; the pre-registration docs/drozy-analysis-plan.md:28; and analysis/blinklab/drozy.py:34-37 — and 100/(1000/15) = 1.50 exactly, so the justification that actually carries the published DROZY exclusion is correct, while constants.ts is only its loosest restatement. Question 1, no published number moves: my script confirms 2 samples inside an 80 ms blink (test/MANUAL.md item 24, "typically 80 to 200 ms") needs f >= 25.0 exactly (24.9 fps gives min 1), so both derivations land on 25, `measurableAtFps` stays `fps >= 25` (src/core/fpsGate.ts:8), and the 16-of-36 exclusion, the KSS 6.38 vs 4.60 gap, and every downstream figure are untouched — the auditor concedes "the gate is sound and 25 lands on an exact first-principles boundary". Question 3, the consequence the finding calls load-bearing is disclosed three times over, including above the analysis's own correlations: docs/drozy-analysis-plan.md:35-48 ("The exclusion is not random with respect to the label... the excluded 16 average KSS 6.38 against 4.60... every KSS 9 in the dataset sits in the excluded group"), STATE.md:37-47, and MODEL_CARD.md:62-67. What survives is a copy-edit on one source comment, which could simply borrow the correct wording used elsewhere in the same repo; the worktree is clean (`git status --porcelain` empty) and I ran nothing of the auditor's.

### C4-12. A bare `400` in main.ts sets the shape-analysis lead-in and moves published amplitude and A/V numbers

|                   |                |
| ----------------- | -------------- |
| Constraint        | E4             |
| Kind              | claim-mismatch |
| Severity as filed | high           |
| Verdict as filed  | violation      |
| Verification      | **UNTESTED**   |

**Evidence.** src/main.ts:1949-1951 `const closureStartMs = nowMs - (blinkState.lastBlinkDurationMs ?? 0) - 400;`. No name, no unit in a name, no origin beyond "a little lead in", no test (the project's own prior audit lists "io/main thresholds (8 of them) | N | N | N"). Re-ran analyzeClosing over the repo's recorded fixture: blink at 114437 ms, amplitude 5.64 mm and A/V 44.3 ms at a 400 ms lead-in versus 6.03 mm and 47.4 ms at 1200 ms; blink at 115354 ms, 24.7 ms versus 43.0 ms A/V.

**Detail.** The amplitudeMm, peakClosingVelocityMmPerS and amplitudeOverVelocityMs columns of every exported blinks.csv, and the LID_SLUGGISH score penalty that reads A/V against a 150 ms floor, all depend on this literal. It breaks three stated standards at once: "refuse magic", "units in the name", and "every number displayed is traceable to a tested pure function" — analyzeClosing is pure and tested, the window handed to it is neither.

### C4-13. The negative control walks the identical 1000 permutations the p-value already counted

|                             |                |
| --------------------------- | -------------- |
| Constraint                  | E6             |
| Kind                        | claim-mismatch |
| Severity as filed           | high           |
| Verdict as filed            | violation      |
| Verification                | **REFUTED**    |
| Severity after verification | **low**        |

**Evidence.** analysis/tools/analyse_drozy.py:37-38 sets SHUFFLES=1000 and SHUFFLE_SEED=20260809; :194 calls permutation_p(xs, ys, iterations=SHUFFLES, seed=SHUFFLE_SEED); :109-114 in _shuffled_null does `rng = random.Random(SHUFFLE_SEED)` and takes 1000 shuffles of the same ys. I replayed both streams on a 20-point tied KSS vector: `identical sequence of |rho| values: True`, p 0.0599 and 'chance max' 0.8612 from one and the same 1000 draws.

**Detail.** docs/drozy-analysis-plan.md:89-92 calls this "the check that catches an analysis pipeline that would find a signal in noise" and says the labels are shuffled "and the whole analysis re-run". What runs is the same draws re-summarised, with no Holm, no within-subject check and no verdict, so it cannot catch anything the p-value did not already encode. ROADMAP.md:111 records the narrower delivery ("the strongest chance correlation is printed beside the observed one") but nothing records the seed reuse.

**Corrected statement.** The negative control reuses the permutation p-value's 1000 draws, which is correct by design; only the plan's phrase "the whole analysis re-run" overstates what runs

**Skeptic's reasoning.** The stream claim is TRUE but the inference is not. I instrumented the real `permutation_p` (swapping a logging `random.Random` subclass into `analysis/blinklab/stats.py`) and transcribed `_shuffled_null` separately: `streams identical: True`, 1000/1000 permutations equal, and recomputing p from the control's own draws reproduces `permutation_p` exactly (0.1139 == 0.1139, `matches permutation_p: True`). That is correct by design, not a bug: a permutation p-value IS a summary of a shuffled-label null, and the control prints two more summaries (max, median) of the same distribution, so the table is exactly the distribution the p was measured against; an independent seed would print a distribution the p did NOT come from. Question (1), does a published number move: no. Over 500 independent seeds on a 20-point tied KSS vector the chance max ran 0.595 to 0.909 (median 0.710) and the null median 0.141 to 0.176, bracketing the published 0.679-0.790 and 0.147-0.161; `seeds where chance max < 0.444: 0 of 500`, so README.md:390-391 ("strongest correlation seen was 0.44, shuffling produces up to 0.75 by chance alone") and docs/drozy-result.txt:29-37 are structural properties of n=20 with 1000 draws, not seed artefacts. Question (3), disclosure: ROADMAP.md:111 is the delivery contract and states precisely what runs, "the ratings are shuffled 1000 times with a fixed seed and the strongest chance correlation is printed beside the observed one" (no Holm, no within-subject, no verdict claimed), amendment 8 repeats it, and the control's untested-ness is ALREADY a published audit finding, C1-32, verified at medium. The control is also not degenerate: had the observed rho been real, the shared stream would pin p_raw at 1/1001 and put observed above chance max, so it can still express a signal. I did run the missing full-pipeline null (400 trials x 7 features, Holm + within-subject + verdict on shuffled labels): "suggestive and unconfirmed" fires in 97.5% of pure-noise runs because 3-of-5 is a coin flip, which is real but is a different finding about the within-subject bar, and `grep -rn suggestive README.md MODEL_CARD.md STATE.md ROADMAP.md` returns nothing, so no published claim rests on it and the headline "Nothing survives it" is untouched. Only residue: docs/drozy-analysis-plan.md:89-92's phrase "the whole analysis re-run" is looser prose than what the roadmap row and the code deliver. Worktree left clean (`git status --porcelain` empty); all my scripts are in scratchpad/skeptic-e6.

### C4-14. Blink rate is recomputed by the analysis, and the plan says no new measurement is invented

|                             |                |
| --------------------------- | -------------- |
| Constraint                  | E6             |
| Kind                        | claim-mismatch |
| Severity as filed           | high           |
| Verdict as filed            | violation      |
| Verification                | **REFUTED**    |
| Severity after verification | **low**        |

**Evidence.** docs/drozy-analysis-plan.md:60-61: "Seven, all of them already computed by the app and exported per second. No new measurement is invented for this analysis." analysis/blinklab/drozy.py:221-222: `window_seconds = len(rows)` then `rate = (blink_count / window_seconds) * 60`, with the comment "rather than from the app's rolling estimate". The exported `blinkRatePerMin` column (analysis/blinklab/loader.py:26) is never read. The four shape features likewise come from *.blinks.csv (drozy.py:204-216), not from the per-second export.

**Detail.** Feature 1 is a different quantity from the one the app exports, and four more come from a different file than the plan describes. The reason is written in a code comment but in no plan, ADR, or ROADMAP amendment. Mitigating: `git log` shows the plan and the code landed in the same commit c8554de (2026-08-09) and the result only in d8d250c (2026-08-10), so this is a plan/code mismatch present from the start, not a post-hoc redefinition.

**Corrected statement.** The plan's phrase "exported per second" is loose prose: the rate and four shape features are reduced from the app's blink event log, with a written reason and no effect on any published number

**Skeptic's reasoning.** (d) is factually wrong: on branch feat/drozy-analysis the plan landed BEFORE the code — `git log --format="%h %ad %s" feat/drozy-analysis` gives 4637497 at 23:32:57 (plan) then fb27e21 at 23:37:38 (code), and `git diff 4637497 fb27e21 -- docs/drozy-analysis-plan.md` is EMPTY, so the code commit never touched the plan; c8554de is just GitHub's squash of that branch, `git show c8554de --name-only` contains no result file, and docs/drozy-result.txt arrives the next day in d8d250c, exactly as the plan promised ("The commit that adds this file contains no results"). (b) I re-implemented the app estimator myself from src/core/blinkRate.ts (60000 ms window, 15000 ms minimum observation) and reproduced the app's own exported blinkRatePerMin column on docs/evidence/2026-08-09/repeatability/ to max|diff| = 0.000000 across all four runs; the two estimators differ by only 5.3–6.9% (published-run: app rolling mean 14.946 bpm vs count/window 15.732 bpm), and in 2000 simulated sets of 20 two-minute Poisson sessions they rank-correlate ~0.96 with |rho_analysis − rho_app| mean 0.044, p95 0.111, max 0.199. (c) Nothing published can move: blink rate is rho = −0.070, p raw 0.7612, Holm 1.0000, verdict "no", and reaching TRACKS KSS needs raw p < 0.05/7 = 0.00714, i.e. |rho| ≈ 0.58, a shift of 0.51 that is 2.5x the worst case even in a degenerate stress run where all 20 sessions sit between 10 and 14 bpm (max shift 0.455 in 1 of 2000 trials). (a) A written reason exists in the very code the finding quotes: drozy.py:195-198 (the per-second file repeats the LAST blink's numbers — I measured the per-second means running +3.9%, +4.1%, +1.5% above the event-log means) and drozy.py:218-220 ("so every session is measured the same way over the same span"), which the app column cannot deliver because it is null for the first 15 s of every window and uses a growing denominator for the next 45 s (15 null rows per file, confirmed); amplitudeOverVelocityMs is not a per-second column at all, so no reading of the plan puts it there, while perclos and long closures do come from the per-second file exactly as described. All seven quantities are app-computed and app-exported — what differs is the session-level reduction, which the plan never specifies for any feature — so what survives is loose prose in one sentence with no measurable consequence. The worktree was confirmed clean at the end and nothing in it was modified.

### C4-15. Nothing in the chain binds a measured directory to a build; the guard proves server==dist, never dist==source

|                   |                     |
| ----------------- | ------------------- |
| Constraint        | E7                  |
| Kind              | unstated-assumption |
| Severity as filed | high                |
| Verdict as filed  | violation           |
| Verification      | **UNTESTED**        |

**Evidence.** tools/bundleGuard.mjs:107 compares built vs served bundle name only. dist/index.html references only /blinklab/assets/index-SyxepCYv.js; dist/models/face_landmarker.task and dist/mediapipe-wasm/* are served unhashed and are named nowhere in the page. docs/eyeblink8-result.txt:36-38 reproduces from "$DATASETS/eyeblink8-measured-refractory", a path outside the repo.

**Detail.** A forgotten `npm run build` leaves a stale dist that the server serves, so both names agree and the guard passes; swapping the model file or the MediaPipe WASM runtime changes the measurement without changing the bundle hash at all. Downstream, analysis/tools/evaluate_eyeblink8.py runs no guard and never checks that a blink log's `# clip:` header matches the .tag it is paired with, so any directory of CSVs evaluates silently — which is exactly how mixA/mixC were built (docs/evidence/2026-08-09/findings/issue-174-repeatability.md).

### C4-16. The batch runner truncates away the two warnings added to catch a wrong frame interval and an unmeasurable clip

|                   |                     |
| ----------------- | ------------------- |
| Constraint        | E7                  |
| Kind              | unstated-assumption |
| Severity as filed | high                |
| Verdict as filed  | violation           |
| Verification      | **UNTESTED**        |

**Evidence.** tools/measure_corpus.mjs:166 `${summary.slice(0, 62)}`. src/main.ts:835-837 appends ${warning}${refused} after "...Export the CSV, or pick another clip.". The committed log line ends "in 267 s. Che" — cut at 62 characters.

**Detail.** checkStepping (#197) and clipRefusedMessage (#198) exist because DROZY reported "36 measured, 0 failed" while half the set produced no blinks. Both write into the tail of the same <p>, and the corpus runner keeps only the first 62 characters, so in a batch run the two new safety nets are invisible in exactly the place the original failure happened.

### C4-17. The runner's only failure path is an exception, and its main wait cannot throw

|                   |                     |
| ----------------- | ------------------- |
| Constraint        | E7                  |
| Kind              | unstated-assumption |
| Severity as filed | high                |
| Verdict as filed  | violation           |
| Verification      | **UNTESTED**        |

**Evidence.** tools/measure_corpus.mjs:131-138 `waitForFunction(..., { timeout: 0 })`; line 154 `if ((await button.count()) === 0 || (await button.isDisabled())) continue;`; line 114/168 the `failures` counter increments only in the catch block.

**Detail.** A clip that reaches setState({kind:"clipFailed"}) (src/main.ts:790-806, unknown rate or zero frames) never prints a <p> starting with "Measured", so the run blocks forever rather than counting a failure. A clip with no blinks silently produces no .blinks.csv yet still logs a success line, and evaluate_eyeblink8.py then drops it to stderr and continues, pooling over seven clips.

### C4-18. "Identical files, byte for byte" is asserted in five places with no committed evidence and no test

|                             |                |
| --------------------------- | -------------- |
| Constraint                  | E7             |
| Kind                        | claim-mismatch |
| Severity as filed           | high           |
| Verdict as filed            | violation      |
| Verification                | **REFUTED**    |
| Severity after verification | **low**        |

**Evidence.** README.md:32, :80, :464; STATE.md:81-82; docs/eyeblink8-result.txt:42. The only committed repeatability artifacts are docs/evidence/2026-08-09/repeatability/{published-run,re-run-A,re-run-B,re-run-C}; md5 of the four blinks.csv files: 4314e7a…, 2c8f466…, 5cb8369…, 8c2cdc0… — three distinct values.

**Detail.** Those four folders demonstrate the PRE-fix build failing repeatability, which is honest. No post-fix three-run artifact exists in the repo or under datasets/. The claim that the current build repeats is therefore a report of a measurement that is nowhere in the record, and no test asserts it.

**Corrected statement.** The post-fix repeatability checksums live only in PR #189 and the commit message, not in docs/evidence/, and only the blink rows were hashed

**Skeptic's reasoning.** The finding's own escape clause decides it: "If a run happened and was simply not committed, that is a different and much smaller finding." A post-fix run happened and is recorded with checksums. `gh pr view 189 --json body` returns a "Measured, both before and after" table: Before runs 1/2/3 = 43 detections with checksums 1357b0a5.../d706ea76.../9afeb8d5..., After runs 1/2/3 = 54 detections all `719ebe5c...`, plus "Re-verified after rebasing onto four later merges: same checksum again"; the committed commit message `git log -1 --format=%B 6e89eff` states it too. I re-derived that checksum independently rather than re-running the auditor: trying whole-file, rows-only and data-only hashes, `tail -n +7 "/Users/evannorus/Desktop/blinklab build/datasets/eyeblink8-measured-clockfix/27122013_154548_cam.blinks.csv" | md5` = `719ebe5c2a78ff122acc1522fc761d2e`, an exact match to the PR's "After" value, and that file is 61 lines = 54 detection rows, matching the PR's 54. So the claim traces to a surviving artefact on disk today, not to nothing. I also tested the inference "identical rows implies identical file": the six-line headers of all four committed pre-fix runs are byte-identical (`head -6 ... | md5` = 899e191fc6e6859456942a3536d7ca78 for blinks and seconds alike) and carry no wall clock. Every assertion site is honestly scoped to "Measuring ONE clip three times" (README.md:32/:80/:464, STATE.md:81, MODEL_CARD.md:130, docs/eyeblink8-result.txt:42) and never claims the corpus repeats; the finding also miscounts, listing five sites and missing MODEL_CARD.md:130-131. The "no test" half is real but is already a recorded finding in this same audit, docs/audit/appendix-chunk-3-all-findings.md C3-05, marked SURVIVED at medium, whose skeptic note already cites these PR #189 checksums, so E7 duplicates it on a weaker premise. What genuinely remains is small: the three post-fix CSVs were never added to docs/evidence/2026-08-09/, and only the blinks rows were hashed, not seconds.csv, so "identical files" plural is one step past what was recorded. Protected repo untouched: I wrote nothing and `git status --porcelain` in the worktree is empty at the end.

### C4-19. Determinism is bounded, not eliminated: GPU delegate and a run-varying MediaPipe base

|                   |                     |
| ----------------- | ------------------- |
| Constraint        | E7                  |
| Kind              | unstated-assumption |
| Severity as filed | high                |
| Verdict as filed  | partial             |
| Verification      | **UNTESTED**        |

**Evidence.** src/io/landmarker.ts:12 `delegate: "GPU"`. src/main.ts (from 6e89eff) `clipModelClockBaseMs = Math.ceil(performance.now()) + 1`. .github/workflows/ci.yml installs chromium only; playwright.config.ts:47 makes the webkit project local-only; package.json pins "@playwright/test": "^1.62.1" and the WebKit binary version is recorded nowhere.

**Detail.** Eliminated: float accumulation (videoStepper.ts:273 computes target from the index, reason at 255-259) and the wall clock in the exported fps column (main.ts:1544-1546 pushes media time). Bounded: the model clock's gaps are now media-derived, but its absolute base still varies per run. Still open: GPU float results are not bit-reproducible across driver or browser build, so "byte for byte" is a same-machine claim and no document says so.

### C4-20. SPEC.md:62's 'every ramp floor is priced above' is false for one of the three floors, and the test that checks it weakens itself

|                   |                |
| ----------------- | -------------- |
| Constraint        | E1             |
| Kind              | claim-mismatch |
| Severity as filed | medium         |
| Verdict as filed  | violation      |
| Verification      | **UNTESTED**   |

**Evidence.** MANUAL item 26 documents normal A/V as 'somewhere around 30 to 150 ms'; score.ts:55 sets LID_SLUGGISH_RAMP_FLOOR_MS = 150. Margin: zero. Verified against the module: A/V 152 ms -> score 100, A/V 155 ms -> 99. Compare item 24 (top 200 ms) vs floor 250, first point at 256.7 ms; item 40 (top 3%) vs floor 5%, first point at 5.125%. test/core/score.test.ts:121-128, titled 'keeps every floor above the manual's documented normal top', asserts toBeGreaterThan for the first two floors and toBeGreaterThanOrEqual(150) for this one.

**Detail.** score.ts:53 is honest about it ('the ramp starts AT the top of that band'); SPEC.md:62 and the test's own title say 'above'. Consequence: a blink 5 ms outside the documented normal band costs a point, where the other two ramps allow 25% and 71% headroom respectively. Two of three floors comply; the claim of universality does not.

### C4-21. The PERCLOS ceiling of 0.15 has no recorded origin, and the ceiling is what sets sensitivity

|                   |                     |
| ----------------- | ------------------- |
| Constraint        | E1                  |
| Kind              | unstated-assumption |
| Severity as filed | medium              |
| Verdict as filed  | partial             |
| Verification      | **UNTESTED**        |

**Evidence.** score.ts:31 says only 'saturates at fifteen'. Compare the blink duration ceiling, which HAS a checkable reason (score.ts:44-45, '450, short of the 500 ms line where a closure stops being a blink at all'), and the sluggish ceiling, which at least states a rule (score.ts:53, 'double it'). Computed: PERCLOS 15%, 20%, 50% and 100% all return the identical score 60; slope is 4 points per percentage point (40 points over a 0.10 span).

**Detail.** The cap sets the maximum, the ceiling sets the slope, and the slope is what a reader feels. Concrete consequence, computed on the real module: a person with eyes shut CONTINUOUSLY for the whole scored minute scores 45, not 0 (PERCLOS 40 + one long closure event 15, per MANUAL item 41 which fires once per closure, not once per second). The top 85% of PERCLOS's range collapses to one value.

### C4-22. The A/V ratio has a provable hard floor at the frame interval, and that floor underwrites the score's sluggish-lids constant

|                   |                     |
| ----------------- | ------------------- |
| Constraint        | E2                  |
| Kind              | unstated-assumption |
| Severity as filed | medium              |
| Verdict as filed  | violation           |
| Verification      | **UNTESTED**        |

**Evidence.** Theorem: for maxIdx<=i<minIdx, a_i - a_{i+1} <= a_max - a_min = A, so peakV <= A/dt_i and A/V >= min dt. 300,000 random windows through the real analyzeClosing: smallest observed (A/V)/(shortest interval) = 1.000000. Corpus (174 rows, 30.00 fps): A/V min = 33.333 ms = 1000/30 exactly, 0 rows below it. src/core/score.ts:50-56 sets LID_SLUGGISH_RAMP_FLOOR_MS = 150 with the written reason "MANUAL item 26 documents this instrument's NORMAL blinks at 30 to 150 ms A/V" (test/MANUAL.md:30).

**Detail.** The lower edge of that "normal" band is arithmetically the camera's frame interval, not the eyelid, so the constant's stated justification rests on an unstated assumption that the observed band is physiological. Related and worth stating: 0 of 174 corpus rows reach 150 ms, so the sluggish-lids penalty scored zero on every blink in the published corpus run. The algebra is right; only the reading of it is unstated.

### C4-23. The Phase 4 thesis "the shape is where the information is" ships with no sampling caveat anywhere

|                   |                |
| ----------------- | -------------- |
| Constraint        | E2             |
| Kind              | claim-mismatch |
| Severity as filed | medium         |
| Verdict as filed  | violation      |
| Verification      | **UNTESTED**   |

**Evidence.** Greps over MODEL_CARD.md, README.md, LEARNING.md, src/core/constants.ts and SPEC.md for nyquist / aliasing / under-sampl / finite difference / "two or three samples" return nothing about velocity resolution. The only frame-rate writing is MIN_BLINK_FPS (src/core/constants.ts:120-123) and LEARNING.md 4.6, both about whether a blink is SEEN. MODEL_CARD.md:27 marks closing velocity "unvalidated" against anything external, which is about validation, not resolution.

**Detail.** LEARNING.md:295-296 states the thesis and then asserts the extraction "respects its own limits", listing only degenerate-input refusals. The real limit, that the closing phase gets about two to three samples at 30 fps and about 1.2 at 25 fps, is the one limit not listed. A one-paragraph caveat in MODEL_CARD.md and a line in constants.ts would close this without changing any number.

### C4-24. SPEC.md's roll-invariance contract is false for the EAR, and the test that 'proves' it runs on a square frame

|                   |                |
| ----------------- | -------------- |
| Constraint        | E3             |
| Kind              | claim-mismatch |
| Severity as filed | medium         |
| Verdict as filed  | violation      |
| Verification      | **UNTESTED**   |

**Evidence.** SPEC.md:137: 'Aperture and EAR are distances between landmarks ... invariant under head roll by construction ... proven at 0, 15 and 30 degrees in the tilt invariance tests.' test/core/tiltInvariance.test.ts:18-19 and :33-38 run every roll case at 1000x1000, a square frame where the anisotropy is identically zero. Re-projecting the same synthetic faces into 16:9 normalised coordinates and re-running: EAR 0.5926 at roll 0, 0.5410 at 15 (-8.70%), 0.4348 at 30 (-26.63%). apertureMm on the identical widescreen faces stays 10.000000 at all three rolls.

**Detail.** A distance is rotation-invariant only in isotropic units, so the aperture path, which converts to pixels first, is genuinely invariant and the SPEC claim holds for it, while the EAR path is not and the claim does not. ROADMAP.md:12 amendment 4 gives the correct written reason for verifying rather than correcting tilt, and that reason is honoured by aperture.ts and silently broken by ear.ts.

### C4-25. The aspect-ratio guard in apertureMm is a comment, not an assertion any aperture test can see

|                   |                     |
| ----------------- | ------------------- |
| Constraint        | E3                  |
| Kind              | unstated-assumption |
| Severity as filed | medium              |
| Verdict as filed  | violation           |
| Verification      | **UNTESTED**        |

**Evidence.** test/core/aperture.test.ts:11-13 sets W = H = 1000 for every synthetic case; the only non-square test, :76-96, asserts merely 4 < median < 16 on a fixture whose true median is about 7.1 mm. Mutation on a copy, src/core/aperture.ts:20 'y: p.y * frameHeightPx' -> 'y: p.y * frameWidthPx' (a 1.778x inflation): 'npx vitest run test/core/aperture.test.ts test/core/tiltInvariance.test.ts test/core/ear.test.ts test/core/syntheticFace.test.ts' gave '4 passed (4), Tests 24 passed (24)'. The full suite catches it only incidentally, in blink.test.ts and blinkShape.test.ts, because 7.1 x 1.778 = 12.6 mm clears the fixed 4 mm blink line. The full axis swap (x*H, y*W, factor 3.16) IS caught by aperture.test.ts:76-96.

**Detail.** This is a regression-guard gap, not a maths error: the shipped code is correct and I verified it stays correct under roll on a 16:9 frame. The point is that the trap the module's own header warns about at aperture.ts:10-13 would survive every test in aperture.test.ts, tiltInvariance.test.ts, ear.test.ts and syntheticFace.test.ts, and be caught only by two blink tests for a reason unrelated to the ruler.

### C4-26. The ruler carries several per cent of its own per-frame noise and a persistent 3 per cent left/right split

|                   |                     |
| ----------------- | ------------------- |
| Constraint        | E3                  |
| Kind              | unstated-assumption |
| Severity as filed | medium              |
| Verdict as filed  | violation           |
| Verification      | **UNTESTED**        |

**Evidence.** On the repository's 300 recorded frames at 1280x720: right iris ruler mean 42.23 px with CV 7.17%, left 43.60 px with CV 6.86%, while an independent distance proxy (the iris-centre separation) has CV 4.44% and correlates only 0.419 with the ruler. The two eyes' rulers, which must agree on a flat face at one instant under the same 11.7 mm assumption, have a right/left ratio of mean 0.9701, CV 6.07%, range 0.833 to 1.079. src/main.ts:1636-1640 and :1665-1670 print each eye's millimetres separately and average them for the blink signal.

**Detail.** A ruler that disagrees with itself by up to 17% between two eyes of the same head at the same instant puts a precision floor of several per cent on every per-frame millimetre value, on top of the between-person bias in the first finding. Some of the spread is genuine (gaze rotation and small yaw shrink the projected limbus), so treat this as an upper bound on pure landmark noise; nothing in MODEL_CARD.md or SPEC.md states any per-frame precision for the millimetre reading.

### C4-27. BLINK_REFRACTORY_MS = 150 compares an end-to-end interval against an onset-to-onset physiology bound, so it can suppress a genuine blink

|                   |                     |
| ----------------- | ------------------- |
| Constraint        | E5                  |
| Kind              | unstated-assumption |
| Severity as filed | medium              |
| Verdict as filed  | partial             |
| Verification      | **UNTESTED**        |

**Evidence.** src/core/blink.ts:83-85 `nowMs - state.lastBlinkEndedAtMs < BLINK_REFRACTORY_MS` measures reopen-to-reopen. constants.ts:79-85 justifies it against "the shortest interval a person can produce on purpose is about 200 ms", an onset-to-onset figure. Ran the shipped reducer at 60 fps: two closures 200 ms apart onset-to-onset, durations 200 ms then 80 ms (both inside MANUAL item 24's 80-200 ms band) -> blinkCount 1; equal 130/130 ms at the same spacing -> 2; the asymmetric pair still gives 1 at a 250 ms onset gap and only reaches 2 at 300 ms.

**Detail.** End-to-end interval = onset gap + (durB - durA), so the claim "it cannot suppress even a subject blinking as fast as they are able" holds only if consecutive blinks have equal durations. Against the instrument's own documented spread the safe onset gap is 270 ms, not 200, i.e. 3.7 blinks per second rather than 5. This is a stated-guarantee gap, not a wrong constant: nothing on the corpus was suppressed (recall 87.7% before and after, docs/eyeblink8-result.txt:52,58).

### C4-28. MAX_BLINK_DURATION_MS = 500: #126's "unadvertised noise filter" role does not exist on today's main; the arm line does that job

|                   |                |
| ----------------- | -------------- |
| Constraint        | E5             |
| Kind              | claim-mismatch |
| Severity as filed | medium         |
| Verdict as filed  | partial        |
| Verification      | **UNTESTED**   |

**Evidence.** Ran the shipped blink.ts against #126's own geometry (baseline 10.7 mm, blink line 5.35, resting 5.25 mm under the line, over-line pops every 700 ms), with the constant at 500 and at 1000 in a scratch copy. Pure loiter plus chatter, no real blink: 0 counted at BOTH 500 and 1000. Same stream with one genuine deep plunge to 1.5 mm: 0 at 500, 1 at 1000.

**Detail.** The #126 noise class never reaches the arm line (threshold x 0.9, fix #114), so the ceiling is not what suppresses it — both comments on #126 were describing the abandoned arm-anchored branch, where the span shrank enough to pass the filter. On main the ceiling's only effect under a ratchet is to refuse genuine blinks whose spans were inflated by the ratchet. #178 and #126 are therefore not symmetric: #126 does not refute raising the constant on today's code.

### C4-29. The evidence #178 rests on was measured on a detector that no longer exists, and the real cost of raising the ceiling is on the other side of the partition

|                   |                     |
| ----------------- | ------------------- |
| Constraint        | E5                  |
| Kind              | unstated-assumption |
| Severity as filed | medium              |
| Verdict as filed  | cannot-determine    |
| Verification      | **UNTESTED**        |

**Evidence.** docs/evidence/2026-08-09/scripts/replay/sim.py contains no refractory period (`grep -c refractory` -> 0) and was committed 8640bfd 2026-08-09 14:08, while BLINK_REFRACTORY_MS landed in 5e7af7e 2026-08-09 21:55. src/core/longClosure.ts:19 `LONG_CLOSURE_THRESHOLD_MS = MAX_BLINK_DURATION_MS`, so 500 -> 1000 moves both lines together.

**Detail.** The "13 detections, F1 92.1 -> 93.6" figure comes from a pre-refractory replay whose F1 universe is not the app's (published F1 is 85.4), and it cannot be re-derived from the repository because scripts/replay/traces is absent. What would settle it: one corpus run at 1000 with nothing else changed, plus a count of currently-detected long closures whose spans fall between 500 and 1000 ms, since those silently stop being microsleep events. Neither issue states that second cost.

### C4-30. EYES_SHUT_FRACTION = 0.4 is a midpoint between one corroborated number and one that exists only in prose

|                   |                     |
| ----------------- | ------------------- |
| Constraint        | E5                  |
| Kind              | unstated-assumption |
| Severity as filed | medium              |
| Verdict as filed  | partial             |
| Verification      | **UNTESTED**        |

**Evidence.** Recomputed the repo's only recorded human data (test/fixtures/session-01.json, 300 frames, apertureMm at 1280x720, both eyes averaged): p90 8.053 mm, floor 2.187 mm = 0.272 of baseline, and 0 of 300 frames below 0.20 of baseline. The droop band "45 to 50 percent" appears only as prose in src/core/longClosure.ts:31-32, test/core/longClosure.test.ts:54, ROADMAP.md:13 and LEARNING.md:439; no recorded session backs it.

**Detail.** The half of the argument that kills the literature's P80 line is genuinely measured and I reproduced it: the instrument's floor sits above 20% of baseline, so the P80 line is unreachable. The half that places the line at 40 rather than 35 rests on the owner's recollected 2026-08-05/06 sessions, which are not in the repository. The arithmetic is honest (midpoint of 34.7% and 45.8% is 40.25%), and 0.4 does discriminate on the fixture (10 frames below 0.40 versus 15 below 0.50), but "the measured midpoint" overstates what is recorded.

### C4-31. POSE_LIMITS 20/25/25 degrees: the reason for having a gate is written, the reason for the values is not

|                   |                     |
| ----------------- | ------------------- |
| Constraint        | E4                  |
| Kind              | unstated-assumption |
| Severity as filed | medium              |
| Verdict as filed  | violation           |
| Verification      | **UNTESTED**        |

**Evidence.** src/core/constants.ts:160-167. The comment says "Beyond these head angles, eye landmarks foreshorten and occlude enough that measurements would be guesses" and explains the symmetry, but gives no measurement and no citation for 20, 25 or 25. The replay table in docs/evidence/2026-08-09/findings/issue-178-max-blink-duration.md records that disabling the gate entirely gains 4 true positives and that the non-frontal flag is 0 in all eight clips.

**Detail.** This gate refuses frames outright, so it can only remove data, and on the one corpus where it was measured it removed 4 real detections and refused nothing else. Three unexplained numbers with teeth, and no recorded observation of where this instrument's aperture actually degrades with yaw or pitch.

### C4-32. The score's ramp floors trace to MANUAL prose, not to a recorded observation, and one of the MANUAL bands does not hold on the repo's own fixture

|                   |                     |
| ----------------- | ------------------- |
| Constraint        | E4                  |
| Kind              | unstated-assumption |
| Severity as filed | medium              |
| Verdict as filed  | partial             |
| Verification      | **UNTESTED**        |

**Evidence.** src/core/score.ts:29-31 prices PERCLOS_RAMP_FLOOR 0.05 above "MANUAL item 40" (test/MANUAL.md:44, "often between one and three percent"); score.ts:51-55 prices LID_SLUGGISH_RAMP_FLOOR_MS 150 at the top of "MANUAL item 26" (test/MANUAL.md:30, "A/V somewhere around 30 to 150 ms"). Recomputed A/V on the fixture's two real blinks: 44.3 ms and 24.7 ms — the second sits below the stated band's floor.

**Detail.** MANUAL.md is a manual-test script written by the same author, so citing it as documentation of "this instrument's NORMAL blinks" is a self-reference, not a measurement record. The direction of the pricing is conservative (floors sit above the claimed normal band, so a resting person scores 100), so nothing is charged wrongly; the traceability chain simply terminates in prose rather than data.

### C4-33. window_seconds = len(rows) treats a row count as seconds; the project's own loader warns against exactly this

|                   |              |
| ----------------- | ------------ |
| Constraint        | E6           |
| Kind              | maths-wrong  |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** analysis/blinklab/drozy.py:221 `window_seconds = len(rows)`, described in the comment above as "the window's real length". analysis/blinklab/loader.py:54-66 exists to compute the real length from timestamps and warns "The browser writes about one row per second, not exactly one, so counting rows would drift". On the repo's own export docs/evidence/2026-08-09/repeatability/published-run/27122013_154548_cam.seconds.csv: 164 rows over a 163.000 s timestamp span, ratio 1.0061, so the rate is inflated 0.61%.

**Detail.** Rows are not seconds, so blinks-per-minute carries a per-session multiplicative error set by however many rows that session dropped or gained. The size is under 1% here, but it is a per-session distortion applied to a feature that is then rank-correlated, and the fix (loader.py's duration_s) already exists in the same package.

### C4-34. The Holm family is data-dependent, not fixed at seven as pre-registered

|                   |                |
| ----------------- | -------------- |
| Constraint        | E6             |
| Kind              | claim-mismatch |
| Severity as filed | medium         |
| Verdict as filed  | partial        |
| Verification      | **UNTESTED**   |

**Evidence.** analysis/tools/analyse_drozy.py:187-192: a feature with fewer than 3 measured points prints "too few to test" and `continue`s, so it never reaches `raw.append`; analysis/blinklab/stats.py:120 then sets `m = len(ordered)`. Re-running holm() on the published p-vector with six entries instead of seven moves the smallest corrected p from 0.3427 to 0.2937.

**Detail.** docs/drozy-analysis-plan.md:78-81 fixes the correction "across the seven". If any feature were unmeasurable the family would silently shrink and every surviving test would face a weaker bar than the one pre-registered. Not triggered on the published run, where all seven have n=20.

### C4-35. Session usability uses median fps >= 25, a session-level rule the app itself does not have

|                   |                     |
| ----------------- | ------------------- |
| Constraint        | E6                  |
| Kind              | unstated-assumption |
| Severity as filed | medium              |
| Verdict as filed  | partial             |
| Verification      | **UNTESTED**        |

**Evidence.** analysis/blinklab/drozy.py:189 `measured_fps = statistics.median(fps_values)` and :70-72 `return self.measured_fps >= MIN_USABLE_FPS`. src/core/fpsGate.ts:7-9 gates each frame on its own instantaneous fps: `fps !== null && fps >= MIN_BLINK_FPS`. The median is computed correctly over non-null cells: _floats (drozy.py:144-159) skips blanks, verified on the repo's export (164 rows, 1 blank fps cell, 163 parsed, median 30.000).

**Detail.** The median is the right instinct (robust to transient dips) and is computed correctly over nulls, but the rule it implements is "more than half the session was fast enough", not "the app was measuring". A session at median 26 fps with 40% of its seconds under 25 counts as usable while its blink features were silently refused for those seconds. Neither the plan nor src/core/constants.ts:120-123 states a session-level rule. Never bites on DROZY, which is a constant 15 or 30 fps.

### C4-36. The seek landing is a wall-clock race, and an inexact landing disables both duplicate guards

|                   |                     |
| ----------------- | ------------------- |
| Constraint        | E7                  |
| Kind              | unstated-assumption |
| Severity as filed | medium              |
| Verdict as filed  | violation           |
| Verification      | **UNTESTED**        |

**Evidence.** src/io/videoStepper.ts:97-117 (seeked + FRAME_GRACE_MS=200 racing requestVideoFrameCallback), :282-284 fallback `index * step`, :295-301 the repeat check is gated on `landing.exact`.

**Detail.** Under load a landing degrades from exact to inexact, which changes which samples calibration sees and substitutes a synthesised timestamp. That timestamp always increases, so frameClock.acceptFrame accepts it and the "last frame twice" break is skipped — a re-shown decoded frame is counted as new. checkStepping cannot see it because sought and measured stay equal. Separately, the fallback is `index * step` while the target is `origin + (index+0.5)*step`, inconsistent for any clip with a non-zero origin; inert here only because prepare_eyeblink8.py normalises the origin to zero.

### C4-37. The only automated frame-accounting check is loose, and compares against the annotation rather than the video

|                   |                     |
| ----------------- | ------------------- |
| Constraint        | E7                  |
| Kind              | unstated-assumption |
| Severity as filed | medium              |
| Verdict as filed  | violation           |
| Verification      | **UNTESTED**        |

**Evidence.** analysis/tools/evaluate_eyeblink8.py:173-175 `if gap > max(5, r.frames_annotated * 0.01)`. analysis/tools/prepare_eyeblink8.py:112 returns the true decoded counts and main() only prints them.

**Detail.** On the longest clip 1% is 157 frames, so a substantial shortfall passes without a flag. The component that actually knows the file's frame count is the remuxer, and it persists nothing, so the browser's count is never compared against the video — only against a human's annotation, which I showed is itself short by one on two clips.

### C4-38. README carries two superseded-run figures inside the current-run section

|                   |                |
| ----------------- | -------------- |
| Constraint        | E7             |
| Kind              | claim-mismatch |
| Severity as filed | medium         |
| Verdict as filed  | violation      |
| Verification      | **UNTESTED**   |

**Evidence.** README.md:321 "8 of the 53 are more than four frames away" and README.md:325 "41 of the 53 are three frames long or shorter". My independent recount of eyeblink8-measured-refractory: 72 false positives, 45 strict-on-blink, 64 at tolerance 4, 8 beyond, 61 of length <= 3. The capfix run gives 53 / 38 / 45 / 8 / 41.

**Detail.** The paragraph opens correctly with "45 of the 72" and "64 of the 72", then two paragraphs later switches denominator to the previous run's 53 without saying so. The current values are 8 of 72 and 61 of 72; docs/eyeblink8-result.txt already prints both correctly.

### C4-39. The score scale is usable but coarse and cliff-driven, and 50 is unreachable from eye-closure alone

|                   |                     |
| ----------------- | ------------------- |
| Constraint        | E1                  |
| Kind              | unstated-assumption |
| Severity as filed | low                 |
| Verdict as filed  | partial             |
| Verification      | **UNTESTED**        |

**Evidence.** Computed on the real module. 100 covers everything up to PERCLOS 5.125% with a normal blink. 90 = PERCLOS 7.5% (4.5 s of the 60 closed). 80 = 10%. 70 = 12.5%, or two long closures with nothing else. 60 = PERCLOS saturated. 50 requires at least 10 points from a non-PERCLOS signal: PERCLOS alone is IMPOSSIBLE below 60. The long closure penalty takes only 0, 15 or 30 — no intermediate value exists. Lattice check: all 101 integers 0-100 are reachable, no gaps.

**Detail.** Not broken and not a floor-at-100 collapse: the top half of the scale responds smoothly to PERCLOS at 4 points per percentage point. But half the fall from 100 to 70 can happen in two discrete 15-point jumps with no warning in between, and no document states that the bottom half of the scale is unreachable without long closures or blink-shape penalties. Worth stating plainly beside the score.

### C4-40. available:false is honest in the structure and silent in the number, and the brief's worst case is milder than stated

|                   |                     |
| ----------------- | ------------------- |
| Constraint        | E1                  |
| Kind              | unstated-assumption |
| Severity as filed | low                 |
| Verdict as filed  | partial             |
| Verification      | **UNTESTED**        |

**Evidence.** Computed: all four available with resting values returns {score:100}, and the same record with lastBlinkDurationMs/AmplitudeMm/PeakVelocityMmPerS all null returns {score:100} — identical scalars, differing only in two available:false flags. Correction to the premise: at most TWO of four can ever be unavailable. PERCLOS null returns null outright (score.ts:96-98) and longClosureCount is a non-null count so 'long closures' is always available (score.ts:127-134). So '100 with three unavailable' is unreachable; the real worst case is 30 of 100 points un-chargeable.

**Detail.** The convention is disclosed: SPEC.md:51 states it, scorePanel.ts:51-67 counts and announces it, MANUAL item 49 documents the pre-first-blink case explicitly. I judge this honest at the structure level. The residual cost, which no document states: the SCALAR is genuinely non-distinguishing, and its disclosure lives in a sibling paragraph that the next finding shows does not survive a screenshot of the number.

### C4-41. The short caveat that the code says stands beside the score is never rendered (already reported by an earlier chunk)

|                   |                |
| ----------------- | -------------- |
| Constraint        | E1             |
| Kind              | claim-mismatch |
| Severity as filed | low            |
| Verdict as filed  | violation      |
| Verification      | **UNTESTED**   |

**Evidence.** src/core/notice.ts:20-32 defines DEMO_NOTICE_SHORT / demoNoticeShort() documented 'for standing beside the score'; the only consumer is test/core/notice.test.ts (grep across src/ and test/). main.ts:78 imports demoNoticeText only. alertnessBox (main.ts:2555) has exactly three children: scoreLabel, panelSummaryLabel, panelList. The .caveat CSS rule (main.ts:2358) is applied to no element. demoNotice is appended at the top of app (main.ts:2744), not in the score's box. Comments at main.ts:173-174, 2144-2149 and 2496-2497 still describe the vanished element, and MANUAL items 52 and 60 both assert it exists.

**Detail.** Cross-reference so the parent does not double-count: this is docs/audit/appendix-chunk-2-all-findings.md:245 (C2-14). I re-confirmed it here because it is the disclosure channel for findings above: a screenshot of the score carries no caveat, which MANUAL item 60 says 'was 6.9's whole point'. The page-top permanent notice still renders, so the score is not undisclosed, only decoupled.

### C4-42. MODEL_CARD.md says the sleepiness result is unpublished; README.md publishes it

|                   |                |
| ----------------- | -------------- |
| Constraint        | E1             |
| Kind              | claim-mismatch |
| Severity as filed | low            |
| Verdict as filed  | partial        |
| Verification      | **UNTESTED**   |

**Evidence.** MODEL_CARD.md:49 'and its results are not yet published. Until they are, treat the score as an illustration'. README.md:405-430 publishes the null result, the exclusion-bias table and a link to docs/drozy-result.txt, which exists. STATE.md:9 also still reads 'has been measured once and its result is NOT published'.

**Detail.** The direction of the error is conservative, and MODEL_CARD.md:6 self-dates ('Written 9 August 2026 against the state of main on that date') while the publishing commit d8d250c is 10 August, which mitigates. But the model card is the document a reader consults for what the score may claim, and it currently reads as though the sleepiness question is open when the repo's own answer is that no feature reached significance after Holm correction.

### C4-43. The test cited as proof of frame-rate invariance does not test frame-rate invariance

|                   |                |
| ----------------- | -------------- |
| Constraint        | E2             |
| Kind              | claim-mismatch |
| Severity as filed | low            |
| Verdict as filed  | violation      |
| Verification      | **UNTESTED**   |

**Evidence.** LEARNING.md:296: "the tests use uneven timestamps to enforce exactly that". test/core/blinkShape.test.ts:23-41 does use uneven timestamps (0,100,150,200,300) but only pins the division by the actual dt. No test in test/core/blinkShape.test.ts samples one trajectory at two different rates and compares the resulting velocities.

**Detail.** The uneven-timestamp test proves the conversion is per-second rather than per-frame, which is a weaker property than the sentence claims. A test that sampled one synthetic curve at 25 and 60 fps would fail today, by 33 per cent.

### C4-44. 'Eyelid aperture' is the mean of two off-centre chords, not the lid opening a reader would picture

|                   |                |
| ----------------- | -------------- |
| Constraint        | E3             |
| Kind              | claim-mismatch |
| Severity as filed | low            |
| Verdict as filed  | partial        |
| Verification      | **UNTESTED**   |

**Evidence.** src/core/aperture.ts:44-45 and :65-69 average the two vertical chords at constants.ts:182-198 (indices 160/144 and 158/153), which sit either side of the pupil, never at it; the synthetic fixture places them at +/-5 mm from the pupil (test/fixtures/syntheticFace.ts, chordOffset = 5). README.md:5 and :16 and MODEL_CARD.md:26 call the output 'eyelid aperture in millimetres'. LEARNING.md:30 records the owner's real median as 7.1 mm.

**Detail.** The code comment describes exactly what it does and does not overclaim, so this is honest at the source, but the published word 'aperture' will be read as palpebral fissure height, which from memory runs about 9 to 11 mm in adults, and the mean of two flanking chords is structurally below the peak opening. The consequence is that the printed millimetres are not comparable to a clinical fissure measurement, and no public document says so.

### C4-45. Unexplained values in the smoother, the display scales and the numerical guards

|                   |                     |
| ----------------- | ------------------- |
| Constraint        | E4                  |
| Kind              | unstated-assumption |
| Severity as filed | low                 |
| Verdict as filed  | partial             |
| Verification      | **UNTESTED**        |

**Evidence.** src/core/gazeSmoothing.ts:14,19,23 — MIN_CUTOFF_HZ 1 and DERIVATIVE_CUTOFF_HZ 1 are the One Euro paper's own defaults but the comment does not say so, and SPEED_COEFFICIENT 5 is the paper's beta, whose published default is 0.007 in pixel units, rescaled here to offset units with reasoning but no measurement. src/core/headPose.ts:16 GIMBAL_EPSILON 1e-6, no comment at all. src/main.ts:1455 SPARK_EAR_MAX 0.6 and :1472 GAZE_TRACE_HALF 0.3, display axis half-scales, no origin. src/core/constants.ts:23-24 CALIBRATION_SETTLE_MS 800 and CALIBRATION_SAMPLES_PER_TARGET 30 explain the need, not the values.

**Detail.** None of these change a millimetre or a millisecond that gets exported, so the harm is bounded, but the smoother's coefficient does shape the gaze offsets that feed fixation detection, and two of them (the paper's defaults) are literature values presented as if invented here. The display half-scales silently clip anything beyond them.

### C4-46. The #178 evidence file says 0.50 is "at the measured best" while its own table shows 0.55 scoring higher

|                   |                |
| ----------------- | -------------- |
| Constraint        | E5             |
| Kind              | claim-mismatch |
| Severity as filed | low            |
| Verdict as filed  | partial        |
| Verification      | **UNTESTED**   |

**Evidence.** docs/evidence/2026-08-09/findings/issue-178-max-blink-duration.md, sweep row: "F1 89.1 at 0.40, 90.8 at 0.45, 92.1 at 0.50, 92.2 at 0.55, 90.8 at 0.60, 83.7 at 0.70", verdict column "refuted, 0.50 is at the measured best".

**Detail.** 0.55 measured 0.1 F1 higher than 0.50. The gap is inside the run-to-run spread the project itself documents in #174, so the conclusion (0.50 is not indefensible) survives; the wording claims a maximum the table does not show. Worth one word of correction rather than a re-run.

### C4-47. stats.py says ten thousand shuffles; the published p-values used one thousand

|                   |                |
| ----------------- | -------------- |
| Constraint        | E6             |
| Kind              | claim-mismatch |
| Severity as filed | low            |
| Verdict as filed  | violation      |
| Verification      | **UNTESTED**   |

**Evidence.** analysis/blinklab/stats.py:70 `iterations: int = 10000`, :77-78 "by producing chance ten thousand times", :92 "which ten thousand shuffles cannot establish". analysis/tools/analyse_drozy.py:37 `SHUFFLES = 1000` and :194 passes it. The published p of 0.9990 in docs/drozy-result.txt is 1000/1001, confirming the 1001 denominator.

**Detail.** The prose in the file that computes the number describes a run ten times larger than the one that produced the published table. The plan's 1000 applies only to the negative control (plan:89); the primary test's iteration count is not pre-registered at all, and here it silently inherits the control's constant.

### C4-48. The column labelled "median" is the 501st of 1000 values, not the median

|                   |              |
| ----------------- | ------------ |
| Constraint        | E6           |
| Kind              | maths-wrong  |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** analysis/tools/analyse_drozy.py:116 `return seen[-1], seen[len(seen) // 2]` over a sorted list of SHUFFLES=1000 values; docs/drozy-result.txt:30 heads that column "median". On my 1000-draw null: code returns seen[500] = 0.170249, statistics.median = 0.169867 (the average of s[499] and s[500]), difference 0.000382.

**Detail.** For an even count the median is the mean of the two middle values; the code takes the upper one, giving the 50.05th percentile. The effect is smaller than the third decimal place the table prints, but the number is not what its heading says it is.

### C4-49. ranks, spearman and holm fail open on NaN

|                   |              |
| ----------------- | ------------ |
| Constraint        | E6           |
| Kind              | maths-wrong  |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** `ranks([1,2,nan,4,5])` returns [1.0,2.0,3.0,4.0,5.0] and `spearman` on that against [1,2,3,4,5] returns 1.0, a perfect correlation invented from a missing value. `holm([('a',0.5,nan,20),('b',0.5,0.01,20)])` returns p_holm 1.0 for BOTH, because min(1.0, nan) is 1.0 and max(running, nan) keeps running, so a genuine p of 0.01 is destroyed silently. analysis/blinklab/drozy.py:154-158 admits these because `float("nan")` and `float("inf")` do not raise.

**Detail.** This is the TS fail-open-on-NaN pattern reaching the Python side. Not reachable through the project's own pipeline: src/core/csv.ts:66 writes an empty cell for any non-finite value. It is reachable through a hand-edited or third-party CSV, and the failure mode is a fabricated rho of 1.0 or a wiped-out corrected p rather than an error.

### C4-50. spearman returns 0.0 for zero-variance input rather than null

|                   |                     |
| ----------------- | ------------------- |
| Constraint        | E6                  |
| Kind              | unstated-assumption |
| Severity as filed | low                 |
| Verdict as filed  | partial             |
| Verification      | **UNTESTED**        |

**Evidence.** analysis/blinklab/stats.py:60-63: `if dx == 0 or dy == 0: return 0.0`, commented "Zero is the honest answer, not an error and not NaN." analysis/tools/analyse_drozy.py:200 then does `sign = 1.0 if c.rho > 0 else -1.0`, so an exactly-zero rho is assigned a negative direction before the within-subject check.

**Detail.** The reason is written down in the code, which is why this is an assumption and not a violation, but it departs from the project's "Null over guessing" rule: a printed rho of 0.000 cannot be told apart from "measured, no relationship". Downstream it degrades safely (every shuffle also gives 0.0, so p becomes 1001/1001 = 1.0), and it is stated nowhere outside that comment — not in SPEC.md, MODEL_CARD.md or the plan.

### C4-51. README's disclaimer about docs/eyeblink8-result.txt describes a state that file no longer has

|                   |                |
| ----------------- | -------------- |
| Constraint        | E7             |
| Kind              | claim-mismatch |
| Severity as filed | low            |
| Verdict as filed  | violation      |
| Verification      | **UNTESTED**   |

**Evidence.** README.md:352-357 says that file "still says 45 of the 53 sit on a real blink with half of them 3 frames long or shorter". `grep -n "53\b" docs/eyeblink8-result.txt` returns nothing; the file says "45 of 72" and "61 of 72". docs/eyeblink8-result.txt:73-77 still says the miss table was NOT rebuilt, but commit 23832c5 rebuilt it as tables-current-run/eyeblink8_misses.csv.

**Detail.** The staleness runs the other way round from what the disclaimer claims: result.txt is current on false positives and stale on the miss table, while README is stale on false positives and current on the miss table. A reader following either pointer is sent to the wrong file.

### C4-52. The two-frame coverage gap is the annotation being short, not the instrument over-counting, and the docs do not say so

|                   |                     |
| ----------------- | ------------------- |
| Constraint        | E7                  |
| Kind              | unstated-assumption |
| Severity as filed | low                 |
| Verdict as filed  | partial             |
| Verification      | **UNTESTED**        |

**Evidence.** MP4 stsz sample counts parsed directly from the containers: 15784, 11182, 9216, 5405, 10663, 5134, 9077, 4895 = 71,356, matching the AVI idx1 video-chunk counts one for one. README.md:343 "measured 71,356 frames against the 71,354 in the human's files. Two clips gave one frame more than their file lists."

**Detail.** The instrument measured exactly the number of frames the files contain; the .tag files for 26122013_223310_cam and 26122013_230654_cam stop one row short. Given that videoStepper.ts:290 records a real past off-by-one ("Safari ... reported 4,203" for 4,202) and the e2e assertion band is FIXTURE_FRAMES ± 1, the wording invites a reader to suspect the instrument when the container proves it right.

---

## Compliance, as reported by each auditor

### E1, the alertness score: are the weights meaningful, are the ramp floors derived as claimed, what does the number actually measure, is available:false honest, and does the published text overstate it

- A resting person really does score exactly 100, which was 6.5's load-bearing requirement. Computed on the real module: PERCLOS 0 through 5% with a 130 ms blink at A/V 67 ms all return 100 with every contribution at 0 points.
- Two of the three ramp floors ARE derived as SPEC.md:62 claims, with real margin. MANUAL item 24 top 200 ms vs BLINK_DURATION_RAMP_FLOOR_MS 250 (first point charged at 256.7 ms); MANUAL item 40 top 3% vs PERCLOS_RAMP_FLOOR 5% (first point at 5.125%). Both re-derived independently from floor + 0.5*(ceil-floor)/max.
- The blink duration CEILING has a recorded, checkable reason rather than being a magic number: score.ts:44-45 ties 450 ms to the 500 ms line 'where a closure stops being a blink at all and becomes 6.2's business', and MAX_BLINK_DURATION_MS is a real constant in blink.ts. Verified: 600 ms and 900 ms blinks cap at 15 points instead of overflowing.
- The long closure penalty is windowed correctly and cannot mint points back. Computed: a closure 10 minutes old scores 100, one inside the window scores 85, two score 70, five still score 70. The Math.max(0, delta) at score.ts:123-126 has its reason written above it (a restart clearing the counter).
- The score is a genuine map onto 0 to 100 with no clamping. Enumerated the full penalty lattice: all 101 integers reachable, zero gaps, min 0, max 100.
- The refusals are real, not cosmetic. score.ts:96-98 returns null on no face and on null PERCLOS; score.ts:151-153 marks sluggish lids unavailable rather than dividing by a zero or negative velocity. Both are pinned by tests (test/core/score.test.ts:218, :336).
- scorePanel.ts computes nothing. It only filters on available and points>0, sorts with declaration order as the tiebreak (scorePanel.ts:25-29), slices and formats, so the panel arithmetic cannot disagree with the scorer's.
- MODEL_CARD.md:30 lists the alertness score with external validation 'nothing external' and status 'a heuristic, not a measurement', and MODEL_CARD.md:44-51 says it 'has never been shown to correspond to how sleepy anyone actually is'. README.md:19 describes it exactly as the code computes it: 'exactly 100 minus four named penalties'. Neither overstates the mechanism.
- README.md:423-425, written after the null result, says the score 'remains a documented heuristic that has never been shown to correspond to anyone's actual sleepiness. That was true before this measurement and it is still true after it.' That is the correct reading of docs/drozy-result.txt and resists the temptation to spin a null.
- Units carry in the names throughout score.ts: SCORE_WINDOW_MS, BLINK_DURATION_RAMP_FLOOR_MS, LID_SLUGGISH_RAMP_FLOOR_MS. The two unitless constants (PERCLOS_RAMP_FLOOR/CEIL) are shares, which genuinely have no unit.

### E2 — blink closing velocity and the amplitude-over-velocity ratio (sampling adequacy, unit algebra, peak-finder correctness)

- UNIT ALGEBRA IS CORRECT AND THE NAME MATCHES. mm / (mm/s) = s, times 1000 = ms. Probe: analyzeClosing([{0,10},{1000,5}]) -> A=5 mm, V=5 mm/s, A/V=1000 ms exactly (src/core/blinkShape.ts:72). src/core/score.ts:161-162 recomputes the identical conversion from the same two fields rather than reading a third, so panel and CSV cannot drift apart.
- SIGN IS RIGHT. src/core/blinkShape.ts:63 computes (a.apertureMm - b.apertureMm)/dtS, earlier minus later, so a closing lid is positive. Probe: a rising-only window [[0,2],[33.33,8]] returns null, and a window whose minimum comes first ([[0,2],[33.33,8],[66.67,9]]) returns null (guard at :31-33).
- NON-MONOTONIC DESCENTS ARE HANDLED. A rising interval inside [maxIdx, minIdx] produces a negative slope that Math.max discards. Probe: [8, 5, 6, 2] at 33.33 ms spacing returns V=120.0 mm/s, the true steepest 6->2 drop, not a net-over-span average and not a NaN.
- THE REFUSAL SET IS OTHERWISE COMPLETE. Fewer than two samples, no descent, amplitude <= 0, non-advancing clock and a non-positive peak all return null (src/core/blinkShape.ts:21, 31, 48, 60, 65). Probe: backwards timestamps [[0,8],[66.67,5],[33.33,2]] -> null. Null over guessing holds for every degenerate case except sample count on the descent.
- AMPLITUDE IS ANCHORED AT THE PRE-CLOSURE MAXIMUM, NOT THE WINDOW START. src/core/blinkShape.ts:35-40 searches [0, minIdx] for the max; test/core/blinkShape.test.ts:58-70 pins it, and [5, 8, 2] gives A=6.00 mm, not 3.
- A WRITTEN FRAME-RATE REFUSAL DOES EXIST AND DOES GATE THE SHAPE. MIN_BLINK_FPS = 25 with its reason at src/core/constants.ts:120-123, wired at src/main.ts:1932-1939 where blinkStep is fed null below the gate, so no blink is counted and therefore no shape is computed. It bounds whether a blink is seen; it makes no claim about velocity resolution, and it is honest about which of the two it is.
- THE LIMITATION TABLE ALREADY REFUSES TO OVERSELL. MODEL_CARD.md:27 lists blink duration, amplitude and closing velocity as validated against "nothing external", result "unvalidated", and README.md:378-385 publishes the DROZY correlations as nulls after correction rather than as findings.
- NO REPOSITORY FILES WERE MODIFIED. `git -C "/Users/evannorus/Desktop/blinklab build/blinklab/.claude/worktrees/audit-fresh" status --porcelain` printed nothing at the end of the audit. All probes ran via `npx tsx` from scripts in the scratchpad, importing the repo's own modules read-only; no npm install was run.

### E3 — the iris ruler, aperture in millimetres, and the eye aspect ratio

- apertureMm converts to pixels BEFORE mixing directions and the guard genuinely works: re-projecting the synthetic faces into 16:9 normalised coordinates and calling apertureMm(face, ..., 1280, 720) returns 10.000000 mm at roll 0, 15 and 30 degrees, while the counterfactual vertical-drop implementation at test/core/tiltInvariance.test.ts:48-79 shrinks by exactly cos(roll). src/core/aperture.ts:15-21.
- The ruler is the HORIZONTAL iris diameter only, ring[0] to ring[2], never an average with the vertical pair, and the reason is written at src/core/aperture.ts:23-25 (the vertical pair is occluded by the lids exactly mid-blink). The assumed MediaPipe ordering holds on real data: over 300 recorded frames the ring[0]->ring[2] segment sits a median 2.6 degrees off horizontal (177.42 deg).
- The choice of width over a width/height average is not free and the code takes the right side of it: under 20 degrees of pitch the width ruler reports -6.00% while a width/height average reports -3.10%, but the average ruler is the one that would collapse under yaw and behind the lids, and the written reason at aperture.ts:23-25 is the correct one.
- The EAR formula is the published Soukupova and Cech definition exactly, (|p2-p6| + |p3-p5|) / (2|p1-p4|), with no deviation: src/core/ear.ts:29-33 against the six indices at src/core/constants.ts:182-198, and the hand-built eye at test/core/ear.test.ts:18-31 solves to exactly 1/3. The deviation is in the units it is fed, not in the formula.
- Null over guessing holds throughout the ruler path: irisWidthPx returns null rather than zero when the iris has no width (src/core/aperture.ts:41), apertureMm refuses instead of dividing (src/core/aperture.ts:81-83), eyeAspectRatio returns null when the corners coincide (src/core/ear.ts:26-28), each pinned by test/core/aperture.test.ts:54-74 and test/core/ear.test.ts:65-69.
- A constant iris-size error cancels EXACTLY in the blink decision once the baseline is learned: personalThresholdMm is 0.5 x the person's own p90 of the same millimetre stream (src/core/baseline.ts:86-89, src/core/constants.ts:138), so a scale factor s multiplies both sides of the comparison and the crossing lands on the same true aperture. Blink counts are immune to the 11.7 mm assumption; the exported mm and mm/s values are not.
- The pose gate is a real refusal rather than a warning: beyond the limits EAR and aperture become 'no valid measurement' and the message names the axis, the angle and the limit (src/core/validityGate.ts:30, :46; src/main.ts:1620). The failure mode I report is that its threshold is loose, not that it fails open.
- README.md:16 scopes the headline claim correctly and does not overreach: the iris ruler makes the reading 'survive moving closer to or further from the camera', distance only, with no claim of head-angle invariance. That is precisely what I measured to be true.

### E4/E5 — every magic number, and the four constants added under pressure (BLINK_REFRACTORY_MS, EYES_SHUT_FRACTION, MAX_BLINK_DURATION_MS, MIN_BLINK_FPS)

- BLINK_APERTURE_THRESHOLD_MM = 4 is corroborated by independent recomputation: constants.ts:14-17 claims the fixture bottomed near 2.2 mm with an open median around 7; replaying apertureMm over all 300 frames of test/fixtures/session-01.json at 1280x720 gives min 2.187 mm and median 7.055 mm.
- constants.ts:101-104 claims the owner's blinks measured 133 and 117 ms; re-running the shipped blinkStep over the same fixture with a p90-derived threshold reproduces exactly 133 ms and 117 ms.
- Amendment 5's factual premise holds under independent measurement: 0 of 300 fixture frames fall below 20% of the p90 baseline, and the floor sits at 27.2%, so the literature's P80 line really is unreachable for this instrument.
- The refractory period's honesty disclosure is verbatim and accurate — constants.ts:87-90 "STATED PLAINLY: this was introduced AFTER seeing the benchmark result" — and the physiological reason was pre-registered in issue #176 ("Write the chosen window down with that reasoning, in milliseconds, before running anything. Do not tune it against the score") before the fix existed.
- 150 ms was not fitted to the data: issue-176-double-counting.md records that merging detections 2 frames apart (67 ms at 30 fps) captured every close pair, so a fitted value would have been ~67 ms, and PR #190 explicitly declines 300 ms — "Raising 150 to 300 would catch most of them, and that is exactly why it stays at 150".
- The refractory cost no real blinks: docs/eyeblink8-result.txt:52 and :58 record recall 87.7% before and 87.7% after, "false alarms at ZERO cost to recall".
- EYES_SHUT_FRACTION is aliased, not copied, into PERCLOS (perclos.ts:29 `PERCLOS_CLOSED_FRACTION = EYES_SHUT_FRACTION`), so the two watchers of "shut" cannot drift apart.
- LONG_CLOSURE_THRESHOLD_MS is aliased to MAX_BLINK_DURATION_MS (longClosure.ts:19), so the blink/long-closure partition cannot be broken by a drifting constant — and I confirmed the coupling is real by patching one value and seeing both lines move.
- No threshold constant was ever retuned after being set: I ran `git log -S` myself on BLINK_REFRACTORY_MS, MAX_BLINK_DURATION_MS, EYES_SHUT_FRACTION and MIN_BLINK_FPS and each returns exactly one commit.
- The 25 fps floor was not lowered to recover the 16 sleepier DROZY sessions, and the resulting bias is written down rather than absorbed: docs/drozy-analysis-plan.md:31-42 and STATE.md:38-46 record KSS 6.38 excluded against 4.60 analysed, with every KSS 9 in the excluded group.

### E6 — correctness of the Python statistics (Spearman, permutation test, Holm, the DROZY pre-registration, the fps exclusion rule)

- SPEARMAN IS EXACTLY RIGHT, TIES INCLUDED. I re-derived it by two fully independent routes — exact-rational Pearson-on-ranks (Fraction arithmetic) and the tie-corrected d^2 shortcut rho = (S - sum d^2 - Tx - Ty)/sqrt((S-2Tx)(S-2Ty)) — over 600 random inputs (KSS-like 1..9, three-value, two-value, continuous, one-side-tied, negatives). 585 non-degenerate cases, max |difference| 0.000e+00 against both. stats.py:47-48 correctly refuses the naive 6d^2 form because of ties.
- AVERAGE-RANK TIE HANDLING IS CORRECT. stats.py:22-41 matched an independent counting implementation (rank_i = 1 + #{v_j < v_i} + (#{v_j == v_i} - 1)/2) on all 600 inputs, max deviation 0.000e+00. Worked by hand: ranks([1,2,2,3,4]) = [1, 2.5, 2.5, 4, 5], ranks([5,5,6,7,7]) = [1.5, 1.5, 3, 4.5, 4.5], rho = 8.25/sqrt(9.5*9) = 0.8922178162, and the code returns 0.8922178162.
- THE (hits+1)/(iters+1) FORM IS CORRECT AND THE +1 IS IN BOTH PLACES. stats.py:94 `return (hits + 1) / (iterations + 1)`. Minimum p over 30 seeds at 200 iterations was 0.004975, never zero; a degenerate ys gave exactly 1.000000, never above 1.
- THE IN-PLACE SHUFFLE IS CORRECT, SETTLED EMPIRICALLY. 240,000 in-place shuffles of a 4-element list (stats.py:85-89's exact loop) hit all 24 permutations, min 9789 max 10166 against an expected 10000, chi2(23) = 17.1 versus a 99.9% critical value of 49.7; a fresh-copy control on the same budget gave chi2(23) = 29.2. All 576 lag-1 pairs occurred, chi2(575) = 512.1 against ~686. Successive shuffles are uniform AND independent, so reusing one list is exactly equivalent to reshuffling a fresh copy.
- THE PERMUTATION P MATCHES EXACT ENUMERATION. n=6, all 720 permutations enumerated versus 20,000 shuffles: 0.0667 vs 0.0662, 0.1500 vs 0.1508, 1.0000 vs 1.0000, 0.5000 vs 0.5058. It is genuinely two-sided (abs on both the observed and the shuffled statistic, stats.py:83 and :89).
- HOLM IS EXACT AND THE RUNNING MAXIMUM IS ENFORCED. 400 random p-vectors (ties in 85, hitting the 1.0 clamp in 301), max |difference| 0.000e+00 against R's p.adjust(method='holm') written out independently. On 367 of the 400 a no-cummax implementation would have produced non-monotone output, and stats.py:125-126 `running = max(running, adjusted)` differed on all 367. Output is always non-decreasing and always inside [0,1].
- THE MONOTONICITY FIX IS VISIBLE IN THE PUBLISHED TABLE. Feeding the published raw p-vector [49,49,94,132,144,762,1000]/1001 through holm() reproduces docs/drozy-result.txt byte for byte: [0.3427, 0.3427, 0.4695, 0.5275, 0.5275, 1.0000, 1.0000]. The fifth entry is the proof — 0.1439 x 3 = 0.4318, raised to 0.5275 by the running maximum. Clamping before the running max rather than after (R's order) is provably equivalent because min(1, .) is monotone, confirmed at 0.000e+00 over all 400 vectors.
- 1000 ITERATIONS IS NOT A TRAP. The smallest attainable raw p is 1/1001 = 0.000999; with the worst Holm multiplier of 7 that is 0.006993, still under the pre-registered alpha of 0.05. The decision rule was reachable, so the null result is not an artefact of Monte Carlo resolution.
- THE PLAN'S CLAIM ABOUT ITS OWN AMENDMENT IS TRUE. docs/drozy-analysis-plan.md:50-52 says "Nothing about the plan was changed in response. The features, the statistic, the correction, the controls and the decision rule are as they were. Only the caveat is new." `git diff c8554de f859bd2 -- docs/drozy-analysis-plan.md` is purely additive: 19 added lines, zero deletions, all of them the exclusion-bias caveat. The matching code diff adds only the EXCLUSION BIAS printout. The result landed two commits later in d8d250c.
- THE DECISION RULE IS IMPLEMENTED EXACTLY AS PRE-REGISTERED. analyse_drozy.py:41-42 HOLM_ALPHA = 0.05 and MIN_AGREEING_SUBJECTS = 3; :204-209 ANDs both bars and emits the plan's phrase "suggestive and unconfirmed" (plan:102-103) verbatim when exactly one passes. All seven pre-registered features appear in FEATURE_NAMES (drozy.py:81-89) in the plan's order, and long_closures = int(max(longClosureCount)) (drozy.py:193) is the session total because src/core/longClosure.ts only ever increments that counter.

### E7 — provenance of the published benchmark: does the number come from the code this repository holds now?

- THE HEADLINE REPRODUCES EXACTLY. I re-implemented the evaluation from the stated rules alone (no import of analysis/blinklab) and ran it over datasets/eyeblink8-measured-refractory: 8 clips, 408 annotated, 430 detected, TP=358 FP=72 FN=50, recall 87.7%, precision 83.3%, F1 85.4%, and every per-clip row matching docs/eyeblink8-result.txt. A maximum-cardinality bipartite matching gave the same TP on all eight clips, so greedy is not flattering the score.
- FRAME ACCOUNTING IS EXACT. Parsing the MP4 stsz/stts atoms directly gives 15784/11182/9216/5405/10663/5134/9077/4895 = 71,356, identical to the `# frames_measured:` header in every exported CSV, and identical to the AVI idx1 video-chunk counts, which independently proves prepare_eyeblink8.py's remux lost nothing.
- THE MEASUREMENT CODE HAS NOT MOVED SINCE THE PUBLISHED RUN. `git diff --stat 5e7af7e..HEAD -- src/ public/` is 3 files, 147 insertions, 3 deletions: additive functions in fpsGate.ts and frameClock.ts plus the status-line wiring in main.ts. Nothing in blink.ts, aperture.ts, blinkLog.ts, constants.ts or src/io changed, so HEAD would export the same CSVs.
- THE 72.0% MISS CLAIM RE-DERIVES. My own matcher produced 50 misses, of which 36 carry at least one frame the annotator marked fully closed = 72.0%, and the set of 50 (clip, blink_id) pairs is identical to tables-current-run/eyeblink8_misses.csv.
- THE GUARD IS AUTOMATIC, NOT OPTIONAL. checkBundle is called at tools/measure_corpus.mjs:99-104 before the browser launches and exits non-zero on mismatch, and its decision is a pure function unit-tested in test/tools/bundleGuard.test.ts.
- NO FLOAT DRIFT IN THE SEEK SCHEDULE. videoStepper.ts:273 computes `origin + (index + 0.5) * step` from the index every iteration rather than from the previous answer, with the reasoning written down at lines 255-259.
- THE EXPORTED fps IS A PROPERTY OF THE CLIP. main.ts:1544-1546 pushes nowMs (media time in file mode) into frameTimestampsMs before measureFps, so the fps column in seconds.csv does not carry the machine's speed.
- THE MODEL IS PINNED BY THE REPOSITORY. public/models/face_landmarker.task is tracked in git (3.7 MB), and @mediapipe/tasks-vision 1.0.0 is pinned with an integrity hash in package-lock.json.
- THE PROJECT ALREADY NAMES ITS OWN PROVENANCE GAP. STATE.md:235-238 says of the two committed run logs: "nothing in either file tells you which" measured the right code, and issue-174-repeatability.md states plainly that the published run lives outside the repository and that seven of eight clips have never been tested for repeatability.
- THE THREE PAST STEPPER BUGS ARE PARTLY COVERED. The e2e test "stepping measures every frame of a fast clip" (60 fps, 60 frames, asserted within +/-1) would fail on both the 180-of-60 and the 27-of-60 regressions, and the 60 fps fallback that doubled a 15,784-frame clip is now a refusal (videoStepper.ts:234-241) with checkStepping as a second net, unit-tested in test/core/frameClock.test.ts:246-269.

---

## What each auditor could not check

### E1, the alertness score: are the weights meaningful, are the ramp floors derived as claimed, what does the number actually measure, is available:false honest, and does the published text overstate it

- Whether real post-#113 resting PERCLOS actually stays below the 5% floor. This needs a live camera session with a real face; MANUAL item 40's amendment note gives no re-measured number, and no CSV export in the repo carries a resting PERCLOS figure.
- Whether the score's short caveat is truly absent from the rendered page. I read the DOM assembly in src/main.ts (alertnessBox children, the unused .caveat rule, the unimported demoNoticeShort) rather than loading index.html in a browser.
- The external claim behind 'the most validated drowsiness proxy'. No citation exists anywhere in the repository to check it against, and I did not go outside the repo.
- Whether any alternative weighting was ever considered and rejected. decisions/ holds three ADRs (stack, model-hosting, e2e-testing), none about the score, and ROADMAP.md row 96 and its ten amendments record no weight deliberation.

### E2 — blink closing velocity and the amplitude-over-velocity ratio (sampling adequacy, unit algebra, peak-finder correctness)

- The true human lid-closing trajectory. The repository holds no high-speed ground truth, so the error magnitudes in the sampling findings come from two standard models (minimum-jerk, half-cosine) with closing durations of 50, 75 and 100 ms, not from measurement. The DIRECTION and the frame-rate dependence are robust across both models; the exact percentages are model-based estimates.
- The frame rate of the live session behind test/MANUAL.md:30's "A/V somewhere around 30 to 150 ms" band. I can show the corpus band's floor is exactly 1000/30 ms, but I cannot prove the manual band's lower edge is that same artefact, only that it coincides.
- Whether the DROZY nulls would change under a resolution-aware estimator. DATASETS.md requires the source video deleted once features are computed, so the analysis cannot be re-run in this worktree; the attenuation argument is analytic, not a re-computation.
- The live-camera path's actual sampling interval in use. src/main.ts feeds whatever the browser delivers, so the per-user frame interval, and therefore the A/V floor each user sees, is not fixed anywhere I could read off.

### E3 — the iris ruler, aperture in millimetres, and the eye aspect ratio

- Whether MediaPipe's iris landmark model already bakes an 11.7 mm or canonical-face scale into its own predictions, which would make the ruler partly circular. The model is a binary blob and MODEL_CARD.md:112-114 states its biases are not audited here.
- The real-world size of the yaw error. My 13.27% comes from the repository's own pinhole generator (test/fixtures/syntheticFace.ts), an idealised planar face; a real orbit is not planar, so the true figure at 25 degrees could be larger or smaller. No clip in this repository carries a measured head angle alongside a ground-truth aperture.
- The population SD for horizontal visible iris diameter. I am working from memory of Ruefer, Schroeder and Erb (Cornea, 2005) and similar white-to-white surveys, roughly 11.71 mm mean and about 0.42 mm SD; I could not fetch the paper here, so treat the SD as approximate and the derived percentages as order-of-magnitude.
- The live camera's actual aspect ratio, which sets the EAR anisotropy factor. src/main.ts passes canvas.width and canvas.height, so the factor is whatever the real stream delivers; I used 1280x720 because that is what test/core/aperture.test.ts:86 uses for the recorded fixture.

### E4/E5 — every magic number, and the four constants added under pressure (BLINK_REFRACTORY_MS, EYES_SHUT_FRACTION, MAX_BLINK_DURATION_MS, MIN_BLINK_FPS)

- The "13 detections, F1 92.1 -> 93.6" figure central to issue #178 cannot be re-derived from the repository: sim.py reads a per-frame trace directory (scripts/replay/traces) that is not committed, and rebuilding it means re-running the landmark model over 71,354 frames.
- What raising MAX_BLINK_DURATION_MS to 1000 would cost the long-closure detector is unmeasurable here: Eyeblink8 carries no long-closure or microsleep ground truth, only blink intervals.
- The owner's 2026-08-05 and 2026-08-06 live sessions (shut floor 2.2-2.5 mm, reading droop 3.3-3.6 mm at baseline 7.2) are not stored as data anywhere in the repository, so the droop half of EYES_SHUT_FRACTION's midpoint cannot be verified, only read.
- The "deliberate rapid blinking tops out around five blinks a second" premise behind BLINK_REFRACTORY_MS carries no citation in constants.ts or PR #190, and I had no source to check it against.
- Whether BASELINE_MEDIAN_CEILING_FACTOR = 1.4 now makes the #126 ratcheted regime unreachable: the ceiling binds against the median of a 600-sample window, but during the 30 s learning phase the sample list is unbounded (baseline.ts:42-53), so a long wide-eyed stretch lifts the median with the p90 and the ceiling does not bite. Testing that needs a real session, not a fixture.

### E6 — correctness of the Python statistics (Spearman, permutation test, Holm, the DROZY pre-registration, the fps exclusion rule)

- The DROZY exports are not in the repo (no DROZY *.seconds.csv or KSS.txt), so I could not re-run analyse_drozy.py end to end or reproduce the seven rho values. I verified the Holm and permutation arithmetic against the published p-vector instead, which reproduces docs/drozy-result.txt exactly.
- In docs/drozy-result.txt the 'long closures' row has chance max 0.364 exactly equal to its own observed 0.364, while every other feature's chance max is roughly double its observed. That is plausible for a heavily tied integer count whose attainable |rho| values are few, but without the data I cannot confirm the observed value is the maximum attainable arrangement.
- Whether the two-minute window (plan:54, seconds 60 to 180) was actually applied. That happens in the transcode step outside analysis/, and no DROZY export is present to check row counts against 120.
- Whether _within_subject_agreement's operationalisation matches what the plan meant by 'moves in the same direction' (analyse_drozy.py:85-91 compares only the lowest-KSS and highest-KSS session and discards the middle one for three-session subjects). The plan states the bar (3 of 5) but not the method, so there is nothing to compare against.
- Whether the exclusion-bias figures printed in docs/drozy-result.txt (mean KSS 6.38 excluded vs 4.60 analysed, gap +1.78) reproduce. The arithmetic in analyse_drozy.py:157-169 is a plain statistics.mean difference and is correct as written, but KSS.txt is not in the repo.

### E7 — provenance of the published benchmark: does the number come from the code this repository holds now?

- Whether the bundle that produced datasets/eyeblink8-measured-refractory (files stamped 9 Aug 21:32-21:48) is the one HEAD builds. No run log exists for that run; only the 01:39 and 10:07 logs are committed, and neither contains the guard's "Serving the build we made" line.
- Which WebKit build measured the corpus. tools/measure_corpus.mjs uses Playwright's webkit, package.json carries a caret range, and no evidence file records the browser version or revision.
- Whether the GPU delegate is bit-reproducible on the maintainer's machine. Verifying the byte-for-byte claim needs a browser run, which I did not perform.
- Whether re-running the corpus today still yields 358/408. That is a ~20 minute browser run and would have written to dist/, which the hard rules forbid in this worktree.
- The three off-by-one regressions on WebKit specifically. The webkit e2e project is disabled under CI (playwright.config.ts:47) and I did not run `npm run e2e` locally.
