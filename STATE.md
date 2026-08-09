Last increment: the Track A correction, merged as pull requests #172
and #173
Last commit: squash merge of pull request #173 on 2026-08-09
Live demo: https://heshipstech.github.io/blinklab/
Currently working: nothing. Track A is DONE and measured twice. The
write up is on this page and in the README.

## Track A result, 9 August 2026, corrected

Eight Eyeblink8 clips, 408 human-marked blinks, 391 detected.

    Recall     82.8%   (338 of 408 found)
    Precision  86.4%   (53 invented)
    F1         84.6%

THE LAST DIGIT DOES NOT REPEAT. This is one run, not a fixed value. The
same clip re-measured on the same computer and the same build gives a
different answer. One of the eight clips went from 7 false alarms to 9.
Carried into the totals that reads 86.0% precision and 84.4% F1 instead
of 86.4% and 84.6%. Recall stayed 82.8% in every re-run. Treat the last
digit of precision and F1 as approximate, and do not compare a future
run against these to one decimal.

Coverage: 71,356 frames measured against 71,354 annotated. Two clips
gave one frame more than their annotation file lists. Every other clip
is exact.

Measured from
`/Users/evannorus/Desktop/blinklab build/datasets/eyeblink8-measured-capfix`.
The earlier run is kept for comparison at `.../eyeblink8-measured`.
Full output in `docs/eyeblink8-result.txt`, written up in the README.

**This replaces a wrong number of 69.6% recall, 86.3% precision, 77.1%
F1**, which was written in a first draft that was never merged. The
cause was in this repository, not in the corpus. `BLINK_LOG_CAP` was 50.
It fed a fixed length list that threw away the OLDEST entry whenever a
new one arrived (a ring buffer). The same list was both the on screen
panel and the exported record, so the export inherited a display limit.
Two clips run past 50 blinks, 88 and 72 annotated, and their opening
stretches were deleted before the file was written. Fixed in pull
request #172. The cap is now two caps:
`BLINK_LOG_DISPLAY_CAP` (50, panel only) and `BLINK_LOG_RECORD_CAP`
(20000, the record). The export prints a WARNING header line when rows
are missing. Those two clips moved 55.7% to 89.8% and 58.3% to 91.7%,
which is 30 and 24 blinks recovered, 54 in total. That is the entire
move from 284 to 338. Every other clip found exactly the same number of
blinks in both runs.

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
corrected split is 83.7% recall with against 82.7% without, and 83.7%
precision with against 86.8% without. Recall is one point apart,
precision is three points apart the other way. One clip of 43 blinks
settles nothing either way, so report BOTH halves or neither.

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
- 55 of the 70 corrected misses, 78.6%, contain at least one frame the
  human marked fully closed. That is the real weakness. An earlier note
  said 87.9%; that was 109 of 124, and 124 is the FIRST run's miss
  count, so it was measuring the defect. Recomputed on the corrected
  misses using `Blink.fully_closed_frames` from
  `analysis/blinklab/eyeblink8.py`.
- Double counting is NOT fixed. 45 of the corrected run's 53 invented
  blinks sit on top of a real blink, and half are 3 frames or shorter.
  The planned next fix is a refractory period, which is a short window
  after a blink in which a second blink cannot be reported.
- Do NOT apply exclusions to flatter the score. Dropping long closures
  raises recall, dropping partial blinks raises it again, and one notch
  further you are deleting the blinks we missed. That last step shows
  where this reasoning ends up, and it is plainly cheating. The README
  prints none of those numbers, deliberately.

## If you are a fresh context, read this first

### The stale server trap, which cost a day

The corpus runner drives a preview server on port 4173. A LEFTOVER
server from an earlier run keeps that port and serves the OLD BUNDLE.
It answers every request with a success code, so nothing looks broken.
On 9 August this produced a fake result of 69.1% from code that had
already been fixed.

The check that catches it: after `npm run build`, compare the bundle
filename in `dist/assets` against the filename the server actually
serves, and REFUSE to measure on a mismatch.

    ls dist/assets/index-*.js
    curl -s http://localhost:4173/blinklab/ | grep -o 'index-[^"]*\.js'

If those two disagree, kill whatever holds the port and start the
preview again:

    lsof -ti tcp:4173 | xargs kill

Do this every time, not only when a number looks wrong. A stale bundle
does not announce itself, and the number it gives you is plausible.

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

    cat /tmp/corpus.log
    ls "/Users/evannorus/Desktop/blinklab build/datasets/eyeblink8-measured-capfix/"

It writes two CSVs per clip, `<name>.blinks.csv` and
`<name>.seconds.csv`, into that folder. It needs `npm run preview --
--strictPort` alive on port 4173; if that died, the run failed and the
log will say so.

If you do need to know it is alive, run one clip by hand and watch the
status line: it reports "Measuring every frame: N done, P% of the clip"
and updates twice a second.

Do the bundle check above first. Then restart it with:

    npm run build && npm run preview -- --strictPort &
    node tools/measure_corpus.mjs \
      "/Users/evannorus/Desktop/blinklab build/datasets/eyeblink8-mp4" \
      "/Users/evannorus/Desktop/blinklab build/datasets/eyeblink8-measured-capfix"

## How the Track A number is produced

    cd analysis
    PYTHONPATH="$PWD" .venv/bin/python tools/evaluate_eyeblink8.py \
      "/Users/evannorus/Desktop/blinklab build/datasets/eyeblink8/eyeblink8" \
      "/Users/evannorus/Desktop/blinklab build/datasets/eyeblink8-measured-capfix"

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
integration, the checks GitHub runs on every pull request), then merge. Run
lint, typecheck, `npm test`, `npm run e2e` and, in `analysis/`, both
`ruff check` and `pytest` before opening anything.

Known issues: #15 (actions majors), #90 (calibrated off screen
boundary), #107 (backwards timestamps), #108 (log.md backfill), #115
(depth-qualified closure episodes)

Test count: 442 unit tests, 7 end to end tests across two browser
engines, 61 Python tests passed plus 2 skipped

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
