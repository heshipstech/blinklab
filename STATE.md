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
`<name>.seconds.csv`, into that folder. Eight clips, expect roughly two
and a half hours. It needs `npm run preview -- --strictPort` alive on
port 4173; if that died, the run failed and the log will say so.

Restart it with:

    npm run build && npm run preview -- --strictPort &
    node tools/measure_corpus.mjs \
      "/Users/evannorus/Desktop/blinklab build/datasets/eyeblink8-mp4" \
      "/Users/evannorus/Desktop/blinklab build/datasets/eyeblink8-measured"

## What is left to produce the Track A number

The pieces all exist. What does NOT exist yet is the script that joins
them, and that is the next thing to write:

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
5. Put the result in the README including whatever is unflattering.

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
