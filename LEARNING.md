# LEARNING.md

One plain English note per increment. Written for the human, not for the machine.

## 0.1 Working documents before code

The concept this increment teaches is the working document. Before writing code, we wrote four short files that act as contracts.
PROJECT.md says what we are building and, just as important, what we refuse to build. SPEC.md says how the parts must talk to each other. ROADMAP.md is the ordered list of small steps. STATE.md is a ten line snapshot of where we are.
Why this matters: software goes wrong most often not in the typing but in the deciding. When decisions live only in someone's head, every session starts with re-deciding, and re-deciding drifts.
These files also solve a practical problem: an AI assistant has no memory of past sessions unless something on disk carries it. STATE.md is that carrier. Reading three files replaces an hour of "where were we".
This idea comes back in every single session, because every session starts by reading these files. It also comes back at increment 0.8, where an ADR (architecture decision record) does the same job for decisions that are expensive to reverse.

## 0.2 The toolchain: one tool, two jobs

The concept this increment teaches is the toolchain, here a tool called Vite.
Browsers do not understand TypeScript. Someone has to translate it into JavaScript before the browser sees it. Vite is that someone, and it has two modes.
`npm run dev` starts a development server. It translates files the moment you save them and refreshes the browser for you. Nothing is written to disk. This is the mode you live in while building.
`npm run build` is the shipping mode. It translates everything once, squeezes it small, and writes the result into the `dist` folder. That folder is what a web host actually serves. Ours is currently 0.83 kilobytes.
The other new thing on disk is `package-lock.json`. You never edit it. It records the exact version of every installed package so that another machine installs precisely the same thing. It matters at increment 0.5, when a build machine that is not yours has to reproduce your setup.
Why we wrote five files by hand instead of using a generator: a generated template arrives with code nobody asked for, and the project rule is that every line must be explainable. Our whole app is currently seven lines in `src/main.ts`, and you can read all of them.

## 0.3 Static analysis: machines that read code without running it

The concept this increment teaches is static analysis. Three different machines now read every line before any human does, and each catches a different kind of mistake.
Prettier is the formatter. It only cares how code looks: indentation, line width, quotes. Its value is that style stops being a discussion. Nobody ever reviews spacing again.
ESLint is the linter. It looks for patterns that are legal but suspicious, an unused variable, a comparison that is always true. Crucially, it also enforces rules we invent ourselves.
TypeScript in strict mode is the typechecker. It tracks what kind of thing every value is, and refuses code where a number could secretly be missing or a name could be misspelled.
Our own invented rule is the most important line of configuration in the project: files in `src/core` cannot import from `io` or `ui`, and cannot touch `window`, `document` or `navigator`. That fence is what will keep every measurement function testable without a camera. We proved the fence works by writing a violating file and watching lint fail with our own error message, then deleting it.
One real world lesson came free: we had to step TypeScript back from version 7 to 6.0.3, because the lint plugin does not support the brand new compiler yet. Tools travel in convoys, and the slowest ship sets the pace.
This all comes back at increment 0.5, when CI runs these same three machines on every pull request, and at 0.4, when the first protected `core` function appears.

## 0.4 The unit test: a claim that can lose

The concept this increment teaches is the unit test, through the smallest possible example.
Our function `distance` is pure: give it the same two points, it returns the same number, and it touches nothing else in the world. Purity is what makes testing trivial. There is no camera to fake and no page to load, you call the function and look at the answer.
The first two tests state ground truth: the distance from a point to itself is zero, and the corner points of a 3 4 5 triangle are exactly 5 apart. Maths knows these answers, so the test is not our opinion.
The third test states a property: the distance from a to b equals the distance from b to a, whatever the points are. Property tests catch mistakes that example tests miss.
A test only earns its keep if it can lose. We proved ours can: flipping one minus sign to a plus inside the function made a test fail within milliseconds. A test that passes no matter what is decoration, not protection.
We also widened tsconfig so test files are typechecked. A test file with a type error would otherwise lie quietly.
This comes back constantly: increment 3.1 builds the eye aspect ratio on top of this exact `distance` function, and every threshold in the blink logic will get the same three part treatment, below, at, above.

## 0.5 CI: a stranger's computer judges every change

The concept this increment teaches is continuous integration, CI for short.
Until now, "all gates pass" meant they passed on one specific Mac, with its particular Node version, its installed tools, and any local files that never made it into git. CI removes that asterisk. On every pull request, GitHub rents us a fresh Linux machine that has nothing, checks out only what is committed, installs only what the lockfile names, and runs the exact same five commands we run locally.
The key line is `npm ci` instead of `npm install`. Plain install is allowed to make choices, ci (clean install) is not: it reproduces the lockfile exactly or fails. This is the moment increment 0.2's lockfile earns its keep.
The deeper shift is social, even in a team of two like ours. Before CI, "does it work" was a claim a person makes. After CI, it is a fact a machine certifies, visible to any stranger reading the repository. The green check is the project's reputation, rebuilt from zero on every change.
And because the workflow triggers on pull requests, the pull request that introduced it was judged by it. The test of the test machine was the test machine.
This comes back at 0.6, where branch protection makes the green check mandatory rather than polite, and at 0.7, where a second workflow deploys the page to a public URL.

## 0.6 Conventions become mechanisms

The concept this increment teaches is the process gate: the difference between a rule people follow and a rule the system enforces.
Until today, "main only changes through reviewed pull requests with green CI" was a convention. We followed it every time, but nothing stopped a tired Sunday evening push straight to main. Branch protection turns the convention into a mechanism. GitHub now rejects direct pushes, rejects merges without the green check, and rejects force pushes, for everyone, including the repository owner, including me.
A rule you must remember is a hope. A rule the machine enforces is a guarantee. Guarantees compound: because main provably always passed CI, anyone can pull any commit of main and trust it.
The same idea, softer, drives the templates. A blank issue box invites vague issues. A template with headings, what happened, what should have happened, first failing observation, does the remembering for you.
Enforcement has a price, and we paid it immediately: my little post merge STATE.md pushes to main are now impossible, so STATE.md travels inside each pull request already written in its final form. When a gate inconveniences you, that is the gate working.
This comes back every single increment from now on, and especially at 8.6 and 8.7, where coverage floors and performance budgets become mechanisms the same way.

