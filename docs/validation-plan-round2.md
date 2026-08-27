# Validation round II: the rules, decided before anyone is measured

Written 27 August 2026, before a single round II session exists, in
the discipline of `docs/validation-plan.md`: nothing in this document
may be changed once the first round II file has been opened. If
something here turns out to be wrong, the correction goes in a new
dated section at the bottom. The scheduling of the round — who, when,
how many — is the owner's and is deliberately NOT decided here; the
rules that will read the files are.

## Why a second round

Round I's verdict (`docs/validation-round.txt`) was one sentence:
three of six rulers were unusable, and the detector missed nothing
where the ruler worked. Everything the calibration track built since
was built from those three failures: the freeze
(`docs/baseline-freeze.txt`) removed the drift class by construction,
the median ceiling narrowed born-too-long, and the refusal
(`docs/calibration-refusal.txt`) made a ceiling-bound birth refuse
out loud instead of clipping in silence. The instrument also now
measures its own camera delivery, which round I could not.

Round II asks one question: did the calibration fixes generalize
beyond the sessions they were built from? It is a smoke test on the
same terms as round I — a handful of people cannot establish a recall
figure and none will be published.

## The rules, pre-registered

These operationalize the queue at the bottom of
`docs/validation-round.txt` (written 20 August, the day round I's
sixth file arrived) plus the short-ruler rule queued in
`docs/baseline-freeze.txt`, plus one rule that could not have been
queued then because the refusal did not exist yet.

1. **A refused session is a result, counted first.** A file whose
   metadata says `calibration_refused: true` contributes no detector
   columns and appears in its own REFUSED line, with its birth
   certificate (samples, spread ratio) printed. A refusal is the
   instrument doing its job, not a broken session; a refusal rate
   across participants is exactly the number the refusal increment
   said an analysis must be able to compute.

2. **Frame-rate soundness judges the evidence rate, on the marked
   window.** Round I's criterion read the processing rate over the
   whole session, and the second delivered-rate reading showed the
   processing rate can sit far above what the camera hands the
   instrument. The rule now reads `sampled_fps` where the export
   carries it (every export since 24 August does), falls back to the
   per-second fps column with that fallback printed, and evaluates
   the MARKED window's rows, not the session's. A session below the
   25 fps floor across the marked window is not evidence about the
   detector, and the table says so instead of a human having to
   notice.

3. **Drift is measured over the marked window, and its pass line is
   zero.** Round I graded drift in percent because the ratchet made
   some drift normal. The freeze makes any baseline movement between
   mark 1 and mark 2 an instrument defect, so the rule is not "under
   15 percent" but "the baselineMm column is CONSTANT across the
   marked window". A single changed value fails the session and
   points at the freeze itself; there is no acceptable nonzero
   amount.

4. **A short ruler is flagged by the natural line, not a chosen
   constant.** `baseline_over_resting` below 1.0 — a ruler born
   below the session's own resting median — is flagged SHORT beside
   the existing too-long line at 1.25. 1.0 is not a tuned threshold:
   a blink line at half of a below-resting baseline sits deep under
   the open eye and counts partial closures as blinks by geometry.
   The freeze traded away the only recovery path for this shape and
   said the check belongs here; this is that check.

5. **The window's length is printed beside its counts, and only a
   zero-width window refuses.** Two marks in the same second
   currently make a zero-width window that prints as an ordinary
   miss. Zero width refuses without needing any benchmark: no time
   passed, so no count over it means anything. A MINIMUM width above
   zero is deliberately not chosen — no benchmark of deliberate-blink
   pacing across people exists to choose one from, and this project
   does not choose constants against data it has not read. Printing
   the length lets a reader judge a narrow window without the tool
   guessing for them.

6. **The round is moderated.** A live call while the participant runs
   their own device in their own room — controlling the person
   without faking the environment, exactly as round I's compliance
   findings asked. Three of six pressed Mark more than twice, one
   performed the closure inside the blink window, one skipped the
   sleepiness question; the moderator's job is to make those five
   shapes impossible, and the protocol steps themselves do not
   change.

## What the tool does, and what it must not touch

Round I's published tables must stay reproducible: the recovered
files re-derived them digit for digit on 27 August, and that property
is not negotiable. So `validation_report.py`'s existing behaviour is
FROZEN for round I inputs — the round II rules run only when
explicitly selected, never inferred from the files, and the default
invocation keeps producing round I's table from round I's folder.
The implementation owes tests watched failing first, and the
adversarial pass that round I's tool got
(`docs/validation-tool-adversarial.txt`) is owed to the new rules
BEFORE the first round II file is opened, on synthetic files only.

## What is predicted, structurally

No recall number is predicted; faces vary and the sample is small.
What the fixed instrument must show, committed now:

1. **Drift is zero on every session**, by construction. Any nonzero
   drift is a freeze defect and stops the round's analysis until it
   is explained.
2. **Every refusal that fires is ceiling-bound** — the only signal
   that exists — and every macbookair-shaped learning window that
   occurs DOES refuse rather than producing a clipped ruler.
3. **If any session again yields an unusable ruler that neither the
   refusal nor the short flag catches**, the calibration story has a
   hole, and that hole is published as a finding with the session's
   birth certificate beside it.

## What this round cannot say, inherited unchanged

The blink log stays censored (a missed blink writes no row), a
handful of people stays a smoke test, and one session per person
cannot separate a face from a room from a day.

## Open, and whose

The participant set (the same six, new volunteers, or a mix), the
schedule, and the moderation logistics are the owner's decisions.
The two missing round I files (P1 and P3) are wanted independently
of this round and their recovery does not gate it.
