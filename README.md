# blinklab

[![CI](https://github.com/heshipstech/blinklab/actions/workflows/ci.yml/badge.svg)](https://github.com/heshipstech/blinklab/actions/workflows/ci.yml)

A browser based eye signal laboratory. It reads your webcam locally. It turns what your eyes are doing into numbers you can audit: blinks, eyelid aperture in millimetres, gaze regions, fixations, PERCLOS (the share of a minute your eyes spend closed), and an explainable alertness score.

> **Demo, not a safety or medical device. This is a learning project. It is not for clinical, workplace or safety use, its numbers are not diagnostic, and it has not been validated against any medical standard. Your video and your measurements never leave your browser. The face model this page bundles does send anonymous usage statistics to Google.**

> Revised 2 September 2026, against the state of `main` on that date. When this file changes, this stamp changes with it; a test enforces that.

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

- Thresholds are personal and learned per session, and the six-person validation round measured what that costs: on three of six volunteers' machines the learned baseline was unusable, one drifting during the measurement itself, one drifting before it, one landing too long. The round's pre-registered baseline criterion FAILED. Full table and write-up in `docs/validation-round.txt`.
- Strong prescription glasses compress and distort the gaze signal near the edges of the screen, so calibrated gaze is reliable in the middle and degrades at the corners.
- The instrument reads fully shut eyes as roughly a third of the open baseline rather than zero, so the literature's usual PERCLOS threshold does not transfer and ours is adjusted to the instrument. This is documented rather than hidden.
- Known open defects live in the [issue tracker](https://github.com/heshipstech/blinklab/issues), including one where an unusually high learned baseline inflates blink durations.
- **How many blinks it finds depends on how fast your computer is.** The page processes frames as fast as the face model can run, not as fast as the camera delivers them. Measured on 17 August: two four-core machines ran at 29 to 32 frames per second while a twelve-core machine ran at 127, on cameras that all declare 30. In the same scripted test the four-core machines found 7 and 9 of ten deliberate blinks and the twelve-core machine found all ten. A firm blink is caught at any of those rates; the ones at risk are shallow or quick, and for those the odds run from about half at 25 frames per second to certain at 60. Since 20 August 2026 the page warns when its processing rate sits below 60 frames per second, stating the machine's own number and that the camera is not the cause. _Corrected 24 August 2026, and the sentence before this one stays as the record of what was believed:_ the first delivered-rate measurement — an M5 Max processing 120 frames per second on a camera delivering 30, reading exactly the 30 the camera handed it — showed the computer is the limit only up to what the camera delivers. The warning now judges the measured rate of distinct camera frames read and names whichever side binds; on that machine the old warning was silent while the instrument sat squarely in the risk band. Measured in `docs/blink-sample-rate.txt` and `docs/validation-dry-run.txt`.
- Self reported sleepiness is a noisy label, and there is no objective validation of the score yet. Earning that is what Phase 7 is for.
- An uploaded clip can be measured two ways and the file records which. Stepped is the default. It seeks to every frame in turn and waits for the measurement. So which frames it measures depends on the recording, not on your computer. Until pull request #189 it still did not give exactly the same answer twice, because the face model was handed a wall clock reading and uses the gap between readings to follow a face. It now measures the same clip identically, byte for byte. Watched plays in real time and is capped by how fast the model runs. So a fast clip loses frames, and how many depends on what else your machine is doing. Watching is offered because stepping is slow and unpleasant to film. Every export states its mode, the frames measured and the resulting rate. The app also reports the rate it detected, so you can check it against a clip you know.

<!-- results:begin -->
<!-- Generated from the committed result files by
tools/resultsBlock.mjs. Edit those files, then regenerate with:
npm run results:write. A test regenerates this block and fails
when the committed README drifts from it. -->

## Results at a glance

- **Does it find the blinks a human found?** On Eyeblink8, recall 83.6% (341 of 408 found), precision 84.0% (65 invented), F1 83.8%, measured from `eyeblink8-measured-rearm`. **That table is a property of the machine it was measured on.** Re-measured on a second machine — same code, same committed model, same pinned runtime, identical frames — the corpus gives recall 85.0% (347 of 408), precision 96.4% (13 invented), F1 90.4%. On 26 August the full corpus, prepared by the committed remux tool, was re-measured on the second machine and reproduced this table IDENTICALLY — every count, every percentage, every coverage number, digit for digit, across a different processor, operating system, browser binary and fifteen commits of instrument change. The apparent gap had been the files: that run's clips were re-encoded instead of remuxed, and re-encoding alone collapses false alarms on the worst clip from 19 to 3. So the number above is a measured property of the instrument and the prepared files on two machines — and NOT a property of arbitrarily transcoded copies, which is why the preparation is part of the result. The re-encoded table stays published as a record of that discovery; it is not an Eyeblink8 result. Full record: [docs/eyeblink8-result.txt](docs/eyeblink8-result.txt).
- **Does any of it track reported sleepiness?** No. A null result, published as readily as a positive one would have been: nothing cleared the pre-registered bar on the 20 of 36 DROZY sessions this instrument can measure. Full record: [docs/drozy-result.txt](docs/drozy-result.txt). Cite: Massoz, Langohr, Francois and Verly, WACV 2016.
- **Does it work on other people?** Six volunteers, three pre-registered failure criteria: the detector's criterion not met, the baseline's criterion FAILED, the frame-rate gate's criterion not met. Full record: [docs/validation-round.txt](docs/validation-round.txt).
- **Limitations, stated plainly:** how many blinks it finds depends on how fast the viewer's computer is; the learned baseline was unusable on three of the six volunteer machines; the DROZY sample is missing its sleepiest sessions, so its null is weaker than a null on the full set; and the alertness score has never been shown to correspond to anyone's actual sleepiness.

<!-- results:end -->

## Does it work on other people?

Six volunteers ran the scripted protocol on their own devices in their
own rooms, 19 and 20 August 2026, one session each, against a plan and
three failure criteria committed before any file existed. The answer
has two halves and they point in opposite directions.

**The baseline failed its criterion.** Three of the six machines
produced no usable baseline: one drifted 34.6% during the measurement,
one drifted 15.4% before the measurement window, and one settled 1.28
times the person's own resting aperture. Every blink this instrument
reports is judged against that learned baseline, so this is the
finding that directs the next work.

**The detector did not fail its criterion.** Among the three sessions
with a working baseline, zero of the scripted blinks were missed, and
the strictest-excluded session also caught ten of ten. What did appear
in the wild is over-counting: one slow, deep blinker produced 25
detections for 10 blinks, the first independent evidence for a
double-counting defect this project had only seen on a benchmark.

The full table, per-session prose, deviations, and what the round
cannot say are in `docs/validation-round.txt`. No participant is
named there or here; nothing identifying is published.

## Does it find the blinks a human found?

This is the first time anything here has been measured against somebody
else's work. Eyeblink8 is a public set of eight webcam clips. A person
watched all of them and marked every blink by hand. They marked 408
blinks. This app was given the same clips and had to find the same
blinks.

Frame totals for this set differ between sources, so here is the rule
this page uses. Each annotation file numbers its frames from zero. Take
the highest number in each file, add one, then add up the eight clips.
That gives 71,354, and 71,354 is the figure used everywhere below.

That is not the number of annotation rows. Only 70,992 rows carry an
annotation. The 362 frame numbers in between have no row at all. The
people who published the clips print 70,992 on their own site. So a
reader who checks will meet two different totals, and this is why.

|              | First answer        | Export fixed        | Clock fixed         | Ruler frozen        | Now                     |
| ------------ | ------------------- | ------------------- | ------------------- | ------------------- | ----------------------- |
| Blinks found | 284 of 408          | 338 of 408          | 358 of 408          | 341 of 408          | **341 of 408**          |
| Recall       | 69.6%               | 82.8%               | 87.7%               | 83.6%               | **83.6%**               |
| Precision    | 86.3% (45 invented) | 86.4% (53 invented) | 83.3% (72 invented) | 81.4% (78 invented) | **84.0%** (65 invented) |
| F1           | 77.1%               | 84.6%               | 85.4%               | 82.5%               | **83.8%**               |

Recall is the share of the human's blinks that the app found. Precision
is the share of the app's detections that were real. F1 is the two
numbers put together into one. It always sits close to the lower of the
two. So an app cannot look good by staying quiet, and it cannot look
good by firing all the time.

**There are five columns because this page has corrected its own
number four times, and every time the fault was in this app rather
than in the clips.** Every column stays. A project that shows you only
its final answer tells you less than one that also shows you the road
there.

- **The first answer, 69.6%.** The app was deleting its own results
  before writing them out. It found blinks and then threw them away.
  The defect is described below and was fixed in pull request #172.
- **The second, 82.8%.** Correct as far as it went, and **it did not
  repeat**. Measuring the same clip twice gave two different answers,
  because the app handed the face model a wall clock reading, so how
  busy the computer was leaked into the measurement. Fixed in pull
  request #189.
- **The third, 87.7%.** The first figure that gave the same answer
  twice, byte for byte. But part of it was earned by a measuring
  stick that moved: the personal baseline the blink threshold is half
  of was allowed to rise during a session, and it rose on every one
  of the eight clips, so the threshold grew more permissive as each
  clip went on.
- **The fourth, 83.6%.** The six-person validation round failed its
  baseline criterion on exactly that moving-ruler behaviour, so on
  20 August 2026 the baseline was frozen at its thirty-second
  calibration and the corpus re-measured with the ruler held still.
  The number went down and the instrument got better, which is the
  right way around for this project. The predictions were committed
  before the run in `docs/baseline-freeze.txt`, four held and one was
  wrong, and the wrong one is recorded there.
- **The fifth, the current number: recall still 83.6%, precision up
  to 84.0%.** One volunteer in the round blinked slowly and deeply
  and was counted 25 times for 10 blinks: after a counted blink,
  their hovering eyelid re-crossed the line before ever properly
  reopening. The re-arm gate now requires the eye to rise clear of
  the line before a new blink may count. On the corpus it removed 13
  false alarms at zero recall cost, with its predictions and its
  decision rule committed first in `docs/blink-rearm.txt`.

Precision fell from 86.4% to 83.3% between the second column and the
third, and that is not a step backwards. Making the measurement
repeatable made the app more sensitive: it found 20 more real blinks
and also reported far more of the same blink twice. Most of that
double counting was then removed, which is the next section. It fell
again in the fourth column, 83.3% to 81.4%, against the committed
prediction: at the frozen, lower threshold, flutter near the line
fragments into repeated crossings, the same double-counting signature
one validation-round volunteer produced live. The fifth column is the
gate built for exactly that signature doing its work.

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
detectors on these same eight clips. Here is what they report.

| who                                                                                        | year | where                                                                             | F1    |
| ------------------------------------------------------------------------------------------ | ---- | --------------------------------------------------------------------------------- | ----- |
| [Drutarovsky and Fogelton](https://link.springer.com/chapter/10.1007/978-3-319-16199-0_31) | 2014 | ECCV workshops, Springer Lecture Notes in Computer Science 8927, pages 436 to 448 | 82.0% |
| [Fogelton and Benesova](https://doi.org/10.1016/j.cviu.2016.03.011)                        | 2016 | Computer Vision and Image Understanding 148                                       | 91.6% |
| [Soukupova and Cech](https://cmp.felk.cvut.cz/ftp/articles/cech/Soukupova-TR-2016-05.pdf)  | 2016 | Czech Technical University report CTU-CMP-2016-05                                 | 95.2% |
| [Fogelton and Benesova](https://doi.org/10.1016/j.cviu.2018.09.006)                        | 2018 | Computer Vision and Image Understanding 176 to 177                                | 91.3% |
| [Al-gawwam and Benaissa](https://www.mdpi.com/2078-2489/9/4/93)                            | 2018 | Information, volume 9, article 93                                                 | 97.7% |
| **this app**                                                                               | 2026 | this page                                                                         | 83.8% |

ECCV is the European Conference on Computer Vision. Not one of those
five figures was simply copied out of the paper it sits beside, so here
is where each one actually came from. A reader deserves to know which of
them this page could check and which it could not.

- **2014.** The paper is behind a paywall and was not read here, so this
  number is second hand. A
  [later paper](https://www.scitepress.org/papers/2017/61727/61727.pdf)
  quotes it as 79% precision and 85.27% recall on these clips. The 82.0%
  is those two numbers put together here.
- **2016 and 2018, both by Fogelton and Benesova.** Both papers are
  behind a paywall and were not read here. Fogelton is the person who
  published these clips, and he prints both scores himself in a table on
  [his own project site](https://www.blinkingmatters.com/research). That
  is first hand from the author, and it is not the paper.
- **Soukupova and Cech.** The report is free to read. It is a thesis by
  Soukupova, with Cech as her advisor. It prints three methods. The best
  of the three scores precision 94.3% and recall 96.2% on these clips,
  and the report prints no F1. The 95.2% is those two numbers put
  together here.
- **Al-gawwam and Benaissa.** The paper is free to read. It prints
  precision 96.65% and recall 98.78% on these clips, and no F1. The
  97.7% is those two numbers put together here.

So across these five, published scores on these clips run from about 82%
to about 98%. This app sits near the bottom. It is above the oldest of
them and below every later one. Lean on that oldest number least. It is
the only one on this list that came from a third party rather than from
the people who did the work.

Those five are not the whole literature. Other papers report scores on
these clips too, and no attempt was made here to find all of them.

**Read that gap as real but rough.** Every paper counts blinks its own
way, so that column is not five runs of one test.

- Fogelton scores each eye on its own. His blink total for these clips
  is 804 and not 408, and he counts a fast double blink as one.
- Soukupova and Cech report the best point on their own curve, and they
  picked that point on the test data itself.
- Al-gawwam and Benaissa count a detection as correct when its peak
  falls inside the blink the human marked. A wrong edge costs them
  nothing. The rule on this page is stricter than that.
- Fogelton published these clips, and he writes on his own site that
  this kind of comparison is "not valid", because the annotation and the
  scoring differ between papers. That warning comes from the person who
  owns the benchmark, so it is quoted here rather than buried.

None of that closes a gap of ten points or more. It means the gap should
be read as a direction and not as a decimal.

After that fix, per clip recall ran from 67.7% to 91.7%. The whole gain
sits in the two clips the defect had cut short. One moved from 55.7% to
89.8% and the other from 58.3% to 91.7%. That is 30 blinks recovered in
one and 24 in the other, 54 in total, which is the entire move from 284
to 338. Every other clip found exactly the same number of blinks in
both runs. (Those are that run's figures. The current run's per clip
recall runs from 76.9% to 95.8% — see
[docs/eyeblink8-result.txt](docs/eyeblink8-result.txt). This sentence
said "now" until 2026-08-14, which read as current.)

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
At the very most the lost frames explain 4 of the 70 remaining misses —
**that is the second run's figure, and it has not been recomputed for
this one.** The current run has 50 misses, not 70, so the "4 of 70" pair
belongs to the run before it. Recomputing needs the corpus, which is not
in this repository. The script that counts all of this is
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
two fell a little, and one did not move at all. The likely reason is
that averaging neighbouring pixels together removes more noise than it
removes signal. That is an explanation offered here. It is not something
this check measured.

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
pulled down. On the current run the glasses clip scores 88.4% recall and
90.5% precision. The seven without score 83.0% recall and 83.2%
precision. The glasses clip now scores a few points HIGHER on both,
which is the opposite direction from the first write up's claim and
just as meaningless. Both figures rest on a single clip of 43 blinks,
and both settle nothing in either direction. So the claim is withdrawn
rather than reversed. This project has no evidence yet about what
glasses do to blink detection. An earlier version of this paragraph
printed a stale run's figures here while calling them the corrected
ones; the figures above are the current run's, from
[docs/eyeblink8-result.txt](docs/eyeblink8-result.txt).

There is a version of this result that reads better, and it is not
printed here. Leave out the blinks the human marked as long closures and
recall rises. Leave out the partial blinks as well and it rises again.
Carry the same reasoning one step further and it rises further still, by
leaving out the blinks the detector missed. Every step sounds defensible
on its own. That last step shows where this reasoning ends up, and it is
plainly cheating. So none of those numbers are on this page, including
the two a reader might have accepted.

**The misses have a pattern.** 47 of the 67 missed blinks, 70.1%,
contain at least one frame the human marked as fully closed. These are
not faint or borderline blinks. They are ordinary ones where this app's
eyelid measurement did not dip far enough to count. That is a real
weakness and nobody has explained it yet. Finding out why is the next
question. The share has barely moved across three runs, 72.0% before
the ruler froze and 78.6% before that, so freezing the ruler changed
how many blinks are missed and not the character of what is missed.

The row by row table is in
[docs/evidence/2026-08-21-rearm/](docs/evidence/2026-08-21-rearm/),
one line per miss, so the share can be recounted rather than taken on
trust. The previous runs' tables are kept beside their own results. These are
not faint or borderline blinks. They are ordinary ones where this app's
eyelid measurement did not dip far enough to count. That is a real
weakness. Finding out why is the next question.

**The invented blinks have a pattern too.** 38 of the 65 land on top of
a real blink rather than on an open eye. That is one blink counted
twice, not a blink imagined from nothing.

A number like that means nothing without the rule that produced it, so
here is the rule. Take the detection exactly as the app reported it and
widen nothing. If it shares at least one frame with a blink the human
marked, it landed on a real blink. Anyone can check that against the
clips' own annotation files.

There is a second and looser rule, and it gives 55 of the 65. Widen the
detection by four frames at each end first, then ask the same question.
Four frames is about 130 milliseconds at 30 frames per second, and it is
the slack this project already allows itself when deciding which
detections count as correct. That slack exists to stop a correct
detection being punished for disagreeing about an edge. Reusing it to
decide what a wrong detection sat on is a different act, so the stricter
38 is the number printed first. Both are here because 55 is the
flattering one and hiding it would be its own kind of dishonesty.

**Most of this double counting has been removed by two rules, and the
rest is left on purpose.** During one closure the eyelid measurement
can rise back over the line for a frame or two and dip again, and the
app counts two blinks. The first rule is time: a completed closure is
not counted if it ends within 150 milliseconds of the previous one,
because an eyelid cannot open and shut twice that fast. That removed 39
double counts and **cost no recall at all**, which is the number that
decides whether a rule like this is a fix or a way of hiding misses.
The second rule, added 21 August 2026 after a validation-round
volunteer was counted 25 times for 10 blinks, is depth: after a
counted blink, no new blink may begin until the eyelid has risen
clearly above the line, because an eyelid cannot blink again before it
has reopened. That removed 13 more false alarms, again at zero recall
cost, with its predictions committed before the measurement in
`docs/blink-rearm.txt`.

Where 150 comes from matters more than the number. Deliberate rapid
blinking tops out near five a second, so the shortest gap a person can
produce on purpose is about 200 milliseconds. 150 sits below that, so it
cannot suppress even someone blinking as fast as they are able. It was
chosen from what an eyelid can do, and then the benchmark was re-run to
see what it bought, in that order. It was introduced after this result
was first seen, which is worth saying plainly, and it has not been
adjusted since to improve the score.

Raising it to 300 would catch most of what remains. It stays at 150.
A number chosen to improve a score on a benchmark already read is
fitting, not measuring, and this page has a section above about exactly
that temptation. The re-arm rule is the alternative this project chose
instead: it removes re-crossings by requiring the reopening itself,
not by widening a timer.

10 of the 65 sit more than four frames from any blink the human
marked, and those 10 are the only ones that read as inventions rather
than fragments of a real blink.

54 of the 65 are three frames long or shorter. The rule there is to
count from the detection's first frame to its last, including both, so
frames 10 to 12 is three frames.

Earlier versions of this section described the 53-alarm and 72-alarm
runs that preceded this one; their evidence tables are kept as those
runs' records under
[docs/evidence/2026-08-09/](docs/evidence/2026-08-09/). The counts
here describe the current run, whose miss table is at
[docs/evidence/2026-08-21-rearm/](docs/evidence/2026-08-21-rearm/).

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
[docs/eyeblink8-result.txt](docs/eyeblink8-result.txt). This paragraph
used to warn that two lines in that file disagreed with this page.
Checked on 2026-08-14: they no longer do. The file contains nothing
about the capped clip losing its first row, and its false-alarm lines
read "45 of 72 sit on a real blink under the strict rule" and "61 of 72
are three frames long or shorter" — which agree with this page. The
warning was itself the stale part, and `tools/resultGuard.mjs` already
treats that file as the source of truth.

## Does any of it track how sleepy somebody actually is?

**No, not on the evidence available. This is a null result and it is
published for the same reason the unflattering blink numbers above are.**

Everything else on this page measures blink DETECTION, where a human had
already marked the right answer. This asks the harder question: do these
numbers mean anything about tiredness?

DROZY is a set of recordings from the University of Liege in which
fourteen people rated their own sleepiness on the Karolinska Sleepiness
Scale, 1 to 9, immediately before each session, under increasing sleep
deprivation. It is used here under written permission from Professor
Jacques Verly. Numbers only. No frame of it is in this repository and
none ever will be.

**The plan was written and committed before any correlation was
computed.** It named the seven features, the statistic, the correction,
the controls and the decision rule in advance, so this result can be
checked against a plan that could not have been written to fit it. It is
at [docs/drozy-analysis-plan.md](docs/drozy-analysis-plan.md), in its own
commit, with no results in it.

| what was measured       | correlation with sleepiness | after correction |
| ----------------------- | --------------------------- | ---------------- |
| blink duration          | +0.44                       | not significant  |
| closing velocity        | −0.44                       | not significant  |
| long closures           | +0.36                       | not significant  |
| amplitude over velocity | +0.36                       | not significant  |
| blink amplitude         | −0.33                       | not significant  |
| blink rate              | −0.07                       | nothing          |
| PERCLOS                 | −0.00                       | nothing          |

**Three of these rows were measured by code that has since changed.** The
run is from 9 August 2026, built from commit `bd2a98d`. On 12 August, pull
request #225 corrected how the blink shape window is measured, which is the
only genuine arithmetic error the August audit found. That correction moves
closing velocity, blink amplitude, and amplitude over velocity. It does not
move blink duration, long closures, blink rate or PERCLOS, because those
depend only on when a blink starts and ends, and re-measuring returns those
byte for byte identical. The three affected rows have not been recomputed.
Recomputing them would mean rebuilding video this project deletes on
purpose, so the honest thing is to say which rows are old rather than
quietly leave them standing. **The null result does not change either
way**: nothing cleared the correction bar before, and these three were the
closest to clearing it.

Seven tests on twenty sessions will turn up something that looks
interesting by chance, so the correction is not optional. **Nothing
survives it.** The shuffled control settles it: the strongest
correlation seen was 0.44, and shuffling the sleepiness ratings produces
up to 0.75 by chance alone.

**Two things are worth saying beyond the headline.**

The two most commonly cited drowsiness measures, blink rate and PERCLOS,
were flat. Not weak. Effectively zero.

And the four features that did move all moved the way the drowsiness
literature says they should: sleepier people showed slower lid closing,
smaller blinks, and a higher ratio of the two. Four features agreeing
with prior expectation is not proof of anything, and twenty sessions
cannot make it one, but it is not nothing either.

**The sample is not just small, it is biased.** blinklab refuses to
measure blinks below 25 frames per second, and DROZY's own README says
its 15 fps recordings are "tests 2 and 3 of subjects 1->8, because of a
recording bug occurring in darkness". Those are the sleep deprived
sessions. So the 16 sessions this instrument cannot measure are
systematically the sleepier ones:

|          | sessions | mean sleepiness | range  |
| -------- | -------- | --------------- | ------ |
| analysed | 20       | 4.60            | 2 to 8 |
| excluded | 16       | **6.38**        | 3 to 9 |

Every rating of 9 in the dataset sits in the excluded group. **So this is
a null result on a sample missing the top of the scale**, which is weaker
evidence than a null result on the whole of it. They cannot be recovered:
DROZY carries no blink annotation, and lowering the frame rate floor to
include them would be choosing a threshold to get a result.

**What this means for the alertness score on this page.** It remains a
documented heuristic that has never been shown to correspond to anyone's
actual sleepiness. That was true before this measurement and it is still
true after it.

Full output in [docs/drozy-result.txt](docs/drozy-result.txt), reproducible
with `analysis/tools/analyse_drozy.py`.

> Quentin Massoz, Thomas Langohr, Clementine Francois and Jacques G.
> Verly. "The ULg Multimodality Drowsiness Database (called DROZY) and
> Examples of Use." IEEE Winter Conference on Applications of Computer
> Vision (WACV), 2016.

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
both browsers to the last decimal**, across all 71 seconds. Eyelid
aperture differed by 0.02 mm on average and the learned personal
baseline by 0.4 percent, which is what sampling a frame a fraction
earlier during a blink costs.

For a while that claim was true across browsers and false across runs.
The same clip measured twice on the SAME browser gave two different
answers, because the app was handing the face model a wall clock
reading, and the face model uses the gap between readings when it
follows a face from frame to frame. So how busy the computer happened to
be leaked into the measurement. That is the exact dependence stepping
exists to remove, and it survived here for months because every frame
was still being measured. Fixed in pull request #189. Measuring one clip
three times now produces identical files, byte for byte.

This is worth stating because the first version of stepped measurement
failed it badly, and failed it invisibly. It played the clip and paused
on each frame, which cannot outrun a video advancing in real time, so it
measured 6,655 frames of a 12,626 frame recording and reported "measured
every frame". How many it lost depended on how busy the machine was. The
current version seeks to each frame instead, so it measures every frame
however busy the machine is.

Safari's extra frame was the final one counted twice, which is fixed.

## Privacy

Everything runs in your browser. No video, image or measurement ever leaves your device. There is no backend and no analytics of ours. The CSV export writes a file to your own disk and uploads nothing.

**Two things are kept on your device, and the page now lists both and offers to erase them.** A gaze calibration leaves behind the solved profile and the measurements it was solved from, so it survives a reload and works from the first frame of your next visit. Nothing else is stored: those two keys are the only storage this app touches. A "Stored on this device" box at the bottom of the page names them and erases them on request, and the erase clears the profile the running session is holding as well, so the heatmap goes back to asking you to calibrate. The confirmation it prints is read back from the browser after the fact rather than assumed, because a delete that quietly does nothing is worse than one that fails loudly.

One exception, found by the August 2026 audit and stated here because it was claimed otherwise for two weeks. The vendored MediaPipe library sends a `POST` to `odml.pa.googleapis.com` about sixty seconds after the face model is created, with no detections needed. It is Google's own usage reporting, it is inside the dependency rather than in any code here, and its payload is usage statistics: no video, no image, no landmark, no measurement. This page previously denied any reporting of any kind, which was false. Whether it can be blocked without breaking the model is an open question, recorded in `decisions/ADR-0004-model-telemetry.md`.

## Status

Phases 0 through 6 are complete: foundations, pixels, landmarks, measurement, blinks, gaze and attention, and the rolling state with the demo score. Phase 7, the honest evaluation track, is under way: a Python analysis folder, a session loader and plots, a licensing gate, and video upload mode so a recorded clip runs through the same pipeline as the live camera. That is 804 unit tests, 20 end to end tests of which all run on every pull request in Chromium and 2 rerun locally in WebKit, and 275 Python tests of which 2 skip, all green.

**The licensing gate failed, and that is written down rather than hidden.** [DATASETS.md](DATASETS.md) records about twenty public datasets, from a wider search of roughly forty, assessed against four requirements: face video, a real drowsiness label, per-clip subject identity, and a licence a solo maintainer can rely on in a public repository. None clears all four. The failure turned out to be structural: the openly licensed drowsiness data is physiological traces, still images or synthetic renders, while every video corpus carrying a real sleepiness label is behind a signed agreement, an institutional email check, a non-commercial clause, or no licence at all. Face video is personal data, and the anonymisation that would let a team release it freely is exactly what destroys the per-subject identity a leave one subject out split needs.

So the evaluation track was replanned rather than abandoned. The next result is blink detection measured against an openly licensed corpus with ground-truth blink intervals, which is a smaller claim than a drowsiness classifier and one this project can actually defend.

## How to run

You need Node.js 22.13 or newer, or 24 and above. CI runs 26, and
`.nvmrc` carries that, so `nvm use` gives you what the gates ran on.

The floor is not arbitrary: vite requires `^20.19.0 || >=22.12.0` and
eslint requires `^20.19.0 || ^22.13.0 || >=24`, so Node 21 and Node 23
satisfy neither and Node 20.0–20.18 fails vite. `package.json` now
declares the range, so a wrong version is refused at install time rather
than described here and hoped for. This line said "Node.js 20 or newer"
until 2026-08-14, which was wrong at both ends.

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
- [ARCHITECTURE.md](ARCHITECTURE.md), how the pieces fit, written so a newcomer understands it in five minutes.
- [MODEL_CARD.md](MODEL_CARD.md), what the measurement does, who it has been tested on, and what it does not do.
- [decisions/](decisions/), architecture decision records.
- [AUDIT_REPORT_AUG_2026.md](AUDIT_REPORT_AUG_2026.md), the August 2026 audit, and [REMEDIATION.md](REMEDIATION.md), what has been fixed since.

## License

MIT for this project's own code, with a not a medical device notice. See
[LICENSE](LICENSE).

The published page also bundles Google's MediaPipe library, its WASM and
the face landmarker model, which are Apache-2.0 and are **not** covered
by that MIT grant. Their notice travels with them in
[public/THIRD_PARTY_LICENSES.txt](public/THIRD_PARTY_LICENSES.txt).
