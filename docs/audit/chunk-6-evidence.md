# Chunk 6: published claims against evidence

Part of the August 2026 audit. See `AUDIT_PLAN.md` for scope and method.

Covers E8: every quantitative claim in `README.md`, `STATE.md`,
`MODEL_CARD.md` and `ARCHITECTURE.md`, traced to a file under
`docs/evidence/` or declared unsupported.

Completed 10 August 2026. Findings below are final for this chunk.

---

## Method

Run **lean**, four auditors and four skeptics rather than six and eight,
because the weekly usage budget was at 88 per cent and Chunk 7 is the
deliverable. Chunk 4 had already done the expensive half of this work by
reproducing the headline from an independent reimplementation.

Every discrepancy had to be classified as one of four things, because
this project **deliberately publishes superseded numbers** and a
difference is not automatically a defect:

- **deliberate-history**: labelled, reader knows which is current. This
  is the design working, and it counts as compliance.
- **stale**: not updated when a number moved, unlabelled.
- **contradiction**: two live claims that cannot both be true.
- **unsupported**: no evidence file anywhere.

**48 findings: 27 stale, 13 contradictions, 8 unsupported. Four tested,
three survived, one refuted.**

Because the verification was deliberately shallow, **most findings in
this chunk are untested.** They are individually well-evidenced, with
file, line and recomputed value, but the refutation rate across this
audit has been 61 per cent and that should temper how they are read.

---

## Headline

**The numbers are right. The prose around them is stale.**

184 distinct claims were enumerated across the four documents. 133 traced
cleanly. The headline recall, precision, F1, frame accounting, every
DROZY correlation, the resolution check and all four externally computed
F1 comparisons re-derive exactly.

What is wrong is almost entirely the sentences: paragraphs written for
one run and never updated when the run changed underneath them.

---

## The five that matter

### 1. The published reproduction command reproduces the wrong number

**High. Verified by execution.** (contradiction)

`STATE.md:303-308`, under the heading "How the Track A number is
produced", gives a command. A skeptic ran it. It prints:

> Recall 82.8% (338 of 408 found)

The headline is **87.7 per cent**. The command still points at the
retired `-capfix` dataset directory.

Anyone following your own instructions to check your own headline gets a
different number and no explanation.

### 2. The paragraph that withdraws a claim uses the withdrawn run to do it

**Critical as filed, untested.** (contradiction)

`README.md:243-247` says _"On the corrected run the glasses clip scores
83.7% recall and 83.7% precision. The seven without score 82.7% recall
and 86.8% precision."_

Those are the **superseded** run's figures, at
`docs/eyeblink8-result.txt:95`. The corrected run gives 88.4 and 88.4 for
the glasses clip, and 87.7 recall with 82.7 precision for the rest.

Three things compound:

- The paragraph exists to **withdraw** a claim about glasses, and it
  withdraws it using the very run it says was defective.
- 82.7 is presented as the without-glasses **recall**. It is that group's
  **precision**.
- Under the real corrected run the glasses clip is higher on **both**
  measures, so the paragraph's stated conclusion is backwards.

`STATE.md:139-142` has the correct figures. `README.md` is the document a
stranger reads first.

### 3. The refractory period is described as built and as not built

**High. Verified.** (contradiction)

`README.md:296-317` describes it built at 150 ms, says it removed 39
false alarms, and defends the value across three paragraphs ending "It
stays at 150."

`README.md:328-330`, twenty-eight lines later, says it _"is planned and
it is not built"_.

Neither is labelled. The code is built.

### 4. A citation that a careful reader would trust and should not

**High, untested.** (unsupported)

`README.md:330-333` says _"The script behind all of these counts"_ is
`false_positive_overlap.py`, with its output at
`tables/false_positive_overlap.txt`.

That file says **45 of 53** under the tolerance rule. `README.md:276`
publishes **45 of 72** under the strict rule. Different run, different
rule, same digits.

A reader checking the citation finds a matching 45 and concludes the
claim is sourced. It is not. The auditor ran the script and confirmed the
saved output is the second run's, faithfully.

This is the exact trap `docs/evidence/2026-08-09/README.md:82-90` warns
about, for a different number.

Two further counts in the same section, "8 of the 53" and "41 of the 53",
sit under a headline of 72. The true figure is **61 of 72**. The 8 is
right by coincidence.

### 5. `STATE.md` says the sleepiness result is not in this repository

**High. Verified.** (contradiction)

`STATE.md:22` heads a section "The DROZY result, held deliberately" and
`:24` says _"Measured, analysed, and NOT in this repository."_

`docs/drozy-result.txt` is tracked in git, and `README.md:355-432`
publishes the whole result, opening with a statement that it **is**
published.

---

## The refutation worth reading

