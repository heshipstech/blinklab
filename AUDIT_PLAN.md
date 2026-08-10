# AUDIT_PLAN.md

The save state for the August 2026 audit.

Rewritten 10 August 2026 against the ORIGINAL MASTER PROMPT, which was
supplied in full on that date. The first version of this file was
written against the repository's own restatement of the rules, which was
circular. This version replaces it.

Deliverable at the end: `AUDIT_REPORT_AUG_2026.md`.

---

## How to resume if the context window is lost

1. Read this file.
2. Read every file in `docs/audit/` that exists. Each one is a finished
   chunk and its findings are final.
3. The first chunk in the list below with no file in `docs/audit/` is the
   next one to run.
4. Do not restart from Chunk 1.
5. If the master prompt is needed again, ask the owner to paste it. It
   lives in `~/Downloads`, which macOS blocks, and it is deliberately
   not committed to this repository.

Each chunk gets its own branch, its own pull request and green
continuous integration. Gates before every pull request, from the repo
root: `npm run lint`, `npm run typecheck`, `npm test`, `npm run e2e`,
`npm run format:check`, `npm run build`. In `analysis/`: `ruff check .`,
`ruff format --check .`, `pytest`. Never push to main.

---

## Phase 1, reconnaissance: what was done

Eight readers ran in parallel over the whole repository, read-only, on
10 August 2026. They mapped the territory and were forbidden from
judging it. 157 tool calls, zero failures. Full transcript at
`.claude/projects/.../subagents/workflows/wf_fee8d4a2-389/`.

Areas covered: every markdown file; `src/core`; `src/main.ts` and
`src/io`; the whole `test/` tree; `analysis/` and `tools/`; every
configuration and continuous integration file; the git and GitHub
process trail; and every published number against the evidence folder.

### The shape of the thing being audited

Verified counts, not estimates.

| Area                      | Size                                              |
| ------------------------- | ------------------------------------------------- |
| `src/core/` pure logic    | 45 modules, 3,175 lines                           |
| `src/io/` the impure edge | 8 modules, 705 lines                              |
| `src/main.ts`             | 1 file, 2,764 lines                               |
| `src/ui/`                 | **does not exist**                                |
| `test/`                   | 49 unit files, 473 tests, 5 Playwright tests      |
| `analysis/` Python        | 18 files, 3,034 lines, 97 test functions          |
| `tools/`                  | 3 files, 343 lines                                |
| Markdown documents        | 29 files, 4,626 lines                             |
| Git history               | 124 commits, 118 pull requests, 84 issues, 7 tags |
| Tracked files             | 222                                               |

---

## Phase 2: scope of the audit

### In scope, file by file

**Documents.** `README.md`, `PROJECT.md`, `SPEC.md`, `ROADMAP.md`,
`STATE.md`, `LEARNING.md`, `ARCHITECTURE.md`, `MODEL_CARD.md`,
`DATASETS.md`, `LICENSE`, this file. `decisions/ADR-0001` to `0003`.
`docs/log.md`, `docs/UI.md`, `docs/drozy-analysis-plan.md`,
`docs/eyeblink8-result.txt`, `docs/drozy-result.txt`. The six finding
pages and the index under `docs/evidence/2026-08-09/`. `test/MANUAL.md`,
`test/fixtures/README.md`, `analysis/README.md`.

**Source.** All 45 modules in `src/core/`. All 8 in `src/io/`.
`src/main.ts` in full. `index.html`.

**Tests.** All 48 files in `test/core/`, `test/tools/bundleGuard.test.ts`,
both Playwright specs in `test/e2e/`, and the four fixture builders in
`test/fixtures/`.

**Python and tooling.** All 8 modules in `analysis/blinklab/`, all 4
scripts in `analysis/tools/`, all 8 files in `analysis/tests/`.
`tools/measure_corpus.mjs`, `tools/bundleGuard.mjs`,
`tools/bundleGuard.d.mts`.

