# Chunk 1: documents, configuration and process

Part of the August 2026 audit. See `AUDIT_PLAN.md` for scope and method.

Covers checklist groups B1 to B7 (required files, layout, the
documentation trail), C1 to C6 (roadmap traceability), F1 to F6 (the
per-increment process), G1 to G4 (separation from commercial work), and
parts of A1, A2, A3 and D10.

Completed 10 August 2026. Findings below are final for this chunk.

---

## Method

Eight auditors read the repository in parallel, read-only, one per
constraint group. They produced 61 findings.

Every finding at high severity then went to a separate skeptic whose
instructions were to REFUTE it, with an explicit rule to default to
refuted when uncertain. Seventeen findings were tested this way, across
two verification passes.

This matters for how the results read. An audit that reports whatever
its first pass produced is padded by construction. The numbers below are
what remained after a second, hostile reading.

---

## Headline

**Nothing survived at high severity. Nothing was found at critical.**

| Outcome                                                       | Count |
| ------------------------------------------------------------- | ----- |
| Findings produced by the auditors                             | 61    |
| Tested by a skeptic                                           | 17    |
| Survived, corrected to medium                                 | 7     |
| Survived, corrected to low                                    | 3     |
| Refuted as stated, corrected down to a smaller true statement | 5     |
| Refuted outright, no defect                                   | 2     |
| Not tested, medium or low, carried forward as unverified      | 44    |

Six of the seventeen tested findings did not hold as written. That rate
is a caution about the other 44, which were never attacked. They are
listed separately below and must be treated as weaker evidence.

The verdict on this chunk in one sentence: **the process discipline of
this project is unusually strong for a solo build and collapsed in a
specific, datable way on 8 August 2026, and the strongest surviving
defect is not a process defect at all but an untested measurement
layer.**

---

## Surviving findings

### Medium

**M1. `src/io` has no unit tests, and nine pull requests changed code
without adding any check.** (A3)

`grep -rn "src/io" test/` returns nothing at all. The frame stepper that
produces every published benchmark number has no unit test. Its only
coverage is a plus or minus one frame-count assertion at
`test/e2e/videoFile.spec.ts:160`, which is loose enough that the
off-by-one fixed in #156 would have fitted inside it undetected.

Nine merged pull requests touched `src/`, `analysis/blinklab/` or
`tools/` and no test path. Three of the nine are measurement-correctness
fixes, not cosmetics:

- #156 fixed counting the last frame twice.
- #169 fixed a frame-rate guess that doubled every count.
- #189 fixed MediaPipe being handed the wall clock instead of the clip
  clock, which is the defect that made measurements unrepeatable.

Each was verified by hand in the pull request body and by nothing else.

The master prompt requires every increment to add or update at least one
automated check unless it is purely documentation.

