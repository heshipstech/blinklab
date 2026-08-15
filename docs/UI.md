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

The content column contains, in order: the title, then eight boxes. Source
sits beside a stacked Alertness and Session; then Live signals full width;
then Gaze, Eyes and Blinks side by side; then Stored on this device, last
and alone. The video sits inside the top row beside Source.

**Caution, and it is not fixed here.** The tier headings in section 5 below
(5.4 "tier 1", 5.5 "tier 2", 5.6 "tier 3") describe an earlier arrangement
and no longer match `src/main.ts`: Session is in the top row rather than a
third tier, and the "Instrument" box named in 5.6 is now the footer of Live
signals. The per-element strings in those sections are current, which is
what PR #243 checked and completed. The layout prose around them is not.
Counted from `contentBox.append` on 2026-08-15.

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

`blinklab`. Always visible. Single line.

### 5.2 Box: Source

**Always visible, in every state.** The only box present before starting.

| Element                    | Type                            | Visible when                        | Disabled when |
| -------------------------- | ------------------------------- | ----------------------------------- | ------------- |
| Start camera               | Button                          | Not `running`, not `requesting`     | Never         |
| Or measure a recorded clip | File input                      | Always                              | Never         |
| Measure every frame        | Checkbox, **ticked** by default | Always                              | Never         |
| Stop measuring             | Button                          | Only during a stepped clip run      | Never         |
| Camera picker              | Dropdown                        | Only if more than one camera exists | Never         |
| Status line                | Text                            | Always                              | n/a           |
| Model status               | Text                            | Always, but usually empty           | n/a           |

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

`modelFailed` is the only state that brings its own control with it: a
**"Retry loading the model"** button, rendered beside the status line. Every
other state is text only.

While a clip runs, the same line carries:

- Loading the model before the clip starts...
- Measuring every frame: N done, P% of the clip, about T left.
- Measuring every frame: N done, P% of the clip. _(before 5% is measured, no estimate yet)_
- Measuring every frame: N done. This can take several minutes. _(clip length unknown)_
- Stopping after this frame...
- Measured N frames at R frames per second, in T s. Check that rate against your clip. Export the CSV, or pick another clip.
- Stopped after N frames. Export the CSV to keep what was measured, or pick another clip.
- The clip finished. Export the CSV, or pick another clip.
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

Visible only when running.

| Element                 | Notes                                                      |
| ----------------------- | ---------------------------------------------------------- |
| Canvas                  | Sized to fit 640 px wide, aspect preserved from the source |
| Mirror                  | Checkbox, **ticked** by default                            |
| Eye markers             | Checkbox, **unticked** by default                          |
| Face mesh               | Checkbox, **unticked** by default                          |
| Resolution or clip line | Text                                                       |

The three checkboxes and the resolution line share one row.

Resolution line, two forms:

- Camera resolution: W x H pixels
- Clip: FILENAME, W x H pixels, D s _(or "unknown length")_

**A filename can be arbitrarily long. Budget for wrapping or truncation.**

Drawn on the canvas, all optional and all off by default:

- Eyelid dots, white, from the eye landmark sets
- Iris rings and centres, orange
- Face mesh, all 478 landmarks as faint grey dots

### 5.4 Box: Alertness (tier 1)

Visible only when running. Full column width. Contains the only large
text on the page.

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

### 5.5 Tier 2: three boxes side by side

All three visible only when running. They sit in a grid that **stacks
vertically below about 1000 px of column width.**

#### Box: Blinks

| Element            | Strings                                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blink count        | `Blinks: N` or `Blinks: N (last: T ms)`                                                                                                            |
| Frame rate refusal | Blink metrics not measurable: F fps is below the 25 fps a short blink needs. _(or)_ Blink metrics not measurable: the frame rate is still unknown. |
| Personal threshold | `Personal blink threshold: X mm (half of your Y mm baseline)` or `Learning your open eyes: N s left`                                               |
| Last blink shape   | `Last blink shape: amplitude X mm, peak closing Y mm/s, A/V Z ms`, or empty until the first analysable blink                                       |
| Blink log          | A list, **capped at 50 entries**, newest first. Each: `T s, D ms, A mm at V mm/s, A/V Z ms` or `T s, D ms, shape unavailable`                      |

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

### 5.6 Tier 3: two boxes side by side, smaller grey type

Both visible only when running.

#### Box: Session

| Element          | Type   | Notes                                                                                                                                                          |
| ---------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature records  | Text   | `Feature records: N this session (about one per second)`, changing after an hour to `Feature records: last 3600 kept, oldest discarded (about one per second)` |
| Export CSV       | Button | Disabled until at least one record exists                                                                                                                      |
| Export blink log | Button | Disabled until at least one blink exists                                                                                                                       |
| Sleepiness panel | Panel  | See below                                                                                                                                                      |
| Record fixture   | Button | **Development builds only.** Never on the live site                                                                                                            |

**Sleepiness panel.** Hidden unless asking. Never appears at all on a clip
session. Two prompts:

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

#### Box: Instrument

| Element         | Strings                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| Processing rate | `Processing rate: N frames per second, the instrument's pace, not the camera's` or `Processing rate: measuring...` |
| Inference time  | `Inference time: N ms` with `, over the 30 ms budget` appended when over                                           |

### 5.7 Box: Stored on this device

Always visible, running or not, because a visitor deciding whether to
calibrate wants to know what that will leave behind BEFORE they do it, not
after. It sits last in the column: it is read between sessions rather than
during one, and it is the only box whose button destroys something.

_(added by remediation E3; the two keys had been written since increment 5.4a
with nothing on the page saying so and no way to erase them)_

| Element     | Strings                                                                                                                                                                                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Summary     | `Nothing is stored on this device.` or `Stored on this device now: N of M.` or `This browser will not let the page read its own storage, so what is stored here cannot be listed or erased from this page.`                                                            |
| List        | One line per stored item, rendered from `core/storedData.ts`: what it holds, why it is kept, and the storage key in brackets                                                                                                                                           |
| Erase       | Button. `Erase stored data`, then `Click again to erase it` once armed. Disabled as `Erase stored data (nothing stored)`, or as `Erase stored data (this browser will not let the page look)`                                                                          |
| Erase state | Hidden until an erase is attempted. `Erased. Nothing is stored on this device now.` or `Erase did not work: N of M item(s) is/are still stored.` or `Tried to erase, but this browser will not let the page read its storage, so the result cannot be confirmed here.` |

**The two disabled states say different sentences on purpose.** "Nothing
stored" and "cannot look" mean opposite things, and an early draft used the
first for both, so a browser refusing to be read produced a button claiming a
clean device directly under a summary saying it could not tell.

**Erasing takes the live profile with it.** The in-memory calibration profile
is cleared too, so the heatmap button returns to `Gaze heatmap (calibrate
first)` and the calibrate button back to `Calibrate gaze` in the same click.

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
