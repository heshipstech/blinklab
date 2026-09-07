# PROJECT.md

The product requirements document (PRD). Short on purpose. Updated only when the product intent changes.

Read in full on 7 September 2026, claims `5af2f7ac`. That stamp records a READ, not an edit: it goes stale when a claim in this file changes, and not when a generated block or a count figure moves. This first one was made by an automated pass, which is weaker evidence than the maintainer's own read and is labelled so rather than left to be assumed. Roadmap 10.0b6.

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
- No user data leaves the device: no video, no image, no landmark, no
  measurement, at any time, for any reason. The one thing that ever tried
  to leave was the vendored face model's own usage report to Google, and
  this page intercepts that request before it leaves the browser.
  Measured and recorded in ADR-0004.
- Explainability beats accuracy whenever the two compete.

> **Two lines in this file are under an open decision, and until it is
> made this file should be read with that in mind.** The line above and
> "Not optimised for accuracy over teachability" under Non goals both
> say explainability wins; roadmap amendment 16, accepted 5 September
> 2026, sets the era's goal as raising accuracy to the most this class
> of hardware can deliver. Those may not conflict — pursuing accuracy
> hard while refusing an unexplainable method is a coherent position —
> but nothing here says so. Separately, "Mobile support, until an ADR
> argues for it" under Out of scope is contradicted by shipped work: the
> phone surface of roadmap row 14.0b is merged, a phone viewport runs in
> the end-to-end suite, and MODEL_CARD records that sessions behind the
> published numbers came from phones. The ADR that this file's own
> wording requires was never written. Resolving both is ADR-0005,
> remediation D13, and it is a decision about intent rather than a fact
> in the record, so it waits for the owner rather than being settled by
> whoever noticed. Noted 7 September 2026 by the first full read under
> the stamp at the foot of this file.

## Out of scope

- Medical, clinical, safety or workplace monitoring use of any kind.
- Any backend, account system, analytics or telemetry.
- Any commercial material: proprietary algorithms, thresholds, customer data, company branding.
- Mobile support, until an ADR (architecture decision record) argues for it.
