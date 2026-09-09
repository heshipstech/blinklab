# Engineered role and prompt: the Neon port development plan

This file is a prompt-engineering artefact, not project documentation. It
contains a **role** (a system prompt) and a **prompt** (a task brief) to be
given to Claude Code so that it produces a comprehensive development project
plan for converting the blinklab browser prototype into software that
integrates with the **Pupil Labs Neon** eye-tracking glasses, for measuring
and monitoring fatigue, attention, cognitive-state proxies, drowsiness, and
microsleep-range closure events from eye signals.

Provenance: engineered on 9 September 2026 from (a) a full review of this
repository at commit `c8e7813` — README, SPEC, MODEL_CARD, ROADMAP,
STATE, DATASETS, ARCHITECTURE, PROJECT, all five ADRs, the guard tooling,
and the `src/core` source itself — and (b) a research pass over the Pupil
Labs Neon platform: docs.pupil-labs.com, the `pupil-labs` GitHub
organisation (11 official repositories read at source), the Real-Time API
OpenAPI specification, the blink-detector and accuracy white papers, and
independent published evaluations. Facts from that research are embedded in
the prompt below as two dossiers so the planning agent starts grounded
rather than guessing; the prompt still instructs it to re-verify anything
load-bearing against the primary sources it can reach.

This file makes no claims about blinklab itself; where it summarises the
prototype it cites the repository documents that do.

---

## How to use this file

1. Start a **fresh** Claude Code session. Give it this repository (read
   access is enough) and, if possible, outbound network access to
   `docs.pupil-labs.com`, `pupil-labs.com`, and `github.com/pupil-labs`.
2. Install the role: pass Part 1 via `--append-system-prompt` (or paste it
   as the first message, prefixed "Adopt this role for the whole session:").
3. Paste Part 2 in full as the task.
4. Expect the session to read repository files and fetch Neon documentation
   before writing anything. That is by design; a plan written before the
   verification pass should be rejected.
5. The deliverable is a plan document set (see "Required deliverable" in
   Part 2), not code. Review it with the checklist in Part 3.

---

## Part 1 — The role

> You are a principal engineer with twenty years across real-time
> physiological signal processing, wearable and embedded systems, computer
> vision, and oculomotor measurement. You have shipped driver-monitoring
> and research-instrument software, planned hardware/software integrations
> end to end, and cleaned up after teams that skipped the planning. You are
> fluent in TypeScript and Python, in Android-tethered sensor platforms, in
> network streaming (RTSP/RTP, WebSocket, LSL), and in the scientific
> literature on blinks, PERCLOS, pupillometry, saccadic dynamics, and
> drowsiness. You know the regulatory terrain: where research instruments
> end and medical devices or safety components begin, what GDPR Article 9
> means for biometric eye data, and what the EU driver-drowsiness rules
> (DDAW, Commission Delegated Regulation (EU) 2021/1341) require of anyone
> who wanders into driving use cases.
>
> Your defining professional habits, which govern every sentence you write:
>
> 1. **Provenance or silence.** Every number, API name, sample rate, field
>    name, and threshold you state carries its source: a file you read, a
>    document you fetched, a paper you cite, or an explicit label
>    `ASSUMPTION` or `UNVERIFIED`. You never invent an endpoint, a data
>    field, or a specification value. If you cannot verify something that
>    the plan depends on, you say so and add it to the open-questions
>    register instead of papering over it.
> 2. **Facts, assumptions, and decisions are three different things**, and
>    you label them. A decision states its alternatives and why they lost.
> 3. **Requirements are testable or they are wishes.** Every requirement
>    you write has an acceptance criterion a machine or a named procedure
>    can check.
> 4. **You plan for the team that exists** — currently a solo
>    owner/product-designer working with Claude Code, a limited budget, and
>    no lab — not for a fantasy organisation. Where a step genuinely needs
>    resources that do not exist yet (participants, ethics review, a second
>    device), the plan says so and prices it rather than assuming it away.
> 5. **Measurement honesty above polish.** You inherit and preserve the
>    prototype's discipline: null means not measured and is never zero;
>    refusing beats guessing; thresholds carry their derivation; wrong
>    published numbers are corrected beside, never overwritten;
>    pre-register predictions before reading the data that scores them.
> 6. **You write plans that survive contact with reality**: explicit entry
>    and exit criteria, risks with owners and triggers, and no milestone
>    whose completion cannot be demonstrated.
>
> You write in clear, specific prose. You never pad. A section that would
> only contain generic project-management boilerplate is replaced by one
> sentence saying why it is not needed here.

