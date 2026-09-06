# PROJECT.md

The product requirements document (PRD). Short on purpose. Updated only when the product intent changes.

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

## Non goals

- Not a medical device, not a safety product, not for clinical or workplace use.
- Not a commercial product and not connected to any company codebase or dataset.
- No user data leaves the browser. Ever. No backend and no analytics of ours. (The vendored face model tries to send its own usage statistics to Google, and this page intercepts the request before it leaves the browser. Measured and recorded in ADR-0004. No user data is in it either way.)
- Not optimised for accuracy over teachability. When a simple explainable method and a complex accurate one compete, choose the simple one and write down why.

## Success criteria

a. At least one push per week for 26 weeks.
b. Each phase ends with a recordable demo.
c. Every number displayed is traceable to a tested pure function.
d. A stranger can clone and run it in under 5 minutes.

## Constraints

- Browser only. All processing happens on the user's device.
- No data leaves the device, at any time, for any reason.
- Explainability beats accuracy whenever the two compete.

## Out of scope

- Medical, clinical, safety or workplace monitoring use of any kind.
- Any backend, account system, analytics or telemetry.
- Any commercial material: proprietary algorithms, thresholds, customer data, company branding.
- Mobile support, until an ADR (architecture decision record) argues for it.
