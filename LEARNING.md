# LEARNING.md

One plain English note per increment. Written for the human, not for the machine.

## 0.1 Working documents before code

The concept this increment teaches is the working document. Before writing code, we wrote four short files that act as contracts.
PROJECT.md says what we are building and, just as important, what we refuse to build. SPEC.md says how the parts must talk to each other. ROADMAP.md is the ordered list of small steps. STATE.md is a ten line snapshot of where we are.
Why this matters: software goes wrong most often not in the typing but in the deciding. When decisions live only in someone's head, every session starts with re-deciding, and re-deciding drifts.
These files also solve a practical problem: an AI assistant has no memory of past sessions unless something on disk carries it. STATE.md is that carrier. Reading three files replaces an hour of "where were we".
This idea comes back in every single session, because every session starts by reading these files. It also comes back at increment 0.8, where an ADR (architecture decision record) does the same job for decisions that are expensive to reverse.