---

## Part 2 — The prompt

### Mission

Produce the complete development project plan for the working title
**blinklab-neon**: the evolution of the blinklab browser prototype into
software that integrates with the Pupil Labs Neon eye-tracking glasses to
**measure, monitor, and flag fatigue, attention, cognitive-state proxies,
drowsiness, and microsleep-range closure events** from eye signals —
blinks, gaze, PERCLOS, eyelid aperture and openness, pupil diameter,
fixations, saccades, closures, head motion, and whatever else the evidence
supports.

The plan is the deliverable. Do not write product code. Write the document
an extremely experienced software/hardware engineer would insist on having
before development begins: every definition, specification, criterion, use
case, milestone, feature, roadmap phase, and technical decision framed —
either decided with reasoning, or explicitly parked as an open question
with what it would take to close it.

### Step 0 — Verification pass (do this before writing any plan text)

Read, in this order, from the blinklab repository:

1. `ARCHITECTURE.md` — the five-minute shape of the prototype.
2. `PROJECT.md` — the current PRD, whose constraints the new project
   deliberately breaks (see "Strategic framing" below).
3. `SPEC.md` — data contracts: `FeatureRecord`, CSV encoding, the 57-key
   metadata block, error states.
4. `src/core/constants.ts` — every threshold with its derivation. The
   single most information-dense file in the repository.
5. `src/core/blink.ts`, `longClosure.ts`, `perclos.ts`, `baseline.ts`,
   `blinkShape.ts`, `score.ts`, `alert.ts`, `fixation.ts`, `pupil.ts` —
   the reducers the port would carry.
6. `MODEL_CARD.md` — measured accuracy, the eight failure modes, and the
   uncertainty statements.
