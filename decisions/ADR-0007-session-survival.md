# ADR-0007: session survival on phones and laptops

Status: accepted. Date: 2026-09-14.

## Context

The demo is measured on hardware a desktop web page takes for granted and
a phone or a laptop does not hold still. Six phone sessions are in the
record: five iPhone — the dry run's `iphone`, `iphone17promax` and
`iphone2` (`docs/validation-dry-run.txt`) and round I's P4 and P6
(`docs/validation-round.txt`) — and round I's P3, an Android. Roadmap row
13.1 names "five phone sessions"; the five are the iPhone ones, and the
Android is the sixth, cited here so the count is not quietly rounded.

Three failure modes show up on that hardware and nowhere else, and each is
a session lost or a number moved:

- **The screen sleeps mid-session.** A phone or a laptop dims and locks
  after an idle timeout, and the frame loop stops with it. The 260-second
  light protocol (roadmap 14.10, 14.11) and any unattended run are exactly
  the sessions that outlive the idle timer. Nothing in the app asks the
  screen to stay awake.
- **The device rotates.** `screen.orientation` is read once at session
  start (`src/io/deviceInfo.ts`) and never again, so a rotation mid-session
  is invisible to the export — and orientation changes the frame geometry
  the aperture is measured in.
- **The camera faces the wrong way.** Mirror defaults ON
  (`src/main.ts`, `mirrored = true`), which is right for a front camera and
  wrong for an environment (rear) one, where the picture should not flip.

These are separate from the engine question. Row 13.0 — does WebKit agree
with Chromium on a fixed clip — is owner-gated (it needs the owner's Mac to
pair the two engines) and, per amendment 24, its premise about the results
block was already false in the repository; amendment 25 re-scoped 13.1 so
this ADR names the engine question as OPEN and deferred to 13.0 rather than
citing an answer it has not produced. The survival kit below does not
depend on that answer.

## Options considered

1. **Treat a phone like a desktop.** Rejected: it is the status quo, and
   the record already shows what it costs — the long-closure over-count
   fired three and two events for one six-second closure on iPhones and
   twice on the Android
   (`docs/audit/2026-09-06-appendix-all-findings.md`), and the
   light-response overlay trapped touch users with no exit on iPhone
   Safari. A page that ignores the device class the era goal names is the
   mis-fit this row exists to close.
2. **Full application-lifecycle management** — a service worker,
   background wake, install prompts. Rejected: over-scoped for a demo page,
   and it buys nothing the three concrete failures above need.
3. **A minimal survival kit, three pieces, each measured or refused rather
   than assumed.** Accepted.

## Decision

The survival kit is three pieces, landing in this order:

1. **A wake lock, re-requested on `visibilitychange`.** The Screen Wake
   Lock API is requested when a session starts and re-requested when the
   tab becomes visible again (the lock drops on tab-hide by
   specification). This is a laptop need as much as a phone one — the
   260-second light protocol and rows 14.10/14.11 outlast a laptop's idle
   timer too — so it is the FIRST code slice, and it is testable here
   against a fake `navigator` with no device: `wakeLock.request` present,
   absent, or rejecting each has a defined behaviour, and a rejection is
   recorded, never thrown, on the metadata-step precedent row 13.2 set for
   frame-rate negotiation.
2. **Orientation re-reads with a flip count in the export.**
   `screen.orientation` is read on change, not only at start, and the
   number of flips rides the export so a session that rotated says so.
3. **The Mirror default off on an environment camera.** When the active
   track's `facingMode` is `environment`, Mirror defaults off; a front
   camera keeps today's mirrored default.

The engine question stays with row 13.0 and the owner's Mac. This ADR
adopts no cross-engine claim: 13.1's phone-specific rows that need the
engine answer wait on 13.0, and only the wake-lock slice — which needs it
not at all — proceeds now.

## Consequences

A session on a phone or a laptop keeps its screen awake, records when it
rotated, and does not flip an environment camera. What this does NOT do: it
does not make the engines agree (that is 13.0), it does not add a service
worker or offline support, and it does not change any measurement — the
aperture, the blink line and the four reducers are untouched. The
wake-lock wrapper is the next slice; row 13.1 keeps its `[ ]` marker until
every piece and the owner's engine run are in.
