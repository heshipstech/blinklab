# Chunk 5: the interface layer and the accessibility floor

Part of the August 2026 audit. See `AUDIT_PLAN.md` for scope and method.

Covers A7 (the page must never crash), A8 (the accessibility floor), B2
(the renderer never computes a measurement) and the technical debt inside
`src/main.ts`.

Completed 10 August 2026. Findings below are final for this chunk.

---

## Method

Six auditors. **Three of them built the page and drove it in a real
browser**, because accessibility and crash resistance cannot be audited
by reading source.

Every finding had to be labelled `silent-violation` or
`unreached-roadmap-work`. Roadmap row 8.8 is the accessibility pass and
it is unticked, so missing accessibility work is an openly tracked
unfinished increment, not a rule broken behind anyone's back. That
distinction decided the severity of most of this chunk.

Fifty-three findings. **Twelve tested by skeptics across two passes. Six
survived. Six were refuted.**

---

## Two corrections to earlier chunks

**The keyboard works, and focus is visible.** Chunks 1 and 2 found zero
`:focus` rules and zero keyboard listeners, and inferred the floor was
unmet. **That inference was wrong.**

Because nothing sets `outline: none` anywhere in 52 author CSS rules, the
browser's own focus ring survives. All 18 controls measured
`outline-style: auto`, `outline-width: 1px`,
`outline-color: rgb(0, 95, 204)`, and `:focus-visible` true.

Driven by keyboard alone, an auditor started the camera, loaded a clip,
stopped it, exported the CSV, answered the sleepiness question, toggled
all three view checkboxes with Space, and moved the replay slider with
arrow keys, Home and End. No element carries a `tabindex`, so the order
is natural. Disabled controls are correctly skipped. Zero uncaught
errors.

**`test/MANUAL.md` item 10 does not exist.** This audit's own brief
asserted it says "Tab through every control with the keyboard: focus is
always visible", and treated it as a promise being broken. It is in the
master prompt's suggested starting list for that file. It was never
written in. Item 10 is the eyelid-ring check.

So **no accessibility promise is being broken.** Everything here is
unreached row 8.8 work. `docs/UI.md` contains zero occurrences of
keyboard, focus, escape, tabindex, dialog or aria-modal.

---

## All five degraded states pass

Observed, not reasoned about. An auditor forced each one in Chromium
against a production build.

| State                | What the user sees                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Permission denied    | "Camera permission was denied. To use blinklab, allow camera access for this site in your browser settings, then reload the page." |
| No camera found      | "No camera was found on this device. Connect one and reload the page."                                                             |
| Wrong landmark count | Names the count, explains the iris points are missing, stops measurement, tells you to reload                                      |
| Low frame rate, live | "Blink metrics not measurable: 6 fps is below the 25 fps a short blink needs", and it **recovers** when the throttle is released   |
| Low frame rate, clip | The whole refusal paragraph, saying plainly that no blinks were measured and that this is a refusal rather than a failure          |

The 468-landmark case was produced by patching the served bundle to hand
the app 468 points. The page stayed up, frames kept flowing, and every
measurement readout dropped to "no valid measurement" rather than going
stale.

An unclassified camera failure names its own cause
("OverconstrainedError"), which is better than the specification asks
for. Non-video files, zero-byte files and one-frame clips are all
handled readably.

---

## Surviving findings

### H1. A failed model load is never reported

**High. Verified.** (A7)

The camera path runs forever with no message and no retry, looking like
a working instrument. The clip path prints **"Measured 60 frames at 60.0
frames per second"** and then, because the blink-measurable counter sits
inside the same guard, adds a second sentence misdiagnosing the missing
model as a frame-rate refusal, stating something arithmetically
impossible, and claiming "everything else in the export is still valid"
when nothing can be exported.

`SPEC.md`'s degraded-state table has five rows and a failed model load is
not one of them. A comment at `main.ts:877` says full treatment "is 2.5
territory", but row 2.5 delivered the landmark-count guard, not this.

### M1. The frame counter runs before the model exists

**Medium. Verified. This is a genuine fifth instance of silent
success.** (DEBT)

`src/main.ts:1542` increments `framesMeasured` as the **first statement**
of `processFrame`. The detector guard is 21 lines later at `:1563`.

The skeptic measured it on the **ordinary path, with no fault injected at
all**. `beginCamera` calls `void ensureLandmarker()` after setting state
to running, so every frame drawn during the model load is counted. Cold
cache at 10 Mbps: model load window 16.4 seconds, **3,027 frames counted
before the model existed, 1,429 after, and the export header reads
`# frames_measured: 4490`.**

Two thirds of a number written into a CSV describes frames nothing looked
at. Warm cache is 14 of 858, so the size tracks load time.

One correction that makes it smaller than filed: when the model **never**
loads there is no CSV to corrupt, because records are pushed inside the
guard and the export button stays disabled. The corruption happens on the
live path, where the model does eventually arrive.

### M2. A returning visitor can never open the heatmap

**Medium. Verified by observation.** (A7)

A calibration profile restored from `localStorage` never re-enables the
heatmap button. Observed: the calibrate button correctly reads
"Recalibrate gaze", proving the profile was read, while the heatmap
button stays disabled.

Every returning user must redo the full nine-dot calibration to reach
increment 5.9 and 5.10 at all. A plain functional defect, not an
accessibility one.

