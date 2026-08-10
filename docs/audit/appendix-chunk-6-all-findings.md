# Appendix: Chunk 6, all findings as produced

The complete, unedited output of the four Chunk 6 auditors and the four
skeptics who tested them. `chunk-6-evidence.md` is the write-up; this
file is the raw record behind it.

Chunk 6 was run LEAN because the weekly usage budget was at 88 per cent,
so only four findings were tested. The other 44 are individually
well-evidenced but UNTESTED, and the refutation rate across this audit
has been 61 per cent. Read them as leads.

Produced 10 August 2026.

---

## Classification key

- **deliberate-history**: labelled as superseded, reader knows which is
  current. This is the project's own stated design and counts as
  compliance.
- **stale**: not updated when a number moved, unlabelled.
- **contradiction**: two live claims that cannot both be true.
- **unsupported**: no evidence file anywhere.

---

## All 48 findings

### C6-01. README says the refractory period is not built, in a section that already described it built at 150 ms

|                             |               |
| --------------------------- | ------------- |
| Classification              | contradiction |
| Severity as filed           | critical      |
| Verification                | **SURVIVED**  |
| Severity after verification | **high**      |

**The published claim.** README.md:328-330 "A refractory period ... should remove most of them. It is planned and it is not built."

**Evidence.** src/core/constants.ts:99 `export const BLINK_REFRACTORY_MS = 150;`; src/core/blink.ts:85-88 suppresses a closure inside that window; README.md:298-303 itself says "a completed closure is not counted if it ends within 150 milliseconds of the previous one ... That removed 39 false alarms" (matches docs/eyeblink8-result.txt:58).

**Detail.** Two unlabelled live claims 28 lines apart, one saying built and one saying not built. A reader who stops at line 330 concludes the fix is future work when it shipped in #190 and is the reason false alarms fell to 72. The same paragraph's "111 fewer chances" (README.md:299) appears in no evidence file; it only re-derives as 72 remaining plus 39 removed.

**Corrected statement.** README.md:328-330 says the refractory period "is not built" 28 lines after README.md:296-317 describes it built at 150 ms, with neither claim labelled

**Skeptic's reasoning.** Confirmed as a real, unlabelled contradiction. README.md:328-330 says the refractory period "is planned and it is not built", while README.md:296-303 in the same section says a closure is not counted if it ends within 150 ms of the previous one and that this "removed 39 false alarms", and README.md:305-317 adds three more paragraphs defending the value, ending "It stays at 150." The code is built: src/core/constants.ts:99 BLINK_REFRACTORY_MS = 150 and src/core/blink.ts:85 suppresses a closure inside that window; docs/eyeblink8-result.txt:57-58 confirms "The refractory period of #190 then removed 39 of those false alarms at ZERO cost to recall." Not deliberate history: git log -L 328,330:README.md shows the sentence entered in 478575e (#173) before the feature existed and survived 9e7a21e (#182), while the built paragraph arrived later in bd2a98d (#191) without removing it, and nothing labels it as superseded even though this page labels superseded claims elsewhere (README.md:270, 325, 347-353). Severity lowered from critical to high: no published measurement is wrong, the headline 87.7 percent and 72 false alarms reproduce, and lines 328-330 are the tail of a stale block whose "53" counts (README.md:319, 323) belong to the superseded middle column (README.md:56, matching docs/evidence/2026-08-09/tables/false_positive_overlap.txt:3 "53 false alarms in this run"), so a linear reader meets the true, far more detailed account first. The sub-point also holds: "111 fewer chances" (README.md:299) appears in no evidence file and only re-derives as 72 plus 39.

### C6-02. The withdrawn-glasses paragraph publishes the wrong run's figures and reverses the precision direction

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | high         |
| Verification      | **UNTESTED** |

**The published claim.** README.md:243-247 "On the corrected run the glasses clip scores 83.7% recall and 83.7% precision. The seven without score 82.7% recall and 86.8% precision. So recall is one point apart, and precision is three points apart in the other direction."

**Evidence.** docs/eyeblink8-result.txt:21-22 for the corrected run: "with glasses 1 clip(s), recall 88.4%, precision 88.4%" and "without 7 clip(s), recall 87.7%, precision 82.7%". The 83.7/83.7 pair is the SUPERSEDED run, docs/eyeblink8-result.txt:95.

**Detail.** Nothing labels these as older numbers; the sentence says "On the corrected run". Under the real corrected run the glasses clip is higher on BOTH recall (88.4 vs 87.7) and precision (88.4 vs 82.7), so "three points apart in the other direction" is false, and the 5.7-point precision gap is nearly twice what is printed. The paragraph's conclusion (claim withdrawn, nothing settled) survives, but every number under it is wrong.

### C6-03. False-alarm counts silently switch to the superseded run's 53 denominator mid-section

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | high         |
| Verification      | **UNTESTED** |

**The published claim.** README.md:319 "8 of the 53 are more than four frames away" and README.md:323 "41 of the 53 are three frames long or shorter", cited to docs/evidence/2026-08-09/tables/false_positive_overlap.txt (README.md:331-333)

**Evidence.** Recomputed from docs/evidence/2026-08-09/tables-current-run/eyeblink8_false_positives.csv (72 rows): 8 are >4 frames away, 61 of 72 are <=3 frames long. docs/eyeblink8-result.txt:64 agrees ("61 of 72 are three frames long or shorter"). The cited docs/evidence/2026-08-09/tables/false_positive_overlap.txt:3 opens "53 false alarms in this run" and its line 8 is the source of the 41.

**Detail.** The section headline is the current 72 (README.md:276, 314) and then two counts appear against 53 with no label. 41 of 53 is simply not a fact about the published run; the true figure is 61 of 72. The 8 happens to be right by coincidence (72-64 and 53-45 both give 8). The cited .txt is the second run's output sitting in a directory whose sibling CSV is the first run's, so the citation cannot support either printed number.

### C6-04. The per-clip recall range is the second run's, published with the word "now"

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | high         |
| Verification      | **UNTESTED** |

**The published claim.** README.md:166 "Per clip recall now runs from 67.7% to 91.7%."

**Evidence.** docs/eyeblink8-result.txt:11-18, current run per-clip recall: 81.6, 90.9, 76.9, 80.6, 93.3, 90.2, 95.8, 88.4. The real range is 76.9% to 95.8%. 67.7% is the first run's 26122013_230103_cam (docs/eyeblink8-result.txt:88); 91.7% is 66 of 72, a second-run figure saved nowhere in the repo.

**Detail.** "now" makes it a live claim about the published 87.7% run. Both ends are wrong and both understate the result, so a reader checking the worst clip against the table two screens up finds a number that does not exist. The rest of the paragraph (55.7 to 89.8, 58.3 to 91.7, 54 blinks, 284 to 338) is explicitly the first-to-second comparison and reads as deliberate history.

### C6-05. Unit and Python test counts are stale by 31 and 34 tests

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | medium       |
| Verification      | **UNTESTED** |

**The published claim.** README.md:482 "That is 442 unit tests, 7 end to end tests and 61 Python tests plus 2 skipped, all green on every pull request."

**Evidence.** `node node_modules/vitest/vitest.mjs list` in the worktree: 473 tests across 49 files. `analysis/.venv/bin/python -m pytest tests -q`: 95 passed, 2 skipped (97 collected). Playwright `--list`: 7 tests in 2 files locally, 5 on CI (playwright.config.ts:60-63 drops WebKit when CI is set).

**Detail.** 442 and 61 are both undercounts with no label marking them historic. The e2e figure of 7 is correct locally but "all green on every pull request" covers only the 5 Chromium runs, since .github/workflows/ci.yml:26 installs Chromium alone. ARCHITECTURE.md:18 carries a third figure, 461.

### C6-06. Frame-loss ceiling is stated against the superseded run's 70 misses

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | medium       |
| Verification      | **UNTESTED** |

**The published claim.** README.md:200 "At the very most the lost frames explain 4 of the 70 remaining misses."

**Evidence.** The published run has 50 misses: docs/evidence/2026-08-09/tables-current-run/eyeblink8_misses.csv holds exactly 50 rows, and docs/eyeblink8-result.txt:5 gives 358 of 408. 70 is 408-338, the second run.

**Detail.** Unlabelled, inside a paragraph written in the present tense about the current corpus check. It also understates the ceiling's weight: 4 of 50 is a bigger share than 4 of 70, so the stale number happens to flatter the corpus-is-not-the-excuse argument.

### C6-07. README describes docs/eyeblink8-result.txt as carrying stale lines it no longer carries

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | medium       |
| Verification      | **UNTESTED** |

**The published claim.** README.md:349-353 "Two lines in that file are older than this page and disagree with it. It still says the third capped clip lost its first row, and it still says 45 of the 53 sit on a real blink with half of them 3 frames long or shorter. ... That file has not been rewritten yet."

