# Evidence for issues #174 to #179, gathered 9 August 2026

Six issues were filed on 9 August 2026. They all pointed at a folder on one
laptop that was never in version control and could have been deleted at any time.
This folder is that evidence, curated and moved into the repository, so the six
issues keep working after the laptop folder is gone.

The original folder was 342 MB. This folder is 37 files and about 257 KB. Git
stores it compressed, at about 86 KB. The section
[What was left out](#what-was-left-out) says what went and why.

## Read this first

Every file here is numbers or text. There is no image, no video frame and no
photograph of anybody, anywhere in this folder. That is a rule, not an accident.
See [Licence and privacy](#licence-and-privacy).

Nothing here is an agent transcript. The six issues cite four workflow journals,
which are full transcripts of a working session. Those are not committed. See
[What was left out](#what-was-left-out) for the reason and for what replaced
them.

## What is in each folder

### `findings/`

One plain English page for each issue. Each page says what was measured, what the
numbers were, and which files here support it. These pages replace the workflow
journals the issues cite.

| file                                     | supports |
| ---------------------------------------- | -------- |
| `issue-174-repeatability.md`             | #174     |
| `issue-175-stale-server.md`              | #175     |
| `issue-176-double-counting.md`           | #176     |
| `issue-177-broken-python-environment.md` | #177     |
| `issue-178-max-blink-duration.md`        | #178     |
| `issue-179-stale-tables.md`              | #179     |

`issue-174-repeatability.md` also corrects one statement in issue #174 itself.
Two folders that issue calls "two whole extra corpus runs" are copies of the
published run with one clip swapped in. Read that page before trusting the issue
on this point.

### `repeatability/`, for issue #174

One clip, `27122013_154548_cam`, measured four times on the same computer against
the same built code.

| folder           | what it is                                |
| ---------------- | ----------------------------------------- |
| `published-run/` | the measurement the project published     |
| `re-run-A/`      | the first re-run, 45 detections, 9 false  |
| `re-run-B/`      | the second re-run, 43 detections, 7 false |
| `re-run-C/`      | the third re-run, 43 detections, 7 false  |

Each folder holds two files, each about 4 KB and 28 KB.

- `27122013_154548_cam.blinks.csv` is one row per detection: the start frame, the
  end frame, the length, and how deep and fast the blink was.
- `27122013_154548_cam.seconds.csv` is one row per second of the clip: the eyelid
  opening in millimetres, the learned baseline, the blink rate per minute and the
  rest of the live readings.

CSV means comma separated values, a plain text table. Compare any two of these
folders with `diff` and the disagreement is visible in seconds.

### `tables/`, for issues #176 and #179

| file                            | rows | what it is                                       |
| ------------------------------- | ---- | ------------------------------------------------ |
| `eyeblink8_clip_summary.csv`    | 8    | one row per clip, with the counts for the run    |
| `eyeblink8_false_positives.csv` | 45   | one row per false alarm, each with a cause label |

Both describe the **first** corpus run, which has since been superseded. That is
the whole point of issue #179. Keep them as the record of what the blink log cap
fix changed. Do not read either as current.

Most rows of the false alarm table carry the label `double_fire_on_a_real_blink`.
That is the evidence for issue #176.

The third table of the set, `eyeblink8_misses.csv`, is deliberately not here.
See [Licence and privacy](#licence-and-privacy).

### `scripts/`, for issues #176, #178 and #179

These make the findings reproducible. They are the reason this folder is worth
having at all.

| folder    | what it does                                                       |
| --------- | ------------------------------------------------------------------ |
| `tables/` | builds the three analysis tables. Issue #179 asks for exactly this |
| `replay/` | the Python reimplementation of the detector, and its experiments   |
| `checks/` | three independent cross checks of the published numbers            |

`scripts/tables/` holds `autopsy.py`, which builds the miss table,
`breakdown.py`, which counts the causes, and `finalise.py`, which adds the cause
label column.

`scripts/replay/` holds the reimplementation described in issue #176.
`trace.py` reads the video and writes the eyelid opening for every frame.
`sim.py` is the app's blink state machine ported to Python line for line.
`verify.py` checks the port against the app's own exported numbers.
`exp.py` through `exp7.py` are the experiments, including the
`MAX_BLINK_DURATION_MS` sweep behind issue #178. `misses.py` and `probe.py`
support both.

`scripts/checks/` holds `indep_eval.py`, an evaluator written from scratch that
does not import the project's own matching code, `diffruns.py`, which compares
two measurement folders detection by detection, and `gap_ceiling.py`, which puts
a ceiling on how much of the miss rate dropped capture frames could explain.

**Before running any script, edit the folder path at the top.** These were
written on one laptop and they carry absolute paths. Every such path was replaced
with `/PATH/TO/`, so the scripts will not run until you point them at your own
copy of the `blinklab` folder and of the corpus. That was done on purpose. See
[Licence and privacy](#licence-and-privacy).

### `run-logs/`, for issue #175

Two logs, 857 bytes each.

| file                                | what it is                           |
| ----------------------------------- | ------------------------------------ |
| `corpus-run-01-39-stale-server.txt` | the run that measured the wrong code |
| `corpus-run-10-07-corrected.txt`    | the run that measured the right code |

Open them side by side. They look almost the same, and both end with
`done. 8 measured, 0 failed.` Nothing in either names the build. That is the
whole of issue #175 in two small files.

They were renamed from `.log` to `.txt` because `.gitignore` refuses every file
ending in `.log`.

## What was left out

The original folder was 342 MB. Everything below was excluded on purpose.

| what                           | size   | why it is not here                                                                                                                                                                                     |
| ------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scratchpad/mpvenv/`           | 300 MB | a throwaway Python sandbox holding MediaPipe and OpenCV. It is a copy of public packages, it is machine specific, and it is rebuilt in one command                                                     |
| `scratchpad/code/traces/`      | 20 MB  | the eyelid opening for all 71,354 frames of the corpus, as raw traces. Regenerate with `scripts/replay/trace.py`                                                                                       |
| `workflow-journals/`           | 11 MB  | full agent transcripts. See below                                                                                                                                                                      |
| `scratchpad/drozy1/1-1.edf`    | 7 MB   | one physiological recording from the DROZY dataset. It is not cited by any of the six issues, and DROZY has its own licence terms                                                                      |
| `scratchpad/code/floors.json`  | 1.2 MB | an intermediate result of the replay. Regenerate with `scripts/replay/exp.py`                                                                                                                          |
| `scratchpad/mixA/` and `mixC/` | 920 KB | copies of the published run with one clip swapped in. Fourteen of their sixteen files duplicate the published run byte for byte. Nothing in them that the `repeatability/` folders do not already show |
| about 60 further probe scripts | small  | one off scripts that answered a question and were not cited by any issue                                                                                                                               |

### Why the workflow journals are not here

The six issues cite four workflow journals as their evidence. A journal is the
full transcript of an agent working session.

They were read before this decision was made. They carry no key and no token. They
carry a great deal of personal content. Counted across the four journals:

| what is in them                                       | how often   |
| ----------------------------------------------------- | ----------- |
| the maintainer's macOS account name inside file paths | 5,489 times |
| the maintainer's personal email address               | present     |
| the name of a professor at another university         | 14 times    |
| a picture, stored inside the text as encoded data     | 1           |

The picture is worth its own sentence, because it is the one thing that would
have broken a rule outright. One sub-agent transcript inside
`wf_6866333f-dc5/` holds a JPEG of 111,410 bytes, 750 by 1,624 pixels, encoded as
text so that nothing on disk looks like an image file. `DATASETS.md` allows
numbers and never a frame. A transcript that quietly carries a picture cannot be
published under that rule, and no search for image files would have found it.

Beyond those counts the journals hold a great deal about one working day on one
laptop: quoted messages from the maintainer, an audit of promises he made and did
not keep, private correspondence with that professor, unanswered decisions, local
machine state, and the contents of private notes. This repository is public.

The rule applied here is simple and it is applied to all four journals equally:
**no agent transcript is committed.** The findings the six issues rest on were
written out instead, in `findings/`, in plain English, with the numbers intact.

The journals stay on the maintainer's machine, in
`artifacts-2026-08-09/workflow-journals/`, outside version control. If a specific
passage is ever needed in public, it can be quoted into an issue after being
read.

### How to rebuild the two big things

The eyelid trace for the whole corpus, 20 MB:

```
cd analysis
~/.local/bin/uv venv --python 3.12 /tmp/mpvenv
/tmp/mpvenv/bin/pip install mediapipe opencv-python numpy
/tmp/mpvenv/bin/python ../docs/evidence/2026-08-09/scripts/replay/trace.py
```

`trace.py` reads the project's own model file at
`public/models/face_landmarker.task` and the corpus videos. It writes one JSON
file per clip. On the machine it was written on it ran at about 235 frames per
second, so the whole corpus takes roughly five minutes.

The miss table, `eyeblink8_misses.csv`:

```
cd analysis
PYTHONPATH="$PWD" .venv/bin/python \
  ../docs/evidence/2026-08-09/scripts/tables/autopsy.py
```

Both need the corpus and a measurement folder. Edit the paths at the top of the
script first.

## Licence and privacy

Three checks were run over every file before it was committed here.

**No frames.** `DATASETS.md` is strict about this. For every corpus the rule is
numbers only, never a frame. Every byte of every file in this folder was counted.
Every one is a plain readable character. Not one byte is above 127, so no
picture, no video and no encoded picture can be hiding in here. You can repeat
that check yourself from the top of the repository:

```
find docs/evidence -type f -print0 | xargs -0 cat | LC_ALL=C tr -d '\000-\177' | wc -c
```

It should print `0`.

**No personal paths.** The account name of the machine these files came from
appears nowhere. Project folder paths were replaced with `/PATH/TO/`. Temporary
session folders were replaced with `/PATH/TO/output-folder`. Home folder paths
were replaced with `~`, which names no person. This is why the scripts need a
path edited before they run. No email address, key or token appears in any file.

**One file held back on licence grounds.** `eyeblink8_misses.csv` is not
committed. Its rows are the blink intervals a human marked in the Eyeblink8
videos, so it is a partial copy of the corpus's own annotation rather than a
measurement this project made. `DATASETS.md` records that the benchmark set is
stated GPL3, and that "GPL3 on video data is legally unusual and its copyleft
would need thought before publishing derived files". That thought has not been
done. This repository is public and MIT licensed, and git keeps every file
forever, so the reversible choice was taken. The script that rebuilds the table
is here, and the command is above.

The other files pass that same test, and here is the exact reason for each.

- The `repeatability/` files are this app's own output. Nothing in them comes
  from the corpus except the clip name.
- `eyeblink8_false_positives.csv` has one row per detection the app made in
  error. The rows are the app's own. Five of its twenty columns are derived from
  the corpus: `overlapsNF`, `startTimeSeconds`, the two
  `maxInterFrameGap` columns and `framesToNearestAnnotatedBlink`. Each is a
  single number about one of the app's own detections. Together they cannot
  rebuild the marked blink intervals, which is what the licence question is
  about.
- `eyeblink8_clip_summary.csv` is per clip counts. `docs/eyeblink8-result.txt`
  on main already publishes the same kind of counts for the same eight clips.

## What each issue used to cite, and what it cites now

The six issues were filed pointing at a folder on one laptop. Their Evidence
sections were rewritten to point here instead. This table is the record of that
move, so a reader can check it.

| issue | it used to point at                                                           | it now points at                                                      |
| ----- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| #174  | two workflow journals, `scratchpad/detA/`, `detB/`, `detC/`, `mixA/`, `mixC/` | `findings/issue-174-repeatability.md`, `repeatability/`               |
| #175  | one workflow journal, `/tmp/corpus.log`, `/tmp/corpus-rerun2.log`             | `findings/issue-175-stale-server.md`, `run-logs/`                     |
| #176  | one workflow journal, `scratchpad/eyeblink8_false_positives.csv`              | `findings/issue-176-double-counting.md`, `tables/`, `scripts/replay/` |
| #177  | two workflow journals, and paths inside one home folder                       | `findings/issue-177-broken-python-environment.md`                     |
| #178  | one workflow journal                                                          | `findings/issue-178-max-blink-duration.md`, `scripts/replay/`         |
| #179  | one workflow journal, `scratchpad/eyeblink8_misses.csv` and its two siblings  | `findings/issue-179-stale-tables.md`, `tables/`, `scripts/tables/`    |

Two things changed in the issue text beyond the paths.

1. #174 dropped its claim that `mixA` and `mixC` are two extra corpus runs. They
   are not. See `findings/issue-174-repeatability.md`.
2. #179 points at the script that rebuilds `eyeblink8_misses.csv` rather than at
   the table, because the table is held back on licence grounds.
