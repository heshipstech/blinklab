# AUDIT_PLAN.md

The save state for the August 2026 audit.

Written 10 August 2026, before any audit work. Its job is to survive a
lost context window. Anyone, including a future session of this
assistant, should be able to read this file alone and know exactly what
was going to be checked, in what order, and where the partial results
are.

Deliverable at the end: `AUDIT_REPORT_AUG_2026.md`.

---

## How to resume if this session dies

1. Read this file.
2. Read every file in `docs/audit/` that exists. Each one is a finished
   chunk.
3. The first chunk below that has no file in `docs/audit/` is the next
   one to run.
4. Do not restart from chunk 1. Findings already written are final.

Branch: `audit/plan` for this file. Each chunk gets its own branch,
its own pull request and green continuous integration, per the house
rules in `STATE.md`.

---

## Phase 1, reconnaissance: what was read

Done. No code was changed and no bug was fixed.

Read in full: `PROJECT.md`, `SPEC.md`, `ROADMAP.md`, `ARCHITECTURE.md`.
Listed and sized: every file in `src/`, `test/`, `analysis/`, `tools/`,
`docs/`, `decisions/`, plus `package.json` scripts, the two continuous
integration workflows, and the ESLint rule that keeps `core` pure.
Ran the unit suite once to get a true count.

**One gap.** The attached PDF, "Original Master Prompt for Claude Caude
Project.pdf", could not be opened. macOS refuses this assistant access
to the `Downloads` folder, and copying the file out of it failed with
the same refusal. The audit therefore uses the in-repository record of
the original constraints, which is `PROJECT.md` for intent, `SPEC.md`
for the contract, `ROADMAP.md` for the increment ladder including its
ten written amendments, and the criteria listed in the request itself.
If any original constraint is missing from those, it will be missed. To
close the gap, move the PDF to the project folder or paste its text.

### The shape of the thing being audited

| Area                             | Size                                     |
| -------------------------------- | ---------------------------------------- |
| `src/core/` pure logic           | 45 modules, 3,175 lines                  |
| `src/io/` the impure edge        | 6 modules, about 700 lines               |
| `src/main.ts` wiring and page    | 1 file, 2,764 lines                      |
| `test/`                          | 49 files, 6,488 lines, 473 passing tests |
| `analysis/` Python               | 18 files, 3,034 lines                    |
| `tools/` corpus runner and guard | 3 files, 309 lines                       |
| Root documentation               | 9 files, 2,649 lines                     |
| `decisions/`                     | 3 architecture decision records          |
| `docs/evidence/2026-08-09/`      | the data behind published numbers        |

About 19,000 lines in scope. That is why this is chunked.

---

## Phase 2: scope

### In scope

Everything listed in the table above, plus:

- `.github/workflows/ci.yml` and `deploy.yml`
- `eslint.config.js`, `tsconfig.json`, `vite.config.ts`,
  `vitest.config.ts`, `playwright.config.ts`, `package.json`
- `README.md`, `STATE.md`, `MODEL_CARD.md`, `DATASETS.md`,
  `LEARNING.md`, `docs/UI.md`, `docs/log.md`,
  `docs/drozy-analysis-plan.md`
- The seven open issues: #178, #148, #115, #108, #107, #90, #15

### Out of scope, and why

- `node_modules`, `analysis/.venv`, `package-lock.json`, `uv.lock`.
  Generated.
- The raw comma separated value files under
  `docs/evidence/2026-08-09/repeatability/`. Their existence and the
  claims made from them are checked. The rows themselves are not
  re-added by hand.
- Anything outside the repository, including `NEXT-ACTIONS.md` on the
  Desktop. Read as context, not audited.
- Dataset video. There is none in the repository, by design, and
  confirming that stays in scope.

---

## Phase 2: the checklist of constraints

Every item below is a yes or no question with evidence attached. This
is the standard the code is being held to.

### A. The hard constraints

- A1. Is there dead code on `main`? Unused exports, unreachable
  branches, modules nothing imports.
- A2. Is there commented-out code on `main`, as opposed to comments
  that explain reasoning?
- A3. Are there runtime network calls? `fetch`, `XMLHttpRequest`,
  `WebSocket`, `sendBeacon`, dynamic import of a remote address,
  a third-party font, an analytics tag, a content delivery network
  reference in `index.html`.
- A4. Is `src/core` free of the Document Object Model, the camera and
  browser globals, in fact and not only by lint rule?