The skeptic corrected the count from ten to nine (#185 did update a
check, #183 is comment-only) and confirmed the rest. **This is the most
consequential finding in the chunk**, because it is the one that touches
measurement rather than paperwork.

**M2. Row 7.7's stated check does not exist, and the negative control
has an untested branch that would fake a pass.** (C2)

Row 7.7 is ticked. Its check reads "test asserting the collapse". The
only shuffle-the-labels artefact is `_shuffled_null` at
`analysis/tools/analyse_drozy.py:97-116`, whose single caller at
`:216-223` prints to standard output. A correct search over
`analysis/tests`, `test/` and `.github` finds no test and no continuous
integration step that touches it.

`test_stats.py` exercises `permutation_p` on hand-made synthetic pairs.
That tests the statistic. It does not test that this pipeline's real
labels collapse to chance when shuffled.

The skeptic confirmed it and found something worse: a silent-zero branch
in the same path that is also untested, and which would produce a
passing-looking negative control.

The negative control is the single most credible thing this project
publishes. It is the one result a stranger would trust first. It has no
test.

**M3. The `STATE.md` field contract is broken.** (B4)

`Next increment:` does not appear anywhere in the file. `Known issues:`
and `Test count:` exist at lines 372 and 376, below 370 lines of prose,
so a reader sees four of the seven required fields. Two of those four
have lost their shape: `Last increment:` is a prose sentence with no
increment number, `Last commit:` has no commit hash.

This was not always so. `git show 7012c1c:STATE.md` is exactly seven
lines with all seven fields. Forty versions held that shape until PR
#166 dropped to six fields and 58 lines.

`LEARNING.md:8` still tells the reader "STATE.md is a ten line snapshot
of where we are", so the repository now contradicts itself.

**M4. The documentation trail stops dead on 8 August.** (B5, B6)

`git log -1 -- LEARNING.md` and `git log -1 -- docs/log.md` both return
the same commit, `35461f3`, dated 2026-08-08. Thirty-five pull requests
have merged since.

Unrecorded work includes five behaviour changes to the measurement core
(#169, #172, #188, #189, #190) and the entire DROZY analysis.

The skeptic tempered this: the substance of the 9 and 10 August work is
documented at head in `ROADMAP.md` amendments 8 and 9, in `STATE.md`,
`README.md` and `MODEL_CARD.md`. The loss is the teaching note, not the
record.

**M5. Three ticked roadmap rows have no `LEARNING.md` entry.** (B5)

Rows 7.7, 8.2 and 8.4. `LEARNING.md` covers 62 of the 65 ticked rows;
these are the three ticked after the trail stopped. None is trivial: 8.2
and 8.4 shipped new root documents, and 7.7 is the negative control.

`README.md:511` tells a reader the file carries "one plain English
engineering note per increment". That promise is now false.

**M6. The Definition of Done checklist was abandoned at PR #134 with no
written reason.** (F6)

Of 118 merged pull requests, 61 carry the checklist and 57 do not. Every
pull request from #2 to #132 has it except #93. Every one from #134 to
#203 lacks it except #181. The template still carries it, as the master
prompt requires.

The skeptic confirmed the abandonment is genuinely silent, and measured
the consequence: the checklist items that continuous integration does
not enforce lapsed with it. `LEARNING.md` notes on code pull requests
fell from 51 of 52 to 10 of 36.

That is the real finding. The checklist was not decoration. It was the
only thing holding the human-judgement items, and when it went, they
went.

**M7. Issue-then-pull-request discipline breaks at #136 and does not
recover.** (F2)

Thirty-eight of 119 pull requests cite no issue. The break starts at
#136 and includes an unbroken run of 24 from #154 to #183.

Phases 0 to 6 are essentially perfect: every pull request from #2 to
#135 names an issue except #136. Ordering was never once inverted, in
all 81 linked pairs the issue predates the pull request.

The break coincides exactly with the point where work stopped following
roadmap rows. The protocol step "open the issue" was dropped once there
was no row to name. Nothing in the amendments records that decision.

### Low

**L1. `STATE.md` is 405 lines against a ten-line maximum.** (B4)

Real and unamended, but the skeptic corrected the framing sharply: the
cap held for 85 of the file's 88 revisions. Every version from
2026-07-28 to 2026-08-08 is exactly seven lines. The entire overrun
happened in the last two days and carries a written rationale.

Severity is low because the content is useful and nothing is hidden.
It matters mainly because this is the file every new session reads
first, so its size is spent from the context budget before any work
starts.

**L2. `docs/log.md` is missing entries for nine of 65 ticked rows.** (B6)

Six of the nine, rows 5.6 to 6.1, are tracked in open issue #108, filed
by the project itself on the same evening the gap appeared, and their
content is preserved in `LEARNING.md`. Only the one-line index entry is
missing. The other three, 7.7, 8.2 and 8.4, are untracked lag from the
9 and 10 August work.

**L3. A sixteen pull request interface campaign has no roadmap row and
no amendment.** (C5)

Verified: `ROADMAP.md` has no design or layout row, its ten amendments
contain none about the interface, and 14 of the 16 pull requests carry
no linked issue.

The skeptic corrected two supporting claims. The trace-cap defect fixed
by #186 and #188 dates to increments 3.2 and 5.6 in July, so it is a
latent pre-campaign defect, not one the campaign introduced. And
`docs/UI.md` merged at 17:43 on 8 August, before the design was built in
#162 at 19:20, so the specification preceded the build rather than
following it.

Severity is low because no measurement, published number or test is
affected. The campaign shipped green throughout. The harm is
traceability only.

---

## Refuted findings

Recorded so a future session does not raise them again. Each is followed
by the corrected statement, where one survives.

**R1. "Three required root files are missing."** (B1) → **low**

`CONTRIBUTING.md`, `SECURITY.md` and `CHANGELOG.md` genuinely do not
exist. But `CHANGELOG.md` is roadmap row 8.3 and the security policy is
part of row 8.5, both openly unticked in a phase the project has not
finished. Those are unreached work, not broken rules.

Corrected: **only `CONTRIBUTING.md` is a genuine untracked gap.** No
roadmap row would ever have created it. Partial contributing guidance
exists at `README.md:503-514`, and the missing security policy's
substance is at `README.md:476-478`.

This corrects a claim made earlier in this audit's own reporting.

**R2. "The written justification for dropping `src/ui` is contradicted
by the file it defends."** (B2) → **low**

`main.ts` is 2,764 lines and no test imports it, both true. But
`ARCHITECTURE.md:139` already says plainly that "main.ts is long and does
the wiring by hand, which is honest for its size and would not survive a
second developer without being split", and names splitting it as the
first thing a new engineer would want to change.
`decisions/ADR-0003-e2e-testing.md` gives the dated reason it has no unit
tests.

Corrected: the deviation is documented and admitted, not concealed. The
size problem is real and belongs to Chunk 5, which reads `main.ts` in
full.

**R3. "The ADR series stops and six decisions have no record."** (B7) →
**low**

The three ADR files and the 3 August stop date are real. The conclusion
is not. Every one of the six named decisions carries a dated written
record that landed in the same commit as the change: the shut line in
amendment 5, PERCLOS aliasing in amendment 6, the refractory period at
`src/core/constants.ts:80-99` with its rejected alternative design and a
plain statement that it was introduced after seeing the benchmark, the
datasets in `DATASETS.md` in ADR shape, stepped mode in `SPEC.md`, and
the scipy decision at `analysis/blinklab/stats.py:1-14` under the
heading "Three reasons this is not scipy".

The day-one roadmap itself assigns the dataset choice to `DATASETS.md`
rather than to an ADR.

Corrected: the decisions are recorded, in a different place than the
folder. Three of the six also fail the "expensive to reverse" bar
outright, being a single constant each.

**R4. "The repository promised an ADR for 7.3's dataset choice and did
not write one."** (B7) → **no defect**

The premise fails. Increment 7.3's gate returned NO, so no dataset was
chosen there. Issue #142, created before the delivering pull request,
specified `DATASETS.md` plus a numbered roadmap amendment as the record
format in advance.

The decision also reversed four times in three days. Honouring the note
literally would have produced four superseding ADRs in 72 hours.

**R5. "One increment per session collapsed."** (F1) → **no defect**

The merge counts reproduce, but they measure pull requests per calendar
day, not increments per session. This repository records no session
boundaries anywhere. The rule is not auditable from git, and the
auditor's three-hour clustering was an invention, not a measurement.

The underlying concern, that 8 to 10 August ran far ahead of the ladder,
is real and is captured by L3 and M7 instead.

**R6. "Increment size violated, 33 of 118 titles contain the word
'and'."** (A1) → **low**

The metric is invalid. `ROADMAP.md` itself sets the size rule, and 24 of
its 75 agreed increment rows contain the word "and". Row 1.6 is
literally "Mirror toggle and resolution readout". The grep flags the
approved master plan at a higher rate (32 percent) than the pull
requests it accuses (28 percent).

Corrected, and still true: **PR #194 ticked two roadmap rows at once**,
8.2 and 8.4, against the roadmap's own "one checkbox is one pull
request" rule. And #167 carried 446 lines of unrelated Python alongside
three interface changes.

**R7. "`PROJECT.md` and `DATASETS.md` give incompatible accounts of what
this project is."** (G3) → **low**

Not incompatible. `PROJECT.md:27` says not connected to any company
_codebase or dataset_, which remains true. `DATASETS.md` discloses a
startup connection in a licence assessment where the disclosure was
required to be correct.

Corrected: **`PROJECT.md`'s "not a commercial product" line dates from
2026-07-28 and was never reworded** after the startup disclosure landed
on 2026-08-08. It is a stale sentence, not a contradiction. The fix is
one edit.

---

## Unverified findings carried forward

Forty-four findings at medium or low severity were never attacked by a
skeptic. Given that six of seventeen tested findings did not survive,
**these should be read as leads, not conclusions.** The ones worth
carrying into the final report:

- `README.md:328-330` says the refractory period "is planned and it is
  not built", thirty lines after describing it as built at 150 ms. The
  stale block also carries pre-refractory counts against a different
  headline. (C6)
- `MODEL_CARD.md` contradicts `README.md` on two published numbers, and
  its own most-emphasised line tells a reader the sleepiness validation
  is unpublished when a null result is published. (C3)
- Amendment 8 was inserted mid-list on 10 August, silently renumbering
  the two after it. The list is now out of chronological order. (C4)
- Presentation logic lives inside `src/core` because there is nowhere
  else for it to go: `scorePanel`, `blinkLog.formatBlinkEvent`,
  `videoLayout.displaySize`, `sparklineSegments`,
  `deviceList.shouldShowPicker`. Every one is technically pure. By role
  they are `src/ui` work. (B3)
- The local end to end gate can still pass against a stale bundle.
  `playwright.config.ts:84` sets `reuseExistingServer` off continuous
  integration, which is issue #175 again, and the guard the project
  already built for this is not wired into it. (D10)
- Branch naming: 60 of 119 branches follow the specified pattern. The
  later ones drop the increment id. (F2)
- `README.md` never states "unaffiliated" or "not a product", two of the
  four statements the master prompt requires of it. (G3)
- `STATE.md` update discipline degraded from every commit to roughly
  half from 8 August. (B5)
- The folder name "Noddr Fun Build" survives in one evidence file, where
  it is load-bearing for the finding it appears in. (G3)

---

## What is compliant

The audit found a great deal that is correct. Recording it is not
politeness, it is the other half of the finding.

**Architecture and purity**

- `src/core` never imports outside itself. All 18 distinct import
  sources across 44 modules are `./`-relative siblings.
- No browser globals in core. The five apparent hits are four comments
  and one local variable.
- No path aliases in `tsconfig.json` that could route around the rule.
- The purity rule landed in increment 0.3 exactly as claimed, in commit
  `070e3de`, and it catches relative imports, contrary to the obvious
  worry about glob patterns.
- Every one of the 45 core modules has a matching test file.

**Roadmap delivery**

- 44 of the 48 rows in Phases 0 to 5 verified cleanly delivered, with
  both the behaviour and the stated check present, and the check
  asserting what the row says.
- 12 of the 17 ticked rows in Phases 6 to 8 verified clean.
- Row 3.5 asserts the coefficient of variation claim literally at
  `test/core/statistics.test.ts:69` and strengthens it at lines 70 to 71.
- Row 4.2 asserts "rises but never falls" exactly, holding a baseline at
  7 mm through 700 frames of 5 mm droop.
- Row 4.6 asserts null and specifically not zero.
- Row 6.5's identity holds with no clamp anywhere, and the four penalty
  caps sum to exactly 100 by construction.
- The unticked rows are genuinely undone. Nothing is silently
  delivered-but-unrecorded.
- Rows 7.5 and 7.6 are left unticked rather than ticked with an excuse.

**Process**

- Branch protection on `main` is real, verified through the GitHub API:
  `enforce_admins` enabled, force pushes and deletions off, required
  contexts `["checks", "analysis"]` with strict mode.
- Nothing was merged red. Of 118 merged pull requests, 114 have an
  all-success rollup and zero have any failure. The four with no checks
  predate continuous integration itself.
- Only 7 of 125 commits landed outside a pull request, all on the first
  day, all before branch protection merged.
- Conventional Commits conformance is 123 of 125.
- Seven tags and seven releases pair exactly, each on the real phase-end
  commit. Phases 7 and 8 have no tag, correctly, because neither has
  ended.
- Branch cleanup is near-total: 117 of 118 deleted.
- Issue-before-pull-request ordering was never inverted, in all 81
  linked pairs.

**Decisions and honesty**

- All three ADRs carry every required section and none was edited after
  merge.
- Every one of the ten amendments records a specific, checkable cause.
- Amendments 9 and 10 were written before the work they unblock.
- **No threshold constant was ever retuned after being set.** A pickaxe
  search over `MIN_BLINK_FPS`, `EYES_SHUT_FRACTION`,
  `BLINK_REFRACTORY_MS`, `BASELINE_THRESHOLD_FRACTION` and
  `MAX_BLINK_DURATION_MS` returns one commit each.
- The refractory period's post-benchmark origin is stated plainly in
  three independent places.
- **The 25 frames per second floor was not lowered to recover the 16
  excluded DROZY sessions**, even though those were the sessions the
  analysis most needed. That is the single most creditable decision in
  the record.
- The DROZY pre-registration is verifiable at file level: the plan
  appears 2026-08-09 23:42, the result 2026-08-10 09:03.

**Configuration**

- The locked stack held. A lockfile scan for every common framework and
  charting library returns nothing. One runtime dependency.
- TypeScript strict mode on, plus four extra strictness flags.
- Every gate the master prompt names runs on every pull request, plus
  two more, and a second job gates the Python track independently.
- Lint is clean across 117 files, including the configuration files.

**Commercial separation**

- No company owns the repository. `heshipstech` is a personal handle
  with `company: null`.
- All 74 issue titles and 119 pull request titles are clean of company,
  product or market language.
- No dataset media anywhere in history. The only committed clip is a
  synthetic test pattern with no faces, with its reproducing command in
  the fixture README.
- Every constant in `src/core/constants.ts` carries an in-repo
  derivation. None is sourced to an unnamed or third-party system.

---

## What could not be checked

Stated so the report does not imply more coverage than it has.

- Whether ESLint actually reports purity violations at runtime. The
  read-only mandate forbade executing the linter, so those conclusions
  come from reading the rule implementation.
- Whether protocol steps 1, 2, 3, 13, 14 and 16 were followed. They
  leave no artefact in git.
- Whether the agent ever refused a request to do more than one
  increment. Not observable.
- Step 14, hand over the review: `required_approving_review_count` is 0
  and no pull request has a recorded review, so this cannot be counted.
- Whether a session equals a calendar day or a merge cluster. No session
  boundary is recorded anywhere in the repository, which is why R5 was
  refuted.
- Whether anyone actually performed the manual checks that stand in for
  automation on rows 1.1, 1.4, 3.7 and 5.4b.
- Whether the nine code-without-test pull requests were covered by a
  check added in a neighbouring pull request. Per-pull-request file
  lists were compared, not the suite over time.
- The real end to end flake rate. `retries: 2` on continuous integration
  can absorb a flake silently.
- G1 cannot be proven as a negative. Every parameter has a stated
  in-repo derivation, but no audit can show that no threshold was
  carried mentally from elsewhere.
- The disclosure actually made to Professors Verly and Athitsos. The
  emails are deliberately kept out of the repository.

---

## Carried into the final report

Three things from this chunk belong in `AUDIT_REPORT_AUG_2026.md`
regardless of what later chunks find.

1. **M1 and M2 together.** The measurement layer that produces every
   published number has no unit test, and the negative control that
   makes those numbers credible has no test either. Both are in a
   project whose entire claim is honest measurement. This is not a
   documentation problem.
2. **The 8 August discontinuity.** Six separate findings, M4 through M7
   plus L1 and L3, all date to the same two days. That is one event with
   six symptoms, not six problems. The remediation plan should treat it
   as one.
3. **The compliance record is the finding.** Zero critical, zero high
   surviving, branch protection real, nothing merged red, no constant
   ever retuned, the frames-per-second floor not lowered when it would
   have helped. An audit that reported only the defects would misdescribe
   this repository.
