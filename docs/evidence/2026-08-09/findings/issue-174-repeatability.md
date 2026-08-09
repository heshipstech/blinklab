# Issue #174: the same clip measured twice gives different answers

This is the written record of what was measured on 9 August 2026. The files it
points at are in this folder.

## What was tested

One clip, `27122013_154548_cam`, 4,895 frames. It was measured four times on the
same computer, against the same built code, on the same web server.

Provenance was checked before any conclusion was drawn. The preview server
holding port 4173 was process 17034, started at 09:46:54. It served the bundle
`index-BPaEeGYT.js`. A bundle is the single JavaScript file the build produces.
That is the same bundle that produced the published run, whose first output file
is stamped 09:51:36. All four output files carry the same header lines:
`measurement_mode: stepped`, `frames_measured: 4895`, `measured_fps: 30.00`.

## What came back

| run               | detections | false alarms | precision for this clip       |
| ----------------- | ---------- | ------------ | ----------------------------- |
| the published run | 43         | 7            | 83.7%                         |
| re-run A          | 45         | 9            | 80.0%                         |
| re-run B          | 43         | 7            | 83.7%, 3 blink edges moved    |
| re-run C          | 43         | 7            | 83.7%, the same 3 edges moved |

Runs B and C agree with each other. Both disagree with the published run on three
blinks. Frames 2368 to 2374 became 2368 to 2375. Frames 2477 to 2484 became 2476
to 2484. Frames 4534 to 4546 became 4534 to 4545.

Per second, run A and run B disagree on `apertureMm` in 163 of 164 rows. The mean
absolute difference is 0.0128 mm and the largest is 0.478 mm. `blinkRatePerMin`
disagrees on 67 of 149 comparable rows, which is 45% of them.

## What it did to the headline

Re-run A was fed back into the corpus and the evaluator was run again.

```
published       recall 82.8%   precision 86.4%   F1 84.6%
with re-run A   recall 82.8%   precision 86.0%   F1 84.4%
```

F1 is the single number that puts recall and precision together. Recall did not
move in any run. Precision and F1 did. One clip out of eight was enough to move
the published headline.

## Likely cause, not yet proven

On main, `src/main.ts` hands the model the wall clock:

```js
const result = landmarker.detectForVideo(video, wallClockMs);
```

The comment above that line says MediaPipe uses the timestamp only to order
frames internally. So the same clip stepped twice presents a different sequence
of timestamps for identical frames, because no two runs take the same real time
per frame. The two runs of this clip took 89 seconds and 86 seconds. Feeding a
clock built from the frame number instead is the cheap test.

## Files in this folder that support it

- `../repeatability/published-run/` the published measurement of this clip.
- `../repeatability/re-run-A/`, `re-run-B/`, `re-run-C/` the three re-runs.

Each folder holds `.blinks.csv`, one row per detection, and `.seconds.csv`, one
row per second. Compare them with `diff` and the moved edges are visible.

## A correction to the issue text

Issue #174 describes two extra folders, `mixA` and `mixC`, as "two whole extra
corpus runs made the same day". They are not.

Each folder holds sixteen files, two for each of the eight clips. All sixteen
were compared byte for byte against the published run. In both folders fourteen
of the sixteen are identical to it. The two that differ are both for the same
clip, `27122013_154548_cam`. Every file in each folder also carries one single
timestamp, while a real corpus run writes timestamps staggered over about twenty
minutes.

So `mixA` and `mixC` are copies of the published run with one clip swapped in.
`mixA` holds re-run A, `mixC` holds re-run C. They were built to feed the
evaluator, and they are not evidence of anything the three re-run folders do not
already show. They were left out of this folder for that reason.

One more sentence in the issue is wrong for the same reason. It said `mixC`
matches the published run on 7 of the 8 clips and `mixA` does not. Both match on
7 of the 8. They differ from each other only in which re-run of the eighth clip
they carry.

The honest statement is that one clip out of eight has been tested for
repeatability. The other seven have never been tested at all. That is worse news
than the issue currently reads, not better.

## How to redo the headline arithmetic

The published run of all eight clips lives outside this repository, in the
`datasets/eyeblink8-measured-capfix/` folder on the maintainer's machine. To
repeat the shift above, copy that folder, copy `re-run-A/27122013_154548_cam.*`
over the matching two files in the copy, then run the evaluator:

```
cd analysis
PYTHONPATH="$PWD" .venv/bin/python tools/evaluate_eyeblink8.py \
  "<corpus folder>" "<the copied measurement folder>"
```
