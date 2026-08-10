# ADR-0004: the vendored model reports its own usage to Google

Status: accepted. Date: 2026-08-10.

## Context

ADR-0002 chose to vendor the MediaPipe model and WASM rather than load
them from a content delivery network, and recorded "zero runtime third
party calls" as the first good consequence. That was the main reason the
decision was worth its cost, a 3.7 MB binary committed forever.

**That consequence was never measured, and it is false.**

The August 2026 audit measured it three times independently, including
once by an agent instructed to refute the finding. About sixty seconds
after `FaceLandmarker` is created, the bundled library sends a `POST` to
`https://odml.pa.googleapis.com/v1/log` and receives HTTP 200. It needs
**no detections at all**, only graph construction. The endpoint string is
present in the built bundle at `dist/assets/index-*.js`.

The payload is a protobuf of usage statistics. No video, no image, no
landmark and no measurement is in it. The privacy stance survives in
substance. The published claims did not: six places said "no telemetry"
or "no data leaves your device", and one of them was printed on the page
itself.

This ADR does not edit ADR-0002. ADRs are not edited after merge. It
records what was learned about that decision's consequences.

## Options considered

1. **Say nothing and try to block it first.** Rejected. The claim is
   false today and every day it stands is a day the most checkable
   statement in the repository is wrong. Whether it can be blocked is
   unknown; the correction is owed either way.
2. **Drop MediaPipe.** Rejected without investigation. It is the only
   thing here that finds a face, and no alternative was assessed. If
   blocking proves impossible and the reporting proves to carry more than
   usage counts, this reopens.
3. **Correct the claims now, investigate blocking separately.**
   Accepted.

## Decision

Correct all six sites to say what is true: your video and measurements
never leave the browser, and the bundled model sends anonymous usage
statistics to Google.

Investigate blocking as its own increment, timeboxed to one day, with
three candidates: a MediaPipe option if one exists, a build-time patch of
the vendored bundle, and a Content Security Policy `connect-src` that
permits only our own origin. Record the answer here even if the answer is
that it cannot be blocked.

## Consequences

- Good: the page's own privacy sentence is now checkable by anyone with a
  network tab open, which is what it always claimed to be.
- Good: a guard now fails the build if any of the retired phrases returns
  to a tracked file, so this cannot silently regress.
- Bad: the page must disclose a third-party call it did not choose and
  cannot presently stop, which is a worse sentence to read than the one
  it replaces.
- Bad: ADR-0002's stated benefit is diminished. Vendoring still buys
  reproducible builds, offline development and no CDN dependency for the
  model itself. It does not buy silence.
- Open: whether the reporting can be blocked, and at what cost. Until
  that is answered this ADR is the honest statement of the position.
