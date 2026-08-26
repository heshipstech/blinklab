# Model card

What blinklab measures, what it does not, where it fails, and who it has
never been tested on.

Roadmap row 8.4. Written 9 August 2026, revised 26 August 2026,
against the state of `main` on
that date. Every number here is measured and links to how it was
obtained. Where a number does not exist, this page says so rather than
leaving a gap that reads as a pass.

## What this is

A browser page that watches a face through an ordinary webcam and turns
what the eyes are doing into numbers. Nothing you record is uploaded.
There is no server and no account. The vendored face model does report
its own usage statistics to Google; see Privacy below.

It is **not a medical device, not a safety device, and not a product**.
It is an instrument that measures eye signals, published so the
measurements can be checked.

## What it measures, and how well

| Measurement     | Unit   | Validated against                           | Result                                              |
| --------------- | ------ | ------------------------------------------- | --------------------------------------------------- |
| Blink detection | events | Eyeblink8, 8 clips, 408 human-marked blinks | recall **83.6%**, precision **84.0%**, F1 **83.8%** |

**These numbers are machine-conditional, measured 25 August 2026.** The same corpus, through the same code, the same committed face model and the same pinned runtime, measured on a second machine gives recall **85.0%**, precision **96.4%**, F1 **90.4%** — on identical frames, coverage matching to the frame on all eight clips. **Confirmed 26 August 2026: the table above reproduces identically on a second machine.** The full corpus, prepared by the committed remux tool, returned every count, percentage and coverage number digit for digit across a different processor generation, operating system, browser binary and fifteen commits of instrument change. The apparent machine gap reported on 25 August was the file preparation: that run's clips had been re-encoded instead of remuxed, and re-encoding alone collapses false alarms from 19 to 3 on the worst clip at every quality from lossless to visibly lossy. Two things follow: these numbers are a measured property of the instrument and the prepared files, on two machines; and the instrument's precision is sensitive to how a video was transcoded, so any comparison against other published numbers must state the preparation. The re-encoded table stays published as the record of that discovery; it is not an Eyeblink8 result. Both tables, and the measurements that eliminated the code, the files, the model and the runtime as causes, are in [docs/eyeblink8-result.txt](docs/eyeblink8-result.txt).
| Eyelid aperture | millimetres | iris as a physical ruler | not validated against a physical measurement |
| Blink duration, amplitude, closing velocity | ms, mm, mm/s | nothing external | unvalidated |
| Gaze direction | screen region | nine point calibration, one person | reliable near the centre, degrades at the corners |
| PERCLOS | share of a minute | nothing external | unvalidated, and see the caveat below |
| Alertness score | 0 to 100 | nothing external | **a heuristic, not a measurement** |

Blink detection is the only thing here that has been checked against
somebody else's ground truth. Everything else in that table is
internally consistent and externally unverified.

For comparison, published detectors on those same eight clips report F1
between about 82% and about 98%. blinklab sits inside that range and
below its top. The full comparison, including which figures could be
read in the paper and which came from an author's own results table, is
in the README.

## What it does not measure

**Drowsiness.** This is the most important line on the page. The
alertness score is a documented weighted heuristic built from four named
penalties. It has never been shown to correspond to how sleepy anyone
actually is. A sleepiness validation against a dataset carrying real
self-reported ratings was built, pre-registered
(`docs/drozy-analysis-plan.md`), run, and published on 10 August 2026:
a null result. Nothing survived the multiple-comparison correction
(`docs/drozy-result.txt`). Treat the score as an illustration of how
such a score could be assembled, not as evidence that it works. That
was true before the measurement and it is still true after it.

**Anything clinical.** No condition, no impairment, no fitness to drive
or work. It has not been compared against any medical standard and no
part of it has been reviewed by a clinician.

**Attention, in the everyday sense.** It measures where the eyes point.
Where a person's mind is, is a different question.

## Where it fails

**The learned baseline does not generalise, measured on six volunteers
and pre-registered as this round's second failure criterion, which
FAILED.** Every measurement is a comparison against a per-session
baseline learned in the first 30 seconds, and on three of six
volunteers' machines that baseline was unusable: drifted 34.6% during
the measurement, drifted 15.4% before it, or settled 1.28 times the
person's own resting aperture. The detector itself missed nothing on
the sessions whose baseline worked. Table and write-up in
`docs/validation-round.txt`.

