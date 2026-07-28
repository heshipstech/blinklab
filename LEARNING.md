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