## 0.7 Deployment: the dist folder goes public

The concept this increment teaches is deployment, which for a site like ours is less mysterious than the word sounds.
Our app has no server. `npm run build` produces the `dist` folder, a handful of plain files, and "deploying" means copying those files to a computer that answers web requests. GitHub Pages is that computer, for free. The new workflow does the copy on every merge to main: build on a clean machine, hand `dist` to Pages, done. Merging to main and publishing to the world are now the same motion.
The one real lesson lives in `vite.config.ts`, and it is the subpath problem. Our site is not at the root of a domain, it lives under `/blinklab/`. A page that asks for its script at `/assets/app.js` gets a 404 (not found) there, and renders blank with no error you would notice. The `base` setting makes every generated URL start with `/blinklab/`. Blank page on a fresh deploy, wrong base path, is one of the most common deployment bugs on the entire internet, and now you have seen the cure before ever hitting the disease.
Note what deploys: `dist` only. The TypeScript, the tests, the documents stay in the repo. Visitors receive only the translated result.
This comes back at 8.7, where the size of what we deploy gets a budget, and every increment from now on, because each merged pull request updates the public demo.

## 0.8 The ADR: decisions have worse memories than code

The concept this increment teaches is the architecture decision record, ADR for short.
Code remembers itself, git holds every version forever. Decisions do not. Six months from now the code will show _that_ we use MediaPipe, but nothing in the code shows _why_, or what we rejected, or what we knew it would cost us. That context evaporates first, and its absence is how projects end up re-fighting settled questions or, worse, cargo-culting choices nobody can defend anymore.
An ADR is a small dated note with a fixed shape: the situation, the options actually on the table, the choice, and the consequences we accepted, good and bad. The bad consequences are the valuable part. Writing "we are bound to MediaPipe's landmark quality" today means that when that limit bites in Phase 3, it arrives as something we chose, not something that ambushed us.
Two rules give ADRs their strength. They are written only for decisions that are expensive to reverse, so the folder stays short and important. And they are never edited after merge, only superseded by a newer numbered ADR, so the folder is an honest history, not a polished story.
This comes back whenever we are tempted by a framework or a charting library, both of which now require a superseding ADR by their own rule, and at 7.3, where choosing a dataset gets the same treatment.

## 1.1 The impure edge: code that touches the world

The concept this increment teaches is the impure edge, the `io` folder, and why its code lives by different rules than `core`.
`distance` in core is pure: same input, same output, nothing else happens. Camera code is the opposite in every way. It asks for hardware that may not exist, triggers a permission dialog we do not control, and its outcome depends on a human clicking Allow or Deny. It cannot be pure, and that is fine, something has to touch the world. The architecture rule is only that such code stays quarantined at the edge, in `io`, so the measurement maths never inherits its unpredictability.
The permission model matters too. A page cannot take the camera, it can only ask, and the browser insists a human answers. We start the camera from a button click rather than on page load for the same reason in reverse: a permission dialog that ambushes a visitor before they know what the page is feels hostile, and browsers increasingly punish it.
Testing changes character at the edge. Core logic gets unit tests measured in milliseconds. Edge code gets the manual script in test/MANUAL.md, run by a person with a face and a light source. Notably, the deny path was still verifiable by machine: my test browser refuses cameras outright, which proved a rejected permission shows a readable line instead of a crash.
This comes back at 1.2, where the deny and no-camera states get proper readable treatment, and at 2.1, where the model loading joins the same impure edge.

## 1.2 The state machine: name every situation

The concept this increment teaches is the explicit state machine.
Before today, the camera's situation lived in scattered clues: a hidden attribute here, a text string there. That works until two clues disagree, a visible video and an error message at once, and nobody can say which is lying. The fix is to name every situation the system can be in, exactly one at a time: idle, requesting, running, denied, noCamera, failed. The whole page is then drawn from that one value by a single `render` function. If the state is right, the screen cannot be wrong, because the screen is a consequence, not a collection of separately maintained facts.
TypeScript enforces the "exactly one" part. The state is a union of shapes, and the message function must handle every shape or it does not compile. Adding a seventh state tomorrow would instantly flag every place that forgot about it.
Note where the pieces live. Classifying an error name into a state, and choosing a sentence for a state, are pure functions in `core`, tested in milliseconds. Only the thin click handler in `main.ts` touches the real camera. We split the decision from the doing, and the decision is the part that gets tested.
One defensive detail: an error name we have never heard of becomes a real `failed` state carrying its reason, never a crash. Browsers disagree on error names, and honesty about "I do not know what happened" is itself a state.
This pattern returns at 2.5 for the wrong landmark count guard, at 3.8 for the head pose validity gate, and at 4.6 for the frame rate honesty gate. Most of this project is deciding what state we are in and refusing to pretend otherwise.

## Fix #22: a bug fix is a workflow, not an edit

The concept this fix teaches is the bug fix workflow, because a good fix has stages and each stage exists for a reason.
It started with an observation by the project owner: the preview looked squeezed. That became an issue with the observation quoted verbatim and the diagnosis marked as a hypothesis, not a fact. Then the fix branch opened with tests named after the bug, written before the cure, so the repo permanently remembers what went wrong.
The technical cause had two halves. We requested a camera with no size preferences, and browsers then often hand over an old fashioned 4 to 3 picture from a camera that is naturally 16 to 9. And we pinned the element to a guessed width. The cure also has two halves: ask the camera for 1280 by 720 as an ideal, and size the element from the stream's real reported dimensions through a pure, tested function. "Ideal" is the honest word in that API, it is a negotiation, the camera gives the closest thing it can, and our layout function handles whatever arrives, including 4 to 3, without distortion.
The last stage belongs to the person who reported the bug: only their eyes can close the loop, which is why the manual script now demands proportions matching FaceTime.
One process lesson rode along. The previous increment's LEARNING note was edited but never committed, because a hand typed file list missed it. Checklists claim, git status verifies. The habit now is a clean status check before every pull request.

## 1.3 The injected clock: time as an argument

