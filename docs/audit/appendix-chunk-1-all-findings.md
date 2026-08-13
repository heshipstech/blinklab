# Appendix: Chunk 1, all findings as produced

The complete, unedited output of the eight Chunk 1 auditors and the
skeptics who tested them. `chunk-1-docs-config-process.md` is the
write-up; this file is the raw record behind it, kept so nothing is lost
to a summary.

Produced 10 August 2026.

---

## Verification key

- **SURVIVED** a skeptic told to refute it, severity as corrected.
- **REFUTED** as stated. The corrected statement is given.
- **UNTESTED**. No skeptic saw it. Treat as a lead, not a conclusion.

---

## All 61 findings

### C1-01. STATE.md is 405 lines against a hard ten-line maximum

|                             |              |
| --------------------------- | ------------ |
| Constraint                  | B4           |
| Severity as filed           | high         |
| Verdict as filed            | violation    |
| Verification                | **SURVIVED** |
| Severity after verification | **low**      |

**Evidence.** `wc -l STATE.md` → 405 STATE.md; `ls -la` → 18982 bytes

**Detail.** The master prompt fixes STATE.md at ten lines maximum. The file is 405 lines and 19 KB, a 40x overrun, and 88 commits have touched it (`git log --oneline -- STATE.md | wc -l` → 88) without the cap ever being reasserted. Because this is the file every new session reads first, the overrun spends session context on narrative before any work starts, which is exactly the failure mode this project has hit repeatedly.

**Corrected statement.**

**Skeptic's reasoning.** The overrun is real and unamended: `wc -l STATE.md` → 405, and the cap is corroborated inside the repo itself at LEARNING.md:8 ("STATE.md is a ten line snapshot of where we are"), with no covering amendment (ROADMAP.md:5-25 lists ten amendments, none about STATE.md), no ADR in decisions/, and no issue. But the auditor's framing is wrong in two ways: the cap was in fact honoured for 85 of the 88 revisions (every version from 7012c1c on 2026-07-28 through 8cdb1df on 2026-08-08 is exactly 7 lines; the growth is entirely 8c0b1d7 → 405 over the last two days), and that growth carries a written rationale in its commit message — "docs: make STATE.md a handoff for an unattended run (#166) ... may outlive the context that started it" — so this is a reason recorded in history but never reconciled with the standing doc, not a silent drift. Severity high is inflated for a documentation-hygiene item whose content is load-bearing operational knowledge (the stale-server trap at STATE.md:189-232 that cost a day) and whose ~19 KB is a few percent of a session context; the sharper, cheaper sub-finding is the format break — the `Next increment` field present in the original 7-field file (git show 7012c1c:STATE.md) is now absent (`grep -ci "next increment" STATE.md` → 0) and `Known issues` / `Test count` are buried at STATE.md:372 and :376.

### C1-02. One of the seven STATE.md fields is absent and two more are buried 370 lines down

|                             |              |
| --------------------------- | ------------ |
| Constraint                  | B4           |
| Severity as filed           | high         |
| Verdict as filed            | violation    |
| Verification                | **SURVIVED** |
| Severity after verification | **medium**   |

**Evidence.** `grep -ni "next increment" STATE.md` → no match. `grep -n "^Last increment:|^Last commit:|^Live demo:|^Currently working:|^Known issues:|^Test count:" STATE.md` → 1, 3, 4, 5, 372, 376

**Detail.** "Next increment:" does not appear anywhere in the file. "Known issues:" (line 372) and "Test count:" (line 376) exist but sit below 370 lines of prose, so a reader who opens the file sees only four of the seven fields. Two of those four also break the specified shape: "Last increment:" is a two-line prose sentence ("the overnight run of 9 to 10 August 2026...") with no increment number where the format wants "2.3", and "Last commit:" reads "squash merge of pull request #198 on 2026-08-10" with no sha where the format wants "<sha> on <date>".

**Corrected statement.**