7. `ROADMAP.md` — skim the 23 amendments and Phase 13 ("capture chain and
   platform truth"); several open rows are answered or unblocked by this
   hardware.
8. `decisions/ADR-0001` through `ADR-0005`.
9. `tools/claimGuard.mjs` — the retired-claims and vocabulary guard; the
   plan must respect it (see Ground rules).

Then verify the Neon facts you will rely on against primary sources if the
network allows: `docs.pupil-labs.com/neon/` (data streams, data format,
real-time API, time synchronization, LSL), the OpenAPI spec at
`github.com/pupil-labs/realtime-network-api`, client source at
`github.com/pupil-labs/pl-realtime-api` and
`github.com/pupil-labs/pl-neon-recording`, the blink-detector white paper
at `assets.pupil-labs.com/pdf/Pupil_Labs_Blink_Detector.pdf`, and the
Alpha Lab PERCLOS tutorial at `docs.pupil-labs.com/alpha-lab/perclos/`.
Where the network refuses, rely on Dossier B below and mark each such fact
`UNVERIFIED (dossier 2026-09-09)` in the plan.

### Strategic framing the plan must confront (not bury)

blinklab's own PRD excludes precisely what this project does: it is
browser-only, forbids new hardware purchases (ROADMAP amendment 16 keeps
row 13.12 dormant on exactly that constraint), and rules out safety,
workplace, clinical, and commercial use. **The port is therefore a new
product with its own PRD, not an increment of blinklab**, and the plan's
first real section must define the relationship: a separate repository (or
a cleanly separated package) that imports the prototype's portable core
and its engineering discipline, leaves the learning-lab's published claims
untouched, and writes its own scope. Every guard-enforced discipline worth
keeping — provenance-carrying constants, refusal semantics, pre-registered
predictions, wrong-answers-stay-published, the claim/vocabulary guards —
should be ported as deliberately as the code. State this framing as a
decision with alternatives (fork vs monorepo vs greenfield), and seed the
new project's ADR-0001 with it.

### Dossier A — What the prototype is (verified against the repository, 2026-09-09)

**Shape.** TypeScript + Vite, no framework; MediaPipe Face Landmarker (478
landmarks) in-browser; a strictly pure `src/core` of ~85 modules (no DOM,
no camera — lint-enforced) wired by one 5,285-line `main.ts`; 1,611 unit
tests in ~3 s without a browser; Playwright E2E for wiring; a separate
Python `analysis/` layer that only ever reads exported CSV; 27 CI guard
modules that pin published numbers, retired claims, and vocabulary to
evidence files.

**Signal chain.** Aperture in millimetres via the iris-as-ruler
(11.7 mm assumed iris width, ±4% person-to-person error, cited to Rüfer
et al. 2005); personal baseline = p90 of 30 s of open-eye samples, frozen
for the session, refused outright if p90 > 1.25 × median; blink line =
0.5 × baseline (or a guided-calibration midpoint line when stored); blink
state machine with 10% depth-arming hysteresis, 150 ms refractory, 10%
re-arm band, 500 ms maximum closed phase; long closures on a separate
"shut" line of 0.4 × baseline firing at >500 ms while eyes are still
closed; PERCLOS as a 60 s duty cycle on that same shut line —
**deliberately non-standard**: it includes blink time and sits at 0.4
instead of the literature's P80 because MediaPipe reads fully shut eyes at
about a third of baseline, never near zero; blink shape (amplitude, peak
closing velocity, amplitude/velocity ratio) — published as a floor below
~60 fps because one finite difference under-reads velocity by up to 60% at
25 fps; I-DT fixations; One Euro-smoothed gaze offset in iris-width units;
a ray-cast pupil estimator that is measured dead at webcam optics (1 of
239 s resolved in its pre-registered light-response experiment — an
instrument fact, not a physiology fact); a 0–100 alertness score that is
exactly 100 minus four named, capped penalties (PERCLOS 40, long closures
30, slow blinks 15, sluggish lids 15), null whenever its inputs are
untrustworthy; KSS (1–9) self-report labels; a debounced alert governor.

**Refusal semantics run through everything**: null is never zero; frames
outside ±20° pitch / ±25° yaw / ±25° roll are refused, not corrected;
blink metrics refuse below 25 fps and warn below 60; PERCLOS refuses under
15 s span, 100 samples, or a >2 s stale window; a score is null when the
newest record saw no face. Exports are a per-second 26-field
`FeatureRecord` CSV with a 57-key metadata block plus a separate per-event
blink log with frame numbers; every field name carries its unit.

**Measured performance (all on the webcam instrument, all with published
caveats):** Eyeblink8 blink detection recall 83.6% / precision 84.0%
(WebKit, preparation-sensitive, and near a measured ceiling: ~49 of 67
misses are closures the face model simply does not register on two
independent landmark signals); DROZY drowsiness correlations a
pre-registered null (PERCLOS r ≈ 0.00, with the sleepiest sessions
systematically excluded by the 15 fps floor); UTA-RLDD alert-vs-drowsy
0.732 balanced accuracy (chance 0.5, cohort-level); the alertness score
separates alert from drowsy at AUC 0.70 across strangers, per-person
unvalidated. Blink durations are device-conditioned (~96 ms on iPhones vs
149–166 ms on Macs, unexplained). The webcam capture chain has a known
open defect: inference runs per display tick, not per camera frame, so
velocity-family metrics scale with display refresh (roadmap 13.8b).

**What ports cleanly:** the entire pure reducer layer —
`blink.ts`, `longClosure.ts`, `perclos.ts`, `baseline.ts`, `blinkRate.ts`,
`blinkShape.ts`, `score.ts`, `alert.ts`, `closureTaxonomy.ts`,
`blinkRhythm.ts`, `recordGate.ts`, `frameClock.ts`, `sessionVerdict.ts`,
`csv.ts`, `featureRecord.ts` — consumes `(state, timestampMs, apertureMm,
thresholdMm)` and never mentions MediaPipe, a camera, or a pixel. Their
tests, the CSV/metadata contracts, and the refusal discipline transfer
as-is. **What must be re-sourced:** everything landmark-shaped —
`aperture.ts`, `ear.ts`, `gazeOffset.ts`, `headPose.ts`,
`landmarkGuard.ts`, `pupil.ts`, `validityGate.ts`, the landmark index
tables, and all of `src/io`.

**Four prototype decisions that must be re-taken for Neon, not ported:**

1. **The iris ruler dies.** Neon reports eyelid aperture directly in
   millimetres from a 3D eye model; the 11.7 mm assumption and its ±4%
   error go away, and with them every millimetre threshold derived on the
   webcam instrument (the 4 mm fixed line included). Head-pose refusal
   loses its reason to exist on a head-mounted camera; do not port
   `validityGate` as a no-op — replace it with Neon-appropriate validity
   (worn detection, per-eye confidence, module slippage).
2. **The 0.4 shut line and the PERCLOS convention must be re-derived by
   measurement.** The 0.4 exists only because MediaPipe's shut-eye reading
   floors at ~1/3 of baseline. If Neon's aperture approaches zero on a
   shut eye — characterise this early — the literature's P80 becomes
   reachable for the first time, PERCLOS becomes comparable to other
   systems, and a blink-excluded PERCLOS (roadmap 12.10a) becomes possible
   to do properly. Commit a prediction before measuring.
3. **The frame-rate story inverts at 200 Hz.** The 25 fps refusal gate and
   60 fps risk warning never fire; the catch-probability band closes;
   peak closing velocity stops being a floor and becomes a measurement —
   which means the sluggish-lid score ramp (150→300 ms) and every
   velocity-derived normal band were priced against a biased estimator and
   must be re-derived. The prototype's explicitly declined category —
   saccade velocity, main-sequence metrics — reopens.
4. **The external benchmark is lost.** Eyeblink8 is webcam video of faces;
   a head-mounted tracker cannot be scored on it, and the ratchet/guard
   system anchored to it does not transfer. The plan must establish a
   replacement ground truth (see Validation section requirements) before
   any detector claim is made on the new instrument.

**What Neon unblocks for free** (tie these to roadmap rows in the plan):
pupillometry on real optics (dormant row 13.12 — the pre-registered plan
in `docs/pupil-light-plan.md` already exists), frame-rate negotiation and
capability rows (13.2/13.3/13.6a), per-photograph inference (13.8b), the
unexplained device-conditioned blink-duration gap (10.9), and gaze
validation in degrees rather than iris-offset units (14.9, F-035).

### Dossier B — What the device is (researched 2026-09-09; re-verify load-bearing items)

**Hardware.** Neon module (~7.3 g, in the nose bridge of swappable
frames): two IR eye cameras, 192×192 px per eye at **200 Hz** (delivered
as one 384×192 side-by-side stream), two 850 nm IR LEDs (works in
darkness); scene camera 1600×1200 @ 30 Hz (FOV stated 103°×77° in docs;
132°×81° appears in some spec sheets — verify); 9-DoF IMU at ~110 Hz;
stereo microphones; USB-C to a **Companion phone** (Samsung Galaxy S25 or
Motorola Edge 40 Pro currently shipped; OnePlus 10 Pro and older supported
with caveats; OS version pinned by vendor, updates discouraged). Battery:
~4 h continuous recording at 200 Hz; indefinite via powered USB-C hub
(officially supported, including Ethernet-over-hub). A "Bare Metal"
module-only option plus published CAD (`pupil-labs/neon-geometry`) exists
for building the module into custom frames; bundles run roughly
€5,900–6,250 (academic ~€5,200–5,515) — reseller-sourced, confirm.

**On-device computation (NeonNet, closed source, runs in the Companion
app):** calibration-free gaze (binocular + dual monocular; median accuracy
~1.8° uncalibrated, ~1.3° with one-point offset correction; <10 ms
capture-to-gaze), 3D eye state (eyeball centre, optical axis per eye),
**pupil diameter in mm per eye**, **eyelid aperture in mm and eyelid
angles in radians per eye** (the eye-openness signals — PERCLOS-grade
inputs), blink events, fixation/saccade events (I-VT with optic-flow
compensation for head motion; Drews & Dierkes, Behav Res Methods 2024),
and worn detection. Real-time gaze rate selectable 33/100/200 Hz; eye
video is always recorded at 200 Hz and Pupil Cloud can recompute at full
rate post-hoc. Fixation detection on-device requires the 200 Hz setting;
eyelid/eye-state streams require "Compute eye state" on and Companion app
≥2.9 (pin **≥2.9.31** for eyelid + dual-mono + eye-event streams).

**Integration surfaces — there is no third-party on-device SDK.** The
supported pattern is a companion computer on the same network:

- **Real-Time API** (spec: `pupil-labs/realtime-network-api`, Neon
  v2.1.0): REST at `http://neon.local:8080/api` (`/status`,
  `recording:start`, `recording:stop_and_save`, `recording:cancel`,
  `/event` with optional caller-supplied UTC-nanosecond timestamps,
  template endpoints), WebSocket status push, and **RTSP/RTP** streams per
  sensor: `gaze`, `world`, `imu`, `eyes` (the 384×192@200 Hz eye video —
  raw eye video is available live), `eye_events`, `audio`. The gaze RTP
  payload versions up through: x/y + worn → + pupil diameters, eyeball
  centres, optical axes → + eyelid angles/apertures → + dual-mono gaze.
  `eye_events` carries blink events (start/end ns) and fixation/saccade
  events including **onset events** streamed before the event completes.
  Discovery via mDNS. Python client `pupil-labs-realtime-api` (MIT,
  Python ≥3.10) with blocking and async layers and matched-frame helpers;
  a C++ client exists.
- **Timestamps** are UTC nanoseconds stamped by the phone (NTP-disciplined;
  "force NTP sync" available). The **Time Echo** protocol (TCP port
  advertised in `/api/status`) gives millisecond-level phone↔computer
  offset estimation; RTCP maps stream clocks to wall clock.
- **LSL** is built into the Companion app (gaze + eye-state channels and
  an event channel; no video/IMU over LSL).
- **Recording formats:** native on-phone format (binary `.raw`/`.time`
  sensor pairs incl. `eye_state` records carrying pupil diameter, eyeball
  pose, eyelid angles/apertures; `blinks`, `fixations`; H.264 scene and
  eye video; `info.json`, factory `calibration.bin`) readable offline with
  `pupil-labs-neon-recording` (MIT, lazy NumPy timeseries) and **Neon
  Player** (desktop GUI, Python plugin system). **Pupil Cloud** (optional;
  full workflows exist without it) adds 200 Hz recompute, enrichments
  (marker/reference-image/face mapping), CSV timeseries downloads
  (`gaze.csv`, `blinks.csv`, `fixations.csv`, `saccades.csv`,
  `3d_eye_states.csv` with the eye-openness columns, `imu.csv`), and a
  REST API (`api.cloud.pupil-labs.com`, token auth).
- **USB path:** `pupil-labs/pl-neon-usb` drives the bare module from a
  Linux host without the phone — raw 200 Hz eye video, scene video, IMU —
  but **without any NeonNet outputs**; you would bring your own models.
  An OEM program exists for licensing NeonNet into custom hardware
  (`pupil-labs.com/integration`).

**First-party fatigue-relevant prior art to build on, not rediscover:**
the Pupil Labs blink-detector white paper (2023: 200 Hz eye video →
64×64 downscale → per-frame onset/offset/background classification →
event assembly); the Alpha Lab tutorial "Real-Time Eyelid Dynamics with
PERCLOS" (5 s open-eye baseline, per-eye p95, percent closure
= 1 − aperture/baseline, PERCLOS = share of samples ≥80% closure over a
rolling window — a first-party blueprint whose window and baseline choices
the plan should critique against the prototype's stricter refusal
discipline); and the `real-time-blink-detection` repository (note: no
license file — resolve before commercial use).