The concept this increment teaches is the injected clock, the rule from SPEC.md that time always arrives as a parameter.
Frames per second sounds like it needs a stopwatch, and code with a stopwatch inside is miserable to test: you would have to actually wait, and a busy laptop would make the same test pass today and fail tomorrow. Our QA rules ban that outright, no flaky tests, no sleeps.
The escape is to split the question. "What time is it" stays at the impure edge: the browser's frame loop hands us a timestamp per frame, we never ask for one. "What do these timestamps mean" is pure arithmetic in `core`: keep the last two seconds of them, then divide. In the tests we simply write timestamps down by hand, eleven stamps spaced 100 milliseconds apart, and the answer must be exactly 10, forever, on any machine, in zero milliseconds of waiting.
The fencepost detail is why the tests use countable numbers: eleven timestamps are ten intervals. Dividing by eleven would read plausibly and be wrong by ten percent, which is exactly the kind of mistake a reader cannot spot but a hand checked test cannot miss.
One discovery from verification: browsers pause the animation loop entirely for hidden tabs, my embedded test browser lives permanently in that state, so the live number can only be confirmed by a human with a visible window.
The injected clock returns everywhere time appears: blink durations at 4.3, rolling windows at 4.4 and 6.1, and the honesty gate at 4.6 that reads this exact fps number before daring to report a blink.

## 1.4 The canvas: owning the pixels

The concept this increment teaches is the canvas, and the ownership shift it brings.
Until now the browser displayed the camera stream for us. A video element is a black box with a picture inside: convenient, but closed. You cannot write on it, measure it, or decide what appears. The canvas inverts the deal. It is an empty rectangle of pixels that shows nothing unless code paints it, and now our frame loop paints the current camera frame onto it, sixty times a second.
To the eye nothing changed, and that is the point of the increment: prove we can reproduce reality before we start annotating it. The right-click test in the manual script is the tell, the browser now offers image options, because as far as it knows this is just a picture we drew.
Why go to this trouble: increment 2.2 wants to draw 478 landmark dots on top of your face. You cannot draw on a video element, but a canvas takes dots, lines and heatmaps as happily as it takes camera frames, all in the same paint call sequence.
Note the gating: we only draw while the state machine says running, and only after the canvas was sized from the stream's real dimensions. Drawing from a frameless video or onto an unsized canvas produces black or stretched output, the same class of silent wrongness the aspect ratio bug taught us to distrust.
This surface is where the rest of the project happens: dots at 2.2, the eye region at 2.3, sparklines at 3.2, fixation circles at 5.7, the heatmap at 5.9.

## 1.5 Normalise the world at the edge

The concept this increment teaches is the boundary mapper: raw data from the outside world gets cleaned into our own shape by a pure function, before anything else touches it.
The browser's device list is honest but messy. It mixes cameras with microphones and speakers, and until the user grants permission, every label is an empty string, a quirk that exists for privacy, so websites cannot fingerprint your hardware before you trust them. Feeding that mess straight into the page invites the mess to spread.
Instead, `cameraOptions` swallows the mess once: it keeps only cameras and turns blank labels into "Camera 1", "Camera 2". Everything after it deals only in our clean shape. The rule of thumb: the further a mess travels into a program, the more places know about it. Stop it at the door.
The mapper also carries the picker's business rule, more than one camera or no picker at all, as its own tiny tested function. The test file covers zero, one and two cameras, because "more than one" is a threshold, and thresholds get all three sides tested.
A design consequence worth noticing: the picker can only fill itself after the first successful camera start, since labels are blank before permission. That ordering came from the browser's privacy model, not from our code, and the code simply respects it.
Boundary mappers return in force at 2.1, where the landmark model's raw output crosses into our FeatureRecord world, and at 7.2, where a CSV loader does the same for the analysis track.

## 1.6 Six numbers that move a world

The concept this increment teaches is the transform matrix, the standard way graphics systems describe moving, scaling and flipping in one object.
Mirroring sounds like it needs pixel work, copy every row of the image reversed. Nobody does that. Instead you tell the canvas: before you draw anything, run every coordinate through these six numbers. Our mirror is `a: -1` (x runs backwards) and `e: width` (then shift it back into frame). The picture flips because the coordinate system flipped, the pixels were never touched.
The reason this deserves its own `core` module instead of two magic numbers in the draw call: the same matrix must apply to everything that lands on that canvas. At 2.2 we draw 478 landmark dots over your face. If the picture is mirrored and the dots are not, every dot sits beside the feature it belongs to, a bug you would stare at for an hour. With the matrix in one tested place, picture and dots cannot disagree.
The tests do not check the six numbers as trivia, they push actual points through: the left edge must land on the right edge, the centre must not move, and mirroring twice must hand back the original point. Properties, not opinions.
Why mirrored is the default: people have watched themselves in mirrors their whole lives. An unmirrored self view feels subtly wrong before you can say why. But the measurements in later phases work on unmirrored coordinates, the mirror is a display courtesy only, which is exactly why it lives at the drawing edge and not inside any maths.
This matrix returns immediately at 2.2 as the landmark projector, and its inverse thinking returns at 5.4, where screen points must map back into camera space.

## 2.1 A neural network is a file

The concept this increment teaches is what a machine learning model actually is at rest: a file of numbers, and an engine that runs it.
The `face_landmarker.task` file is 3.7 megabytes of learned weights, the distilled result of Google training on faces. It does nothing by itself, like sheet music without an orchestra. The orchestra is the WASM runtime, 33 megabytes of compiled inference engine that the browser executes at near native speed. Load both, and you get a function: hand it a video frame, get back landmark positions. That is all "running a model" means.
Both artefacts now live on our origin, the model committed to the repo, the WASM copied from the version locked npm package before every build. ADR-0002 records why: our privacy stance forbids the running app from calling anyone. Today we proved it, the network log during a full model load showed zero third party requests. A promise in SECURITY.md is a claim, an empty network tab is evidence.
Note the asymmetry the code respects: loading is slow and happens once, inference is fast and happens per frame. And note what `core` sees: nothing of MediaPipe. The presence predicate defines its own small shape of the result, so the vendor stays quarantined at the edge like the camera before it.
The lint gate also earned its keep today, by red flagging seven thousand lines of copied vendor code until it was told that vendor code is not ours to judge.
This is the foundation of everything in Phases 2 to 6: dots at 2.2 are these landmarks drawn, blinks at 4.x are these landmarks moving, and the 30 millisecond budget at 2.6 is this engine timed.