### M3. `docs/UI.md` has never been updated since the day it was written

**Medium. Verified.** (B2)

One commit, 2026-08-08. Fifteen `src/main.ts` commits since. It is
referenced only by `README.md:512`, which still advertises it as
complete, and by no test, lint rule or continuous integration step, so
nothing can fail when it drifts.

This matters more than an ordinary stale document. `SPEC.md:11` argues
the missing `src/ui` folder is acceptable, and `docs/UI.md` is the
compensating control for that argument. The control is void.

### M4 and M5. Two symptoms of a cause Chunk 2 already recorded

**Medium each, both duplicates.** A full `localStorage` ends the frame
loop mid-calibration; any exception in `processFrame` ends it
permanently. Both trace to the same recorded cause: `frameLoop.ts:2-5`
re-arms only after `onFrame` returns, and `processFrame` has no
`try`/`catch`.

Recorded here as symptoms so the remediation plan sees the blast radius,
not as new findings.

---

## Refuted findings

Six of twelve.

**"Both overlays are keyboard dead ends."** → **low.** True that no key
closes them, but `docs/UI.md` specifies click dismissal, focus is **not**
trapped, and the page underneath stays operable. Unreached row 8.8.

**"A wrong-shaped stored profile kills the frame loop."** → **low.**
Reproduced, but reachable only by hand-editing `localStorage`.

**"No modal semantics, focus walks behind the overlay."** → **low.**
Mechanics reproduce; it is unreached row 8.8 work already recorded.

**"The focus indicator is unreadable while an overlay is open."** →
**low.** The pixel measurement reproduces exactly, but the stated cause
was tested directly and found false. A duplicate of the missing focus
containment.

**"Revoking the camera mid-session is never noticed."** → **low, and NOT
silent success.** The skeptic pre-filled a canvas magenta and drew the
dead video element into it: **1,200 of 1,200 pixels black.** There is no
frozen frame for the model to keep detecting. Every readout refuses,
PERCLOS withdraws via its existing staleness guard, and the preview goes
solid black, which is the most visible possible signal.

The record count does climb, but those rows carry `faceDetected false`
and every measurement column empty, which is measured absence and is
correct.

What survives is small: the app never **names** the cause, showing a dead
camera as "no face in frame".

The skeptic also found something larger in passing: **the frames-per-second
readout has never been the camera's rate.** It is the animation-frame
call rate. On a 20 fps fake device the page read 70. That holds the 25 fps
gate open on a camera below it, and it is true in a perfectly healthy
session.

**"Plain HTTP on a LAN address shows the user a TypeError."** → **low.**
Reproduced with real browser enforcement on an insecure origin. The page
renders readably: "The camera could not start (TypeError). Reload the
page and try again." Constraint 7 is met. What survives is that the
reason reads "TypeError" and the advice cannot work.

---

## What is compliant

**Accessibility, beyond the floor**

- One `h1`, seven `h2` box titles, no skipped levels.
- `role="alert"` is genuinely correct: it enters the tree with
  `live="assertive"`, `atomic=true`.
- The alert never carries meaning by colour alone: the strip turns
  orange **and** reads "Alert: long eye closure".
- The blink log is a full text equivalent for the sparkline's notches,
  one timestamped row per event.
- Disabled controls state their reason in text: "Gaze heatmap (calibrate
  first)".
- **Every text colour clears WCAG 1.4.3** measured against its own
  composited background. The demo notice is 10.68:1.

**Crash resistance**

- **All eleven buffers are bounded**, checked individually.
- At the feature-record cap the label tells the truth rather than hiding
  the loss: "last 3600 kept, oldest discarded".
- `requestVideoFrameCallback` is feature-detected and degrades with a
  written, user-facing message.
- No WebGL is a non-issue: MediaPipe falls back to CPU, verified with
  `--disable-webgl2`.

**Structure**

- `npx eslint src/main.ts` exits 0, including the core-purity rule.
- `resetSession` resets 30 of the 46 module-level bindings, and the 16 it
  leaves are almost all defensible.
- **The banner `MutationObserver` is documented, load-bearing and
  verified working**, not a leftover hack.
- The clip model clock offset is a correct fix for a real MediaPipe
  constraint, not a workaround for this codebase's own mistake.

**The specification, where it has not drifted**

- All seven camera-state strings match the code exactly, including
  nested quotes.
- The model-failure string, the aperture, ratio and iris readouts, the
  alert banner and both frame-rate refusals all match word for word.
- Both stated caps are real.

---

## Carried into the final report

1. **Silent success is now five for five.** The frame counter is the
   fifth instance of the pattern this project has already named as its
   own recurring defect, and it corrupts a header in every live export
   with no fault required.
2. **A failed model load is the one degraded state with no treatment**,
   and it produces a confident false sentence rather than silence.
3. **The frames-per-second readout is the animation-frame rate, not the
   camera rate.** Found in passing while refuting something else. It
   holds the 25 fps gate open on a slower camera and is wrong in healthy
   sessions.
4. **The accessibility floor is closer than anyone thought.** Focus is
   visible, the keyboard works, contrast passes. What is missing is
   modal semantics, live regions and text equivalents for three
   graphics, and all of it is unreached row 8.8 work.
5. **`docs/UI.md` is void as a compensating control.** Either it gets a
   check that can fail, or `SPEC.md:11`'s argument for the missing
   `src/ui` needs rewriting.
