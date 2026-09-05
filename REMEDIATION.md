# REMEDIATION.md

The save state for the work that follows the August 2026 audit.

`AUDIT_PLAN.md` was the save state for the audit. This is the save state
for the fixes. `AUDIT_REPORT_AUG_2026.md` section 6 holds the reasoning
behind each increment; this file holds the order and the progress.

Paused 10 August 2026, resumed 11 August.

---

## How to resume

0. **`- [~]` means DECLINED, not pending.** On 15 August the owner cut
   every item that was tidying rather than blocking, because deferred
   items kept returning as findings in the next audit wearing a new
   number. A declined item is a decision. Do not reopen one without a
   reason that did not exist on 15 August.
1. Read this file, then section 6 of `AUDIT_REPORT_AUG_2026.md`.
2. The first unticked `- [ ]` item below is the next one to do.
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
- [x] **B4 (R10).** DONE 12 August, PR #225: shapeWindowStartMs in
      core/blinkShape.ts clips the window at the previous blink's end,
      read from the reducer's own pre-step memory, no new state. The
      audit's synthetic two-close-blinks trace is the fixture: the
      clipped window gives blink 2 its own three columns, and a
      counterfactual pins the old contamination bit for bit (A/V 231 ms
      read as 76 ms). Mutation proof: deleting the clip turns the test
      red. Known residue: a closure the reducer refused leaves no end
      time, so a window opening after one can still see it, as before.
      Was: The blink shape window at `src/main.ts:1948-1951`
      reaches back over the previous blink, so a blink can be published
      with its predecessor's closing velocity. The only genuine
      arithmetic error the audit found.
- [x] **B5.** DONE 12 August, PR #226, and Stage B is COMPLETE:
      render() recomputes the heatmap button from the stored profile on
      entering the running state; the startup refresh was real but the
      off-duty force-off overwrote it and only a fresh solve refreshed
      again. Two e2e tests: a seeded returning visitor gets the button
      back, a never-calibrated visitor keeps the explain-first label,
      the latter behind a running barrier after review proved the first
      version green against an always-enabled rot. Mutation proofs both
      ways. Was: The heatmap button never re-enables for a returning visitor
      with a stored calibration profile, so increments 5.9 and 5.10 are
      unreachable on any visit after the first.

---

## Stage C. Make the tests able to fail

- [x] **C1 (R11).** DONE 12 August, PR #227. A census first: mutate
      every candidate both directions, record what survives. Naked were
      pitch, roll and yaw in BOTH directions (the old tests derive their
      angles from the constants and move with them) and the learning
      window in the shrink direction, the audit's headline, confirmed
      live. New literal-valued tests pin all three pose axes at their
      exact limits, the learning window at exactly 30,000 ms, and the
      audit-flagged missing learningSecondsLeft behaviour. The list
      lives in tools/mutationCheck.mjs, RUNNABLE: 23 mutations, each
      applied, suite run, red demanded, file restored; refuses with its
      own exit codes when the tree is already red or the runner cannot
      run, after review demonstrated the first draft printing "all
      caught" with the runner replaced by a nonexistent command. Was:
      Pin `BLINK_REFRACTORY_MS`, `POSE_LIMITS` pitch and
      roll, the three `BASELINE_` gates and both PERCLOS time boundaries.
      The 30 second learning window can currently be cut to 1 second with
      all tests green. **Verify by mutating each**, and keep the mutation
      list in a file so the next person can repeat it.
- [x] **C2 (R12).** DONE 12 August, PR #228: the silent-zero branch
      raises by name (main() already filtered such features, so the
      guard protects direct and future callers); the collapse test
      plants a near-perfect perclos-KSS relation in synthetic sessions
      and demands the shuffled null land in a BAND, under 0.9 worst
      and 0.4 median but above 0.5 and 0.05, because review showed a
      null stubbed to zero sailing under ceilings alone. Both proven
      red by mutation: shuffle disabled, and the zero restored. Was:
      Row 7.7's negative control test, in
      `analysis/tests/test_drozy.py`, importing `_shuffled_null`,
      asserting the collapse **and** that the silent-zero branch raises.
- [x] **C3.** DONE 12 August, PR #229, closes #107, and Stage C is
      COMPLETE: the five reducers the issue names (blink, longClosure,
      baseline, blinkRate, perclos) ignore a frame stamped earlier than
      the newest timestamp their state carries, and ongoingClosureMs
      answers null rather than a negative. All five guards proven
      red-by-removal; the boundary is strict, an equal stamp is
      processed, pinned by test. Honest residual, in the comments: an
      OPEN state carries no timestamp, so disorder among open frames
      remains the door's job (frameClock acceptFrame), which the real
      wiring always crosses. Was: Issue #107, reducers accepting backwards timestamps and
      emitting negative durations. Open since Phase 5 and squarely this
      territory.

