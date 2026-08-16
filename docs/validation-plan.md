# The six-person validation round: what will be measured, decided in advance

Written 16 August 2026, before a single session file exists. Nothing in
this document may be changed once the first volunteer file has been
opened. If something here turns out to be wrong, the correction goes in
a new dated section at the bottom, saying what was changed and when, so
a reader can see the plan that was actually pre-registered rather than
the one that survived contact with the data.

The precedent is `docs/drozy-analysis-plan.md`, committed before any
correlation existed. It is the only reason the DROZY null result can be
believed: the plan could not have been written to fit it.

## Why this round exists

Every number this project has published about blink detection on a live
camera comes from one face, the owner's, through one camera, a Sony
A7 IV. The Eyeblink8 figures come from eight other faces, but through
recorded clips at a fixed 30 frames per second, not through a webcam in
a room with its own lighting.

So the instrument has never been shown to work on anybody else's face,
on anybody else's hardware, in anybody else's room. That is the single
largest untested claim in the repository, and it sits under every
conversation the owner is about to have about this project.

Six people is a small number. It cannot establish a recall figure and
this round will not publish one. What six people can do is find the
failures that are large and obvious: a face the model never locks onto,
a camera whose frame rate makes the whole measurement void, a baseline
that never settles, a detector that counts three blinks when ten
happened. Those are the failures that matter now, because any one of
them means the published Eyeblink8 numbers describe a narrower
instrument than the README implies.

## The protocol, as it will be run

The participant opens the live demo, allows the camera, and does this
once, in one sitting, in whatever room and on whatever machine they
normally use. No instructions about lighting or seating, deliberately:
the point is to find out what happens in real conditions.

1. Start the camera and sit normally for **30 seconds**. This is the
   baseline learning window. Look at the screen, blink normally, do not
   try to hold still.
2. Press **Mark**.
3. Blink **10 times, deliberately**, counting them out. Ordinary firm
   blinks, not exaggerated squeezes.
4. Press **Mark** again.
5. Close both eyes for about **5 seconds**, then open them.
6. Read something on screen for about **one minute**.
7. Press **Export CSV**, answer the sleepiness question, and save the
   file.
8. Press **Export blink log** and save that file too.
9. Email both files back.

The ten blinks between the two marks are the ground truth of this
round. That is the whole reason the Mark button exists: finding those
ten in the export by looking for a burst of ten detections would use
the instrument's own output to locate the event that tests the
instrument, and it would fail exactly when the instrument missed them,
which is the only case worth measuring.

## What comes back, and what it is called

Two files per person, both written by the page's own exporters:

- `blinklab-session-<stamp>.csv`, one row per second, with the session
  metadata above the header.
- `blinklab-blinks-<stamp>.csv`, one row per detected blink.

The two files of one session share the `<stamp>`, which is how they are
paired. The markers are written into the **session** file only, as
`# marker_1_seconds` and `# marker_2_seconds`; the blink file carries
only source and coverage metadata. Both files stamp their times on the
same clock, so a marker in one can cut a window in the other without a
conversion.

## The published table, one row per person

Twelve columns. Five are the checks the owner asked for, one is the
remediation D1 measurement that the same files happen to carry, and the
rest are the conditions without which none of the others can be read.

### 1. `blinks_in_window`, and the reason it has neighbours

The count of blink rows whose `atMs` falls between marker 1 and
marker 2. Ground truth is 10.

Two more columns travel with it and are not optional:
`blinks_near_start` and `blinks_near_end`, the counts falling within
one second **outside** each marker.

They exist because a marker is not stamped when the person clicks it.
`src/main.ts` stamps it with `lastRecordAtMs`, the timestamp of the
most recent per-second record, so a mark can sit up to about one second
earlier than the press. A window that must hold exactly ten blinks can
therefore swallow a blink from the second before marker 1, or drop one
that happened just before marker 2 was pressed.

Without those two columns, a marker artefact and an instrument miss
look identical in the table, and the round would draw the opposite
conclusion from the one the data supports.

The verdict, fixed here:

- **counted**: `blinks_in_window` is exactly 10.
- **ambiguous**: it is not 10, but moving the boundary blinks in or out
  within the one second slack can reach 10.
- **missed**: even with the slack, the count cannot reach 10.

Only `missed` is evidence about the detector.

### 2. `long_closure_fired`

Whether `longClosureCount` in the session file increases at any point
after marker 2. The step 5 closure is about five seconds and the
detector fires beyond 500 ms of aperture under 40 percent of baseline,
so it should fire once.

Reported as the counter's value at marker 2 and at the last row, not as
a yes or no, because two closures would mean something different from
one and a bare boolean would hide it.

### 3. `baseline_ready_after_s`

Seconds from the first record to the first row carrying a non-null
`baselineMm`. Expect about 30. A longer time means the face was not
found often enough to fill the learning window, which is itself the
finding.

Null when the baseline never became ready at all. That is not a missing
value, it is the worst result this column can carry: every blink in
that session was judged against a ruler that does not exist.

### 4. `baseline_drift_pct`

How far the baseline moved after it was first set, as a percentage of
its first value. The baseline is allowed to rise and never to fall, by
design, so this is expected to be positive or zero.

A large rise means the ruler moved underneath the measurement, and the
blinks late in the session were judged against a different bar from the
ones early in it.

**An earlier draft of this check was wrong and is recorded here so the
mistake is not repeated.** It proposed to test that the baseline lands
between the median and the maximum aperture of the learning window.
That is true by construction: the baseline is the 90th percentile of
that window capped at 1.4 times its median, so it cannot land anywhere
else. A check that cannot fail is not a check.