## 2.2 A point is meaningless without its space

The concept this increment teaches is the coordinate space, the silent assumption behind every x and y.
The model reports landmarks in normalised space: 0 to 1 across the frame, whatever its size. The canvas wants pixels. The display may additionally be mirrored. Three spaces, and a point only means something when you know which space it lives in. The bugs of this domain are all space confusion: draw normalised values as pixels and all 478 dots huddle in the top left corner, apply the mirror twice and the mask floats beside your face.
The defence is a single bridge. `projectNormalizedPoint` is the only road from model space to screen space: scale by the canvas size, then through the exact same mirror matrix the picture uses. Because picture and dots cross the same bridge, they cannot disagree, toggling Mirror flips them together by construction, not by carefulness.
The fixture tests pin the bridge with points a human can check while reading: the centre of the frame must land at the centre of the canvas, the top left corner at the top left, and under mirroring only x flips while y holds still.
Notice also what stayed where: the projector decides coordinates and lives in `core`, fully tested. `drawDots` only paints what it is handed and lives in `io`, untestable and trivially simple. Decisions in the testable place, actions at the edge, the same split as ever.
Spaces multiply from here: 3.4 adds millimetres, 5.2 adds screen regions, 5.4 maps gaze back from screen space toward camera space. Every one of those conversions will be a small pure bridge like this one.

## 2.3 Magic numbers get names and guards

The concept this increment teaches is the named constant, and why a list of numbers deserves tests.
The model's 478 landmarks come as an anonymous array. Landmark 159 is a spot on an upper eyelid, but nothing in the code said so until today, the knowledge lived in MediaPipe's documentation and nowhere else. Numbers used bare like that are called magic numbers, and they rot: six months on, nobody remembers why 159, and nobody dares change it.
So the eye indices moved into `core/constants.ts` under names, with a comment settling the classic trap: left means the subject's left, which appears on the right side of an unmirrored image. Every eye measurement for the rest of the project reads from these two lists.
Then the unusual part, we wrote tests for constants. Tests for data, not behaviour: the two eyes may not share an index, every index must exist inside the model's range, no index may repeat, and both eyes must have equal point counts. None of that proves index 159 is truly an eyelid, no test can, only your eyes on the canvas can. But the tests do make the cheap typos impossible, and the manual check covers the expensive one.
The quiet importance of this increment: from now on the code does not see 478 dots, it sees eyes. Naming a subset is the first act of measurement.
These lists come back instantly: 2.4 adds the iris rings beside them, 3.1 computes the eye aspect ratio from exactly these points, and 2.5's guard leans on LANDMARK_COUNT.

## 2.4 The ruler you were born with

The concept this increment teaches is the anatomical constant, and why ten orange points deserve their own increment.
Here is the problem they will solve. Every distance we can measure on the canvas is in pixels, and pixels lie: lean toward the camera and your eye grows fifty percent without opening at all. Phase 3 needs a way to turn pixels into real world units that hold still while you move.
The trick is that adult humans carry a built in ruler. The visible iris is close to 11.7 millimetres across in almost everybody, one of the most stable measurements in the human body, it is essentially adult sized from early childhood. If we can see how many pixels the iris spans, we know how many pixels a millimetre is, in this frame, at this distance, updated sixty times a second. That division is increment 3.4, and today's ten landmarks, a centre and a four point rim per iris, are its raw material.
So this increment looks cosmetic, orange rings sliding over your irises, but it is really instrument calibration: we are visually confirming that the model tracks the one feature whose true size we know. Watch the rings while you look around, their steadiness is the ceiling on every millimetre number this project will ever report.
One code note: "the ring is closed" became a data test, each ring must be exactly the four indices after its centre, which pins the topology assumption we took from MediaPipe's documentation.
The iris returns at 3.4 as the pixel to millimetre bridge, at 5.1 as the gaze pointer, and in Phase 9's pupil ideas.

## 2.5 The guard that should never fire

The concept this increment teaches is the trust boundary guard, a check written precisely because it looks unnecessary.
Our code trusts the model to return 478 landmarks. That trust is currently justified: ADR-0002 vendored the exact model file into the repo, it cannot change behind our back. So why guard? Because the dangerous day is not today, it is the future afternoon someone upgrades the model file in an otherwise innocent pull request. MediaPipe's older face mesh returns 468 points, no irises. On that day, without the guard, nothing would crash. `pickPoints` would skip the ten missing indices, the orange rings would vanish, and every millimetre computation downstream would quietly work with nothing. Silent wrongness again, the most expensive kind.
The guard converts that silence into a sentence on screen naming both numbers, and stops measurement, our null-over-guessing rule applied to a whole subsystem.
Two honest notes about testing it. First, the fixture: the tests feed a generated 468 point face, we do not need the real old model to test the decision, only its shape. Second, the limit: no end to end test can trigger this state, because the vendored model always returns 478. The pure decision is fully tested, the two line display wiring is covered by review, and the manual script documents why there is nothing to see. Claiming more coverage than exists would be its own kind of silent wrongness.
Guards like this multiply at every trust boundary from here: 3.8 rejects untrustworthy head poses, 4.6 refuses blink numbers at low frame rates, 7.2 will distrust every CSV row it loads.

## 2.6 A budget nobody watches is a rumour

The concept this increment teaches is the visible performance budget.
SPEC.md has said "inference under 30 milliseconds per frame" since day one. Until today that sentence was a hope, nothing measured it, so nothing could violate it. Performance rules that live only in documents always pass. Now the cost of every model run is measured, averaged and printed beside its budget, permanently. The moment a future change makes inference slow, the page itself will say so, to whoever is looking, including strangers on the live demo.
Two craft details. First, smoothing: a single frame's timing jitters, the operating system wanders by, the GPU pipeline hiccups, so the display shows the mean of the last sixty samples, steady enough to read, fresh enough to trust, one second of history at sixty frames. Second, boundary honesty: the budget test asserts that exactly 30 is calm and 30.1 complains, thresholds get all three sides tested, our oldest QA rule.
Note also what this number quietly settles: the console line from your screenshot claiming a CPU delegate. Instead of arguing about which processor runs the model, we read the price tag. If the mean sits comfortably under 30, the question is academic. If it does not, we have evidence, not vibes.
The measured-not-assumed idea returns at 7.8, where latency gets formally recorded in the README, and at 8.7, where this budget becomes a CI gate that can fail a pull request.

