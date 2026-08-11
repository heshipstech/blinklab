# REMEDIATION.md

The save state for the work that follows the August 2026 audit.

`AUDIT_PLAN.md` was the save state for the audit. This is the save state
for the fixes. `AUDIT_REPORT_AUG_2026.md` section 6 holds the reasoning
behind each increment; this file holds the order and the progress.

Paused 10 August 2026, resumed 11 August.

---

## How to resume

1. Read this file, then section 6 of `AUDIT_REPORT_AUG_2026.md`.
2. The first unticked item below is the next one to do.
3. One branch, one pull request, green continuous integration, per item.
4. **Merge before deleting.** Confirm `gh pr view <n> --json state`
   returns `MERGED` before deleting any branch. On 10 August a branch was
   deleted while its CI was red, which closed the pull request unmerged;
   the commit was recovered from the reflog. It is the second time that
   has happened here.

Gates before every pull request, from the repo root: `npm run lint`,
`npm run typecheck`, `npm test`, `npm run e2e`, `npm run format:check`,
`npm run build`. In `analysis/`: `uv run ruff check .`,
`uv run ruff format --check .`, `uv run pytest`. Never push to main.

**Never run `npm install` or `npm ci` from inside a worktree scratch
copy**: `node_modules` is shared by symlink and an install prunes the
real one. This broke the end-to-end suite twice during the audit.

---

## Stage A. Finish telling the truth

Cheapest work, highest reader impact. **Everything with a deadline is in
this stage.** The Y Combinator application is editable until 28 August.

- [x] **R1.** The six telemetry claims corrected, `ADR-0004` written,
      retired phrases banned by `tools/claimGuard.mjs`. PR #215.
- [x] **R2.** `blinklab-blinks-*.csv` refused by `.gitignore`, guarded by
      `tools/exportGuard.mjs`. PR #213.
- [x] **A1 (R3).** DONE 11 August, with tools/resultGuard.mjs as the check: it reads docs/eyeblink8-result.txt and also covers ARCHITECTURE.md. Was: five stale prose claims: the reproduction command in
      `STATE.md:303-308` that prints 82.8% against a headline of 87.7%,
      the withdrawn-glasses paragraph at `README.md:243-247`, the
      refractory contradiction at `README.md:328-330`, the false citation
      at `README.md:330-333`, and three wrong test counts.
      **Check:** continuous integration asserts the numbers in
      `README.md`, `STATE.md` and `MODEL_CARD.md` match the committed
      result file in `docs/evidence/`. Not a corpus re-run: the corpus is
      not in the repository and that check could never execute.
      **This is the one a reviewer would catch.**
- [x] **A2 (R4).** DONE 11 August: ear.ts computes in pixel space via the shared toPixels, the tilt test runs at 1280x720 and fails against the old behaviour (checked by reverting), and the old formula is pinned as a counterfactual. Was: correct `SPEC.md:137`'s roll-invariance claim, and move
      `test/core/tiltInvariance.test.ts` to a 1280x720 frame so it can
      fail. It runs on a square frame today, where the defect cannot
      appear.
- [x] **A3 (R5).** DONE 11 August: stamps on README.md and STATE.md, enforced by test against the last commit touching each file, CI fetching full history. Was: dated stamps on `README.md` and `STATE.md`, copying
      `MODEL_CARD.md:6-7`. That stamp already converted one finding from
      a contradiction into a correctly-scoped snapshot.
- [x] **A4 (R6).** DONE 11 August: public/THIRD_PARTY_LICENSES.txt ships in dist via vite's public copy, canonical Apache-2.0 text, unit tests plus an e2e fetch from the served site. Stage A is COMPLETE. Was: `THIRD_PARTY_LICENSES` emitted into `dist` at build
      time. MediaPipe is Apache-2.0, it is bundled, and the built output
      contains zero occurrences of "Copyright".

---

## Stage B. Stop corrupting data and hiding failure