**Configuration.** `package.json`, `tsconfig.json`, `eslint.config.js`,
`vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`,
`.gitignore`, `.prettierignore`, `analysis/pyproject.toml`,
`analysis/uv.lock`. The whole `.github/` folder: both workflows, the
pull request template, both issue templates.

**Process.** All 124 commits, all 118 pull requests, all 84 issues, all
7 tags and 7 releases. The seven still-open issues: #178, #148, #115,
#108, #107, #90, #15.

**Evidence.** Every quantitative claim in `README.md`, `STATE.md` and
`MODEL_CARD.md`, traced to a file under `docs/evidence/` or declared
unsupported. The 20 Python scripts under `docs/evidence/.../scripts/`.

### Out of scope, and why

- `node_modules/`, `dist/`, `package-lock.json`, `analysis/uv.lock`
  contents, `public/mediapipe-wasm/`. Generated or vendored.
- `test/fixtures/session-01.json`, 4.9 MB of recorded landmarks. Its
  integrity test is audited; the 300 frames are not re-derived by hand.
- `public/models/face_landmarker.task`. A third-party binary model.
  Where it comes from and how it is loaded is in scope. Its weights are
  not.
- GitHub server-side settings that no file records: branch protection,
  required checks, Pages configuration. Not visible to the audit. This
  gap is stated in the report rather than guessed at.
- Anything outside the repository, including `NEXT-ACTIONS.md`.

---

## Phase 2: the checklist of constraints

Every item is a yes or no question with evidence attached. Sources are
named so a later session can check the standard, not only the verdict.

### A. The eight hard constraints (master prompt, Section 3)

- A1. **Increment size.** Is each increment one behaviour change or one
  internal capability? Can any be described only with the word "and"?
- A2. **Every increment ends in a push.** Traceable in git history?
- A3. **Every increment adds or updates at least one automated check**,
  unless purely documentation. Checked at the diff level, not by
  counting tests at the end.
- A4. **Pure logic testable with no camera.** Any function taking
  landmarks and returning a number must be pure and import nothing from
  the browser. Named in the master prompt as the single most important
  architectural rule.
- A5. **No dead code and no commented-out code on `main`.**
- A6. **No secrets, no API keys, no third-party network calls at
  runtime.** The vision model vendored or fetched at build time, and
  documented.
- A7. **The demo must never crash the page.** Camera denied, no face,
  bad frame rate: each renders a readable state.
- A8. **Accessibility floor.** Keyboard reachable controls, visible
  focus, text alternatives for every number shown as a graphic.

### B. Layout and documents (master prompt, Sections 5 and 6)

- B1. Required root files present: `README`, `PROJECT`, `SPEC`,
  `ROADMAP`, `STATE`, `LEARNING`, `ARCHITECTURE`, `CONTRIBUTING`,
  `SECURITY`, `CHANGELOG`, `DATASETS`, `LICENSE`, `decisions/`.
- B2. Source layout is `src/core`, `src/io`, `src/ui`, `src/main.ts`.
- B3. `core` never imports from `io` or `ui`, enforced by lint.
- B4. `STATE.md` is ten lines maximum in the specified seven-field
  format.
- B5. `LEARNING.md` carries one plain-English note per increment.
- B6. `docs/log.md` carries one line per increment.
- B7. An architecture decision record exists for every choice that would
  be expensive to reverse.

### C. Roadmap traceability, Phase 0 to Phase 8

- C1. Every row: implemented, its stated check present, and that check
  asserting what the row says.
- C2. Rows ticked but only partly delivered.
- C3. Rows unticked that are in fact done, and rows ticked that are not.
- C4. The ten amendments: real cause recorded, landed as described, and
  agreed before rather than after the work.
- C5. **Work that has no roadmap row at all.** The reconnaissance found
  56 of 117 merged pull requests naming no increment. Each cluster is
  named and judged.
