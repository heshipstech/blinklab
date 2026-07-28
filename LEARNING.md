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
