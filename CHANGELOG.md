# Changelog

Written 15 August 2026, against the state of `main` on that date.

This file was added late, at roadmap row 8.3, after seven releases had already
shipped. Rather than invent entries nobody wrote at the time, each released
version below is summarised from its tag, its pull requests and `docs/log.md`,
and says so. `docs/log.md` remains the fine-grained record, one dated line per
increment; this file is the shape of the thing at each release.

Versions follow the phases of `ROADMAP.md`, not semantic versioning. Nothing
here is published as a package and nothing depends on it, so a minor bump means
"a phase closed", not "the API is compatible".

## Unreleased

Everything since `v0.7.0`. This is the largest gap between releases in the
project, because the August audit landed in it and remediation took priority
over shipping a version.

### The evaluation track, Phase 7

- **Measured against somebody else's ground truth for the first time.**
  Eyeblink8, eight webcam clips, 408 human-marked blinks: 87.7% recall, 83.3%
  precision, 85.4% F1. Two earlier figures for the same benchmark are published
  alongside it rather than replaced, because both were wrong for reasons inside
  this app, and the road there is part of the result.
- **The measurement repeats.** Measuring one clip three times produces
  identical files, byte for byte, which was not true of any earlier figure.
- **A null result, published as readily as a positive one would have been.**
  DROZY, 20 analysable sessions: nothing survived the Holm correction. The
  analysis plan was committed before any correlation was computed.
- **A Python analysis folder** with its own pinned toolchain and CI job, a
  session loader that refuses malformed CSV by name, and the plots.
- **A licensing gate that failed honestly.** `DATASETS.md` records roughly forty
  public datasets assessed against four requirements. None clears all four, and
  the failure turned out to be structural rather than bad luck.

### The August audit and its remediation

- **Stage A, telling the truth**: stale prose claims corrected and pinned by
  `tools/resultGuard.mjs`, dated stamps on the summary documents, third-party
  licences shipped into `dist`.
- **Stage B, no longer corrupting data or hiding failure**: the frame counter
  counts only measured frames, a failed model load has a state and a retry, a
  crash in the frame loop reports and stops instead of continuing silently, the
  blink shape window stops borrowing the previous blink's descent, and a
  returning visitor's heatmap works again.
- **Stage C, tests that can fail**: safety constants pinned by literal-valued
  tests after a mutation census found several unpinned, the shuffled-null
  control given its own witness, and five reducers taught to refuse a backwards
  clock.
- **Stage D**: the frames-per-second readout relabelled honestly as a
  processing rate. Wiring a true camera rate into the 25 fps gate is held: it
  will start refusing sessions that succeed today.

### Privacy and provenance

- **The page says what it stores and erases it on request.** Two `localStorage`
  keys had been written since the first calibration with nothing naming them.
  The confirmation is read back from the browser after the delete rather than
  assumed, and a browser that refuses to be read is reported as refusing rather
  than as empty.
- **The published page names the commit it was built from**, so `curl` on the
  live demo answers which code is live without repository access.
- **The DROZY correlations name their measuring commit**, because three of the
  seven are shape-derived and the shape window changed after they were measured.

### Guards, which are the through-line

Six checks that read the truth off disk and fail loudly when a document stops
agreeing with it: published numbers, retired claims, the DROZY measuring
commit, the UI documentation against the page's own boxes, a coverage floor on
`src/core`, and a bundle size ceiling. Plus a Definition of Done that fails a
pull request changing `src/` without a learning entry or a stated reason.

## v0.7.0 — 8 August 2026, Phase 6: the rolling state

Summarised from the tag and its pull requests.

The demo score, 0 to 100, defined as exactly 100 minus four named penalties so
the arithmetic can be checked by hand, with a panel naming the drivers. PERCLOS
over a rolling minute. A long-closure detector with a debounced alert. One
typed feature record per second, and a CSV export of them with a Karolinska
sleepiness self-report. The permanent, undismissible demo notice.

## v0.6.0 — 4 August 2026, Phase 5: gaze and attention

Gaze as a projection onto the eye's own corner axis, screen quadrants,
on-screen versus off, nine-point calibration stored on the device, One Euro
smoothing, fixations and saccades by dispersion and duration, their statistics,
a dwell heatmap, and a scanpath replay on a slider.

## v0.5.0 — 2 August 2026, Phase 4: blinks

A three-state blink reducer, a personal baseline that only ratchets upward,
closed-phase duration, blink rate over an observed-time window, blink shape as
amplitude and peak closing velocity, and a frame-rate gate that answers null
rather than zero when the rate is too low to see a blink.

## v0.4.0 — 1 August 2026, Phase 3: measurement

The eye aspect ratio, the iris as a physical ruler so eyelid aperture reads in
millimetres and survives leaning in, head pose as three named angles, and the
verification that aperture is invariant under head roll.

## v0.3.0 — 31 July 2026, Phase 2: landmarks

MediaPipe face landmarks running locally from a vendored model, the projection
bridge between normalised and pixel space, the eye and iris index constants.

## v0.2.0 — 29 July 2026, Phase 1: pixels

The camera state machine with a readable message for every failure, and the
video drawn into a canvas the app owns.

## v0.1.0 — 28 July 2026, Phase 0: foundations

The toolchain, static analysis, the first unit test, continuous integration,
deployment to GitHub Pages, and the first architecture decision records.