- C6. Where accuracy won over explainability, against the master
  prompt's rule.

### D. The test pyramid (master prompt, Section 10)

- D1. Tests assert mathematical properties, not mocks.
- D2. Ground truth or an invariant, never a restatement of the code.
- D3. Every threshold has three tests: below, at, above.
- D4. Null over guessing. A function that cannot produce a trustworthy
  number returns null, and the test asserts null, not zero.
- D5. One assertion concept per test, named in English.
- D6. No flaky tests. Injected clocks, never `sleep`.
- D7. Regression tests named after the bug that caused them.
- D8. The five pyramid layers all present and used.
- D9. The coefficient of variation assertion, that millimetres vary less
  than pixels, exists and passes.
- D10. Continuous integration gates: lockfile install, lint, typecheck,
  test, build. Coverage floor on `src/core` from 8.6. Bundle and
  inference budgets from 8.7.

### E. Measurement honesty

- E1. The demo score. Does `score = 100 - sum(points)` hold with no
  clamping? Do the four penalty caps still sum to exactly 100? Are the
  ramp floors traceable to a recorded observation rather than to a
  benchmark that was being chased?
- E2. Blink closing velocity and the amplitude over velocity ratio.
- E3. Eye aspect ratio and the aperture in millimetres, including the
  11.7 mm iris assumption and where it breaks.
- E4. Every magic number, wherever it lives. Does each carry its origin?
- E5. The four constants added or moved under pressure:
  `BLINK_REFRACTORY_MS`, `EYES_SHUT_FRACTION`, `MAX_BLINK_DURATION_MS`,
  `MIN_BLINK_FPS`. Each gets its own paragraph.
- E6. The Python track: the rank statistics, the permutation test, the
  Holm correction, and the rule that decides a detected blink matches a
  human-marked one.
- E7. The corpus runner and the bundle guard. Does the published
  benchmark number come from the code this repository holds now?
- E8. Every published number traced to an evidence file, or declared
  unsupported.

### F. Process (master prompt, Sections 8 and 9)

- F1. One increment per session.
- F2. Issue, then branch, then pull request, then merge, per increment.
- F3. Conventional Commits.
- F4. Nothing merged red.
- F5. Tags and releases at phase ends.
- F6. The Definition of Done checklist actually applied, not only
  present in the template.

### G. Separation from commercial work (master prompt, Section 13)

- G1. No proprietary algorithms, weights, thresholds or parameters from
  any commercial project.
- G2. No customer, pilot or employer data.
- G3. **No company name, branding, roadmap or positioning in the repo.**
- G4. The README states plainly that this is a personal learning
  project, unaffiliated, not a product, not a medical or safety device.

---

## Phase 3: execution chunks

Seven chunks. Each ends by writing its findings to `docs/audit/`,
opening a pull request, and stopping. Nothing is held only in context.

### Chunk 1. Documents, configuration and process

Covers B1 to B7, C1 to C6, F1 to F6, G1 to G4.

Reads all 29 markdown files, all configuration, both workflows, the
templates, and the git and GitHub trail. Produces the roadmap
traceability table that the later chunks refer back to.

Output: `docs/audit/chunk-1-docs-config-process.md`.

### Chunk 2. Core purity and the hard constraints

Covers A4, A5, A6, B2, B3, and D4 inside `core`.

Reads all 45 core modules and `src/io`. Reconnaissance reports that
purity holds. This chunk tries to break that finding rather than
confirm it, and looks for the null-over-zero rule being honoured inside
core and inverted at the boundary.

Output: `docs/audit/chunk-2-core-purity.md`.

### Chunk 3. The test pyramid

Covers D1 to D10, and A3.

Reads all 49 unit files, both Playwright specs, the fixture builders,
and the 97 Python test functions. Judges assertion strength, not
presence. Builds the threshold table of below, at and above.

Output: `docs/audit/chunk-3-tests.md`.

### Chunk 4. Measurement and mathematics