---

## Stage D. The risky one, alone, on a quiet day

- [x] **D1 (R13). DONE 20 August 2026, both stages, as re-scoped below. Was: NEXT REAL WORK, and it is a webcam fix, not hardware
      preparation.** The owner ruled on 15 August that the project keeps
      improving the webcam path before building for external devices.
      That does not defer this: the readout is wrong for webcams TODAY,
      because a 20 fps camera reads 70 and holds the 25 fps blink gate
      open in sessions that should be refused. STAGE ONE DONE 12 August, PR #230: the readout is
      relabelled "Processing rate", mode-aware after review (live: the
      instrument's pace, not the camera's; clips: measured on the
      clip's own clock, where the number IS the source's rate), wording
      pinned by unit test and proven red by reversion; SPEC's fps field
      and MODEL_CARD's 25 fps sentence now say the same. STAGE TWO
      REMAINS and keeps this box unticked: measure the blast radius on
      real hardware, then wire a true camera rate into the gate.
      **That will begin refusing sessions that succeed today**, and it
      needs the owner's machines and a quiet day. Was: The frames-per-second readout is the animation-frame
      call rate, not the camera's. On a 20 fps device the page reads 70,
      which holds the 25 fps blink gate open in healthy sessions.
      **Split it.** First relabel the number honestly as a processing
      rate, which is readout-only and safe. Only then measure the blast
      radius on real hardware before wiring a true camera rate into the
      gate. **This will begin refusing sessions that succeed today.**

**D1 RE-SCOPED, 18 August. The original premise did not survive contact
with real hardware.** The blast radius is measured: five sessions on
three devices, 16 and 17 August, written up in
`docs/validation-dry-run.txt`. EVERY camera declared 30 frames per
second and the gate never wrongly opened once, so wiring a true camera
rate into it would have changed nothing on any of them. The case this
item was written for did not occur.

What did occur is larger and is not about the camera. The PROCESSING
rate is set by how fast the face model runs, so the two four-core
machines ran at 29 to 32 frames per second while the twelve-core machine
ran at 127, on cameras that all declare 30. Detection follows it: 7, 9
and 10 of ten deliberate blinks. The offline experiment in
`docs/blink-sample-rate.txt` isolates why, and the honest summary is
that the 25 fps floor is CORRECT and the silence above it is not. A
session at 29 fps and a session at 127 fps both pass the gate and are
not the same instrument.

So stage two is no longer "wire the camera rate into the gate". It is:
say something true about the processing rate when it is low enough to be
losing blinks. What it should say, and whether a second threshold
belongs in the gate at all, is undecided and is the owner's. The
limitation itself is now stated in README and MODEL_CARD, which is the
part that could not wait for that decision.

**D1 STAGE TWO DONE, 20 August 2026, decided by the owner after the
validation round.** The page now warns whenever a live session's
processing rate sits below 60 frames per second, where the offline
sweep measures the risk band closing: the warning states the machine's
own number, that quick or shallow blinks can be missed, and that the
camera is not the cause. Enter at 60, clear at 65, a hysteresis band,
because the rate wobbles and a flickering warning reads as a glitch.
The 25 fps refusal is unchanged, and a true camera rate is
deliberately still not wired into the gate: twelve real sessions never
once produced the case it would catch.

**D1 STAGE THREE, 24 August 2026, triggered by the rule committed
before the measurement.** The first delivered-rate reading (M5 Max:
camera declared 30, delivered 30.0, distinct frames read 30.0,
processing 120) produced the false-silence shape stage two could
not see: a machine in the risk band with the warning off, because
the warning judged the 120. The warning now judges the measured
rate of distinct camera frames read where the browser reports it,
falling back to the processing rate where it cannot, and its
sentence names whichever side binds. The stage-two paragraph above
stays as written; its premise — that the case did not occur in
twelve sessions — was true, and the thirteenth session is where it
stopped being. The 25 fps refusal still reads the processing rate:
no device has yet delivered below it.

---

## Stage E. Close what the audit never examined

From section 7 of the report. None of this was in the audit's scope.

- [x] **E1.** DONE 14 August, verified again 15 August:
      `npm audit --omit=dev` reports 0 vulnerabilities, and Dependabot
      alerts agree at every severity. TypeScript 7 is ignored on purpose
      in `.github/dependabot.yml`, because `typescript-eslint` still
      caps at `<6.1.0` so the bump cannot install; delete the ignore
      when that cap lifts. Was: nobody had checked a single CVE across
      170 npm and 21 Python packages. Rolls into row 8.5.
