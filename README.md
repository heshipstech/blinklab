# blinklab

[![CI](https://github.com/heshipstech/blinklab/actions/workflows/ci.yml/badge.svg)](https://github.com/heshipstech/blinklab/actions/workflows/ci.yml)

A browser based eye signal laboratory. It reads your webcam locally. It turns what your eyes are doing into numbers you can audit: blinks, eyelid aperture in millimetres, gaze regions, fixations, PERCLOS (the share of a minute your eyes spend closed), and an explainable alertness score.

> **Demo, not a safety or medical device. This is a learning project. It is not for clinical, workplace or safety use, its numbers are not diagnostic, and it has not been validated against any medical standard. All processing happens in your browser and no data leaves your device.**

**Live demo: https://heshipstech.github.io/blinklab/**. It is republished automatically on every merge to main. You need a webcam and a browser that allows camera access.

## What it measures

Every number on screen comes from a tested pure function, and every threshold is calibrated against measured data rather than copied from a paper.

- **Blinks**: count, rate per minute, closed-phase duration, closing velocity and the amplitude over velocity ratio.
- **Eyelid aperture in millimetres**, normalised by the iris as a physical ruler, so the reading survives moving closer to or further from the camera.
- **Gaze**: iris offset per eye, screen quadrant, on screen versus off, nine point calibration, fixations and saccades, a dwell heatmap and a scanpath replay.
- **PERCLOS**, the eyes closed share of the last minute, and a long closure detector with a debounced alert.
- **An alertness score, 0 to 100**, that shows its working: it is exactly 100 minus four named penalties, and a panel names the ones that cost you points.
- **A CSV export** (comma separated values, a file a spreadsheet can open) of one record per second, plus a Karolinska Sleepiness Scale self report, for offline analysis.
- **A recorded clip**, not only a live camera. Upload a video file and it runs through exactly the same pipeline, timed by the clip's own clock rather than the wall clock, so the measurements mean the same thing either way.

## Honest limitations

This project's rule is that a limitation you know about belongs in the open.

- Thresholds are personal and learned per session. They are priced against **one** person's measured eyes so far, so another face may need different ones.
- Strong prescription glasses compress and distort the gaze signal near the edges of the screen, so calibrated gaze is reliable in the middle and degrades at the corners.
- The instrument reads fully shut eyes as roughly a third of the open baseline rather than zero, so the literature's usual PERCLOS threshold does not transfer and ours is adjusted to the instrument. This is documented rather than hidden.
- Known open defects live in the [issue tracker](https://github.com/heshipstech/blinklab/issues), including one where an unusually high learned baseline inflates blink durations.
- Self reported sleepiness is a noisy label, and there is no objective validation of the score yet. Earning that is what Phase 7 is for.
- An uploaded clip can be measured two ways and the file records which. Stepped is the default. It seeks to every frame in turn and waits for the measurement. So which frames it measures depends on the recording, not on your computer. It still does not give exactly the same answer twice. The section below on the Eyeblink8 clips says by how much. Watched plays in real time and is capped by how fast the model runs. So a fast clip loses frames, and how many depends on what else your machine is doing. Watching is offered because stepping is slow and unpleasant to film. Every export states its mode, the frames measured and the resulting rate. The app also reports the rate it detected, so you can check it against a clip you know.

## Does it find the blinks a human found?

This is the first time anything here has been measured against somebody
else's work. Eyeblink8 is a public set of eight webcam clips. A person
watched all of them and marked every blink by hand. They marked 408
blinks. This app was given the same clips and had to find the same
blinks.

The set holds 71,354 frames, counting the rows of the annotation files
that came with the clips. Other sources give other totals for this same
set, so this page says which count it used.

|              | First answer, wrong | Corrected               |
| ------------ | ------------------- | ----------------------- |
| Blinks found | 284 of 408          | **338 of 408**          |
| Recall       | 69.6%               | **82.8%**               |
| Precision    | 86.3% (45 invented) | **86.4%** (53 invented) |
| F1           | 77.1%               | **84.6%**               |

Recall is the share of the human's blinks that the app found. Precision
is the share of the app's detections that were real. F1 is the two
numbers put together into one. It always sits close to the lower of the
two. So an app cannot look good by staying quiet, and it cannot look
good by firing all the time.

The corrected run invents more blinks, 53 against 45, and does not
score worse on precision. That is because it makes many more detections
in total, so the invented ones are a smaller share of them.

**One caveat about the last digit.** These are one run, not a fixed
value. The same clip measured again on the same computer with the same
build does not give exactly the same answer. Re-measuring one of the
eight clips changed its false alarms from 7 to 9. Carried into the
totals that reads 86.0% precision and 84.4% F1 instead of 86.4% and
84.6%. Recall did not move in any re-run. Read the last digit of
precision and F1 as approximate, and read recall as solid.

There are two columns because the first answer was wrong. It was wrong
because of a defect in this app. The clips were not the cause. The
first write up of this result was never published on this page. Both
numbers stay here. A project that shows you only its final answer tells
you less than one that also shows you its wrong turn.

**The defect, in plain English.** The app keeps a list of the blinks it
has found, and that one list was doing two jobs. It was the list you
read on screen. To keep the panel short, it held only the newest fifty
detections. It was also the record written into the exported file. So
trimming for the reader trimmed the measurement. Two of the eight clips
hold more than fifty blinks, 88 in one and 72 in the other. In both, the
opening stretch of blinks was deleted before the file was written.
Nothing announced it. The score then said the app had missed those
blinks. It had not missed them. It found them, then threw them away.
There are two lists now. One is for the screen and one is for the
record. The exported file also counts its own rows and compares them
against the number of blinks the app found. If any are missing, it
prints a warning on the first line. Fixed in pull request #172.

**The corrected number is honest, and it is still not good enough.** It
misses roughly one blink in six. Other people have measured their own
detectors on these same clips, and here is what they report.

| who                                                                                        | year | where                                              | F1    |
| ------------------------------------------------------------------------------------------ | ---- | -------------------------------------------------- | ----- |
| [Drutarovsky and Fogelton](https://link.springer.com/chapter/10.1007/978-3-319-16199-0_31) | 2014 | ECCV workshops, Springer LNCS 8927, 436 to 448     | 82.0% |
| [Fogelton and Benesova](https://doi.org/10.1016/j.cviu.2016.03.011)                        | 2016 | Computer Vision and Image Understanding 148        | 91.6% |
| [Soukupova and Cech](https://cmp.felk.cvut.cz/ftp/articles/cech/Soukupova-TR-2016-05.pdf)  | 2016 | Czech Technical University report CTU-CMP-2016-05  | 95.2% |
| [Fogelton and Benesova](https://doi.org/10.1016/j.cviu.2018.09.006)                        | 2018 | Computer Vision and Image Understanding 176 to 177 | 91.3% |
| **this app**                                                                               | 2026 | this page                                          | 84.6% |

ECCV is the European Conference on Computer Vision. The 2014 paper
prints precision 79.0% and recall 85.27% and no F1, so the 82.0% above
was worked out from those two numbers here. The other three print F1
themselves.

So published scores on these clips run from about 82% to about 95%, and
this app sits near the bottom of that spread. It is above the oldest of
them and below every modern one.

Only those four are listed because only those four were read in full.
Other papers report scores on these clips as well. Several of those
numbers could only be found quoted inside somebody else's summary table,
not in the paper itself, so they are not on this page.

**Read that gap as real but rough.** Every paper counts blinks its own
way. Fogelton scores each eye separately, so his blink total for these
clips is 804 and not 408, and he counts a fast double blink as one.
Soukupova and Cech report the best point on their own curve, chosen on
the test data itself. Fogelton published these clips, and he writes on
his own site that comparing across papers is "not valid", because the
annotation and the scoring differ between them. That warning is from the
person who owns the benchmark, so it is quoted here rather than buried.

**One more warning.** Some published scores on these clips are near 98%.
Those are measured per frame, not per blink. They ask "were the eyes shut
in this frame". This app is measured per blink, one detection matched to
one mark a human made. The two are not the same test and the numbers
cannot be put side by side.

Per clip recall now runs from 67.7% to 91.7%. The whole gain sits in the
two clips the defect had cut short. One moved from 55.7% to 89.8% and
the other from 58.3% to 91.7%. That is 30 blinks recovered in one and 24
in the other, 54 in total, which is the entire move from 284 to 338.
Every other clip found exactly the same number of blinks in both runs.

**One caveat about comparing the two runs.** They were built from
different commits, so they are not the same measurement with a single
line changed. Four of the six shorter clips shifted the edges of a blink
by a frame or two, or split one detection into two. The other two report
exactly the same blink timings. One correction to the story above. The
cap counted detections, not the human's blinks. So it bit a third clip
too, `27122013_152435_cam`, which filled all fifty rows of its export.
How many rows that clip lost cannot be recovered. The capped export is
the only surviving record of that run, and it holds fifty rows whatever
number was cut from the front of it. What is certain is that the rows it
lost were false alarms and not blinks the human had marked. That clip is
scored as finding the same 36 blinks in both runs, so nothing the cap
deleted cost it a single one. No recall figure on this page changes for
it. What the defect explains is the recall, exactly and entirely: 30
recovered blinks in one clip, 24 in the other, and not one anywhere
else. Fixing it also surfaced 8 more invented blinks, 45 to 53, and
seven of those are in the two recovered clips.

The clips were checked, frame by frame, before any of this was blamed on
them. The recordings freeze here and there and lose frames. Every clip
ships a `.txt` file listing the time of each frame it kept, so anyone
can count the losses. Here is the rule used. At 30 frames per second one
frame lasts 0.033 seconds. Round each gap between two kept frames to a
whole number of frame lengths. Anything above one is a lost frame. Under
that rule the eight clips lose 787 frames between them, spread over 174
gaps. That is 1.1% of every frame in the set. Twelve of those gaps are
long freezes of half a second or more. Those twelve sit in three clips
and hold 611 of the 787 lost frames. Very few gaps land inside a blink.
At the very most the lost frames explain 4 of the 70 remaining misses.
The script that counts all of this is
[analysis/tools/audit_frame_loss.py](analysis/tools/audit_frame_loss.py),
so you do not have to take the number on trust. Three more checks came
back clean. In all eight clips the person faces the camera in every
single frame. No blink the human marked is shorter than 4 frames, so
none of them are too quick to catch.

A small picture is not the excuse either, and here is the check with the
rule that produces its number. Cut a small grey box around each eye on
every frame, using the eye corners the human marked. Measure how far
each frame differs from the middle open eye picture. Divide each blink's
strongest frame by how much that measure wobbles on the frames that are
not blinks. That is a blink's strength. Take the middle blink of each
clip. Now shrink each eye box to a quarter of its width and a quarter of
its height, which keeps one pixel in sixteen and throws away about 94 in
every 100. Then work out the change per clip and average the eight
clips.

Averaged over the eight clips, blink strength went **up** by 2.7%. It
did not fall. The eight clips do not agree with each other. Five rose,
two fell a little, and one did not move at all. Averaging neighbouring
pixels together removes more noise than it removes signal, which is why
throwing away 94 pixels in every 100 left the blink no harder to see.

Two things that result does not show. The eye boxes were shrunk, not the
whole video. And it measures the pixels of the clips, not this app. It
rules out a picture too small to contain a blink. It does not show that
this app's own eyelid measurement survives a smaller picture, which is a
separate question and an open one. The script and every reading behind
the figure are in
[docs/evidence/2026-08-09/scripts/checks/resolution_snr.py](docs/evidence/2026-08-09/scripts/checks/resolution_snr.py)
and
[docs/evidence/2026-08-09/tables/resolution_snr.txt](docs/evidence/2026-08-09/tables/resolution_snr.txt).
The clips are not the excuse.

**A claim from the first write up is withdrawn.** One of the eight clips
shows a person wearing glasses. The first write up said that clip scored
83.7% recall, against 67.9% for the seven clips without glasses. It read
that as evidence against this project's own warning about prescription
lenses. That gap was not real. The defect created it. Both of the cut
short clips were in the group without glasses, so that group's score was
pulled down. On the corrected run the glasses clip scores 83.7% recall
and 83.7% precision. The seven without score 82.7% recall and 86.8%
precision. So recall is one point apart, and precision is three points
apart in the other direction. Both figures rest on a single clip of 43
blinks, and both settle nothing in either direction. So the claim is
withdrawn rather than reversed. This project has no evidence yet about
what glasses do to blink detection.

There is a version of this result that reads better, and it is not
printed here. Leave out the blinks the human marked as long closures and
recall rises. Leave out the partial blinks as well and it rises again.
Carry the same reasoning one step further and it rises further still, by
leaving out the blinks the detector missed. Every step sounds defensible
on its own. That last step shows where this reasoning ends up, and it is
plainly cheating. So none of those numbers are on this page, including
the two a reader might have accepted.

**The misses have a pattern.** 55 of the 70 missed blinks, 78.6%,
contain at least one frame the human marked as fully closed. These are
not faint or borderline blinks. They are ordinary ones where this app's
eyelid measurement did not dip far enough to count. That is a real
weakness. Finding out why is the next question.

**The invented blinks have a pattern too.** 38 of the 53 land on top of
a real blink rather than on an open eye. That is one blink counted
twice, not a blink imagined from nothing.

A number like that means nothing without the rule that produced it, so
here is the rule. Take the detection exactly as the app reported it and
widen nothing. If it shares at least one frame with a blink the human
marked, it landed on a real blink. Anyone can check that against the
clips' own annotation files.

There is a second and looser rule, and it gives 45 of the 53. Widen the
detection by four frames at each end first, then ask the same question.
Four frames is about 130 milliseconds at 30 frames per second, and it is
the slack this project already allows itself when deciding which
detections count as correct. That slack exists to stop a correct
detection being punished for disagreeing about an edge. Reusing it to
decide what a wrong detection sat on is a different act, so the stricter
38 is the number printed first. Both are here because 45 is the
flattering one and hiding it would be its own kind of dishonesty. Seven
detections sit between the two counts. All seven are short, and all
seven lie within four frames of a real blink. Five are in one clip and
two are in another.

8 of the 53 are more than four frames away from any blink the human
marked. That count is the same under both rules, and it is the one the
argument actually rests on.

41 of the 53 are three frames long or shorter. The rule there is to
count from the detection's first frame to its last, including both, so
frames 10 to 12 is three frames. This page used to say half of them were
that short. That was wrong. The true share is higher.

A refractory period, a short window after a blink in which a second one
cannot be reported, should remove most of them. It is planned and it is
not built. The script behind all of these counts is
[docs/evidence/2026-08-09/scripts/checks/false_positive_overlap.py](docs/evidence/2026-08-09/scripts/checks/false_positive_overlap.py),
and its output is
[docs/evidence/2026-08-09/tables/false_positive_overlap.txt](docs/evidence/2026-08-09/tables/false_positive_overlap.txt).

The rules for what counts as a correct detection were written down
before any result was seen. They are in
`analysis/blinklab/blink_match.py`. Each detection can be matched to at
most one real blink. So an app that fired all the time would score
badly, not perfectly. The blinks from all eight clips are added into one
total, instead of averaging each clip's score. So a clip with 30 blinks
counts for less than a clip with 88. Every clip was measured frame by
frame, and the frame counts were checked against the source. The app
measured 71,356 frames against the 71,354 in the human's files. Two
clips gave one frame more than their file lists. Every other clip
matched exactly.

Full output, including the superseded numbers, in
[docs/eyeblink8-result.txt](docs/eyeblink8-result.txt).

## Does it give the same answer twice?

A measuring instrument that answers differently on different computers is
not measuring the thing. So the same 70 second recording was run through
two browser engines on one machine, stepping every frame:

|                     | Chrome     | Safari     |
| ------------------- | ---------- | ---------- |
| Frames measured     | 4,202      | 4,203      |
| Frame rate detected | 59.99      | 60.00      |
| Long closures found | 1          | 1          |
| PERCLOS peak        | 34.3%      | 34.5%      |
| Eyes shut           | 49 to 58 s | 49 to 58 s |

The file contains 4,202 frames. **Blink rate per minute was identical in
both browsers to the last decimal**, across all 71 seconds. That is one
70 second clip and it is not the whole story. On the eight clips above
the app does not repeat itself exactly from one run to the next. See the
caveat about the last digit. Eyelid aperture differed by 0.02 mm on
average and the learned personal baseline by 0.4 percent, which is what
sampling a frame a fraction earlier during a blink costs.

This is worth stating because the first version of stepped measurement
failed it badly, and failed it invisibly. It played the clip and paused
on each frame, which cannot outrun a video advancing in real time, so it
measured 6,655 frames of a 12,626 frame recording and reported "measured
every frame". How many it lost depended on how busy the machine was. The
current version seeks to each frame instead, so it measures every frame
however busy the machine is.

Safari's extra frame was the final one counted twice, which is fixed.

## Privacy

Everything runs in your browser. No video, image or measurement ever leaves your device. There is no backend, no analytics and no telemetry. The CSV export writes a file to your own disk and uploads nothing.

## Status

Phases 0 through 6 are complete: foundations, pixels, landmarks, measurement, blinks, gaze and attention, and the rolling state with the demo score. Phase 7, the honest evaluation track, is under way: a Python analysis folder, a session loader and plots, a licensing gate, and video upload mode so a recorded clip runs through the same pipeline as the live camera. That is 442 unit tests, 7 end to end tests and 61 Python tests plus 2 skipped, all green on every pull request.

**The licensing gate failed, and that is written down rather than hidden.** [DATASETS.md](DATASETS.md) records roughly forty public datasets assessed against four requirements: face video, a real drowsiness label, per-clip subject identity, and a licence a solo maintainer can rely on in a public repository. None clears all four. The failure turned out to be structural: the openly licensed drowsiness data is physiological traces, still images or synthetic renders, while every video corpus carrying a real sleepiness label is behind a signed agreement, an institutional email check, a non-commercial clause, or no licence at all. Face video is personal data, and the anonymisation that would let a team release it freely is exactly what destroys the per-subject identity a leave one subject out split needs.

So the evaluation track was replanned rather than abandoned. The next result is blink detection measured against an openly licensed corpus with ground-truth blink intervals, which is a smaller claim than a drowsiness classifier and one this project can actually defend.

## How to run

You need Node.js 20 or newer.

```
git clone https://github.com/heshipstech/blinklab.git
cd blinklab
npm install
npm run dev
```

Open the local URL that Vite prints, then allow camera access.

`npm test` runs the unit tests. `npm run e2e` runs the end to end tests, which drive the built app in a headless browser with a fake camera; the first run needs `npx playwright install chromium`.

## How this repo works

The project grows one small increment per session, each one branch, one pull request, one push, each with a written note explaining the idea in plain English. The working documents:

- [PROJECT.md](PROJECT.md), what this is and why.
- [SPEC.md](SPEC.md), the technical contract, including the FeatureRecord, score and CSV contracts.
- [ROADMAP.md](ROADMAP.md), the full increment ladder and its accepted amendments.
- [STATE.md](STATE.md), where things stand right now.
- [LEARNING.md](LEARNING.md), one plain English engineering note per increment, including the ones that record a mistake.
- [docs/UI.md](docs/UI.md), every element the page can show, when it appears, and every string it can contain.
- [test/MANUAL.md](test/MANUAL.md), the checks a machine cannot run, because a headless browser has no face.
- [decisions/](decisions/), architecture decision records.

## License

MIT, with a not a medical device notice. See [LICENSE](LICENSE).