**Known latency picture:** <10 ms on-device; RTSP-over-UDP recommended
live; tens of milliseconds typical over Wi-Fi (~60–100 ms reported for
WebSocket transport); Ethernet via powered hub for timing-critical use.
Thermals throttle older phones at sustained 200 Hz.

### Ground rules for the plan

1. **Vocabulary and claims discipline** (inherited from
   `tools/claimGuard.mjs`, and kept in the new project): closures may be
   reported as **microsleep-range** (the stopwatch fact) and never as the
   EEG-defined phenomenon itself having been found; equally, never claim
   the absence of third-party network traffic or similar absolutes without
   a measurement to cite. Adopt the guard, do not fight it.
2. **No invented specifics.** Every API endpoint, stream name, field,
   unit, and rate in the plan comes from Dossier B, from a document you
   fetched, or is labelled `UNVERIFIED`/`ASSUMPTION`.
3. **Every requirement gets an ID and an acceptance criterion.** Every
   milestone gets entry criteria, exit criteria, and a demonstrable
   artefact.
4. **Decisions name their losers.** Each significant decision records the
   alternatives considered and why they were rejected.
5. **The plan prices reality**: hardware to buy, participants to recruit,
   approvals to obtain, time for a solo owner plus Claude Code.
6. **No generic filler.** Delete any sentence that would be equally true
   of any other project.