## 2.7 Reality, frozen for replay

The concept this increment teaches is the recorded fixture, the third and final kind of test data this project uses.
Synthetic fixtures, like our 3 4 5 triangle and the generated 468 point face, have ground truth by construction: we know the answer because we built the input from the answer. Their weakness is politeness, synthetic data never contains the noise, jitter and asymmetry of the world. Recorded fixtures are the opposite: five real seconds of a real face through a real camera, blinks and micro movements included, with no ground truth other than "this actually happened". The strongest test suites use both, synthetic data to pin the maths, recorded data to confront it with reality. Phase 3 will do exactly that.
Three craft details rode along. Precision costs bytes: raw landmark floats carry seventeen decimals of noise, rounding to four kept a tenth of a pixel and cut the file from fifteen megabytes to three. Tools can be too honest: my first version of the recorder shipped its button to production merely hidden, and the grep check on the build caught it, hidden is not absent. And assertion count is a performance number too: sweeping 143,400 landmarks with individual assertions cost three seconds per test run, counting violations in plain code and asserting zero restored the milliseconds culture.
The fixture returns immediately: 3.1's eye aspect ratio will run against these 300 frames, and any real blink you made during those five seconds becomes Phase 4's first honest test case.

## 3.1 The first measurement, and why it is a ratio

The concept this increment teaches is the eye aspect ratio, and through it, why good measurements are so often ratios.
EAR is two vertical distances across the eye, averaged, divided by the horizontal width: roughly 0.3 when your eye is open, collapsing toward zero as the lids meet. Six landmarks, three distance calls, one division, all built on the `distance` function from increment 0.4, which was the plan all along.
The division is the clever part. Raw eyelid distance is measured in pixels, and pixels inflate when you lean toward the camera, an eye can "open" fifty percent without moving. But leaning inflates the eye's width by the same factor, so the ratio cancels the distance out. Our scale invariance test states this as a property: double every coordinate and EAR must not budge. Ratios buy robustness by giving up units, EAR is a pure number, not millimetres, which is why 3.4 still needs the iris ruler for absolute aperture.
The fixture test was the increment's true examination: the formula ran over your 300 recorded frames and had to find your real blinks, the minimum EAR diving under half the median. It did. Synthetic shapes pinned the arithmetic, your face confirmed the meaning, both kinds of fixture doing exactly the jobs 2.7 assigned them.
And the ritual's loose end now has a name: whether your shallow third blink counts is a threshold decision on this exact number, which is increment 4.1's opening problem.

## 3.2 Drawing data honestly

The concept this increment teaches is the honest chart, through the two decisions every chart maker faces and most tools hide.
First, the scale. A chart that auto fits its axis to the data makes every wiggle fill the frame: sitting still would look as dramatic as blinking. Our sparkline fixes the scale at 0 to 0.6, so a blink always has its true visual size, and a calm minute truly looks calm. Auto scaling flatters, fixed scales inform.
Second, the gap. When you cover the camera, there is no measurement. The tempting shortcuts, drawing zero, or bridging across the hole, would both be lies: zero says "eyes fully closed", a bridge says "nothing happened". Our null samples split the line into separate segments, so missing data looks missing. This is the null-over-guessing rule made visible, the chart version of the honesty the maths has practised since 1.3.
Underneath sits the ring buffer, the standard answer to "the stream never ends but memory must": push forever, capacity stays fixed, the oldest samples fall off the front. The timing module from 2.6 already needed exactly this, so its own push now delegates to the shared one, reuse instead of a second copy.
And the fixture keeps earning: one of the tests feeds all 300 recorded frames through the sparkline and requires a single unbroken segment, your five seconds becoming the chart's first regression test.
Hand drawn charts return at 5.9's heatmap and 6.6's contribution panel, and this exact sparkline becomes the backdrop on which 4.1's blink detector draws its threshold line.

## 3.3 Ground truth by construction

The concept this increment teaches is the answer key, and how to build one when reality refuses to provide it.
The next increments make physical claims: your eyelid opening is so many millimetres, your head is tilted so many degrees. How would a test check that? Your recorded fixture cannot help, nobody knows the true millimetres behind it, reality comes without labels. So we build faces from arithmetic instead: a tiny 3D model with the true anatomical sizes typed in, iris 11.7 millimetres, eye width 30, pupils 63 apart, rotated by chosen angles, placed at a chosen distance, and pushed through a pinhole projection, the one line of maths behind every camera, size on screen equals size over distance. Now the test knows every answer before asking, because it chose the answers.
The generator's own tests read like physics homework: the iris at half a metre must span exactly 11.7 over 500 of the frame, doubling the distance must exactly halve it, and the EAR of a synthetic face must equal aperture over eye width to ten decimals, three increments shaking hands.
Note the conventions block at the top of the file, axes, rotation order, signs, written once. Convention bugs are the worst bugs in geometry because every formula is locally right and the whole is wrong.
Synthetic answers keys and recorded reality now work as a pair, exactly as 2.7 planned: the generator grades the maths, your fixture confronts it with noise. Every increment through 3.8 tests against this generator, starting immediately with 3.4's millimetres.

## 3.4 Dividing by the ruler you were born with

