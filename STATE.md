Last increment: the boxed layout and its polish, merged as pull requests #159 to #165
Last commit: squash merge of pull request #165 on 2026-08-08
Live demo: https://heshipstech.github.io/blinklab/
Currently working: Track A, the Eyeblink8 evaluation, running overnight

## If you are a fresh context, read this first

An unattended corpus run may be in progress. Check it before starting
anything:

    cat /tmp/corpus.log
    ls "/Users/evannorus/Desktop/blinklab build/datasets/eyeblink8-measured/"

It writes two CSVs per clip, `<name>.blinks.csv` and
`<name>.seconds.csv`, into that folder. It needs `npm run preview --
--strictPort` alive on port 4173; if that died, the run failed and the
log will say so.

**Measured throughput: 8.4 frames per second, about 120 ms each.** So
the corpus of 71,354 frames takes roughly 2.4 hours, and the longest
single clip, 26122013_223310 at 15,784 frames, takes about 31 minutes
on its own. Do not conclude the run is stuck because nothing has
appeared after twenty minutes. It writes nothing until a clip finishes,
and the first one is the longest.

If you do need to know it is alive, run one clip by hand and watch the
status line: it reports "Measuring every frame: N done, P% of the clip"
and updates twice a second.

Restart it with:

    npm run build && npm run preview -- --strictPort &
    node tools/measure_corpus.mjs \
      "/Users/evannorus/Desktop/blinklab build/datasets/eyeblink8-mp4" \
      "/Users/evannorus/Desktop/blinklab build/datasets/eyeblink8-measured"

## What is left to produce the Track A number

**Everything is now written.** Once the run finishes:

    cd analysis
    .venv/bin/python tools/evaluate_eyeblink8.py \
      "/Users/evannorus/Desktop/blinklab build/datasets/eyeblink8/eyeblink8" \
      "/Users/evannorus/Desktop/blinklab build/datasets/eyeblink8-measured"

That prints recall, precision and F1 overall, then per clip, then split
by the glasses flag, then a coverage table. Read the coverage table
first: if measured frames and annotated frames disagree by more than
one percent on any clip, the numbers above it describe a different
recording and nothing else on the page can be trusted.

Then write it into the README, including whatever is unflattering, on a
branch. **Do not merge that branch without the owner reading it.** The
owner has agreed the result gets published whatever it says, but wants
to see the number before it is public.

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
   by the glasses flag, since strong prescription lenses are this
   project's documented weak spot and one clip is annotated for it.
   Ground truth totals to check against: 8 clips, 408 annotated blinks,
   71,354 frames.

## Rules that still apply

Never push to main. Branch, pull request, green CI, then merge. Run
lint, typecheck, `npm test`, `npm run e2e` and, in `analysis/`, both
`ruff check` and `pytest` before opening anything.

Known issues: #15 (actions majors), #90 (calibrated off screen
boundary), #107 (backwards timestamps), #108 (log.md backfill), #115
(depth-qualified closure episodes)

Test count: 433 unit tests, 7 end to end tests across two browser
engines, 52 Python tests

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

DO NOT run the whole of DROZY. 36 clips of about ten minutes is roughly
648,000 frames, which at the measured 120 ms per frame is over twenty
hours. Two minutes from each clip is about 129,600 frames and four
hours, and the KSS rating is a single number for the whole session
anyway, so a two minute window carries exactly the same label as the
full ten.