**"`MODEL_CARD.md` says the DROZY results are unpublished."** →
**low, refuted as a contradiction.**

`MODEL_CARD.md:6-7` carries an explicit stamp above every claim:
_"Written 9 August 2026 against the state of `main` on that date."_ Git
confirms it last changed at 23:42 on 9 August; `docs/drozy-result.txt`
landed at 09:03 the next morning.

**It was true when written.** A dated snapshot whose pointer list is nine
hours behind is a different thing from a live contradiction, and the
stamp is what makes it so.

That stamp is worth noticing as a technique. It is the cheapest possible
defence against exactly this class of finding, and `README.md` and
`STATE.md` do not have one.

---

## Other findings worth carrying, all untested

- **The miss table withheld on licence grounds is committed.** Two live
  documents state the withholding rule, including the reason that "git
  keeps every file forever". A third directory,
  `tables-current-run/eyeblink8_misses.csv`, contains exactly the five
  fields named as the problem. Either the rule is retired in writing or
  the file comes out.
- **Seven of the twenty evidence scripts cannot run.** `exp.py` through
  `exp6.py` and `verify.py` die on a missing `traces/` directory that was
  excluded on purpose for its size. The whole threshold sweep behind
  issue #178 exists only as prose in a finding page.
- **The browser-agreement table has no evidence anywhere.** Nine
  published numbers, presented as an answer to "does it give the same
  answer twice", resting on no saved export.
- **The frame-loss audit publishes five counts with no saved output.**
- **Three documents give three different unit-test counts, and none
  matches the suite.** `README.md` is 31 short, `STATE.md` two revisions
  behind, `ARCHITECTURE.md` a third value.
- **The evidence index never mentions `tables-current-run/`**, the one
  directory the live headline rests on, and calls the 53-alarm file "the
  corrected run".
- **`ARCHITECTURE.md`'s two-browser claim is true locally only.**
  Continuous integration runs Chromium alone.

---

## What is compliant

- **97 numbers checked in `README.md`. 63 traced cleanly**, 17 more are
  external facts that cannot be checked offline.
- **87 checked across the other three documents. 70 traced cleanly.**
- **The three-column recall history is exemplary.** Columns headed "First
  answer / Export fixed / Now", the current column bolded on all four
  rows, a bold statement that three columns exist because the page got it
  wrong twice, and each column given its own bullet naming its defect and
  its pull request. All twelve cells match the result file. All four F1
  values re-derive.
- **Every DROZY number matches** `docs/drozy-result.txt`: the seven
  correlations, the exclusion bias table, the shuffled control, the
  frame-rate floor.
- **The current-run false-alarm counts DO have a saved evidence file.**
  Recomputed from `tables-current-run/`: 45 under the strict rule, 64
  under the four-frame rule. The claim is right; only the citation points
  at the wrong file.
- **The 72.0 per cent miss pattern re-derives**, and the retired 78.6 per
  cent is correctly labelled in `README.md` as an earlier version's
  figure with its own denominator shown.
- **The resolution check traces line by line**, including the +2.71 per
  cent figure and the five-up two-down one-flat split.
- **All four external F1 comparisons re-derive** from the precision and
  recall printed beside them, and the page names which figures were read
  first hand, which came second hand, and lists four ways the scoring
  rules differ before drawing a conclusion.
- Frame accounting is internally exact, and the two clips that are one
  frame over are identified.
- Small arithmetic holds throughout: 787 of 71,354 is 1.1 per cent, four
  frames is about 130 ms at 30 fps, 45 plus 8 is 53.

---

## What could not be checked

- Anything needing the Eyeblink8 corpus itself, which is not in the
  repository by design: the 70,992 annotated rows, the 787 lost frames,
  and the claims about every clip.
- External published figures from other papers, cited well enough for a
  reader to check but not checkable offline.
- The second run's per-clip figures, which are saved nowhere.
- Whether the browser-agreement table's PERCLOS peak is internally
  consistent, with no saved export to check against.

---

## Carried into the final report

1. **The instrument is honest; the prose has rotted.** Every headline
   number is right and reproducible. What has decayed is the sentences
   around them, and there are enough of them that a careful reader would
   lose confidence before reaching the good part.
2. **The reproduction command is the worst of them**, because it invites
   a reader to check and then hands them a different number.
3. **The withdrawn-glasses paragraph is the most embarrassing**, because
   it uses the defective run to withdraw a claim about the defective run,
   and gets the direction backwards.
4. **The dated stamp in `MODEL_CARD.md` is the fix for most of this
   chunk.** It converted what would have been a contradiction into a
   correctly-scoped snapshot. `README.md` and `STATE.md` need one, or
   they need to be kept current.
5. **Evidence that cannot be re-run is not evidence.** Seven of twenty
   scripts are dead, and the numbers they produced now exist only as
   prose.
