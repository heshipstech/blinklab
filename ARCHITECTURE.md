# Architecture

How blinklab fits together, for somebody reading it for the first time.

Roadmap row 8.2. The target is that a newcomer understands the shape in
five minutes and knows where to put their first change.

## The one rule that shapes everything

**`src/core` is pure. It cannot import from `src/io` or touch the
browser.** No `document`, no `window`, no camera, no canvas. Lint
enforces it.

Everything that decides anything lives in `core` as a function from
values to values. Everything that talks to the world lives in `io`.
`main.ts` is the wiring between them.

That is why 798 unit tests run in about three seconds with no browser. A
blink detector that takes numbers and returns numbers can be tested on a
hand written series where you know the answer, and most of this project's
real defects were found that way.

## The flow of one frame

```
camera or video file
        |
    src/io/frameLoop.ts        one tick per decoded frame
    src/io/videoStepper.ts     for a file: SEEK to each frame, never play
        |
    src/core/frameClock.ts     is this a NEW frame? reject duplicates
        |
    src/io/landmarker.ts       MediaPipe, 478 face points
        |
    src/core/landmarkGuard.ts  refuse a model that broke its contract
    src/core/headPose.ts       pitch, yaw, roll
    src/core/validityGate.ts   too far turned? mark INVALID, do not guess
        |
    src/core/aperture.ts       eyelid gap, in MILLIMETRES via the iris
        |
        +--> src/core/baseline.ts    learn this person's open eye, 30 s
        +--> src/core/blink.ts       the blink state machine
        +--> src/core/perclos.ts     eyes closed share of the last minute
        +--> src/core/longClosure.ts closure past half a second
        +--> src/core/gazeOffset.ts  iris position -> where on screen
        |
    src/core/featureRecord.ts  one typed row per second
        |
    src/core/score.ts          100 minus four named penalties
        |
    src/core/csv.ts            export, one row per second + a blink log
```

## The ideas worth knowing before you change anything

**The iris is the ruler.** A human iris is close to 11.7 mm across in
everyone, so measuring it in pixels converts everything else into
millimetres. That is what makes a reading survive somebody leaning
towards the camera. `src/core/aperture.ts`.

**Thresholds are personal, not universal.** The blink line is half of
each person's own learned open aperture, not a number from a paper.
Eyes differ enough that a fixed threshold measures the person rather
than the blink. `src/core/baseline.ts`.

**Null means not measured. Zero means measured as zero.** This runs
through the whole codebase. A blink whose shape could not be analysed
exports an empty cell, never `0`, because zero millimetres of lid travel
is a claim about somebody's eyelid. Refusing is preferred to guessing
everywhere.

**A file is timed by its own clock, never the wall clock.** Process a
ten minute clip in thirty seconds and wall clock timing would report a
blink rate twenty times too fast. `src/core/frameClock.ts`. This was
also the site of a defect that made measurements unrepeatable until
August 2026: the face model was separately handed a wall clock reading
and uses the gap between readings to track a face.

**Buffers are bounded by TIME, not by count.** A trace covering a ten
second window keeps ten seconds of samples, whatever the frame rate. The
previous approach capped the sample count, and the cap was chosen for
60 frames per second, so on a 120 Hz display it silently held only 9.2
seconds. `withinWindow` in `src/core/sparkline.ts`.

## Layout

```
src/core/     pure logic, no browser, ~45 modules, this is the project
src/io/       camera, video files, MediaPipe, canvas, downloads
src/main.ts   wiring and the DOM. The only file that builds the page
test/core/    unit tests, one per core module
test/e2e/     Playwright. Chromium in CI, WebKit added locally
analysis/     Python. Reads exported CSV, does statistics. Never measures
tools/        the corpus runner, which drives the real built app
docs/evidence/ the data behind published claims
```

**`analysis/` never measures anything.** It reads the CSV files the
browser produced. A Python reimplementation of the measurement would be
evaluating the reimplementation, so the benchmark drives the real built
app in a real browser through `tools/measure_corpus.mjs`.

## Where to make your first change

| You want to                       | Go to                                                          |
| --------------------------------- | -------------------------------------------------------------- |
| Change how a blink is detected    | `src/core/blink.ts` and its test                               |
| Change a threshold                | `src/core/constants.ts`, where each carries its origin         |
| Add a measurement                 | a new pure module in `core`, a test, then wire it in `main.ts` |
| Change the page                   | `src/main.ts`                                                  |
| Analyse exported data             | `analysis/`, in Python                                         |
| Understand a number in the README | `docs/evidence/2026-08-09/`                                    |

## Conventions that will surprise you

**Constants carry their reasoning.** `src/core/constants.ts` is mostly
prose. Each threshold records where it came from, what was tried before,
and what broke. It is the most useful file in the repository to read
first, and it is long on purpose.

**Comments explain why, not what.** A comment saying what the next line
does is noise. A comment saying which bug the line prevents is the
reason the line survives a refactor.

**Every gate runs before every pull request.** `npm run lint`,
`typecheck`, `test`, `e2e`, `format:check`, `build`, and in `analysis/`
`ruff check`, `ruff format --check` and `pytest`. The list is in
`STATE.md` and was checked against the CI workflow rather than
remembered.

**Wrong answers stay published.** The README prints three different
values for the same benchmark, because the project got it wrong twice.
If you correct a number, add a column rather than replacing one.

## What is not here yet

No ARCHITECTURE diagram beyond the text above. No dependency injection
framework, no state management library, no build step for the Python
side. `main.ts` is long and does the wiring by hand, which is honest for
its size and would not survive a second developer without being split.

That last point is the most likely thing a new engineer would want to
change first, and it is a reasonable thing to want.
