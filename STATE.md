**THE AUTOPSY READS THE REAL TRACE, 2 September 2026 — the second
producer-consumer seam, found when the owner ran it on eight real
clips.** The awake corpus run finally happened, on a new machine, and
the autopsy died on the first line of the first file with
KeyError: 'frameIndex'. The real frame-trace export
(src/core/frameTrace.ts) prepends six "# key: value" metadata rows —
source, clip, measurement mode, coverage — before the frameIndex
column header, so csv.DictReader took "# source: file" as the header
and every frame join missed. The tool was called "proven end to end"
twice, but only ever on synthetic traces I built with the bare header
on line one — a fixture written to satisfy the reader could never
catch where the reader disagreed with the real writer. The fix is one
line and the project's own long-standing convention:
clip_trace_from_rows now drops lines starting with "#" before
parsing, exactly as analysis/blinklab/drozy.py has for months. A test
that builds the real six-row "#" preamble was watched failing first
with the owner's exact KeyError, then made to pass; removing the
filter reddened it and was restored; an end-to-end run over a
CRLF, "#"-preambled file classifies correctly. The corpus data itself
was never in question — all eight clips measured, zero failed — only
the reader's picture of the file. No src change, so the
corpus-reproduction gate does not apply and no measured number moves.
The suite is 800 unit tests, 20 end to end tests, and
275 Python tests of which 2 skip. Next: the owner pulls this fix
and re-runs the one autopsy line over the traces already on disk —
no re-measuring — and the real verdict drops out against the
committed prediction.

**THE AUTOPSY IS WIRED TO THE RUN, 2 September 2026 — the seam
between the tool and the corpus run that will feed it, closed before
the run happens.** The miss autopsy shipped ahead of its data; this
increment makes the owner's awake corpus run flow straight into it
with no renaming, and lets it emit a committable per-miss verdict
table. The defect it fixes was silent: tools/measure_corpus.mjs
writes each clip's per-frame trace as <clip>.frames.csv, but
autopsy() looked for <clip>.csv — the neighbouring seconds table, a
different file. Nothing would have errored, because a clip whose
trace is missing is correctly skipped, not guessed; the run would
just have classified zero misses and printed "no misses classified",
looking like it ran. Two tests now build the trace file on disk
under the exact name the runner writes and point the tool at that
directory, watched failing first (the tool skipped every clip and
returned nothing) then made to pass. The second half is
write_verdicts and a --out flag: the tool writes one row per miss —
clip, blink_id, mechanism, min_ratio, measured_frames,
fully_closed_frames — as committable evidence, and carries the
null-never-zero rule into the CSV cell. min_ratio is a number only
for above_line, where the margin is the question; for a crossing, a
coverage gap or an untrusted span the cell is empty, never 0, because
0 is a false ratio that would read as the aperture touching the line
exactly. A test pins the empty cell; the None-to-"0" mutation
reddened it and was restored, as did the crossing comparison
mutated < to >. No src change, so the corpus-reproduction gate does
not apply and no measured number moves. The suite is 800 unit tests,
20 end to end tests, and 274 Python tests of which 2 skip. Next on
the ladder is unchanged: the owner's awake corpus trace run, which
now fires this autopsy on real data and drops a committed verdict
table in one command.

