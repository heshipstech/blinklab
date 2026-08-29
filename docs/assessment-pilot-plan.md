# The assessment pilot: protocol, verdict, and report, decided before code

Written 29 August 2026, before any of it exists, in the discipline of
`docs/validation-plan.md`: nothing here may change once the first
pilot session file has been opened; corrections go in dated sections
at the bottom. The design was produced by three independent design
passes judged against the repository's own constraints; the losing
alternatives and the reasons they lost are recorded here so they are
not quietly re-invented later.

## The framing, decided first

The roadmap called this milestone "a workplace-alertness assessment a
client pays for". The repository's own tested record forbids that
framing in five places: the demo notice ("not for clinical, workplace
or safety use", a tested constant), MODEL_CARD's out-of-scope list
("workplace fitness testing... employee surveillance"), PROJECT.md's
non-goals, the no-data-leaves-the-device constraint, and the model
card's own sentence that the score "has never been shown to
correspond to how sleepy anyone actually is". The owner chose, on 29
August, to resolve the collision by REFRAMING THE MILESTONE rather
than amending the ethics record: this is a RESEARCH PILOT. Consented
volunteers, a participant-facing honest report, a researcher table;
no fitness-for-duty meaning, no third party receiving anyone's
numbers, every rendering of the score carrying its unvalidated-
heuristic sentence. Commercial claims wait for validation evidence
that does not yet exist.

## What the milestone builds

One pure verdict object, two renderings of it, a small set of new
primary facts in the export, a voluntary pseudonym, and a researcher
tool — wrapped around a session protocol that already exists. The
pilot session IS a round II session: the participant steps are
`docs/participant-instructions.md` unchanged, moderated on a live
call exactly as `docs/validation-plan-round2.md` rule 6 requires, and
the files it produces are round II files, readable by the frozen
`--rules round2` reader without modification. The report layer is
strictly additive and may not alter any detector or calibration
behaviour — enforced the usual way, by the digit-for-digit corpus
reproduction gate on any increment that touches src/.

REJECTED, with the reason: a Protocol Mode step-sequencer that makes
the compliance failures impossible in code (Mark inert after two
presses, step gating). Round II's frozen plan says "the moderator's
job is to make those five shapes impossible, and the protocol steps
themselves do not change" — button gating plausibly changes the
steps, and an instrument changed under a frozen plan is a collision.
Moderation stays human. The moderator script (below) carries the
scripted sentence for each of the five observed failure shapes
instead.

## The session, moderated

The round I sequence, unchanged, with a consent preamble:

0. Consent read aloud from the script: research pilot, unvalidated
   heuristic, what the files contain, that only the participant can
   send anything anywhere. The participant creates or declines a
   local pseudonym. Phone auto-lock off.
1. Start camera; KSS before (verbatim anchors, skip recorded as
   skipped, never imputed).
2. Thirty seconds still while the baseline learns. If calibration
   REFUSES here, the refusal IS a session result: recorded, counted,
   exactly one scripted restart offered (the refusal sentence's own
   instruction), both exports kept.
3. Mark 1.
4. Ten counted deliberate blinks.
5. Mark 2.
6. About five seconds eyes closed.
7. About one minute reading.
8. Export CSV (the KSS-after gate fires here).
9. Export blink log.
10. Only now does the report render; the moderator debriefs from it.

The moderator says nothing about what the instrument is expected to
find before Mark 2 — participants are the ground truth, and a
participant who has read an earlier report has learned the page
counts blinks, which is why the report renders only after the
session and the debrief comes last. A session that goes sideways is
finished and kept, never quietly redone; a re-run produces a second
pair of files and both travel.

## The interruption policy, closing a known gap

`suspensionGuard` refuses stepped clips; live sessions had no policy.
The pilot's, pre-registered: the page timestamps each visibility
change and exports them as appended marker-style metadata rows, plus
the visibility counter's value at each Mark. An interruption whose
timestamp falls INSIDE the marked window makes the marked-window
verdict UNSOUND — declared, never deleted; the session completes, one
re-run is offered, both files are kept. An interruption OUTSIDE the
marked window degrades only the determinism sentence ("determinism is
a claim about uninterrupted measurement — this session was
interrupted N times"). Zero interruptions is asserted POSITIVELY
("the page stayed visible throughout"), never implied by silence. The
stepped-vs-live asymmetry is deliberate and stated: a stepped clip's
whole promise is exactness so it refuses outright; a live session is
already honest about partiality so it declares and downgrades.

## The verdict object

`src/core/sessionVerdict.ts`: one pure typed object assembling the
per-session refusal surfaces — calibration (accepted / refused with
certificate / never froze), evidence rate, suspension/interruption,
ruler fit, camera-state outcome, pose validity fraction, model trust,
and the marked window's soundness — each a small closed union
carrying its reason sentence. Unknown and not-applicable are distinct
states everywhere. The verdict is DERIVED, NEVER EXPORTED: the export
carries only primary facts, and `analysis/blinklab/` re-derives the
verdict from the file. A shared fixture pins the two implementations
byte-for-byte, mutations both directions; on any real session where
the page's rendering and the tool's re-derivation disagree, the
researcher tool declares an INSTRUMENT DEFECT and stops the cohort
analysis — the round II precedent, not a per-row shrug.

New primary facts, appended to the export metadata (append-only, like
every column before them): interruption timestamps, the visibility
counter at each marker, the pose-valid fraction, a protocol id naming
this plan and its date, and the app commit. A test asserts the export
carries no derived verdict values — metadata rows are facts, and a
summary that travels beside its inputs will eventually disagree with
them.

## The participant report

Two renderings of the one verdict, both on-device: an in-page panel
that renders ONLY after the camera stops (pinned by test), and an
exported plain-text file — plain text rather than HTML because a
report a reviewer can diff beats a report that needs a browser; the
filename lands in `.gitignore` and `tools/exportGuard.mjs` in the
same increment that creates it. Eight sections, in order:

1. What this is — the demo notice verbatim, the pilot framing, the
   unvalidated-heuristic sentence beside any mention of the score.
2. Was this measurement sound? — the verdict, refusals FIRST. A
   refused calibration's headline is "a result, not a failure" and
   quotes the test-pinned refusal sentence verbatim (a snapshot test
   compares the rendered string to the core constant, so the report
   can never paraphrase it).
3. What was measured — counts, rates, closures, PERCLOS labelled as
   an instrument-adjusted convention not comparable to published
   PERCLOS, the score with its 100-minus-four-named-penalties
   working. On a refused session every ruler-dependent line renders
   "withheld" with its reason; the ruler-free lines still report.
4. Conditions — camera, the three rates each named for whose rate it
   is, measurement frame, iris px, KSS, interruptions, markers with
   the ~1 s slack stated.
5. What was withheld, refused, or truncated — the per-surface
   accounting table; every truncation declares itself here exactly
   as it does in-file.
6. What this instrument cannot see — below.
7. Your data and your control — the stored-data enumeration probed
   live, the erase control, "nothing you recorded left this device".
8. Provenance — protocol id, app commit, generated-on-device time,
   and the citations wherever published numbers appear.

Three absence renderings, pinned distinct by test: "withheld" (a gate
held it back, reason given), "unknown" (the page could not find out),
"not applicable" (this session shape has no such value) — and a unit
test asserts no absent value can ever render as 0, 0.0, or an empty
cell. GOOD, REFUSED and DEGRADED fixture sessions each have their
full rendering snapshot-tested.

## The cannot-see block

Generated, not hand-maintained: `tools/cannotSeeBlock.mjs` assembles
the text from its sources — docs/calibration-refusal.txt (the two
birth-time blind spots), docs/baseline-freeze.txt (a ruler born short
stays short), docs/blink-sample-rate.txt (the delivered-rate account
and the reopened two-phone difference), docs/miss-character.txt (the
deterministic, identity-stable one-in-six miss with the mechanism
unexplained), MODEL_CARD.md (the demographic unknowns, the censored
blink log, the model trust boundary) — writes a committed
`src/core/cannotSee.ts` between markers, refuses when a required
number or the DROZY citation is missing, and a drift test regenerates
and fails when the module and its sources disagree: the resultsBlock
mechanism, applied to caveats. Each claim is quote-pinned against the
exact sentence in its source document.

## The score stays out of the files

For the pilot the score appears ONLY in the report, beside its
working and its disclaimer. It does not enter the CSV: an unvalidated
heuristic becoming a permanent export-contract column on a
world-public page is a decision the owner has not made, and the
ladder isolates it so declining costs nothing. The researcher table
prints no score aggregate.

## Identity, minimal

One new stored key: a participant-chosen or locally generated
pseudonym, created only by explicit action — never auto-generated on
load, preserving the deviceId refusal's principle that identity is
voluntary. It joins the STORED_ITEMS enumeration with what/why
sentences, full erase semantics, and the unreadable-is-never-absent
probe; it enters the export as a `# participant_pseudonym` row only
when it exists. NO session-history ring ships in this milestone: one
session per person needs no ring, and a stored score trend on a
world-public page invites exactly the fitness-for-duty misreading
the record guards against. Deferred, not rejected forever.

## The researcher table

A sibling of `validation_report.py`, not a fork: it reuses
`find_pairs`/`load_pair` and imports round2.py's rules verbatim under
an explicit flag, refusals-first, non-zero exit when anyone was
refused, round I's default output byte-frozen. Per session it prints
the re-derived verdict beside what the participant's page rendered,
loudly, and stops on mismatch. PUBLICATION RESTRAINT, inherited from
round II: the pilot publishes structural outcomes, never a recall
figure — six people is a smoke test whatever instrument wraps them.

## Structural predictions, committed now

1. Every calibration refusal that fires in the pilot is
   ceiling-bound, and drift is zero on every session — round II's
   own predictions, unchanged.
2. A report rendered for any real session contains no number absent
   from that session's own export plus the published record.
3. The page's verdict and the tool's re-derivation agree on every
   uncorrupted real session; a disagreement is an instrument defect
   and stops the analysis.
4. The report layer is measurement-neutral: the corpus reproduces
   digit for digit after every src-touching increment below.

## The increment ladder, one PR each

1. This document.
2. `tools/cannotSeeBlock.mjs` + generated `src/core/cannotSee.ts` +
   drift test.
3. `src/core/sessionVerdict.ts` — pure, fixtures for GOOD / REFUSED /
   DEGRADED, one mutation per surface, tests watched failing first.
4. New primary facts into the export (interruption timestamps,
   counter-at-marker, pose fraction, protocol id, app commit) —
   corpus digit-for-digit before merge.
5. `analysis/blinklab/verdict.py` re-derivation + the byte-exact
   shared fixture + the no-derived-rows export test.
6. The in-page report panel (renders only after camera stop, pinned;
   docs/UI.md + uiGuard; bundle budget).
7. The exported report file (guards and filename first, snapshot
   tests of the full text).
8. The pseudonym (storedData enumeration, erase, export row).
9. The researcher tool additions under the explicit flag; round I
   output byte-frozen by test.
10. The adversarial pass on the verdict, the renderer, and the tool
    flag, on synthetic files only, predictions before probes,
    written up before any real file is opened.
11. The owner's dry run: the full protocol end to end on the owner's
    own devices, report and table generated from the dry-run files,
    findings written up dated — the gate before any volunteer.

## Open, and whose

The owner's, listed as undecided exactly as round II left them: the
participant set, schedule, and call logistics; whether pilot sessions
double as round II's own sessions for its structural predictions
(they are format-compatible by design); whether the score ever
becomes an export column; whether the report is walked through live
on the call or read alone afterwards; whether the pilot's researcher
table is published; the pseudonym consent wording. None of these
gates increments 1 through 10.

## What this plan cannot fix

The report inherits every open question it reports: the miss
mechanism is unexplained, the two-phone difference is reopened, the
score is unvalidated, and six volunteers are a smoke test. The
report's job is to say so beside every number — the honesty is the
product.
