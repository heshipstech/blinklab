# UI specification

Every element the page can show, when it appears, and every string it can
contain. Written so a layout can be designed against worst cases rather
than against whatever happened to be on screen when someone looked.

Extracted from `src/main.ts` and the `src/core` message functions rather
than from memory. Where a string is produced by a tested pure function,
that function is named, because those strings cannot be changed without
changing a test.

---

## 1. Page anatomy

Four regions, top to bottom. Only the first two are ever visible before a
session starts.

| Region         | Width                                | Present when                    |
| -------------- | ------------------------------------ | ------------------------------- |
| Graph strip    | Full window                          | Running only                    |
| Demo notice    | Full window                          | **Always**, cannot be dismissed |
| Content column | 1280 px, centred, 16 px side padding | Always                          |
| Overlays       | Full window, above everything        | Only when opened                |

The content column contains the title, then nine boxes in five rows:

| Column      | Cards                           | Notes                        |
| ----------- | ------------------------------- | ---------------------------- |
| Left, 55fr  | Alertness, Source, Live signals | Source holds the 640px video |
| Right, 45fr | Session, Gaze, Eyes, Blinks     | Each flows independently     |
| Full width  | Stored on this device           | Below both columns           |
| Full width  | Report                          | Last, below storage          |

The two columns are real elements, so each flows independently and Source can
be tall without stretching Gaze beside it.

**Below 1000px there is one column, and the order is not the desktop order.**
The column wrappers become `display: contents`, every card becomes a direct
grid item, and the stylesheet orders them by id: Alertness, Session, Source,
Gaze, Eyes, Blinks, Live signals, Stored on this device, Report. That is reading order
for a phone: the score, what starts a session, the camera, what it measured,
the instrument's own health, then storage. Doing it with `order` rather than a
second DOM tree means one list of cards, not two that can disagree.

**Below 560px a label and its value stop being two columns and become two
lines.** There is one set of strings at every width, deliberately; the
alternative was a second set for phones and a second list to document.

**This table is checked, not remembered.** `tools/uiGuard.mjs` reads every
`box("...")` heading out of `src/main.ts` and a test fails when one of them
has no section in this file, or when this file documents a box that no
longer exists. Remediation F3. Until 15 August nothing could fail here, and
the file had drifted: it described five boxes in three tiers, put Session in
a tier of its own, and documented an "Instrument" box that had become the
footer of Live signals.

---

## 2. What drives visibility

One state variable governs almost everything. It has seven values.

| State        | Meaning                                  |
| ------------ | ---------------------------------------- |
| `idle`       | Nothing started                          |
| `requesting` | Waiting for the camera permission prompt |
| `running`    | A camera or clip is active               |
| `denied`     | Camera permission refused                |
| `noCamera`   | No camera on the device                  |
| `failed`     | Camera failed for another reason         |
| `clipFailed` | A video file could not be used           |

**The rule: everything except the Source box is hidden unless the state is
`running`.** Whole boxes are hidden, not individual readouts.

A second variable, the frame source, is `camera` or `file`, and changes
three things: the resolution line's wording, whether the sleepiness
questions are asked, and whether blink log frame numbers exist.

---

## 3. Region 1: Graph strip

Full window width, above everything. Hidden entirely, occupying zero
height, unless running.

| Element               | Content                     | Notes                         |
| --------------------- | --------------------------- | ----------------------------- |
| Sparkline             | Eye aspect ratio, last 10 s | Blue line, gaps drawn as gaps |
| Horizontal gaze trace | Raw and smoothed            | Grey raw, orange smoothed     |
| Vertical gaze trace   | Raw and smoothed            | Same                          |

All three resize to the window width. Height is fixed per canvas.

---

## 4. Region 2: Demo notice

Full window width, grey background, centred text, normal weight. Always
present. Cannot be dismissed by any interaction.

Text is `DEMO_NOTICE` from `core/notice.ts`, a tested constant:

> Demo, not a safety or medical device. This is a learning project. It is
> not for clinical, workplace or safety use, its numbers are not
> diagnostic, and it has not been validated against any medical standard.
> Your video and your measurements never leave your browser. The face model this page bundles does send anonymous usage statistics to Google.