The concept this increment teaches is unit conversion by reference object, the trick that turns a camera into a measuring instrument.
A camera reports pixels, and pixels are a lie about size: lean 20 centimetres closer and your eye doubles on screen without opening at all. Absolute measurement needs something in frame whose true size is known. Photographers put a ruler beside the evidence. We are luckier, every face carries one: the visible iris is within a few percent of 11.7 millimetres across in nearly all adults. So each frame, we ask how many pixels the iris spans, and that gives the price of a millimetre in this frame, at this distance, refreshed sixty times a second. The aperture in pixels divided by that price is the aperture in millimetres, and the flagship test proves the payoff: across synthetic faces from 350 to 800 millimetres away, the pixel number swings past double while the millimetre number does not move in the tenth decimal.
Two craft notes. The ruler is the horizontal iris diameter, because the vertical one hides behind the lids exactly when blinks make measurement interesting. And the aspect ratio trap: normalised x is a fraction of frame width, normalised y of frame height, on a 16:9 frame those units differ by almost double, so everything becomes pixels before directions mix. Mixing them raw would skew every millimetre by that factor, silently.
Reality graded the work too: the median across your 300 recorded frames came out at 7.1 millimetres, with mid blink dipping to 2.5. Plausible human numbers, from arithmetic and one anatomical constant.
This number becomes the blink signal of Phase 4, gets distance validated at 3.5, and tilt corrected at 3.7.

## 3.5 One fair number for wobble

The concept this increment teaches is the coefficient of variation, and behind it, how to compare variability fairly.
The question was: does the millimetre aperture really hold steadier than the pixel one when you move? Raw standard deviations cannot answer it, a deviation of 3 pixels and a deviation of 0.3 millimetres are in different currencies, comparing them is meaningless. The exchange rate is the mean: divide each deviation by its own average and both become unit free percentages of themselves. That ratio is the coefficient of variation, CV, and it lets pixels and millimetres stand on one scale.
The verdict is now a permanent test: sweeping synthetic faces from 350 to 800 millimetres, the pixel aperture's CV exceeds 25 percent while the millimetre CV stays under a tenth of a percent. On perfect synthetic data the ruler cancels distance exactly, real faces will be noisier, which is why the live stability line exists: perform the lean in, lean out experiment yourself and watch the two percentages diverge on screen.
One honesty guard: CV divides by the mean, and a mean near zero, eyes long closed, makes the ratio explode into nonsense. A mean at or below zero returns null, the refusal rule again.
CV returns in the analysis track at Phase 7, where every claimed result will carry a variability alongside its average, and the stability line becomes demo material for the pixels versus millimetres story, the strongest post of the ladder.

## 3.6 Three named angles out of one matrix

The concept this increment teaches is rotation as a matrix, and Euler angles as its human readable unpacking.
The model does not only report landmarks, it also reports how the whole face is turned, as a 4 by 4 transformation matrix, sixteen numbers encoding rotation and position at once. Machines love that form, you can chain and invert it, but no human reads sixteen numbers. The human form is three named angles: pitch (nodding), yaw (shaking no) and roll (ear to shoulder). The decomposition in core recovers them from specific matrix cells, and the convention block matters more than the formulas: which axis is which, in what order rotations compose, matching the synthetic generator exactly.
Two things worth keeping. First, the tests build their matrices by multiplying base rotations numerically, an independent code path from the decomposition, so the test genuinely inverts rather than echoes. Second, gimbal lock is real: pitch the head a full 90 degrees and yaw and roll collapse into one indistinguishable axis, so the decomposition returns null there, the refusal rule in its most geometric costume.
One honest asterisk: our convention is proven against our own synthetic matrices, but MediaPipe's real matrix may order axes or flip signs differently. The nod, shake, tilt manual check is the calibration experiment, and the observed signs get recorded for 3.7 and 3.8.
Pose feeds the validity gate at 3.8 directly: measurements will refuse to exist when the head turns too far, using exactly these three numbers.

## 3.7 The correction we never had to write

The concept this increment teaches is invariance by construction, the quiet superpower of choosing the right representation early.
The master plan scheduled a roll correction here, expecting the aperture to shrink when the head tilts, as it does in most implementations. Ours does not, and the reason is a decision made back at 3.1 without fanfare: we measure the straight line distance between two landmarks, not the vertical drop between them. Rotation moves points around, but it cannot stretch the space between them, so a distance based measurement is immune to roll before any correcting code exists. Your ritual prediction caught this, and your 42 degree tilt screenshot confirmed it live before the tests did.
The increment therefore delivers proof instead of a patch: the ladder's 0, 15, 30 sweep shows the millimetre value frozen to ten decimals, and a counterfactual test implements the naive vertical measurement locally just to document its failure, shrinking by exactly cos(roll), 13 percent at 30 degrees. The bug we never wrote now lives in the test suite as a warning to whoever changes the aperture code later.
The wider lesson: corrections undo errors after the fact, representations can make the error inexpressible. When you get to choose, choose the representation. The same idea already carried EAR through distance changes (a ratio cannot see scale) and returns at 5.6, where the question will be which gaze representation makes head wobble cheapest to survive.
Roadmap amendment 4 records the change honestly: the plan said correction, the geometry said verification.

## 3.8 A measurement with preconditions

The concept this increment closes Phase 3 with is the validity gate, the idea that a serious measurement knows the conditions under which it deserves belief, and says so.
Every number this phase built rests on assumptions: the eye landmarks are visible, not foreshortened into slivers, not occluded by the nose. Turn your head 40 degrees and those assumptions quietly die, but the arithmetic keeps producing numbers, wrong ones, wearing the same font as the right ones. The gate makes the assumptions executable: pitch, yaw and roll are checked against limits every frame, and beyond them, EAR and aperture become "no valid measurement", the sparkline records a gap, and one sentence names the axis, the angle and the limit. The head pose line keeps working, deliberately, so you can steer back into validity.
Design details that matter: the limits are symmetric, so the sign conventions we never fully calibrated cannot matter to the gate. The boundary is inclusive, exactly at the limit is still valid, and the tests check below, at and above, our oldest threshold rule. An unknown pose gates as invalid too, unknown is not a licence.
This is the pattern the whole project has been converging on: 1.2 refused broken cameras, 2.5 refused wrong models, 4.6 will refuse low frame rates, and now geometry refuses untrustworthy angles. An instrument that cannot say "I do not know" is not an instrument, it is an opinion generator.
Phase 3 ends here: pixels became millimetres, the head learned its angles, and every number learned when to stay silent.

## 4.1 The threshold is a decision, not a fact