- [x] **E2.** DONE 14 August, PR #244: a `stamp-build-commit` vite
      plugin injects `<meta name="build-commit">` at build time, so
      `curl` on the live demo names the commit it was built from without
      needing repository access, and every deploy since has matched
      `main`. Verified live rather than in the source. Was: every claim
      in the audit, including the telemetry, was measured against a
      locally built bundle, and nothing recorded which commit is live.
- [x] **E3.** DONE 15 August: a "Stored on this device" box lists the
      stored keys from `core/storedData.ts`, with what each holds and why, and
      erases them on request behind a two-click confirm. (Two keys existed on
      15 August; the guarantee now covers all FOUR keys the app stores —
      calibration-profile, calibration-samples, blink-calibration and
      participant-pseudonym — because the control filters to `KNOWN_KEYS`,
      verified still covered 5 September 2026.) The erase
      clears the in-memory profile too, so the heatmap returns to
      "calibrate first" in the same click, proven by an end to end test
      that goes red when that line is removed. The confirmation is
      derived from a RE-PROBE after the delete rather than from
      `removeItem` not throwing, and a browser that refuses to be read
      is reported as refusing rather than as empty, which is the one
      lie a privacy control must not tell. Was: two permanent
      `localStorage` keys were written and there was no way for a user
      to erase a stored gaze profile from inside the app.
- [x] **E4.** CLOSED 15 August. The owner sought permission from the
      corpus authors by email and it was granted; the correspondence is
      kept privately and no individual is named, at the owner's
      instruction. The miss table stays committed and the withholding
      rule is retired in `DATASETS.md:383`, which is the ruling PR
      #248's corrections were waiting on. Stage E is COMPLETE apart
      from E5's review-count setting, which is a repository preference.

- [ ] **E5.** MOSTLY DONE, PR #232 plus a settings sweep on 14 August.
      All workflow actions are pinned to full commit SHAs, secret
      scanning is enabled, default token permissions are `read`, and
      Dependabot alerts are on and report 0. Each was checked against
      the API on 15 August rather than assumed. **The box stays
      unticked for one thing:** `required_approving_review_count` is
      still 0. On a solo-maintained repository raising it would block
      the maintainer's own merges, so this needs a decision rather than
      a default.

---

## Stage F. Restart the record

- [x] **F1 (R14).** DONE 15 August, both halves, and this item was
      wrong about where the gap was. It said "8 to 10 August". 8 and 10
      August are fully logged; the real holes were **4 August**,
      increments 5.6 to 6.1, which is what issue #108 actually says,
      and **9 August**, which had TWENTY merged pull requests and not
      one line. Fifteen entries backfilled from `LEARNING.md` and the
      pull requests, each marked with the date it was written so the
      record does not pretend to be contemporaneous. `LEARNING.md`
      needed nothing: it had 5.6 through 6.2 all along. Closes #108.
      The Definition of Done is a mechanism now rather than an
      intention: `tools/checkLearningEntry.mjs` runs on every pull
      request and fails one that changes `src/` without touching
      `LEARNING.md` or writing "No LEARNING entry: &lt;reason&gt;" in a
      commit message. Verified against real history rather than only
      synthetic cases: it passes #252 and it catches #233, which
      changed two source files with no entry.
- [~] **F2 (R15) DECLINED 15 August**, and answered by events rather
  than by a memo: the next roadmap is being written for the webcam
  path, and it supersedes the question of how the old one absorbs
  56 unnumbered pull requests.
- [x] **F3.** DONE 15 August: `tools/uiGuard.mjs` reads every
      `box("...")` heading out of `src/main.ts` and holds `docs/UI.md`
      to them in BOTH directions, so an undocumented box and a
      documented box that no longer exists are each a red build. It
      had already drifted, which is how the check earned itself: the
      file described five boxes in three tiers where there are eight in
      four rows, put Session in a tier of its own when it sits under
      Alertness, and documented an "Instrument" box that had become the
      footer of Live signals. All three corrected. Was: one commit and
      15 `main.ts` commits since, with no check able to fail.

---

## Stage G. Finish Phase 8 properly

- [x] **8.3** `CHANGELOG.md` written 15 August, covering the seven
      existing releases plus an Unreleased section for everything since
      v0.7.0, which is the largest gap in the project because the audit
      landed in it. Each released version says it was summarised after
      the fact from its tag, its pull requests and `docs/log.md`, rather
      than pretending to be a contemporaneous entry. **The v0.8.0 tag
      and release are NOT done and are deliberately left**: Phase 8 is
      not finished while 8.8 is open, and tagging a phase closed before
      it is would be exactly the kind of claim this project keeps
      having to withdraw.