- A5. Are `core` functions pure? Same input, same output, no hidden
  state, no clock read inside, no mutation of an argument.
- A6. Does `core` import from `io` anywhere, directly or through a
  type-only back door?
- A7. Does data leave the device anywhere, at any time? This is the
  strictest promise in `PROJECT.md`.
- A8. Does the build produce a page that runs with no server and no
  account, and does the model load from local files?

### B. Roadmap traceability, Phase 0 to Phase 8

- B1. For each of the 80-odd rows, is the increment actually
  implemented, is its stated check actually present, and does that
  check actually assert what the row says?
- B2. Which rows are ticked but only partly delivered?
- B3. Which rows are unticked and should be, or ticked and should not?
  Known unticked: 7.5, 7.6, 7.8, 7.9, 8.3, 8.5, 8.6, 8.7, 8.8.
- B4. Do the ten amendments each have a real cause recorded, and did
  each one land in the code as described?
- B5. Where did accuracy win over explainability, against the rule in
  `PROJECT.md`?

### C. The test pyramid

- C1. Do tests assert mathematical properties, or do they assert that a
  mock was called?
- C2. For every threshold, do tests cover below, at, and above it? The
  boundary triad.
- C3. Does the assertion that the coefficient of variation in
  millimetres is smaller than the coefficient of variation in pixels
  exist, and does it pass? Seen at `test/core/statistics.test.ts:44`,
  to be verified properly.
- C4. Which `core` modules have no test, or a test that only covers the
  happy path?
- C5. Do the end to end tests cover the states `SPEC.md` promises, and
  do they run on the browsers the documentation claims?
- C6. Are the Python tests testing behaviour, or restating the
  implementation?

### D. Measurement honesty

- D1. The alertness score. Does `score = 100 - sum(points)` hold with
  no clamping? Are the four penalty caps still exactly 100? Are the
  ramp floors traceable to a recorded observation?
- D2. Blink closing velocity and the amplitude over velocity ratio. Is
  the maths right, and does it refuse rather than guess?
- D3. Eye aspect ratio and the aperture in millimetres, including the
  11.7 mm iris assumption and where it breaks.
- D4. Every magic number in `src/core/constants.ts`. Does each one
  carry its origin, and is that origin a measurement rather than a
  benchmark score that was being chased?
- D5. `BLINK_REFRACTORY_MS`, `EYES_SHUT_FRACTION`,
  `MAX_BLINK_DURATION_MS`, `MIN_BLINK_FPS`. These four were added or
  moved under pressure. Each gets its own paragraph.
- D6. The Python evaluation track: `drozy.py`, `stats.py`,
  `eyeblink8.py`, `blink_match.py`. Rank correlation, permutation
  test, Holm correction, and the matching rule that decides what
  counts as a hit.
- D7. The corpus runner and the bundle guard. Does the published
  benchmark number come from the code the repository holds now?
- D8. Every number published in `README.md`, `STATE.md` and
  `MODEL_CARD.md`, traced to a file in `docs/evidence/`.

### E. Accessibility and the user interface floors

- E1. Keyboard navigation and visible focus states.
- E2. A text alternative for every graphic number, so nothing is
  readable only as a shape or a colour.
- E3. Colour contrast, and no meaning carried by colour alone.
- E4. The "demo, not a safety or medical device" notice, present and
  permanent, asserted by a test.
- E5. Does the renderer compute any measurement? `SPEC.md` says it
  never does. `main.ts` is 2,764 lines, so this needs looking at
  rather than trusting.

### F. Technical debt

- F1. Every hack or workaround introduced during the August debugging
  run, listed with the defect that caused it.
- F2. Messy logic that survived because it worked, not because it was
  right.
- F3. The seven open issues, each judged still valid, already fixed, or
  wrong.
- F4. Anything the documentation says that the code no longer does.

---

## Phase 3: execution chunks

Six chunks. Each one ends by writing its findings to a file in
`docs/audit/`, opening a pull request and stopping. Nothing is held in
memory between chunks.

### Chunk 1. Documentation and configuration truth

Covers checklist A3 partly, B1 to B5, F4.

Reads the nine root documents, the three architecture decision records,
`docs/UI.md`, `docs/log.md`, the two workflow files, and every
configuration file. Cross-references every roadmap row against the code
and test that claim to deliver it.

Output: `docs/audit/chunk-1-docs-and-config.md`.