Covers E1 to E7.

Reads `constants.ts`, `score.ts`, `blink.ts`, `blinkShape.ts`,
`aperture.ts`, `ear.ts`, `perclos.ts`, `longClosure.ts`, `baseline.ts`,
then the whole Python track and `tools/`. Re-derives the score identity
and the statistics by hand rather than trusting the tests.

Output: `docs/audit/chunk-4-measurement.md`.

Most likely chunk to change a published number. If it does, the finding
is recorded and nothing is changed until the owner has seen it.

### Chunk 5. The user interface layer and the accessibility floor

Covers A7, A8, and the technical debt inside `main.ts`.

Reads `main.ts` in full, `index.html`, and `docs/UI.md`. The largest
file, the least tested, and where the August debugging workarounds
landed. Accessibility is checked in the source and then by actually
driving the built page with a keyboard.

Output: `docs/audit/chunk-5-ui-and-access.md`.

### Chunk 6. Published claims against evidence

Covers E8.

Takes every number in `README.md`, `STATE.md` and `MODEL_CARD.md` and
either points at the file under `docs/evidence/` that produces it, or
records it as unsupported. Where a script exists but its output was
never saved, that is recorded too. This is the chunk that protects the
one thing this project is actually selling, which is honesty.

Output: `docs/audit/chunk-6-evidence.md`.

### Chunk 7. The report

Compiles the six chunk files into `AUDIT_REPORT_AUG_2026.md`, in the six
sections specified: executive summary, constraint violations, missing or
incomplete increments including those invented during the build,
measurement and mathematics flaws, prioritised technical debt and bugs,
and a remediation plan of five to ten atomic increments.

Output: `AUDIT_REPORT_AUG_2026.md`.

---

## Signals found during reconnaissance

Recorded so they survive a lost context window. Each is marked with how
strongly it is established. None has been audited. Some will turn out to
be nothing, and the audit is free to overturn any of them.

### Established by command, not yet judged

1. **Three required root files do not exist.** `CONTRIBUTING.md`,
   `SECURITY.md` and `CHANGELOG.md`, verified by a case-insensitive
   search of the whole repository. `CHANGELOG` is roadmap row 8.3 and
   `SECURITY` is part of 8.5, both unticked. **`CONTRIBUTING` appears in
   no roadmap row at all**, so no increment was ever going to create it.
2. **`STATE.md` is 405 lines against a specified maximum of ten.** Four
   of the seven required fields are in the header. `Known issues` and
   `Test count` are buried at lines 372 and 376.
3. **`src/ui/` does not exist.** The whole presentation layer is
   `main.ts` at 2,764 lines, of which `processFrame()` is one function
   of about 740 lines.
4. **Core purity holds.** Zero imports from `io` or `ui`. No browser
   globals. No `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` or
   dynamic remote import anywhere in `src/`. No commented-out code in
   core. No orphan modules. No `TODO`, `FIXME`, `@ts-ignore` or
   `eslint-disable` in core.
5. **The accessibility floor is unmet.** Zero focus styling anywhere in
   `src/` or `index.html`. Zero keyboard event listeners across 21
   `addEventListener` calls. Both full-screen overlays, calibration and
   heatmap, are dismissed by mouse click only, with no `tabindex`, no
   `role="dialog"` and no Escape handler.
6. **No mocks anywhere in the test suite.** No `vi.mock`, `vi.fn`,
   `vi.spyOn`, `useFakeTimers`, jest or sinon. Inputs are built from
   real arithmetic or from the synthetic face generator.
7. **Every core module has a matching test file.** No module in
   `src/core` is uncovered.
8. **`src/io` and `src/main.ts` have no unit tests at all.** Roughly a
   fifth of the source is covered only by five browser tests.
9. **The coefficient of variation assertion exists and is real.**
   `test/core/statistics.test.ts`, line 69. Seven synthetic distances
   from 350 to 800 mm, aperture held at 10 mm.