- [x] **8.5** DONE, verified 15 August. `SECURITY.md` is a real policy,
      not a stub: it states the no-server threat model, what counts as a
      vulnerability here, and how to report one. `.github/dependabot.yml`
      configures version updates, alerts are on and report 0, and
      `npm audit --omit=dev` agrees. Absorbs E1, which is also ticked.
- [x] **8.6** DONE 15 August. `vitest.config.ts` carries thresholds on
      `src/core` only: statements 98, branches 95, functions 100, lines
      98, against a measured 98.61 / 95.52 / 100 / 98.57. Runs as its
      own CI step so a coverage failure reads as one rather than as a
      broken suite. Functions sits at 100 on purpose, because a pure
      function no test calls is a function nobody has checked. Proven
      able to fail by raising the statement floor to 99.9 and watching
      it go red. `main.ts` is deliberately out of scope, the same split
      ARCHITECTURE.md already makes: the alternative is a floor so low
      it permits anything.
- [x] **8.7** DONE 15 August. `tools/checkBundleBudget.mjs` runs after
      the build and fails over 240 kB, against 217.6 kB measured. The
      failure it is really written against is not creep, it is the one
      commit that bundles the 3.7 MB face model or the 33 MB WASM
      folder, both served from `public/` on purpose: every test would
      still pass and the download would be twenty times bigger. Chunks
      are summed, not judged individually, or splitting one oversized
      bundle in two would satisfy it while changing nothing. An empty
      `dist` fails rather than passing at zero bytes. Proven able to
      fail by lowering the ceiling to 100 kB, exit code 1.
- [~] **8.8 DECLINED 15 August.** The floor is already met: focus is
  visible, the app is fully keyboard operable, and all text clears
  WCAG contrast. What remained was polish, and polish does not
  outrank the measurement work. Reopen only if a real user is
  blocked.
- [x] `CONTRIBUTING.md`, which has no roadmap row and never will.
      Written 15 August: what a reader can rely on, the gate list, the
      three rules that were each learned by breaking, and a map of
      which document is which. It says plainly that the contribution
      this project wants is an issue saying a published number is
      wrong.
- [~] **Issues #178, #115, #90, #15, #221 DECLINED 15 August.** #178,
  #115 and #90 are webcam detector tuning against a benchmark that
  already repeats; none is a wrong published number. #15 is a chore.
  #221 needs a fast stepped clip followed by a camera start to
  trigger. They stay open in the tracker as known limitations, and
  they are off this ladder. Issue #148 is closed: 7.4 shipped.

---

## Stage H. Housekeeping

- [~] **DECLINED 15 August.** Twelve dead remote branches and two local
  ones harm nothing. The verified inventory is kept below so the
  deletion stays a one-liner if it is ever wanted.

```text
MERGED, 11 remote branches, safe to delete
  dependabot/github_actions/actions/checkout-7.0.1               #237
  dependabot/github_actions/actions/deploy-pages-5.0.0           #235
  dependabot/github_actions/actions/setup-node-7.0.0             #234
  dependabot/github_actions/actions/upload-pages-artifact-5.0.0  #236
  dependabot/github_actions/astral-sh/setup-uv-9.0.0             #238
  dependabot/npm_and_yarn/minor-and-patch-2bfc71846e             #239
  docs/misses-table-is-committed                                 #248
  docs/stamp-row-stale                                           #247
  docs/state-catch-up                                            #249
  feat/5.8-fixation-stats                                        #99
  feat/build-commit-meta                                         #244

CLOSED on purpose, 1 remote branch
  dependabot/npm_and_yarn/typescript-7.0.2                       #240
  typescript-eslint caps at <6.1.0 so the bump cannot install,
  and #245 added the ignore so it cannot reopen. Nothing is lost.

LOCAL, 2 branches, both pre-squash originals
  feat/build-commit-meta            #244 MERGED
  investigate/174-reproducibility   no PR, but its one commit is the
    pre-squash original of #189: the symbols it added,
    clipModelClockBaseMs and modelClockMs, are in main today.
```

- [x] Remove the git worktrees `audit-fresh` and `full-project-audit`.
      **Already gone.** `git worktree list` on 15 August returns the
      main checkout and nothing else.
- [~] **DECLINED 15 August.** The six raw appendices stay on `main`.
  About 5,000 lines sitting quietly, and they are the proof behind
  the report.

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