Why first: it is the cheapest chunk and it produces the map the other
five use. It also catches stale claims, which is the failure mode this
project has had most often.

### Chunk 2. Core purity and the hard constraints

Covers A1 to A8, and E5 in part.

Reads all 45 modules in `src/core/`, the 6 in `src/io/`, and
`index.html`. Checks purity in fact, hunts dead code and unused exports,
and searches the built output as well as the source for any network
call.

Output: `docs/audit/chunk-2-core-purity.md`.

### Chunk 3. The test pyramid

Covers C1 to C6, and B1 in part.

Reads all 49 test files and the fixtures. Builds a table of every
`core` module against the tests that cover it, marks the boundary triads
that are missing, and separates property assertions from mock
assertions.

Output: `docs/audit/chunk-3-tests.md`.

### Chunk 4. Measurement and mathematics

Covers D1 to D8.

Reads `constants.ts`, `score.ts`, `blink.ts`, `blinkShape.ts`,
`aperture.ts`, `ear.ts`, `perclos.ts`, `longClosure.ts`, `baseline.ts`,
then the whole Python track and `tools/`. Re-derives the score identity
and the statistics by hand rather than trusting the tests.

Output: `docs/audit/chunk-4-measurement.md`.

This is the chunk most likely to find something that changes a
published number. If it does, the finding is recorded and nothing is
changed until the owner has seen it.

### Chunk 5. The user interface layer and accessibility

Covers E1 to E5, A4 from the other side, F1 and F2.

Reads `main.ts` in full, `src/io/`, and `docs/UI.md`. This is the
largest single file in the project and the least tested, and it is
where the debugging workarounds landed.

Output: `docs/audit/chunk-5-ui-and-access.md`.

### Chunk 6. The report

Covers F3, and compiles everything.

Reads the five chunk files, judges the seven open issues, and writes
`AUDIT_REPORT_AUG_2026.md` in the six sections the request specifies:
executive summary, constraint violations, missing or incomplete
increments, measurement and mathematics flaws, technical debt and bugs,
and a remediation plan of five to ten atomic increments.

Output: `AUDIT_REPORT_AUG_2026.md`.

---

## Signals already visible, unverified

Noticed while sizing the work. Recorded so they are not lost. None has
been checked, and any one may turn out to be nothing.

1. `ARCHITECTURE.md` line 20 says 461 unit tests. The suite reports 473. A small number, but this project's documentation drifting from
   its code is exactly the pattern under audit.
2. `ARCHITECTURE.md` line 92 says the end to end tests run on "two
   browser engines". The continuous integration workflow installs
   Chromium only. Either the claim or the workflow is wrong.
3. `SPEC.md` line 11 records that the planned `src/ui` folder was never
   created and argues the rule that matters survived. Chunk 5 tests
   that argument against 2,764 lines of `main.ts`.
4. Roadmap rows 7.5 and 7.6 are unticked and amendment 8 says they are
   not achievable as written. Amendment 8 needs to survive scrutiny,
   because it retires two roadmap rows.

---

## Open work that must not be lost

Carried here so it survives, since the audit will occupy the next
several sessions. The full version lives in `NEXT-ACTIONS.md` outside
the repository.

Unstarted, from the roadmap: 7.8 latency measurement, 7.9 the generated
results section, 8.3 changelog and a v0.8.0 release, 8.5 Dependabot and
a security policy, 8.6 a coverage floor on `core/`, 8.7 a performance
budget, 8.8 the accessibility pass.

Unstarted, from earlier findings, none of which has an issue filed:

- The blink logged as `0.00 mm at 0 mm/s` in a real session. The code
  has separate wording for a shape it could not measure, so that row
  claims a real measurement of nothing.
- The Python reimplementation that produced the evidence behind issue
  #178 lives only in `Desktop/blinklab build/artifacts-2026-08-09`,
  outside version control.
- The dataset survey for 2024 to 2026. Asked for directly, promised,
  and dropped from every plan since.
- Housekeeping: the stale branch `feat/5.8-fixation-stats`, two git
  worktrees, and fifteen unread workflow journals under the old project
  folder name.

Decided and closed, not to be reopened: no further exclusions from the
benchmark score, no analytics on the demo page, no renaming the project
folder, and the three reductio numbers stay out of `README.md`.

---

## Stop point

This file is Phase 2. Work stops here and waits for the words
"Proceed with Chunk 1".