10. **Boundary triads are largely present.** Verified for the blink
    threshold, the arm line, the shut line, `MIN_BLINK_FPS`,
    `MAX_BLINK_DURATION_MS`, the reopen boundary, the off-screen offset,
    the minimum fixation duration, the yaw limit and the blink-rate
    observation window. **`BLINK_REFRACTORY_MS` has no triad.** The
    fixation dispersion threshold has no strictly-below case.
11. **No coverage tooling exists.** No script, no dependency, no gate.
    `.gitignore` reserves a `coverage/` folder that nothing produces.
12. **Dependabot is not configured.** No security policy file exists.
13. **Process discipline is strong.** 117 of 124 commits arrived through
    pull requests. The 7 that did not are all from day one, before
    branch protection existed. Conventional Commits conformance is 122
    of 124. Zero pull requests merged with a failing check, across 166
    check runs. Seven tags and seven releases exist.
14. **Roadmap row 8.3 is unticked, yet seven tags and seven releases
    exist.** The roadmap is behind reality on that row.
15. **56 of 117 merged pull requests name no roadmap increment**, and
    nearly all land in the final three days. Named clusters: the
    Eyeblink8 validation, the corpus runner, a whole user interface
    redesign, the reproducibility campaign, the DROZY analysis, the
    documentation-correction sweeps, and four behaviour changes recorded
    only as issues.
16. **`LEARNING.md` and `docs/log.md` both stop on 8 August.** No note
    for rows 7.7, 8.2 or 8.4, all three ticked, and nothing for any of
    the 9 and 10 August work. `docs/log.md` also has a known gap for
    rows 5.6 to 6.1, which is open issue #108.
17. **The architecture decision records stop at ADR-0003, 3 August.**
    Amendments 5 to 10, the refractory period and the 40 percent shut
    line have no record.
18. **The Python environment is `uv`, not `venv`.** No
    `requirements.txt` exists. One script's docstring still instructs a
    `.venv` path that does not exist in this worktree.
19. **Nothing in `analysis/` measures video.** Every module reads comma
    separated values or text. One tool remuxes video without decoding
    frames for measurement.

### Contradictions between published documents

20. `MODEL_CARD.md` publishes **78.6%** for fully-closed misses.
    `README.md` and `STATE.md` publish **72.0%** and explicitly retire
    78.6% as the previous run's figure. This is not a labelled history
    column.
21. `MODEL_CARD.md` says the DROZY results **are not yet published**.
    They are published, in `README.md` and `docs/drozy-result.txt`.
22. `STATE.md` says the sleepiness result is **"NOT in this
    repository"**. It is in this repository.
23. `STATE.md` says pull request #195 is **open and waiting for the
    owner**. It was closed and superseded by #200, which merged.
24. `README.md` says the refractory period **"is planned and it is not
    built"** in one place and **"built at 150 ms, removed 39 false
    alarms"** in another, in the same section, with no history label.
25. `README.md` cites `tables/false_positive_overlap.txt` as the script
    behind its false-alarm counts. That file describes a run with **53**
    false alarms. The README's headline is **72**.
26. `README.md` claims **442 unit tests, 7 end to end tests, 61 Python
    tests**. Static counts are **473**, **5** and **97**.
27. `README.md`'s withdrawn-glasses paragraph gives **83.7%** and
    **82.7%** recall. `docs/eyeblink8-result.txt` gives **88.4%** and
    **87.7%** for the current run.

### Claims with no saved evidence file

28. The current run's false-alarm overlap counts, 45 of 72 strict and 64
    of 72 with tolerance. Only the 53-alarm run's table is saved.
29. The "787 lost frames across 174 gaps, 1.1%" claim. The script
    exists; no output was saved.
30. The "identical, byte for byte" repeatability claim after the fix.
    The only repeatability artefacts in the repository are the
    pre-fix runs, which differ.
31. The browser-agreement table, Chrome against Safari over 4,202
    frames. No evidence file located.