The concept that opens Phase 4 is event detection, turning a continuous signal into countable happenings, and the confession at its heart: every event detector hides a decision.
The detector itself is three states and one rule. The aperture runs below 4 millimetres, the eye counts as closed; it rises back, one blink is counted, on the reopen, so a held closure counts once when it ends. An invalid frame, face lost or head turned too far, breaks the cycle: a blink we could not watch from start to finish is not a blink we may count, the gate's honesty flowing downstream.
The decision is the 4. Your own fixture priced it: your full blinks bottom near 2.2 millimetres, your shallow half blink near 5, your open eyes near 7. Any threshold from 3 to 4.5 finds exactly two blinks, at 5 the third appears. So "how many times did you blink" has no answer independent of a chosen line, and the tests now document both answers with their prices. This is the ritual's mystery from 3.1, resolved into arithmetic.
Two blindnesses ship on purpose, each with its increment booked: the threshold is tuned to one person's anatomy, 4.2 learns it per person instead, and a slow deep squint will fool it, 4.7 separates them by shape.
Everything else in Phase 4 decorates this reducer: durations at 4.3 are time between its transitions, rates at 4.4 count its events per minute, velocities at 4.5 measure how fast the signal falls into it.

## 4.2 A bar that only rises

The concept this increment teaches is adaptive calibration with a ratchet, and the quietly adversarial reasoning behind it.
The 4 millimetre threshold was tuned to one person on one day. Now the instrument learns instead: thirty seconds of watching, and the threshold becomes half of what YOUR open eyes measure. The robust part is which statistic defines "open": a plain mean would let every blink inside the learning window drag the estimate down, so the baseline is the 90th percentile, the level your lids are above nine tenths of the time, which shrugs off brief closures.
The adversarial part is the ratchet, and it is the ladder's own named test: after learning, the baseline may rise but never fall. Why one way only? Because the very thing later phases exist to notice, lids drooping with fatigue, looks exactly like "this person's eyes are just narrower, adapt to it". A two way adaptive baseline would learn the drowsiness away, lowering the bar precisely when the bar matters. The ratchet makes that impossible: wider than ever, believed; narrower for minutes, treated as a finding, not a recalibration.
The ratchet costs something too, honesty requires saying it: a genuine context change that narrows the eyes, moving the screen higher, say, would leave the baseline stuck high. The escape is explicit: restarting the camera restarts the learning, a human decision, not an automatic one.
The baseline returns immediately at 4.6 and 4.7 as the reference the honesty gates lean on, and at 6.5, where "how open compared to YOUR normal" feeds the score.

## 4.3 A blink gets a clock

The concept this increment teaches is the event with extent: a blink stops being a tick on a counter and becomes a stretch of time with a beginning and an end.
The mechanics are small. The reducer already knew the moment the eye closed and the moment it reopened, it merely never wrote down the clock. Now it does: the closing timestamp is remembered, and the reopen reports the difference, the closed phase duration in milliseconds. An invalid frame still voids everything, including the pending timestamp, an unfinished measurement is not a measurement.
The definition deserves one honest sentence: our duration is the time spent BELOW the threshold, the closed phase, not the full lid journey from descent to fully reopened that some papers mean by blink duration. Definitions vary across the literature, ours is written down, which is what matters.
Why duration earns its place in a fatigue instrument: sleepy blinks are longer. The closed phase stretches measurably as drowsiness grows, which makes this number, unlike the raw count, a direct fatigue signal, the first one blinklab produces.
The owner's own data calibrated the tests: the two recorded blinks measure 133 and 117 milliseconds below threshold, textbook values for alert spontaneous blinks, now pinned as assertions. When a fatigue dataset arrives in Phase 7, longer numbers than these are part of what the classifier will look for.
Duration is the second column of the blink event log at 4.8, and the velocity work at 4.5 dissects this same stretch of time into its falling and rising halves.

## 4.4 Rates and the young window problem

The concept this increment teaches is the rolling rate, and its classic trap, the window that has not lived long enough to be believed.
A rate is events divided by time, and both halves need care. The events half is familiar machinery: blink timestamps pruned by the same keepRecent that has served the fps counter since 1.3, the oldest falling out as the window slides. The time half is where honesty lives. Divide by the full sixty seconds when you have only observed five, and a normal person reads as nearly blinkless. Divide by five seconds naively, and one blink reads as twelve per minute of confidence built on nothing. So the denominator is the time actually observed, capped at the window, and below fifteen seconds of observation there is no rate at all, only "measuring...", the refusal rule applied to arithmetic that would technically compute.
Why the rate matters: it is the most famous number in blink research. At rest most people sit near fifteen to twenty per minute. Concentration crushes it, screen reading famously drops it by half or more, which is why dry eyes follow long reading sessions. Drowsiness tends to raise it, alongside the lengthening durations from 4.3. Rate and duration moving together is exactly the pattern the Phase 6 score will watch for.
The rolling window itself returns at 6.1 as PERCLOS's backbone, where the same sliding sixty seconds measures not how often the eyes close but how long they stay that way.

## 4.5 The shape is where the information is

The concept this increment delivers is the phase's thesis: a blink is not a binary event, it is a movement with a profile, and the profile carries what the count cannot.
Three numbers describe the profile. Amplitude, how far the lid fell, from its pre closure maximum to the minimum. Peak closing velocity, the fastest adjacent sample drop on the way down, in millimetres per second, deliberately per second so a frame rate change cannot silently rescale it, the tests use uneven timestamps to enforce exactly that. And their ratio, amplitude over velocity, a time constant measured in milliseconds.
The ratio is the clever one, and it comes from the drowsiness literature: as people tire, lid velocity fades before lid travel does. A tired blink falls about as far but noticeably slower, so amplitude over velocity stretches. It is also naturally self normalising, sharing the same ruler in numerator and denominator, echoes of the EAR's trick.
The extraction respects its own limits: it measures the descent only, from the pre closure maximum, ignoring whatever the window starts with and the reopening tail, and it refuses degenerate input, too few samples, no fall, or a clock that did not advance.
The manual check is the demonstration the whole phase was named for: a natural blink and a deliberate slow one have similar amplitudes and utterly different velocities, and the page now shows that difference in numbers.
These three numbers join duration and rate in 4.8's event log, and the score at 6.5 will weigh the ratio among its inputs.

## 4.6 Zero is a claim, null is an admission

