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
