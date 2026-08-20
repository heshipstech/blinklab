**THE RULER FREEZES, 20 August 2026, and the published number moved
DOWN with the instrument's honesty.** The round's failed baseline
criterion was met with code: the rise-only ratchet is removed, the
baseline freezes at its thirty-second calibration, and the birth
ceiling tightened to the plan's own 1.25 line. The corpus was
re-measured with predictions committed first: recall 87.7 to 83.6
(predicted 82 to 86), the precision prediction was WRONG (81.4, down,
because the frozen lower line exposes near-line flutter fragmenting
into re-crossings, P1's live signature) and the record says so in
docs/baseline-freeze.txt and docs/eyeblink8-result.txt. The round's
six live sessions are NOT re-scored. D1 stage two also shipped the
same day (the below-60 fps warning) and #178 closed with the ceiling
kept.

**THE SIX-PERSON ROUND IS COMPLETE AND PUBLISHED, 20 August 2026.**
All six participants returned files, every file was read with no
refusals, and the table is published whatever it says, per the plan:
`docs/validation-round.txt`. Criterion 2, the baseline does not
generalise, FAILED, pre-registered: three of six rulers were unusable,
each a different way. Criterion 1 was evaluated on the three sound
sessions and the detector missed NOTHING; its wild defect is
over-counting (one slow deep blinker, 25 for 10, the first independent
evidence feeding the #178 decision). Criterion 3 not met. The
evaluation was a two-hundredths escape: the last participant's
baseline ratio landed 1.23 against the 1.25 ceiling, and one more
unsound session would have voided criterion 1 by the plan's own guard.
Nothing identifying any participant is published: no names, no file
names, no user agents, no sleepiness answers.

**THE MID-ROUND FREEZES ARE LIFTED.** src/ may change again, roadmap
7.8 is unfrozen, the deploy workflow is unfrozen. The rules queued for
the NEXT round (frame-rate soundness, window-scoped drift, minimum
window width, moderation) are in the round write-up. What the round
points development at, in order: baseline calibration (the failed
criterion), then the owner's two decisions, D1 (now with twelve
sessions of evidence that the gate never wrongly opened) and #178
step 4 (now with independent refractory evidence).

The increment before it: the round's analysis tool was adversarially
tested BEFORE its table was published, and hardened by what that
found. The
record is `docs/validation-tool-adversarial.txt`: fifteen probes, every
prediction committed before any probe ran, fourteen right and the
fifteenth wrong in the bad direction. What the probes caught: five ways
one participant's corrupt cell crashed everybody's table, a renamed
blinks file (`.CSV`, `.csv.txt`) that silently became a MISSED verdict
criterion 1 would have counted, a `nan` marker that manufactured the
same verdict, a `#` inside a cell that silently voided a working
baseline, and criteria that printed "not met" under a table with zero
readable rows. All of those are named refusals now, 21 new Python
tests were each watched failing against the unfixed code first, and
the real four-participant table prints byte for byte what it printed
before the branch, checked by diff. No metric, threshold or verdict
moved; mid-round freezes held.

A SECOND PASS the same day, owner-authorised, probed the layer the
first pass deliberately did not: the judging and the printed table,
fed files the tool accepts. Seven probes, seven predictions held. A
broken truncation declaration no longer reads as "nothing lost", one
participant prints as "1 participant", and refusal lines name a file
once. The finding that was NOT fixed: two marks stamped in the same
second make a zero-width window that prints as a routine MISSED, and
fixing that changes a verdict, so it is QUEUED AS A THIRD NEXT-ROUND
RULE beside frame-rate soundness and window-scoped drift. Tests are
188 now, table still byte-identical.

The increment before it: the six-person validation round's analysis
tool, whole.
`docs/validation-plan.md` was committed BEFORE any session file existed,
`analysis/blinklab/validation.py` pairs a folder of exports and refuses
by name, `analysis/blinklab/validation_checks.py` computes the plan's
columns, and `analysis/tools/validation_report.py` prints the table:

    cd analysis
    PYTHONPATH="$PWD" .venv/bin/python tools/validation_report.py \
        "$DATASETS/validation-round"

It exits non-zero when it could not read everybody. Before it, #266
shortened the page heading to "Alertness demo".

**THE DRY RUN HAPPENED and it found what fixtures could not.** The owner
ran the whole protocol on FOUR devices over 16 to 19 August: an iPhone 14
Pro Max, an iPhone 17 Pro Max, a MacBook Air, and a Sony A7 IV through a
Cam Link 4K. SIX sessions, because the iPhone 14 and the MacBook were
each run twice; both re-runs are explained below. Raw files in
`$DATASETS/validation-dry-run`, never in this repository. The tool read
all twelve files with no refusals, and the pairing coped with the device
names inserted into the filenames.

**REFER TO SESSIONS BY NAME, NOT BY LABEL.** `P1` to `P6` are positional
and shift the moment a session is added: the MacBook re-test was P4 on
17 August and is P5 now, which falsified the prose in the published
write-up for two days. The tables print the session name beside the
label since 19 August. The names are `iphone`, `iphone2`,
`iphone17promax`, `macbookair`, `macbookair2`, `pcsony`.

**The finding: the same face gave a median eyelid aperture within about
11 percent across all six sessions, and the baselines learned from those
measurements were 7.69, 7.61, 8.09, 9.80, 7.78 and 7.30 mm, a spread of
34 percent.** The iris normalisation works. What is learned from it does
not travel. In `macbookair`, a few frames in the first 30 seconds read
up to 10.35 mm against a window median of 7.51, and a 90th percentile
follows them, so the blink line landed at 71 percent of resting aperture
against 56 to 58 everywhere else. That session logged 26.0 blinks per
minute, including one detection of 1.26 mm amplitude, below the faint
line the on-screen table greys out. `macbookair2` is the same laptop run
again with a baseline that landed correctly.

Readiness and drift both PASSED on that session, because a baseline born
wrong does not move. Its drift was 0.0. The plan's second dated
correction adds `baseline_over_resting`, flagged above 1.25, and
`macbookair` is the only session of the six that it flags.
Last commit, as of the stamp below: 2026-08-20;
`git log -1` is always the truth
Live demo: https://heshipstech.github.io/blinklab/
Currently working: the round is COMPLETE and published, see the top of
this file. Live-camera numbers now exist from seven faces: the owner's
and six volunteers'. Both owner decisions are TAKEN, 20 August: #178
step 4 keeps the ceiling at 500 and the issue is closed
(`docs/max-blink-duration.txt`), and D1 stage two shipped as the
below-60 fps warning with hysteresis (REMEDIATION.md D1 is ticked).
Next up: baseline calibration, the round's failed criterion, decided
as robust passive learning first; it moves the blink line, so it ends
with an Eyeblink8 re-run and republished numbers. The refractory
re-arm investigation is queued behind it.

**THE IPHONE WAS RE-RUN AND THE ANSWER IS THE DETECTOR.** Protocol
followed exactly, and 7 of 10 deliberate blinks were detected. The seven
sit at a metronome 0.90 to 1.00 s cadence broken by two holes of 2.89
and 2.98 s, each the width of two more blinks. The person did not pause.

**THE MACBOOK WAS RE-TESTED on 17 August**, the same laptop at the same
rate with a baseline that landed correctly, to separate the processing
rate from the device. Sound sessions whose marks are where the protocol
asks:

    iphone2         30.7 fps     7 of 10
    macbookair2     29.2 fps     9 of 10
    iphone17promax  55.0 fps    10 of 10
    pcsony         126.7 fps    10 of 10

**At the rate a four core machine produces, whether laptop or phone,
this instrument loses deliberate blinks, and the 25 fps floor is above
none of it.** Every one of those sessions ran above 25 fps throughout
the marked window, so nothing was refused and nothing said anything was
wrong. Each miss is a hole a whole number of blinks wide in an otherwise
metronome cadence.

**The processing rate is set by the COMPUTER, not the camera.** Every
camera in every session declares 30 fps, and the achieved rate ran from
29.2 to 126.7. Do not reduce this to core count: participant 2 of the
actual round has twelve cores and runs at 45, while the Sony machine has
twelve and runs at 127. So how many blinks this
instrument reports depends on how fast the viewer's computer is, and the
page tells them nothing about it. That is larger than D1 as written,
which is about a slow camera holding the gate open.

**RETRACTED, and the write-up records it:** the 16 August version of
this said blink duration moves with the processing rate. `macbookair2`
refutes it: the slowest sound session reports the longest blinks, 149 ms
at 29.2 fps against 96 ms at 30.7 and 129 ms at 126.7. Not ordered by
rate in either direction. The claim rested on two points that happened
to line up.

**SETTLED 19 August, and the prediction was committed first.** A sixth
dry-run session on an iPhone 17 Pro Max ran at 55.0 fps and caught 10 of 10. Written down before it was recorded: a faster phone should catch
close to ten if the rate is the cause, and should miss about three
REGARDLESS of rate if the cause is iOS, WebKit or the front camera. That
session holds all three of those constant against the iPhone 14 and
missed none. **The phone was never the problem. The rate was.**

Sound sessions, ordered by rate: 30.7 fps gives 7 of 10, 29.2 gives 9,
55.0 gives 10, 126.7 gives 10. The transition sits between 30 and 55,
and the 25 fps floor is nowhere near it. That agrees with
`docs/blink-sample-rate.txt`, which was run before either phone session
and predicted the band closes by 60 Hz.

Still confounded and said so in the write-up: the camera differs (Front
Camera against Front Ultra Wide), iOS and Chrome both moved a version,
and it is one session per device on one face.

**The duration retraction is now firmer.** Both iPhones report about
96 ms while running at 30.7 and 55.0 fps. Duration tracks the DEVICE,
not the rate.

The full write-up is `docs/validation-dry-run.txt`, SIX sessions, and it
carries the tool's own output. **Refer to sessions by NAME, not by label:
labels are positional and the MacBook re-test moved from P4 to P5 the
moment a sixth session arrived, which falsified the prose around it for
two days. The tables now print the session name beside the label.**

**THE CAUSE IS NOW ISOLATED, offline, with no camera and no people.**
`docs/blink-sample-rate.txt`, reproducible with

    BLINKLAB_PRINT_TABLE=1 npx vitest run test/core/blinkSampleRate.test.ts

`blinkStep` is a pure function, so a blink can be built as an aperture
trace, sampled at a chosen rate, and run past the real detector with
everything else held still, sweeping the PHASE that nobody controls in a
real session. Three regions, and only the middle one is about the rate:

- Deep blinks, 2.80 mm and below: caught at every rate, every phase.
- Blinks too shallow to reach the ARM LINE (the blink line less the 10
  percent hysteresis of fix #114): never caught at any rate. A depth
  problem, and by design.
- Between them, a band about 0.4 mm wide where the RATE decides. At
  3.30 mm: 56 percent at 25 Hz, 67 at 30, 100 at 60. Speed widens it:
  an 80 ms blink at 3.20 mm is caught 43 percent of the time at 30 Hz
  and always at 90.

Proven by mutation rather than argued: setting
`APERTURE_HYSTERESIS_FRACTION` to 0 removes the arm line and the band
disappears, turning three of the five tests red. So the tests are
sensitive to the cause, not only to themselves.

**WHAT IT CANNOT SAY, and this is permanent.** Whether real blinks live
in that band often enough to explain 7 of 10 and 9 of 10. THE DATA IS
CENSORED: a missed blink writes no row, so every amplitude in every
blink log comes from the blinks that were caught. More sessions do not
fix it.

**The 25 fps floor is NOT the thing that is wrong.** Refusing below 25
is correct and these numbers support it. What is wrong is that above the
floor nothing is said: 29 fps and 127 fps both pass silently and are not
the same instrument. That is the honest shape of D1's remaining work,
and it is not the shape D1 was written in, which assumed a slow CAMERA.
In five real sessions every camera declared 30 and the gate never
wrongly opened once.

**ISSUE #178 IS RECONCILED**, 18 August, `docs/max-blink-duration.txt`,
and nothing was changed to do it. `MAX_BLINK_DURATION_MS` does TWO jobs
and which one depends on `baseline_over_resting`, the same ratio the
validation round's fifth check measures. Below about 1.9 the ceiling is
pure cost, which is the state the Eyeblink8 clips are in and why the
replay saw a gain. Near 2.0 the blink line has climbed into the resting
eye's own wobble and the ceiling is the only thing keeping noise out of
the count, which is what #126 said. Above 2.0 the eye reads closed at
rest and nothing completes at all.

Setting the constant to 1000 turns exactly two tests red: the real blink
the replay wanted, and the phantom #126 warned about. The trade is one
command now instead of two documents.

Also found: #126's 0.2 mm dip is blocked by the ARM LINE, not by the
ceiling, so fix #114 already narrowed the ceiling's second job after
#126 was written. And the owner's five sessions exercised NEITHER job:
168 blinks, longest closed phase 333.6 ms against a 500 ceiling, ratios
1.12 to 1.41. The constant is deliberately unchanged; that is step 4 of
the issue's own order and it is the owner's.

**THE LIMITATION IS NOW STATED WHERE IT IS READ**, 18 August: a bullet
in README's "Honest limitations", a paragraph in MODEL_CARD's "Where it
fails", and MODEL_CARD's tested-on table corrected from "one laptop" to
three devices and five sessions. **D1 IS RE-SCOPED** in REMEDIATION.md
rather than rewritten: its original premise, a slow camera holding the
gate open, did not occur once in five real sessions, and stage two is
now "say something true about the processing rate when it is low enough
to be losing blinks". What it should say is undecided and is the
owner's.

**TWO THINGS CLOSED 18 August, both found by looking before sending.**

First, a hole in the pre-registration. Criterion 1 counted every session
that came back `missed`, with no requirement that its baseline worked.
The dry run proved that cuts both ways: P3 counted 10 of 10 BECAUSE its
ruler was 41 percent too long, a false pass, and the mirror case would
read a broken ruler as evidence against the detector. The plan's THIRD
dated correction fixes it: only sound sessions vote on criterion 1,
unsound ones are still reported in full and named as excluded, and if
more than half are excluded the criterion is not evaluated at all and
the round says something worse instead.

Second, there were NO participant instructions. The protocol lived only
inside the pre-registration, which is jargon. `docs/participant-
instructions.md` is now a document to paste into an email, shaped by
what the rehearsal broke: the order is the part people get wrong, phone
auto-lock kills the session, sitting still for the first 30 seconds is
what keeps the baseline honest, and the sleepiness question must be
answered or no file is written.

NEXT: the round goes out, to TWO people first rather than six, because
you can only ask each person once. The findings above make it MORE worth
running: the table already prints each person's processing rate beside
their count, and now their baseline ratio too. Still worth one honest
change to README and MODEL_CARD before sending, because the blink count
is now measured to depend on the viewer's machine and neither document
says so.

The August audit's ladder is closed. Stages A, B and C are complete; D1
stage two is the single remaining piece of real work and it is a WEBCAM
fix, not hardware preparation, because a 20 fps camera reads 70 today
and holds the 25 fps blink gate open in sessions that should be refused.
**The six session files are its blast radius measurement**: they carry
`camera_declared_fps` beside the processing rate, which is the evidence
D1 has been held for, so the round comes first and D1 follows it. Stage
E is complete apart from a repository setting. Stage F is complete or
declined. Stage G is complete apart from 8.8, declined. Stage H is
declined entire.

**The owner cut the backlog on 15 August.** Items that were tidying
rather than blocking are marked `- [~]` in REMEDIATION.md, which means
DECLINED, not pending. That marker exists because deferred items kept
coming back as findings in the next audit under a new number. Do not
reopen one without a reason that did not exist on 15 August.

Both licence and privacy questions are answered. The Eyeblink8 copyleft
question was put to the corpus authors and permission was granted; no
individual is named, at the owner's instruction. Both committed human
data fixtures are the owner's own face and own ratings, recorded in
MODEL_CARD.md and test/fixtures/README.md.

Issue #221 records the backwards model clock
found by B1's review.

**Both handoff files under-reported themselves until 15 August.**
REMEDIATION.md had not been touched since 12 August while three Stage E
items moved, and NEEDS-REVIEW.md still listed statements PR #248 had
already corrected. Both are now caught up, each item re-checked against
the repository or the GitHub API rather than against the previous
document. Doing that check found one thing the earlier reading had
wrong: PR #243 did not finish the account-name scrub, one memory
directory path survived in `docs/audit/appendix-chunk-1-all-findings.md`
and is neutralised now.

**14 to 15 August changed nothing on the remediation ladder.** Fifteen
pull requests merged (#234 to #248) and every one was dependencies or
documentation. Stage D stage two is still HELD and Stage E is still the
open path, exactly as the paragraph above says. Four things from that
run are worth knowing before you pick up the next increment:

- **Publishing was broken for about four hours and is fixed.** Two
  pushes to `main` failed at "Set up job" before any step ran, because
  the repository began requiring every action to be pinned to a full
  commit SHA and `upload-pages-artifact@v3.0.1` referenced a floating
  `actions/upload-artifact@v4` inside itself. #236 pinned it. **A
  settings change can break a workflow with no diff in the repository**
  — if a run dies at "Set up job", suspect policy before code.
- **The published page now says which commit built it.** #244 adds a
  `build-commit` meta tag, so `curl` on the live demo tells you the
  short SHA without needing repository access. Every deploy since has
  matched `main`.
- **Dependabot alerts are on and report zero**, and `npm audit` agrees.
  TypeScript 7 is ignored on purpose: `typescript-eslint` still caps at
  `<6.1.0`, so the bump cannot install. Delete the ignore when that cap
  lifts.
- **Three published statements were corrected**, in #246, #247 and
  #248. The last is the one that matters: `docs/evidence/2026-08-09`
  told readers `eyeblink8_misses.csv` was withheld on licence grounds
  when it has been committed since PR #200. **The licence question
  itself is still open** — `DATASETS.md` still says the copyleft "would
  need thought before publishing derived files" and that thought has
  not been done. Correcting what is true about the file is not a ruling
  on whether it should be there.

One method note from that run, because it caused the #247 defect. An
audit pass measured this repository against a local checkout nine
commits behind `origin/main`. The tree was clean, so it read as
current, and a live page contradicting a published document was
invisible from it. **A clean working tree is not a current one — fetch
before auditing.**

Stamped: 20 August 2026. When this file changes, this stamp changes
with it; a test enforces that.

## Where things stand, 10 August 2026

Track A is DONE and its number REPEATS. Track B, the sleepiness
question, has been measured once and its result IS published: a null
result, in README.md and docs/drozy-result.txt, merged as #201 on
10 August.

MERGED overnight: #194 the DROZY analysis code and its pre-registration
plus MODEL_CARD.md and ARCHITECTURE.md (roadmap 8.2 and 8.4 done), #196
the exclusion bias report, #197 the frame count guard (closed #193),
#198 the loud frame rate refusal (closed #192).

RESOLVED: the miss table rebuild first opened as #195 was re-opened as
#200 and MERGED on 10 August, moving the published miss figure from
78.6% to 72.0%. The headline recall, precision and F1 were untouched by
it. (#195 itself was closed unmerged after its branch was deleted too
early, which is why REMEDIATION.md now says merge before deleting.)

### The DROZY result, now published

DROZY is used under a written permission whose condition is that the
database and its paper are cited wherever results appear, in any form.
Cite: Massoz, Langohr, Francois and Verly, WACV 2016. (Added 2026-08-14
— this section printed DROZY figures without it.)

Measured, analysed, and published in this repository since 10 August:
the full table is in docs/drozy-result.txt and the write-up in
README.md. It is a null result: nothing survived the Holm correction.
It was held back briefly so the owner saw it first; that hold ended
with #201. The analysis is reproducible with:

    cd analysis
    PYTHONPATH="$PWD" .venv/bin/python tools/analyse_drozy.py \
        "$DATASETS/drozy-measured" <path-to-KSS.txt>

What can be said here without publishing the finding: 20 of 36 sessions
were analysable, and the plan in docs/drozy-analysis-plan.md was
committed before any correlation existed, so the result can be checked
against a plan that could not have been written to fit it.

THREE OF THE SEVEN ROWS WERE MEASURED BY CODE THAT HAS SINCE CHANGED.
The run is from 9 August, built from `bd2a98d`. PR #225 then clipped the
blink shape window on 12 August, which moves closing velocity, blink
amplitude and amplitude over velocity. Blink intervals re-measure byte
for byte identical, so blink duration, long closures, blink rate and
PERCLOS are unaffected, and Track A is untouched. Both `README.md` and
`docs/drozy-result.txt` now say so, and `tools/drozyGuard.mjs` requires
them to while `git log bd2a98d..HEAD -- src/core/blinkShape.ts` is
non-empty. Re-measure and update the "built from" line, and the
requirement lifts on its own.

THE EXCLUSION IS NOT RANDOM. DROZY's own README says the 15 fps
recordings are "tests 2 and 3 of subjects 1->8, because of a recording
bug occurring in darkness", and those are the sleep deprived sessions.
The excluded 16 average KSS 6.38 against 4.60 for the analysed 20, and
every KSS 9 sits in the excluded group. Any conclusion drawn from the
remainder is a conclusion about a sample missing the top of the scale.

The 16 cannot be recovered. DROZY carries no blink ground truth, its
manual and automatic annotations being 68 point face landmarks, and
recovering the sessions would mean lowering the 25 fps floor, which is
not on the table.

Derived DROZY video is DELETED per the DATASETS.md safeguard. Numbers
only remain, 692 KB. A re-run needs a re-extract and re-transcode from
DROZY.zip, about 8 minutes.

## The datasets folder

The corpus and the measurements are not in this repository. They sit in a
`datasets` folder beside the folder this repository was cloned into. Every
command on this page writes that folder as `$DATASETS`. Set it once per shell,
to wherever it is on your own machine:

    export DATASETS="/PATH/TO/datasets"

Check it before running anything else:

    ls "$DATASETS"

You should see `eyeblink8`, `eyeblink8-mp4` and five measured folders:
`eyeblink8-measured` (the first run, defective export),
`eyeblink8-measured-capfix` (export fixed, clock still wobbling),
`eyeblink8-measured-clockfix` (clock fixed, double counting exposed),
`eyeblink8-measured-refractory` (double counting cut, ruler still
moving) and `eyeblink8-measured-frozen` (CURRENT). If you do not, the
commands below will fail with
"No such file or directory", and the fix is this line, not the command.

## Track A result, 20 August 2026, current

Eight Eyeblink8 clips, 408 human-marked blinks, 419 detected.

    Recall     83.6%   (341 of 408 found)
    Precision  81.4%   (78 invented)
    F1         82.5%

THIS NUMBER IS LOWER THAN THE 87.7% IT REPLACES, ON PURPOSE. The
previous run's ruler ROSE on every one of the eight clips, 2.3 to
37.6 percent, so its blink line grew more permissive as each clip
went on, and the validation round failed its baseline criterion on
exactly that behaviour. The ruler now freezes at its thirty-second
calibration (docs/baseline-freeze.txt, predictions committed before
the re-run; four held, the precision one was wrong and the record
says so). Verified from the run's own records: drift 0.0 on all
eight clips, birth values identical to the previous run's, so the
delta is the freeze and nothing else.

THIS ONE REPEATS, like the run it replaces: measuring one clip three
times produces identical files, byte for byte.

Four numbers have been published for this benchmark and all four
belong in the record:

    69.6% recall, F1 77.1   the export was deleting its own rows (#172)
    82.8% recall, F1 84.6   export fixed, clock still wobbled (#173)
    87.7% recall, F1 85.4   clock fixed (#189), double counting cut
                            (#190), ruler still moving
    83.6% recall, F1 82.5   ruler frozen at calibration (2026-08-20)

Precision fell from 86.4% to 83.3% between the second and the third,
not a regression: the deterministic clock made the detector more
sensitive and the refractory period removed 39 false alarms at zero
recall cost. It fell again to 81.4% in the fourth, AGAINST the
committed prediction: at the frozen, lower line, near-line flutter
fragments into repeated crossings 200 to 400 ms apart, the same
re-crossing signature the round's P1 produced live, five of the six
new false alarms in one clip's flutter episode. The re-arm gate
(docs/blink-rearm.txt) targets that signature.

Coverage: 71,356 frames measured against 71,354 annotated. Two clips
gave one frame more than their annotation file lists. Every other clip
is exact.

Measured from
`$DATASETS/eyeblink8-measured-frozen`.
All four earlier runs are kept for comparison beside it.
Full output in `docs/eyeblink8-result.txt`, written up in the README.

**This replaces a wrong number of 69.6% recall, 86.3% precision, 77.1%
F1**, which was written in a first draft that was never merged. The
cause was in this repository, not in the corpus. `BLINK_LOG_CAP` was 50.
It fed a fixed length list that threw away the OLDEST entry whenever a
new one arrived (a ring buffer). The same list was both the on screen
panel and the exported record, so the export inherited a display limit.
Three clips made more than 50 detections, so their opening stretches
were deleted before the file was written. That was 63 rows, and 54 of
the 63 were real blinks. Fixed in pull request #172. The cap is now two
caps:
`BLINK_LOG_DISPLAY_CAP` (50, panel only) and `BLINK_LOG_RECORD_CAP`
(20000, the record). The export prints a WARNING header line when rows
are missing. Two of those three clips moved 55.7% to 89.8% and 58.3% to
91.7%, which is 30 and 24 blinks recovered, 54 in total. That is the
entire move from 284 to 338. Every other clip found exactly the same
number of blinks in both runs.

CAVEAT when comparing the two runs. They were built from different
commits, so this is not one line changed. Four of the six shorter clips
shifted a blink edge by a frame or two, or split one detection into
two. Two report exactly the same blink timings. The cap counted
DETECTIONS, not annotated blinks, so it also bit `27122013_152435_cam`.
How many rows that clip lost cannot be recovered: the capped export is
the only surviving record of that run, and it holds fifty rows whatever
number was cut from the front of it. No recall figure changes either
way. (Until 2026-08-14 this said the clip "lost its first one" and that
the lost row was a false positive. README.md had already withdrawn that
as unrecoverable, so the two documents disagreed; README is the
corrected account.) The frame rate is not the cause either: `measured_fps` is 30.00 in both runs for all eight clips.
The recall attribution above is nevertheless exact. Fixing the cap also
surfaced 8 more invented blinks, 45 to 53, seven of them in the two
recovered clips.

The glasses claim from the first write up is WITHDRAWN, not reversed.
It rested on 83.7% for the one glasses clip against 67.9% for the seven
without, but both truncated clips sat in the group without glasses. The
split on the CURRENT run is 88.4% recall with glasses against 83.0%
without, and 88.4% precision with against 80.6% without. The glasses
clip now scores a few points higher on both, which
is the opposite of what the earlier run showed and just as meaningless.
One clip of 43 blinks settles nothing either way, so report BOTH halves
or neither.

What the audit established, so nobody argues it again:

- The corpus is not the problem. 787 lost frames across 174 gaps, and
  every one of the 8 clips loses some. STATE THE RULE WITH THE NUMBER,
  because publishing a number without its rule is what went wrong here.
  THE RULE. Read each clip's own `.txt` timestamp file. At 30 frames
  per second one frame lasts 0.033 seconds. Round every gap between two
  kept frames to a whole number of frame lengths. Anything above one is
  a lost frame. Checkable with `analysis/tools/audit_frame_loss.py`.
  787 of 71,354 frames is 1.10%, so say 1.1%. Earlier notes said 737
  frames and 1.011%; no single rule produces 737 together with "3
  clips", so both are retired. 12 gaps are half a second or longer,
  they sit in 3 clips, and they hold 611 of the 787. At the very most
  the lost frames explain 4 of the 70 misses — the second run's figure,
  not recomputed for the current run, which has 50 misses. A blink counts as touched
  when a gap falls anywhere from one frame before it starts to its last
  frame. In every frame the person faces the camera. No blink is
  shorter than 4 frames. Shrinking the video to a quarter of its size
  changed how strong a blink looks by 2.7%, so the picture is not too
  small.
- 36 of the 50 misses of the CURRENT run, 72.0%, contain at least one frame the
  human marked fully closed. That is the real weakness. An earlier note
  said 87.9%; that was 109 of 124, and 124 is the FIRST run's miss
  count, so it was measuring the defect. Recomputed on the corrected
  misses using `Blink.fully_closed_frames` from
  `analysis/blinklab/eyeblink8.py`. Rebuilt for the current run and
  committed row by row at docs/evidence/2026-08-09/tables-current-run/.
  Closes #179. Earlier figures were 87.9% (109 of 124, the FIRST run,
  measuring the export defect) and 78.6% (55 of 70, the second run).
- Double counting is PARTLY fixed, by the refractory period of #190. A
  closure is not counted if it ends within 150 ms of the previous
  counted blink, because an eyelid cannot open and shut twice that
  fast. That removed 39 false alarms and cost no recall. 72 remain, of
  which 45 still sit on a real blink under the strict rule and 61 are
  3 frames or shorter. Raising 150 would catch most of them and it
  STAYS at 150: a constant chosen to improve a score on a benchmark
  already read is fitting, not measuring. The remainder is a
  segmentation fault needing its own investigation.
- Do NOT apply exclusions to flatter the score. Dropping long closures
  raises recall, dropping partial blinks raises it again, and one notch
  further you are deleting the blinks we missed. That last step shows
  where this reasoning ends up, and it is plainly cheating. The README
  prints none of those numbers, deliberately.

## If you are a fresh context, read this first

### The stale server trap, which cost a day

This is issue #175. Read it before any corpus run.

The corpus runner drives a preview server on port 4173. A LEFTOVER
server from an earlier run keeps that port and serves the OLD BUNDLE. A
bundle is the single JavaScript file the build produces, and its name
changes whenever the code changes.

Here is the trap, step by step.

- The leftover server is already holding port 4173.
- Your `npm run preview -- --strictPort` sees the port is taken, so it
  refuses to start and exits. That is what the flag is for.
- The leftover server is still there and still answering. So
  `curl http://localhost:4173/blinklab/` returns HTTP 200 (hypertext
  transfer protocol, and 200 is the code for success).
- The runner measures the old code for twenty minutes and hands you a
  confident, plausible, wrong number.

On 9 August this produced a fake result of 69.1% from code that had
already been fixed.

The check that catches it: after `npm run build`, compare the bundle
filename in `dist/assets` against the filename the server actually
serves, and REFUSE to measure on a mismatch.

    ls dist/assets/index-*.js
    curl -s http://localhost:4173/blinklab/ | grep -o 'index-[^"]*\.js'

Run both lines and read both answers. If the two names disagree, or if
the second line prints nothing at all, do not measure. Kill whatever
holds the port and start the preview again:

    lsof -ti tcp:4173 | xargs kill

Do this every time, not only when a number looks wrong. A stale bundle
does not announce itself, and the number it gives you is plausible. The
two run logs from that day are committed at
`docs/evidence/2026-08-09/run-logs/`. Open them side by side. One
measured the wrong code and one measured the right code, and nothing in
either file tells you which.

### Throughput, corrected

**About 58 frames per second. A full corpus run takes about 20
minutes, not 2.4 hours.** This file used to claim 8.4 frames per second
and a 2.4 hour run. That figure was measured on one clip under a
debugger and was roughly seven times too slow.

It mattered. It made the corpus look like an overnight job. It made
DROZY, the next dataset, look like a twenty hour one. The owner was
close to cutting down the whole evaluation plan around a cost that does
not exist.

The 58 figure is measured from the run's own file timestamps, not
back-solved from a guess. Clips 2 to 8 of the capfix run are 55,572
frames written between 09:51:36 and 10:07:30. That is 954 seconds and
58.25 frames per second. Per clip the rate runs 56.9 to 58.9. Check a
throughput figure against a real end to end run before planning around
it, and check it the same way:

    stat -f "%Sm %N" -t "%Y-%m-%d %H:%M:%S" <measured-dir>/*.blinks.csv

Do not conclude a run is stuck because nothing has appeared after a few
minutes. It writes nothing until a clip finishes, and the longest clip,
26122013_223310 at 15,784 frames, comes first.

### Checking and restarting a run

    ls "$DATASETS/<measured-dir>/"

It writes two CSVs per clip, `<name>.blinks.csv` and
`<name>.seconds.csv`, into that folder.

DO NOT read `/tmp/corpus.log`. This page used to point at it. That file
is the CONTAMINATED first run of 9 August, the one that measured the
stale bundle, so it describes a result the project has retracted. Give
every run its own new log file and put the time in the name. Both logs
from that day are committed at
`docs/evidence/2026-08-09/run-logs/`, and the corrected one is
`corpus-run-10-07-corrected.txt`.

A DEAD PREVIEW SERVER DOES NOT FAIL LOUDLY. This page used to say that
if the preview server died, the run failed and the log said so. That is
wrong, and believing it cost a day. What really happens is the stale
server trap above, which is issue #175: a leftover server holds port
4173, `npm run preview -- --strictPort` refuses to start and exits, and
curl to 4173 still answers HTTP 200 from the OLD server. So the run
does not fail. It finishes, and it measures the wrong code. The bundle
check above is the only thing that catches this. Run it every time.

If you want to know a run is alive, run one clip by hand and watch the
status line: it reports "Measuring every frame: N done, P% of the clip"
and updates twice a second.

To restart a run:

    npm run build
    npm run preview -- --strictPort &
    # Now do the bundle check above. Only if it agrees:
    node tools/measure_corpus.mjs \
      "$DATASETS/eyeblink8-mp4" \
      "$DATASETS/eyeblink8-measured-$(date +%m%d)" \
      > "/tmp/corpus-$(date +%m%d-%H%M).log" 2>&1

Write every new run into a NEW dated folder. Never point this command
at a folder that already holds a published run: the four measured
folders listed under "The datasets folder" above are the evidence
behind published numbers,
and a restart aimed at one of them would overwrite it.

The build is on its OWN line on purpose. This page used to write
`npm run build && npm run preview -- --strictPort &`, where the `&`
backgrounds the WHOLE chain, build included. The shell then returns at
once, a failed build looks the same as a slow one, and you can start
measuring before anything has been built.

## How the Track A number is produced

    cd analysis
    PYTHONPATH="$PWD" .venv/bin/python tools/evaluate_eyeblink8.py \
      "$DATASETS/eyeblink8/eyeblink8" \
      "$DATASETS/eyeblink8-measured-frozen"

That prints recall, precision and F1 overall, then per clip, then split
by the glasses flag, then a coverage table. Read the coverage table
first: if measured frames and annotated frames disagree by more than
one percent on any clip, the numbers above it describe a different
recording and nothing else on the page can be trusted.

Use `.venv/bin/python -m pytest`, not `.venv/bin/pytest`. A folder
rename broke the console script shebangs.

For reference, what the script does under the hood:

1. Read each `<name>.blinks.csv` and turn `startFrame`/`endFrame` into
   `Interval` objects from `analysis/blinklab/blink_match.py`.
2. Read the matching `.tag` file with `load_annotation` from
   `analysis/blinklab/eyeblink8.py`. The corpus lives at
   `datasets/eyeblink8/eyeblink8/`, and `BLINKLAB_EYEBLINK8` points the
   tests at it.
3. `match_blinks` per clip, then `combine` across clips. Pool the
   COUNTS, never average the per-clip rates.
4. Report recall, precision and F1 overall, then per clip, then split
   by the glasses flag, because one clip is annotated for it. Read that
   split as one clip of 43 blinks and nothing more. It cannot support a
   claim about glasses in either direction.
   Ground truth totals to check against: 8 clips, 408 annotated blinks,
   71,354 frames.

## Rules that still apply

Never push to main. Branch, pull request, green CI (continuous
integration, the checks GitHub runs on every pull request), then merge.
Run every gate below before opening anything. CI enforces all of them,
so a gate you skip here fails there instead.

At the top of the repository:

    npm run lint
    npm run typecheck
    npm test
    npm run e2e
    npm run format:check
    npm run build

In `analysis/`, all three:

    .venv/bin/ruff check .
    .venv/bin/ruff format --check .
    .venv/bin/python -m pytest

This list is the same set the continuous integration workflow runs, and
it was checked against `.github/workflows/ci.yml` rather than
remembered. It used to be shorter than that workflow in three places,
which is the worst shape for a gate list to be in: you run everything
it says, you believe you are done, and the machine disagrees with you
afterwards.

`npm run format:check` is the one people forget. It runs Prettier over
the Markdown files as well as the code, and it failed on 9 August after
a paragraph was rewrapped. Prettier reads any line that starts with a
number and a full stop as a numbered list, so a line beginning "50."
turned a paragraph into a list and the check went red. Nobody had
changed a word. `npm run format` fixes it.

Known issues: #15 (actions majors), #90 (calibrated off screen
boundary), #108 (log.md backfill), #115
(depth-qualified closure episodes)

Test count: 619 unit tests, 20 end to end tests all run in Chromium
in CI of which 2 rerun locally in WebKit, 188 Python tests of which
2 skip

## DROZY, which is also ready

Downloaded and verified: `datasets/DROZY.zip`, 2,463,610,084 bytes, 36
videos plus `KSS.txt`. Permission granted in writing by Professor
Jacques Verly on 8 August 2026, and recorded the same way as the
UTA-RLDD one: who, when, and its scope, with the email kept privately
by the owner.

Only `KSS.txt` has been extracted so far, deliberately, to avoid
competing for disk with the corpus run. It is 14 rows of 3, one row per
subject, one column per test, KSS (Karolinska Sleepiness Scale) 1 to 9,
with `0` meaning the session never happened.

The DROZY arithmetic was rewritten with the corrected throughput. 36
clips of about ten minutes, at 30 frames per second, is roughly 648,000
frames. At about 58 frames per second that is roughly 3.1 hours, not
the twenty hours this file used to claim. Two minutes from each clip is
about 129,600 frames and roughly 37 minutes.

**Both figures assume DROZY runs at the same speed as Eyeblink8, and
that DROZY is 30 frames per second. Nobody has measured either one.
Measure a DROZY clip before planning around these numbers.**

Still prefer the two minute window, but for the right reason. The KSS
rating is a single number for the whole session, so a two minute window
carries exactly the same label as the full ten. The old reason, that a
full run costs a working day, was never true.