The concept this increment teaches is the sampling limit, and the master plan's own words for it: the detector now refuses to answer when it cannot see properly.
The physics is short. A quick blink's closed phase can be under 100 milliseconds. At 60 fps that phase spans six frames, comfortably visible. At 20 fps it spans two at best, and with slight mistiming, zero, the eye closes and reopens entirely between samples. The detector would then report few blinks with total confidence, and a false calm is worse than no reading, because low blink counts are exactly what a fatigue system treats as meaningful.
So below 25 fps, every temporal blink metric returns null and the page says not measurable, naming the current rate and the minimum. The ladder's test spells out the distinction the whole increment turns on: with real blinks sitting in the window, the gated rate below 25 fps must be null and must NOT be zero. Zero says "this person did not blink", null says "I could not have seen it either way". One is a claim, the other an admission, and instruments that cannot tell them apart produce confident nonsense at their edges.
This is the fourth refusal in the family: broken cameras at 1.2, wrong models at 2.5, turned heads at 3.8, and now starved sampling. One honest simplification is on record: the rate's observation clock keeps running through a low fps spell, mildly diluting the rate afterwards, accepted rather than hidden.
The gate feeds 7.8's latency measurements, where sampling limits get quantified rather than just respected.

## 4.7 Not everything that dips is a blink

The concept this increment teaches is classification by time signature: two events can cross the same threshold and still be different things, told apart by how long they stay.
A blink and a deep squint both drive the aperture below the line. The difference is temporal: your recorded blinks spent 133 and 117 milliseconds down there, while a held squint parks for seconds. So the rule is one comparison: a closure only counts as a blink if it lasted half a second or less below threshold. The ladder's synthetic five second plateau now counts exactly nothing, and the sparkline session where you watched your own squint draw a plateau instead of a valley was this rule's preview, shape first, code later.
Two honest notes. First, 500 milliseconds is another decision line, like 4.1's four millimetres: real blinks and real holds separate widely around it, but the line itself is chosen, documented, and boundary tested, exactly at 500 counts, 600 does not. Second, this increment reclassifies old behaviour: 4.3's manual item promised a held two second blink would read 2000 milliseconds, and that promise is now amended, a two second closure is not a blink, it is a long closure, which increment 6.2 will detect as its own event with its own name. Definitions evolving in the open, with the paper trail updated.
The taxonomy this begins, brief blink versus long closure versus sustained droop, is the backbone of Phase 6: PERCLOS measures the droop, 6.2 catches the closures, and the blink metrics stay clean of both.

## 4.8 From readings to records

The concept that closes Phase 4 is the event log, the difference between an instrument you watch and an instrument that remembers.
Every line on the page until now was a reading: true at this instant, gone the next frame. The log makes blinks durable: each completed one becomes an event carrying when it ended, how long it stayed closed, and its shape, appended to a capped list that the panel renders newest first. The reducer is the shared ring buffer's third posting, after the timing samples and the sparkline, push forever, memory fixed, oldest fall away, and the cap's silence is documented rather than hidden, fifty events, then history starts eating its tail.
Formatting is a pure function too, which looks fussy until you notice what it buys: the exact text of a log line, relative seconds, units, the "shape unavailable" fallback, is unit tested, so the panel cannot silently drift from its contract.
The log is also Phase 6's rehearsal. The session recorder at 6.7 is this same idea grown up, every FeatureRecord instead of every blink, exported as CSV instead of rendered as a list. And the log answers a question every fatigue system eventually faces: not "is this person blinking oddly now" but "when did it start", which only a record can answer.
Phase 4 ends here: a counter that learned whose eyes it watches, when it cannot see, what does not count, and now, how to remember.

## 5.1 Gaze begins as a projection

The concept that opens Phase 5 is measuring within a moving frame of reference, done here with the oldest tool in geometry, the projection.
The raw gaze signal is simply where the iris centre sits inside its eye. But "inside its eye" is a moving target: the eye slides around the image with every head shift and rotates with every tilt. The fix is to measure in the eye's own coordinate system: the axis between the two eye corners becomes the ruler and the direction at once, the iris position is projected onto that axis for the horizontal offset and onto its perpendicular for the vertical, both expressed as fractions of the eye width. Head roll then rotates the ruler and the signal together and cancels out, the same invariance-by-construction that saved 3.7, now proven for gaze by a test that rolls the synthetic face 15 degrees and demands identical offsets to eight decimals.
The synthetic generator grew a gaze of its own for the occasion: an iris shift parameter, so the tests know the truth in millimetres, a 3 mm shift on a 30 mm eye must read exactly 0.1.
Convention, stated once more because Phase 5 lives or dies by it: horizontal positive toward image right, vertical positive toward image bottom, in unmirrored measurement space. The manual check asks the owner to observe which direction of real gaze reads positive, the calibration note 5.2's quadrant mapping will consume.
Everything in this phase builds on these two numbers: quadrants at 5.2, calibration at 5.4, fixations at 5.7, the heatmap at 5.9.

## 5.2 The first classification, and the mirror inside the signs

The concept this increment teaches is classification, turning continuous numbers into a named answer, and the perspective flip hiding inside it.
The mechanics are two comparisons: the mean of both eyes' offsets, split at zero on each axis, gives one of four quadrant names. The intelligence is entirely in the signs, and they contain a genuine surprise worth working through once. When you look toward YOUR screen's left, your irises rotate toward your own left, and in the unmirrored camera image your left side appears on the RIGHT. So positive horizontal, image right, means screen left. The measurement space and the user's perspective are mirror images of each other, and the quadrant names are spoken in the user's language, which is the only language a "Looking toward" line should speak.
The labelled fixtures the ladder asked for are synthetic: each gaze shift carries the quadrant a human at the screen would name, and the classifier must agree on all of them, both axes, both magnitudes.
Two honest limits ship in the open. Zero-centred boundaries assume neutral gaze reads zero, which no real setup guarantees, a laptop camera above the screen makes "straight ahead" read slightly downward, biasing the vertical split. And averaging both eyes trusts them equally. Both limits are calibration's business, and calibration is 5.4, two increments away, which is exactly why the display says "uncalibrated" after its answer.
Classification returns immediately at 5.3, where the question becomes binary, on screen or off, and the honest answer needs a threshold rather than a sign.
