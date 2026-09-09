# PROJECT.md

The product requirements document (PRD). Short on purpose. Updated only when the product intent changes.

Read in full on 7 September 2026, claims `9904b409`. That stamp records a READ, not an edit: it goes stale when a claim in this file changes, and not when a generated block or a count figure moves. This first one was made by an automated pass, which is weaker evidence than the maintainer's own read and is labelled so rather than left to be assumed. Roadmap 10.0b6.

## Problem statement

Eye signals such as blinks, eyelid aperture and gaze carry real information, but most tools that measure them are closed, complex, or both.
The author wants to learn software engineering properly, in public, in very small steps, by building something real.
A browser and a webcam should be enough. No server, no account, no installation.
Every number shown on screen must be explainable and traceable to a tested function.
The result is a learning laboratory, not a product.

## Who it is for

- The author, a product designer learning software engineering.
- Anyone who wants to learn eye signal processing in the browser.

## Goals

1. Learn software engineering properly by building something real, in public, in very small steps.
2. Produce a weekly public GitHub trail and demo material for writing about vision, perception and eye tracking.
3. Build intuition about eye signals: blinks, eyelid aperture, pupil, gaze, fixations, attention, drowsiness proxies.
4. Measure on the devices people actually have, phones included. Capability is a property of a SETUP and not of a device class: this project's own dry run had a phone out-resolve the DSLR rig, so a phone is a different setup with its own measured numbers rather than a lesser tier. In scope since [ADR-0005](decisions/ADR-0005-explainability-and-mobile.md), which brought this file to work that had already shipped.

## Non goals

- Not a medical device, not a safety product, not for clinical or workplace use.
- Not a commercial product and not connected to any company codebase or dataset.
- No user data leaves the browser. Ever. No backend and no analytics of ours. (The vendored face model tries to send its own usage statistics to Google, and this page intercepts the request before it leaves the browser. Measured and recorded in ADR-0004. No user data is in it either way.)
- Not optimised for accuracy over teachability. When a simple explainable method and a complex accurate one compete, choose the simple one and write down why. ADR-0005 states what happens when the accurate one wins on the numbers: the result is recorded and the method is not shipped.

## Success criteria

a. At least one push per week for 26 weeks.
b. Each phase ends with a recordable demo.
c. Every number displayed is traceable to a tested pure function.
d. A stranger can clone and run it in under 5 minutes.

## Constraints

- Browser only. All processing happens on the user's device.
- No user data leaves the device: no video, no image, no landmark, no
  measurement, at any time, for any reason. The one thing that ever tried
  to leave was the vendored face model's own usage report to Google, and
  this page intercepts that request before it leaves the browser.
  Measured and recorded in ADR-0004.
- Explainability beats accuracy whenever the two compete, and the
  tie-break is written down rather than left to the moment: an accuracy
  gain is taken when it can be explained, and an accuracy gain that
  cannot be explained is recorded and not shipped. It goes into the
  result files as a measured fact about what is possible; it does not go
  into the page or the score. Roadmap amendment 16's goal of raising
  accuracy to this hardware's ceiling is pursued through instrument work
  — a corrected stepper, an honest frame driver, a personal ruler —
  rather than through a method nobody can audit. Decided in
  [ADR-0005](decisions/ADR-0005-explainability-and-mobile.md),
  7 September 2026, after the first full read under the stamp at the
  foot of this file found this line and one under Out of scope both
  saying things the project had moved past.

## Out of scope

- Medical, clinical, safety or workplace monitoring use of any kind.
- Any backend, account system, analytics or telemetry.
- Any commercial material: proprietary algorithms, thresholds, customer data, company branding.