### The null-over-zero rule, inverted at the boundary

32. `main.ts:1959`, `apertureMm: sample.mm ?? 0`. A refused measurement
    becomes a real zero and is fed into the blink shape analysis.
33. `main.ts:1972`, `durationMs: blinkState.lastBlinkDurationMs ?? 0`. A
    refused duration becomes zero **in a blink event that is exported to
    a file**. This is the likely cause of the known "0.00 mm at 0 mm/s"
    row.
34. `main.ts:1951` computes a measurement window with an unexplained
    magic 400 ms lead-in, in the renderer, where nothing can test it.
35. `analysis/blinklab/stats.py` returns `0.0` from Spearman when a
    variable never varies, and a test locks that in. The rule says null.

### The commercial separation question

36. `PROJECT.md` says the project is **"not a commercial product and not
    connected to any company"**, and lists company branding among
    forbidden material.
37. `DATASETS.md` says the repository **"is attached to a startup"**,
    that the permission request promised to disclose a **"commercial
    venture"**, and that **"a commercial context is less sympathetic
    than a university one"**. Roadmap amendments repeat the founder
    framing.
38. No company name or product brand appears anywhere. The startup is
    referenced only generically. Personal identity is present: a
    LinkedIn link at `main.ts:210` and a name in the page footer.

These three points are in direct tension and the audit has to resolve
them rather than report them separately.

### Smaller signals

39. `analysis/blinklab/blink_match.py` widens only the DETECTED interval
    by the four-frame tolerance, never the annotated one. The matching
    rule is asymmetric. Whether that is intended is not established.
40. `permutation_p` shuffles one list in place across iterations rather
    than a fresh copy each time.
41. `tools/measure_corpus.mjs` has no test, and its port and address are
    hardcoded.
42. `tools/bundleGuard.d.mts` is hand-written type declarations beside a
    `.mjs` implementation. The two can drift with nothing to notice.
43. `score.ts` declares 12 of its own tuning constants locally while
    `constants.ts` centralises about 33. Threshold placement is
    inconsistent.
44. Two independent comma-separated-value column lists exist,
    `CSV_COLUMNS` and `BLINK_CSV_COLUMNS`. Whether they stay consistent
    is unverified.
45. Issue #148 is open although its pull request #149 merged.
46. Issue #178 records that a closed issue, #126, contradicts current
    behaviour. An open, self-declared inconsistency.
47. 19 symbols in core are exported but used only inside their own file.
    Widened surface, not dead code.
48. No tag or release exists for any Phase 7 work. 56 commits have
    landed since v0.7.0.
49. This file, `AUDIT_PLAN.md`, sits on `main` and is not a required
    root file. It is audit scaffolding and the report should say what
    happens to it.

---

## Open work that must not be lost

Carried here because the audit will occupy several sessions, and
`NEXT-ACTIONS.md` lives outside git.

Unticked roadmap rows: 7.5 and 7.6 (held by amendment 8), 7.8 latency,
7.9 the generated results section, 8.1 (moved to 7.0), 8.3 changelog and
release, 8.5 Dependabot and security policy, 8.6 coverage floor, 8.7
performance budget, 8.8 accessibility pass.

Open issues: #178, #148, #115, #108, #107, #90, #15.

Known and unfiled: the blink logged as `0.00 mm at 0 mm/s`; the Python
reimplementation living only outside version control in
`artifacts-2026-08-09`; the dataset survey for 2024 to 2026, asked for
directly and dropped from every plan since; the stale branch
`feat/5.8-fixation-stats`; two git worktrees; fifteen unread workflow
journals under the old project folder name.

Decided and closed, not to be reopened: no further exclusions from the
benchmark score, no analytics on the demo page, no renaming the project
folder, and the three reductio numbers stay out of `README.md`.

---

## Stop point

This file is Phase 2. Work stops here and waits for the words
"Proceed with Chunk 1".