### Required deliverable: THE PLAN

Produce a plan document set (a `plan/` directory of numbered markdown
files, or one master document with numbered sections — your choice, state
it) containing **all** of the following. Sections may be reordered with
reason; none may be silently dropped.

1. **Executive summary** — one page: what is being built, for whom, on
   what hardware, the architecture in one paragraph, the three biggest
   risks, the headline milestones.
2. **Product vision, scope, and non-goals** — the new PRD. Intended use
   statement written with regulatory consequences in mind (research
   instrument first; any driving/workplace/clinical ambition named as a
   separate, gated future with its own regulatory path, never implied).
   Relationship to blinklab (the fork/greenfield decision from "Strategic
   framing"). Explicit non-goals.
3. **Personas and use cases** — concrete, numbered use cases (UC-1…)
   with actors, preconditions, flows, and postconditions. Cover at
   minimum: a researcher running a session and exporting data; a
   self-experimenter monitoring their own state live; a study operator
   running a multi-participant protocol; offline reanalysis of a
   recording; a live alert consumer. For each: which streams, rates,
   latencies, and outputs it needs.
4. **Glossary and signal definitions** — every term the project will
   measure or report, each with: definition, unit, source stream, rate,
   and evidence level. Include at minimum: blink (and its phases), blink
   rate, blink duration, amplitude, peak closing/opening velocity,
   amplitude-velocity ratio, eyelid aperture (mm) and eyelid angles
   (rad), eye openness, PERCLOS (the classical definition AND the
   project's operational one, with the blink-included/excluded distinction
   made explicit), long closure and the closure taxonomy bands
   (prolonged / microsleep-range / sustained), pupil diameter (tonic and
   phasic), gaze direction (deg), fixation, saccade (amplitude, peak
   velocity, main sequence), smooth pursuit if in scope, head pose/motion
   (IMU), worn state, KSS, and the fatigue/attention composite(s).
5. **Candidate signal catalogue for fatigue/attention/cognitive state** —
   a table of every candidate feature with: definition, literature
   support (cite specific papers or mark `weak`), whether the prototype
   already computes it, what Neon adds, rate/latency needs, and an
   in/out/later decision. Must cover at least: PERCLOS variants, blink
   rate/duration/shape family, lid reopening delay, long-closure family,
   blink-rate variability/rhythm, saccadic peak velocity and
   main-sequence deviation, fixation stability and duration statistics,
   gaze entropy/scanning breadth, pupil diameter dynamics (tonic decline,
   pupillary unrest), IMU head-nod/bob signatures, and gaze-on-task /
   distraction proxies. State which composites (score families) will be
   built from them and how the prototype's auditable
   100-minus-named-penalties scheme extends.
6. **System architecture** — a trade study first: (a) companion computer
   subscribing over the Real-Time API (Wi-Fi vs Ethernet-over-hub), (b)
   LSL-centred lab integration, (c) post-hoc-only pipeline on recordings,
   (d) phone-free USB (`pl-neon-usb`) with self-supplied models, (e)
   OEM/NeonNet licensing. Score each against the use cases, latency
   budgets, offline requirements, and team reality; pick one primary and
   one supported secondary; justify. Then the chosen architecture in
   detail: component diagram, processes, languages, data flow from photons
   to alert, deployment story (what runs where), and how the prototype's
   pure-core/io split maps onto it. Decide and defend the implementation
   language(s) for the new acquisition + real-time layer (the reducers are
   TypeScript; the Neon client ecosystem is Python — confront this
   directly: port, bridge, or bilingual with a shared wire contract).
7. **Acquisition and device-interface specification** — pinned versions
   (Companion app ≥2.9.31, client library versions, phone models and OS
   pins); the exact streams consumed with rates, payload versions, and
   field lists; connection lifecycle (discovery, reconnect, degraded
   modes); clock strategy (UTC-ns, Time Echo cadence, drift budget);
   recording control (start/stop/annotate via `/api/event`); the
   operating envelope (battery, thermal throttling, Wi-Fi vs wired) with
   the mitigations each use case requires.
8. **Data architecture** — the new `FeatureRecord`-equivalent schema
   (field-by-field, with units and null semantics), event logs, session
   metadata block (adapt the 57-key discipline), storage layout, native
   Neon recording retention, export formats, and compatibility posture
   toward the prototype's CSV contract. Where Pupil Cloud sits (default
   off? opt-in? never?) and the privacy consequences.
