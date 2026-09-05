# ADR-0004: the vendored model reports its own usage to Google

Status: accepted. Date: 2026-08-10.

## Context

ADR-0002 chose to vendor the MediaPipe model and WASM rather than load
them from a content delivery network, and recorded the absence of any
runtime third-party call as the first good consequence. That was the main reason the
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
substance. The published claims did not: six places denied any reporting
of any kind, and one of them was printed on the page itself.

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

## The answer, 5 September 2026: it can be blocked, cheaply

The Decision reserved this space for the result of the blocking
increment, "even if the answer is that it cannot be blocked". The answer
is that it can.

Option 1 from the list above — a MediaPipe option — does not exist: the
bundle exposes no flag to silence the log. Option 2, a build-time patch
of the vendored bundle, was rejected as a maintenance trap: it would have
to be reapplied on every dependency bump and would silently rot the first
time the endpoint string moved. The Content Security Policy candidate
(option 3) works against the network but collides with the same-origin
WASM load and, being declarative, cannot hand the caller a synthetic
success, so a fire-and-forget POST could stall.

What shipped is a fourth path the original list did not name: intercept
the browser's own send primitives before the model is ever created. A
pure matcher, `src/core/telemetryPolicy.ts`, decides that any
`googleapis.com` host is telemetry the app has no legitimate reason to
reach — the model and its WASM runtime are vendored and served from this
origin, so nothing here calls that domain on purpose. An installer,
`src/io/telemetryBlock.ts`, wraps `fetch`, `XMLHttpRequest` and
`navigator.sendBeacon` so a blocked URL is dropped inside the page and
the caller is handed a synthetic 204 or a `true`, and `main.ts` installs
it at the very top, before `loadLandmarker` runs.

The block is net-shaped rather than surgical on purpose: which of the
three transports MediaPipe reaches for is its implementation detail and
could change under us, so all three are covered. The proof is two
Playwright assertions: a deterministic one that calls all three
transports at the exact endpoint from inside the page and sees nothing
reach the network, and a live one that drives a real camera session past
the sixty-second report point. The live test was checked for teeth —
with the guard disabled it captured the real
`odml.pa.googleapis.com/v1/log` POST and went red — so its green is
evidence the guard works, not evidence the library stayed quiet.

- Good: the disclosure a few paragraphs up is now paired with a
  mechanism. The library still _attempts_ the report; it no longer
  _completes_ it, and an end-to-end test says so on every pull request.
- Bad: this is interception, not removal. A future MediaPipe that
  reported over a transport we do not wrap, or to a host we do not match,
  would slip through. The live test is the tripwire for that: if the
  report ever leaves again, it goes red.
- Not done: the claims corrected in the Decision stay corrected as
  written. Blocking the call does not license a fresh "sends nothing"
  sentence anywhere; the retired phrases are still retired, and the
  disclosure still names the dependency's attempt.
