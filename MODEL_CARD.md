# Model card

What blinklab measures, what it does not, where it fails, and who it has
never been tested on.

Roadmap row 8.4. Written 9 August 2026, revised 12 August 2026,
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

| Measurement                                 | Unit              | Validated against                           | Result                                              |
| ------------------------------------------- | ----------------- | ------------------------------------------- | --------------------------------------------------- |
| Blink detection                             | events            | Eyeblink8, 8 clips, 408 human-marked blinks | recall **87.7%**, precision **83.3%**, F1 **85.4%** |
| Eyelid aperture                             | millimetres       | iris as a physical ruler                    | not validated against a physical measurement        |
| Blink duration, amplitude, closing velocity | ms, mm, mm/s      | nothing external                            | unvalidated                                         |
| Gaze direction                              | screen region     | nine point calibration, one person          | reliable near the centre, degrades at the corners   |
| PERCLOS                                     | share of a minute | nothing external                            | unvalidated, and see the caveat below               |
| Alertness score                             | 0 to 100          | nothing external                            | **a heuristic, not a measurement**                  |

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

**Below 25 PROCESSED frames per second it stops detecting blinks entirely; for a live camera that number is the page's processing rate, not the camera's own, so a slow camera behind a fast display is not yet caught (remediation D1, stage two pending).** At 15
fps a 100 ms blink spans one and a half frames, so refusing is correct.
The failure is currently near-silent: one line of small text, while
everything else on the page carries on looking healthy. This removed 16
of 36 sessions from a dataset before anyone noticed. Issue
[#192](https://github.com/heshipstech/blinklab/issues/192).

**It misses blinks that are plainly there.** Of the blinks it missed on
Eyeblink8, 72.0% contained at least one frame a human marked as fully
closed, 36 of the 50. (This card said 78.6% until 11 August; that figure
described the superseded run's misses.) These are not faint or borderline events. Why the eyelid
measurement does not dip far enough on them is unexplained. Issue
[#179](https://github.com/heshipstech/blinklab/issues/179).

**It sometimes reports one blink twice.** A refractory period of 150 ms
removed 39 such reports at no cost to recall, but 72 false alarms remain
and 45 of them still sit on top of a real blink. Raising the refractory
period would remove most of them, and it has deliberately not been
raised, because a constant chosen to improve a score on a benchmark
already read is fitting rather than measuring.

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

| Group              | Number of people      | What is known about them                  |
| ------------------ | --------------------- | ----------------------------------------- |
| Eyeblink8 subjects | 8                     | Nothing beyond one glasses annotation     |
| DROZY subjects     | 14, of whom 13 usable | Nothing published beyond subject number   |
| The author         | 1                     | One adult, one lighting setup, one laptop |

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