- [x] **B1 (R7).** DONE 11 August, PR #222: the counter increments only
      after `detectForVideo` returns; a hidden probe plus three end to
      end tests pin it from both sides (blocked model stays 0, healthy
      model climbs, and the stepped-clip count still lands on 60);
      proven able to fail by hoisting the increment back and by killing
      the probe write, two red runs. Review forced three repairs: a
      stepped run that measured nothing now REFUSES instead of
      misdiagnosing "wrong interval, file is correct", the status line
      carries machine-readable `data-state` so the corpus runner books
      that refusal as a failure instead of parking forever, and a
      source-run token stops a superseded clip run from writing into
      its successor's session. Issue #221 filed for the backwards
      model clock a skeptic found nearby. Was: Move `framesMeasured += 1`
      at `src/main.ts:1542` inside
      the landmarker guard 21 lines below. A cold start counts about
      3,000 frames before the model exists and writes the total into the
      export header. **Regression surface:** the same variable feeds
      `checkStepping` at `main.ts:815-819` and a division in the clip
      summary.
- [x] **B2 (R8).** DONE 11 August, PR #223: CameraState gained
      `modelFailed` with a readable message and a "Retry loading the
      model" button. The camera path's fire-and-forget load now reports
      its failure and stops the camera with the session; the clip path
      refuses by name before the first seek; retry goes back through
      beginCamera, so a camera unplugged during the outage gets its own
      honest state instead of a session resumed over a dead stream.
      Three e2e tests including the full retry round trip pinned to
      B1's counter probe; both wirings proven able to fail by mutation.
      The corpus runner learned the new terminal state (review caught
      it parking otherwise). Known residue, deliberate: a load that
      HANGS forever still looks healthy, no timeout was added. Was: A
      sixth degraded state for a failed model load, with a
      message and a retry. Today the camera path runs forever looking
      healthy and the clip path prints a completed measurement.
- [x] **B3 (R9).** DONE 12 August, PR #224: both loops in frameLoop.ts
      report a crash once and stop for good; CameraState gained
      `measurementFailed` (reason carried, recorded data stays
      exportable, reload to measure again); a dead display loop makes
      beginCamera refuse rather than run a frozen session; a stepped
      clip crash mid-run reports as a measurement crash, not a broken
      file; crash handlers bump the source-run token so pending
      continuations cannot overwrite the crash state. All four
      calibration storage ops guarded, failed profile store surfaced on
      the calibrate button. The audit's check shipped: one injected
      throw, message appears, record count freezes, export stays
      offered; both wrong fixes (no catch, silently resuming catch)
      proven red. Was: Guard both `localStorage` reads and both writes in
      `src/io/calibrationStore.ts`. Wrap `onFrame` in
      `src/io/frameLoop.ts` in a catch that **enters a visible degraded
      state and stops appending feature records**. A catch that silently
      resumes is this project's own recurring defect wearing a fix's
      clothing.
- [ ] **B4 (R10).** The blink shape window at `src/main.ts:1948-1951`
      reaches back over the previous blink, so a blink can be published
      with its predecessor's closing velocity. The only genuine
      arithmetic error the audit found.
- [ ] **B5.** The heatmap button never re-enables for a returning visitor
      with a stored calibration profile, so increments 5.9 and 5.10 are
      unreachable on any visit after the first.

---

## Stage C. Make the tests able to fail

- [ ] **C1 (R11).** Pin `BLINK_REFRACTORY_MS`, `POSE_LIMITS` pitch and
      roll, the three `BASELINE_` gates and both PERCLOS time boundaries.
      The 30 second learning window can currently be cut to 1 second with
      all tests green. **Verify by mutating each**, and keep the mutation
      list in a file so the next person can repeat it.
- [ ] **C2 (R12).** Row 7.7's negative control test, in
      `analysis/tests/test_drozy.py`, importing `_shuffled_null`,
      asserting the collapse **and** that the silent-zero branch raises.
- [ ] **C3.** Issue #107, reducers accepting backwards timestamps and
      emitting negative durations. Open since Phase 5 and squarely this
      territory.

---

## Stage D. The risky one, alone, on a quiet day

- [ ] **D1 (R13).** The frames-per-second readout is the animation-frame
      call rate, not the camera's. On a 20 fps device the page reads 70,
      which holds the 25 fps blink gate open in healthy sessions.
      **Split it.** First relabel the number honestly as a processing
      rate, which is readout-only and safe. Only then measure the blast
      radius on real hardware before wiring a true camera rate into the
      gate. **This will begin refusing sessions that succeed today.**

---

## Stage E. Close what the audit never examined

From section 7 of the report. None of this was in the audit's scope.