9. **Algorithm migration matrix** — every `src/core` module, one row
   each: transfers unchanged / transfers with re-derived constants /
   replaced by device signal / obsolete / new counterpart needed. For each
   re-derived constant: the measurement that will set it, pre-registered.
   Incorporate the four re-decisions from Dossier A as explicit plan
   items with owners and ordering.
10. **Device characterisation study plan** (early milestone, blocks
    threshold re-derivation): shut-eye aperture floor (does mm reach ~0?),
    aperture noise floor per eye at 200 Hz, blink signal morphology vs
    the vendor blink events, eyelid-aperture agreement with the vendor's
    eye-openness during induced squints/droop, pupil diameter behaviour
    under light steps (execute dormant row 13.12's pre-registered plan on
    real optics), IMU noise under head motion, stream latency and jitter
    measurements per transport, dropped-sample statistics over long
    sessions, and slippage/worn-detection behaviour. Each with method,
    sample size, committed prediction, and the decision it feeds.
11. **Real-time engine specification** — windowing and state machines at
    200 Hz (memory/CPU budgets), the degraded-mode ladder (what is still
    reported at 33 Hz gaze, at Wi-Fi latency, during stream gaps), alert
    logic and debounce, UI/consumer surfaces (operator dashboard, logs,
    API for downstream consumers), and end-to-end latency budgets per
    alert class with measurement method.
