Last increment: the August 2026 audit (AUDIT_REPORT_AUG_2026.md) and
the first two remediation fixes, R1 and R2 (REMEDIATION.md).
Last commit: squash merge of pull request #216 on 2026-08-10
Live demo: https://heshipstech.github.io/blinklab/
Currently working: remediation Stage A. A1 is done, A2 is next.

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

You should see `eyeblink8`, `eyeblink8-mp4` and four measured folders:
`eyeblink8-measured` (the first run, defective export),
`eyeblink8-measured-capfix` (export fixed, clock still wobbling),
`eyeblink8-measured-clockfix` (clock fixed, double counting exposed) and
`eyeblink8-measured-refractory` (CURRENT). If you do not, the commands below will fail with
"No such file or directory", and the fix is this line, not the command.

## Track A result, 9 August 2026, current

Eight Eyeblink8 clips, 408 human-marked blinks, 430 detected.

    Recall     87.7%   (358 of 408 found)
    Precision  83.3%   (72 invented)
    F1         85.4%

THIS ONE REPEATS. Measuring one clip three times produces identical
files, byte for byte. That was not true of any earlier figure on this
page, and it is the single most important thing about this run.

Three numbers have been published for this benchmark and all three
belong in the record:

    69.6% recall, F1 77.1   the export was deleting its own rows (#172)
    82.8% recall, F1 84.6   export fixed, clock still wobbled (#173)
    87.7% recall, F1 85.4   clock fixed (#189), double counting cut (#190)

Precision fell from 86.4% to 83.3% between the second and the third.
That is not a regression. The deterministic clock made the detector more
sensitive: 20 more real blinks found, and far more of the same blink
reported twice. The refractory period then removed 39 of those false
alarms at ZERO cost to recall.

Coverage: 71,356 frames measured against 71,354 annotated. Two clips
gave one frame more than their annotation file lists. Every other clip
is exact.

Measured from
`$DATASETS/eyeblink8-measured-refractory`.
All three earlier runs are kept for comparison beside it.
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
DETECTIONS, not annotated blinks, so it also bit `27122013_152435_cam`,
which made exactly 50 detections and lost its first one. That one was a
false positive, so no recall figure changes. The frame rate is not the
cause either: `measured_fps` is 30.00 in both runs for all eight clips.
The recall attribution above is nevertheless exact. Fixing the cap also
surfaced 8 more invented blinks, 45 to 53, seven of them in the two
recovered clips.

The glasses claim from the first write up is WITHDRAWN, not reversed.
It rested on 83.7% for the one glasses clip against 67.9% for the seven
without, but both truncated clips sat in the group without glasses. The
split on the CURRENT run is 88.4% recall with glasses against 87.7%
without, and 88.4% precision with against 82.7% without. Recall is
under a point apart, and precision now favours the glasses clip, which
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
  the lost frames explain 4 of the 70 misses. A blink counts as touched
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
      "$DATASETS/eyeblink8-measured-refractory"

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
boundary), #107 (backwards timestamps), #108 (log.md backfill), #115
(depth-qualified closure episodes)

Test count: 495 unit tests, 7 end to end tests across two browser
engines locally and Chromium in CI, 97 Python tests of which 2 skip

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
