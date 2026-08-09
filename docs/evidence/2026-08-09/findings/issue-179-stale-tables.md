# Issue #179: the per miss table describes the superseded run

This is the written record of what was checked on 9 August 2026, and of what this
folder does and does not hold.

## What is wrong

There is a good table that explains, blink by blink, why each missed blink was
missed. It describes the wrong run.

The file is `eyeblink8_misses.csv`. A CSV is a comma separated values file, a
plain text table. It has 124 data rows and 23 columns, one row per missed blink,
with a cause label on each row.

| cause label                           | rows |
| ------------------------------------- | ---- |
| `A_export_log_capped_at_50`           | 58   |
| `E_UNEXPLAINED_detector_did_not_fire` | 42   |
| `C_partial_blink_never_fully_closed`  | 15   |
| `B_closure_over_500ms_squint_gate`    | 7    |
| `D_warm_up_before_personal_baseline`  | 2    |

124 misses is the old run, the one this project has since retracted. The blink
log cap has been fixed, which removed the whole of category A, 58 rows. The
corrected run has 70 misses. Every CSV on disk was searched. There is no version
for the corrected run.

Two sibling files have the same problem. `eyeblink8_false_positives.csv` has 45
rows, matching the old run's 45 false alarms, not the corrected run's 53.
`eyeblink8_clip_summary.csv` sums to 284 true positives, which is the old total,
not 338.

The old table is internally sound for the run it describes. Its clip summary true
positives sum to 284, which matches the old published figure exactly. The problem
is only that the run it describes has been superseded.

## Why it matters

`README.md` on main publishes this sentence: "55 of the 70 missed blinks, 78.6%,
contain at least one frame the human marked as fully closed." That figure is
about the corrected run's 70 misses. The only row level table in existence covers
the old run's 124. So the published figure has no row level evidence a reader can
open and check.

The same gap hides the real remaining weakness. 42 of the old misses were
labelled `E_UNEXPLAINED_detector_did_not_fire`. After the cap fix they are the
majority of what is left. Nobody knows how many of the current 70 fall into that
bucket.

## What is in this folder

- `../tables/eyeblink8_clip_summary.csv`, 8 rows, one per clip.
- `../tables/eyeblink8_false_positives.csv`, 45 rows, one per false alarm.
- `../scripts/tables/autopsy.py`, `breakdown.py` and `finalise.py`, the three
  scripts that built all three tables. This is the part that stops the problem
  coming back. Issue #179 asks for exactly this.

## What is not in this folder, and why

`eyeblink8_misses.csv` is **not** committed.

Its rows are the Eyeblink8 blink intervals the human marked: blink number, start
frame, end frame, length in frames, and how many of those frames were fully
closed. That is a copy of part of the corpus's own annotation, for 124 blinks.

`DATASETS.md` says the Fogelton and Benesova benchmark set, which includes
Eyeblink8, is stated GPL3, and that "GPL3 on video data is legally unusual and
its copyleft would need thought before publishing derived files". That thought
has not been done. This repository is public and MIT licensed, so a wrong answer
here is not cheap to undo, because git keeps every file forever.

The other two tables do not have this problem. `eyeblink8_false_positives.csv`
holds the app's own false detections, and its only annotation derived column is a
distance in frames to the nearest marked blink. `eyeblink8_clip_summary.csv`
holds per clip counts, which the repository already publishes in
`docs/eyeblink8-result.txt`.

The miss table can be rebuilt whenever the licence question is answered. The
corpus is a free download and the script is here. From the analysis folder:

```
cd analysis
PYTHONPATH="$PWD" .venv/bin/python \
  ../docs/evidence/2026-08-09/scripts/tables/autopsy.py
```

The three scripts carry absolute paths from the machine they were written on.
Each one begins with a folder path to edit. See the folder README for the rule.