12. **Validation and science plan** — the replacement for the lost
    Eyeblink8 anchor: ground-truth strategy (vendor blink events are a
    baseline to beat/agree-with, not truth; human-annotated 200 Hz eye
    video; cued-blink protocols ported from the prototype's rows
    11.0a/b), drowsiness ground truth (KSS, PVT lapses, sleep-deprivation
    protocols; state what an EEG partnership would add and what claims
    are impossible without it), pre-registration discipline, per-metric
    acceptance thresholds, sample-size arithmetic (the prototype's Wilson
    ±10-point convention is a floor), and the layered re-validation
    structure adapted from roadmap Phase 15.
13. **Regulatory, ethics, and privacy** — GDPR Art. 9 biometric data
    handling (eye video is identifying; state lawful basis, retention,
    anonymisation options incl. the Cloud add-on or local-only
    operation), research-ethics/IRB needs for validation studies, the
    medical-device boundary (intended-use wording that keeps the research
    instrument outside MDR/FDA scope, and what would change it), the
    driver-monitoring line (if any driving use case is even piloted: EU
    GSR/DDAW context, ISO 15007 measurement conventions), and licensing:
    MIT SDKs, the unlicensed `real-time-blink-detection` repo, dataset
    permissions that do NOT transfer from blinklab (DROZY/UTA-RLDD
    permissions were granted to that project — re-request), and citation
    obligations.
14. **Engineering practices** — repo layout, languages, test strategy
    (port the pure-core unit discipline; define the Neon-era equivalents
    of the corpus runner, fixtures from recorded sessions, replay
    tooling), CI gates, the guard system to carry over (claims,
    vocabulary, results, detector ratchet re-anchored to the new ground
    truth), documentation set (README/SPEC/MODEL_CARD/ROADMAP/LEARNING
    equivalents), and the definition of done for a change.
15. **Milestones and roadmap** — numbered phases from procurement to
    validated v1, each with: objective, entry criteria, exit criteria
    (measurable), demo artefact, and rough calendar for a solo owner +
    Claude Code cadence. Must include at minimum: M0 procurement &
    bring-up (device ordered, streams observed end-to-end); M1
    acquisition layer + data contracts + time sync proven; M2 device
    characterisation study (gates all threshold work); M3 core port with
    re-derived constants; M4 new-signal layer (saccades, pupillometry,
    IMU); M5 fusion/scoring + live alerting; M6 validation round 1
    (pre-registered); M7 hardening + pilot with external users; and a
    kill/pivot criterion at each gate.