**Evidence.** grep of docs/eyeblink8-result.txt finds no "first row", no "45 of the 53" and no "half": lines 60-64 read "45 of 72 ... 64 of 72 ... 61 of 72". `git log -- docs/eyeblink8-result.txt` shows it was rewritten in bd2a98d (#191).

**Detail.** The warning is now backwards. The evidence file is current and README is the document carrying the 53-denominator counts (README.md:319, 323). A reader following the pointer to check the discrepancy finds neither of the two sentences described.

### C6-08. The browser-agreement table has no evidence file anywhere in the repository

|                   |              |
| ----------------- | ------------ |
| Classification    | unsupported  |
| Severity as filed | medium       |
| Verification      | **UNTESTED** |

**The published claim.** README.md:444-454 the Chrome/Safari table: 4,202 and 4,203 frames, 59.99 and 60.00 fps, 1 long closure each, PERCLOS peak 34.3% and 34.5%, eyes shut 49 to 58 s, 0.02 mm mean aperture difference, 0.4 percent baseline difference

**Evidence.** Every one of these figures appears only in README.md. Grep across docs/, docs/evidence/, ARCHITECTURE.md, STATE.md, MODEL_CARD.md, LEARNING.md, test/MANUAL.md returns hits for none of 4202, 4203, 34.3, 34.5, 59.99. docs/evidence/2026-08-09/ contains no cross-browser output.

**Detail.** Nine published numbers, presented as a measurement that answers "does it give the same answer twice", resting on no saved export. Contrast with the neighbouring 6,655 of 12,626 claim (README.md:469), which is corroborated three times over in LEARNING.md:601, docs/log.md:69 and test/MANUAL.md:61.

### C6-09. The frame-loss audit publishes five counts with no saved output

|                   |              |
| ----------------- | ------------ |
| Classification    | unsupported  |
| Severity as filed | medium       |
| Verification      | **UNTESTED** |

**The published claim.** README.md:196-199 "the eight clips lose 787 frames between them, spread over 174 gaps ... Twelve of those gaps are long freezes of half a second or more. Those twelve sit in three clips and hold 611 of the 787 lost frames."

**Evidence.** analysis/tools/audit_frame_loss.py exists and states the rule in its docstring, but no output file for it exists under docs/evidence/. The only other occurrence of 787/174 in the repository is STATE.md:148, which restates the same claim.

**Detail.** The README says "so you do not have to take the number on trust", yet reproducing it needs the Eyeblink8 corpus, which is not in the repository, and no run of the script was saved. The script's own docstring records that this project once printed "737 lost frames across 3 clips", which is exactly the failure mode a saved output would prevent.

### C6-10. The byte-identical repeatability claim has no checksum evidence in the repository

|                   |              |
| ----------------- | ------------ |
| Classification    | unsupported  |
| Severity as filed | medium       |
| Verification      | **UNTESTED** |

**The published claim.** README.md:79-80 and README.md:463-464 "Measuring one clip three times now produces identical files, byte for byte."

**Evidence.** docs/evidence/2026-08-09/repeatability/ holds four runs of 27122013_154548_cam whose eight CSVs all have DIFFERENT md5 sums; docs/evidence/2026-08-09/README.md:53-58 labels them the pre-fix demonstration for issue #174 (45/9, 43/7, 43/7 detections). No post-fix triple-run output or checksum file exists under docs/evidence/.

**Detail.** The saved repeatability folder shows non-repeatability, which is the bug, not the fix. This is the single property the third column rests on ("the first figure on this page that gives the same answer twice"), and the only evidence for it lives in pull request #189's body rather than in the repository.

### C6-11. Three of the eight clips hold more than fifty annotated blinks, not two

|                   |               |
| ----------------- | ------------- |
| Classification    | contradiction |
| Severity as filed | low           |
| Verification      | **UNTESTED**  |

**The published claim.** README.md:92-94 "Two of the eight clips hold more than fifty blinks, 88 in one and 72 in the other."

**Evidence.** docs/eyeblink8-result.txt:11-18 annotated counts: 38, 88, 65, 31, 30, 41, 72, 43. 26122013_230103_cam holds 65. Both statements are live and unlabelled.

**Detail.** The sentence is doing explanatory work about which clips the fifty-row cap could bite, and as written it is a false statement about the clips. The cap counted detections, not annotated blinks, which README.md:176-178 goes on to correct for a different clip, so the correction sits eighty lines after the error it half fixes.

### C6-12. DATASETS.md names 21 datasets, not roughly forty

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | low          |
| Verification      | **UNTESTED** |

**The published claim.** README.md:484 "[DATASETS.md](DATASETS.md) records roughly forty public datasets assessed against four requirements"

**Evidence.** DATASETS.md names 12 licence-blocked datasets (lines 165-180), 6 wrong-data datasets (lines 184-190) and 3 finalists (from line 192): 21 in total. DATASETS.md:418 says the search "produced roughly forty assessments", which counts agent assessments rather than datasets.

**Detail.** The forty is real but it is a count of assessments across eleven agents in two passes, several of which covered the same dataset. README converts it into forty recorded datasets, which is roughly double what the document lists. The four requirements are correct (DATASETS.md:16-20).

### C6-13. MODEL_CARD says the DROZY results are unpublished; they are published in the same repository

|                             |               |
| --------------------------- | ------------- |
| Classification              | contradiction |
| Severity as filed           | critical      |
| Verification                | **REFUTED**   |
| Severity after verification | **low**       |

**The published claim.** MODEL_CARD.md:47-49 "A sleepiness validation ... has been built and pre-registered (docs/drozy-analysis-plan.md) and its results are not yet published."

**Evidence.** docs/drozy-result.txt exists and carries the full result (7 Spearman rhos, Holm p, permutation control, verdict). README.md:378-390 prints the correlation table and README.md:428 links docs/drozy-result.txt. Commit d8d250c, "docs: publish the DROZY result, which is a null result (#201)", is 9 commits before HEAD (0dcb520).

**Detail.** MODEL_CARD.md:43-44 calls this "the most important line on the page". A technical stranger reading the model card is told the sleepiness question is open when the repository already answers it as a null result. Neither statement is labelled as superseded, so this is not the project's deliberate-history pattern.

**Corrected statement.** MODEL_CARD is a self-dated 9 August snapshot and DROZY published the next morning, so its pointer list is one day stale rather than contradictory

**Skeptic's reasoning.** MODEL_CARD.md:6-7 carries an explicit as-of stamp above every claim: "Written 9 August 2026 against the state of `main` on that date." Git confirms MODEL_CARD.md was last changed in c8554de at 2026-08-09 23:42:39, while docs/drozy-result.txt was created in d8d250c at 2026-08-10 09:03:16 - so line 49 was true when written and the result landed about nine hours later. This is the dated-snapshot case, not two unlabelled live claims. There is also no substantive contradiction: MODEL_CARD.md:50-51 says to treat the score "as an illustration ... not as evidence that it works", and README.md:424-426, written after the DROZY run, concludes the score "has never been shown to correspond to anyone's actual sleepiness. That was true before this measurement and it is still true after it." The page is uniformly frozen at its stated date rather than selectively wrong - MODEL_CARD.md:76 still carries 78.6% for fully-closed misses, retired by 23832c5 at 2026-08-10 08:35. The only real residual is that the pointer list at MODEL_CARD.md:167-168 names docs/drozy-analysis-plan.md but not docs/drozy-result.txt, a one-day freshness nit.

### C6-14. STATE.md says the DROZY result is not in this repository while the repository publishes it

|                             |               |
| --------------------------- | ------------- |
| Classification              | contradiction |
| Severity as filed           | critical      |
| Verification                | **SURVIVED**  |
| Severity after verification | **high**      |

**The published claim.** STATE.md:9-10 "Track B ... has been measured once and its result is NOT published" and STATE.md:22-23 "### The DROZY result, held deliberately / Measured, analysed, and NOT in this repository."

**Evidence.** docs/drozy-result.txt is committed and README.md:364-432 publishes the whole result including the exclusion-bias table (analysed n=20 mean KSS 4.60, excluded n=16 mean 6.38). Commit d8d250c (#201) merged it.

**Detail.** The whole section heading "held deliberately" asserts an embargo that was lifted. Anything downstream that trusts STATE.md as the status of record, including MODEL_CARD.md:49, inherits the error.

**Corrected statement.** STATE.md:9-10 and :22-24 and MODEL_CARD.md:49 say the DROZY result is unpublished, but README.md:355-432 and docs/drozy-result.txt publish it in full

**Skeptic's reasoning.** Confirmed at the line level. STATE.md:9-10 says the Track B result "is NOT published"; STATE.md:22 heads a section "The DROZY result, held deliberately" and STATE.md:24 says "Measured, analysed, and NOT in this repository." Meanwhile docs/drozy-result.txt is git-tracked (verified with git ls-files) and README.md:355-432 publishes the entire result, opening "This is a null result and it is published", with the seven-feature correlation table and the exclusion-bias table (analysed n=20 mean 4.60, excluded n=16 mean 6.38). Commit d8d250c (#201) at 2026-08-10 09:03 added docs/drozy-result.txt and 81 README lines; STATE.md's last edit is 23832c5 (#200) at 08:35, 28 minutes earlier, so the file was never updated. This is not deliberate history: ARCHITECTURE.md:132 governs correcting numbers by adding a column, and the DROZY section of STATE.md carries no superseded label, no "as of" caveat, and no pointer to the published file. It is not a dated archive either: README.md:510 presents STATE.md as "where things stand right now", and STATE.md:3's own vintage stamp ("Last commit ... #198") is itself stale because #200 edited the file after it. MODEL_CARD.md:49 inherits the same false statement ("its results are not yet published"). Two live, unlabelled claims that cannot both be true, so contradiction is the right class. I lower critical to high: the error misstates publication status rather than corrupting any measurement, no headline number is affected, and MODEL_CARD.md:44-47 still correctly warns the alertness score has never been shown to match real sleepiness, so the published null result does not make the instrument look better than the card claims.

### C6-15. The published reproduction command reproduces the retired 82.8% number, not the headline 87.7%

|                             |               |
| --------------------------- | ------------- |
| Classification              | contradiction |
| Severity as filed           | critical      |
| Verification                | **SURVIVED**  |
| Severity after verification | **high**      |

**The published claim.** STATE.md:303-308 "## How the Track A number is produced" followed by evaluate_eyeblink8.py ... "$DATASETS/eyeblink8-measured-capfix"

**Evidence.** I ran that exact command against the corpus: it prints "Recall 82.8% (338 of 408 found) / Precision 86.4% (53 invented) / F1 84.6%" — the retired second column. STATE.md:77-79 publishes 87.7/83.3/85.4 and STATE.md:103 says the figure comes from eyeblink8-measured-refractory. docs/eyeblink8-result.txt:29-33 uses -refractory.

**Detail.** A reader who follows the section titled "How the Track A number is produced" gets a different answer from the headline and no warning. The folder name is stale from the second run; only this one path was missed when the rest of the file moved to -refractory.

**Corrected statement.** STATE.md's "How the Track A number is produced" command still points at the retired -capfix folder, so it prints 82.8%, not the headline 87.7%

**Skeptic's reasoning.** SURVIVES, with severity reduced and classification corrected from contradiction to stale. Verified by execution, not reading: `PYTHONPATH="$PWD" .venv/bin/python tools/evaluate_eyeblink8.py "$DATASETS/eyeblink8/eyeblink8" "$DATASETS/eyeblink8-measured-capfix"` (STATE.md:305-308, under the heading "## How the Track A number is produced" at STATE.md:303) prints "Recall 82.8% (338 of 408 found) / Precision 86.4% (53 invented) / F1 84.6%". The same command with `-refractory` prints the published 87.7/83.3/85.4. STATE.md:77-79 publishes 87.7/83.3/85.4 and STATE.md:103 says "Measured from `$DATASETS/eyeblink8-measured-refractory`", so the recipe under the heading disagrees with the headline 200 lines above it. It is not deliberate history: there is no superseded label anywhere in STATE.md:303-320, and docs/eyeblink8-result.txt:35-39 carries the same command under "HOW TO REPRODUCE THIS EXACTLY" with `-refractory`, proving the project's intent is the current folder. `git log -L 303,310:STATE.md` shows the path was set to `-capfix` in #173 (the 82.8% run) and never moved for #189/#190, so this is a missed update, not a preserved column under ARCHITECTURE.md:132. Two aggravators: STATE.md:311-314 tells the reader to check the coverage table as the trap detector, and capfix's coverage matches the annotation exactly, so the prescribed guard passes silently; and STATE.md:292-295 also tells you to WRITE new runs into `-capfix`. Two mitigators drop this from critical to high: STATE.md:68-70 does label `-capfix` as "export fixed, clock still wobbling" against `-refractory` "(CURRENT)", so the same file contains the correction, and 82.8% is itself an owned, labelled column at STATE.md:90 rather than a novel number. No published headline is falsified; the defect is in the reproduction instructions of the handoff document. Worktree confirmed clean.

### C6-16. MODEL_CARD publishes the retired 78.6% miss figure as a live, unlabelled claim

|                   |               |
| ----------------- | ------------- |
| Classification    | contradiction |
| Severity as filed | high          |
| Verification      | **UNTESTED**  |

**The published claim.** MODEL_CARD.md:69-70 "Of the blinks it missed on Eyeblink8, 78.6% contained at least one frame a human marked as fully closed."

**Evidence.** I recomputed from docs/evidence/2026-08-09/tables-current-run/eyeblink8_misses.csv: 50 miss rows, 36 with fullyClosedFrames > 0 = 72.0%. STATE.md:165 publishes 72.0% and STATE.md:173 explicitly retires 78.6% as "55 of 70, the second run". Commit 23832c5 is titled "78.6% becomes 72.0%".

**Detail.** MODEL_CARD.md:73 also cites issue #179 as open; STATE.md:171 says the rebuild "Closes #179". The 9 August date at MODEL_CARD.md:6 is not a supersession label, and the project's own rule at ARCHITECTURE.md:132-133 is to add a column, not to leave the old number standing alone in the trust document.

### C6-17. MODEL_CARD describes the frame-rate failure as still near-silent after the loud refusal shipped

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | high         |
| Verification      | **UNTESTED** |

**The published claim.** MODEL_CARD.md:64-67 "The failure is currently near-silent: one line of small text, while everything else on the page carries on looking healthy. ... Issue #192."

**Evidence.** Commit a257203 (#198) body reads "Closes #192". src/core/fpsGate.ts:38-52 defines clipRefusedMessage, which emits "NO BLINKS WERE MEASURED IN THIS CLIP..."; it is wired at src/main.ts:827 and covered by test/core/fpsGate.test.ts:61-91. STATE.md:16 records "#198 the loud frame rate refusal (closed #192)".

**Detail.** The model card's "Where it fails" section is the part a stranger reads to judge trustworthiness, and it points at a closed issue as the current state. fpsGate.ts:22-25 describes the near-silent behaviour explicitly as the reason the new message was added.

### C6-18. STATE.md reports a blocked pull request whose change has already landed in STATE.md itself

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | high         |
| Verification      | **UNTESTED** |

**The published claim.** STATE.md:17-20 "OPEN AND WAITING FOR THE OWNER: pull request #195, which rebuilds the miss table and moves a published figure from 78.6% to 72.0%. It was not merged because the owner asked to see number changes first."

**Evidence.** Commit 23832c5, "docs: rebuild the miss table for the current run, 78.6% becomes 72.0% (#200)", is merged and in history. The rebuilt table is committed at docs/evidence/2026-08-09/tables-current-run/eyeblink8_misses.csv (50 rows), and STATE.md:165 four screens later already prints "36 of the 50 misses of the CURRENT run, 72.0%".

**Detail.** The file contradicts itself: line 19 says the move to 72.0% is unmerged and waiting, line 165 publishes 72.0% as established. A reader cannot tell which of the two figures is live from STATE.md alone.

### C6-19. The byte-identical repeatability claim has no post-fix evidence file in the repository

|                   |              |
| ----------------- | ------------ |
| Classification    | unsupported  |
| Severity as filed | high         |
| Verification      | **UNTESTED** |

**The published claim.** MODEL_CARD.md:130-131 "Measuring one clip three times now produces identical files, byte for byte" and STATE.md:81-83 "THIS ONE REPEATS. Measuring one clip three times produces identical files, byte for byte."

**Evidence.** docs/evidence/2026-08-09/repeatability/ holds published-run, re-run-A, re-run-B and re-run-C. `diff -q` against published-run reports DIFFERENT for all three. docs/evidence/2026-08-09/findings/issue-174-repeatability.md:19-25 confirms these are the PRE-fix runs (43/45/43/43 detections) that proved non-repeatability. No post-fix checksum or triple-run output exists anywhere under docs/evidence/.

**Detail.** STATE.md:82-83 calls this "the single most important thing about this run", and it is the one headline property with nothing checkable behind it in-repo. Chunk 4 located the checksums in pull request #189's body, which is outside the repository and outside `git log`.

### C6-20. STATE.md's unit and Python test counts are two revisions behind the suites

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | medium       |
| Verification      | **UNTESTED** |

**The published claim.** STATE.md:376-377 "Test count: 442 unit tests, 7 end to end tests across two browser engines, 61 Python tests passed plus 2 skipped"

**Evidence.** `npx vitest run` reports "Test Files 49 passed (49) / Tests 473 passed (473)". `analysis/.venv/bin/python -m pytest -q` reports "95 passed, 2 skipped". The e2e half is exact: `npx playwright test --list` reports "Total: 7 tests in 2 files", 5 chromium plus 2 webkit.

**Detail.** 442 vs 473 unit and 61 vs 95 Python. The e2e figure traces cleanly, so only two of the three numbers are wrong; the line reads as one verified block and is not.

### C6-21. ARCHITECTURE gives a third, different unit-test count

|                   |               |
| ----------------- | ------------- |
| Classification    | contradiction |
| Severity as filed | medium        |
| Verification      | **UNTESTED**  |

**The published claim.** ARCHITECTURE.md:18 "That is why 461 unit tests run in about two seconds with no browser."

**Evidence.** `npx vitest run` reports 473 tests in 2.71 s. STATE.md:376 says 442. ARCHITECTURE.md:18 says 461.

**Detail.** Three documents give three counts for one suite and none is labelled as historical. The "about two seconds" half is correct (2.71 s measured).

### C6-22. The frame-loss ceiling is quoted for the retired second run inside the current-run audit block

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | medium       |
| Verification      | **UNTESTED** |

**The published claim.** STATE.md:152 "At the very most the lost frames explain 4 of the 70 misses."

**Evidence.** I re-ran analysis/tools/audit_frame_loss.py against the corpus and eyeblink8-measured-refractory: "12 of 408 annotated blinks are touched by a gap. 3 of those 12 were missed by the app, so the lost frames explain at most 3 misses." Against eyeblink8-measured-capfix it prints 4. The current run has 50 misses (STATE.md:165), not 70.

**Detail.** Both numbers in the sentence belong to the superseded capfix run, and it sits thirteen lines above a bullet that does say "the CURRENT run", so the reader has no cue that this one does not. Everything else in the same bullet re-derives exactly: 787 frames over 174 gaps in 8 of 8 clips, 1.10%, 12 long freezes in 3 clips holding 611.

### C6-23. The status header names a commit eleven merges behind HEAD

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | medium       |
| Verification      | **UNTESTED** |

**The published claim.** STATE.md:3 "Last commit: squash merge of pull request #198 on 2026-08-10" and STATE.md:5 "Currently working: nothing."

**Evidence.** `git log -1` gives 0dcb520 "docs(audit): chunk 5 findings, the interface layer and accessibility (#209)". Commits #199 through #209 followed #198, including #200 and #201 which changed published numbers. docs/audit/ holds ten chunk reports and AUDIT_PLAN.md was modified after STATE.md's last edit.

**Detail.** This is the file the master prompt specifies as a ten-line status header, and it is now 405 lines carrying published figures (87.7/83.3/85.4, 72.0%, 787 frames, throughput). A status file that both ages fast and carries headline numbers guarantees that stale status and stale published claims travel together, which is what findings 2, 3, 6 and 10 all are.

### C6-24. Two browser engines is true on a laptop only; CI runs Chromium alone

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | low          |
| Verification      | **UNTESTED** |

**The published claim.** ARCHITECTURE.md:93 "test/e2e/ Playwright, two browser engines"

**Evidence.** playwright.config.ts:60-63 adds the webkit project only when `process.env.CI` is unset. `npx playwright test --list` gives 7 tests across chromium and webkit; `CI=1 npx playwright test --list` gives "Total: 5 tests", chromium only. .github/workflows/ci.yml:20 runs `npx playwright install --with-deps chromium`.

**Detail.** ARCHITECTURE.md:125 asserts "Every gate runs before every pull request" a few lines later, so a newcomer reasonably reads line 93 as describing what protects a pull request. playwright.config.ts:36-58 documents the retreat honestly; ARCHITECTURE does not carry the qualifier.

### C6-25. The miss table withheld on GPL3 grounds is committed, and the licence question was never answered

|                   |               |
| ----------------- | ------------- |
| Classification    | contradiction |
| Severity as filed | high          |
| Verification      | **UNTESTED**  |

**The published claim.** docs/evidence/2026-08-09/README.md:105 "The third table of the set, `eyeblink8_misses.csv`, is deliberately not here" and :287 "`eyeblink8_misses.csv` is not committed"; findings/issue-179-stale-tables.md:60 "`eyeblink8_misses.csv` is **not** committed" and :80 "can be rebuilt whenever the licence question is answered"

**Evidence.** docs/evidence/2026-08-09/tables-current-run/eyeblink8_misses.csv exists, 50 data rows, added by commit 23832c5 (PR #200). Its header carries exactly the five fields issue-179-stale-tables.md:63-65 named as the licence problem: blink_id, startFrame, endFrame, frameLength, fullyClosedFrames. DATASETS.md:383 still reads "copyleft would need thought before publishing derived files"; grep across the repo finds no decision answering it, and PR #200's body never mentions licence.

**Detail.** Two live documents state a withholding rule; a third directory breaks it. The rule was self-imposed precisely because "git keeps every file forever" (issue-179-stale-tables.md:70). Either the rule is retired in writing or the file comes out.

### C6-26. README cites an output file that contains neither published number, and contains a decoy 45

|                   |              |
| ----------------- | ------------ |
| Classification    | unsupported  |
| Severity as filed | high         |
| Verification      | **UNTESTED** |

**The published claim.** README.md:330-333 "The script behind all of these counts is .../false_positive_overlap.py, and its output is .../tables/false_positive_overlap.txt", covering README.md:276 "45 of the 72" (strict rule) and :286 "64 of the 72" (tolerance rule)

**Evidence.** tables/false_positive_overlap.txt reads "53 false alarms in this run", "tolerance rule 45 of 53", "strict rule 38 of 53". I ran the script from a scratch copy: against datasets/eyeblink8-measured-capfix it reproduces that file exactly (53/45/38/41), so the saved output is the SECOND run's. Against datasets/eyeblink8-measured-refractory (the published run) it prints "72 false alarms", "tolerance 64 of 72", "strict 45 of 72", "61 of 72 are 3 frames long or shorter" — matching README.md:276/286 and docs/eyeblink8-result.txt:62-64. That output is saved nowhere.

**Detail.** The cited file contains a 45, but it is 45 of 53 under the TOLERANCE rule, while README:276 prints 45 of 72 under the STRICT rule. A reader checking the citation finds a matching digit and concludes the claim is sourced. This is the exact trap docs/evidence/2026-08-09/README.md:82-90 warns about for a different 45.

### C6-27. Two 53-run figures sit unlabelled inside a section whose subject is 72 false alarms

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | high         |
| Verification      | **UNTESTED** |

**The published claim.** README.md:319 "8 of the 53 are more than four frames away from any blink the human marked" and README.md:323 "41 of the 53 are three frames long or shorter"

**Evidence.** The same section opens at README.md:276 with "45 of the 72" and :286 "64 of the 72". 53 is the eyeblink8-measured-capfix run; my run of false_positive_overlap.py against eyeblink8-measured-refractory gives 61 of 72 short (not 41 of 53) and 8 of 72 beyond tolerance (not 8 of 53). docs/eyeblink8-result.txt:64 already publishes "61 of 72".

**Detail.** README.md:325 even says "This page used to say half of them were that short. That was wrong" — a correction applied to the wrong run's denominator. No column, no label, no supersession marker, in violation of ARCHITECTURE.md:132.

### C6-28. The withdrawn-glasses paragraph publishes the second run's split, sourced to indep_eval.py against capfix

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | high         |
| Verification      | **UNTESTED** |

**The published claim.** README.md:243-245 "On the corrected run the glasses clip scores 83.7% recall and 83.7% precision. The seven without score 82.7% recall and 86.8% precision."

**Evidence.** I ran docs/evidence/2026-08-09/scripts/checks/indep_eval.py unchanged (it hardwires eyeblink8-measured-capfix at indep_eval.py:188). It prints "glasses=YES: 1 clips, recall 83.7209%, precision 83.7209%" and "glasses=NO: 7 clips, recall 82.7397%, precision 86.7816%" — README:243-245 exactly. docs/eyeblink8-result.txt gives 88.4%/88.4% for the glasses clip on the current run, and AUDIT_PLAN.md:425-427 gives 88.4 and 87.7.

**Detail.** This locates the source: the paragraph is the capfix run read through an evidence script that was never repointed. The word "corrected" in README:243 meant the cap fix, not the current run. indep_eval.py's output is saved nowhere, so nothing in the repo exposes the mismatch.

### C6-29. The evidence index never mentions tables-current-run/, the one directory the live headline rests on

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | medium       |
| Verification      | **UNTESTED** |

**The published claim.** docs/evidence/2026-08-09/README.md is presented as the index of the folder ("What is in each folder", lines 26-186)

**Evidence.** grep -n "tables-current-run" docs/evidence/2026-08-09/README.md returns nothing. README.md:268 cites docs/evidence/2026-08-09/tables-current-run/ as the row-by-row source for the live 72.0% miss claim, and STATE.md:171 does the same. The directory was added by commit 23832c5; the index was last touched by 9e7a21e.

**Detail.** The index carefully labels tables/ as superseded (lines 78-80) but is silent on the directory that supersedes it. tables-current-run/ also carries no README of its own. I confirmed autopsy.py regenerates all three of its files byte-identically against eyeblink8-measured-refractory, so the data is sound; only the index is wrong.

### C6-30. Seven of the twenty scripts cannot run, and the replay numbers they produced were never saved

|                   |              |
| ----------------- | ------------ |
| Classification    | unsupported  |
| Severity as filed | medium       |
| Verification      | **UNTESTED** |

**The published claim.** docs/evidence/2026-08-09/README.md:110-111 "These make the findings reproducible. They are the reason this folder is worth having at all."; findings/issue-178-max-blink-duration.md:58-60 "Files in this folder that support it: ../scripts/replay/"

**Evidence.** In a scratch copy with paths repointed at the real datasets, exp.py, exp2.py, exp3.py, exp4.py, exp5.py, exp6.py and verify.py all die with FileNotFoundError on scripts/replay/traces/<clip>.json, because scripts/replay/traces/ (20 MB) was excluded on purpose (README.md:195). No script under scripts/replay/ has any saved output: trace.py writes traces/, verify.py writes floors.json, exp.py writes perblink.json, misses.py writes misses.json, probe.py writes probe.json — none are in the repository.

**Detail.** The whole sweep table at issue-178-max-blink-duration.md:22-30 (F1 92.1 to 93.6, 13 detections, the 0.40/0.45/0.50/0.55/0.60/0.70 sweep, "costs 0", "costs 10", "costs 4") and issue-176's fidelity figures (0.6-1.5%, -0.0044 mm, +0.0098 mm, 14.4% split) exist only as prose in the finding pages. exp7.py, misses.py and probe.py do run; all three are wired to datasets/eyeblink8-measured, the FIRST run.

### C6-31. The browser-agreement table has no evidence file anywhere; the only record restates the table itself

|                   |              |
| ----------------- | ------------ |
| Classification    | unsupported  |
| Severity as filed | medium       |
| Verification      | **UNTESTED** |

**The published claim.** README.md:442-455, the Chrome-against-Safari agreement table: 4,202 frames, 59.99 vs 60.00, PERCLOS peak 34.3% vs 34.5%, "Blink rate per minute was identical in both browsers to the last decimal", "aperture differed by 0.02 mm on average and the learned personal baseline by 0.4 percent"

**Evidence.** grep for 4,202 / 4202 / Safari across all .md and .txt (excluding node_modules and .venv) finds only README.md:444 and prose in LEARNING.md/test/MANUAL.md. `git log --all -S "4,202"` returns one commit, 1de3ae4 (#156). PR #156's body reproduces the identical five-row table and the 0.02 mm / 0.4 percent sentence, with no attached CSV or log. gh search for the table's phrases returns nothing.

**Detail.** Six numbers are published, including a "to the last decimal" identity claim across 71 seconds, with no per-second file, no export, no log. The source is the maintainer's own 70-second recording, which cannot be published, but the derived per-second comparison could have been and was not.

### C6-32. Post-fix byte-identical repeatability has no artefact in docs/evidence/; only truncated checksums in a PR body

|                   |              |
| ----------------- | ------------ |
| Classification    | unsupported  |
| Severity as filed | medium       |
| Verification      | **UNTESTED** |

**The published claim.** README.md:80 and :464, STATE.md:82, MODEL_CARD.md:131, docs/eyeblink8-result.txt:41-42 "Measuring one clip three times now produces identical files, byte for byte"

**Evidence.** docs/evidence/2026-08-09/repeatability/ holds only PRE-fix runs. md5 of the four 27122013_154548_cam.blinks.csv files: 4314e7aa…, 2c8f466b…, 5cb83694…, 8c2cdc07… — all four differ, with 43/45/43/43 detections, matching the index at README.md:55-58. PR #189's body is the only post-fix record and gives 8-hex-character truncated checksums ("719ebe5c…") for three runs of 54 detections; the underlying files are not in the repository.

**Detail.** The evidence folder proves the defect and not the fix. A truncated 8-character checksum in a PR description is not a verifiable artefact, and the 54-detection run it describes does not correspond to any committed file.

### C6-33. The index calls the 53-alarm file "the corrected run" while giving its siblings an explicit do-not-read-as-current warning

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | medium       |
| Verification      | **UNTESTED** |

**The published claim.** docs/evidence/2026-08-09/README.md:92 "Two tables describe the **corrected** run and the corpus itself" and :96 "how many of the 53 false alarms sit on a real blink, under two rules"

**Evidence.** tables/false_positive_overlap.txt reproduces exactly against datasets/eyeblink8-measured-capfix, two runs behind the published one. By contrast the index warns at :78-80 that tables/eyeblink8_clip_summary.csv and eyeblink8_false_positives.csv "describe the **first** corpus run, which has since been superseded... Do not read either as current." No equivalent sentence exists for false_positive_overlap.txt.

**Detail.** "Corrected" was true when written (it meant the cap fix) and reads as "current" now. The project's own labelling discipline was applied to the neighbouring files and not to this one. tables/resolution_snr.txt and .json are unaffected: they measure raw pixels, and I reproduced resolution_snr.json byte-identically.

### C6-34. The frame-loss ceiling is quoted against the second run's 70 misses; the current run gives 3 of 50

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | medium       |
| Verification      | **UNTESTED** |

**The published claim.** README.md:200 "At the very most the lost frames explain 4 of the 70 remaining misses"; STATE.md:159 same figure

**Evidence.** I ran the cited script, analysis/tools/audit_frame_loss.py. With datasets/eyeblink8-measured-capfix it prints "4 of those 12 were missed by the app, so the lost frames explain at most 4 misses". With datasets/eyeblink8-measured-refractory (the published run) it prints "3 of those 12". The current run has 50 misses, not 70 (docs/evidence/2026-08-09/tables-current-run/eyeblink8_misses.csv, 50 rows).

**Detail.** The rest of the paragraph is sound: 787 frames over 174 gaps, 1.10% of 71,354, 12 long freezes in 3 clips holding 611, all reproduce exactly. Only the two run-dependent numbers, 4 and 70, are stale. The script's output is not saved anywhere, which is why the drift went unseen.

### C6-35. finalise.py was never run on tables-current-run/, so the current run has no cause labels

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | low          |
| Verification      | **UNTESTED** |

**The published claim.** docs/evidence/2026-08-09/README.md:120-121 "`finalise.py`, which adds the cause label column"; :102 "Most rows of the false alarm table carry the label `double_fire_on_a_real_blink`"

**Evidence.** tables/eyeblink8_false_positives.csv ends in a `kind` column (39 double_fire_on_a_real_blink, 1 near_a_real_blink, 5 phantom_far_from_any_blink). tables-current-run/eyeblink8_false_positives.csv ends in `framesToNearestAnnotatedBlink` and tables-current-run/eyeblink8_misses.csv ends in `matched`; neither has `kind` or `cause`. My run of autopsy.py alone reproduced all three current-run files byte-identically, confirming finalise.py was skipped.

**Detail.** The cause taxonomy at issue-179-stale-tables.md:14-20 (A_export_log_capped_at_50 and the rest) therefore has no current-run counterpart, and issue-179's own complaint — "Nobody knows how many of the current misses fall into that bucket" — still stands for the 50.

### C6-36. The index's own file count and size are out of date

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | low          |
| Verification      | **UNTESTED** |

**The published claim.** docs/evidence/2026-08-09/README.md:8 "This folder is 42 files and about 290 KB"

**Evidence.** `find docs/evidence -type f | wc -l` returns 45; total bytes 316,035 (about 309 KB). The three files added by commit 23832c5 under tables-current-run/ are the difference.

**Detail.** Minor on its own, but it is the same omission as the missing tables-current-run/ section: the index was not touched when the folder grew.

### C6-37. README's withdrawn-glasses paragraph prints the FIRST run's numbers as the corrected run's

|                   |               |
| ----------------- | ------------- |
| Classification    | contradiction |
| Severity as filed | critical      |
| Verification      | **UNTESTED**  |

**The published claim.** README.md:243-244 "On the corrected run the glasses clip scores 83.7% recall and 83.7% precision. The seven without score 82.7% recall and 86.8% precision."

**Evidence.** docs/eyeblink8-result.txt:21-22 (current run): with glasses recall 88.4% precision 88.4%; without recall 87.7% precision 82.7%. The 83.7/83.7 and 86.7 pair is the SUPERSEDED run at docs/eyeblink8-result.txt:95-96. STATE.md:139-142 states the correct current split. Recomputed from docs/evidence/2026-08-09/tables-current-run/eyeblink8_clip_summary.csv: without-glasses tp 320 of 365 = 87.7% recall, 320 of 387 = 82.7% precision.

**Detail.** The paragraph exists to withdraw a claim, and it withdraws it using the very run it says was defective. README also mislabels 82.7% as the without-glasses recall when 82.7% is that group's precision. Three documents state this quantity and README is the one a stranger reads first.

### C6-38. MODEL_CARD publishes 78.6% for fully-closed misses where README and STATE publish 72.0% and retire 78.6%

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | high         |
| Verification      | **UNTESTED** |

**The published claim.** MODEL_CARD.md:70 "Of the blinks it missed on Eyeblink8, 78.6% contained at least one frame a human marked as fully closed."

**Evidence.** README.md:260 "36 of the 50 missed blinks, 72.0%"; STATE.md:165 same; docs/evidence/2026-08-09/tables-current-run/eyeblink8_misses.csv has exactly 50 rows. README.md:270 explicitly retires the figure: "An earlier version of this page said 78.6%, which was 55 of 70". MODEL_CARD.md last changed in c8554de (9 Aug); the rebuild landed in 23832c5 (#200, 10 Aug) without touching it.

**Detail.** No label marks it as superseded, unlike docs/eyeblink8-result.txt:73-77 which carries the same 78.6% under an explicit "NOT REBUILT FOR THIS RUN" heading. MODEL_CARD is a standalone summary read without the README beside it, so the retired number reads as current there.

### C6-39. README says the refractory period is not built two paragraphs after describing it as built at 150 ms

|                   |               |
| ----------------- | ------------- |
| Classification    | contradiction |
| Severity as filed | high          |
| Verification      | **UNTESTED**  |

**The published claim.** README.md:328-330 "A refractory period ... should remove most of them. It is planned and it is not built."

**Evidence.** README.md:296-303 "a completed closure is not counted if it ends within 150 milliseconds of the previous one ... That removed 39 false alarms"; MODEL_CARD.md:75-76; STATE.md:174-177; docs/eyeblink8-result.txt:57. Code confirms it ships: src/core/constants.ts:99 `export const BLINK_REFRACTORY_MS = 150;` and src/core/blink.ts:83-86 `withinRefractory = ... < BLINK_REFRACTORY_MS`.

**Detail.** Both statements are live and unlabelled, 28 lines apart in the same section of the most-read document. Every other document and the shipped code agree the rule exists.

### C6-40. Current-run paragraph still counts against the superseded 53 false alarms, and one numerator is wrong too

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | high         |
| Verification      | **UNTESTED** |

**The published claim.** README.md:323 "41 of the 53 are three frames long or shorter" and README.md:319 "8 of the 53 are more than four frames away from any blink the human marked"

**Evidence.** Recomputed from docs/evidence/2026-08-09/tables-current-run/eyeblink8_false_positives.csv (72 rows): 61 of 72 are 3 frames or shorter, 45 of 72 overlap strictly, 64 of 72 within 4 frames, 8 of 72 further than 4 frames. docs/eyeblink8-result.txt:64 "61 of 72 are three frames long or shorter"; STATE.md:178-179 same. The 41-of-53 figure is the second run's, at docs/evidence/2026-08-09/tables/false_positive_overlap.txt:8.

**Detail.** Same paragraph as README.md:276 and :286, which correctly use 72. The 8 in line 319 happens to hold for both runs; the 41 in line 323 does not, and understates the share by eight points.

### C6-41. README's evidence pointer for the false-alarm counts leads to a table describing a different run

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | high         |
| Verification      | **UNTESTED** |

**The published claim.** README.md:331-333 cites docs/evidence/2026-08-09/tables/false_positive_overlap.txt as "The script behind all of these counts ... and its output is [that file]"

**Evidence.** docs/evidence/2026-08-09/tables/false_positive_overlap.txt:3 "53 false alarms in this run", :5 "tolerance rule 45 of 53", :6 "strict rule 38 of 53", :8 "41 of 53 are 3 frames long or shorter". README's live counts are 45, 64, 61 and 8 out of 72. docs/evidence/2026-08-09/README.md:84-90, :96 and :141 also still describe that 53-alarm run as "the corrected run" and its 45 as the LOOSER rule, where README's 45 is now the STRICT rule over 72.

**Detail.** A reader following the link to check the printed numbers finds a file that agrees with none of them, and the evidence folder's own disambiguation note now points the wrong way.

### C6-42. Two current-summary documents say the sleepiness result is unpublished; README publishes it in full

|                   |               |
| ----------------- | ------------- |
| Classification    | contradiction |
| Severity as filed | high          |
| Verification      | **UNTESTED**  |

**The published claim.** STATE.md:9-10 "its result is NOT published" and :24 "Measured, analysed, and NOT in this repository"; MODEL_CARD.md:49 "its results are not yet published"

**Evidence.** README.md:355-434 publishes the whole DROZY null result including the seven correlations and the exclusion-bias table; docs/drozy-result.txt is committed (54 lines) and cited at README.md:428; ROADMAP.md:18 states the null result too. Published by commit d8d250c (#201, 2026-08-10). STATE.md was last written by the same-day commit 23832c5 (#200) and MODEL_CARD.md by c8554de (9 Aug).

**Detail.** MODEL_CARD.md:44 flags its own line as "the most important line on the page", so a reader is told the validation is unpublished at exactly the point they are told to pay most attention. STATE.md contradicts itself in that its own line 1 announces the DROZY measurement.

### C6-43. STATE reports pull request #195 as still open although the change it describes has already landed

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | medium       |
| Verification      | **UNTESTED** |

**The published claim.** STATE.md:17-20 "OPEN AND WAITING FOR THE OWNER: pull request #195, which rebuilds the miss table and moves a published figure from 78.6% to 72.0%."

**Evidence.** Commit 23832c5 "docs: rebuild the miss table for the current run, 78.6% becomes 72.0% (#200)" is in the history; docs/evidence/2026-08-09/tables-current-run/eyeblink8_misses.csv exists with 50 rows; and STATE.md:165 itself already publishes "36 of the 50 misses of the CURRENT run, 72.0%".

**Detail.** STATE.md contradicts itself 148 lines apart: line 18 says a figure is waiting to move and line 165 has already moved it. STATE.md is the file the project directs a fresh reader to for where things stand.

### C6-44. Three documents give three unit-test counts and none matches the suite

|                   |               |
| ----------------- | ------------- |
| Classification    | contradiction |
| Severity as filed | medium        |
| Verification      | **UNTESTED**  |

**The published claim.** README.md:482 and STATE.md:376 "442 unit tests"; ARCHITECTURE.md:18 "461 unit tests run in about two seconds"

**Evidence.** Static count of test callsites across test/**/*.test.ts (49 files) is 473 `it(` and zero `test(`, with zero uses of `.each`, so the count is unambiguous. Provenance: the 442 was written in 478575e (#173, 9 Aug), the 461 in the later c8554de (#194, 9 Aug).

**Detail.** Two current summaries and the architecture map disagree with each other and all three understate the suite. Neither number carries a date or an "as of" label, so both read as current.

### C6-45. Python test count is 36 short, the e2e figure is a local run count, and the two-engine claim is not what CI runs

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | medium       |
| Verification      | **UNTESTED** |

**The published claim.** README.md:482 "7 end to end tests and 61 Python tests plus 2 skipped"; STATE.md:376-377 "7 end to end tests across two browser engines, 61 Python tests"; ARCHITECTURE.md:92 "test/e2e/ Playwright, two browser engines"

**Evidence.** 97 `def test_` across 8 files in analysis/tests/. test/e2e holds 5 `test(` declarations (calibration.spec.ts 2, videoFile.spec.ts 3); 7 is 5 chromium plus 2 webkit runs. playwright.config.ts:47-62 adds webkit only when process.env.CI is unset, and .github/workflows/ci.yml:26 runs `npx playwright install --with-deps chromium`.

**Detail.** README.md:482 attaches "all green on every pull request" to a 7 that only occurs on a laptop. playwright.config.ts:33-46 is candid that CI is Chromium-only, so ARCHITECTURE.md:92's bare "two browser engines" is the one place the qualification is dropped.

### C6-46. README and STATE give incompatible accounts of how many rows the cap deleted from the third clip

|                   |               |
| ----------------- | ------------- |
| Classification    | contradiction |
| Severity as filed | medium        |
| Verification      | **UNTESTED**  |

**The published claim.** README.md:179-181 "How many rows that clip lost cannot be recovered ... it holds fifty rows whatever number was cut from the front of it" versus STATE.md:128-130 "which made exactly 50 detections and lost its first one. That one was a false positive"

**Evidence.** README.md:176 frames its version as "One correction to the story above", i.e. it knows it is correcting an earlier account; STATE.md still carries the uncorrected account, unlabelled, in a section headed "CAVEAT when comparing the two runs" (STATE.md:124).

**Detail.** One document says the loss is unrecoverable, the other says it was exactly one row and names what it was. Neither is marked superseded, so both read as live.

### C6-47. Two README sentences use the second run's per-clip range and miss count in the present tense

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | medium       |
| Verification      | **UNTESTED** |

**The published claim.** README.md:166 "Per clip recall now runs from 67.7% to 91.7%" and README.md:200 "At the very most the lost frames explain 4 of the 70 remaining misses"

**Evidence.** Current per-clip recall from docs/eyeblink8-result.txt:11-18 runs 76.9% to 95.8% (recomputed from docs/evidence/2026-08-09/tables-current-run/eyeblink8_clip_summary.csv: 31/38, 80/88, 50/65, 25/31, 28/30, 37/41, 69/72, 38/43). Current miss count is 50, stated at README.md:260 and confirmed by the 50 rows of tables-current-run/eyeblink8_misses.csv. STATE.md:159 repeats the same "4 of the 70 misses".

**Detail.** The words "now" and "remaining" make both live claims. README.md:270 elsewhere identifies 70 as the previous run's miss count, so the document names the number as superseded in one place and uses it as current in another.

### C6-48. README warns the reader that its evidence file is stale, and the file was rewritten while README was not

|                   |              |
| ----------------- | ------------ |
| Classification    | stale        |
| Severity as filed | medium       |
| Verification      | **UNTESTED** |

**The published claim.** README.md:348-353 "Two lines in that file are older than this page and disagree with it. It still says the third capped clip lost its first row, and it still says 45 of the 53 sit on a real blink with half of them 3 frames long or shorter. That file has not been rewritten yet."

**Evidence.** Neither described line survives in docs/eyeblink8-result.txt: no "first row" text appears anywhere, and lines 62-64 read "45 of 72 sit on a real blink under the strict rule" and "61 of 72 are three frames long or shorter". The described text did exist at commit 478575e ("45 of the 53 invented blinks sit on top of a real blink, and half of them are 3 frames long or shorter") and was replaced by bd2a98d (#191). The README paragraph was written earlier, in 9e7a21e (#182).

**Detail.** The direction is now inverted: README.md:323 is the document still saying "41 of the 53 ... three frames long or shorter", while the file it accuses carries the corrected 61 of 72. A reader who follows the warning distrusts the correct source.

---

## Compliance, as reported by each auditor

### Every quantitative claim in README.md (518 lines)

- 97 distinct published numbers checked in README.md. 63 traced cleanly to an evidence file under docs/evidence/, to docs/eyeblink8-result.txt or docs/drozy-result.txt, to a source constant, or to arithmetic reproducible from those. 17 more are external-paper or external-dataset facts I could not check offline. 17 are in the findings above.
- The three-column recall history (README.md:52-57) is unambiguously labelled and is the project working as designed. The columns are headed "First answer / Export fixed / Now", the current column is bolded on all four rows, and README.md:65-68 states in bold that three columns exist because the page got it wrong twice and every column stays. Each column is then given its own bullet with its defect and pull request (README.md:70-80). All twelve cells match docs/eyeblink8-result.txt:5-7, 50-52 and 81-83, and all four F1 values re-derive from their own recall and precision.
- Current-run false-alarm overlap counts re-derive exactly. Recomputed from docs/evidence/2026-08-09/tables-current-run/eyeblink8_false_positives.csv (72 rows): 45 share a frame with an annotated blink under the strict rule (README.md:276) and 64 under the four-frame rule (README.md:286). Both match docs/eyeblink8-result.txt:62-63. So the current-run overlap counts DO have a saved evidence file, contrary to the lead; what is wrong is the .txt the README cites.
- The 72.0% miss pattern re-derives: 36 of the 50 rows in docs/evidence/2026-08-09/tables-current-run/eyeblink8_misses.csv carry at least one fullyClosedFrames, exactly 72.0% (README.md:260). README.md:270 labels the retired 78.6% as "An earlier version of this page said 78.6%, which was 55 of 70", 55/70 = 78.57%, and 70 is the second run's miss count. That is deliberate history, correctly labelled.
- Frame accounting is internally exact. The Coverage block of docs/eyeblink8-result.txt:25-32 sums to 71,354 annotated and 71,356 measured, matching README.md:45 and README.md:344-345, and exactly two clips (26122013_223310_cam, 26122013_230654_cam) are one frame over. 71,354 minus 70,992 gives the 362 unannotated frame numbers of README.md:48.
- The resolution check traces line by line. docs/evidence/2026-08-09/tables/resolution_snr.txt:25 gives average change at x4 of +2.71%, README.md:219 prints +2.7%. Its lines 15-22 show five clips rising, two falling and one flat, matching README.md:221. The rule (quarter width, quarter height, one pixel in sixteen, about 94 in 100 discarded) is stated identically at README.md:214-216 and resolution_snr.txt:28-29.
- Every DROZY number matches docs/drozy-result.txt. The seven correlations at README.md:380-386 round correctly from lines 21-27 (0.444, -0.443, 0.364, 0.355, -0.327, -0.070, -0.001); the bias table at README.md:414-415 matches lines 11-12 exactly (20 / 4.60 / 2 to 8 and 16 / 6.38 / 3 to 9); the 0.44 versus 0.75 shuffled control matches line 31 (observed 0.444, chance max 0.747); the 25 fps floor matches src/core/constants.ts:123 MIN_BLINK_FPS = 25.
- The four external F1 figures the page says it computed itself all re-derive from the precision and recall it prints. 79 and 85.27 give 82.02 (README.md:123-124); 94.3 and 96.2 give 95.24 (README.md:133); 96.65 and 98.78 give 97.70 (README.md:136-137); this app's 83.3 and 87.7 give 85.44. README.md:115-143 names which figures were read first hand, which came second hand and which are the author's own site rather than the paper, and README.md:148-161 lists four ways the scoring rules differ before drawing any conclusion.
- The refractory rationale is honest about its own order of operations even though the build status sentence contradicts it: 150 ms sits below the ~200 ms floor of deliberate rapid blinking (README.md:306-307), the 39 removed false alarms cost zero recall (docs/eyeblink8-result.txt:58), and README.md:314-317 declines the 300 ms value that would flatter the score.
- Product-level numbers check out against source: the 0-to-100 alertness score is exactly 100 minus four named penalties whose caps sum to 100 (src/core/score.ts:3-8); nine-point calibration is nine targets (src/core/calibrationCapture.ts:18-27); the fifty-row display cap is BLINK_LOG_DISPLAY_CAP = 50 (src/core/constants.ts:56); "fully shut eyes as roughly a third of the open baseline" is documented at ROADMAP.md:13, src/core/perclos.ts:13 and LEARNING.md:438; Node 20 or newer is consistent with CI's node-version 26.
- Small arithmetic claims all hold: 0.033 s per frame at 30 fps; 787 of 71,354 is 1.1%; four frames is about 130 ms at 30 fps; five deliberate blinks a second is about 200 ms apart; 50 misses of 408 is roughly one blink in eight; 45 plus 8 is 53; 284 plus 54 is 338; 6,655 of 12,626 is the 53 percent described in LEARNING.md:601.
- No file was modified. `git -C <worktree> status --porcelain` is empty at the end of this audit. No npm install or npm ci was run; the only commands executed were vitest list, playwright --list and pytest against the pre-existing analysis/.venv.

### Quantitative claims in STATE.md (405 lines), MODEL_CARD.md (168 lines) and ARCHITECTURE.md (143 lines). 87 distinct quantitative claims enum

- STATE.md:77-79 and MODEL_CARD.md:25 headline 87.7% recall (358 of 408), 83.3% precision (72 invented), 85.4% F1, 8 clips, 408 blinks: matches docs/eyeblink8-result.txt:3-7 exactly.
- STATE.md:177-179 and MODEL_CARD.md:76-77 "72 remain, 45 still sit on a real blink, 61 are 3 frames or shorter": I recomputed all three from docs/evidence/2026-08-09/tables-current-run/eyeblink8_false_positives.csv (72 rows, 45 with framesToNearestAnnotatedBlink=0, 61 with frameLength<=3). Exact.
- STATE.md:148-160 frame loss: 787 frames over 174 gaps in 8 of 8 clips, 1.10% of 71,354, 12 long freezes in 3 clips holding 611. I re-ran analysis/tools/audit_frame_loss.py; every figure reproduces to the digit, and the rule travels with the number as the file demands.
- STATE.md:86-90 the three-column history (69.6/77.1, 82.8/84.6, 87.7/85.4) with each cause named: deliberate history, matching README.md:55-57 and docs/eyeblink8-result.txt:44-48. This is the ARCHITECTURE.md:132 rule working.
- STATE.md:172-173 retiring 87.9% (109 of 124) and 78.6% (55 of 70) with the run each belongs to: deliberate history, correctly labelled at the point of use.
- STATE.md:119-121 the cap-fix attribution: 55.7% to 89.8% and 58.3% to 91.7%, 30 and 24 blinks, 54 total, 284 to 338. I confirmed 89.8% and 91.7% by evaluating eyeblink8-measured-capfix; 338-284=54 and the per-clip deltas are exact.
- STATE.md:236-245 throughput: clips 2 to 8 of the capfix run sum to exactly 55,572 frames, and 09:51:36 to 10:07:30 is 954 s, giving 58.25 fps. Arithmetic exact, and the retired 8.4 fps / 2.4 hour figure is labelled as retired.
- STATE.md:381-390 DROZY.zip is byte-exact at 2,463,610,084 and the archive holds exactly 36 mp4 files plus KSS.txt, which is 14 rows of 3. (Caveat: KSS.txt has 41 non-zero ratings, so L390's "0 meaning the session never happened" accounts for only one of the five sessions with no video.)
- STATE.md:393-396 DROZY arithmetic: 36 x 600 x 30 = 648,000 frames, /58 = 3.10 h; 36 x 120 x 30 = 129,600, /58 = 37.2 min. All exact, and L398-400 flags both as untested assumptions.
- STATE.md:339-357 and ARCHITECTURE.md:125-129 the gate list: lint, typecheck, test, e2e, format:check, build, plus ruff check, ruff format --check and pytest. Matches .github/workflows/ci.yml line for line across both jobs.
- ARCHITECTURE.md constants all trace to code: 478 face points (constants.ts:5 LANDMARK_COUNT), 11.7 mm iris (constants.ts:12), 30 s baseline (constants.ts:135), half the open aperture (constants.ts:138), half a second closure (constants.ts:105), four named penalties (score.ts:5,32,38,46,54), ~45 modules (src/core/ holds exactly 45), 9.2 s at 120 Hz (sparkline.ts:18-19).
- MODEL_CARD.md:104 "DROZY subjects 14, of whom 13 usable" (KSS.txt has 14 rows; docs/drozy-result.txt:7 reports 13 subjects), MODEL_CARD.md:37-39 "F1 between about 82% and about 98%" (README.md:107-114 and :135-137), MODEL_CARD.md:83 "roughly a third of the open baseline" (src/core/perclos.ts:13). MODEL_CARD.md:85's "twelve second closure" rounds perclos.ts:16's 12.9 s down, the only loose rounding I found.

### Does docs/evidence/ actually support what is attributed to it? (20 scripts, 6 finding pages, 2 run logs, 2 table dirs, repeatability dir)

- resolution_snr.py reproduces byte-identically: my run against datasets/eyeblink8/eyeblink8 produced JSON identical to docs/evidence/2026-08-09/tables/resolution_snr.json, and the same +2.27%/+2.71% averages and per-clip table as tables/resolution_snr.txt. The .txt states the rule beside the number and states the sign.
- false_positive_overlap.py reproduces its saved output exactly against datasets/eyeblink8-measured-capfix (53 alarms, 45 tolerance, 38 strict, 41 short, and the identical seven tolerance-only frame ranges). The script prints both rules and takes its paths as arguments, so it carries no machine-specific path.
- autopsy.py regenerates all three tables-current-run/ files byte-identically when pointed at datasets/eyeblink8-measured-refractory (diff clean on eyeblink8_misses.csv, eyeblink8_false_positives.csv and eyeblink8_clip_summary.csv). The current-run tables are genuine, reproducible output.
- docs/evidence/2026-08-09/README.md:78-80 labels tables/eyeblink8_clip_summary.csv and eyeblink8_false_positives.csv as the superseded first run and says "Do not read either as current" — the ARCHITECTURE.md:132 rule working as designed.
- docs/evidence/2026-08-09/README.md:82-90 warns explicitly that the 45 rows of the first run's false-alarm table and the README's 45 are equal by coincidence, and that counting rows "does not confirm the README's 45". A deliberate, well-drawn trap warning.
- repeatability/ supports issue #174 exactly as described: detection counts 43/45/43/43 match README.md:55-58, and all four blinks.csv md5 sums differ (4314e7aa, 2c8f466b, 5cb83694, 8c2cdc07), which is the defect the issue claims.
- findings/issue-174-repeatability.md corrects the issue it supports, dropping issue #174's own claim that mixA and mixC were extra corpus runs (evidence README:43-46, :338-339). A finding page that argues against its own issue.
- analysis/tools/audit_frame_loss.py, cited at README.md:201-202, reproduces exactly: 787 frames lost over 174 gaps in 8 of 8 clips, 1.10% of 71,354, 12 long freezes in 3 clips holding 611. The rule travels with the number in the script's own docstring.
- The no-non-ASCII rule at docs/evidence/2026-08-09/README.md:270-279 still holds: the published command returns 0 across all 45 files, including the three added later.
- Every script in the folder carries /PATH/TO/ placeholders rather than the maintainer's account name, as claimed at README.md:281-285; the two argument-taking scripts are correctly named as the exception at :169-170.
- The two run logs (run-logs/, 857 bytes each) are exactly what README.md:174-184 says: near-identical, both ending "done. 8 measured, 0 failed.", neither naming the build. They are the whole of issue #175 in two files.
- findings/issue-178-max-blink-duration.md:62-64 states plainly what its evidence does NOT show ("The 13 detections came from the replay, not from the shipped app. That number has to be earned by a real run before it is quoted anywhere"), and the 13 is indeed absent from README.md.

### Cross-document numeric consistency: the same quantity stated differently in two places

- Three-column history table (README.md:52-57) with its stated reason (README.md:65-68) reproduces exactly in STATE.md:86-90 and docs/eyeblink8-result.txt:48-52 — 69.6/82.8/87.7 recall, 77.1/84.6/85.4 F1, all three kept and each tied to the pull request that moved it. The deliberate-history mechanism works as designed.
- Headline recall 87.7%, precision 83.3%, F1 85.4% is identical in all four places it appears: README.md:54-57, STATE.md:77-79, MODEL_CARD.md:25, docs/eyeblink8-result.txt:5-7.
- Frame accounting agrees everywhere: 71,354 annotated, 71,356 measured, 70,992 annotation rows at README.md:45,47,343 and STATE.md:98,155,334, with README.md:42-50 explaining why a reader will meet two totals.
- STATE.md:165-173 applies the "add a column" rule outside README: all three fully-closed-miss figures are kept, each labelled with the run it measured (87.9% = 109 of 124 first run, 78.6% = 55 of 70 second, 72.0% = 36 of 50 current).
- DROZY figures agree to the digit across four documents: 36 sessions, 16 excluded, 20 analysed, 13 subjects, KSS 4.60 vs 6.38 — README.md:378-386 and :412-416, docs/drozy-result.txt:4-12 and :21-27, STATE.md:40-41, ROADMAP.md:18.
- Frame-loss figures agree between README.md:196-199 and STATE.md:148-158 (787 frames, 174 gaps, 12 long gaps in 3 clips holding 611, 1.1%), and STATE.md:155-157 explicitly retires the earlier 737 / 1.011% with the reason no single rule produces them.
- docs/evidence/2026-08-09/README.md:82-90 pre-empts a coincidence trap by warning that eyeblink8_false_positives.csv's 45 rows and README's 45 are different quantities that happen to be equal. Unusually careful number hygiene.
- LEARNING.md and docs/log.md are dated per-increment notes (both last touched 35461f3, 2026-08-08) and carry none of the benchmark headline numbers at all — grep for 87.7, 82.8, 83.3, 78.6, 442 and 461 returns nothing in either. Correctly snapshots, and correctly free of drift.
- The finding pages docs/evidence/2026-08-09/findings/issue-176-double-counting.md and issue-179-stale-tables.md open by dating themselves to 9 August 2026 and describe the second run's 53 false alarms and 124/70 misses. These are records of an investigation, not current claims, and their old numbers are correct in context.
- ARCHITECTURE.md:88 "~45 modules" matches the 45 .ts files in src/core/, and :36 "MediaPipe, 478 face points" matches src/core/constants.ts:5 `LANDMARK_COUNT = 478`.
- SPEC.md, ROADMAP.md, PROJECT.md and DATASETS.md carry no benchmark headline number that disagrees with README; ROADMAP.md:18 (amendment 8, dated 2026-08-10) states the DROZY null result consistently with README.md:388-392 and docs/drozy-result.txt:49-52.
- Snapshot-versus-current classification is unambiguous in this repository: README.md, MODEL_CARD.md, STATE.md and ARCHITECTURE.md present themselves as current summaries; LEARNING.md, docs/log.md and docs/evidence/2026-08-09/findings/* date themselves in their first lines. Every finding above is scored against a current-summary document.

---

## What each auditor could not check

### Every quantitative claim in README.md (518 lines)

- Anything needing the Eyeblink8 corpus itself, which is not in the repository: the 70,992 annotated rows (README.md:47), the 787 lost frames over 174 gaps and the 611 in twelve long freezes (README.md:196-199), "in all eight clips the person faces the camera in every single frame" and "no blink the human marked is shorter than 4 frames" (README.md:205-206). The misses table's own minimum frameLength is 4, which is consistent but covers only the 50 missed blinks, not all 408.
- External published figures: Fogelton and Benesova's 91.6% (2016) and 91.3% (2018), taken from the author's project site rather than the paywalled papers (README.md:126-129); his 804 per-eye blink total (README.md:152); and the DROZY README quote about the 15 fps recordings being "tests 2 and 3 of subjects 1->8" (README.md:407-409). All are cited well enough for a reader to check them, which is the point the README makes about them.
- README.md:366 says DROZY is "fourteen people" while docs/drozy-result.txt:7 reports 13 subjects. The README sentence describes the dataset and the result file describes the analysed sessions, so the two are probably compatible, but I have no way to confirm DROZY's subject count without the dataset.
- The second run's per-clip figures (89.8% and 91.7%, 79 and 66 true positives, "every other clip found exactly the same number", "seven of those are in the two recovered clips", "four of the six shorter clips shifted the edges") are saved nowhere. docs/evidence/2026-08-09/tables/ is the FIRST run (its tp column sums to 284) while its false_positive_overlap.txt is the SECOND run's 53 alarms. The 89.8 and 91.7 are arithmetically consistent with the +30 and +24 recoveries but rest on no file.
- Whether the Chrome/Safari table's PERCLOS peak of 34.3% is consistent with a single long closure spanning 49 to 58 s. 9 seconds in a 60-second window is about 15%, so reaching 34% needs roughly 12 further seconds of sub-threshold frames. That may be legitimate given the 40 percent shut line, but with no saved export I cannot tell.

### Quantitative claims in STATE.md (405 lines), MODEL_CARD.md (168 lines) and ARCHITECTURE.md (143 lines). 87 distinct quantitative claims enum

- STATE.md:373-374 open state of issues #15, #90, #107, #108, #115, and the open/closed state of pull request #195 itself: no network access to the issue tracker. The #195 finding rests on the merged commit 23832c5, not on the tracker.
- STATE.md:45 "its manual and automatic annotations being 68 point face landmarks": only KSS.txt was extracted from DROZY.zip, so the annotation files were not inspected.
- STATE.md:51 "A re-run needs a re-extract and re-transcode from DROZY.zip, about 8 minutes": would require re-running the extract, which I did not do.
- STATE.md:245 "Per clip the rate runs 56.9 to 58.9": the aggregate 58.25 fps re-derives exactly, but the per-clip spread depends on file mtimes I did not enumerate individually.
- MODEL_CARD.md:28 gaze "reliable near the centre, degrades at the corners": no saved measurement exists behind this; it is qualitative and the table's own "Validated against" column says "nine point calibration, one person".

### Does docs/evidence/ actually support what is attributed to it? (20 scripts, 6 finding pages, 2 run logs, 2 table dirs, repeatability dir)

- trace.py could not be run: mediapipe and cv2 are not installed in analysis/.venv, and installing packages is out of scope. So I could not confirm the 20 MB traces/ input regenerates, only that its absence stops seven scripts.
- Whether the six trace-dependent replay scripts would still produce the numbers published in findings/issue-176 and issue-178 if traces/ were rebuilt. Their inputs are gone and their outputs were never saved, so the claim is untestable from the repository alone.
- Whether the source recordings and per-second exports behind the Chrome/Safari table survive on the maintainer's machine. Nothing outside PR #156's body references them.
- The full checksums behind PR #189's byte-identical claim. The PR body truncates them to eight hex characters, so I could not verify the three post-fix runs actually agreed.
- diffruns.py's "4 of 6" result and gap_ceiling.py's "49 of 124, 39.5% ceiling" run cleanly but I found no published claim that quotes either, so I could not match them to anything to confirm or refute.

### Cross-document numeric consistency: the same quantity stated differently in two places

- Whether pull request #195 is genuinely closed on GitHub. No network access. Inferred closed from commit 23832c5 "docs: rebuild the miss table for the current run, 78.6% becomes 72.0% (#200)" carrying the identical change.
- The pre-refractory false-alarm count behind README.md:299 "There are now 111 fewer chances of that". No clockfix run folder or table is committed, and 111 appears in no other document — STATE.md:177, MODEL_CARD.md:76 and docs/eyeblink8-result.txt:57 all say the rule removed 39. 111 = 72 + 39 arithmetically, but nothing on disk states it.
- The browser-agreement table at README.md:443-448 (Chrome 4,202 frames vs Safari 4,203, PERCLOS peak 34.3% vs 34.5%). No saved output exists anywhere under docs/evidence/, so there is no second statement of these quantities to compare against.
- Test counts were taken statically (473 `it(` callsites with no `.each`, 97 `def test_`, 5 `test(` in test/e2e). The suites were not executed, since npm install is forbidden here, so a runtime pass count could differ from the callsite count.
- docs/UI.md, AUDIT_PLAN.md and docs/audit/* were not swept. They are audit and interface working documents rather than published claims, and AUDIT_PLAN.md restates the leads this sweep was asked to verify independently.