**Skeptic's reasoning.** Confirmed by my own commands: `grep -ni "next increment" STATE.md` exits 1 with no match, and the other six fields sit at STATE.md lines 1, 3, 4, 5, 372, 376. The seven-field format is not the auditor's invention: `git show 7012c1c:STATE.md` is exactly 7 lines with all seven fields including `Next increment: 0.2`, and walking every commit shows 40 versions at 7 lines/7 fields until 8c0b1d7 (PR #166) dropped to 6 fields and 58 lines, now 405 lines. No ROADMAP amendment, ADR or doc authorizes it, and LEARNING.md:8 still claims "STATE.md is a ten line snapshot", so the repo contradicts itself. I downgrade to medium: commit 8c0b1d7's message gives a written reason for the growth ("may outlive the context that started it"), and the auditor's sub-claim that `Last commit:` should carry a sha is wrong, since the seed file itself reads "pushed to chore/0-1-docs on 2026-07-28" with no sha and the PR-squash form appears in ~30 historical versions.

### C1-03. STATE.md has become a running narrative document, not a status header

|                   |              |
| ----------------- | ------------ |
| Constraint        | B4           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** `grep -n "^## " STATE.md` region sampled at lines 6, 55, 365-405; content includes "## Where things stand", "## The datasets folder", "## DROZY, which is also ready"

**Detail.** Beyond the ten-line cap, the file has absorbed dataset setup instructions, shell exports, DROZY throughput arithmetic, CI troubleshooting ("npm run format:check is the one people forget") and held-result narrative. This is genuinely useful material, but it belongs in DATASETS.md, LEARNING.md or README, and its presence here is what pushed the seven contract fields apart.

### C1-04. CONTRIBUTING.md, SECURITY.md and CHANGELOG.md do not exist, and no roadmap row will ever create CONTRIBUTING.md

|                             |             |
| --------------------------- | ----------- |
| Constraint                  | B1          |
| Severity as filed           | high        |
| Verdict as filed            | violation   |
| Verification                | **REFUTED** |
| Severity after verification | **low**     |

**Evidence.** `git ls-files | grep -i "contribut|security|changelog"` → empty; `find . -path ./node_modules -prune -o -iname "*contribut*" -print -o -iname "*security*" -print -o -iname "*changelog*" -print` → empty; `git log --all --diff-filter=D --name-only` → none ever deleted

**Detail.** Three of the twelve required root files are absent and none has ever existed in history. CHANGELOG.md is roadmap row 8.3 (ROADMAP.md:119, unticked) and a security policy is part of row 8.5 (ROADMAP.md:121, "Dependabot and a basic security policy", unticked, and it does not name SECURITY.md). CONTRIBUTING.md has no row at all: the only matches for "contribut" in ROADMAP.md are rows 6.5 and 6.6 about the score contribution panel, so the ladder as written would never produce it.

**Corrected statement.**

**Skeptic's reasoning.** The absence is real (`git ls-files | grep -iE "contribut|security|changelog"` is empty, and a full `git rev-list --all` tree scan confirms they never existed), but the finding is overstated: two of the three are scheduled by the master plan's own ladder in a phase not yet reached, at ROADMAP.md:119 (8.3 CHANGELOG.md, unticked) and ROADMAP.md:121 (8.5 security policy, unticked), with README.md:482 stating Phase 7 is still under way and only 8.2 and 8.4 of Phase 8 ticked, so those are openly tracked unfinished increments rather than a silently broken rule. Only CONTRIBUTING.md is a genuine untracked gap (grep for "contribut" in ROADMAP.md matches only rows 6.5/6.6 about the score contribution panel, and none of the 88 issues mentions it), and its substance is partly carried by .github/pull_request_template.md and README.md:503-514; nothing here touches correctness, measurement, privacy or users, so "high" is inflated.

### C1-05. LEARNING.md cites SECURITY.md as an existing promise the project made

|                   |              |
| ----------------- | ------------ |
| Constraint        | B1           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** LEARNING.md:141 — "A promise in SECURITY.md is a claim, an empty network tab is evidence."

**Detail.** The line treats SECURITY.md as a document that exists and is being outdone by evidence. The file has never existed. The privacy stance it refers to does live somewhere real (README.md:476-478), so the substance is not missing, only the named file and the honest cross-reference.

### C1-06. src/ui was never created; all rendering sits in a 2764-line src/main.ts

|                   |              |
| ----------------- | ------------ |
| Constraint        | B2           |
| Severity as filed | medium       |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** `ls -d src/ui` → No such file or directory. `ls src` → core, io, main.ts, vite-env.d.ts. `wc -l src/main.ts` → 2764

**Detail.** The master prompt names four source locations and one is absent. This is marked partial rather than a bare violation because SPEC.md:11 states the deviation explicitly and gives a reason, and ARCHITECTURE.md:88-92 documents the real layout rather than the planned one, so nothing is hidden. The reason itself is examined in the next finding.

### C1-07. The written justification for dropping src/ui is contradicted by the file it defends

|                             |             |
| --------------------------- | ----------- |
| Constraint                  | B2          |
| Severity as filed           | high        |
| Verdict as filed            | violation   |
| Verification                | **REFUTED** |
| Severity after verification | **low**     |

**Evidence.** SPEC.md:11 vs `wc -l src/main.ts` → 2764 (next largest source file is src/io/videoStepper.ts at 314); `grep -c "toFixed" src/main.ts` → 17; `grep -rn "src/main" test --include="*.ts"` → no match

**Detail.** SPEC.md:11 justifies the missing folder with "the page is small enough that one wiring file has stayed readable" and "every string it renders that carries meaning is produced by a tested pure function in core". Both halves fail on inspection: main.ts is 8.8x the next largest file in src/, and it builds 17 measurement-bearing display strings inline (lines 717, 782, 1200, 1615, 1629, 1654, 1691, 1836, 1850, 1927, 1965, 1993, 1998, 2061, 2065, 2091, 2197), several of which compute in the renderer, e.g. `(1 / summary.frameIntervalSeconds).toFixed(1)` at line 782 derives a frame rate and `(perclos * 100).toFixed(1)` at 2091 converts a unit. No unit test imports src/main.ts, so all 2764 lines rest on the 7 end-to-end tests. The deviation is honestly disclosed; the stated reason for it is a rationalisation.

**Corrected statement.**

**Skeptic's reasoning.** The raw counts are real (`wc -l src/main.ts` = 2764, `grep -c toFixed` = 17, no test imports src/main), but the inference fails three checks the auditor skipped: ARCHITECTURE.md:139 already states plainly that "main.ts is long and does the wiring by hand, which is honest for its size and would not survive a second developer without being split" and names splitting it as the first thing a new engineer would want to change, and decisions/ADR-0003-e2e-testing.md gives the written, dated reason main.ts has no unit tests (e2e proves wiring; the project bans mocks) — the auditor also miscounts those as 7 when `grep -c "^test(" test/e2e/*.spec.ts` returns 5. Neither cited example computes a measurement: main.ts:782 inverts `frameIntervalSeconds` produced at src/io/videoStepper.ts:265, under an eight-line comment at main.ts:773-781 explaining why a rate is shown, and main.ts:2091 is a percent conversion of `perclosValue()` from src/core/perclos.ts — the auditor's own phrase "converts a unit" concedes it; every number in the 17 strings traces to a core or io function (`coefficientOfVariation`, `perclosValue`, `analyzeClosing`, `fixationStats`), and 12 core modules return strings including the two SPEC cites (src/core/blinkLog.ts, src/core/scorePanel.ts). What survives is only that SPEC.md:11's universal "every string it renders that carries meaning" is over-broad, since labels like main.ts:1654 are assembled inline, and "stayed readable" sits in tension with ARCHITECTURE.md:139 — a wording imprecision, while the genuine B2 defect (src/ui absent) is already counted separately, so this finding double-counts it as an honesty failure.

### C1-08. Presentation logic lives inside src/core because there is nowhere else for it to go

|                   |              |
| ----------------- | ------------ |
| Constraint        | B3           |
| Severity as filed | medium       |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** src/core/scorePanel.ts:36,51 (formatDriver, panelSummary); src/core/blinkLog.ts:46 (formatBlinkEvent); src/core/notice.ts:11; src/core/fpsGate.ts:18,45; src/core/validityGate.ts:48; src/core/sparkline.ts:50 (widthPx/heightPx → Point2[][]); src/core/videoLayout.ts:6 (displaySize); src/core/deviceList.ts:21 (shouldShowPicker); src/core/heatmap.ts:9 (HEATMAP_COLS/ROWS)

**Detail.** Every one of these is genuinely pure by the technical test: deterministic, no browser access, no import outside core. But by role they are src/ui work. The clearest cases are deviceList.shouldShowPicker (a visibility decision about a control), videoLayout.displaySize (pixel layout arithmetic), sparklineSegments (canvas coordinate mapping), and scorePanel.panelSummary (English sentence assembly, including singular/plural agreement). This is a direct consequence of finding B2: with no ui folder, presentation that deserved a test had only core to live in, and the project chose testability over placement. That is the defensible half of the trade and SPEC.md:11 names it; the placement is still off-spec.

### C1-09. The purity ESLint rule has three latent gaps: dynamic import, bare directory import, and unnamed browser globals

|                   |              |
| ----------------- | ------------ |
| Constraint        | B3           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** node_modules/eslint/lib/rules/no-restricted-imports.js:857-873 lists only ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration, TSImportEqualsDeclaration — no ImportExpression. Matcher probe: ignore({allowRelativePaths:true}).add(['**/io/**']).ignores('../io') → false. eslint.config.js:40-51 names only window, document, navigator, while line 23 applies globals.browser to every file

**Detail.** I did not execute the linter; this is read from the installed rule source and a direct probe of the matcher it builds. A dynamic `import("../io/camera")` from core would not be reported, since the rule has no ImportExpression visitor. A bare `from "../io"` would not match `**/io/**`, though nothing in src/io is an index file so that form would not resolve today anyway. And no-restricted-globals names three globals while globals.browser leaves localStorage, sessionStorage, fetch, performance, crypto, location, indexedDB, requestAnimationFrame, globalThis and self defined and permitted inside core. None of the three gaps is currently exploited (verified by grep over src/core/*.ts), so this is a latent weakness in a rule that does hold today, not a live breach.

### C1-10. Both LEARNING.md and docs/log.md stop dead on 8 August; 35 merged pull requests have landed since with no entry in either

|                             |              |
| --------------------------- | ------------ |
| Constraint                  | B5+B6        |
| Severity as filed           | high         |
| Verdict as filed            | violation    |
| Verification                | **SURVIVED** |
| Severity after verification | **medium**   |

**Evidence.** `git log -1 --format="%h %ad %s" --date=short -- LEARNING.md` and the same for docs/log.md both return `35461f3 2026-08-08 feat(ui): three-tier boxed layout ... (#159)`. `gh pr list --state merged --limit 250` → 35 merged PRs numbered above 159: 160-173, 180-191, 194, 196-203. PR #159 merged 2026-08-08T16:29:36Z; PR #203 merged 2026-08-10T07:12:59Z.

**Detail.** The trail covers nothing from the last two working days of the project, which were also two of its three busiest (20 commits on 08-09, 8 on 08-10). Unrecorded work includes the entire UI redesign (#160-#167, #171, #185-#187), the Eyeblink8 corpus validation and its correction (#173), five behaviour changes to the measurement core (#169 refuse an unknown frame rate, #172 blink-log deletion, #188 trace bounds, #189 clip-derived clock, #190 refractory period), and the whole DROZY analysis (#194, #196-#201). No issue tracks this gap: `gh issue list --state all --limit 200` returns 84 issues and only #108 concerns the doc trail, and it covers a different, earlier gap.

**Corrected statement.**

**Skeptic's reasoning.** Verified: `git log -1 -- LEARNING.md` and `-- docs/log.md` both return `35461f3 2026-08-08 ... (#159)`, while `git blame -L 118,118 ROADMAP.md` and `-L 120,120` give `c8554dee 2026-08-09` for ticked rows 8.2/8.4 and `-L 111,111` gives `d8d250c 2026-08-10` for ticked row 7.7, so real increments landed with no note, and `gh issue list --state all --limit 250` shows only #108, which covers the earlier 5.6-6.1 gap. The auditor overstated it though: the 9-10 August substance is documented at HEAD in ROADMAP.md:18 and :20 (amendments 8 and 9, dated and reasoned), STATE.md, README.md, MODEL_CARD.md and the 42-file docs/evidence/2026-08-09/ folder with six per-issue write-ups, and the gap itself is recorded in AUDIT_PLAN.md:378-381. The headline also misstates the rule as per pull request when B5/B6 are worded per increment, so this is a doc-trail lapse where the knowledge survives, not a high-severity defect.

### C1-11. Three ticked ROADMAP rows have no LEARNING.md entry at all

|                             |              |
| --------------------------- | ------------ |
| Constraint                  | B5           |
| Severity as filed           | high         |
| Verdict as filed            | violation    |
| Verification                | **SURVIVED** |
| Severity after verification | **medium**   |

**Evidence.** `grep -c "^## 7.7 " LEARNING.md` → 0; same for `^## 8.2 ` and `^## 8.4 ` → 0. Rows are ticked at ROADMAP.md:111 (7.7), :118 (8.2), :120 (8.4). `git log -S"x] 8.2" -- ROADMAP.md` → c8554de 2026-08-09 (#194); `git log -S"x] 7.7" -- ROADMAP.md` → d8d250c 2026-08-10 (#201).

**Detail.** A sweep of all 65 ticked rows (`grep -c "^- \[x\]" ROADMAP.md` → 65) found LEARNING.md covers 62 of them. The three misses are exactly the rows ticked after the trail stopped. 8.2 (ARCHITECTURE.md) and 8.4 (MODEL_CARD.md) shipped new root documents and 7.7 is the negative control, a genuinely teachable concept, so none of the three is a trivial row.

**Corrected statement.**

**Skeptic's reasoning.** Every element reproduces: `grep -c "^## 7.7 "` / `^## 8.2 ` / `^## 8.4 ` on LEARNING.md all return 0, rows are ticked at ROADMAP.md:111, :118, :120, and the ticking commits are c8554de (2026-08-09, #194) and d8d250c (2026-08-10, #201); the decisive fact the auditor missed is that `git log -1 --date=short -- LEARNING.md` returns 35461f3 2026-08-08, so the file predates all three deliveries and no entry can exist under any heading name. No written excuse exists anywhere: ROADMAP amendments 1-10, the three ADRs in decisions/, and STATE.md are silent, open issue #108 covers docs/log.md rows 5.6-6.1 (different file and range), and .github/pull_request_template.md:15 carries the unticked "LEARNING.md has the plain English note" checkbox, so the rule was broken silently. Severity drops to medium because the substance is misfiled rather than lost, with ARCHITECTURE.md:5 naming itself as row 8.2, MODEL_CARD.md standing as its own record for 8.4, and 7.7's reasoning in ROADMAP amendment 8 and README.md:390-391.

### C1-12. Nine ticked ROADMAP rows have no docs/log.md line; the 5.6-to-6.1 block has been open debt since 4 August

|                             |              |
| --------------------------- | ------------ |
| Constraint                  | B6           |
| Severity as filed           | high         |
| Verdict as filed            | violation    |
| Verification                | **SURVIVED** |
| Severity after verification | **low**      |

**Evidence.** Sweep of all 65 ticked rows with `grep -c ", <id>," docs/log.md`: 5.6, 5.7, 5.8, 5.9, 5.10, 6.1, 7.7, 8.2, 8.4 all return 0. `git log --format="%ad" --date=short -- docs/log.md | sort | uniq -c` shows only 1 touch on 2026-08-04 against 7 commits that day. `gh issue view 108` → OPEN, created 2026-08-04T20:01:17Z, titled "docs/log.md missing one-line entries for 5.6 through 6.1".

**Detail.** docs/log.md covers 56 of 65 ticked rows. The 5.6-6.1 block (PRs #95, #97, #99, #101, #103, #105, all merged 2026-08-04) got LEARNING.md entries but no log lines, and the project detected this itself the same evening and filed issue #108, which is still open six days later. That self-detection tempers the severity but does not clear the rule: the debt was never repaid and three further rows joined it.

**Corrected statement.** docs/log.md is missing one-line entries for 9 of 65 ticked ROADMAP rows; six (5.6 to 6.1) are tracked in open issue #108 with their content preserved in LEARNING.md, and three (7.7, 8.2, 8.4) are untracked lag from the 9-10 August work

**Skeptic's reasoning.** The facts reproduce exactly and I could not break them: `grep -oE '^- \[x\] [0-9]+\.[0-9]+[ab]?' ROADMAP.md` yields 65 ticked rows, and `grep -c ", <id>," docs/log.md` returns 0 for precisely 5.6, 5.7, 5.8, 5.9, 5.10, 6.1, 7.7, 8.2, 8.4 (a looser any-mention regex also finds nothing; the single 7.7 hit at docs/log.md:66 is "rows 7.4 to 7.7 are held", not a delivery line). `gh issue view 108` confirms OPEN, createdAt 2026-08-04T20:01:17Z. What does not survive is the framing and the severity. Six of the nine are recorded debt, not silent debt: #108 names exactly 5.6 through 6.1 and its backfill sources, it is listed in STATE.md:373 under "Known issues", and LEARNING.md carries a full titled section for every one of those six (lines 371, 379, 387, 395, 404, 412), so no content is lost, only the one-line index entry. The genuinely unrecorded three are 7.7, 8.2 and 8.4, which landed in PR #194 on 9-10 August (commits c8554de, e74c2a5), one to two days of lag rather than six, with STATE.md's opening lines recording the delivery and the deliverables verifiably present (ARCHITECTURE.md 143 lines, MODEL_CARD.md 168 lines, the 1000-shuffle in analysis/tools/analyse_drozy.py). This is bookkeeping in a redundant documentation set; it touches no measurement, no published number and no user-facing claim.

### C1-13. STATE.md stopped being updated on every increment from 8 August onward, including on the increment that ticked row 7.7

|                   |              |
| ----------------- | ------------ |
| Constraint        | B5 (step 10) |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** `git log --oneline -- STATE.md | wc -l` → 88 of 125 total commits. Cross-referencing commit hashes: of the 37 commits that never touched STATE.md, 36 are dated 2026-08-08 or later and the 37th is the initial `chore: initialize repository`. First miss is 5fd7014 2026-08-08 (#136), which is the 55th commit from HEAD. #201 (d8d250c, 2026-08-10) ticked ROADMAP row 7.7 and did not touch STATE.md.

**Detail.** Discipline was perfect for the first 70 commits: every commit after the repo init through #135 updated STATE.md. It then degraded to roughly half (18 of 35 commits on 08-08, 7 of 20 on 08-09, 2 of 8 on 08-10). The rule the master prompt states as "STATE.md always" is also encoded in the repo's own PR template at .github/pull_request_template.md:14, so each miss is a self-declared unmet definition of done.

### C1-14. README.md publicly claims a note per increment, a claim the file no longer supports

|                   |              |
| ----------------- | ------------ |
| Constraint        | B5           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** README.md:511 reads "[LEARNING.md](LEARNING.md), one plain English engineering note per increment, including the ones that record a mistake." Rows 7.7, 8.2 and 8.4 are ticked in ROADMAP.md with no entry (grep evidence above).

**Detail.** This is the documentation-trail gap escaping into a reader-facing promise. A stranger reading the README is told the mapping is complete. It is complete for phases 0 through 6 and for 7.0 to 7.4, and empty for everything after 8 August.

### C1-15. Phase 7 LEARNING.md entries break the 5-to-10-line ceiling and the one-concept rule, drifting into incident reports

|                   |              |
| ----------------- | ------------ |
| Constraint        | B5           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** Non-blank body lines per entry: LEARNING.md:547 "7.0 The clock is the feature" = 12 lines / 1151 words, against a 271-word median across all 72 entries. Also 7.4 (LEARNING.md:573) 800 words, 7.3 (LEARNING.md:535) 701 words, 7.4c (LEARNING.md:615) 10 lines.

**Detail.** Entry 7.0 opens correctly with one concept (a recording carries its own clock) but then also covers interpolated currentTime, requestVideoFrameCallback, a model-load race, a mis-wired KSS prompt, a reset-state buffer bug and a throughput correction. It is honest and plain English rather than a change log, so this is partial, not a violation, but it is a measurable drift from "one concept, 5 to 10 lines" in exactly the phase where the project came under the most pressure.

### C1-16. STATE.md contradicts itself, showing the update ritual became append-only rather than a rewrite

|                   |              |
| ----------------- | ------------ |
| Constraint        | B5 (step 10) |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** STATE.md:1 says "Last increment: the overnight run of 9 to 10 August 2026. DROZY was measured for the first time". STATE.md:387 says "Only `KSS.txt` has been extracted so far, deliberately" and STATE.md:399 says "Nobody has measured either one. Measure a DROZY clip before planning around these numbers." STATE.md:3 says "Last commit: squash merge of pull request #198" while HEAD is #203.

**Detail.** The head of the file records the DROZY run as done; the tail, 380 lines later, still instructs the reader to go measure a DROZY clip. The file is also 405 lines long against checklist B4's ten-line, seven-field format, which is a separate dimension, but the length is what let the contradiction survive: the later increments appended to the top instead of rewriting the state.

### C1-17. The ADR series stops at ADR-0003 on 3 August, and six later decisions that meet the master prompt's own bar have none

|                   |              |
| ----------------- | ------------ |
| Constraint        | B7           |
| Severity as filed | high         |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** `ls decisions/` returns exactly ADR-0001-stack.md, ADR-0002-model-hosting.md, ADR-0003-e2e-testing.md. `git log --pretty=format:'%h|%ad|%s' -- decisions/` returns 3 commits, the last edf6ee4 on 2026-08-03.

**Detail.** Everything from Phase 6 onward, the entire measurement-science half of the project, was decided without an ADR: the 40 percent shut line (src/core/longClosure.ts:35, #116), PERCLOS adopting it (src/core/perclos.ts:27, #118), the 150 ms blink refractory period (src/core/constants.ts:99, #190), the choice of the Eyeblink8 and DROZY datasets (DATASETS.md, #143/#155/#191), stepped measurement mode plus four new CSV metadata columns (#149), and hand-writing the rank statistics instead of importing scipy (analysis/blinklab/stats.py, #194). Each is a heuristic replacement, a data-contract change, or a dataset choice, which are three of the master prompt's four named triggers.

### C1-18. The repository wrote down that 7.3's dataset choice would get an ADR, then did not write one

|                   |              |
| ----------------- | ------------ |
| Constraint        | B7           |
| Severity as filed | high         |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** LEARNING.md:74 "This comes back whenever we are tempted by a framework or a charting library, both of which now require a superseding ADR by their own rule, and at 7.3, where choosing a dataset gets the same treatment." PR #143 (5f9d17b) delivered 7.3 and touched no file under decisions/.

**Detail.** The dataset decision is instead spread across DATASETS.md, ROADMAP amendments 7, 9 and 10, and issue #142. That record is unusually thorough, including a counter-case left standing after the permission arrived (DATASETS.md:55-60), but it is not in the required format and not in the folder a reader is told to look in.

### C1-19. Amendment 8 was inserted mid-list on 10 August, silently renumbering the two amendments after it

|                   |              |
| ----------------- | ------------ |
| Constraint        | C4           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** `git show d8d250c -- ROADMAP.md` shows old "8. Accepted 2026-08-09: DROZY is unblocked too" becoming 9, old "9. Accepted 2026-08-08: Track B is unblocked" becoming 10, and a new 8 inserted. The same commit's body, line 28, reads "ROADMAP amendment 10 HOLDS rows 7.5 and 7.6" while ROADMAP.md:18 numbers that amendment 8.

**Detail.** The list is now out of chronological order (8 dated 2026-08-10, 9 dated 2026-08-09, 10 dated 2026-08-08), and one commit disagrees with the file it wrote. Amendments 1 to 7 keep their numbers, so cross-references in src/core/perclos.ts:11, src/core/longClosure.ts:21 and test/MANUAL.md remain correct; only the last three are unstable.

### C1-20. A 16-pull-request user interface redesign has no roadmap row, no amendment and, for 14 of the 16, no issue

|                             |              |
| --------------------------- | ------------ |
| Constraint                  | C5           |
| Severity as filed           | high         |
| Verdict as filed            | violation    |
| Verification                | **SURVIVED** |
| Severity after verification | **low**      |

**Evidence.** PRs #134, #135, #136, #159, #160, #161, #162, #163, #164, #165, #167, #171, #185, #186, #187, #188. Only #134 and #135 reference an issue (#133/#47). `grep -n -i "design|layout|visual" SPEC.md ROADMAP.md STATE.md` returns one hit, ROADMAP.md:40, about drawing video to a canvas.

**Detail.** This is the clearest silent scope creep in the repository. The roadmap contains no design or layout rows, no amendment was written to add any, and docs/UI.md (#161, merged 17:43 on 8 August) was written after #159 and #160 had already merged, so the specification followed the build rather than governing it. #186 and #188 are rework for defects introduced by #185 and the graph work.

**Corrected statement.** An owner-directed UI campaign of 16 pull requests has no ROADMAP row and no amendment; 14 carry no linked issue and 12 no log or LEARNING entry. Two supporting details in the original finding are wrong: the trace-cap defect fixed by #186 and #188 predates the campaign, and docs/UI.md preceded rather than followed the design build.

**Skeptic's reasoning.** Core verified: grep over ROADMAP.md finds no design or layout row, its ten amendments (lines 9-24) contain none about the interface, and `gh pr view <n> --json closingIssuesReferences` across all sixteen returns links only for #134 (47,133) and #135 (133), so 14 of 16 is exact. But the Detail is wrong twice: `git log --reverse -S"1200" -- src/main.ts` places the trace cap at f9d93a3 (increment 3.2, #51, 31 July) and 2820a5c (increment 5.6, #95, 4 August), so #186 and #188 fixed a latent pre-campaign defect rather than one the campaign introduced; and docs/UI.md merged 17:43 on 8 Aug, before the owner's design was built in #162 at 19:20, and docs/UI.md:3-5 says it was written "so a layout can be designed against worst cases", i.e. it preceded the build. The auditor also missed that docs/log.md carries dated entries for #134, #135, #136 and #159 and LEARNING.md:649 a full section on #159, so 12 rather than 16 are unrecorded, and that #151, #154, #156, #169 and #172 also lack issues, making this a slice of the already-recorded recon finding 15 rather than a distinct one. Severity is low because no measurement, published number or test is affected (the campaign shipped green, 433 to 456 unit tests plus 7 e2e across two engines) and the harm is traceability only; the sharper adjacent problem is that `git log -- docs/UI.md` shows one commit (87945c5) never updated, mentioning no nav bar, status banner or footer although src/main.ts:199, :252 and :2335 show the current page has all three.

### C1-21. 56 of 118 merged pull requests name no roadmap increment; the reconnaissance figure of 117 is one short

|                   |              |
| ----------------- | ------------ |
| Constraint        | C5           |
| Severity as filed | medium       |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** `gh pr list --state merged --limit 300` returns 118 records. Matching each title and branch against the roadmap row numbers parsed from ROADMAP.md gives 62 named and 56 unnamed. AUDIT_PLAN.md:62 itself says "118 pull requests" while its item 15 says "56 of 117".

**Detail.** The 56 is correct, the denominator is not. The unnamed work groups into eight campaigns: the UI redesign (16), detector defect rework (9: #116, #117, #118, #137, #138, #172, #190, #197, #198), the corpus and Track A measurement pipeline (12: #147, #150-#154, #156-#158, #169, #184, #189), the documentation-correction and save-state sweep (12: #144, #166, #168, #170, #173, #180-#183, #191, #199, #200), the DROZY analysis (3: #194, #196, #201), dataset permissions (1: #155), the audit itself (2: #202, #203) and one day-one bug fix (#23).

### C1-22. 41 of the 56 unplanned pull requests close no issue, so most scope creep left no ticket behind

|                   |              |
| ----------------- | ------------ |
| Constraint        | C5           |
| Severity as filed | medium       |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** Scanning the 56 PR bodies for Closes/Fixes/Resolves #N yields 15 matches (#23, #116, #117, #118, #134, #135, #137, #138, #153, #184, #189, #190, #197, #198, #200). The other 41 have none; 21 of those contain no issue reference of any kind.

**Detail.** The rule holds well for detector defects, where 8 of 9 fixes trace to a filed issue, and for the reproducibility campaign (#174 to #179). It does not hold for the UI campaign or the Track A pipeline work (#150-#158, #169), where behaviour changed with no ticket. Marked partial because the documentation sweeps and STATE.md upkeep are arguably not what the rule targets.

### C1-23. README says the refractory period "is planned and it is not built" thirty lines after describing it as built at 150 ms

|                   |              |
| ----------------- | ------------ |
| Constraint        | C6           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** README.md:328-330 "A refractory period, a short window after a blink in which a second one cannot be reported, should remove most of them. It is planned and it is not built." README.md:296-303 says a closure "is not counted if it ends within 150 milliseconds of the previous one" and that it removed 39 false alarms.

**Detail.** The stale block also carries pre-refractory counts, 53 and 41 of 53, against a headline of 72 false alarms elsewhere on the same page, and it is not labelled as history the way the superseded recall figures are. It is a leftover from before #190 merged, a documentation defect rather than a misrepresentation of the fitting question.

### C1-24. Amendments 4, 5 and 6 were each written in the same pull request as the code they justify, and 5 and 6 revise rows already ticked and merged

|                   |              |
| ----------------- | ------------ |
| Constraint        | C4           |
| Severity as filed | medium       |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** `git log -S` on ROADMAP.md places amendment 4 in 5354af2 (#61, the PR delivering 3.7), amendment 5 in 01e2448 (#116, the PR moving the shut line) and amendment 6 in 119c66d (#118). Rows 6.2 and 6.3 had already merged as #109 (2026-08-04) and #111 (2026-08-05) before amendment 5 changed their design on 2026-08-06.

**Detail.** None is a plan revision written in advance; all three are recorded at the moment the change lands. They are not bare post-hoc justification either: issue #112 (2026-08-05 22:32) and issue #113 (2026-08-06 10:29) each state the observed fault before the fixing PR opened, and amendment 5 departs from what its own issue proposed (P80) with a measured reason. Amendment 4's issue #60 was opened two minutes before PR #61, so git proves nothing about ordering there.

### C1-25. Amendment 8 was written after the analysis whose results it uses to hold two rows

|                   |              |
| ----------------- | ------------ |
| Constraint        | C4           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** Amendment 8 entered ROADMAP.md in d8d250c (#201, 2026-08-10 09:03). The DROZY analysis it cites landed in c8554de (#194, 2026-08-09 23:42) and f859bd2 (#196, 2026-08-10 01:26); docs/drozy-result.txt first appears in d8d250c itself.

**Detail.** This is a forward-looking hold rather than a justification of work already done, so it reads as a legitimate plan revision informed by evidence. Listed only because the sequence is after-the-fact and its acceptance date equals its commit date, unlike amendments 9 and 10 which precede the work they unblock.

### C1-26. Row 7.7 was ticked with a check satisfied only at the statistic level, and row 7.4's row text was rewritten at tick time

|                   |              |
| ----------------- | ------------ |
| Constraint        | C4           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** ROADMAP.md:111 keeps "Check: test asserting the collapse". The only matching test is analysis/tests/test_stats.py:73 test_noise_is_not_significant, which asserts p > 0.05 on eight hand-made points; `grep -n "shuffl" analysis/tests/test_drozy.py` returns nothing. ROADMAP.md:108 now describes 7.4 as "Delivered as a stepped measurement mode, which fixes #145", text added in 8cdb1df.

**Detail.** The shuffled-label control genuinely runs inside the analysis, 1000 shuffles with a fixed seed, and the result is published, so the substance exists. What is missing is a test that shuffles the DROZY labels and asserts the pipeline collapses, which is what the check clause names. Issue #148, the 7.4 ticket, is also still OPEN while the row is ticked.

### C1-27. The decision to keep every superseded published number is practised but never written down as a rule

|                   |              |
| ----------------- | ------------ |
| Constraint        | B7           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** docs/eyeblink8-result.txt:48 "THREE PUBLISHED NUMBERS, ALL KEPT"; STATE.md:104 "All three earlier runs are kept for comparison beside it"; docs/evidence/2026-08-09/README.md:78 keeps superseded tables deliberately. Searching README.md, STATE.md, PROJECT.md, SPEC.md, LEARNING.md and MODEL_CARD.md for a stated retention rule returns no policy statement.

**Detail.** The practice is followed consistently and is one of the repository's strongest habits. But PR #182's body says an unsupportable claim "was removed rather than made vaguer", so the real policy is keep superseded measurements, delete unsupported claims, and that distinction exists nowhere as a written rule a future contributor could apply.

### C1-28. Row 1.1 still points only at manual steps, although the master prompt's own assertion now runs in CI

|                   |              |
| ----------------- | ------------ |
| Constraint        | C2           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** ROADMAP.md:37 and ROADMAP.md:9 (amendment 1); test/e2e/calibration.spec.ts:18 `await page.getByRole("button", { name: "Start camera" }).click();`

**Detail.** The amendment's stated reason is off-target: the master prompt asked for a Playwright test that the permission-prompt path RENDERS A BUTTON, not that a headless browser click the OS permission dialog, and the former is trivially automatable. The defensible half of the reason is written down and true, that Playwright did not exist in the repo until 5.5. The substance landed anyway at 5.5 and runs on every CI run, but ROADMAP.md:37 was never updated to name it, so a reader tracing row 1.1 finds only test/MANUAL.md item 2.

### C1-29. Row 5.5's end-to-end calibration test only exercises the cancel path, never a completed calibration

|                   |              |
| ----------------- | ------------ |
| Constraint        | C3           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** test/e2e/calibration.spec.ts:3-8 ("The fake stream has no face, so samples can never collect. What this proves is the WIRING"); playwright.config.ts:4-6

**Detail.** The row promises "first end to end test of the calibration flow" and its stated check, "headless test passes in CI", is met (.github/workflows/ci.yml:26-27, run 31364960182 success). But the spec asserts only that the overlay opens on dot 1 of 9 and that one click cancels without writing a profile; nine dots completing and a profile reaching localStorage are never driven end to end. The limitation is honestly written down at the top of the spec, which is why this is partial rather than a violation.

### C1-30. Row 5.4b narrows the goal from gaze-point accuracy to four-way quadrant classification

|                   |              |
| ----------------- | ------------ |
| Constraint        | C3           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** ROADMAP.md:82 and ROADMAP.md:10 (amendment 2); test/core/calibrationProfile.test.ts:141-155

**Detail.** The master prompt's "Accuracy improves visibly after calibrating" implies a gaze point with measurable error; the amendment settles for reliable quadrant naming with the head still, which is a genuine reduction in ambition even though it is more concretely checkable. Two things earn it partial rather than violation: it was accepted 2026-07-28 before any code with a stated reason, and calibrationProfile.test.ts:141-155 actually delivers the master prompt's comparative claim, asserting that the uncalibrated split calls both TOP corners "bottom" while the calibrated one names them correctly.

### C1-31. Row 3.7's tilt invariance is proved only on a square frame, never at a real 16:9 aspect ratio

|                   |              |
| ----------------- | ------------ |
| Constraint        | C3           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** test/core/tiltInvariance.test.ts:18-19 (frame passed as 1000, 1000); test/fixtures/syntheticFace.ts:23 ("a square normalised space"); src/core/aperture.ts:10-13

**Detail.** The mathematical argument itself holds: apertureMm is a ratio of two image-plane distances (src/core/aperture.ts:66-84), roll about the camera axis is an isometry in pixel space, so the ratio is invariant, and the counterfactual at tiltInvariance.test.ts:78 pins the naive vertical measurement's loss at exactly cos(30). The untested edge is the aspect-ratio trap that aperture.ts:10-13 itself names: every tilt test runs at 1000x1000, while the app passes canvas.width/canvas.height (src/main.ts:1640-1641), and the non-square path is exercised only at roll near zero by the fixture test (test/core/aperture.test.ts:85). The synthetic generator projects into a square space by construction, so closing this needs a generator change, and the real-frame case is covered only by human eyes at test/MANUAL.md item 20.

### C1-32. 7.7's stated check does not exist: the negative control is a print, not a test

|                             |              |
| --------------------------- | ------------ |
| Constraint                  | C2           |
| Severity as filed           | high         |
| Verdict as filed            | violation    |
| Verification                | **SURVIVED** |
| Severity after verification | **medium**   |

**Evidence.** analysis/tools/analyse_drozy.py:97-116 (_shuffled_null) and :216-223 (print). `grep -rn "analyse_drozy|_shuffled_null" analysis/tests/` returns nothing (exit 1).

**Detail.** Row 7.7 is ticked and its check reads "test asserting the collapse". The only shuffle-the-labels artefact is _shuffled_null inside a tool script whose result is printed to stdout; no test in analysis/tests imports it or asserts anything about it. test_stats.py exercises permutation_p on hand-made synthetic pairs, which tests the statistic, not the collapse of this pipeline's real labels, and nothing anywhere asserts that a shuffled run falls to chance.

**Corrected statement.** Row 7.7 is ticked with "Check: test asserting the collapse", but no test covers the shuffle: the negative control is a print-only path, with an untested silent-zero branch that would fake a passing control

**Skeptic's reasoning.** Verified directly. `_shuffled_null` exists only at analysis/tools/analyse_drozy.py:97-116 and its single caller at :216-223 prints; a correct `grep -rnE "analyse_drozy|_shuffled_null"` over analysis/tests, test/ and .github returns nothing, so no test or CI step touches it (the auditor's own grep was malformed, missing -E, but the conclusion survives a correct search). `git show d8d250c --stat`, the commit that ticked row 7.7 on 2026-08-10, changed only README.md, ROADMAP.md and docs/drozy-result.txt while carrying "Check: test asserting the collapse" through unchanged, and no ADR, issue, STATE.md or LEARNING.md note waives it — ROADMAP amendment 8 records the delivery mechanism but leaves the check claim standing. Severity drops to medium rather than high because the control genuinely ran and was published (docs/drozy-result.txt:29-37 shows non-zero chance maxima of 0.36-0.79 against observed 0.001-0.444), the result is null, and rows 7.5/7.6 are HELD; it stays above low because analyse_drozy.py:107-108 returns 0.0, 0.0 when fewer than 3 pairs exist, an untested path that would print a zero null and make any observed correlation look like it cleared the control.

### C1-33. 8.4's MODEL_CARD.md contradicts README.md on two published numbers

|                   |              |
| ----------------- | ------------ |
| Constraint        | C3           |
| Severity as filed | medium       |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** MODEL_CARD.md:70 "78.6%" vs README.md:260-270 "36 of the 50 missed blinks, 72.0% ... An earlier version of this page said 78.6%"; MODEL_CARD.md:47-49 "its results are not yet published" vs README.md:355-429 (the published DROZY null result).

**Detail.** MODEL_CARD.md last changed in c8554de (9 Aug); the miss table was rebuilt in #200 and the DROZY result published in #201 (both 10 Aug) without touching it. The card's own most-emphasised line ("This is the most important line on the page") now tells a reader the sleepiness validation is unpublished when a null result is published two documents away, and its failure-mode section carries a figure the README explicitly retracts.

### C1-34. MODEL_CARD's "who it has been tested on" table counts clips as people

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | C3               |
| Severity as filed | low              |
| Verdict as filed  | cannot-determine |
| Verification      | **UNTESTED**     |

**Evidence.** MODEL_CARD.md:101-103 column "Number of people", row "Eyeblink8 subjects | 8"; docs/eyeblink8-result.txt:3 "8 clips, 408 annotated blinks".

**Detail.** Every source in this repository states a clip count for Eyeblink8, never a count of individuals; the per-clip table (docs/eyeblink8-result.txt:9-16) shows the eight clips were recorded on two dates. The card converts 8 clips into 8 people with no cited source. Row 8.4's whole purpose is "who it fails for", so the one number in that section is the one that needs a source.

### C1-35. 8.2's ARCHITECTURE.md states a test count that is 12 short

|                   |              |
| ----------------- | ------------ |
| Constraint        | C3           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** ARCHITECTURE.md:18 "461 unit tests run in about two seconds"; `npx vitest run` -> "Test Files 49 passed (49) / Tests 473 passed (473) / Duration 2.98s".

**Detail.** The count is stale by one day (the file last changed in c8554de on 9 Aug). Every other checkable claim in the document holds: 45 modules in src/core, one test file per core module, the 500 ms long-closure line (src/core/longClosure.ts:19 aliasing MAX_BLINK_DURATION_MS=500), the half-baseline blink line (constants.ts:138 BASELINE_THRESHOLD_FRACTION=0.5), the gate list against .github/workflows/ci.yml, and "two browser engines" (`npx playwright test --list` shows chromium and webkit locally; CI is chromium only, which playwright.config.ts:29-46 documents at length).

### C1-36. 7.4 is ticked with a stale open tracking issue and without the check the row names

|                   |              |
| ----------------- | ------------ |
| Constraint        | C2           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** `gh issue view 148 --json state` -> "OPEN"; `gh pr view 149 --json closingIssuesReferences` -> only #145. Row's check is "two frame sample test"; `grep -rni "two frame" test/` matches only test/core/fps.test.ts.

**Detail.** The behaviour is delivered: src/io/videoStepper.ts, the batch runner tools/measure_corpus.mjs, and coverage metadata in src/core/frameClock.ts. Issue #148 is open only because PR #149 wrote "Closes #145" and never referenced its own row issue, so this is bookkeeping, not missing work. The literal "two frame sample test" does not exist; what exists is stronger (test/e2e/videoFile.spec.ts:131-165 asserts the measured frame count equals the fixture's 60 within one), but the substitution is recorded nowhere in ROADMAP.md.

### C1-37. 6.6 has no snapshot test; hand-written exact-output assertions stand in, unrecorded

|                   |              |
| ----------------- | ------------ |
| Constraint        | C2           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** `grep -rn "toMatchSnapshot|toMatchInlineSnapshot|toMatchFileSnapshot" test/ src/` -> no matches. test/core/scorePanel.test.ts:193-226 "the panel as a whole, staged snapshots".

**Detail.** The row's check is "snapshot test". What exists is a block of toEqual assertions on the full rendered line list for four staged breakdowns. In practice that is at least as strong as a Vitest snapshot, since it cannot be regenerated with -u, but it is not the artefact the row names and neither ROADMAP.md's amendments nor docs/log.md:56 records the swap. Note also that only the pure string builders are covered; the DOM panel in src/main.ts:2163-2171 has no test.

### C1-38. 8.3 is correctly unticked, but two thirds of the row shipped and the roadmap does not say so

|                   |              |
| ----------------- | ------------ |
| Constraint        | C1           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** `git tag -l` -> v0.1.0 through v0.7.0 (7 tags); `gh release list` -> 7 releases, first v0.1.0 on 2026-07-28; `ls CHANGELOG.md` -> No such file; `ls .github/workflows` -> ci.yml, deploy.yml only.

**Detail.** Semantic version tags and the first GitHub Release v0.1.0, two of the row's three deliverables, are done and have been since Phase 0. CHANGELOG.md and the row's stated check, a release workflow, do not exist. Leaving the box unticked is the honest call, but the roadmap gives a reader no way to see that seven releases already exist.

### C1-39. Amendment 8's premise for holding 7.5 and 7.6 is contradicted by amendment 10 in the same file

|                   |              |
| ----------------- | ------------ |
| Constraint        | C1           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** ROADMAP.md:18 "The only dataset this project has permission for and can measure is DROZY" vs ROADMAP.md:22 (UTA-RLDD permission granted) and DATASETS.md:312-322 ("180 RGB videos ... 60 subjects ... Subject identity is explicit").

**Detail.** The engineering core of amendment 8 is sound and is backed by the repo's own data: 20 sessions from 13 subjects with the 16 excluded ones systematically sleepier (docs/drozy-result.txt confirms mean KSS 6.38 vs 4.60, analysed range 2-8 so every 9 is excluded, and nothing clearing correction), and a leave-one-subject-out score on that would be mostly hold-out noise. The overreach is the word "only": UTA-RLDD is permitted under amendment 10, has 60 subjects with KSS-derived labels, and no document in this repo records any reason it cannot be measured. Amendment 8 also names "more recordings ... from more people" as the unblocker, which describes the dataset it does not mention.

### C1-40. The Definition of Done checklist was silently abandoned at PR #134 and never used again

|                             |              |
| --------------------------- | ------------ |
| Constraint                  | F6           |
| Severity as filed           | high         |
| Verdict as filed            | violation    |
| Verification                | **SURVIVED** |
| Severity after verification | **medium**   |

**Evidence.** gh pr list --state merged --limit 300 --json number,body -q '.[] | "\(.number)\t\(if (.body|ascii_downcase|test("definition of done")) then "HAS-DOD" else "no-dod" end)"' -> 61 HAS-DOD, 57 no-dod of 118 merged PRs. Sorted by number: #2 through #132 all HAS-DOD except #93; #134 through #203 all no-dod except #181.

**Detail.** The template at .github/pull_request_template.md:7-19 carries the checklist as the master prompt requires, and it was applied faithfully for the first 60 pull requests (verified by reading #12, #49 and #128, all fully ticked with honest unticked rows). From #134 onward it vanishes for 56 consecutive pull requests, replaced by ad hoc prose or a "Gate | Result" table (#190, #198). No document in the repository explains the change: grep -rn -i 'definition of done' STATE.md PROJECT.md LEARNING.md ROADMAP.md README.md docs/*.md returns nothing.

**Corrected statement.** The Definition of Done checklist stopped being used at PR #134 with no written reason, and the items CI does not enforce lapsed with it: LEARNING.md notes on code PRs fell from 51 of 52 to 10 of 36

**Skeptic's reasoning.** Confirmed by command. `gh pr list --state merged --limit 300` returns 118 merged PRs; 61 bodies contain "Definition of done" and 57 do not, with #93 the sole gap before #134 and #181 the sole instance after, exactly as claimed (I also checked for checklists pasted without the heading: zero). It is genuinely silent: `grep -rn -i "definition of done"` across all markdown hits only `.github/pull_request_template.md:7`, `.github/ISSUE_TEMPLATE/increment.md:9` and `AUDIT_PLAN.md:218`; `decisions/` stops at ADR-0003 (3 August), ROADMAP.md's ten amendments are all technical, STATE.md is silent, and no issue covers it. The auditor undersells the replacement prose (many post-134 bodies carry gate tables and test counts, and `.github/workflows/ci.yml` machine-enforces lint, typecheck, test, build, format:check, e2e, ruff and pytest), but counting file touches per merge commit on code-changing PRs shows the un-enforced items really did collapse at that exact boundary: LEARNING.md 51 of 52 before #134 versus 10 of 36 after, ROADMAP.md 3 of 36 after, STATE.md 6 of 36 after, with the last twelve consecutive code PRs touching LEARNING.md zero times. Medium rather than high because no measurement is wrong and no PR merged red, but the project's stated headline output is a public learning trail and it stopped without a written reason.

### C1-41. Ten merged pull requests changed code and added or updated no automated check

|                             |              |
| --------------------------- | ------------ |
| Constraint                  | A3           |
| Severity as filed           | high         |
| Verdict as filed            | violation    |
| Verification                | **SURVIVED** |
| Severity after verification | **medium**   |

**Evidence.** gh pr list --state merged --limit 300 --json number,title,files -q '.[] | select([.files[].path]|any(startswith("src/") or startswith("analysis/blinklab/") or startswith("tools/"))) | select([.files[].path]|any(startswith("test/") or startswith("analysis/tests/"))|not) | "\(.number)\t\(.title)"' -> #156, #162, #163, #164, #165, #169, #171, #183, #186, #189.

**Detail.** Three of these are measurement-correctness fixes, not cosmetics: #169 (files: src/io/videoStepper.ts, src/main.ts) fixed a frame-rate guess that doubled every count, #189 (files: src/main.ts only) fixed MediaPipe being handed the wall clock instead of the clip clock, and #156 (files: README.md, src/io/videoStepper.ts) fixed counting the last frame twice. Each was verified by hand in the pull request body and by nothing else. Only #183 is genuinely documentation (STATE.md, docs/eyeblink8-result.txt, a comment in tools/measure_corpus.mjs) and so is exempt.

**Corrected statement.** Nine merged pull requests changed code and added or updated no automated check, three of them measurement-correctness fixes in src/io and main.ts, a layer no test imports (#185 did update checks and #183 is comment-only, so both drop off the list)

**Skeptic's reasoning.** The substance holds but the list has two errors. `git show --name-only` on the merge commits confirms #156 (README.md, src/io/videoStepper.ts), #169 (src/io/videoStepper.ts, src/main.ts) and #189 = 6e89eff (src/main.ts only) touched no test path, and `grep -rn "src/io" test/` returns nothing at all, so the frame stepper that produces every published benchmark number has no unit test and only a ±1 frame-count assertion in test/e2e/videoFile.spec.ts:160 that the #156 off-by-one fits inside. However #185 = 995aa3c did update automated checks (four assertions across test/e2e/calibration.spec.ts and test/e2e/videoFile.spec.ts), and #183 = cfa7540's only non-markdown change is a comment block in tools/measure_corpus.mjs with zero executable lines changed, which is the "purely documentation" exemption, so the true count is nine, not ten, and six of those nine (#162, #163, #164, #165, #171, #186) are layout-only edits to main.ts. It is not accounted for in writing: none of the ten ROADMAP amendments, the three files in decisions/, the seven open issues, or STATE.md:372's known-issues line mentions the src/io and main.ts test gap, and AUDIT_PLAN.md signal 8 that names it was written today by this same audit (commits fbf3cda and 6d5b03f).

### C1-42. The local end to end gate can still pass against a stale bundle, and the guard that exists is not wired into it

|                   |              |
| ----------------- | ------------ |
| Constraint        | D10          |
| Severity as filed | medium       |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** playwright.config.ts:84 `reuseExistingServer: !process.env.CI`; playwright.config.ts has no globalSetup key. grep -rn bundleGuard --exclude-dir=node_modules --exclude-dir=dist -l -> tools/measure_corpus.mjs, test/tools/bundleGuard.test.ts, AUDIT_PLAN.md only.

**Detail.** On a laptop any server already holding port 4173 makes Playwright skip its build-and-serve command entirely, so `npm run e2e` tests whatever that server is serving. This is issue #175 and it is documented at length in playwright.config.ts:73-81, which is why this is partial rather than a violation. But the project already built the fix, tools/bundleGuard.mjs, and attached it only to tools/measure_corpus.mjs, leaving the Playwright path with the same hole a globalSetup calling checkBundle would close.

### C1-43. ADR-0001 says TypeScript is pinned to 6.0.3; package.json declares a range, and every other dependency floats within a caret

|                   |              |
| ----------------- | ------------ |
| Constraint        | D10          |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** decisions/ADR-0001-stack.md:24 "TypeScript is pinned to 6.0.3 until typescript-eslint supports 7"; package.json:26 `"typescript": "<6.1.0"`; package-lock.json resolves typescript 6.0.3. analysis/pyproject.toml:7 `"pandas>=2.2"` while analysis/uv.lock:394 pins pandas 3.0.5.

**Detail.** `<6.1.0` is not a pin: it admits any 5.x or 6.0.x. Every npm devDependency uses a caret and the Python declarations use bare `>=` floors, one of which (pandas) has already drifted a whole major version past its floor. The practical risk is contained because both lockfiles are committed and CI installs with `npm ci` and `uv sync --locked`, so the audited claim is a documentation-versus-configuration mismatch rather than an unreproducible build.

### C1-44. The typecheck gate does not cover the build and test configuration files or the Node tools

|                   |              |
| ----------------- | ------------ |
| Constraint        | D10          |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** tsconfig.json:17 `"include": ["src", "test"]`. npx tsc --noEmit --listFiles | grep -v node_modules lists only src/**, test/** and tools/bundleGuard.d.mts; vite.config.ts, vitest.config.ts, playwright.config.ts, eslint.config.js, tools/bundleGuard.mjs and tools/measure_corpus.mjs do not appear.

**Detail.** A type error in playwright.config.ts or vite.config.ts reaches main without `npm run typecheck` noticing, which matters because those files encode the deploy base path and the whole e2e server contract. Mitigated by ESLint, which does cover all six: `npx eslint . -f json` reports 117 files and 0 errors, including every config file and both tools scripts.

### C1-45. prepare-assets deletes a directory unconditionally on every dev and build, and only works on POSIX shells

|                   |              |
| ----------------- | ------------ |
| Constraint        | D10          |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** package.json:14-16: `"prepare-assets": "rm -rf public/mediapipe-wasm && cp -R node_modules/@mediapipe/tasks-vision/wasm public/mediapipe-wasm"`, wired to `predev` and `prebuild`.

**Detail.** The recursive delete is safe today only because npm forces the package root as the working directory and because .gitignore:27 makes public/mediapipe-wasm derived rather than authored, so nothing unrecoverable is at risk. The sharper trap is portability: `rm` and `cp -R` do not exist on a Windows shell, so `npm run build` and `npm run dev` both fail there, and the failure appears in a prescript rather than in the build itself, which is a confusing place for a future session to start looking.

### C1-46. The deploy workflow publishes to GitHub Pages without running any gate

|                   |              |
| ----------------- | ------------ |
| Constraint        | D10          |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** .github/workflows/deploy.yml:26-27 runs only `npm ci` and `npm run build`; the job has no `needs:` on CI and no `workflow_run` trigger, while deploy.yml:6 adds `workflow_dispatch`.

**Detail.** Nothing links the Deploy workflow to the CI workflow, so a manual dispatch, or any future path that lands a commit on main, publishes an unverified bundle. The exposure is small in practice because branch protection requires the `checks` and `analysis` contexts with strict mode before a merge, which is why this is partial rather than a violation.

### C1-47. One increment per session collapsed: 32 pull requests merged in a single unbroken stretch on 8 August

|                             |             |
| --------------------------- | ----------- |
| Constraint                  | F1          |
| Severity as filed           | high        |
| Verdict as filed            | violation   |
| Verification                | **REFUTED** |
| Severity after verification | **none**    |

**Evidence.** gh pr list --state all --limit 300 --json number,mergedAt grouped by day: 2026-07-28=15, 07-30=5, 07-31=11, 08-01=8, 08-03=5, 08-04=7, 08-05=1, 08-06=2, 08-07=7, 08-08=32, 08-09=21, 08-10=4 (118 merged total). Clustering merges with a 3-hour gap threshold yields 15 clusters; the largest is 2026-08-08T05:57 to 22:21, PRs #134 to #169, n=32, with no gap over 3 hours anywhere inside it.

**Detail.** The rule is one numbered increment per session. Even reading each contiguous cluster as one session, the average is 7.9 merged pull requests per session and the 8 August cluster is 32. The first eleven clusters average 5.5 and stay close to a phase's worth of numbered increments; the last four (08-08 onward) hold 57 merges of which only 7 name a roadmap increment, so the overshoot is mostly unplanned work, not a fast run down the ladder.

**Corrected statement.** Increments per session cannot be audited from git, and the 8-10 August stretch of non-roadmap pull requests is explained by dated ROADMAP amendments 7 to 10

**Skeptic's reasoning.** The counts reproduce (TZ=UTC git log --date=format-local gives exactly 07-30=5, 07-31=11, 08-01=8, 08-05=1, 08-07=7, 08-08=32, 08-09=21, 08-10=4, and 118 PR-squash commits total), but they measure pull requests per calendar day, not increments per session, and this repo records no work sessions anywhere: the only "session" hits in STATE.md (lines 32, 39, 46, 390, 403) are DROZY recording sessions, and ~/.claude/projects/-Users-evannorus-Desktop-blinklab-build-blinklab/ contains only `memory` with no session transcripts, so the 3-hour-gap clustering is the auditor's invented proxy rather than anything the rule defines. The rule as the repo states it points the other way: README.md:505 and ROADMAP.md:3 both define the unit as "one small increment ... one branch, one pull request, one push", and ROADMAP.md:3 adds "If a row looks like it needs more than two hours, split it here before starting", so many small PRs per day is the prescribed shape and no per-day cap exists. The second half is also already handled in writing on exactly the flagged dates: ROADMAP.md lines 16, 18, 20 and 22 are dated amendments 7 (2026-08-08, holds rows 7.4-7.7 and splits into Track A/Track B), 10 (2026-08-08), 9 (2026-08-09) and 8 (2026-08-10, rows 7.5/7.6 HELD and not achievable as written), and `git log -- ROADMAP.md` confirms those edits actually landed in that window (#155 on 08-08, #191/#194 on 08-09, #201 on 08-10) — so the low rate of roadmap-numbered PRs is the documented consequence of a formally blocked ladder, not silent drift. My own recount of the last 57 commits gives 10, not 7, that cite a roadmap row or increment number, and LEARNING.md's "Fix #122"/"Fix #126" headings show a standing convention that fix PRs are not expected to name a roadmap row.

### C1-48. Increment size violated by pull requests whose own bodies count the things they bundle

|                             |             |
| --------------------------- | ----------- |
| Constraint                  | A1          |
| Severity as filed           | high        |
| Verdict as filed            | violation   |
| Verification                | **REFUTED** |
| Severity after verification | **low**     |

**Evidence.** 33 of 118 merged PR titles contain the word "and". PR #167 body line 1: "Six notes from the owner." (5 files: .gitignore, src/main.ts, analysis/blinklab/blink_log.py, analysis/tests/test_blink_log.py, analysis/tools/evaluate_eyeblink8.py, +518/-8). PR #162 body: "## Six decisions" plus "## Two bugs found while building" (src/main.ts, +314/-139). PR #194 body line 1: "Three things, and no results." (files include ARCHITECTURE.md and MODEL_CARD.md, +1382/-2).

**Detail.** The three worst are #167 (a permanent alert banner, a two-column sleepiness grid, a single spacing rule, plus three Python evaluation-tool files, in one pull request), #162 (nav bar, status banner, two-column top row, live signals box, six stated design decisions and two bug fixes), and #194 (a DROZY analysis, plus MODEL_CARD.md and ARCHITECTURE.md, which are ROADMAP rows 8.4 and 8.2, two separate Phase 8 increments folded into a Phase 7 pull request). None of the three opened an issue first.

**Corrected statement.** One pull request (#194) ticked two roadmap rows at once against ROADMAP.md's one-checkbox rule, and #167 quietly carried 446 lines of unrelated Python; the "and" title count and the #162/#167 body headings do not evidence oversized increments

**Skeptic's reasoning.** The headline metric is invalid: ROADMAP.md:3 sets the project's own size rule ("One checkbox is one branch, one pull request, one push"), and 24 of its 75 agreed increment rows contain the word "and" (row 1.6 is literally "Mirror toggle and resolution readout") — 32%, a HIGHER rate than the 33 of 118 merged PR titles the finding counts (28%, which I re-ran and confirmed), so the grep flags the approved master plan itself, not a violation. Two of the three named examples do not survive reading: #167's title contains no "and" at all and its "Six notes" are explanatory notes, one of which is a CI caveat rather than a change; #162 touched exactly one file (src/main.ts, +314/-139) where "Six decisions" are design rationales for a single layout, not six deliverables. Only #194 is a real bundle — `git show c8554de -- ROADMAP.md` ticks 8.2 and 8.4 in one squash merge — and it is declared, not silent: the PR body opens "Three things" and STATE.md:12 records it as "MODEL_CARD.md and ARCHITECTURE.md (roadmap 8.2 and 8.4 done)", with the traceability harm already captured by the plan's own reconnaissance signals 15 and 16. The "and"-grep method also missed the one genuinely undeclared bundle I found: #167's squash merge added 446 lines of unrelated Python (analysis/blinklab/blink_log.py, analysis/tools/evaluate_eyeblink8.py, analysis/tests/test_blink_log.py) that its body never mentions; the issue-first point is real for all three but belongs to checklist F2, not A1.

### C1-49. Issue-then-pull-request discipline breaks at #136 and collapses completely from #154 to #173

|                             |              |
| --------------------------- | ------------ |
| Constraint                  | F2           |
| Severity as filed           | high         |
| Verdict as filed            | violation    |
| Verification                | **SURVIVED** |
| Severity after verification | **medium**   |

**Evidence.** Parsing every PR body for a #N that resolves to an issue: 81 of 119 pull requests reference an issue, 38 do not. Every pull request from #2 to #135 references one except #136 (merged 2026-08-08T06:20, refactor(ui): full bleed notice, camera line, white eyelid dots). PRs #154 through #173 are 20 consecutive pull requests with no issue reference at all. The last increment-level issue ever opened is #148 "7.4 Batch runner" (2026-08-08T11:07); issues #174 to #179 and #192 to #193 are review-found bug reports, not increments.

**Detail.** The break coincides with the Eyeblink8 corpus measurement and the owner-driven UI redesign on 8 and 9 August, which is exactly the point where the work stopped following ROADMAP rows. The protocol step "OPEN THE ISSUE" was simply dropped once the work had no roadmap row to name. Nothing in ROADMAP.md's amendments records a decision to stop opening issues, so this is drift, not a documented exception.

**Corrected statement.** Issue-then-pull-request discipline breaks at #136 and does not recover: 38 of 119 PRs cite no issue, including an unbroken run of 24 from #154 to #183

**Skeptic's reasoning.** I reproduced the counts exactly. `gh pr list --state all --limit 400 --json number,body,closingIssuesReferences` returns 119 PRs and `gh issue list` returns 84 issues; counting PRs whose body cites a number belonging to the issue set gives precisely 81 with and 38 without, the 38 begin at #136, and they include every PR from #154 to #173 inclusive (20 consecutive). The rule is the repository's own and not merely an inferred one: line 1 of /Users/evannorus/Desktop/blinklab build/blinklab/.claude/worktrees/audit-fresh/.github/pull_request_template.md is literally `Closes #`, and 45 PR bodies do not contain that string at all (#160 and #163 open straight into prose with the line deleted). It is not recorded anywhere: the ten dated amendments at ROADMAP.md lines 5-25 cover datasets, thresholds and held rows only, and grep for issue-process wording across LEARNING.md, STATE.md, README.md, PROJECT.md, docs/log.md and decisions/ADR-0001..0003 returns nothing. If anything the finding understates it, since by the formal closing-link measure the unbroken run is 24 PRs (#154 through #183) and the practice never recovers: 69 of 77 PRs before #154 carry a closing link against 7 of 42 after.

### C1-50. Branch naming: only 60 of 119 branches follow <type>/<increment-id>-<slug>

|                   |              |
| ----------------- | ------------ |
| Constraint        | F2           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** Matching headRefName against ^(feat|fix|docs|chore|test|refactor|perf|build|ci|style)/\d+[-.]\d+[a-z]?-[a-z0-9.-]+$ : 60 match. 55 carry a type but no increment id (feat/corpus-runner, docs/ui-specification, feat/layout-polish, fix/iris-circle, ...). 4 carry no recognised type prefix: increment-5.4b-calibration-solver (#89), increment-5.5-playwright-e2e (#93), evidence/2026-08-09-into-the-repo (#180), audit/plan (#202).

**Detail.** The pattern the later branches use instead is <type>/<short-slug>, with no id at all; it starts at #116 and becomes the default from #134 onward. The id separator also drifts from dash (feat/1-1-webcam-video) to dot (feat/5.6-fixation-idt) at PR #95, and #89 and #93 dropped the type prefix entirely for two increments before it was picked back up. Partial mitigation: seven bug-fix branches substitute the issue number for the increment id (fix/22-camera-aspect, fix/126-bound-the-ratchet, fix/174-deterministic-clock, fix/176-refractory-period, fix/179-miss-table, fix/192-loud-fps-floor, fix/193-frame-count-guard), which is a sensible adaptation for work that has no roadmap row.

### C1-51. Protocol step 10, update docs: docs/log.md stops mid-project and six increments were never logged

|                   |              |
| ----------------- | ------------ |
| Constraint        | F2           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** docs/log.md holds 67 dated entries; the last is "2026-08-08, the boxed layout" (PR #159). grep -c ', 5.6,' through ', 6.1,' returns 0 for 5.6, 5.7, 5.8, 5.9, 5.10 and 6.1. Issue #108 "docs/log.md missing one-line entries for 5.6 through 6.1" was opened 2026-08-04T20:01 and is still OPEN.

**Detail.** The header of docs/log.md states its own contract: "One line per increment: date, id, what changed, what was surprising." Six increments never got a line, the gap was noticed and filed as an issue on 4 August, and then the log stopped altogether at PR #159, leaving the last 44 merged pull requests (#160 to #203) with no entry. The file that is supposed to be the cheapest record of the build is the one that went stale first.

### C1-52. Two commits on main are not Conventional Commits

|                   |              |
| ----------------- | ------------ |
| Constraint        | F3           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** git log --format="%s" | grep -vE '^(feat|fix|docs|chore|test|refactor|perf|build|ci|style|revert)(\(...\))?!?: ' returns exactly two of 125 commits: 8cdb1df "7.4 Step a clip frame by frame instead of watching it (#149)" and 8a6b70e "7.0 Video file upload mode, driven by decoded frames (#146)". Conformance is 123/125 = 98.4%.

**Detail.** Both landed on 2026-08-08, the day the process was under most pressure. Four other pull requests with non-conventional titles (#93, #143, #150, #152) were corrected at squash time, so the squash-message discipline mostly held; these two were not.

### C1-53. v0.6.0 and v0.7.0 are lightweight tags while v0.1.0 to v0.5.0 are annotated

|                   |              |
| ----------------- | ------------ |
| Constraint        | F5           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** git cat-file -t returns "tag" for v0.1.0 through v0.5.0 and "commit" for v0.6.0 and v0.7.0. git for-each-ref shows the first five carrying their own subject ("Phase 0: foundations" ... "Phase 4: blinks") while v0.6.0 and v0.7.0 display the underlying commit subject instead, because there is no tag object to hold a message.

**Detail.** The tag placement, the count and the release pairing are all correct; only the tag object type drifted for the last two phases. It costs the phase-end message that the first five tags carry in git itself, though the GitHub Releases still hold it.

### C1-54. ROADMAP row 8.3 still unticked although all seven tags and releases exist

|                   |              |
| ----------------- | ------------ |
| Constraint        | F5           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** ROADMAP.md line for 8.3: "- [ ] 8.3 CHANGELOG.md, semantic version tags, first GitHub Release v0.1.0. Check: release workflow." gh release list shows v0.1.0 published 2026-07-28T15:16:44Z and six more since.

**Detail.** The tagging and releasing work was done long before the row that asks for it, and the row was never ticked. CHANGELOG.md is genuinely absent from the repo root, so the row is not fully done either, but leaving it flat unticked understates what shipped. This is a document-versus-reality disagreement, not a process breach.

### C1-55. PROJECT.md and DATASETS.md give the reader two incompatible accounts of what this project is

|                             |             |
| --------------------------- | ----------- |
| Constraint                  | G3          |
| Severity as filed           | high        |
| Verdict as filed            | violation   |
| Verification                | **REFUTED** |
| Severity after verification | **low**     |

**Evidence.** PROJECT.md:27 "Not a commercial product and not connected to any company codebase or dataset." vs DATASETS.md:223-225 "But this project is / the technical core of a startup and is published under MIT"

**Detail.** One document says the project is not a commercial product; another says it is the technical core of a startup. Neither cross-references the other and no dated amendment reconciles them, so a reader cannot tell which sentence is current. On the master prompt's own terms PROJECT.md's non-goal is the one that can no longer be read as plainly true.

**Corrected statement.** PROJECT.md's "not a commercial product" line dates from 2026-07-28 and was never reworded after the startup disclosure landed in DATASETS.md on 2026-08-08

**Skeptic's reasoning.** G3 as this repo states it (AUDIT_PLAN.md:226) forbids "company name, branding, roadmap or positioning", and none is present: a repo-wide grep excluding node_modules/.git returns one company-name hit, docs/evidence/2026-08-09/findings/issue-177-broken-python-environment.md:11, describing a folder rename, and the auditor's own plan concedes this at AUDIT_PLAN.md:451 ("No company name or product brand appears anywhere"). The two documents are also not incompatible as claimed: PROJECT.md:27 says "not connected to any company codebase or dataset", a provenance claim about code and data that DATASETS.md never contradicts, and the plan's paraphrase at AUDIT_PLAN.md:443-444 drops "codebase or dataset" to manufacture the conflict. The startup clause at DATASETS.md:224-225 is conservative disclosure inside a licence assessment whose operative trigger is the MIT licence, not the startup, and ROADMAP.md:20 (amendment 9, accepted 2026-08-09) says so explicitly, with amendments 7 and 10 (2026-08-08) also dating the founder framing. The only true residue is timing: git log --oneline -- PROJECT.md returns a single commit, 7012c1c dated 2026-07-28, so its "not a commercial product" line simply predates the 2026-08-08 disclosure and was never reworded, which is a one-line PRD refresh and, notably, an error in the direction of more disclosure rather than less.

### C1-56. README states the medical and safety disclaimer but never states unaffiliated or not a product

|                   |              |
| ----------------- | ------------ |
| Constraint        | G3           |
| Severity as filed | medium       |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** README.md:7 carries "Demo, not a safety or medical device. This is a learning project."; `grep -ciE "affiliat" README.md` -> 0, `grep -ciE "\bproducts?\b" README.md` -> 0, `grep -ciE "personal learning" README.md` -> 0

**Detail.** Two of the four required statements are present verbatim in the README. "Personal learning project" exists only in LICENSE ("This software is a personal learning project and technology demonstration") and "unaffiliated" appears nowhere in the README at all. The gap matters more than usual because DATASETS.md:34-38 simultaneously asserts a startup attachment, so the one document the master prompt names is silent on the exact question another document answers.

### C1-57. A private folder name, "a previous project", survives in the tree and in every commit since

|                   |              |
| ----------------- | ------------ |
| Constraint        | G3           |
| Severity as filed | medium       |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** docs/evidence/2026-08-09/findings/issue-177-broken-python-environment.md:11 "The project folder was renamed from `a previous project` to `blinklab build`."; `git log --all --oneline -S a former folder name` -> 8640bfd, 31003fe, 688e7c9 ("stop leaking a personal path"), 3c7f529

**Detail.** This is the only unexplained non-project proper noun in the tree. It is load-bearing for the finding it appears in, since it explains why the virtualenv shebangs break, which is why this is partial rather than a clean violation. Whether a former folder name is the name of the startup DATASETS.md refers to cannot be established from the repository itself, but the string outlived commit 688e7c9 whose stated purpose was to stop leaking a personal path.

### C1-58. DATASETS.md's startup and commercial-venture disclosures are justified by the licence assessment, not positioning

|                   |              |
| ----------------- | ------------ |
| Constraint        | G3           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** DATASETS.md:34-38 "it is attached to a startup, so it cannot rely on a non-commercial or academic-only exemption"; DATASETS.md:79-81 "disclose that the project is connected to a commercial venture"; DATASETS.md:112-114 "a commercial context is less sympathetic than a university one... a repository attached to a startup"

**Detail.** Against: the rule bans positioning, and calling the repo the technical core of a startup is a claim about a company's assets. For: three of the rejections that turn on this (DATASETS.md:168 NTHU-DDD, :172 CEW, :173 RT-BENE) are non-commercial or institutional clauses only assessable once the maintainer's commercial status is stated, and :79-81 records a disclosure actually made to a rights holder, which is what makes the resulting permission auditable rather than asserted. Decision: honest disclosure, not positioning, because no company name, product name, brand, market claim or commercial roadmap accompanies it; the residual defect is PROJECT.md not being updated alongside it.

### C1-59. The repository gives two different names for the same maintainer

|                   |              |
| ----------------- | ------------ |
| Constraint        | G3           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** LICENSE:3 "Copyright (c) 2026 Evan Norus" vs src/main.ts:2711 footerLine.textContent = "Eivinas Norusaitis, 2026"

**Detail.** The copyright holder in LICENSE and the byline on the shipped page do not match, and nothing in the repo connects them. A reader checking who holds the MIT copyright against who signs the page has no way to reconcile the two from the repository alone.

### C1-60. docs/UI.md omits the two page elements that carry personal identity

|                   |              |
| ----------------- | ------------ |
| Constraint        | G3           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** docs/UI.md:14-26 lists four regions (graph strip, demo notice, content column, overlays); src/main.ts:2746-2749 appends navBar and pageFooter; `git show --stat 4b68706` touches src/main.ts only, 1 file changed

**Detail.** README.md:509 describes docs/UI.md as "every element the page can show... and every string it can contain", but the top bar carrying the LinkedIn link and the footer carrying the name were added in commit 4b68706 without any UI.md change. The only two strings on the shipped page that identify a person are the two the UI specification does not record.

### C1-61. The GitHub account that owns the repository publishes an employer in its bio

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | G3               |
| Severity as filed | low              |
| Verdict as filed  | cannot-determine |
| Verification      | **UNTESTED**     |

**Evidence.** `gh api users/heshipstech --jq '{login,type,name,company,bio}'` -> {"bio":"12+ yrs product design | Dexcom medtech studio | ex-Vinted... | ex deep-tech founder","company":null,"login":"heshipstech","name":"Eivinas Norusaitis","type":"User"}

**Detail.** Section 13 scopes to "in the repo", and this text is on the GitHub account, not in the repository, so it is outside the rule as written. It is reported because it is one click from the repo page and names a current medical-device employer beside a repository that measures drowsiness. No employer name appears in any tracked file.

---

## Compliance, as reported by each auditor

Verified-correct observations, quoted with their evidence inline.

### B — required files, source layout, and the STATE.md contract (B1, B2, B3, B4)

- Nine of the twelve required root files plus the decisions/ folder are present: `ls` shows README.md, PROJECT.md, SPEC.md, ROADMAP.md, STATE.md, LEARNING.md, ARCHITECTURE.md, DATASETS.md, LICENSE and decisions/.
- decisions/ is a real ADR folder, not an empty placeholder: ADR-0001-stack.md, ADR-0002-model-hosting.md, ADR-0003-e2e-testing.md.
- src/core, src/io and src/main.ts all exist as the master prompt names them (`ls src` → core, io, main.ts, vite-env.d.ts).
- core never imports outside core: the full deduplicated list of import sources across all 44 src/core/*.ts files is 18 entries, every one a `./`-relative sibling (`grep -rhoE 'from "[^"]+"' src/core/*.ts | sort -u`).
- core touches no browser globals: `grep -rn "window\.|document\.|navigator\." src/core/*.ts` returns 5 hits, 4 inside comments and one a local `const window = samples.slice(...)` at src/core/fixation.ts:102, which the rule correctly ignores because it resolves to a local scope.
- No path aliases exist in tsconfig.json that could route around the import pattern; moduleResolution is "bundler" with no "paths" key.
- The purity rule genuinely landed in increment 0.3 as claimed: commit 070e3de "chore(lint): increment 0.3, static analysis and the core purity rule (#6)", and `git show 070e3de:eslint.config.js` already contains files: ["src/core/**/*.ts"] with both no-restricted-imports and no-restricted-globals.
- The import restriction does catch relative imports, contrary to the obvious worry: ESLint 10.8.0 builds the group matcher with ignore({allowRelativePaths:true}) at no-restricted-imports.js:334, and probing that matcher with '**/io/**' returns true for '../io/camera', '../../io/x', './io/camera' and '../ui/panel'. I did not run the linter.
- The rule is actually enforced on every pull request: .github/workflows/ci.yml:18 runs `npm run lint`, and package.json defines lint as `eslint .` over the whole tree.
- The missing SECURITY.md's substance does exist elsewhere: README.md:476-478 states the privacy and no-backend stance in full, and ADR-0002 records the origin-hosting decision behind it.
- Partial contributing guidance exists outside the missing file: README.md:503-514 states the one-increment-per-session, one-branch, one-pull-request convention and indexes the working documents, backed by .github/pull_request_template.md and two issue templates.
- CHANGELOG.md and the security policy are honestly parked, not falsely claimed: ROADMAP.md:119 (8.3) and ROADMAP.md:121 (8.5) are both left unticked `- [ ]`.
- ARCHITECTURE.md:88-92 documents the layout that actually exists (core / io / main.ts / test / analysis / tools / docs) rather than the one originally planned, so a reader is not misled about where the UI lives.
- docs/UI.md exists and states at its head that it was extracted from src/main.ts and the src/core message functions rather than from memory, which is the compensating control for having no src/ui folder.

### Per-increment documentation trail (B5 LEARNING.md, B6 docs/log.md, and step-10 STATE.md / ROADMAP.md updates)

- ROADMAP.md checkbox discipline held to the very end: `git log -S"x] 8.2" -- ROADMAP.md` → #194 (08-09) and `git log -S"x] 7.7" -- ROADMAP.md` → #201 (08-10), so every one of the 65 ticked rows was ticked in a ROADMAP.md commit even after LEARNING.md and docs/log.md had stopped.
- LEARNING.md covers 62 of the 65 ticked ROADMAP rows: a sweep of `grep -c "^## <id> " LEARNING.md` returns 1 for every row in phases 0, 1, 2, 3, 4, 5 and 6, and for 7.0, 7.1, 7.2, 7.3 and 7.4.
- docs/log.md covers 56 of the 65 ticked rows in the exact declared format; docs/log.md:3 states "date, id, what changed, what was surprising" and every one of the 67 data lines carries all four fields.
- No LEARNING.md entry is a stub: word counts run from 171 (0.1) to 1151 (7.0) with a median of 271, so the "5 to 10 plain English lines" target is met in substance across the file.
- Quality sample, Phase 0: entries 0.4 (LEARNING.md:32) and 0.5 (LEARNING.md:41) each teach exactly one concept (a test that can lose; a stranger's machine certifying the claim), in plain English, with an explicit forward pointer to 3.1 and to 0.6/0.7.
- Quality sample, Phase 2 and 3: 2.7 (LEARNING.md:189) teaches the recorded fixture and points forward to 3.1; 3.1 (LEARNING.md:196) teaches why a good measurement is a ratio and names 4.1 as where the loose end returns. Neither is a change log.
- Quality sample, Phase 4 and 5: 4.6 (LEARNING.md:302) teaches the sampling limit and "zero is a claim, null is an admission", pointing to 7.8; 5.7 (LEARNING.md:379) teaches I-DT two-threshold classification and names 5.6 as its load-bearing dependency.
- Quality sample, Phase 6: 6.5 (LEARNING.md:465) teaches the explainable-score identity and honestly records that its first draft penalised an awake person, which is the master prompt's "why it matters" done well.
- The trail did not decay in quality before it stopped: the last two entries, the blink log (LEARNING.md:637) and the boxed layout (LEARNING.md:649), are still one concept each in plain English with recorded reasoning. The failure is abrupt cessation, not erosion.
- LEARNING.md goes beyond the rule by also documenting non-increment work: Fix #22, Fix #114, Fix #122, Fix #126, Amendment 5, Amendment 6 and the 7.4b/7.4c corrections all have their own entries.
- 54 of 72 LEARNING.md entries open with the same "The concept this increment teaches is..." formula, so the one-concept framing was a real convention, not an accident.
- The rule is encoded in the repo's own machinery: .github/pull_request_template.md:14-15 require "STATE.md and ROADMAP.md updated" and "LEARNING.md has the plain English note" on every pull request.
- The 5.6-to-6.1 docs/log.md gap was self-detected on the same day it happened: `gh issue view 108` shows it was filed 2026-08-04T20:01:17Z by the 6.2 adversarial review, naming all six missing rows and the six pull requests to backfill from.
- STATE.md discipline was perfect for the first 70 commits: every commit from the second one through #135 (2026-07-28 to 2026-08-08) touched STATE.md, with zero misses.

### Architecture decision records, the ten roadmap amendments, and work with no roadmap row (B7, C4, C5, C6)

- All three ADRs carry every required section: Context, Options considered, Decision, Consequences and Date, plus a Status line. Verified by reading decisions/ADR-0001-stack.md, ADR-0002-model-hosting.md and ADR-0003-e2e-testing.md in full.
- No ADR was ever edited after merge. `git log --follow -- <file>` returns exactly one commit per ADR: 70f79ea for 0001, 0beab4f for 0002, edf6ee4 for 0003.
- ADRs are numbered sequentially with no gaps, and none needed superseding because no decision they record was later reversed.
- ADR-0001's own constraint held: package.json still lists one runtime dependency, @mediapipe/tasks-vision, with no UI framework and no browser charting library, so no superseding ADR was owed. matplotlib and pandas sit only in analysis/pyproject.toml, which roadmap row 7.1 authorised.
- Each ADR records bad consequences honestly, not only good ones: ADR-0001:23 accepts being bound to MediaPipe's landmark quality, ADR-0003:27 accepts that a WebKit or Firefox wiring bug would not be caught.
- Amendments 1 to 3 were written on 2026-07-28 in commit 7012c1c, the docs-foundation commit, before any code existed, exactly as the heading claims.
- Amendment 7 is the 7.3 gate decision itself, written in the delivering PR #143, before the rows it replans were touched.
- Amendments 9 and 10 were written before the work they unblock: amendment 9 in bd2a98d (#191, 2026-08-09 22:03) ahead of the DROZY analysis c8554de (2026-08-09 23:42); amendment 10 in 787cce7 (#155, 2026-08-08) ahead of Track B work that never started.
- Every one of the ten amendments records a specific, checkable cause rather than a vague one, for example amendment 6's "0.0 percent through a witnessed 12.9 second closure" and amendment 8's "excluded mean KSS 6.38 against 4.60".
- No threshold constant was ever retuned after being set. `git log -S` on MIN_BLINK_FPS, EYES_SHUT_FRACTION, BLINK_REFRACTORY_MS, BASELINE_THRESHOLD_FRACTION and MAX_BLINK_DURATION_MS returns exactly one commit each.
- The refractory period's post-benchmark origin is stated plainly in three independent places: src/core/constants.ts:87-90, README.md:310-312, and PR #190's body under the heading "Stated plainly". The refusal to raise 150 ms to 300 ms to improve the score is recorded as a principle in all three, plus docs/eyeblink8-result.txt:66-72.
- The 25 fps blink floor was not lowered to recover the 16 excluded DROZY sessions, even though those were the sessions the analysis most needed. ROADMAP.md:18 and docs/drozy-analysis-plan.md:28-35 record the choice and the bias it creates.
- Declining scipy for the rank statistics is argued in writing, satisfying "write down why": analysis/blinklab/stats.py:1-14 gives three reasons and points at the pre-registered plan.
- The DROZY pre-registration is verifiable at the file level: docs/drozy-analysis-plan.md first appears 2026-08-09 23:42 (c8554de), docs/drozy-result.txt first appears 2026-08-10 09:03 (d8d250c), and the single later edit to the plan (f859bd2) discloses itself in-file as a caveat added after the fact with nothing else changed.

### Roadmap traceability, Phase 0 through Phase 5 (checklist C1, C2, C3)

- 48 rows are in scope (0.1-0.8, 1.1-1.6, 2.1-2.7, 3.1-3.8, 4.1-4.8, 5.1-5.10 with 5.4 split); 44 verified cleanly delivered with behaviour and stated check both present, 4 partial as listed. Unusually well done: 4.2, whose ratchet ceiling (test/core/baseline.test.ts:107-223) tests the property behind the rule, not just the rule.
- 0.6 branch protection is real, not merely claimed: `gh api repos/:owner/:repo/branches/main/protection` returns allow_force_pushes false, allow_deletions false, enforce_admins enabled, required status checks ["checks","analysis"] with strict true.
- 0.6 has behavioural proof too: `git log --format='%s' | grep -vc '(#[0-9]*)$'` = 7, and all seven PR-less commits are dated 2026-07-28 and precede 16c86ac, the commit that delivered 0.6; every one of the 145 commits after it carries a PR number.
- 3.5 asserts the row's words literally at test/core/statistics.test.ts:69 (`expect(cvMm).toBeLessThan(cvPx)`) and strengthens them at lines 70-71 with cvMm < 0.001 and cvPx > 0.25 across seven synthetic distances.
- 4.2 asserts exactly "rises but never falls": test/core/baseline.test.ts:71-78 holds the baseline at 7 mm through 700 frames of 5 mm droop, and :178-191 asserts `expect(after).toBe(before)` after 600 frames at 3 mm; :80-87 confirms it still rises on a sustained widening.
- 4.6 asserts null and specifically not zero: test/core/fpsGate.test.ts:32-33, `expect(gatedBlinkRatePerMin(20, rate, 30000)).toBeNull()` followed by `.not.toBe(0)`.
- 0.2, 0.3 and 0.5 checks run on every pull request and push: .github/workflows/ci.yml:18-22 runs lint, typecheck, test, build and format:check; the latest main runs (31364960182 CI, 31364960183 Deploy) both completed success.
- 0.3's "core cannot import io or ui" is a machine-enforced lint rule, not a convention: eslint.config.js scopes no-restricted-imports on src/core/** against **/io/** and **/ui/**, plus no-restricted-globals for window, document and navigator.
- 2.3 and 2.4 assert the row's exact words: test/core/constants.test.ts:14 (no index in both eyes), :21 (inside the model range), :51 (each iris ring is the four indices directly after its centre).
- 3.6 delivers three separate single-axis synthetic tests as the row demands: test/core/headPose.test.ts:63 pure roll, :73 pure pitch, :83 pure yaw, each asserting the other two axes read zero.
- 4.7 asserts the row's exact scenario: test/core/blink.test.ts:95, "counts nothing for the ladder's held squint plateau, five seconds", with the just-over-maximum boundary at :102.
- Phase 5's remaining rows all have their stated check and it asserts the stated thing: 5.1 gazeOffset.test.ts:39-78, 5.2 gazeQuadrant.test.ts:61 on labelled synthetic frames, 5.3 gazeQuadrant.test.ts:78-98 boundary trios, 5.4a calibrationCapture.test.ts:47-99, 5.6 gazeSmoothing.test.ts:85 step response within budget plus a counterfactual at :98, 5.7 fixation.test.ts:88 on a known three-fixation scanpath, 5.8 fixationStats.test.ts:31, 5.9 heatmap.test.ts:22-46, 5.10 replay.test.ts:8-50.
- 0.8's ADR-0001 does what the row asks: decisions/ADR-0001-stack.md records three options considered, the decision, and consequences including a cost already felt (the TypeScript pin at increment 0.3).
- Phase 1 and 2 rows map one-to-one onto their checks: 1.2 cameraState.test.ts:10 and :17 (denied, missing camera), 1.3 fps.test.ts, 1.5 deviceList.test.ts, 1.6 transform.test.ts, 2.1 facePresence.test.ts plus the fixture-based sessionFixture.test.ts:72, 2.2 projection.test.ts on test/fixtures/sampleLandmarks.ts, 2.5 landmarkGuard.test.ts:11 on the 468-point fixture, 2.6 timing.test.ts, 2.7 test/fixtures/session-01.json used by sessionFixture.test.ts.

### Roadmap traceability, Phase 6 through Phase 8 (C1, C2, C3)

- 12 of the 17 ticked Phase 6 to 8 rows verified clean: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 6.8, 6.9, 7.0, 7.1, 7.2, 7.3.
- 6.5 identity holds exactly as the row states: src/core/score.ts:167-174 returns 100 minus the raw sum with no clamp anywhere, and test/core/score.test.ts:50-57 asserts 100 - sum === score on alert, maximal, mixed, backwards-count and unavailable-signal minutes.
- 6.5 penalty caps sum to exactly 100 (40 + 30 + 15 + 15, src/core/score.ts:32/39/46/54) and test/core/score.test.ts:397-404 pins the sum, so the 0 to 100 range is structural rather than clamped.
- 6.9's stated check is a real Playwright assertion: test/e2e/calibration.spec.ts:51-66 asserts the notice is visible before any camera permission, contains two required phrases, and survives clicking it and clicking the body; README.md:7 carries the same text; src/core/notice.ts is the single tested source.
- 6.1 and 6.2 use one aliased shut line (src/core/perclos.ts:1,27 importing EYES_SHUT_FRACTION from longClosure.ts:35), matching amendments 5 and 6, and test/core/perclos.test.ts:253 asserts the alias at source level so the two cannot drift.
- 6.2's "boundary case included" is delivered several times over: test/core/longClosure.test.ts:130, :252 and :267 run the boundary trio and prove one bin per closure across both reducers.
- 6.7's comma and header edge cases are asserted: test/core/csv.test.ts:68-92 covers comma, embedded quote, newline, CR, NaN and infinities; :113 refuses a header-only file.
- 6.8's metadata writer test exists and refuses to record a skipped answer as a middle value: test/core/kss.test.ts:63-103.
- 7.1's second CI job is real: .github/workflows/ci.yml:34-47 runs uv sync --locked, ruff check, ruff format --check and pytest in analysis/.
- Every one of the 45 modules in src/core has a matching test file in test/core (comm of the two directory listings leaves nothing on the src side), which is the layout ARCHITECTURE.md:91 claims.
- The full unit suite passes at head: `npx vitest run` -> 49 files, 473 tests, 0 failures, 2.98s.
- The unticked rows are genuinely undone, so nothing is silently delivered-but-unrecorded: no SECURITY.md or .github/dependabot.yml (8.5), no coverage config in vitest.config.ts (8.6), no bundle size gate in ci.yml (8.7, tools/bundleGuard.mjs is the stale-server guard, not a size gate), no accessibility test in test/e2e (8.8), no latency test (7.8), no TODO check in ci.yml (7.9).
- 7.5 and 7.6 are left unticked rather than ticked with an excuse, which is the correct tick discipline whatever one makes of amendment 8's wording.

### Configuration, continuous integration, and quality gates (checklist A3, D10, F6)

- Locked stack, no framework and no charting library anywhere: a lockfile scan for react|vue|svelte|preact|solid|angular|lit|chart|d3|plotly|echart|apex|highcharts|recharts|victory|nivo returned "none" across all 171 packages.
- The runtime dependency list is exactly one entry, @mediapipe/tasks-vision (package.json:33), and it is the library named in decisions/ADR-0001-stack.md as the chosen stack; no dependency was added without an ADR.
- Every required tool is present and resolved: typescript 6.0.3, vite 8.1.5, vitest 4.1.10, eslint 10.8.0, prettier 3.9.6, @playwright/test 1.62.1, typescript-eslint 8.65.0 (read from package-lock.json).
- TypeScript strict mode is on and then some: tsconfig.json:11-15 sets strict, noUnusedLocals, noUnusedParameters, noFallthroughCasesInSwitch and noUncheckedIndexedAccess.
- CI installs with the lockfile, not a floating resolve: .github/workflows/ci.yml:17 runs `npm ci`, package-lock.json is tracked (git ls-files), and its root spec matches package.json field for field.
- Every gate the master prompt names runs on every pull request, plus two extra: ci.yml:18-27 runs lint, typecheck, test, build, format:check and the Chromium e2e suite, triggered on `pull_request` (ci.yml:4).
- A second required job gates the Python track independently: ci.yml:44-47 runs `uv sync --locked`, `ruff check .`, `ruff format --check .` and `pytest`.
- Branch protection actually enforces both jobs: gh api repos/:owner/:repo/branches/main/protection returns required contexts ["checks","analysis"] with strict:true, enforce_admins enabled, force pushes and deletions blocked.
- Python pinning is met in substance though not in letter: there is no requirements.txt anywhere (`find . -name 'requirements*.txt'` outside node_modules returns nothing), but analysis/uv.lock carries 394 sha256 hashes and exact versions (pandas 3.0.5, matplotlib 3.11.1, pytest 9.1.1, ruff 0.16.2), analysis/.python-version pins 3.12, and `uv sync --locked` fails on a stale lock, which is stricter than a pinned requirements.txt.
- The core purity rule is enforced by configuration, not convention: eslint.config.js:27-51 applies no-restricted-imports against **/io/** and **/ui/** and no-restricted-globals against window, document and navigator, scoped to src/core/**/*.ts.
- Lint is clean and covers more than the source: `npx eslint . -f json` reports 117 files and 0 errors, including eslint.config.js, vite.config.ts, vitest.config.ts, playwright.config.ts and both tools/*.mjs.
- The pull request template carries the Definition of Done as required, ten items at .github/pull_request_template.md:7-19, and it was actively maintained: commit 3424987 (#181) added format:check to the gate line.
- Both issue templates exist and are usable: .github/ISSUE_TEMPLATE/bug.md asks for the first failing observation, and increment.md:7 forbids the word "and" in an increment goal.
- The coverage floor on src/core and the bundle and inference budgets are absent, and this is unreached roadmap work rather than a violation: ROADMAP.md:122 (8.6) and ROADMAP.md:123 (8.7) are both unticked, and no coverage or size tooling is installed at all (lockfile scan for coverage|istanbul|size-limit|bundlesize returns nothing).

### F1-F5, A1, A2 — the per-increment working protocol and the git playbook

- F4, nothing merged red: of 118 merged pull requests, 114 have an all-SUCCESS statusCheckRollup and zero have any FAILURE, CANCELLED or TIMED_OUT conclusion.
- F4, the four merges with no checks at all (#2, #4, #6, #8) all predate CI itself, which landed as increment 0.5 in PR #10 (merged 2026-07-28T14:46) — correct ordering, not a bypass.
- F4, branch protection on main is real and self-binding: gh api .../branches/main/protection shows enforce_admins enabled, required contexts ["checks","analysis"] with strict:true, allow_force_pushes false, allow_deletions false.
- F2, issue-before-pull-request ordering was never once inverted: for all 81 issue-linked pull requests, the issue createdAt is earlier than the pull request createdAt (zero exceptions).
- F2, Phase 0 to Phase 6 issue discipline is essentially perfect: every pull request from #2 to #135 names an issue except #136.
- F3, Conventional Commits conformance on main is 123 of 125 subjects (98.4%), including scopes (feat(core), fix(ui), docs(adr), test(e2e), chore(process)).
- F5, tags and releases pair exactly 1:1 — seven tags v0.1.0 to v0.7.0, seven releases, no tag without a release and no release without a tag.
- F5, every tag sits on the real phase-end commit: v0.7.0 = b1db55d = PR #132 (increment 6.9), released 2026-08-07T23:43:39Z, the same minute the pull request merged; v0.6.0 = 2dae101 = PR #103 (increment 5.10).
- F5, Phases 7 and 8 have no tag, and that is correct rather than a miss: ROADMAP rows 7.5, 7.6, 7.8, 7.9, 8.3, 8.5, 8.6, 8.7 and 8.8 are all still unticked, so neither phase has ended.
- A2, every increment ends in a push: git log origin/main..HEAD is empty, all 118 merged pull requests are on origin/main, and .github/workflows/deploy.yml publishes on merge.
- A2, git history on main is fully linear — git log --merges returns 0 commits, so every pull request was squash-merged and no merge bubbles exist.
- F2, only 7 of 125 commits ever landed on main outside a pull request, all between 16:07 and 17:47 on 2026-07-28, i.e. before branch protection itself merged at 17:52 (PR #12); docs/log.md records the reason under 0.6 ("the gate locked out its own builders"), so this is a documented, self-corrected gap.
- F2, branch cleanup after merge is near-total: git ls-remote --heads origin returns 2 refs, main plus one survivor (feat/5.8-fixation-stats from PR #99), so 117 of 118 branches were deleted.
- A1, the audit trail itself is unusually strong: 119 pull requests with substantive written bodies covering design reasoning, rejected alternatives and bugs found during the work (see #162, #167, #194) — rare for a solo build and worth stating.

### G. Separation from commercial work, and the honesty of the project's self-description (G1-G4, master prompt Section 13)

- G1 model weights: the only vendored model is Google's MediaPipe Face Landmarker, attributed at MODEL_CARD.md:112 and decided in decisions/ADR-0002-model-hosting.md; no other weight file was ever committed.
- G1 thresholds: every constant in src/core/constants.ts carries an in-repo derivation comment, e.g. :15-18 blink threshold from the owner's own fixture, :106-115 hysteresis traced to the 2026-08-05 session and issues #112/#114, :12 iris 11.7 mm from anatomy.
- G1 no external parameter set: no constant in src/core/constants.ts is sourced to an unnamed or third-party system; the file is 205 lines and every exported value has a stated origin.
- G2 no dataset media anywhere in history: `git log --all --diff-filter=A --name-only` filtered to media extensions returns exactly two paths, public/models/face_landmarker.task and test/fixtures/clip-60fps-60frames.mp4.
- G2 the one committed clip is synthetic: test/fixtures/README.md:5-7 "No faces, no people, just a test pattern", with the reproducing ffmpeg testsrc2 command at lines 27-30.
- G2 the landmark fixture is coordinates only: test/fixtures/session-01.json holds 300 frames of 478 normalised triples and no image data; MODEL_CARD.md:105 names the single subject as "The author".
- G2 evidence files are derived numbers only: docs/evidence/2026-08-09/tables/eyeblink8_false_positives.csv header is frame indices, durations and millimetre apertures, no frames or images.
- G2 .gitignore:46 ignores _.mp4 with a single documented exception at :57 for test/fixtures/_.mp4; history scan for dataset|drozy|rldd|nitymed|uta paths returns only DATASETS.md, analysis/_.py and docs/_.md.
- G3 no company owns the repo: `gh api users/heshipstech` returns "type":"User" and "company":null, so the 12 heshipstech references in tracked files are a personal GitHub handle, not a company name.
- G3 issue titles clean: all 74 titles from `gh issue list --state all --limit 300` are increment, bug or gate titles with no company, product or market language.
- G3 pull request titles clean: 119 PRs enumerated, `grep -niE "startup|commercial|company|brand|product|launch|customer|pilot|market"` over the titles returns nothing.
- G3 no commercial roadmap: ROADMAP.md headings are Phases 0 to 9 of the build ladder only, and its amendments 7 and 9 discuss dataset licences, not markets.
- G3 no marketing surface: index.html:6 title is "blinklab", src/main.ts:169 h1 is "Alertness measurement demo", and src/core/notice.ts:10-14 holds the demo and non-medical disclaimer as one tested constant reused by page, README and export.
- G3 no private correspondence committed: DATASETS.md:86-88 and :266-268 state both permission emails are held privately, and an email-address regex over all tracked .md files returns zero hits.

---

## What each auditor could not check

### B — required files, source layout, and the STATE.md contract (B1, B2, B3, B4)

- Whether ESLint actually reports the core-purity violations at runtime. Per the task's instruction I did not execute the linter; all rule conclusions come from reading node_modules/eslint/lib/rules/no-restricted-imports.js and probing the `ignore` matcher it constructs.
- Whether the three gaps in the purity rule were ever discussed and consciously accepted. I found no note about them in eslint.config.js, ARCHITECTURE.md, SPEC.md or the ADRs, but I did not read all 145 KB of LEARNING.md.
- Whether STATE.md's ten-line cap was formally amended somewhere. ROADMAP.md carries ten numbered amendments and none of the ones I read touches STATE.md's format, but I did not read every amendment in full.
- AUDIT_PLAN.md is a tracked root file (`git ls-files --error-unmatch AUDIT_PLAN.md` succeeds) containing prior audit conclusions about this same dimension. I deliberately excluded it from my evidence and re-derived every claim; I did not verify its provenance or whether it is intended to ship in the repository.
- Whether src/main.ts is covered indirectly by the Playwright suite in a way that offsets its lack of unit tests. I confirmed no unit test imports it, but I did not run or read the 7 end-to-end tests to judge how much of the 2764 lines they exercise.

### Per-increment documentation trail (B5 LEARNING.md, B6 docs/log.md, and step-10 STATE.md / ROADMAP.md updates)

- How many notes are actually MISSING after 2026-08-08 depends on what counts as an "increment". Only 3 of the 35 post-#159 pull requests tick a ROADMAP row, so the true debt is between 3 notes (roadmap rows only) and 35 (the repo's own PR-template rule, which asks for a note on every pull request). I report both bounds rather than picking one.
- Whether every entry satisfies "where it will come back" could not be checked mechanically. A regex sweep flagged 31 entries as lacking a forward pointer, but manual reading showed at least one false positive (3.1 at LEARNING.md:196 clearly points to 4.1 in different words), so the heuristic is unreliable and I judged only the entries I read in full.
- The original master prompt text is not present anywhere in the repository (no file matches a search for it), so I audited against the rules quoted in the task brief and their in-repo echoes at .github/pull_request_template.md:14-15 and README.md:511.
- Whether the two final ad-hoc entries (the blink log, the boxed layout) were intended as increment notes at all cannot be determined, since neither corresponds to a ROADMAP row and neither cites an increment id.

### Architecture decision records, the ten roadmap amendments, and work with no roadmap row (B7, C4, C5, C6)

- Whether the master prompt intends visual design work to require a roadmap row at all. Its named ADR triggers are frameworks, data contracts, datasets and models, none of which is layout, so the UI campaign is judged against "no silent scope creep" rather than against B7.
- Whether any amendment was agreed with the owner in conversation before its pull request. Nothing outside git records that, and the sessions are not in the repository.
- Whether row 7.7's "test asserting the collapse" was meant at the pipeline level or the statistic level. The roadmap text does not say, so the partial verdict may be harsh.
- Whether the 84 issues include tickets for UI work that were closed without ever being referenced from a pull request. I matched only on PR bodies and issue titles.
- The truth of AUDIT_PLAN.md's own reconnaissance items beyond the four I re-derived (items 15, 17, 24 and the 118 pull request count). The rest of that file was outside my dimension.

### Roadmap traceability, Phase 0 through Phase 5 (checklist C1, C2, C3)

- Whether branch protection was enabled on 2026-07-28, the day 0.6 merged, rather than switched on later. GitHub's branch-protection API reports current state only, with no creation timestamp, and the repository audit log is not reachable from here. Only two things are checkable: protection is on now, and no PR-less commit exists after 16c86ac. The 0.6 commit message itself says "branch protection ends post merge pushes to main", which is a claim, not evidence.
- Whether the test suite and build actually pass on this working tree. The read-only mandate rules out `npm test`, `npm run build` and `npm run e2e`, since all three write files. Pass/fail is taken entirely from the green CI runs on main.
- 0.7's "Done when a public URL shows the page". `gh api repos/:owner/:repo/pages` reports html_url https://heshipstech.github.io/blinklab/ with build_type workflow and https_enforced, but its "status" field is null and I did not fetch the page itself.
- Whether anyone actually performed the manual checks that stand in for automation on 1.1, 1.4, 3.7 and 5.4b. test/MANUAL.md items 2, 5, 20 and 34 are written and specific, and items 19, 20, 22 and 23 carry dated observed readings, but a checklist entry is not a record of a run.
- Whether row 5.4b's amended target, "reliably correct with the head reasonably still", is met on a real face. It is a human-eye criterion (test/MANUAL.md item 34) with no automated proxy, and the synthetic solver tests cannot speak to it.

### Roadmap traceability, Phase 6 through Phase 8 (C1, C2, C3)

- Whether the Playwright suite passes at head. `npm run e2e` runs `npm run build` first (playwright.config.ts:82), which writes to dist/, and the read-only rule forbids it. The specs were read instead.
- Whether the Python suite passes at head. Running pytest needs `uv sync` to create analysis/.venv, which writes files and fetches packages.
- Whether Eyeblink8 contains 8 distinct individuals or fewer. No document in this repository states a count of people for that corpus, only clip counts.
- 8.2's done-when condition, "a newcomer understands it in 5 minutes", is not falsifiable by an auditor who already knows the codebase; only the document's factual claims were checked.
- Whether the DROZY numbers in docs/drozy-result.txt reproduce, since the source dataset is deliberately absent from the repository.

### Configuration, continuous integration, and quality gates (checklist A3, D10, F6)

- Whether the `<6.1.0` TypeScript ceiling is still needed. Deciding that requires attempting an upgrade of typescript-eslint 8.65.0 against TypeScript 7, which would modify the tree.
- Whether the ten code-without-test pull requests were covered by a check added in a neighbouring pull request. I compared per-PR file lists, not the suite's behaviour with and without each change.
- The real end to end flake rate. playwright.config.ts:11 sets `retries: 2` on CI, which can absorb a flake silently, and `gh run list --limit 8` shows only successes, so there is nothing in the visible window to measure against.
- Whether CI and a laptop truly run the same Python patch release. analysis/.python-version contains "3.12" only, so uv resolves the patch at install time, and I did not run uv to see which one each environment picks.
- Whether format:check covers the analysis documentation. .prettierignore:4 excludes `analysis/` entirely and ruff formats only Python, so analysis/README.md is formatted by neither, but I could not confirm this was deliberate from any written note.

### F1-F5, A1, A2 — the per-increment working protocol and the git playbook

- Whether a session equals a calendar day or a merge cluster: no session boundary is recorded anywhere in the repository, so merge-time clustering (3-hour gap threshold, 15 clusters) is the only available proxy for F1 and the true session count could be higher or lower.
- Protocol steps 1, 2, 3, 13, 14 and 16 (read state, restate goal, flag risk, wait for CI, hand over the review, say what is next and stop) leave no artefact in git or GitHub and cannot be verified from outside a session transcript.
- Whether the agent ever refused a request to do more than one increment: not observable from git, gh, or any repository file.
- Step 14, hand over the review, cannot be counted: required_approving_review_count is 0 and gh pr view --json reviews returns 0 for every pull request sampled (#132, #162, #194), so review handover happened in-session and left no record.
- Whether the 8 August burst reflects many short sessions or a few very long ones: gh exposes merge times but not the agent's session starts, so the 32 merges cannot be attributed to a specific session count.

### G. Separation from commercial work, and the honesty of the project's self-description (G1-G4, master prompt Section 13)

- G4, the stop-and-say-so rule: no record of any request to move commercial material into the repo, and no refusal, appears in docs/log.md, LEARNING.md or the 74 issues. Absence of a record is not evidence in either direction.
- G1 cannot be proven as a negative: I can show every parameter has a stated in-repo derivation, but not that no threshold was carried mentally from the author's other work.
- Issue and pull request bodies were not read in full (74 issues, 119 PRs); only titles were enumerated, alongside a full-tree grep and a git pickaxe over all history.
- The actual disclosure made to Professors Athitsos and Verly cannot be verified, because the emails are deliberately kept out of the repo (DATASETS.md:86-88, :266-268). Only the repo's own account of what was disclosed is auditable.
- Whether a former folder name is the name of the startup DATASETS.md refers to cannot be established from the repository; the repo presents it only as a former folder name.