### 5. `face_detected_fraction`

Read straight from the session metadata. The share of records that
carried a usable face.

Pre-registered floor: **0.90**. Below that, every other number in the
row is read as provisional, because the instrument was not looking at a
face for more than a tenth of the session and a blink rate computed
across those gaps understates reality.

That number is a judgement made before any data existed. It may turn
out to be wrong. It is written down now precisely so that it cannot be
chosen later to suit the result.

### 6. `median_iris_width_px` and `measurement_frame`

Read from the session metadata, and always reported as a pair. The iris
is the ruler every millimetre on the page is divided by, so how many
pixels it spans sets the precision of everything else. The frame it was
measured in is part of the number: the same iris measured in a
1920-wide frame and a 640-wide one gives two different figures for the
same eye.

**No pass rule is pre-registered for this column, because none has been
measured.** It would be easy to invent a floor here and it would be a
guess wearing a threshold's clothes. What this column is for is
comparison: if the sessions that missed blinks are also the sessions
with the fewest iris pixels, that is a lead worth following, and this
round is how the numbers to follow it get collected.

### 7. `camera_declared_fps` and `processing_fps_median`

The rate the camera says it delivers, and the median of the `fps`
column, which is the rate the page's frame handler actually ran at.

Neither has a pass rule. This pair is remediation D1's held question,
which is exactly how much damage wiring a true camera rate into the
25 fps gate would do. Today the gate reads the processing rate, so a
20 fps camera behind a 60 Hz display reads about 60 and the gate stays
open on a session whose blink timings are guesses.

Six real machines is the first evidence this project will have about
how often that happens. Collecting it here costs nothing, because the
files carry it whether or not anyone reads it.

### 8. `visibility_changes`, `records`, `observed_duration_seconds`

Reported, not judged. A hidden tab stops the frame loop, so a session
with several visibility changes has gaps that look like a person who
stopped blinking, and any surprising row should be read against this
column first.

## What the tool refuses, and what it must never do

The refusals matter more than the checks. This project's recurring
defect, nine times now, is a step that fails silently and reports
success, so every way this tool can be handed something it cannot
trust has a named refusal:

- A session file whose columns are not the exporter's contract, in the
  exporter's order.
- Timestamps that do not increase.
- A blink file that cannot be paired with a session file, or the
  reverse.
- Fewer than two markers, or markers out of order. Checks 1 and 2
  cannot be computed and the row says so rather than reporting a zero.
- A session recorded from a clip rather than a camera. This protocol is
  about live webcams and a clip run answers a different question.

One case is deliberately **not** a refusal, and it is the one most
likely to be mishandled. The blink log exporter returns nothing at all
when no blink was ever detected, so a total instrument failure produces
**no second file**. That looks exactly like a person who forgot to
press the button.

A missing blink file, where the session file is present and well
formed, is reported as a row reading **"no blinks detected"** and it
counts as a `missed` verdict on check 1. It is never skipped and it is
never an error. If this tool ever quietly drops such a person, it has
hidden the single worst outcome the round can produce.

## What would count as the instrument failing

Fixed now, before any file is read.

- **The detector does not generalise.** Three or more of the six
  sessions come back `missed` on check 1. The published Eyeblink8
  recall figure then has to carry a stated caveat that it was measured
  on recorded clips and does not hold on live webcams, and the README
  says so.
- **The baseline does not generalise.** Two or more sessions never
  reach a ready baseline, or drift past the threshold set below. The
  30 second learning window is then too short or too fragile for real
  conditions, and that is a defect in the instrument, not in the
  participants.
- **The frame rate gate is letting bad sessions through.** Two or more
  sessions declare a camera rate under 25 fps while showing a
  processing rate above it. Remediation D1 stage two stops being a
  tidy-up and becomes a correctness fix.

None of these is a reason to withhold the table. The table is published
whatever it says. A round that can only report success was never a
test.

## Thresholds, and when they are allowed to be set

One number in this document is deliberately not yet fixed: how much
`baseline_drift_pct` counts as the ruler moving.

It will be set from the **owner's own two sessions**, one on the Sony
A7 IV and one on a plain laptop camera, recorded and analysed before
any volunteer file is opened, and written into this section with the
two measured values beside it.

That is legitimate because those two sessions are not part of the six.
Setting it from a volunteer file, or after reading one, would be
choosing a threshold to suit a result, and it would void this check.
**If that ever happens, this check is void and the table says so.**

Threshold: NOT YET SET.
Owner's own measured drift, Sony A7 IV: NOT YET MEASURED.
Owner's own measured drift, laptop camera: NOT YET MEASURED.

## What happens to the files

The two files a person sends carry no image and no face. They do carry
the camera's name, the full user agent string, the screen and viewport
size, and the core count. Together those identify a machine.

- The raw files are kept **outside this repository**, in
  `$DATASETS/validation-round`, alongside the corpora. They are never
  committed.
- What is published is the derived table only. Camera names are kept,
  because the whole point of the iris width column is comparing
  devices. User agents are reduced to browser and platform.
- No participant is named. Rows are identified as `P1` to `P6`.
- `deviceId` is not collected by the exporter at all, deliberately: a
  stable per-origin identifier for one camera is a fingerprint rather
  than a measurement.

The reason for the first rule is simple and worth stating plainly.
Git history cannot be un-published, and these files belong to people
who are not the owner of this project.