- [ ] **E1.** `npm audit --omit=dev` and a Python equivalent. Nobody has
      checked a single CVE across 170 npm and 21 Python packages. Rolls
      into row 8.5.
- [ ] **E2.** Fetch the deployed page at
      `https://heshipstech.github.io/blinklab/`. Compare its bundle hash
      and its notice text against a fresh build. **Every claim in the
      audit, including the telemetry, was measured against a locally
      built bundle.** Nothing records which commit is live.
- [ ] **E3.** Data at rest. Two permanent `localStorage` keys are written
      and there is no way for a user to erase a stored gaze profile from
      inside the app. Enumerate what is stored and add a control.
- [ ] **E4.** The licence chain for derived dataset artefacts, and the
      miss table withheld on GPL3 grounds that is committed anyway. Two
      live documents state the withholding rule. Either retire the rule
      in writing or remove the file.
- [ ] **E5.** GitHub settings sweep: Dependabot alerts, secret scanning,
      default token permissions, and `required_approving_review_count`
      which is 0. Pin the six workflow actions to commit SHAs.

---

## Stage F. Restart the record

- [ ] **F1 (R14).** Backfill `LEARNING.md` and `docs/log.md` for 8 to 10
      August, which closes issue #108. Reinstate the Definition of Done,
      abandoned at pull request #134. **Check:** continuous integration
      fails a pull request that touches `src/` without touching
      `LEARNING.md` or saying why not.
- [ ] **F2 (R15).** Decide in writing: either amend the roadmap to absorb
      the 56 merged pull requests that name no increment, or state that
      the ladder ended at Phase 7 and the project now runs on issues.
      **A decision, not an increment.**
- [ ] **F3.** `docs/UI.md` has one commit and 15 `main.ts` commits since,
      and no check can fail when it drifts. It is the compensating
      control for the missing `src/ui`, so either give it a check or
      rewrite `SPEC.md:11`'s argument.

---

## Stage G. Finish Phase 8 properly

- [ ] **8.3** `CHANGELOG.md` and a v0.8.0 release. Seven tags and seven
      releases already exist, so two thirds of the row shipped.
- [ ] **8.5** Dependabot and `SECURITY.md`. Absorbs E1.
- [ ] **8.6** Coverage floor on `core/`. It already measures **98.07 per
      cent** of statements, so this is configuration, not work.
- [ ] **8.7** Bundle size budget in continuous integration.
- [ ] **8.8** Accessibility pass: modal semantics, live regions, text
      equivalents for the heatmap, the traces and the replay circles.
      **The floor is already met**: focus is visible, the app is fully
      keyboard operable, and all text clears WCAG contrast.
- [ ] `CONTRIBUTING.md`, which has no roadmap row and never will.
- [ ] Issue #178, reconcile with closed issue #126.
- [ ] Issues #115, #90, #15.

---

## Stage H. Housekeeping

- [ ] Delete the remote branch `feat/5.8-fixation-stats`, and the 20
      merged local branches.
- [ ] Remove the git worktrees `audit-fresh` and `full-project-audit`.
- [ ] Decide whether the six raw appendices in `docs/audit/` stay on
      `main` or move. They are about 5,000 lines and they are the proof
      behind the report.

---

## Then, and only then, re-plan

At that point: no open remediation, Phase 7 and 8 closed or explicitly
retired, no open issues, and a repository whose claims all check out.

**Rows 7.5 and 7.6 are the exception and stay out of this list.**
Amendment 8 holds them because DROZY yields 20 sessions from 13 subjects
once the frame-rate floor removes 16, and those 16 are systematically the
sleepier ones. They are not work, they are a **data problem**, and they
belong in the new roadmap rather than in this cleanup.

---

## Deliberately not doing

- **Blocking the telemetry.** Timeboxed to one day, after Stage A. If
  attempted, the test needs an explicit timeout **above sixty seconds**
  and an allowlist of permitted hosts, or it passes today with the
  telemetry firing.
- **The NaN family.** Seven modules fail open on non-finite input.
  **Establish whether MediaPipe can emit one before spending anything.**
  If it cannot, this is dead code.
- **Rewriting `main.ts`.** Correct, linted, and honest about its own size.
  No defect motivates it, and this project's history is that unmotivated
  changes are where its defects came from.
