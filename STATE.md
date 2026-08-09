Last increment: the Track A correction, on branch `docs/track-a-corrected`
Last commit: squash merge of pull request #172 on 2026-08-09
Live demo: https://heshipstech.github.io/blinklab/
Currently working: nothing. Track A is DONE and measured twice.

## Track A result, 9 August 2026, corrected

Eight Eyeblink8 clips, 408 human-marked blinks, 391 detected.

    Recall     82.8%   (338 of 408 found)
    Precision  86.4%   (53 invented)
    F1         84.6%

Coverage: 71,356 frames measured against 71,354 annotated. Two clips
gave one frame more than their annotation file lists. Every other clip
is exact.

Measured from
`/Users/evannorus/Desktop/blinklab build/datasets/eyeblink8-measured-capfix`.
The earlier run is kept for comparison at `.../eyeblink8-measured`.
Full output in `docs/eyeblink8-result.txt`, written up in the README.

**This replaces a wrong number of 69.6% recall, 86.3% precision, 77.1%
F1**, which was written on branch `docs/track-a-result` and never
merged. The cause was in this repository, not in the corpus.
`BLINK_LOG_CAP` was 50 and fed a ring buffer that dropped from the
front. The same list was both the on screen panel and the exported
record, so the export inherited a display limit. Two clips run past 50
blinks, 88 and 72 annotated, and their opening stretches were deleted
before the file was written. Fixed in pull request #172: the cap is now
`BLINK_LOG_DISPLAY_CAP` (50, panel only) and `BLINK_LOG_RECORD_CAP`
(20000, the record), and the export prints a WARNING header line when
rows are missing. Those two clips moved 55.7% to 89.8% and 58.3% to
91.7%. The other six barely moved.

The glasses claim from the first write up is WITHDRAWN, not reversed.
It rested on 83.7% for the one glasses clip against 67.9% for the seven
without, but both truncated clips sat in the group without glasses. The
corrected split is 83.7% with against 82.7% without. One clip of 43
blinks settles nothing either way.

What the audit established, so nobody re-litigates it:

- The corpus is not the problem. 737 lost frames, 1.011% of the corpus,
  12 freezes across 3 clips. Only 8 of 408 blinks contain a lost frame,
  each losing one, and 6 of those 8 were detected. Ceiling explanatory
  power: 2 misses. Zero non-frontal frames. Zero blinks under 4 frames.
  Downsampling 4x changed blink signal strength by 2.7%.
- 87.9% of the remaining misses contain at least one frame the human
  marked fully closed. That is the real weakness.
- Double counting is NOT fixed. 39 of the first run's 45 false
  positives sat on top of a real blink, median length 2 frames. A
  refractory period is the planned next fix.
- Do NOT apply exclusions to flatter the score. Dropping long closures
  gives 83.3%, also dropping partial blinks gives 86.8%, and one notch
  further reaches 92.8% by deleting the blinks we missed. That is the
  reductio. None of them go in the README.

## If you are a fresh context, read this first

### The stale server trap, which cost a day

The corpus runner drives a preview server on port 4173. A LEFTOVER
server from an earlier run keeps that port and serves the OLD BUNDLE
while answering HTTP 200 to everything. Nothing looks broken. On
9 August this produced a fake result of 69.1% from code that had
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

**A full corpus run takes about 16 minutes, not 2.4 hours.** This file
used to claim 8.4 frames per second and a 2.4 hour run. That figure was
measured on one clip under a debugger and was roughly nine times too
slow. It mattered: it made the corpus look like an overnight job, it
made DROZY look like a twenty hour job, and the owner was close to
rescoping the evaluation plan around a cost that does not exist. Check
a throughput figure against a real end to end run before planning
around it.

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

Restart it with, after the bundle check above:

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

Never push to main. Branch, pull request, green CI, then merge. Run
lint, typecheck, `npm test`, `npm run e2e` and, in `analysis/`, both
`ruff check` and `pytest` before opening anything.

Known issues: #15 (actions majors), #90 (calibrated off screen
boundary), #107 (backwards timestamps), #108 (log.md backfill), #115
(depth-qualified closure episodes)

Test count: 442 unit tests, 7 end to end tests across two browser
engines, 61 Python tests plus 2 skipped

## DROZY, which is also ready

Downloaded and verified: `datasets/DROZY.zip`, 2,463,610,084 bytes, 36
videos plus `KSS.txt`. Permission granted in writing by Professor
Jacques Verly on 8 August 2026, and recorded the same way as the
UTA-RLDD one: who, when, and its scope, with the email kept privately
by the owner.

Only `KSS.txt` has been extracted so far, deliberately, to avoid
competing for disk with the corpus run. It is 14 rows of 3, one row per
subject, one column per test, KSS 1 to 9 with `0` meaning the session
never happened.

The DROZY arithmetic was rewritten with the corrected throughput. 36
clips of about ten minutes is roughly 648,000 frames, which at the real
rate of about 74 frames per second is roughly 2.4 hours, not the twenty
hours this file used to claim. Two minutes from each clip is about
129,600 frames and roughly half an hour.

Still prefer the two minute window, but for the right reason. The KSS
rating is a single number for the whole session, so a two minute window
carries exactly the same label as the full ten. The old reason, that a
full run costs a working day, was never true.