Since 23 August 2026 the page runs that round's baseline-length check
on itself while the session records (`src/core/rulerFit.ts`): the
frozen baseline over the running median aperture, spoken on the page
and exported per row as `baselineOverResting`. Each row's value is
the ratio over the records SO FAR, so mid-session rows are not the
published whole-session statistic; the final row is, for any session
short enough to fit the export's 3600-row buffer. The two
implementations share their 1.25 ceiling by a test that reads both
sources, the validation report recomputes the exported ratio and
says so, bit-exactly, when the page's account disagrees with its
own, and neither this check nor the birth clip FIXES a bad
baseline — a macbookair-shaped session is still mis-ruled, and is
now told so while it can still be re-run.

**Below 25 PROCESSED frames per second it stops detecting blinks entirely; for a live camera that number is the page's processing rate, not the camera's own, so a slow camera behind a fast display would not be caught. Measured on twelve real sessions in August 2026, six of the author's and six volunteers', that case did not occur once: every camera declared 30 and the gate never wrongly opened, which is why a true camera rate is deliberately still not wired into the gate. The larger problem was the silence above the floor, addressed 20 August 2026 (remediation D1, stage two): see the next paragraph.** At 15
fps a 100 ms blink spans one and a half frames, so refusing is correct.
The failure is currently near-silent: one line of small text, while
everything else on the page carries on looking healthy. This removed 16
of 36 sessions from a dataset before anyone noticed. Issue
[#192](https://github.com/heshipstech/blinklab/issues/192).

**Above the floor it still loses blinks, and how many depends on the
machine rather than the camera.** The processing rate is set by how fast
the face model runs, so on 17 August two four-core machines ran at 29 to
32 frames per second and a twelve-core machine ran at 127, on cameras
that all declare 30. In one scripted test of ten deliberate blinks the
four-core machines found 7 and 9, and the twelve-core machine found all
ten. A firm blink is caught at every rate from 25 up. The vulnerable
ones are shallow or quick: in a band about 0.4 mm wide just past the
depth at which a closure arms, detection runs from roughly half at 25
frames per second to certain at 60. Since 20 August 2026 the page says
so: a visible warning appears whenever the processing rate of a live
session sits below 60, stating the machine's own number and that the
camera is not the cause. The 25 fps refusal gate is unchanged, and all
of this still happens above its floor. Measured in
`docs/blink-sample-rate.txt`, with the sessions in
`docs/validation-dry-run.txt`.

Corrected 24 August 2026, and the paragraph above stays as the record:
"the machine rather than the camera" held only while no machine
outran its camera. The first delivered-rate measurement — an M5 Max
processing 120 frames per second on a camera delivering 30 — read
exactly 30 distinct frames per second: the evidence rate is the
LOWER of what the camera delivers and what the machine reads, and
past the camera's rate a faster machine re-reads old frames and
buys nothing. The warning now judges the measured rate of distinct
camera frames read and blames whichever side binds. The thresholds
and the 25 fps floor did not move; the decision rule was committed
in `docs/blink-sample-rate.txt` before the measurement was seen.

**It misses blinks that are plainly there.** Of the blinks it missed on
Eyeblink8, 70.1% contained at least one frame a human marked as fully
closed, 47 of the 67. (This card said 78.6% until 11 August and 72.0%
until 20 August; each figure described the run it was measured on.)
These are not faint or borderline events. Why the eyelid
measurement does not dip far enough on them is unexplained. Issue
[#179](https://github.com/heshipstech/blinklab/issues/179).

**It sometimes reports one blink twice, and two rules now remove most
of it.** A refractory period of 150 ms removed 39 such reports at no
cost to recall. The validation round then supplied the first
independent-face evidence of what the timer cannot reach: one
volunteer who blinks slowly and deeply produced 25 detections for 10
scripted blinks, re-crossing the line 200 to 270 ms apart. The re-arm
gate of 21 August 2026 answers that by mechanism rather than timer:
after a counted blink, no new blink may begin until the eyelid has
risen clearly above the line. It removed 13 more false alarms at zero
recall cost (`docs/blink-rearm.txt`, predictions committed first).
65 false alarms remain and 38 of them still sit on top of a real
blink. The refractory period stays at 150 ms, deliberately: a
constant chosen to improve a score on a benchmark already read is
fitting rather than measuring.

**PERCLOS uses an adjusted threshold, not the literature's.** This
instrument reads fully shut eyes as roughly a third of the open baseline
rather than zero, so the usual 20% P80 line is unreachable and would
report 0.0% through a witnessed twelve second closure. The line used
here is measured against this instrument and documented as such. It is
not comparable to a PERCLOS figure from another system.

**Strong prescription lenses degrade gaze**, though on the one glasses
clip in Eyeblink8 they did not degrade blink detection. One clip of 43
blinks settles nothing either way.

**Thresholds are personal and learned per session**, over 30 seconds. A
session shorter than that produces no score at all, and the learning
period is a period during which the instrument is not yet measuring.

## Who it has been tested on

This is the section most model cards leave vague, so here it is plainly.

| Group              | Number of people      | What is known about them                                      |
| ------------------ | --------------------- | ------------------------------------------------------------- |
| Eyeblink8 subjects | 8                     | Nothing beyond one glasses annotation                         |
| DROZY subjects     | 14, of whom 13 usable | Nothing published beyond subject number                       |
| The author         | 1                     | One adult, four devices, six sessions                         |
| Round volunteers   | 6                     | Six adults, six devices, one scripted session each, anonymous |

**Both committed human-data fixtures are the author's own**, confirmed by
the owner on 2026-08-15: `test/fixtures/session-01.json`, 300 frames of face
landmarks, and `analysis/tests/fixtures/session-fixture.csv`, which carries
`kss_before` and `kss_after` sleepiness ratings. No other person's face
geometry or self-report is in this repository. This was recorded because an
audit found it stated nowhere, which meant a reader could not tell consent
from oversight.

DROZY is used under a written permission whose condition is that the
database and its paper are cited wherever results appear, in any form.
Cite: Massoz, Langohr, Francois and Verly, WACV 2016. (Added 2026-08-14:
this file published DROZY subject counts and exclusion reasoning without
the citation the permission requires.)

**Age, skin tone, eye shape, ethnicity, visual impairment and eyewear
are unknown for every subject above.** Neither benchmark publishes them.
So this project cannot tell you whether the instrument works equally
well across those groups, and it would be dishonest to imply it does.

The underlying face landmark model is Google's MediaPipe Face Landmarker,
which carries its own training data and its own biases. Those are not
audited here.

**What this means in practice:** every threshold in this project was
priced against a small number of faces, and one of them was the author's.
An instrument tuned on few people usually works best on people like
them.

## How the numbers were obtained

The same code path measures a live camera and a recorded file. A clip is
stepped frame by frame and waits for the measurement on every frame, so
the result is a property of the recording rather than of the computer.

That claim was false until 9 August 2026, when a defect was found in
which the face model was handed a wall clock reading and used the gap
between readings to track a face, so machine speed leaked into the
measurement. Measuring one clip three times now produces identical files,
byte for byte.

The published figure has been wrong twice, both times through a defect
in this repository rather than in the data. Both wrong answers remain
printed in the README beside the current one.

## Intended use

Learning, demonstration, and research into whether eye signals can be
measured usefully from consumer cameras.

## Uses that are out of scope

Driver monitoring, workplace fitness testing, clinical assessment,
employee surveillance, insurance decisions, or anything where a person
is affected by the output. The instrument is not accurate enough, has
not been validated for any of them, and its failure modes are not
characterised across populations.

## Privacy

Video never leaves the browser. There is no server component and no
analytics of ours. Exported files are written to the reader's own disk
by their own action.

The vendored MediaPipe library does send its own usage statistics to
Google about sixty seconds after the face model loads, needing no
detections. No video, image, landmark or measurement is included. This
page denied any reporting at all until the August 2026 audit measured
it. See
`decisions/ADR-0004-model-telemetry.md`.

Dataset video is never committed to this repository, and derived numbers
are published only where the rights holder has granted permission in
writing. See `DATASETS.md`.

## Where to check any of this

- Benchmark result and method: `README.md`
- Full evaluation output: `docs/eyeblink8-result.txt`
- Evidence and scripts: `docs/evidence/2026-08-09/`
- Dataset licences and permissions: `DATASETS.md`
- Known defects: the [issue tracker](https://github.com/heshipstech/blinklab/issues)
- The sleepiness analysis plan, written before its answer was known:
  `docs/drozy-analysis-plan.md`