**THE MISS AUTOPSY HAS ITS TOOL, 2 September 2026 — the recall
investigation's next increment, built ahead of its data.** The
single largest open accuracy question is the 67 Eyeblink8 blinks the
detector misses deterministically, 47 of them (70.1 percent)
carrying a frame a human marked fully closed, mechanism unexplained.
docs/miss-trace.txt named the three stories a per-frame trace can
separate — the aperture dipped but not below the line, never dipped
at all, or the dip fell between measured frames — and left the
classifier as the queued next tool. analysis/tools/miss_autopsy.py
is that tool: for each miss it reads the trace rows inside the
annotation's own [startFrame, endFrame] span and assigns one of four
verdicts — not_measured (a coverage gap), no_trusted_face (the model
returned no face), crossed_line (the aperture went below the line
yet no blink was logged, implicating the detector's state machine),
or above_line (the signal never crossed) — reporting for the last
the smallest aperture-over-line ratio so a reader sees how close
each miss came. It refuses to draw a tuned landmark-versus-threshold
boundary: it reports the measured margin and lets the distribution
speak, the way the sample-rate work refused to pick a minimum window
width. It refuses on a damaged trace (a duplicated frame index) or a
backwards span. Nine tests watched failing first on synthetic traces
where every verdict is hand-checkable; the crossing comparison
mutated from < to > reddened four and was restored. The prediction
is committed FIRST, in docs/miss-character.txt: above_line dominates
(at least 40 of 67), its min_ratio clusters well above 1.0 (a
landmark failure, the model's lids not following the real ones),
sampling is near zero and the state machine a minority — and each
alternative outcome names the different fix it would redirect to.
The tool's real data is the awake corpus trace run
docs/miss-trace.txt still owes; until then it runs only on its
synthetic tests, and the moment the traces land the verdict drops
out instead of the investigation starting from scratch. No src
change, so the corpus-reproduction gate does not apply and no
measured number moves. The suite is 800 unit tests, 20 end to end
tests, and 270 Python tests of which 2 skip. Next on the ladder: the
owner's awake corpus trace run, which fires this autopsy on real
data.

**DRY RUN TWO PRINTED CLEAN AND THE LADDER IS CLOSED, 1 September
2026 — pilot increment 11, second attempt: the gate is met.** The
owner ran the full protocol again on the deployed page at commit
d8f0dcd, the build carrying the one-capture fix and the asExported
round-trips. The fact that was three numbers is now one: the
sampled rate reads 29.8 in the exported CSV, 29.8 in the report's
conditions section and 29.8 in its verdict sentence — one capture,
read three times. The pilot table printed clean, exit 0: headline
warned, 1 warned 7 ok, report agrees — and the warned headline is
honest, this machine's true 29.8 frames per second sitting below
the 60 risk line, not a defect. The ten deliberate blinks were
counted ten for ten, the second run in a row, and the page's
ruler-fit account matched the tool's recomputation exactly. Before
the run, the tool re-read dry run one's kept files by accident and
refused with the identical defect — kept files keep refusing,
which is what kept-never-redone is for. The score said 100 where
run one said 63 from the same protocol: run one's eyes-closed step
fell inside the score's last-minute window, run two's had scrolled
out of it — the number reports the window, not the person, and the
debrief note is doubled, not softened. Increment 11 is complete,
all eleven increments of docs/assessment-pilot-plan.md are
shipped, and the instrument is cleared for volunteers; the roster,
the schedule, the consent wording and walked-live versus
read-alone remain the owner's decisions. The suite is
800 unit tests, 20 end to end tests, and
261 Python tests of which 2 skip. Full account:
docs/pilot-dry-run.txt.

**THE DEFECT'S SIBLINGS ARE CLOSED BEFORE THEY FIRE, 31 August
2026 — pilot increment 11, between attempts.** The dry run's defect
class — the page computing a verdict input from a raw float while
the file carries the rounded form — had two remaining instances
waiting on rounding-boundary luck: the pose fraction (raw
valid/gated against the file's three decimals) and the marked
window's width (raw milliseconds subtracted against the file's
rounded seconds). Both now round-trip through the exact format the
exporter writes (asExported, tested at the 0.6249-to-0.625 boundary
and against the mirror's own bit-identical subtraction), so the
page and the re-derivation start from the same digits everywhere a
number reaches a verdict sentence. Found by reading the fixed diff
against the rule it enforces, not by burning dry run two on the
boundary. The suite is
800 unit tests. The gate remains: dry run two printing clean.

**THE DRY RUN FOUND AN INSTRUMENT DEFECT, AND THE GATE CAUGHT IT,
31 August 2026 — pilot increment 11, first attempt.** The owner ran
the full protocol once on the deployed page at commit 7041010:
calibration accepted, pose valid throughout, zero interruptions,
and the ten deliberate blinks between the marks caught ten for ten.
The researcher tool, in pilot mode, refused the cohort on the first
real session it ever read: INSTRUMENT DEFECT on evidenceRate,
because one fact — the sampled rate — appeared as THREE numbers
(30.0 in the CSV, 30.4 in the report's conditions, 29.8 in its
verdict sentence). Root cause in docs/pilot-dry-run.txt: three
consumers each called deliveryRates() at their own moment against a
rolling five-second window that drains after Stop, violating
increment 5's rule that the page hands the verdict only facts the
export carries — implemented for the processing fallback, missed
for sampled_fps. The fix, guard watched failing first: the
session's delivery rates are measured ONCE and every consumer reads
that capture; main.ts is held to exactly two live call sites (the
running readout and the single capture) by test. Also fixed, from
the report's own text: the cannot-see block's "WACV 2016.." double
stop, in the generator, regenerated. The score printed 63 with the
protocol's own five-second eyes-closed step as the penalty, which
the write-up flags for the debrief script. Dry run one is kept,
defect and all, never redone; the gate before any volunteer is dry
run TWO printing clean on the fixed build. The suite is
799 unit tests. The defect gate firing correctly on its first real
file is the pilot working.

**THE ADVERSARIAL PASS RAN, 29 August 2026 — pilot increment 10
of 11, and one prediction was wrong in the worse direction.** Ten
probes against the verdict mirror, the renderer and the pilot flag,
every prediction committed to docs/pilot-adversarial.txt before any
probe ran, synthetic files only. Four predicted crashes confirmed
(inf and abc in numeric metadata cells: bare tracebacks, no key
named). The fifth prediction missed the worst case: a nan pose
fraction crashed nothing — Decimal quantizes a quiet NaN through
without trapping — and the mirror derived a calm verdict saying
"NaN percent of frames". Nonsense rendered calmly, the exact
failure this repository exists to refuse; the wrong prediction
stays published. The fix, tests watched failing first: every
numeric metadata cell reads through one strict helper refusing BY
KEY on anything not parsing to a finite number, and the fps column
refuses on ANY non-finite cell — the fix's own first version
checked only the median and the probe's inf hid in the tail of the
sort at a finite 60.0, one more proof that a check on the summary
is not a check on the data (LEARNING.md carries both shapes). The
non-findings held as predicted: the deleted marker row already
refused by name, a CRLF report still agrees, the withheld-score
fallback is covered; the content-identical decoy report and the
restraint-vocabulary pseudonym stand recorded as stated
limitations. All six probes re-ran green: VerdictError, key named,
every time. The suite is 798 unit tests and
261 Python tests of which 2 skip. Next on the ladder: increment
11, the owner's dry run — the gate before any volunteer.

**THE RESEARCHER TOOL SPEAKS PILOT, 29 August 2026 — pilot
increment 9 of 11.** validation_report.py gained --rules pilot:
round II's gating plus a verdict table that re-derives every
session from primary facts (blinklab/pilot.py over
blinklab/verdict.py), prints one line per session — headline,
status counts, report agreement, pseudonym — and, by the plan's own
restraint, NO detection figure and NO aggregate of the unvalidated
heuristic. The defect gate is live: a session whose exported report
file does not carry the re-derived findings raises
INSTRUMENT DEFECT and the cohort analysis stops whole (exit 3),
never a per-row shrug; a session with no report file is a row that
says so, because nothing exists to disagree with. The
cross-language pin runs on committed artifacts alone: the rebuilt
"STATUS — surface: sentence" lines from increment 5's session CSV
must sit verbatim in increment 7's report snapshot, so the Python
line format cannot drift from the page's without going red. Round
I is now BYTE-FROZEN by test over a deterministic pair
(tests/fixtures/round1_report_frozen.txt), and its stray policy is
untouched: a report file in a round I folder still refuses the
round; only --rules pilot expects them, by stamp, with orphans
refused. Freezing it caught a fixture flaw the same hour: the
synthetic sessions carried a rounded baselineOverResting, the
page-account cross-check flagged the disagreement exactly as
designed, and the fixtures now carry the page's full float. The
suite is 798 unit tests and
255 Python tests of which 2 skip. Next on the ladder: increment
10, the adversarial pass.

**THE PSEUDONYM EXISTS ONLY BY CHOICE, 29 August 2026 — pilot
increment 8 of 11.** One new stored key,
blinklab-participant-pseudonym-v1, created only when a person types
a name and clicks save — never invented on load, the deviceId
refusal's principle that identity is voluntary. It joins
STORED_ITEMS with its what and why (the stored list and the report's
section 7 render it automatically, and the report snapshots caught
the new line as a reviewable diff, exactly their job), it joins
ALL_KEYS so the probe and the global erase picked it up without new
code, and the unreadable-is-never-absent split holds: a read the
browser refuses reports unreadable in the probe while the loader
quietly shows no name. The normalizer keeps a pseudonym to one
trimmed line (a newline would break the metadata row) and REFUSES an
over-long paste with its reason rather than truncating — a silent
truncation would export a name the person never chose; saving an
empty field is the explicit removal. The export writes
participant_pseudonym only when one exists: declined identity is
absence, never a row saying unknown, because an unknown row would
imply there was something to find. The suite is
798 unit tests. Next on the ladder: increment 9, the researcher
tool.

**THE REPORT LEAVES AS A FILE, 29 August 2026 — pilot increment 7
of 11.** The Report box gained an Export report button: the SAME
bytes the panel shows, written as blinklab-report-<stamp>.txt in
plain text, because one pure builder feeding both renderings is
what makes them impossible to disagree. Guards and filename landed
in the same increment that created the download, in the watched
order: the download call went in first, exportsAreIgnored went red
on the unregistered name exactly as it was built to, and the
.gitignore pattern turned it green — the third export could not
repeat the blink log's near-miss. The GOOD, REFUSED and DEGRADED
sessions now have their FULL renderings committed under
test/fixtures/report/ as file snapshots, so any wording change
anywhere in the eight sections shows up as a reviewable diff; the
refused rendering leads with the pinned sentence and withholds
every ruler-dependent line with its reason, exactly as the plan
ordered. The suite is
794 unit tests. Next on the ladder: increment 8, the pseudonym.

**THE REPORT PANEL EXISTS, 29 August 2026 — pilot increment 6 of 11.** src/core/participantReport.ts builds the eight-section
participant report as ONE plain-text rendering, pure, so the
in-page panel and increment 7's exported file are the same bytes: a
report a reviewer can diff beats a report that needs a browser. The
sections are the plan's, in order — what this is (the demo notice
verbatim), was this measurement sound (the verdict, refusals FIRST,
a refused calibration framed as "a result, not a failure" and
quoting the pinned sentence byte for byte), what was measured (the
score beside its 100-minus-named-penalties working and the
unvalidated-heuristic sentence, an unavailable signal named as
absence never scored as alertness), conditions, what was withheld
refused or truncated (all eight surfaces accounted), the generated
cannot-see block, your data and your control ("nothing you recorded
left this device", the storage probe where unreadable is never
folded into absent), and provenance. The three absence words are
pinned distinct — "withheld — reason", "unknown", "not applicable"
— and none may render as a zero or an empty cell. The page gained
its first intentional way to END a live session, a Stop camera
button, because the report renders only after the camera stops
(reportAvailable, pinned by test: never while running, requesting
or loading, never with nothing recorded; a failed session with
records still reports, refusals lead). The verdict inputs the page
hands the report follow increment 5's committed rule — only facts
the export carries, the processing fallback the same interpolating
median the mirror computes — so the Python re-derivation compares
on real files. The no-derived-rows guard narrowed exactly as its
earlier form instructed: exportSession's body and the metadata
builders stay verdict-free while the report imports what it needs.
The suite is
791 unit tests. Next on the ladder: increment 7, the exported
report file.

**PYTHON RE-DERIVES THE VERDICT, 29 August 2026 — pilot increment
5 of 11.** analysis/blinklab/verdict.py derives the same
SessionVerdict object the page assembles, from primary facts in the
exported file alone, and three committed fixtures under
test/fixtures/verdict/ — a GOOD, a REFUSED and a DEGRADED session,
each a synthetic CSV beside its canonical verdict JSON — pin the
two implementations byte for byte: the TypeScript side reproduces
each JSON from literal inputs, the Python side from the CSV, so a
mutation on either side lands on the same committed bytes (flipping
one byte in a fixture went red in BOTH suites). The committed
derivation rules: the evidence rate is the file's own sampled_fps
or the pandas median of the per-second fps column; the ruler-fit
verdict REPLAYS the page's fifteen-record dwell machine over the
exported aperture and baseline columns, landing on the spoken word
rather than the instantaneous ratio; camera outcome and model trust
are structural, because a file with rows exists only through a
session that ran and a trust gate that passed; and number
formatting follows ECMAScript's toFixed, ties away from zero, not
Python's banker's rounding — 62.5 is 63 on both sides, proven by
test. The refusal sentence is pinned verbatim to the decision
document from Python exactly as from TypeScript; the thresholds are
read out of src/core/constants.ts rather than re-chosen; a file
missing the visibility counter, a count row disagreeing with its
timestamp rows, or a calibration flag that is not lowercase
true/false refuses by name. The export stays clean of all of it: a
guard test holds main.ts free of the verdict module until the
report panel arrives, and must then narrow to the export path
rather than vanish. The suite is
779 unit tests and 246 Python tests of which 2 skip. Next on the
ladder: increment 6, the in-page report panel.

**THE EXPORT CARRIES THE PILOT'S PRIMARY FACTS, 29 August 2026 —
pilot increment 4 of 11.** Five facts, all appended after every row
a reader already parses: each interruption's timestamp on the record
clock, where the count row now derives from the same array so the
two can never disagree; the visibility counter at each marker, which
is what lets an analysis place an interruption on one side of the
marks instead of shrugging over the whole session; the pose-valid
fraction, carried as two counts so the pure side decides that a gate
which never ran reads unknown, never 0.000; a protocol row naming
docs/assessment-pilot-plan.md and its date — provenance about the
app, not a claim that the session followed the steps; and the app
commit, read from the meta tag the build already stamps (REMEDIATION
E2), so the file and the page can never claim two different origins.
The frozen round I reader takes unknown keys into its metadata dict
and refuses only duplicates, so pilot files stay round-II-readable
without touching it. The plan's merge gate is a corpus run on the
owner's machine before this increment merges. Predicted before that
run: the evaluation table matches docs/eyeblink8-result.txt digit
for digit, because the new rows are written at export, after the
measurement, and cannot reach the reducer. Measured 29 August 2026
on the owner's machine, from a checkout verified at this
increment's own commit: identical, digit for digit — the headline,
all eight per-clip rows, the glasses split and the coverage block.
The gate passes. The suite is
775 unit tests. Next on the ladder: increment 5, the Python verdict
mirror.

**THE SESSION VERDICT EXISTS, 29 August 2026 — pilot increment 3
of 11.** src/core/sessionVerdict.ts assembles the eight per-session
refusal surfaces the instrument already computes — calibration,
evidence rate, interruptions, ruler fit, camera outcome, pose, model
trust, marked window — into one pure derived object: each surface a
closed status (ok, refused, warned, unknown, notApplicable) carrying
its reason sentence, and a headline that takes the worst status,
refused over warned over unknown, with notApplicable never leading.
The refused-calibration finding IS the test-pinned refusal sentence,
never a paraphrase; a zero-interruption session is asserted
positively rather than implied by silence; pose states its fraction
and judges nothing, because no benchmark of pose-valid fractions
exists to choose a line from; a zero-width marked window refuses to
score; and interruptions that cannot be attributed to a phase leave
the window unknown, never silently ok. The verdict is DERIVED, NEVER
EXPORTED — the export keeps carrying primary facts only, and
increment 5 makes Python re-derive this same object with a
byte-exact fixture pin. Fourteen tests watched failing first; nine
mutations, one per surface plus the headline order, each went red on
exactly one test and were restored. The suite is
770 unit tests. Next on the ladder: increment 4, the new primary
export facts.

**THE CANNOT-SEE BLOCK IS GENERATED, 29 August 2026 — pilot
increment 2 of 11.** src/core/cannotSee.ts is a committed, generated
module: tools/cannotSeeBlock.mjs derives seven claims from the
published record — the deterministic 67-of-408 miss with its 70.1
percent closed-frame share, the unexplained two-phone difference,
the instrument-adjusted PERCLOS, the censored blink log, the two
birth-time calibration blind spots plus the short-ruler trade, the
demographic unknowns, and the unvalidated score beside the DROZY
null with its required citation. Every claim is quote-pinned against
the exact sentence in its source document, whitespace-collapsed so a
hard-wrapped source cannot fail its own pin; a missing number, a
vanished sentence, or an absent citation refuses the build rather
than emitting a weaker block. The resultsBlock discipline applies
whole: a drift test compares the committed module byte for byte to
the generator's output (hand-editing it went red and regenerating
restored green), npm run cannotsee:write regenerates, and the
emitted module is prettier-stable as generated. The suite is
756 unit tests. Next on the ladder: increment 3, the SessionVerdict
core.

**THE ASSESSMENT PILOT IS PRE-DECIDED, 29 August 2026, and its
framing collision is resolved in the open.** The roadmap's next
milestone called itself "a workplace-alertness assessment a client
pays for", and the repository's own tested record forbids that in
five places — the demo notice, the model card's out-of-scope list,
the project non-goals, no-data-leaves-the-device, and the model
card's sentence that the score has never been shown to correspond to
sleepiness. The owner chose to reframe rather than amend: a RESEARCH
PILOT, consented volunteers, participant-facing report, researcher
table, no third party receiving anyone's numbers.
docs/assessment-pilot-plan.md commits the design before code, built
from three independent design passes judged against the repo's own
constraints (the winner had zero constraint violations; the losers'
fatal flaws are recorded so they are not re-invented): the pilot
session IS a round II session read by the frozen reader unchanged; a
rejected protocol-enforcing step-sequencer is recorded as rejected
because the frozen plan says the steps do not change; one pure
SessionVerdict object over the refusal surfaces, derived and never
exported, re-derived by Python from primary facts with a byte-exact
fixture pin, mismatch on a real session declared an instrument
defect that stops the analysis; an interruption policy closing the
live-session gap with positive zero-assertion; an eight-section
participant report whose refusals lead, whose three absence
renderings are pinned distinct, and whose cannot-see block is
GENERATED from the five source documents plus the fresh ground truth
and quote-pinned against them; the score report-only and out of the
files; a voluntary pseudonym and no history ring; a researcher tool
as a sibling of validation_report.py with round II's publication
restraint. Eleven increments, one PR each, ending in the owner's
dry run before any volunteer. Structural predictions committed,
round II's included.

**D1 ANSWERED AND THE SUSPENSION GUARD IS BUILT, 29 August 2026.**
The discriminator ran with the machine kept awake: 67 / 5 / 11, the
published row exactly, on the same trace build — so the anomaly
below was the INTERRUPTION (the owner reports the machine slept
mid-run), the trace diff is provisionally exonerated, D2 was
unnecessary, and the determinism claim stands as what it always
was, a claim about an uninterrupted measurement. What the anomaly
taught is now code rather than a queue entry:
src/core/suspensionGuard.ts refuses a stepped clip run that
observed ANY visibility change between its first seek and its
summary, by name, outranking even a deliberate early stop — because
a suspended run just proved it can produce a complete-looking file
with twelve quietly wrong blinks inside, and stepped mode's whole
guarantee is exactness. Tests watched failing first, the
shrug-at-one-change mutation red. Watched mode is left as it is,
already honest about partiality. Yesterday's trace files stay
quarantined; the awake corpus run that re-scores neutrality and
collects the autopsy's data remains available whenever wanted and
blocks nothing. The suite is 751 unit tests.

**THE TRACE'S NEUTRALITY PREDICTION IS BROKEN, 28 August 2026, and
the data is quarantined.** The first trace-collecting corpus run did
not reproduce the published table: recall 80.6 against 83.6, with
every digit of the difference in ONE clip — 27122013_153916_cam read
55 / 17 / 8 against the published 67 / 5 / 11 — while the other
seven rows and every coverage count, that clip's included, are
identical. The same 9,077 frames were measured; twelve fewer blinks
were found among them. By docs/miss-trace.txt's own rule the finding
is published before anything uses the data: the 46-blink autopsy
does NOT run on these files. The only src change since the run that
reproduced digit for digit is the trace increment itself — prime
suspect, not yet a mechanism; the named candidate is the trace
buffer's copy-per-frame allocation pattern, hundreds of megabytes of
transient arrays across a long clip, though the longest clip
reproducing exactly argues against its simplest form. Two
single-clip discriminators are committed in the document before
running: D1 re-runs the same build (55 again = deterministic, 67 =
the determinism claim itself is broken and gains a dated caveat);
D2 runs the pre-trace build (67 expected; 55 there would exonerate
the diff and indict the files or environment). Eyeblink8's published
result is unaffected — it derives from the rearm run and reproduced
twice since — but no trace is used and no detector work starts until
the discriminators answer.

**THE PER-FRAME TRACE IS BUILT, 27 August 2026, and the owner's next
corpus run collects the first data.** docs/miss-trace.txt decided the
design before the code: clips only (a camera session never buffers
frames — memory and privacy both), one row per measured frame
carrying frameIndex in the annotators' own numbering, the clip's
clock, the aperture read, and the EFFECTIVE blink line the reducer
was actually handed on that frame — the fact of what was compared,
not a reconstruction, null on frames where the reducer was fed
nothing. The cap follows the blink log's 20,000 convention, above
the longest corpus clip's 15,784, but the capped behaviour differs
deliberately and the test says why: the trace keeps its PREFIX and
declares what fell off the end, because a file whose first frame
silently moves breaks every join anchored at the front, where the
blink log rightly drops its oldest. src/core/frameTrace.ts is pure
core with tests watched failing first and two mutations red
(drop-oldest, silenced truncation note); the third export button
rides beside the other two, the corpus runner saves the .frames.csv
beside seconds and blinks, the download pattern is gitignored (that
guard caught its absence, as designed), and docs/UI.md carries the
new row and fifth export string. The committed prediction: the first
trace-collecting corpus run reproduces the published table digit for
digit, because the trace reads values the loop already computes and
moves nothing. 747 unit tests.

**THE MISSES ARE THE SAME BLINKS, 27 August 2026, all three
predictions confirmed.** docs/miss-character.txt asked, before any
join was computed, whether the instrument misses the same blinks run
after run — a question no published count could answer, because two
runs can match every count while missing different blinks. A
committed tool (analysis/tools/miss_overlap.py, tests failing first,
join-to-union mutation red) joined the three committed miss tables
on the corpus's own (clip, blink_id) identity. Frozen vs rearm:
IDENTICAL, all 67 shared — the determinism claim is now an
identity-level fact, not only a count-level one. Capfix vs rearm: 46
of 50 persist (92 percent, above the predicted 80), the freeze added
21 and recovered 4 — an accumulation, not a reshuffle. The
closed-frame character rides everything: 69.6 percent in the
persistent core, 71.4 in the freeze-added misses, against 70.1
overall, so the README's "changed how many, not the character" now
has identity-level support. What this sets up: the frame-level "why"
investigation has a fixed target, a persistent core of 46 blinks
missed under two ruler regimes, and its next tool is an instrument
increment adding a per-frame aperture trace around each miss. The
suite grew to 228 Python tests of which 2 skip.

**THE ROUND II RULES SURVIVED THEIR ADVERSARIAL PASS, 27 August
2026, three findings fixed.** Six probes, each prediction committed
in its own commit before any probe ran
(docs/validation-round2-adversarial.txt). Two silent wrong results
confirmed and fixed: a hand-capitalized calibration_refused flag was
scored as an ordinary participant (the flag reader now accepts only
the exporter's two strings and refuses loudly on anything else), and
a NaN sampled_fps parsed, compared below no floor, and passed as
sound evidence (non-finite metadata numbers now read as absent and
fall back to the named per-second column). One misleading sentence
fixed: the freeze line asserted "constant across the marked window"
for sessions with no marked window; the verdict is three-valued now
and says "no marked window to judge the freeze". One prediction
wrong in the good direction, kept in the record: reversed markers
never reach the round II rules because the round I reader refuses
them a layer down. Two defences proven correct as predicted: a junk
spread ratio prints a dash without losing the refusal, and a folder
of only refusals exits zero, because a refused calibration is a
result. Every fix had its test watched failing first
(TestWhatTheAdversarialPassFound); 224 Python tests. The rules are
cleared for the first real round II file, whenever the owner
schedules the round.

**ROUND II'S RULES ARE CODE, 27 August 2026, and the default is
frozen.** analysis/blinklab/round2.py implements the plan's
mechanical rules with tests watched failing first: a
calibration_refused file becomes a CALIBRATION REFUSED line with its
birth certificate and contributes no detector columns, and a refusal
that is not ceiling-bound prints as an INSTRUMENT DEFECT because the
committed prediction says that cannot happen; the evidence rate
prefers the export's own sampled_fps and names the per-second
fallback out loud, with 25 as the floor because that is the page's
own gate, not a new constant; the freeze defect counts distinct
baseline values inside the marked window, where more than one is the
freeze broken in the field, not a percentage; the short ruler flags
below 1.0; and only a zero-width window refuses to score. The report
tool takes --rules round2 and the default invocation is proven
frozen by test: a refused-calibration file read without the flag
reports exactly as round I's rules always did, so the published
tables stay reproducible. Five mutations (short-ruler inverted,
freeze defect silenced, contract inverted, refusal still scored,
default unfrozen) each went red and were restored. 220 Python tests.
What the rules still owe before any real round II file is opened:
the adversarial pass on synthetic files, as
docs/validation-tool-adversarial.txt did for round I.

**ROUND II'S RULES ARE PRE-REGISTERED, 27 August 2026, before any
session exists.** docs/validation-plan-round2.md commits the six
rules that will read the next round's files, written in the round I
plan's own discipline: a refused session is a first-class REFUSED
row with its birth certificate printed; frame-rate soundness judges
the EVIDENCE rate (sampled_fps) over the marked window, not
processing over the session; drift's pass line is zero because the
freeze makes any movement a defect; a short ruler is flagged at the
natural 1.0 line, no tuned constant; the window's length prints
beside its counts and only zero width refuses (a minimum width
would be a constant chosen against no benchmark); and the round is
moderated, per round I's own compliance findings. The tool
constraint is stated as non-negotiable: round I's published tables
must stay reproducible, so the new rules run only behind explicit
selection and the default invocation is frozen. Structural
predictions committed: zero drift everywhere, every refusal
ceiling-bound, and any unusable ruler that slips both nets is
published as a hole in the calibration story. Participants and
scheduling stay the owner's decisions. The implementation owes
failing-first tests and an adversarial pass on synthetic files
before the first real file is opened.

**THE ROUND'S RAW FILES ARE RECOVERED AND THE PUBLISHED TABLE
RE-DERIVES, 27 August 2026.** Four of the six validation-round
exports (P2, P4, P5, P6) plus the dry run's macbookair session — the
learning-window failure the calibration refusal was built from —
were recovered from the volunteers' original channels and devices.
Verification was the published claim itself: validation_report.py on
the recovered files reproduces those four rows of both published
tables digit for digit, and the macbookair session's whole-session
median re-computes to the published 6.93 mm. P1 and P3 are still
missing, P3 being the round's most important failure (the 34.6
percent drift), and that search stays open. The files stay outside
the repository, as the round document requires; the dated account is
in docs/validation-round.txt.

**THE SECOND DELIVERED-RATE READING SCORES A ROW AND REOPENS THE
TWO-PHONE PUZZLE, 27 August 2026.** The owner read the delivery line
on iphone17promax: the camera delivers 30 frames per second and the
instrument reads all 30. The blink-sample-rate table's "delivers
about 60" row for that device is wrong by measurement — the
declared-30 bound had said so before any reading existed — and the
24 August correction's guess that the dry-run session "rode a camera
delivering at least 55" is refuted by the same numbers: the dry run
itself recorded declared 30, which already forbade it. The
consequence is real: with both phones reading about thirty distinct
frames a second, the evidence rate no longer explains iphone2
missing 3 of 10 while iphone17promax caught 10 of 10. Section 4 of
the dry run carries a second dated correction saying exactly what
stands (the committed session's refutation of the iOS/WebKit/camera
hypothesis as written) and what falls (the discrimination itself —
something that co-varied with processing speed, not the evidence
rate, made the difference), and the 17 August two-phone puzzle is
open again with that section's own confound list as the suspects.
The gate does not move: nothing has been measured delivering below 25. pcsony's >= 60 row stays unscored — pcsony, iphone2 and
macbookair2 are not physically accessible for an extended period.
Two devices read under ordinary indoor light; both deliver 30.

**PREDICTION 2 IS CONFIRMED AND THE CALIBRATION TRACK'S LAST RUNG
IS CLIMBED, 27 August 2026.** With the refusal code built, the owner
remeasured the full remux corpus on the M5 Max: 8 measured, 0
failed, and the evaluation IDENTICAL to the published table digit
for digit — 83.6 / 84.0 / 83.8, every per-clip row, the glasses
split and every coverage count. The refusal changed nothing on the
corpus, exactly as a criterion that binds on no clip must, and the
increment merged on that result. The calibration story now ends the
way the 23 August paragraph said it should: a window whose top and
middle disagree births nothing, says the committed sentence out
loud, withholds every ruler-dependent number, and exports
calibration_refused so an analysis can count refusals. What birth
cannot see stays stated and uncovered: the uniformly-high window and
the short ruler remain analysis-side, the short-ruler rule still
queued for round II.

**THE REFUSAL IS CODE, 26 August 2026, and prediction 2 gates its
merge.** Prediction 1 came back exactly as committed: the owner's
grep over the eight measured remux exports read
calibration_ceiling_bound false on every line, so the criterion
rewrites nothing and the increment proceeded. baseline.ts now
freezes a ceiling-bound learning window into a third state,
`refused`, instead of birthing a clipped ruler: no personal
threshold exists, the blink reducer is fed nothing (the generic
fallback would otherwise keep counting against a line the
instrument just disowned), blink count, rate, durations, PERCLOS,
long closures and the alertness score all read "withheld,
calibration was refused", while the aperture trace, face presence,
the rates and gaze stay live. The refusal sentence is a core
constant pinned verbatim to docs/calibration-refusal.txt by test;
the export writes the full birth certificate plus a new
calibration_refused row, true or false, out loud either way. The
macbookair-shaped synthetic window (spread 1.378) refuses in test,
the healthy fixture-shaped window still rides to ready, refusal is
frozen (a calm eye afterwards does not un-refuse — the sentence
offers a restart instead), and mutations in both directions plus an
inverted export row each went red before being restored. The
clipping-era tests are rewritten to the new contract, which is the
document's own sentence: today it clips, from this increment it
refuses. What remains before merge is prediction 2, owed by the
standing rule that anything touching detector behaviour gets a
corpus run first: the full remux corpus on the M5 Max must
reproduce the published table digit for digit. No clip is
ceiling-bound, so the refusal must change nothing there.

**THE CALIBRATION REFUSAL IS PRE-DECIDED, 26 August 2026, before
any code exists.** docs/calibration-refusal.txt commits the last rung
of the calibration track in writing: the refusal fires on ceilingBound
alone — the signal computed and exported since 23 August — and
introduces NO new constant, because no benchmark of spread ratios
across good sessions exists to choose one from. What refusal means is
fixed there too: ruler-dependent numbers (blink count, rate,
durations, PERCLOS, long closures, alertness) are withheld, ruler-free
ones (aperture trace, face presence, rates, gaze) stay live, the
export still writes rows plus `calibration_refused: true`, and the
sentence shown to the person is written verbatim. Four predictions are
committed before anything is scored: none of the eight Eyeblink8
clips is ceiling-bound (scored by grep on the existing measured
exports, no re-run); therefore the post-code corpus re-run reproduces
the published table digit for digit before the increment merges; if
any clip IS bound the increment stops before wiring and the criterion
is reconsidered in the open; and the refused state is reachable by
test, a synthetic window shaped like macbookair's (spread 1.378)
refusing while the fixture's does not. The owner scores prediction 1;
the code increment starts only after that grep comes back.

**THE PREDICTION IS CONFIRMED, DIGIT FOR DIGIT, 26 August 2026, and
issue #316 closes.** The full corpus, prepared by the committed
remux tool, measured on the M5 Max: recall 83.6% (341 of 408),
precision 84.0% (65 invented), F1 83.8%, every per-clip row, the
glasses split and every coverage count IDENTICAL to
docs/eyeblink8-result.txt. The 24 August prediction is confirmed on
its own pre-registered terms — identical counts confirm the design
claim outright — across a different processor generation, operating
system, WebKit binary and fifteen merged commits of instrument
change. Every intermediate conclusion from the re-encoded files
("the prediction broke", "it is the machine", the 12.4-point
"reproducibility bound") is superseded; what survives as findings:
the 24-26 August code changes are measurement-neutral by A/B, and
false alarms depend materially on transcoding (19 vs 2-3 on the
worst clip), so THE PREPARATION IS PART OF THE RESULT — stated in
the model card and the generated README bullet. The published
number is now a measured property of the instrument and the
prepared files, on two machines.

**THE DISCRIMINATOR ANSWERED — IT WAS THE FILES, DIGIT FOR DIGIT,
26 August 2026, issue #316.** The committed preparation tool rebuilt
the corpus by remux and the M5 Max measured 27122013_152435_cam from
it: found 36, miss 5, false 19 — the published table's row for this
clip EXACTLY, on different hardware. By the rule stated before the
number existed, "it is the machine" is REFUTED: the 12.4-point
precision gap between the two published tables was re-encoded files
against remuxed ones, never processors. The "not likely" reasoning
(a lossless re-encode should decode to identical pixels) is refuted
by the same row — remux 19 false alarms, every re-encode from crf 0
to crf 28 gives 2 or 3 — and the MECHANISM of that difference is
recorded as an open question, not explained away. The first M5 Max
table (85.0 / 96.4 / 90.4) is re-labelled everywhere it appears: a
real measurement of wrongly prepared files, the discovery of a
preparation sensitivity nobody suspected, and NOT an Eyeblink8
result. The full-corpus remux run is in progress on the M5 Max,
scoring the ORIGINAL 24 August prediction (identical reproduction,
per-clip counts and all) on its own pre-registered terms; one clip
of eight has already reproduced digit for digit.

**THE INERT AUDIT FINDING WENT LIVE, AND IS FIXED, 26 August 2026.**
The stepper aims at `origin + (index + 0.5) * step` but its fallback
for an imprecise landing read `index * step`, dropping the origin
entirely. The August audit found it and correctly called it inert,
"only because prepare_eyeblink8.py normalises the origin to zero"
(docs/audit/appendix-chunk-4-all-findings.md). Making offset clips
measurable made it live, and its symptom would be silent: every
frame measured after a browser stops reporting where it landed is
reported early by the whole offset, on a benchmark indexed BY FRAME
NUMBER. Fixed, with a test that watches a fake browser answer twenty
frame callbacks and then go quiet mid-run; two mutations (dropping
the origin again, and freezing the fallback at the origin) each turn
it red.

**THE PREPARATION WAS NEVER LOST, AND THE MACHINE CONCLUSION IS
SUSPENDED, 26 August 2026.** analysis/tools/prepare_eyeblink8.py has
carried the corpus preparation since #158, with its own dependency
group in analysis/pyproject.toml. Nobody looked in analysis/tools.
Issue #309 was filed on the false premise that the step was
uncommitted and its settings lost; docs/eyeblink8-preparation.txt was
written to that premise, and three merged increments inherit it. THE
COMMITTED TOOL REMUXES — "-c:v copy", the H.264 bitstream byte for
byte, decoded frame counts verified both sides — precisely because
the ground truth is indexed BY FRAME NUMBER and a re-encode can
silently shift every annotation. It also normalises the timeline with
"-avoid_negative_ts make_zero", and its comment describes the 25
August failure word for word: an AVI remux can leave a start offset,
"Safari never answers them at all", "both report `seekable` as
starting at zero regardless, so the code cannot even detect the
situation". The re-encode this project prescribed reintroduced the
exact hazard the tool exists to remove, and the instrument was then
changed to survive it. CONSEQUENCE: the four-point crf sweep that
cleared the FILES swept only re-encodes, never the remux the
published run actually used, so "it is the machine" rests on an
incomplete elimination and is SUSPENDED. A lossless re-encode should
decode to identical pixels, so the conclusion will probably survive —
but that is reasoning, and this week has already been wrong once
about which plausible story was true. The settling measurement is one
command (prepare_eyeblink8.py, then measure 27122013_152435_cam):
nineteen false alarms means the files were the variable all along,
three means the machine conclusion stands on measurement. Both
published tables are unaffected; only the CAUSE between them is
withdrawn. src/core/frameSearch.ts stands on its own merits — the
August audit had already flagged the stepper's inexact-landing
fallback as inconsistent for any clip with a non-zero origin — but it
was not needed to measure this corpus.

**BOTH TABLES ARE PUBLISHED NOW, EACH NAMED WITH ITS MACHINE, 25
August 2026.** The owner's call, after the cause was established.
docs/eyeblink8-result.txt carries the pair, the elimination that
found the machine, and the REPRODUCIBILITY BOUND the pair buys:
found blinks 341 vs 347 (a spread of 6 in 408), false alarms 65 vs
13, recall 1.4 points apart, precision 12.4. Recall travels;
precision does not. README and MODEL_CARD say so where the numbers
are read, not in a footnote. The headline stays on the old machine's
table for one narrow reason, stated rather than dressed up: the miss
breakdown behind the result file was run on that measurement, so
promoting the M5 Max table means re-running that analysis first —
never preferring the better-looking column, which is exactly the one
to distrust. The README bullet is GENERATED: tools/resultsBlock.mjs
now parses the second machine's numbers and the spread out of the
result file, because prose beside a number drifts from it, and a
file that stops carrying the pair is a red build rather than a
README that quietly goes back to claiming one table.

**IT IS THE MACHINE, 25 August 2026, issue #316 answered.** One clip
converted from the same .avi at four qualities — lossless, crf 10,
crf 23 (x264's default), crf 28 — measured 37/4/3, 37/4/3, 37/4/3,
37/4/2, coverage 5134 every time. Found and missed never move; the
worst transcode disagreement is ONE false alarm at the lossiest
setting, against SIXTEEN between here and the published run.
Enumeration checked rather than assumed: code exonerated by the A/B,
files by this sweep, the face model is a committed file unchanged
since 2026, and package-lock.json has not moved since the published
run's commit (@mediapipe/tasks-vision 1.0.1, @playwright/test 1.62.1,
which pins the WebKit build). What is left is the MACHINE — its
processor, its OS, and the browser binary built for them. THE
FINDING, and it is a big one: stepping removed the hardware
dependence it was aimed at (coverage identical to the frame, found
counts 341 -> 347) but NOT the one that matters for precision.
Near-line flutter is decided by micrometres of aperture, and those
are machine-dependent in a way frame scheduling is not; the
instrument achieved FRAME determinism and was read as though it had
achieved MEASUREMENT determinism. One honest gap, unmeasurable: the
old machine's node_modules is asserted to match its lock, not
verified, and that machine is inaccessible. Consequence: 83.6 / 84.0
/ 83.8 is what this instrument measured ON THAT MACHINE, and
85.0 / 96.4 / 90.4 is what it measures on this one. Neither is "the"
result until the owner decides what a machine-conditional benchmark
publishes.

**THE TRANSCODE IS NOT THE VARIABLE, TWO POINTS IN, 25 August 2026,
issue #316.** 27122013_152435_cam converted a second time from the
same .avi, LOSSLESSLY (-crf 0), measured 37/4/3 with coverage 5134 —
identical to the -crf 10 conversion and to what the published run's
own code produced on it. Two transcodes of one recording, one
lossless, are indistinguishable to this instrument. What that does
NOT yet establish: the published run's settings are unknown and the
likeliest lost setting of all is x264's DEFAULT -crf 23, visibly
lossier than either point measured. The sweep is being finished
rather than declared — crf 23 and crf 28 on the same clip. Three
points from lossless to visibly lossy all landing on 37/4/3 would
exonerate transcoding across the practical range and leave the
MACHINE as the only remaining explanation for the published table,
making it a property of the laptop it was measured on. Counts moving
at crf 23 would keep the lost conversion a live suspect and make
every published corpus number conditional on settings nobody
recorded.

**THE CODE IS EXONERATED; IT IS THE FILES OR THE MACHINE, 25 August
2026, issue #316.** The A/B ran: the published run's own measurement
code, carrying only the two load-and-seek fixes without which it
cannot open these files at all, measured two clips and reproduced
YESTERDAY'S numbers exactly (37/4/3 and 67/5/0), not the published
ones (36/5/19 and 67/5/11). Coverage identical in every arm,
percentages identical to the last decimal. So the thirteen commits
merged after the published run change NOTHING this instrument
measures — which is also a determinism result the project did not
have. What the comparison cannot see: the two fixes common to both
arms, untested here (the reasoning that they cannot matter is in
docs/eyeblink8-m5max.txt, offered as reasoning, not measurement).
What remains is DIFFERENT FILES versus DIFFERENT MACHINE, still
entangled, because the original .mp4 files and the machine that made
them are the same inaccessible place. The discriminating experiment
is a new measurement rather than an old one: convert one clip from
the same .avi a SECOND time, losslessly, and measure it here — only
the file differs. Counts moving between two transcodes of one
recording makes every published corpus number conditional on a
conversion nobody recorded until 24 August; counts identical makes
the published table a property of the laptop it was measured on.
83.6 / 84.0 / 83.8 remains the standing result either way.

**THE REPRODUCTION RAN, AND THE PREDICTION BROKE, 25 August 2026,
issue #316.** The M5 Max measured the corpus against a prediction
committed before the run (docs/eyeblink8-m5max.txt): recall 85.0%
(347 of 408), precision 96.4% (13 invented), F1 90.4%, against a
predicted 83.6 / 84.0 / 83.8. COVERAGE IS IDENTICAL on all eight
clips, so the stepper visited exactly the same frames; what changed
is what it did with them. Fifty-two false alarms disappeared
(19 -> 3, 14 -> 1, 11 -> 0 on the worst clips), and the
pre-registered rule for counts moving by tens is that it STOPS THE
LINE. Applied as written: the new numbers are NOT published, do not
enter README or the model card, and 83.6 / 84.0 / 83.8 remains the
standing result until explained. A better number arriving
unexplained is still an unexplained number. Two candidates, one
experiment: build 003184a (the published run's code) and measure
THESE files with THAT code — ~65 false alarms means an increment
changed behaviour unnoticed (the model-clock ratchet 1761e33 and the
baseline birth move 89658cb are the suspects, both nominally
behaviour preserving on a stepped clip); ~13 means two transcodes of
one recording differ by fifty-two false alarms, a far larger
sensitivity than this project has assumed.

**THE CORPUS CLIPS DO NOT BEGIN AT ZERO, AND THE INSTRUMENT
BELIEVED THEY DID, 25 August 2026.** All eight Eyeblink8 clips
refused on the M5 Max with "could not work out this clip's frame
rate" while a sixty second cut of the BYTE-IDENTICAL stream
measured perfectly. The clips' first frame sits at 1.700 s
(ffprobe: `start: 1.700000`); WebKit on this machine reports
`seekable: 0.00-527.83`. The stepper read the seekable range as
"where the frames are", probed empty space where seeks complete and
decode nothing, and refused — blaming the file, which was clean
H.264 at a constant 30 fps with a frame count matching the
published coverage exactly. The stepper's own comment had
documented this trap (a clip beginning at 1.633 s) and "fixed" it
by trusting `seekable`, which is a true answer to a different
question; no test could see it because every fixture begins at
zero. The origin is now SEARCHED FOR (src/core/frameSearch.ts:
doubling probe to cross the gap, binary search to pin the first
frame within 4 ms, refusal rather than an invented origin), with
the whole stepper exercised against a fake video whose frames start
1.7 s in. An ordinary clip still costs one probe. NOTE: this
changes WHERE stepping starts on offset clips only; a clip that
measured before measures identically.

**THE CLIP LOADER NEVER ACTUALLY WAITED, 24 August 2026, found by
the M5 Max reproduction.** Every corpus clip failed with "could not
work out this clip's frame rate" — a sentence about the file,
produced by the loader. The 8 August Safari fix (#154) said in its
message and its comment that loading waits for `canplay` rather
than `loadedmetadata`; it ADDED the canplay listener without
removing the metadata one, so the promise resolved on whichever
fired first, which is always metadata. The intended wait never
existed, hidden for sixteen days because `preload="auto"` made
every clip tried so far decodable before the stepper's first seek
timed out. A short cut of the SAME byte-identical stream measured
perfectly; the full 8.8-minute clip lost the race. Fixed by
removing the stray listener, with a test that observes the ordering
(the belief had lived only in prose). The status line also stopped
claiming a camera permission prompt while a clip loads: loadingClip
is its own state now, because an honest wait is long enough to
read. NOTE for anyone reading old numbers: this changes WHEN
stepping starts, not what it measures — a clip that measured before
measures identically.

**"0 CLIPS TO MEASURE" IS NOW A REFUSAL, NOT A REPORT, 24 August
2026, closing issue #309.** The first reproduction attempt from a
fresh public download printed that line and then finished "done. 0
measured, 0 failed" — an empty run in a success shape, with all
eight recordings sitting right there as the nested .avi files the
public dataset ships. Both halves fixed: the preparation step is
committed (docs/eyeblink8-preparation.txt — the exact 24 August
ffmpeg settings, and what they do not promise, since the originals
are lost), and tools/corpusGuard.mjs — same arrangement as
bundleGuard: pure, tested, every refusal carries the remedy — makes
the runner exit at zero clips naming what it looked for (flat .mp4,
one directory level), what it found instead (a raw download's .avi
count, or converted clips stranded in subfolders), and the
committed step between the two.

**A SLOW CLIP RUN NOW SOUNDS ALIVE, 24 August 2026, issue #302, and
the mirror follows its source, issue #301 — the owner's remaining
two finds from walking the freeze check.** The mirror (PR #305):
clips draw unmirrored, the camera keeps its mirror, the toggle
redraws the shown frame so it answers even when no frames flow;
presentation only, the model reads the raw video. The heartbeat
(this PR): stepping only spoke when a frame finished, and a heavy
clip's calibration — up to sixty slow seeks before the FIRST frame —
sat silent at "0 done" for minutes. After five stalled seconds
(STEP_STALL_SECONDS, pinned) the status counts the wait out loud
once a second, naming the first frame and the large-clip cause;
stillness on that line now genuinely means a frozen page. Found
already built: the stepper's per-seek timeouts and named refusals —
giving up was implemented, waiting visibly was not. A clip larger
than Full HD also gets a note beside its own numbers that smaller
exports measure the same things faster.

**THE CAMERA COMES BACK WHEN A CLIP RUN ENDS, 24 August 2026,
issue #303, found by the owner walking #221's reproduction.** The
start button hid whenever the state was running, and no clip
SUCCESS path ever leaves running — so after "The clip finished.
Export the CSV, or pick another clip." the camera was unreachable
without a reload, and a reload resets the model clock, which made
#221's live confirmation impossible through the UI on a one-camera
machine. One flag now marks a finished or stopped clip run (all
three end sites: stepped finished, stepped stopped, watched ended);
the button returns while the session's data and exports stay; any
new source clears it. Two e2e assertions pin it on both clip paths.
Three more owner-found defects filed the same hour: #301 (a clip
draws mirrored by default and the toggle looks dead while no frames
flow), #302 (a stepped run can sit at "0 done" indefinitely on a
slow-seeking file with no sign of life). The lesson in LEARNING.md:
a fix whose confirmation needs an unusual action sequence should
have that sequence WALKED before shipping — the walk itself found
three bugs no test ever met.

**THE FALSE SILENCE IS CLOSED, 24 August 2026: the warning now
judges the rate that matters, because the first device read proved
the old one wrong.** The M5 Max's first export (18:56 UTC, 52
minutes after the pre-decision merged): declared 30, delivered
30.0, sampled 30.0, read fraction 1.002, processing 120. Four times
faster than its camera, reading exactly the camera's 30, warning
silent — the false-silence shape, observed. Rule one fired: the
warning's input is the measured sampled_fps where the browser
reports delivery, processing rate where it cannot; rule three's
committed sentence ships verbatim ("A faster machine would not
help; the camera's delivery is the limit"), chosen when the gap
exceeds the enter/clear pair's own five fps wobble price; rules two
and the 25 floor hold. All ten enumerated places carry dated
corrections, the originals kept. ALSO VERIFIED ON THAT FILE, first
real-world contact for three days of work: the ruler-fit
cross-check agrees BIT-EXACTLY (1.0461094018612334 both sides), the
birth certificate reads healthy (3001 samples, spread 1.044,
unbound), and the export's delivery rows did their job. Still
unscored: pcsony >= 60 delivery and the remaining dry-run devices
(#221's live half was scored the same evening: verified, closed).

**THE 60 FPS WARNING'S FUTURE IS DECIDED BEFORE ITS MEASUREMENT,
24 August 2026.** docs/blink-sample-rate.txt gained a pre-decision
section for the warning band, mirroring the 25 fps floor's: four
rules committed before any dry-run device is read. The quantity
moves to the MEASURED sampled_fps only if a device shows the
false-silence shape (processing fast, delivery slow, no warning);
the 60/65 thresholds never move under this measurement; the
replacement sentence is written now, word for word, so the
correction is mechanical; and the warning will never model the
aliasing dip. If no device shows the shape, nothing moves and the
section retracts with the model. The scoring measurement is named:
camera_delivered_fps and sampled_fps rows from the four dry-run
devices plus the new M5 Max, 30+ seconds each. Docs only — the page
changes nothing until the numbers exist, which is the point.

**THE MODEL'S CLOCK IS NOW ONE RATCHET, 24 August 2026, issue #221's
unit half.** The face model demands a strictly increasing clock and
the page had three to offer it: wall clock for the camera, wall
clock for a watched clip, a lifted media clock for a stepped clip.
Only the stepped path lifted, so a clip stepped faster than real
time left the model's clock in the future — a 4-minute clip stepped
in 90 seconds leaves it ~150 s ahead — and the next camera OR
watched-clip frame handed it a smaller number: MediaPipe throws, the
throw kills the display loop before it re-arms, the page freezes
silently. src/core/modelClock.ts is one pure ratchet every model
stamp now passes through: each source START rebases (offset = what
lifts this source's first stamp strictly above everything already
sent, ZERO when no lift is needed, so a fresh camera still hands
the model the plain wall clock), and within a source the offset is
constant, so GAPS are untouched — the #174 non-negotiable, pinned
by test. A backwards stamp inside a source returns null and the
model is not called: refused, never repaired into a fake gap. Four
mutations all red (allow-equal 5, negative offset 1, repair 1,
re-offset-every-stamp 2). (The live half was verified and the
issue CLOSED later the same day: a 300 s synthetic clip stepped in
under a minute on the M5 Max, then the camera — readouts ran,
no freeze. It needed #303's fix first; the reproduction sequence
was unreachable through the UI until the start button returned.)

**THE NEW MACBOOK HAS ARRIVED (24 August): a 16-inch M5 Max, macOS
Tahoe 26.5.1.** Note: an M5 Max is far faster than any machine in
the published tables — its processing rates will not resemble
macbookair's, which matters for which sessions can be compared to
which.

**THE MACHINE HOLDING `$DATASETS` IS NOT PHYSICALLY ACCESSIBLE FOR
AN EXTENDED PERIOD (learned 24 August), so the data splits three
ways.** RE-OBTAINABLE from anywhere: Eyeblink8 (public, the
blinkingmatters.com research page; extract to
`$DATASETS/eyeblink8/eyeblink8` and convert per
docs/eyeblink8-preparation.txt — the step issue #309 found
undocumented — and `eyeblink8-measured-rearm` is
GENERATED by the corpus runner, not transferred) and DROZY (by
request to its authors; nothing queued needs it). POSSIBLY
RECOVERABLE: the six validation-round exports were originally SENT
by the volunteers, so copies may survive in whatever channel
carried them; the dry-run devices' own exports may also still sit
in each device's Downloads folder. TRULY WAITING on the machine:
anything not recovered by those routes. Consequences: the Eyeblink8
re-run unblocks after a re-download; the amplitude comparison and
any round re-analysis need the recovered round files; the pcsony
delivery reading waits for physical access to that device, and its
committed prediction does not expire.

**THE DELIVERY TABLE IS NOW ARITHMETIC, NOT JUST NUMERICS, 23 August 2026.** Every number in docs/blink-sample-rate.txt came from a sweep,
and this file's own budget correction proves a sweep can be wrong in
ways that look fine. test/core/blinkClosedForm.test.ts pins the sweep
against a closed form derived independently from the detector's
mechanics — frac(La/Pd)·min(1, ceil·Pd/Pp) + (1−frac)·min(1,
floor·Pd/Pp), La the ARM-line dwell — and across all 72 cells of a
six-blink, twelve-regime grid the worst disagreement is 0.0060
(bound pinned at 0.0075, chosen after measuring and said so). The
non-monotone dip is IN the arithmetic. Degrading the sweep budget to
50×8, the exact defect the 21 August review caught by hand, now
turns five tests red by machine. Two wrong rederivations are pinned
as disagreeing (threshold dwell instead of arm dwell; rounding
instead of phase mixing). One mutation SURVIVES and is recorded as
correct rather than papered over: holding the frame AFTER a delivery
tick is a constant grid shift, invisible to any phase-averaged
number, which is all this harness publishes.

**THE TWO IMPLEMENTATIONS NOW CHECK EACH OTHER ON EVERY REAL FILE,
23 August 2026, the calibration track's third rung.** rulerFit.ts
made the fifth check live in two languages, and two implementations
of one statistic drift silently unless something compares them.
analysis/blinklab/ruler_fit.py reads the LAST baselineOverResting
the page wrote — its whole-file number — and holds it to this side's
own baseline_settling derivation, EXACTLY: no tolerance, because the
exporter writes shortest round-tripping decimals, the loader parses
them back to the identical float64s (pinned by a test that pushes
7.44/6.1's full seventeen digits through the real loader), and two
wrong implementations can agree to two decimals. The validation
report prints one line when all accounts match and a THE PAGE
DISAGREES WITH THIS TOOL section at full precision when any does
not. Legacy files say nothing there — silence for a session that
never spoke, never a verdict about it; the one un-seeable case is
stated in the module docstring (an all-NaN column cannot distinguish
a legacy export from a new one that failed to write, and reads as
not comparable). Four mutations all red: always-agree and 2dp
rounding each kill 2 tests, first-instead-of-last 1 (after the test
itself was fixed — its early wrong value 1.2 happened to equal the
final ratio, so the mutation survived until the fixture
discriminated), shrug-instead-of-disagree 1.

**THE ROUND'S FIFTH CHECK NOW RUNS ON THE PAGE, 23 August 2026, the
calibration track's second rung.** `baseline_over_resting` — the
check that caught macbookair and P5, the one that decided which
sessions could vote at all — lived only in Python, judging exported
files days after the person had gone. src/core/rulerFit.ts computes
the same ratio live, once per feature record: the frozen baseline
over the running median of the file-so-far's apertureMm, printed
beside the blink threshold ("Ruler fit: baseline is 1.35 x your
resting eye, too long to trust") and exported per row as
`baselineOverResting`, so the final row of any session inside the
3600-row buffer IS the published statistic.

The agreements between the two implementations are machine-held, not
promised: a Python test reads the 1.25 ceiling out of the TypeScript
source (mutating either side turns CI red); the median averages the
middle pair exactly as pandas does, which the repo's own nearest-rank
percentile() does NOT, so rulerFit carries its own median rather
than bending one that serves published numbers; the closed-eye
frames stay IN the median, pinned by a P5-shaped series where
filtering by the blink line flips the verdict (the circularity the
plan refused, validation_checks.py's own docstring). The six
published ratios reproduce as verdicts — fits, fits, tooLong, fits,
tooLong, fits — including P6's 1.23, the round's narrowest escape.
The spoken verdict dwells 15 records before changing so a wobbling
median cannot flap it; the exported ratio is never smoothed. The CSV
contract grew its first GENERATION: the loader accepts exactly two
headers, the current one and the pre-23-August one, and fills the
new column with NaN for old files — the round's six CSVs and every
evidence file stay loadable, their tables stay reproducible. Six
mutations were run and every one turns tests red (ceiling value 8,
median method 4, blink-line filter 2, strictness 1, dwell 1, cap 1).

**THE RULER NOW TRAVELS WITH ITS BIRTH CERTIFICATE, 23 August 2026,
the calibration track's first rung.** The baseline's median ceiling
has clipped SILENTLY since the freeze: on the dry run's macbookair
session a few frames dragged the p90 to 10.35 mm against a window
median of 7.51, and nobody could see it until the Python side read
the exported rows five days later. src/core/calibrationWindow.ts now
describes every birth as a value — sample count, median, p90, spread
ratio, whether the ceiling bound, and what the ruler was born at —
the ready state carries it, and the export writes
calibration_samples, calibration_spread_ratio and
calibration_ceiling_bound. A session whose ruler was never born
writes NOTHING rather than unknown, because there was no birth to
describe.

NOT ONE MEASURED NUMBER MOVES: a test re-derives the old birth
formula from the plan's constants and holds the new module to it on
every window, which is the only arrangement in which that test can
disagree with the code. The macbookair shape is a fixture (spread
1.378, ceiling bound, born at 9.3875 — still 1.35 times that
session's resting eye, which is why the clip is a guess wearing a
number's clothes and why REFUSAL is the next rung, gated on a corpus
prediction the Mac must score). The owner's committed 300-frame
fixture replays through the real aperture pipeline and lands under
the ceiling, unbound. Two mutations each turn three tests red. One
expectation was corrected the honest way: the window holds 301
samples and not 350, because ready means FROZEN and the samples fed
after the thirtieth second never enter.

**THE HONEST TEXT IS NOW READABLE, 23 August 2026, and a guard keeps
it that way.** Roadmap 8.8 was declined on 15 August because "all
text clears WCAG contrast". That clause was FALSE, and it stopped
being true the day after it was written: five colour pairs on the
committed stylesheet failed AA, and the worst of them was
`.rate-warning` at 2.80:1 — the processing-rate limitation shipped on
the 20th, rendered in the least readable colour on the page. A
limitation nobody can read is not a limitation in the open.

Corrected: `--muted` #94a3b8 to #64748b (2.56 to 4.76 on a card, 2.45
to 4.55 on the page), a new `--accent-text` #b8500c for the warning
with `--accent` keeping its job as the graph and icon colour, and the
alerting banner going ink-on-amber (2.80 to 6.37) instead of white on
amber. All nine pairs the page renders text in now clear 4.5.

`tools/contrastGuard.mjs` computes them, on BOTH grounds, because
`--page` is a shade darker than `--surface` and a colour chosen
against a card is chosen against the wrong ground: #c2540b was the
first candidate for the warning and is rejected in the record at 4.39
on the page. TWO HOLES FOUND BY MUTATING THE GUARD ITSELF: reverting
the warning to `--accent` left every pair passing and the caveat
unreadable, so the guard now checks which token each rule USES, not
only that legible tokens exist; and lowering the threshold disarmed
it silently, so 4.5 is pinned. ROADMAP 8.8 IS AMENDED ADDITIVELY, not
reopened: the decline stands, what remained really is polish. What
did not stand was checking a claim like that by eye.

**HARDWARE IS OUT OF REACH UNTIL ABOUT 29 AUGUST.** The owner is away
from the MacBook for a week, so `$DATASETS` and the four dry-run
devices are both unavailable: no corpus runs, no Eyeblink8 re-run, no
delivered-rate readings, and no `pcsony` amplitude comparison. Work
this week must be verifiable offline. What that rules IN: the
calibration track's window description and ruler-fit verdict, both
checkable against numbers already published in docs/. What it rules
OUT: refusing a contaminated window, which changes detector behaviour
and owes a corpus re-run before it merges.

**THE SECOND RATE IS NOW MEASURED, 21 August 2026, and the page shows
it.** A passive observer rides beside the camera's measurement loop,
counting frames as the camera DELIVERS them, and a pure reducer turns
the two event streams into three numbers the instrument has never
had: what the camera delivered, how many DISTINCT delivered frames
the detector actually read, and what share of what arrived was ever
looked at. The page prints `Camera delivery: N frames per second, of
which this instrument read M` beside the processing rate, and the
export carries `camera_delivered_fps`, `sampled_fps` and
`delivered_frames_read_fraction`.

Distinct photographs rather than ticks is the whole idea, and the
mutation counting ticks turns two tests red. Every rate is null and
never zero when unmeasurable, and a browser without the delivery
callback is TOLD so on the page rather than shown nothing, because a
limitation removed from the open is worse than one stated. The
observer measures and never steers: if it dies the session keeps
measuring and the rate reads unknown.

WHAT IS STILL UNMEASURED is the thing this was built for: the four
dry-run devices have not been read yet. That takes about 30 seconds
each and no volunteers. The prediction they will be scored against is
already committed in docs/blink-sample-rate.txt, including the case
that refutes the model outright.

**THERE ARE TWO RATES, AND THE PAGE MAY BE NAMING THE WRONG ONE,
21 August 2026. A PREDICTION IS COMMITTED AND NOTHING IS CORRECTED
YET.** The sampling-rate harness now models the CAMERA's own delivery
grid beside the processing grid, sample and hold, both phases swept.
What it says: above the delivered rate, processing buys nothing —
30.7, 55 and 126.7 fps are the same column — and a faster CAMERA
helps, 0.48 to 0.96 for one marginal blink when delivery goes 30 to
60, but only up to the rate the machine can read. A third finding
qualifies the 17 August table: a firm 2.80 mm blink is caught only
0.87 of the time at 25 processing on a 30 fps camera, because a frame
held 33 ms can fall between two 40 ms ticks. THE 25 FPS FLOOR IS
DELIBERATELY NOT MOVED ON THAT BASIS: a constant chosen from a model
is fitting.

TWO CLAIMS IN THE FIRST DRAFT WERE WRONG and an adversarial review
caught them before publication; both wrong sentences are printed in
docs/blink-sample-rate.txt rather than deleted. "The improvement
lives in the camera" is FALSE past the processing rate: detection is
not monotone in the delivered rate, it peaks where the two grids
divide evenly and dips between, so at 60 processing a 90 fps camera
(0.82) is worse than a 60 fps one (0.96) and a 120 recovers (0.96).
And "region 1 holds for a camera faster than the processing rate" was
backwards — 25 processing on a 30 fps camera IS that case and it is
the case that fails. It is the RATIO that decides, not which number
is larger. Both are pinned by tests now.

Why it matters: `src/io/frameLoop.ts` drives the camera from
requestAnimationFrame with no check that a frame arrived, and
`src/io/camera.ts` asks for a resolution and no frame rate — while
the same file already refuses that exact mistake for CLIPS, in a
comment explaining that a display-rate tick "would report the
display's refresh rate as the clip's frame rate".

NOTHING IS RETRACTED. The dry run's §4 prediction was committed first
and held, and the evidence fits both models. The committed prediction
in docs/blink-sample-rate.txt names the case that presses hardest:
`pcsony` caught 10 of 10 while processing at 126.7, so a 30 fps
delivery there is bad for the model. It is NOT decisive on its own,
because the model only predicts a miss for marginal blinks and the
blink log is censored about which those were; the amplitude
comparison against `iphone2` that would make it decisive is named
there and is Mac-only. The file also enumerates the TEN places the
claim is recorded, three of them machine-enforced, and decides in
advance what the 25 fps gate does. Unit tests are 640 at that commit.

**ROADMAP 7.9 IS DONE, 21 August 2026: the README's results summary
is generated, not written.** A "Results at a glance" block between
markers is built by tools/resultsBlock.mjs from the three committed
result files: Eyeblink8's numbers through resultGuard's own parser,
DROZY's null with its permission-required citation (the generator
REFUSES a source that lost the cite or the null-verdict sentence),
and the round's three criteria verdicts parsed from the published
table. A test regenerates the block and fails when the committed
README drifts from it, so a result file changing without npm run
results:write is a red build, not a stale page; no TODO may remain
in the block. Eight tests, the block-freshness ones watched failing
against a README with no block. Unit tests are 636. With 7.8 below,
Phase 7's achievable rows are all done; 7.5 and 7.6 stay HELD on
data that does not exist.

**ROADMAP 7.8 IS MEASURED, 21 August 2026: the alert's latency is
500 ms plus at most one frame.** Time from eye closure to alert is
deterministic and now pinned: the long closure detector fires on the
first frame strictly past 500 ms and the governor fires the same
frame, so 25 Hz gives 520.0 ms, 30 Hz 533.3, 60 Hz 516.7, proven
sensitive by mutation (removing the threshold turns the tests red).
The debounce regime is stated beside it, not hidden: within 5 s of a
firing a new closure is counted, never told. The core reducer chain
costs about 42 microseconds per frame on one measured machine,
asserted under a deliberately generous 2 ms ceiling. What the record
does NOT include is named in docs/latency.txt: the model's ~6 ms and
the camera's own delay. Unit tests are 628.

**THE WINDOW'S WIDTH NOW PRINTS BESIDE ITS COUNTS, 21 August 2026,
the tool half of the round's queued rule 3.** Probe P's zero-width
window, two marks stamped inside the same one-second record, printed
as an ordinary MISSED with nothing in the table showing the window
had no width. The CHECKS table now carries a "window (s)" column, and
a window narrower than the one-second marker slack is named out loud
under the summary, its verdict printed as computed rather than
trusted. NO VERDICT CHANGED: what such a window MEANS is still the
next round plan's rule, queued exactly as before beside frame-rate
soundness and window-scoped drift. Five tests, four watched failing
first, the fifth the negative control; Python tests are 193.

**THE RE-ARM GATE, 21 August 2026, closes the round's last code
finding.** After a counted blink, no new closure may arm until the
aperture rises 10 percent above the blink line, the mirror of fix
#114's arm line: an eyelid must reopen before it can blink again.
Built for P1's 25-for-10 re-crossings, predictions and a ship/no-ship
decision rule committed first (docs/blink-rearm.txt), proven on
synthetic traces at every rate and phase, then on the corpus: 13
false alarms removed at ZERO recall cost, precision 81.4 to 84.0, F1
83.8, the fifth published number. The genuine double blink survives
every rate and phase, durations are untouched, and the refractory
period stays at 150 ms because the fix is mechanism, not timer. Both
owner decisions (D1, #178) and both round-driven fixes (freeze,
re-arm) are now DONE; nothing is queued. Next development, agreed
with the owner: the big-feature ladder, machine-adaptive measurement
and guided calibration, then multi-signal and longitudinal work.

**THE RULER FREEZES, 20 August 2026, and the published number moved
DOWN with the instrument's honesty.** The round's failed baseline
criterion was met with code: the rise-only ratchet is removed, the
baseline freezes at its thirty-second calibration, and the birth
ceiling tightened to the plan's own 1.25 line. The corpus was
re-measured with predictions committed first: recall 87.7 to 83.6
(predicted 82 to 86), the precision prediction was WRONG (81.4, down,
because the frozen lower line exposes near-line flutter fragmenting
into re-crossings, P1's live signature) and the record says so in
docs/baseline-freeze.txt and docs/eyeblink8-result.txt. The round's
six live sessions are NOT re-scored. D1 stage two also shipped the
same day (the below-60 fps warning) and #178 closed with the ceiling
kept.

**THE SIX-PERSON ROUND IS COMPLETE AND PUBLISHED, 20 August 2026.**
All six participants returned files, every file was read with no
refusals, and the table is published whatever it says, per the plan:
`docs/validation-round.txt`. Criterion 2, the baseline does not
generalise, FAILED, pre-registered: three of six rulers were unusable,
each a different way. Criterion 1 was evaluated on the three sound
sessions and the detector missed NOTHING; its wild defect is
over-counting (one slow deep blinker, 25 for 10, the first independent
evidence feeding the #178 decision). Criterion 3 not met. The
evaluation was a two-hundredths escape: the last participant's
baseline ratio landed 1.23 against the 1.25 ceiling, and one more
unsound session would have voided criterion 1 by the plan's own guard.
Nothing identifying any participant is published: no names, no file
names, no user agents, no sleepiness answers.

**THE MID-ROUND FREEZES ARE LIFTED.** src/ may change again, roadmap
7.8 is unfrozen, the deploy workflow is unfrozen. The rules queued for
the NEXT round (frame-rate soundness, window-scoped drift, minimum
window width, moderation) are in the round write-up. What the round
points development at, in order: baseline calibration (the failed
criterion), then the owner's two decisions, D1 (now with twelve
sessions of evidence that the gate never wrongly opened) and #178
step 4 (now with independent refractory evidence).

The increment before it: the round's analysis tool was adversarially
tested BEFORE its table was published, and hardened by what that
found. The
record is `docs/validation-tool-adversarial.txt`: fifteen probes, every
prediction committed before any probe ran, fourteen right and the
fifteenth wrong in the bad direction. What the probes caught: five ways
one participant's corrupt cell crashed everybody's table, a renamed
blinks file (`.CSV`, `.csv.txt`) that silently became a MISSED verdict
criterion 1 would have counted, a `nan` marker that manufactured the
same verdict, a `#` inside a cell that silently voided a working
baseline, and criteria that printed "not met" under a table with zero
readable rows. All of those are named refusals now, 21 new Python
tests were each watched failing against the unfixed code first, and
the real four-participant table prints byte for byte what it printed
before the branch, checked by diff. No metric, threshold or verdict
moved; mid-round freezes held.

A SECOND PASS the same day, owner-authorised, probed the layer the
first pass deliberately did not: the judging and the printed table,
fed files the tool accepts. Seven probes, seven predictions held. A
broken truncation declaration no longer reads as "nothing lost", one
participant prints as "1 participant", and refusal lines name a file
once. The finding that was NOT fixed: two marks stamped in the same
second make a zero-width window that prints as a routine MISSED, and
fixing that changes a verdict, so it is QUEUED AS A THIRD NEXT-ROUND
RULE beside frame-rate soundness and window-scoped drift. Tests are
188 now, table still byte-identical.

The increment before it: the six-person validation round's analysis
tool, whole.
`docs/validation-plan.md` was committed BEFORE any session file existed,
`analysis/blinklab/validation.py` pairs a folder of exports and refuses
by name, `analysis/blinklab/validation_checks.py` computes the plan's
columns, and `analysis/tools/validation_report.py` prints the table:

    cd analysis
    PYTHONPATH="$PWD" .venv/bin/python tools/validation_report.py \
        "$DATASETS/validation-round"

It exits non-zero when it could not read everybody. Before it, #266
shortened the page heading to "Alertness demo".

**THE DRY RUN HAPPENED and it found what fixtures could not.** The owner
ran the whole protocol on FOUR devices over 16 to 19 August: an iPhone 14
Pro Max, an iPhone 17 Pro Max, a MacBook Air, and a Sony A7 IV through a
Cam Link 4K. SIX sessions, because the iPhone 14 and the MacBook were
each run twice; both re-runs are explained below. Raw files in
`$DATASETS/validation-dry-run`, never in this repository. The tool read
all twelve files with no refusals, and the pairing coped with the device
names inserted into the filenames.

**REFER TO SESSIONS BY NAME, NOT BY LABEL.** `P1` to `P6` are positional
and shift the moment a session is added: the MacBook re-test was P4 on
17 August and is P5 now, which falsified the prose in the published
write-up for two days. The tables print the session name beside the
label since 19 August. The names are `iphone`, `iphone2`,
`iphone17promax`, `macbookair`, `macbookair2`, `pcsony`.

**The finding: the same face gave a median eyelid aperture within about
11 percent across all six sessions, and the baselines learned from those
measurements were 7.69, 7.61, 8.09, 9.80, 7.78 and 7.30 mm, a spread of
34 percent.** The iris normalisation works. What is learned from it does
not travel. In `macbookair`, a few frames in the first 30 seconds read
up to 10.35 mm against a window median of 7.51, and a 90th percentile
follows them, so the blink line landed at 71 percent of resting aperture
against 56 to 58 everywhere else. That session logged 26.0 blinks per
minute, including one detection of 1.26 mm amplitude, below the faint
line the on-screen table greys out. `macbookair2` is the same laptop run
again with a baseline that landed correctly.

Readiness and drift both PASSED on that session, because a baseline born
wrong does not move. Its drift was 0.0. The plan's second dated
correction adds `baseline_over_resting`, flagged above 1.25, and
`macbookair` is the only session of the six that it flags.
Last commit, as of the stamp below: 2026-08-24;
`git log -1` is always the truth
Live demo: https://heshipstech.github.io/blinklab/
Currently working: THE CALIBRATION TRACK, on branch
`claude/state-md-review-test-tmhlhh`, one increment per PR since
PR #291. Merged so far: the delivered-rate track (PR #291, five
commits, rebase-merged 23 August), the birth certificate (PR #292),
and this rulerFit increment is the next PR. The owner is away from
the MacBook until about 29 August, so only offline-verifiable work
ships; everything waiting on hardware is listed below and none of it
blocks building.

Done today, one PR each: increment B (rulerFit live, PR #293),
increment C (the Python cross-check of the page's account, PR #294),
increment D (the delivery closed form, this PR). Queued next,
offline-verifiable: the model-clock lift (#221, unit half only) or
the BLINK_RISK_FPS pre-decision. The refusal increment stays gated
on a corpus prediction the Mac must score, so it waits for ~29
August with the rest of the hardware list.

WHAT IS WAITING ON THE OWNER, and it is not a validation round: about
30 seconds on each of the four dry-run devices, opening the page and
reading the new `Camera delivery:` line. No volunteers, no dataset.
That measurement scores the prediction committed in
docs/blink-sample-rate.txt. Do NOT write the correction to the page's
rate claim before that number exists; the ten places it is recorded
are enumerated in that file, and three of them are machine-enforced
so a partial correction turns the build red.

EXPECT THE PREDICTION TO GO BADLY, and that is written before the
measurement rather than after. `camera_declared_fps` was 30.0 in all
twelve recorded sessions, and a track negotiated at 30 cannot deliver
60, so the predicted "pcsony delivers 60 or more" is probably already
wrong. If it is, the delivery section is RETRACTED in a new dated
section, per its own rule.

PARKED MID-INCREMENT: the contrast fix. tools/contrastGuard.mjs was
written and then set aside when the review landed; the file is GONE
with the container, but the measuring is the part that cost time and
it is recorded here, computed from src/styles.css rather than from a
checker:

    ink #0f172a on surface #ffffff     17.85   pass
    ink on page #f8fafc                17.06   pass
    body #475569 on surface             7.58   pass
    muted #94a3b8 on surface            2.56   FAIL
    muted on page                       2.45   FAIL
    accent #f97316 as text on surface   2.80   FAIL   <- .rate-warning
    accent as text on page              2.68   FAIL
    surface on accent                   2.80   FAIL   <- alerting banner

So the honesty caveat added on 20 August is the LEAST readable text
on the page, which makes roadmap 8.8's decline ("all text clears
WCAG contrast") false the day after it was written. The replacements
that clear 4.5 on BOTH grounds: --muted #64748b (4.76 / 4.55), a new
--accent-text #b8500c (5.01 / 4.79) for .rate-warning only with
--accent kept as the graph and icon colour, and the alerting banner
going --ink on --accent (6.37) instead of white on orange.

TWO TRAPS, both already paid for. The plan pinned "white on #0f172a
= 15.13" and the real ratio is 17.85, so a test written to that pin
would have failed for the right reason and been "fixed" by bending
the constant. And the reviewer's own suggested --accent-text
#c2540b measures 4.39 on --page: it clears on a card and fails on
the page behind it, which is why the guard must check both grounds.

REVIEW FINDINGS NOT YET ACTED ON, from the four-lens pass on the
delivery increment. All medium, all recorded so they are declined
rather than forgotten: the 3.20 row of the delivered table still
prints two cells the 200-step sweep cannot resolve (exact values
0.80 and 0.82); the model has an EXACT CLOSED FORM, so the sweep
could become a test that the harness agrees with arithmetic rather
than the source of the numbers; and BLINK_RISK_FPS, the 60 fps
warning threshold, got no pre-decision while the 25 fps gate did,
even though the warning is the surface the model says is wrong.

Next development after this track, agreed with the owner: the
big-feature ladder, machine-adaptive measurement, guided calibration,
multi-signal alertness, longitudinal tracking. THE CALIBRATION TRACK
IS INDEPENDENT of the delivered-rate measurement and is the rung that
answers the round's one FAILED criterion, so it is the thing to pick
up if the devices are out of reach. Three rules plus moderation are
queued for the NEXT validation round in docs/validation-round.txt.

The full plan from here to v0.10, twelve increments across three
releases with the adversarial review of the plan itself, is at
https://claude.ai/code/artifact/60a3f037-b412-46a1-bc87-cfb90677ce8e

A note for sessions running from a CLOUD checkout (claude.ai/code on
an iPad, for instance): everything in this repository works there,
including all unit, e2e and Python tests, docs and src work. What
does NOT exist there is `$DATASETS`, which lives only on the owner's
Mac Mini: corpus measurement runs, re-evaluation of Eyeblink8 or
DROZY numbers, and any re-reading of the validation round's raw
participant files are Mac-only. Published numbers can be cited from
docs/ everywhere; they can be REPRODUCED only where the datasets
folder is.

**THE IPHONE WAS RE-RUN AND THE ANSWER IS THE DETECTOR.** Protocol
followed exactly, and 7 of 10 deliberate blinks were detected. The seven
sit at a metronome 0.90 to 1.00 s cadence broken by two holes of 2.89
and 2.98 s, each the width of two more blinks. The person did not pause.

**THE MACBOOK WAS RE-TESTED on 17 August**, the same laptop at the same
rate with a baseline that landed correctly, to separate the processing
rate from the device. Sound sessions whose marks are where the protocol
asks:

    iphone2         30.7 fps     7 of 10
    macbookair2     29.2 fps     9 of 10
    iphone17promax  55.0 fps    10 of 10
    pcsony         126.7 fps    10 of 10

**At the rate a four core machine produces, whether laptop or phone,
this instrument loses deliberate blinks, and the 25 fps floor is above
none of it.** Every one of those sessions ran above 25 fps throughout
the marked window, so nothing was refused and nothing said anything was
wrong. Each miss is a hole a whole number of blinks wide in an otherwise
metronome cadence.

**The processing rate is set by the COMPUTER, not the camera.** Every
camera in every session declares 30 fps, and the achieved rate ran from
29.2 to 126.7. Do not reduce this to core count: participant 2 of the
actual round has twelve cores and runs at 45, while the Sony machine has
twelve and runs at 127. So how many blinks this
instrument reports depends on how fast the viewer's computer is, and the
page tells them nothing about it. That is larger than D1 as written,
which is about a slow camera holding the gate open. (Corrected 24
August 2026: up to what the camera delivers, and no further — the
M5 Max measurement showed a machine four times faster than its
camera reads exactly the camera's 30. The paragraph stands as the
record of the claim's original form.)

**RETRACTED, and the write-up records it:** the 16 August version of
this said blink duration moves with the processing rate. `macbookair2`
refutes it: the slowest sound session reports the longest blinks, 149 ms
at 29.2 fps against 96 ms at 30.7 and 129 ms at 126.7. Not ordered by
rate in either direction. The claim rested on two points that happened
to line up.

**SETTLED 19 August, and the prediction was committed first.** A sixth
dry-run session on an iPhone 17 Pro Max ran at 55.0 fps and caught 10 of 10. Written down before it was recorded: a faster phone should catch
close to ten if the rate is the cause, and should miss about three
REGARDLESS of rate if the cause is iOS, WebKit or the front camera. That
session holds all three of those constant against the iPhone 14 and
missed none. **The phone was never the problem. The rate was.**

Sound sessions, ordered by rate: 30.7 fps gives 7 of 10, 29.2 gives 9,
55.0 gives 10, 126.7 gives 10. The transition sits between 30 and 55,
and the 25 fps floor is nowhere near it. That agrees with
`docs/blink-sample-rate.txt`, which was run before either phone session
and predicted the band closes by 60 Hz.

Still confounded and said so in the write-up: the camera differs (Front
Camera against Front Ultra Wide), iOS and Chrome both moved a version,
and it is one session per device on one face.

**The duration retraction is now firmer.** Both iPhones report about
96 ms while running at 30.7 and 55.0 fps. Duration tracks the DEVICE,
not the rate.

The full write-up is `docs/validation-dry-run.txt`, SIX sessions, and it
carries the tool's own output. **Refer to sessions by NAME, not by label:
labels are positional and the MacBook re-test moved from P4 to P5 the
moment a sixth session arrived, which falsified the prose around it for
two days. The tables now print the session name beside the label.**

**THE CAUSE IS NOW ISOLATED, offline, with no camera and no people.**
`docs/blink-sample-rate.txt`, reproducible with

    BLINKLAB_PRINT_TABLE=1 npx vitest run test/core/blinkSampleRate.test.ts

`blinkStep` is a pure function, so a blink can be built as an aperture
trace, sampled at a chosen rate, and run past the real detector with
everything else held still, sweeping the PHASE that nobody controls in a
real session. Three regions, and only the middle one is about the rate:

- Deep blinks, 2.80 mm and below: caught at every rate, every phase.
- Blinks too shallow to reach the ARM LINE (the blink line less the 10
  percent hysteresis of fix #114): never caught at any rate. A depth
  problem, and by design.
- Between them, a band about 0.4 mm wide where the RATE decides. At
  3.30 mm: 56 percent at 25 Hz, 67 at 30, 100 at 60. Speed widens it:
  an 80 ms blink at 3.20 mm is caught 43 percent of the time at 30 Hz
  and always at 90.

Proven by mutation rather than argued: setting
`APERTURE_HYSTERESIS_FRACTION` to 0 removes the arm line and the band
disappears, turning three of the five tests red. So the tests are
sensitive to the cause, not only to themselves.

**WHAT IT CANNOT SAY, and this is permanent.** Whether real blinks live
in that band often enough to explain 7 of 10 and 9 of 10. THE DATA IS
CENSORED: a missed blink writes no row, so every amplitude in every
blink log comes from the blinks that were caught. More sessions do not
fix it.

**The 25 fps floor is NOT the thing that is wrong.** Refusing below 25
is correct and these numbers support it. What is wrong is that above the
floor nothing is said: 29 fps and 127 fps both pass silently and are not
the same instrument. That is the honest shape of D1's remaining work,
and it is not the shape D1 was written in, which assumed a slow CAMERA.
In five real sessions every camera declared 30 and the gate never
wrongly opened once.

**ISSUE #178 IS RECONCILED**, 18 August, `docs/max-blink-duration.txt`,
and nothing was changed to do it. `MAX_BLINK_DURATION_MS` does TWO jobs
and which one depends on `baseline_over_resting`, the same ratio the
validation round's fifth check measures. Below about 1.9 the ceiling is
pure cost, which is the state the Eyeblink8 clips are in and why the
replay saw a gain. Near 2.0 the blink line has climbed into the resting
eye's own wobble and the ceiling is the only thing keeping noise out of
the count, which is what #126 said. Above 2.0 the eye reads closed at
rest and nothing completes at all.

Setting the constant to 1000 turns exactly two tests red: the real blink
the replay wanted, and the phantom #126 warned about. The trade is one
command now instead of two documents.

Also found: #126's 0.2 mm dip is blocked by the ARM LINE, not by the
ceiling, so fix #114 already narrowed the ceiling's second job after
#126 was written. And the owner's five sessions exercised NEITHER job:
168 blinks, longest closed phase 333.6 ms against a 500 ceiling, ratios
1.12 to 1.41. The constant is deliberately unchanged; that is step 4 of
the issue's own order and it is the owner's.

**THE LIMITATION IS NOW STATED WHERE IT IS READ**, 18 August: a bullet
in README's "Honest limitations", a paragraph in MODEL_CARD's "Where it
fails", and MODEL_CARD's tested-on table corrected from "one laptop" to
three devices and five sessions. **D1 IS RE-SCOPED** in REMEDIATION.md
rather than rewritten: its original premise, a slow camera holding the
gate open, did not occur once in five real sessions, and stage two is
now "say something true about the processing rate when it is low enough
to be losing blinks". What it should say is undecided and is the
owner's.

**TWO THINGS CLOSED 18 August, both found by looking before sending.**

First, a hole in the pre-registration. Criterion 1 counted every session
that came back `missed`, with no requirement that its baseline worked.
The dry run proved that cuts both ways: P3 counted 10 of 10 BECAUSE its
ruler was 41 percent too long, a false pass, and the mirror case would
read a broken ruler as evidence against the detector. The plan's THIRD
dated correction fixes it: only sound sessions vote on criterion 1,
unsound ones are still reported in full and named as excluded, and if
more than half are excluded the criterion is not evaluated at all and
the round says something worse instead.

Second, there were NO participant instructions. The protocol lived only
inside the pre-registration, which is jargon. `docs/participant-
instructions.md` is now a document to paste into an email, shaped by
what the rehearsal broke: the order is the part people get wrong, phone
auto-lock kills the session, sitting still for the first 30 seconds is
what keeps the baseline honest, and the sleepiness question must be
answered or no file is written.

NEXT: the round goes out, to TWO people first rather than six, because
you can only ask each person once. The findings above make it MORE worth
running: the table already prints each person's processing rate beside
their count, and now their baseline ratio too. Still worth one honest
change to README and MODEL_CARD before sending, because the blink count
is now measured to depend on the viewer's machine and neither document
says so.

The August audit's ladder is closed. Stages A, B and C are complete; D1
stage two is the single remaining piece of real work and it is a WEBCAM
fix, not hardware preparation, because a 20 fps camera reads 70 today
and holds the 25 fps blink gate open in sessions that should be refused.
**The six session files are its blast radius measurement**: they carry
`camera_declared_fps` beside the processing rate, which is the evidence
D1 has been held for, so the round comes first and D1 follows it. Stage
E is complete apart from a repository setting. Stage F is complete or
declined. Stage G is complete apart from 8.8, declined. Stage H is
declined entire.

**The owner cut the backlog on 15 August.** Items that were tidying
rather than blocking are marked `- [~]` in REMEDIATION.md, which means
DECLINED, not pending. That marker exists because deferred items kept
coming back as findings in the next audit under a new number. Do not
reopen one without a reason that did not exist on 15 August.

Both licence and privacy questions are answered. The Eyeblink8 copyleft
question was put to the corpus authors and permission was granted; no
individual is named, at the owner's instruction. Both committed human
data fixtures are the owner's own face and own ratings, recorded in
MODEL_CARD.md and test/fixtures/README.md.

Issue #221 records the backwards model clock
found by B1's review.

**Both handoff files under-reported themselves until 15 August.**
REMEDIATION.md had not been touched since 12 August while three Stage E
items moved, and NEEDS-REVIEW.md still listed statements PR #248 had
already corrected. Both are now caught up, each item re-checked against
the repository or the GitHub API rather than against the previous
document. Doing that check found one thing the earlier reading had
wrong: PR #243 did not finish the account-name scrub, one memory
directory path survived in `docs/audit/appendix-chunk-1-all-findings.md`
and is neutralised now.

**14 to 15 August changed nothing on the remediation ladder.** Fifteen
pull requests merged (#234 to #248) and every one was dependencies or
documentation. Stage D stage two is still HELD and Stage E is still the
open path, exactly as the paragraph above says. Four things from that
run are worth knowing before you pick up the next increment:

- **Publishing was broken for about four hours and is fixed.** Two
  pushes to `main` failed at "Set up job" before any step ran, because
  the repository began requiring every action to be pinned to a full
  commit SHA and `upload-pages-artifact@v3.0.1` referenced a floating
  `actions/upload-artifact@v4` inside itself. #236 pinned it. **A
  settings change can break a workflow with no diff in the repository**
  — if a run dies at "Set up job", suspect policy before code.
- **The published page now says which commit built it.** #244 adds a
  `build-commit` meta tag, so `curl` on the live demo tells you the
  short SHA without needing repository access. Every deploy since has
  matched `main`.
- **Dependabot alerts are on and report zero**, and `npm audit` agrees.
  TypeScript 7 is ignored on purpose: `typescript-eslint` still caps at
  `<6.1.0`, so the bump cannot install. Delete the ignore when that cap
  lifts.
- **Three published statements were corrected**, in #246, #247 and
  #248. The last is the one that matters: `docs/evidence/2026-08-09`
  told readers `eyeblink8_misses.csv` was withheld on licence grounds
  when it has been committed since PR #200. **The licence question
  itself is still open** — `DATASETS.md` still says the copyleft "would
  need thought before publishing derived files" and that thought has
  not been done. Correcting what is true about the file is not a ruling
  on whether it should be there.

One method note from that run, because it caused the #247 defect. An
audit pass measured this repository against a local checkout nine
commits behind `origin/main`. The tree was clean, so it read as
current, and a live page contradicting a published document was
invisible from it. **A clean working tree is not a current one — fetch
before auditing.**

Stamped: 2 September 2026. When this file changes, this stamp changes
with it; a test enforces that.

## Where things stand, 10 August 2026

Track A is DONE and its number REPEATS. Track B, the sleepiness
question, has been measured once and its result IS published: a null
result, in README.md and docs/drozy-result.txt, merged as #201 on
10 August.

MERGED overnight: #194 the DROZY analysis code and its pre-registration
plus MODEL_CARD.md and ARCHITECTURE.md (roadmap 8.2 and 8.4 done), #196
the exclusion bias report, #197 the frame count guard (closed #193),
#198 the loud frame rate refusal (closed #192).

RESOLVED: the miss table rebuild first opened as #195 was re-opened as
#200 and MERGED on 10 August, moving the published miss figure from
78.6% to 72.0%. The headline recall, precision and F1 were untouched by
it. (#195 itself was closed unmerged after its branch was deleted too
early, which is why REMEDIATION.md now says merge before deleting.)

### The DROZY result, now published

DROZY is used under a written permission whose condition is that the
database and its paper are cited wherever results appear, in any form.
Cite: Massoz, Langohr, Francois and Verly, WACV 2016. (Added 2026-08-14
— this section printed DROZY figures without it.)

Measured, analysed, and published in this repository since 10 August:
the full table is in docs/drozy-result.txt and the write-up in
README.md. It is a null result: nothing survived the Holm correction.
It was held back briefly so the owner saw it first; that hold ended
with #201. The analysis is reproducible with:

    cd analysis
    PYTHONPATH="$PWD" .venv/bin/python tools/analyse_drozy.py \
        "$DATASETS/drozy-measured" <path-to-KSS.txt>

What can be said here without publishing the finding: 20 of 36 sessions
were analysable, and the plan in docs/drozy-analysis-plan.md was
committed before any correlation existed, so the result can be checked
against a plan that could not have been written to fit it.

THREE OF THE SEVEN ROWS WERE MEASURED BY CODE THAT HAS SINCE CHANGED.
The run is from 9 August, built from `bd2a98d`. PR #225 then clipped the
blink shape window on 12 August, which moves closing velocity, blink
amplitude and amplitude over velocity. Blink intervals re-measure byte
for byte identical, so blink duration, long closures, blink rate and
PERCLOS are unaffected, and Track A is untouched. Both `README.md` and
`docs/drozy-result.txt` now say so, and `tools/drozyGuard.mjs` requires
them to while `git log bd2a98d..HEAD -- src/core/blinkShape.ts` is
non-empty. Re-measure and update the "built from" line, and the
requirement lifts on its own.

THE EXCLUSION IS NOT RANDOM. DROZY's own README says the 15 fps
recordings are "tests 2 and 3 of subjects 1->8, because of a recording
bug occurring in darkness", and those are the sleep deprived sessions.
The excluded 16 average KSS 6.38 against 4.60 for the analysed 20, and
every KSS 9 sits in the excluded group. Any conclusion drawn from the
remainder is a conclusion about a sample missing the top of the scale.

The 16 cannot be recovered. DROZY carries no blink ground truth, its
manual and automatic annotations being 68 point face landmarks, and
recovering the sessions would mean lowering the 25 fps floor, which is
not on the table.

Derived DROZY video is DELETED per the DATASETS.md safeguard. Numbers
only remain, 692 KB. A re-run needs a re-extract and re-transcode from
DROZY.zip, about 8 minutes.

## The datasets folder

The corpus and the measurements are not in this repository. They sit in a
`datasets` folder beside the folder this repository was cloned into. Every
command on this page writes that folder as `$DATASETS`. Set it once per shell,
to wherever it is on your own machine:

    export DATASETS="/PATH/TO/datasets"

Check it before running anything else:

    ls "$DATASETS"

You should see `eyeblink8`, `eyeblink8-mp4` and six measured folders:
`eyeblink8-measured` (the first run, defective export),
`eyeblink8-measured-capfix` (export fixed, clock still wobbling),
`eyeblink8-measured-clockfix` (clock fixed, double counting exposed),
`eyeblink8-measured-refractory` (double counting cut, ruler still
moving), `eyeblink8-measured-frozen` (ruler frozen) and
`eyeblink8-measured-rearm` (CURRENT). If you do not, the
commands below will fail with
"No such file or directory", and the fix is this line, not the command.

(That listing describes the original machine, which is not physically
accessible for an extended period. A machine rebuilt from the public
download holds `eyeblink8` alone — with the flat `.mp4` copies inside
`$DATASETS/eyeblink8/eyeblink8`, built by the committed preparation
step in docs/eyeblink8-preparation.txt — plus whatever measured
folders it has generated itself.)

## Track A result, 21 August 2026, current

Eight Eyeblink8 clips, 408 human-marked blinks, 406 detected.

    Recall     83.6%   (341 of 408 found)
    Precision  84.0%   (65 invented)
    F1         83.8%

THIS NUMBER IS LOWER THAN THE 87.7% IT REPLACES, ON PURPOSE. The
previous run's ruler ROSE on every one of the eight clips, 2.3 to
37.6 percent, so its blink line grew more permissive as each clip
went on, and the validation round failed its baseline criterion on
exactly that behaviour. The ruler now freezes at its thirty-second
calibration (docs/baseline-freeze.txt, predictions committed before
the re-run; four held, the precision one was wrong and the record
says so). Verified from the run's own records: drift 0.0 on all
eight clips, birth values identical to the previous run's, so the
delta is the freeze and nothing else.

THIS ONE REPEATS, like the run it replaces: measuring one clip three
times produces identical files, byte for byte.

Five numbers have been published for this benchmark and all five
belong in the record:

    69.6% recall, F1 77.1   the export was deleting its own rows (#172)
    82.8% recall, F1 84.6   export fixed, clock still wobbled (#173)
    87.7% recall, F1 85.4   clock fixed (#189), double counting cut
                            (#190), ruler still moving
    83.6% recall, F1 82.5   ruler frozen at calibration (2026-08-20)
    83.6% recall, F1 83.8   re-arm gate (2026-08-21), 13 false alarms
                            removed at zero recall cost

Precision fell from 86.4% to 83.3% between the second and the third,
not a regression: the deterministic clock made the detector more
sensitive and the refractory period removed 39 false alarms at zero
recall cost. It fell again to 81.4% in the fourth, AGAINST the
committed prediction: at the frozen, lower line, near-line flutter
fragments into repeated crossings 200 to 400 ms apart, the same
re-crossing signature the round's P1 produced live, five of the six
new false alarms in one clip's flutter episode. The re-arm gate
(docs/blink-rearm.txt) then removed that signature by mechanism, 13
false alarms at zero recall cost, precision back up to 84.0.

Coverage: 71,356 frames measured against 71,354 annotated. Two clips
gave one frame more than their annotation file lists. Every other clip
is exact.

Measured from
`$DATASETS/eyeblink8-measured-rearm`.
All five earlier runs are kept for comparison beside it.
Full output in `docs/eyeblink8-result.txt`, written up in the README.

**This replaces a wrong number of 69.6% recall, 86.3% precision, 77.1%
F1**, which was written in a first draft that was never merged. The
cause was in this repository, not in the corpus. `BLINK_LOG_CAP` was 50.
It fed a fixed length list that threw away the OLDEST entry whenever a
new one arrived (a ring buffer). The same list was both the on screen
panel and the exported record, so the export inherited a display limit.
Three clips made more than 50 detections, so their opening stretches
were deleted before the file was written. That was 63 rows, and 54 of
the 63 were real blinks. Fixed in pull request #172. The cap is now two
caps:
`BLINK_LOG_DISPLAY_CAP` (50, panel only) and `BLINK_LOG_RECORD_CAP`
(20000, the record). The export prints a WARNING header line when rows
are missing. Two of those three clips moved 55.7% to 89.8% and 58.3% to
91.7%, which is 30 and 24 blinks recovered, 54 in total. That is the
entire move from 284 to 338. Every other clip found exactly the same
number of blinks in both runs.

CAVEAT when comparing the two runs. They were built from different
commits, so this is not one line changed. Four of the six shorter clips
shifted a blink edge by a frame or two, or split one detection into
two. Two report exactly the same blink timings. The cap counted
DETECTIONS, not annotated blinks, so it also bit `27122013_152435_cam`.
How many rows that clip lost cannot be recovered: the capped export is
the only surviving record of that run, and it holds fifty rows whatever
number was cut from the front of it. No recall figure changes either
way. (Until 2026-08-14 this said the clip "lost its first one" and that
the lost row was a false positive. README.md had already withdrawn that
as unrecoverable, so the two documents disagreed; README is the
corrected account.) The frame rate is not the cause either: `measured_fps` is 30.00 in both runs for all eight clips.
The recall attribution above is nevertheless exact. Fixing the cap also
surfaced 8 more invented blinks, 45 to 53, seven of them in the two
recovered clips.

The glasses claim from the first write up is WITHDRAWN, not reversed.
It rested on 83.7% for the one glasses clip against 67.9% for the seven
without, but both truncated clips sat in the group without glasses. The
split on the CURRENT run is 88.4% recall with glasses against 83.0%
without, and 88.4% precision with against 80.6% without. The glasses
clip now scores a few points higher on both, which
is the opposite of what the earlier run showed and just as meaningless.
One clip of 43 blinks settles nothing either way, so report BOTH halves
or neither.

What the audit established, so nobody argues it again:

- The corpus is not the problem. 787 lost frames across 174 gaps, and
  every one of the 8 clips loses some. STATE THE RULE WITH THE NUMBER,
  because publishing a number without its rule is what went wrong here.
  THE RULE. Read each clip's own `.txt` timestamp file. At 30 frames
  per second one frame lasts 0.033 seconds. Round every gap between two
  kept frames to a whole number of frame lengths. Anything above one is
  a lost frame. Checkable with `analysis/tools/audit_frame_loss.py`.
  787 of 71,354 frames is 1.10%, so say 1.1%. Earlier notes said 737
  frames and 1.011%; no single rule produces 737 together with "3
  clips", so both are retired. 12 gaps are half a second or longer,
  they sit in 3 clips, and they hold 611 of the 787. At the very most
  the lost frames explain 4 of the 70 misses — the second run's figure,
  not recomputed for the current run, which has 50 misses. A blink counts as touched
  when a gap falls anywhere from one frame before it starts to its last
  frame. In every frame the person faces the camera. No blink is
  shorter than 4 frames. Shrinking the video to a quarter of its size
  changed how strong a blink looks by 2.7%, so the picture is not too
  small.
- 36 of the 50 misses of the CURRENT run, 72.0%, contain at least one frame the
  human marked fully closed. That is the real weakness. An earlier note
  said 87.9%; that was 109 of 124, and 124 is the FIRST run's miss
  count, so it was measuring the defect. Recomputed on the corrected
  misses using `Blink.fully_closed_frames` from
  `analysis/blinklab/eyeblink8.py`. Rebuilt for the current run and
  committed row by row at docs/evidence/2026-08-09/tables-current-run/.
  Closes #179. Earlier figures were 87.9% (109 of 124, the FIRST run,
  measuring the export defect) and 78.6% (55 of 70, the second run).
- Double counting is PARTLY fixed, by the refractory period of #190. A
  closure is not counted if it ends within 150 ms of the previous
  counted blink, because an eyelid cannot open and shut twice that
  fast. That removed 39 false alarms and cost no recall. 72 remain, of
  which 45 still sit on a real blink under the strict rule and 61 are
  3 frames or shorter. Raising 150 would catch most of them and it
  STAYS at 150: a constant chosen to improve a score on a benchmark
  already read is fitting, not measuring. (The investigation this
  bullet asked for happened on 21 August: the re-arm gate,
  docs/blink-rearm.txt, removed the re-crossing class by mechanism.)
- Do NOT apply exclusions to flatter the score. Dropping long closures
  raises recall, dropping partial blinks raises it again, and one notch
  further you are deleting the blinks we missed. That last step shows
  where this reasoning ends up, and it is plainly cheating. The README
  prints none of those numbers, deliberately.

## If you are a fresh context, read this first

### The stale server trap, which cost a day

This is issue #175. Read it before any corpus run.

The corpus runner drives a preview server on port 4173. A LEFTOVER
server from an earlier run keeps that port and serves the OLD BUNDLE. A
bundle is the single JavaScript file the build produces, and its name
changes whenever the code changes.

Here is the trap, step by step.

- The leftover server is already holding port 4173.
- Your `npm run preview -- --strictPort` sees the port is taken, so it
  refuses to start and exits. That is what the flag is for.
- The leftover server is still there and still answering. So
  `curl http://localhost:4173/blinklab/` returns HTTP 200 (hypertext
  transfer protocol, and 200 is the code for success).
- The runner measures the old code for twenty minutes and hands you a
  confident, plausible, wrong number.

On 9 August this produced a fake result of 69.1% from code that had
already been fixed.

The check that catches it: after `npm run build`, compare the bundle
filename in `dist/assets` against the filename the server actually
serves, and REFUSE to measure on a mismatch.

    ls dist/assets/index-*.js
    curl -s http://localhost:4173/blinklab/ | grep -o 'index-[^"]*\.js'

Run both lines and read both answers. If the two names disagree, or if
the second line prints nothing at all, do not measure. Kill whatever
holds the port and start the preview again:

    lsof -ti tcp:4173 | xargs kill

Do this every time, not only when a number looks wrong. A stale bundle
does not announce itself, and the number it gives you is plausible. The
two run logs from that day are committed at
`docs/evidence/2026-08-09/run-logs/`. Open them side by side. One
measured the wrong code and one measured the right code, and nothing in
either file tells you which.

### Throughput, corrected

**About 58 frames per second. A full corpus run takes about 20
minutes, not 2.4 hours.** This file used to claim 8.4 frames per second
and a 2.4 hour run. That figure was measured on one clip under a
debugger and was roughly seven times too slow.

It mattered. It made the corpus look like an overnight job. It made
DROZY, the next dataset, look like a twenty hour one. The owner was
close to cutting down the whole evaluation plan around a cost that does
not exist.

The 58 figure is measured from the run's own file timestamps, not
back-solved from a guess. Clips 2 to 8 of the capfix run are 55,572
frames written between 09:51:36 and 10:07:30. That is 954 seconds and
58.25 frames per second. Per clip the rate runs 56.9 to 58.9. Check a
throughput figure against a real end to end run before planning around
it, and check it the same way:

    stat -f "%Sm %N" -t "%Y-%m-%d %H:%M:%S" <measured-dir>/*.blinks.csv

Do not conclude a run is stuck because nothing has appeared after a few
minutes. It writes nothing until a clip finishes, and the longest clip,
26122013_223310 at 15,784 frames, comes first.

### Checking and restarting a run

    ls "$DATASETS/<measured-dir>/"

It writes two CSVs per clip, `<name>.blinks.csv` and
`<name>.seconds.csv`, into that folder.

DO NOT read `/tmp/corpus.log`. This page used to point at it. That file
is the CONTAMINATED first run of 9 August, the one that measured the
stale bundle, so it describes a result the project has retracted. Give
every run its own new log file and put the time in the name. Both logs
from that day are committed at
`docs/evidence/2026-08-09/run-logs/`, and the corrected one is
`corpus-run-10-07-corrected.txt`.

A DEAD PREVIEW SERVER DOES NOT FAIL LOUDLY. This page used to say that
if the preview server died, the run failed and the log said so. That is
wrong, and believing it cost a day. What really happens is the stale
server trap above, which is issue #175: a leftover server holds port
4173, `npm run preview -- --strictPort` refuses to start and exits, and
curl to 4173 still answers HTTP 200 from the OLD server. So the run
does not fail. It finishes, and it measures the wrong code. The bundle
check above is the only thing that catches this. Run it every time.

If you want to know a run is alive, run one clip by hand and watch the
status line: it reports "Measuring every frame: N done, P% of the clip"
and updates twice a second.

To restart a run:

    npm run build
    npm run preview -- --strictPort &
    # Now do the bundle check above. Only if it agrees:
    node tools/measure_corpus.mjs \
      "$DATASETS/eyeblink8/eyeblink8" \
      "$DATASETS/eyeblink8-measured-$(date +%m%d)" \
      > "/tmp/corpus-$(date +%m%d-%H%M).log" 2>&1

Write every new run into a NEW dated folder. Never point this command
at a folder that already holds a published run: the four measured
folders listed under "The datasets folder" above are the evidence
behind published numbers,
and a restart aimed at one of them would overwrite it.

The build is on its OWN line on purpose. This page used to write
`npm run build && npm run preview -- --strictPort &`, where the `&`
backgrounds the WHOLE chain, build included. The shell then returns at
once, a failed build looks the same as a slow one, and you can start
measuring before anything has been built.

## How the Track A number is produced

    cd analysis
    PYTHONPATH="$PWD" .venv/bin/python tools/evaluate_eyeblink8.py \
      "$DATASETS/eyeblink8/eyeblink8" \
      "$DATASETS/eyeblink8-measured-rearm"

That prints recall, precision and F1 overall, then per clip, then split
by the glasses flag, then a coverage table. Read the coverage table
first: if measured frames and annotated frames disagree by more than
one percent on any clip, the numbers above it describe a different
recording and nothing else on the page can be trusted.

Use `.venv/bin/python -m pytest`, not `.venv/bin/pytest`. A folder
rename broke the console script shebangs.

For reference, what the script does under the hood:

1. Read each `<name>.blinks.csv` and turn `startFrame`/`endFrame` into
   `Interval` objects from `analysis/blinklab/blink_match.py`.
2. Read the matching `.tag` file with `load_annotation` from
   `analysis/blinklab/eyeblink8.py`. The corpus lives at
   `datasets/eyeblink8/eyeblink8/`, and `BLINKLAB_EYEBLINK8` points the
   tests at it.
3. `match_blinks` per clip, then `combine` across clips. Pool the
   COUNTS, never average the per-clip rates.
4. Report recall, precision and F1 overall, then per clip, then split
   by the glasses flag, because one clip is annotated for it. Read that
   split as one clip of 43 blinks and nothing more. It cannot support a
   claim about glasses in either direction.
   Ground truth totals to check against: 8 clips, 408 annotated blinks,
   71,354 frames.

## Rules that still apply

Never push to main. Branch, pull request, green CI (continuous
integration, the checks GitHub runs on every pull request), then merge.
Run every gate below before opening anything. CI enforces all of them,
so a gate you skip here fails there instead.

At the top of the repository:

    npm run lint
    npm run typecheck
    npm test
    npm run e2e
    npm run format:check
    npm run build

In `analysis/`, all three:

    .venv/bin/ruff check .
    .venv/bin/ruff format --check .
    .venv/bin/python -m pytest

This list is the same set the continuous integration workflow runs, and
it was checked against `.github/workflows/ci.yml` rather than
remembered. It used to be shorter than that workflow in three places,
which is the worst shape for a gate list to be in: you run everything
it says, you believe you are done, and the machine disagrees with you
afterwards.

`npm run format:check` is the one people forget. It runs Prettier over
the Markdown files as well as the code, and it failed on 9 August after
a paragraph was rewrapped. Prettier reads any line that starts with a
number and a full stop as a numbered list, so a line beginning "50."
turned a paragraph into a list and the check went red. Nobody had
changed a word. `npm run format` fixes it.

Known issues: #15 (actions majors), #90 (calibrated off screen
boundary), #108 (log.md backfill), #115
(depth-qualified closure episodes)

Test count: 800 unit tests, 20 end to end tests all run in Chromium
in CI of which 2 rerun locally in WebKit, 270 Python tests of which
2 skip

## DROZY, which is also ready

Downloaded and verified: `datasets/DROZY.zip`, 2,463,610,084 bytes, 36
videos plus `KSS.txt`. Permission granted in writing by Professor
Jacques Verly on 8 August 2026, and recorded the same way as the
UTA-RLDD one: who, when, and its scope, with the email kept privately
by the owner.

Only `KSS.txt` has been extracted so far, deliberately, to avoid
competing for disk with the corpus run. It is 14 rows of 3, one row per
subject, one column per test, KSS (Karolinska Sleepiness Scale) 1 to 9,
with `0` meaning the session never happened.

The DROZY arithmetic was rewritten with the corrected throughput. 36
clips of about ten minutes, at 30 frames per second, is roughly 648,000
frames. At about 58 frames per second that is roughly 3.1 hours, not
the twenty hours this file used to claim. Two minutes from each clip is
about 129,600 frames and roughly 37 minutes.

**Both figures assume DROZY runs at the same speed as Eyeblink8, and
that DROZY is 30 frames per second. Nobody has measured either one.
Measure a DROZY clip before planning around these numbers.**

Still prefer the two minute window, but for the right reason. The KSS
rating is a single number for the whole session, so a two minute window
carries exactly the same label as the full ten. The old reason, that a
full run costs a working day, was never true.