**Wraps to two lines at 1512 px, three on narrower windows.** Budget for
three.

---

## 5. Region 3: The content column

### 5.1 Title

`Alertness demo`. Always visible. Single line. The browser tab title is
`blinklab`, which is a different string in `index.html` and is not this
one. This section said `blinklab` until 16 August, describing the tab
rather than the page.

### 5.2 Box: Source

**Always visible, in every state.** The only box present before starting.

| Element                    | Type                            | Visible when                                                                                                                                                                                                                                | Disabled when                                                                                                                                                          |
| -------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start camera               | Button                          | Not `running`, not `requesting`, not `loadingClip`. Shown on `ended`, which is where Stop and a finished clip both land since roadmap 14.0a (issue #303 used to keep a finished clip `running` under a flag so this button could come back) | Never                                                                                                                                                                  |
| Stop camera                | Button                          | Only while a live camera session is `running` (never for a clip). The intentional end of a session: the pilot's report renders only after the camera stops, and until this button a live session could only end by closing the tab          | Never                                                                                                                                                                  |
| Or measure a recorded clip | File input                      | Always                                                                                                                                                                                                                                      | A start is in flight (`requesting` or `loadingClip`): a second source picked inside the first request's latency was how a live track escaped ownership (roadmap 14.0d) |
| Measure every frame        | Checkbox, **ticked** by default | Always                                                                                                                                                                                                                                      | Never                                                                                                                                                                  |
| Stop measuring             | Button                          | Only during a stepped clip run                                                                                                                                                                                                              | Never                                                                                                                                                                  |
| Camera picker              | Dropdown                        | Only if more than one camera exists                                                                                                                                                                                                         | A start is in flight (`requesting` or `loadingClip`): a second source picked inside the first request's latency was how a live track escaped ownership (roadmap 14.0d) |
| Status line                | Text                            | Always                                                                                                                                                                                                                                      | n/a                                                                                                                                                                    |
| Model status               | Text                            | Always, but usually empty                                                                                                                                                                                                                   | n/a                                                                                                                                                                    |

#### Status line, every possible string

From `cameraStateMessage` in `core/cameraState.ts`:

- `idle`: The camera is off. Click "Start camera" to begin.
- `requesting`: Waiting for your answer to the camera permission prompt.
- `running`: _(empty, then reused by the clip messages below)_
- `denied`: Camera permission was denied. To use blinklab, allow camera access for this site in your browser settings, then reload the page.
- `noCamera`: No camera was found on this device. Connect one and reload the page.
- `failed`: The camera could not start (REASON). Reload the page and try again.
- `clipFailed`: passes a written reason straight through, for example: This browser could not decode NAME. Try an MP4 or WebM file.
- `modelFailed`: The measuring model could not be loaded, so nothing can be measured. This is often a network problem. Check your connection, then click "Retry loading the model". _(added by remediation B2, PR #223; this list omitted it until 2026-08-14)_
- `measurementFailed`: Measurement stopped because of an internal error (REASON). Anything recorded before the stop is kept for export. Reload the page to measure again. _(added by remediation B3, PR #224)_
- `ended`: The session has ended. What it recorded is kept: export the CSV or the blink log, or show the report. Click "Start camera" to begin a new session. _(roadmap 14.0a: reached from Stop camera and from a finished clip; the clip paths then overwrite the line with their own finished sentence below)_
- `cameraStopped`: The camera stopped delivering frames (REASON). Anything recorded before the stop is kept for export. Click "Start camera" to try again. _(roadmap 14.0d: REASON is `no frames in the last 5 s`, `the camera track is muted, no frames in the last 5 s`, or `the camera track ended`; the record, the exports and the report stay on offer as after `ended`)_

`modelFailed` is the only state that brings its own control with it: a
**"Retry loading the model"** button, rendered beside the status line. Every
other state is text only.

While a clip runs, the same line carries:

- Loading the model before the clip starts...
- Measuring every frame: N done, P% of the clip, about T left.
- Measuring every frame: N done, P% of the clip. _(before 5% is measured, no estimate yet)_
- Measuring every frame: N done. This can take several minutes. _(clip length unknown)_
- Measuring every frame: N done. Still working: S s reading the first frame. A large or high-resolution clip can take a while. _(heartbeat, issue #302: written once a second after 5 s with no completed frame, so stillness on this line genuinely means a frozen page)_
- Measuring every frame: N done. Still working: S s since the last frame finished. _(same heartbeat, after the first frame)_
- Stopping after this frame...
- Measured N frames at R frames per second, in T s. Check that rate against your clip. Export the CSV, or pick another clip.
- Stopped after N frames. Export the CSV to keep what was measured, or pick another clip.
- The clip finished. Export the CSV, show the report, or pick another clip.
- No frames could be read from this clip. The file loaded, but seeking through it produced nothing. Try another browser, or re-save the clip as MP4.

**Longest is about 130 characters. Budget two lines.**

#### Model status, every possible string

From `landmarkValidationMessage` in `core/landmarkGuard.ts`. Empty in
normal operation. One failure string, and it is long:

> The face model returned N landmarks instead of 478. This model variant
> lacks the iris points that measurements need, so measurement is
> stopped. Reload the page; if this persists, the bundled model file is
> wrong.

**Budget three lines for the failure case.**

### 5.3 The video (not in a box)

Visible while running and after the session has `ended` (or
`measurementFailed`): the last frame stays as the picture of what was
recorded. Hidden in every other state, because an empty canvas reads
as a failure.

| Element                 | Notes                                                                                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas                  | Sized to fit 640 px wide, aspect preserved from the source                                                                                                                                                                                                    |
| Mirror                  | Checkbox. **Ticked** when the camera is the source, **unticked** when a clip loads (issue #301: a mirror is for a face looking at itself, and mirrored recordings showed backwards text). Toggling redraws the current frame even when no frames are flowing. |
| Eye markers             | Checkbox, **unticked** by default                                                                                                                                                                                                                             |
| Face mesh               | Checkbox, **unticked** by default                                                                                                                                                                                                                             |
| Resolution or clip line | Text                                                                                                                                                                                                                                                          |

The three checkboxes and the resolution line share one row.

Resolution line, two forms:

- Camera resolution: W x H pixels
- Clip: FILENAME, W x H pixels, D s _(or "unknown length")_

**A filename can be arbitrarily long. Budget for wrapping or truncation.**

Drawn on the canvas, all optional and all off by default:

- Eyelid dots, white, from the eye landmark sets
- Iris rings and centres, orange
- Face mesh, all 478 landmarks as faint grey dots

### 5.4 Box: Alertness

Visible only when running. Sits in the top row, in the right column above
Session. Contains the only large text on the page.

| Element       | Type                     | Visible when                       |
| ------------- | ------------------------ | ---------------------------------- |
| Score         | Large text               | Running                            |
| Caveat        | Small grey text          | Running, always, never conditional |
| Panel summary | Text                     | Running                            |
| Panel list    | List, 0 to 3 items       | Running                            |
| Alert banner  | Text, styled as an alert | Only while an alert is live        |

Score, three forms:

- Alertness score: N / 100
- Alertness score: no face in frame
- Alertness score: measuring... _(until PERCLOS exists, about 45 s)_

Caveat, from `demoNoticeShort()`: Demo, not a safety or medical device.
Not diagnostic.

Panel summary, from `panelSummary` in `core/scorePanel.ts`:

- Nothing is costing points.
- Top drivers of the score:
- N signal unavailable. / N signals unavailable.

Panel list: **zero to three items**, never more, even though the score has
four parts. Each reads like `eyes closed share, 20 points`.

Alert banner: `Alert: long eye closure (alerts: N, suppressed: M)`. Hidden
whenever an alert is not live, and always hidden when not running.

### 5.5 The measurement row: three boxes side by side

All three visible only when running. They sit in a grid that **stacks
vertically below about 1000 px of column width.**

#### Box: Blinks

The blink log is a **table**, not a prose list. Units live in the header rather
than on every cell, figures are mono and right-aligned so an odd row is visible
rather than merely readable, about five rows show at a time and it scrolls past
that, sideways too on a phone.

| When (s) | Closed for (ms) | Amplitude (mm) | Speed (mm/s) | A/V (ms) |

A row whose amplitude is under `FAINT_BLINK_MM` (1.5 mm) is **greyed, not
hidden**: the export keeps it, so the panel must not disagree with the file.
An unmeasurable shape shows an em dash per cell rather than a blank, because a
blank cell reads as a rendering fault.

| Element            | Strings                                                                                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blink count        | `Blinks: N` or `Blinks: N (last: T ms)`                                                                                                                                                      |
| Frame rate refusal | Blink metrics not measurable: F fps is below the 25 fps a short blink needs. _(or)_ Blink metrics not measurable: the frame rate is still unknown.                                           |
| Personal threshold | `Personal blink threshold: X mm (half of your Y mm baseline)` or `Learning your open eyes: N s left`                                                                                         |
| Ruler fit          | `Ruler fit: waiting for the baseline`, then `Ruler fit: baseline is R x your resting eye (ceiling 1.25)`, with `, too long to trust` added (and the warning colour) once the verdict settles |
| Last blink shape   | `Last blink shape: amplitude X mm, peak closing Y mm/s, A/V Z ms`, or empty until the first analysable blink                                                                                 |
| Blink log          | A list, **capped at 50 entries**, newest first. Each: `T s, D ms, A mm at V mm/s, A/V Z ms` or `T s, D ms, shape unavailable`                                                                |

**The blink log is the only element with unbounded vertical growth up to
its cap. At 50 entries it is by far the tallest thing on the page.**

#### Box: Eyes

| Element          | Strings                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Aperture         | `Eyelid aperture, right: X mm, left: Y mm` or `Eyelid aperture: no valid measurement`              |
| Eye aspect ratio | `Eye aspect ratio, right: X, left: Y` or `Eye aspect ratio: no valid measurement`                  |
| Stability        | `Aperture stability over 10 s, px CV: X%, mm CV: Y%` or `Aperture stability: measuring...`         |
| PERCLOS          | `PERCLOS (eyes closed share, last 60 s): X%` or `... : measuring...`                               |
| Long closures    | `Long closures: N` or `Long closures: waiting for the baseline`, optionally with `(suppressed: M)` |

#### Box: Gaze

| Element         | Strings                                                                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Iris offset     | `Iris offset, right: X / Y, left: X / Y` or `Iris offset: no valid measurement`                                                                                                   |
| Looking toward  | `Looking toward: QUADRANT (calibrated)` / `(uncalibrated)` / `off screen (uncalibrated)` / `no valid measurement`                                                                 |
| Gaze state      | `Gaze state: fixating for X s` / `Gaze state: moving` / `Gaze state: no valid measurement`                                                                                        |
| Fixations       | `Fixations in the last 10 s: N, duration mean X ms, median Y ms, longest Z ms` or `Fixations in the last 10 s: none yet`                                                          |
| Head pose       | `Head pose, pitch: X°, yaw: Y°, roll: Z°` or `Head pose: no valid measurement`                                                                                                    |
| Pose gate       | Empty normally. Otherwise: `Head turned too far: AXIS is X°, limit Y°. Eye measurements paused until you face the camera again.` or `Head pose unknown. Eye measurements paused.` |
| Calibrate gaze  | Button. Label becomes `Recalibrate gaze` once a profile exists                                                                                                                    |
| Gaze heatmap    | Button. Label `Gaze heatmap` when enabled, `Gaze heatmap (calibrate first)` when disabled                                                                                         |
| Replay scanpath | Button. Label `Replay scanpath` when enabled, `Replay scanpath (run the heatmap first)` when disabled                                                                             |

**The fixations line is the longest single readout on the page, around
90 characters. The pose gate message is longer still at about 120, and it
appears without warning whenever the head turns.**

### 5.6 Session and Live signals, smaller grey type

Both visible only when running. Session sits under Alertness in the top
row; Live signals is full column width on its own, and carries the graph
strip plus the footer below.

#### Box: Session

| Element            | Type   | Notes                                                                                                                                                                                      |
| ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Feature records    | Text   | `Feature records: N this session (about one per second)`, changing after an hour to `Feature records: last 3600 kept, oldest discarded (about one per second)`                             |
| Export CSV         | Button | Disabled until at least one record exists                                                                                                                                                  |
| Mark this moment   | Button | Disabled until at least one record exists, and again once the session has ended (a marker names a moment of a running measurement). Each click writes a timestamped marker into the export |
| Export state       | Text   | Empty until an export is attempted. See the five strings below                                                                                                                             |
| Sleepiness         | Text   | Empty until asked. `Sleepiness: before 2 Very alert, after skipped`. Each half reads `not asked yet`, `skipped`, or the rating and its published label                                     |
| Marks              | Text   | `Marks: 1 at 42.0 s, 2 at 55.5 s`, empty until the first click                                                                                                                             |
| Export blink log   | Button | Disabled until at least one blink exists                                                                                                                                                   |
| Export frame trace | Button | Disabled until a clip frame has been measured. Clips only: a camera session never records the per-frame trace (docs/miss-trace.txt)                                                        |
| Sleepiness panel   | Panel  | See below                                                                                                                                                                                  |
| Record fixture     | Button | **Development builds only.** Never on the live site                                                                                                                                        |

**Every export outcome says what happened, including the successful one.**
The button had three outcomes and only one was visible, so a click that was
merely waiting looked like a broken button:

- `Almost there: answer the sleepiness question below and the file will download.`
- `Nothing to export yet: no measurements have been recorded in this session.`
- `Nothing to export yet: no blinks have been detected in this session.`
- `Nothing to export yet: the frame trace is recorded for measured clips only.`
- `Exported NAME. Check your downloads.`

From `core/exportStatus.ts`. The sleepiness panel also scrolls itself into
view when it opens, with `block: "nearest"` so it moves the page as little as
possible: scrolling during a session moves the eyes being measured.

**What the CSV export contains, since the person may send it to someone.**
Above the header, `# key: value` metadata lines: the source and clip, the
measurement mode and frame count, **the camera's name, negotiated resolution
and declared frame rate, the facing mode, the user agent, core count, viewport,
screen, pixel ratio and orientation**, then the session's observed duration,
record count, face-detected fraction, **the measurement frame and the median
iris width in that frame's pixels**, visibility changes and any markers, then
the two sleepiness ratings.

`measurement_frame` is the video the face model actually read, not the canvas
the page draws. The canvas is capped at 640 wide for display, so an iris width
in canvas pixels understated the real resolution by exactly the display scale.
Aperture in millimetres is a ratio of iris pixels to lid pixels and survives
any display scale; the iris width alone does not, which is why it travels with
its frame. Below that, one row
per second of the 16 measurement columns.

`deviceId` is deliberately **not** collected: it is a stable per-origin
identifier for one camera, which is a fingerprint rather than a measurement.

**The marker exists because ground truth cannot be found by the instrument
being tested.** A validation protocol asks for ten deliberate blinks, so ten is
known. Locating those ten in the export by hunting for a burst of ten
detections fails exactly when the instrument missed them, which is the case
worth measuring. A marker makes the truth "ten blinks between marker 1 and
marker 2", whatever the instrument thought.

**Sleepiness dialog.** A modal over a dimmed page, not a panel in this card.
It was a panel until 16 August, and because the export waits on its answer, a
card that can run past the fold plus a question that gave no sign of itself
produced a report that Export CSV was broken when it was only waiting.

It is **deliberately not closable** by the backdrop or by Escape: every way out
records an answer, Skip included, and a dismissal that recorded nothing would
leave a file that cannot say whether the question was declined or never asked.
Focus moves into the dialog on open. The answer it records then appears in the
Session card, because that answer goes into the exported file and being able to
see what you said is part of trusting the data.

Never appears at all on a clip session. Two prompts:

- Before you begin: how sleepy do you feel? _(on starting a camera)_
- How sleepy do you feel now? _(on the first CSV export)_

Ten buttons: the nine Karolinska ratings plus Skip. The nine labels are
published wording and must not be reworded:

1 Extremely alert · 2 Very alert · 3 Alert · 4 Rather alert · 5 Neither
alert nor sleepy · 6 Some signs of sleepiness · 7 Sleepy, but no effort to
keep awake · 8 Sleepy, some effort to keep awake · 9 Very sleepy, great
effort to keep awake, fighting sleep

**Option 9 is 58 characters. This panel is the widest fixed content in
the column.**

#### Box: Live signals

The two numbers in its footer. They are not measurements of the eyes, but
they are measurements of the signal on the strip above them.

| Element         | Strings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Processing rate | `Processing rate: N frames per second, the instrument's pace, not the camera's` or `Processing rate: measuring...`                                                                                                                                                                                                                                                                                                                                                                           |
| Camera delivery | `Camera delivery: N frames per second, of which this instrument read M`, or `Camera delivery: measuring...`, or `Camera delivery: no frames in the last 5 s` (delivery is observed and the window drained: one tick later the session ends as `cameraStopped`), or `Camera delivery: this browser does not report it` (only when no delivery callback exists). Camera sessions only: a clip is stepped off its own media clock, so every decoded frame is read exactly once by construction. |
| Inference time  | `Inference time: N ms` with `, over the 30 ms budget` appended when over                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Rate warning    | Camera sessions only, when the evidence rate sits below 60: `Blink counts may be low on this computer: it is processing N frames per second...` when the machine binds, or `Blink counts may be low with this camera: this instrument is reading N distinct camera frames per second...` when the camera does. This row was missing from this table from 20 to 24 August 2026 while the warning was on the page — added with the second sentence.                                            |

### 5.7 Box: Stored on this device

Always visible, running or not, because a visitor deciding whether to
calibrate wants to know what that will leave behind BEFORE they do it, not
after. It sits last in the column: it is read between sessions rather than
during one, and it is the only box whose button destroys something.

_(added by remediation E3; the two keys had been written since increment 5.4a
with nothing on the page saying so and no way to erase them)_

| Element     | Strings                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Summary     | `Nothing is stored on this device.` or `Stored on this device now: N of M.` or `This browser will not let the page read its own storage, so what is stored here cannot be listed or erased from this page.`                                                                                                                                                                                                                                                                   |
| List        | One line per stored item, rendered from `core/storedData.ts`: what it holds, why it is kept, and the storage key in brackets                                                                                                                                                                                                                                                                                                                                                  |
| Pseudonym   | Text input + `Save pseudonym` button (pilot increment 8). Voluntary identity: a pseudonym exists only when a person types one and saves it, never invented on load. Saving an empty field removes it. Over-long input is refused with `Not saved: a pseudonym is one short name, at most 64 characters.`, never truncated. Status lines: `Saved. Your exports will carry the name "X".`, `Pseudonym removed. Your exports will carry no name.`, or the refused-write sentence |
| Erase       | Button. `Erase stored data`, then `Click again to erase it` once armed. Disabled as `Erase stored data (nothing stored)`, or as `Erase stored data (this browser will not let the page look)`                                                                                                                                                                                                                                                                                 |
| Erase state | Hidden until an erase is attempted. `Erased. Nothing is stored on this device now.` or `Erase did not work: N of M item(s) is/are still stored.` or `Tried to erase, but this browser will not let the page read its storage, so the result cannot be confirmed here.`                                                                                                                                                                                                        |

**The two disabled states say different sentences on purpose.** "Nothing
stored" and "cannot look" mean opposite things, and an early draft used the
first for both, so a browser refusing to be read produced a button claiming a
clean device directly under a summary saying it could not tell.

**Erasing takes the live profile with it.** The in-memory calibration profile
is cleared too, so the heatmap button returns to `Gaze heatmap (calibrate
first)` and the calibrate button back to `Calibrate gaze` in the same click.

### 5.8 Box: Report

The participant report (docs/assessment-pilot-plan.md, increment 6).
Full width, after Stored on this device: it is read once a session is
over, and it sits past the erase control so every mid-session control
stays above it.

| Element | Strings                                                                                                                                                                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gate    | `The session has ended; the report is ready.` or `The report renders only after the session ends — stop the camera first. A participant who reads it mid-session has learned what the instrument counts.`                                       |
| Show    | Button, `Show the report`. Disabled unless `reportAvailable` in `core/participantReport.ts` says the session has ended with records — pinned by test: never while `running`, `requesting` or `loadingClip`, and never with nothing recorded     |
| Export  | Button, `Export report`. Same gate as Show. Downloads `blinklab-report-<stamp>.txt` — the SAME bytes the panel shows, plain text, filename refused by `.gitignore` and read by `tools/exportGuard.mjs` like every other download                |
| Status  | Text under the buttons. Empty until an export, then `Exported blinklab-report-<stamp>.txt. Check your downloads.`                                                                                                                               |
| Report  | A `<pre>` holding the whole plain-text report from `buildParticipantReport` in `core/participantReport.ts`: eight numbered sections, refusals first, the three absence words (`withheld — reason`, `unknown`, `not applicable`) pinned distinct |

**The report is plain text on purpose.** One pure builder produces the
panel's text today and the exported file's bytes in increment 7, so the
two renderings can never disagree; a report a reviewer can diff beats a
report that needs a browser. A new session clears it with the records
it described.

---

## 6. Region 4: Overlays

Both cover the whole window and sit above everything.

### Calibration overlay

Opens on Calibrate gaze. Closes on any click, or on completion.

| Element  | Content                                                    |
| -------- | ---------------------------------------------------------- |
| Dot      | Moves through nine positions at 10%, 50%, 90% of each axis |
| Progress | `Follow the dot (N/9). Click anywhere to cancel.`          |

### Heatmap overlay

Opens on Gaze heatmap. Requires a calibration profile.

| Element         | Content                                                        |
| --------------- | -------------------------------------------------------------- |
| Heatmap canvas  | A test image with dwell shown as orange heat                   |
| Caption         | `Gaze heatmap accumulating over a test image`                  |
| Scanpath slider | Visible only after samples exist. Shows `Replay at X s of Y s` |

---

## 7. Quick reference: what is on screen in each state

| State                                           | Visible                                                      |
| ----------------------------------------------- | ------------------------------------------------------------ |
| `idle`                                          | Notice, title, Source box                                    |
| `requesting`                                    | Notice, title, Source box (Start camera hidden)              |
| `denied` / `noCamera` / `failed` / `clipFailed` | Notice, title, Source box with the reason in the status line |
| `running`                                       | Everything                                                   |
| Calibrating                                     | Everything, plus the calibration overlay on top              |
| Heatmap open                                    | Everything, plus the heatmap overlay on top                  |

---

## 8. Designing for real estate: the worst cases

The things that will break a layout, in order of how likely they are to
surprise you.

1. **The blink log grows to 50 entries** and is the tallest element on the
   page. Everything below it moves down. Consider a fixed height with
   internal scrolling.
2. **The pose gate message appears without warning** whenever the head
   turns too far, adding about two lines to the Gaze box mid-session.
3. **The sleepiness panel's option 9** is 58 characters and sets the
   minimum comfortable width of the Session box.
4. **A long clip filename** appears verbatim in the resolution line.
5. **The model failure message** is three lines and appears only when
   something is badly wrong, which is exactly when it must be readable.
6. **Tier 2 stacks below about 1000 px** of column width, tripling the
   height of the middle of the page.
7. **Nothing has a loading skeleton.** Readouts say `measuring...` or
   `no valid measurement` rather than appearing later, so the number of
   lines does not change as values arrive. This is deliberate: a layout
   that reflows as measurements arrive is unreadable during the first
   minute, which is exactly when someone is deciding whether to trust it.

## 9. Rules that constrain any redesign

Three, and they are not stylistic.

**Nothing moves further from the camera than it is now.** Reading low and
to the left lowers the eyelid and biases the measurement the instrument is
taking. This is why the column is centred and why the readouts are not in
a sidebar.

**The demo notice cannot be dismissed, moved below the fold, or made
subtle enough to skip**, and the short caveat cannot be separated from the
score. A screenshot of the number must carry the caveat with it.

**The graph strip stays full width at the top**, because a single
screenshot of the top of the page has to carry the traces plus as many
readouts as fit.