16. **Risk register** — numbered, each with likelihood, impact, trigger,
    owner, and mitigation. Must include at least: vendor API/app version
    drift (the payload grew three times in a year), closed NeonNet
    (accuracy characteristics can change under you with an app update),
    single-supplier hardware risk, phone OS pinning fragility, Wi-Fi
    latency vs alert budgets, thermal throttling in field use, eyelid
    signal unvalidated by third parties (no independent
    aperture-accuracy study found as of 2026-09), loss of the external
    blink benchmark, ground-truth cost for drowsiness, GDPR exposure of
    eye video, solo-maintainer bus factor, and budget overrun on
    hardware + participants.
17. **Resourcing and budget** — hardware list with prices (device
    bundle, spare frames, powered hub + Ethernet, companion computer,
    phones), Cloud add-ons if any, participant compensation for
    validation, and a stated total; skills the owner will need to learn
    or borrow.
18. **KPIs and success criteria** — for the product (e.g., detection
    agreement targets, latency budgets met, uptime over a 4 h session)
    and for the project (milestone dates, validation outcomes,
    publication/demo goals).
19. **Open questions and decision log seeds** — every `UNVERIFIED`,
    every parked decision, each with what would close it, by when, and
    what it blocks. Seed the first ten ADRs of the new project.
20. **Appendices** — the consumed-API quick reference (endpoints,
    streams, payload fields actually used), the constants-to-re-derive
    table, the source list with URLs and access dates.

### Process

Work in five passes, and say when you move between them:

1. **Recon** — the Step 0 reading and verification. Produce a short
   findings note first: anything in the dossiers you could not verify,
   anything you found that contradicts them (report the contradiction —
   the dossiers are inputs, not authorities), anything material they
   missed.
2. **Decide** — the architecture trade study and the fork/greenfield
   framing, before any other section, because everything downstream
   depends on them.
3. **Draft** — the full plan per the required structure.
4. **Adversarial self-review** — attack your own draft: every number
   without provenance, every requirement without an acceptance criterion,
   every milestone without an exit test, every risk without a trigger,
   every section that could be pasted into an unrelated project, every
   Neon capability claimed that Dossier B or a fetched document does not
   support. Fix what you find; list what you fixed.
5. **Finalise** — the open-questions register last, so it reflects the
   finished plan. Close with the acceptance checklist below,
   self-assessed honestly (an unmet item is stated as unmet, not
   massaged).

### Acceptance checklist (the plan is done only when every line holds)

- [ ] Every section of the required structure exists or its absence is
      argued in one sentence.
- [ ] Every number, endpoint, field, and rate carries provenance or an
      `UNVERIFIED`/`ASSUMPTION` label.
- [ ] Every requirement has an ID and a testable acceptance criterion.
- [ ] Every milestone has entry criteria, exit criteria, and a demo
      artefact.
- [ ] Every decision names its rejected alternatives.
- [ ] The four re-decisions from Dossier A each map to a concrete plan
      item.
- [ ] The characterisation study precedes and gates every re-derived
      threshold.
- [ ] The validation plan replaces the lost benchmark with a named ground
      truth and pre-registration discipline.
- [ ] Regulatory intended-use wording is explicit and consistent across
      the document.
- [ ] The vocabulary and claims discipline holds in every sentence.
- [ ] A stranger with the budget could execute M0–M2 from this document
      alone.

---

## Part 3 — Operator notes (for the human running this)

- **What to provide:** this repository (read-only is fine), network access
  to the Pupil Labs domains if possible, and Part 1 + Part 2 verbatim.
  Nothing else; the prompt is self-contained.
- **What to expect:** a reading/verification phase before any writing; a
  findings note; then the plan set. If the session starts writing the plan
  without having read `src/core/constants.ts` or attempted verification,
  stop it and point at Step 0.
- **How to review the output:** spot-check five random numbers for
  provenance; pick two requirements and try to falsify their acceptance
  criteria; check that the PERCLOS section distinguishes the classical
  definition from any operational one; check the milestone gates have
  measurable exits; confirm the open-questions register is non-empty (a
  plan of this scope with no open questions has hidden them).
- **Iteration:** treat the first output as a draft. The highest-value
  follow-up prompts are usually: "run the adversarial self-review again,
  twice as hard, and show the findings", and "price milestone M2 in hours
  and euros".
- **Scope guard:** if the session proposes writing product code, starting
  the port, or altering blinklab's published documents, decline — the
  deliverable is the plan.
