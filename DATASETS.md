# Datasets

This document records which public datasets blinklab may lawfully use for its
evaluation track, which it may not, and why. It exists because roadmap row 7.3
is a go or no-go gate: if no suitable openly licensed dataset exists, increments
7.4 through 7.7 get replanned before any of them starts.

The failures below are not padding. They are the point. A dataset that cannot be
used is as much a result as one that can, and writing them down means this search
never has to be repeated.

All checks were made on 2026-08-08 against primary sources: the dataset's own
page, its licence text, and where possible the live download itself.

## What counts as suitable

A dataset has to clear four bars, and all four are hard requirements rather than
preferences.

1. **Face video.** Frontal enough that both eyes are visible, at a frame rate
   that preserves blink dynamics. blinklab measures things that only exist over
   time: blink duration, closing velocity, PERCLOS, fixation. A still image has
   none of them. This rules out image-only sets no matter how well labelled.
2. **A drowsiness or sleepiness label.** Ideally the Karolinska Sleepiness Scale
   (KSS), a published one to nine self report scale. Failing that, a defensible
   alert versus drowsy annotation. Eye-state labels (open or closed) and yawn
   boxes are not drowsiness labels, because a classifier trained on them predicts
   eye state, and calling that drowsiness would be dishonest.
3. **Subject identity per clip.** Increment 7.6 requires a leave one subject out
   split, where no person appears in both training and test data. A dataset that
   does not say which clips came from the same person cannot support it, and
   without it the reported accuracy is inflated by the model recognising faces
   rather than sleepiness.
4. **A licence that permits this use.** This is the gate. blinklab is a public
   MIT-licensed repository maintained by a solo founder with no university
   affiliation and no institutional email address, and it is attached to a
   startup, so it cannot rely on a non-commercial or academic-only exemption.
   Derived numeric features and evaluation results would be published; video and
   frames never would be.

On requirement 4, two distinctions decided most of this search:

- **Downloadable is not the same as licensed.** Several datasets sit on an open
  link with terms that forbid the use anyway. Ease of access says nothing about
  permission.
- **"Available to researchers on request" is not open.** Where a request has to
  clear a human, or a form demands an institutional address, or an agreement has
  to be signed by a department head, a solo founder is excluded by construction.

## The gate result

**No dataset clears all four bars. On the question row 7.3 actually asks, the
answer is no.**

Everything with the right video and the right labels is either gated behind an
agreement a solo founder cannot sign, restricted to non-commercial use, or
carries no licence at all. Everything that is cleanly openly licensed is the
wrong kind of data: physiological traces, still images, synthetic renders, or
labels too sparse to train on.

That triggers the amendment clause: 7.4 through 7.7 are replanned before any of
them starts.

The replan is not a cancellation, because the search also found a defensible
path. It has two parts, and they are separate decisions.

**Part one, which needs no permission from anyone.** The blink-annotated GPL3
benchmark set (Eyeblink8 and its siblings) has ground-truth blink intervals and
downloads with no gate. Validating blink _detection_ against external
ground truth is a real, publishable result, and it is the one external check this
project can run today with nothing to ask and nobody to email. It does not need a
drowsiness label because it is not a drowsiness claim.

**Part two is now settled, and the answer is yes.** On 8 August 2026 the
maintainer emailed Professor Vassilis Athitsos, the senior author and
head of the lab that released UTA-RLDD, describing the exact proposed
use: compute per-second numeric features locally, publish only those
numbers and evaluation metrics, publish no frames or images of any
kind, keep subject identifiers pseudonymous, cite the CVPR Workshops
2019 paper, and disclose that the project is connected to a commercial
venture. He replied the same day granting permission to publish the
features and any associated results.

That reply is kept privately by the maintainer rather than reproduced
here. Permission to publish derived features is not permission to
publish someone's correspondence, and asking for one does not grant the
other.

What the permission does and does not change is worth being exact
about. It resolves the absence of a licence, which was the whole
objection: there is now an explicit grant from the rights holder for
this specific use. It does not dissolve the safeguards below, and they
stay in force, because the participants recorded themselves and the
terms they agreed to are published nowhere, so no author can grant
rights over a face beyond what its owner allowed. Numbers only, never a
frame, pseudonymous identifiers, source video deleted once features are
computed, and the 2019 paper cited prominently.

**The original counter-case, kept on the record.** UTA-RLDD is
the only dataset with the video, the labels and the subject identity this project
needs, and its problem is an absence of terms rather than a restriction. The
supporting evidence is unusually good for an unlicensed dataset: the authors call
it publicly available, host it ungated, ask only for citation, and themselves
publish derived numeric features from these exact videos under MIT. Using it
would mean publishing only numbers, never a frame, pseudonymous subject IDs,
deleting the source video after feature extraction, citing the 2019 paper, and
stating the licence gap plainly in this document rather than hiding it.

That is defensible. It is not clean, and no amount of care makes it clean. The
honest counter-case is that no licence means no granted permission, the consent
terms are unpublished, the copyright chain runs back to 60 individuals, and a
commercial context is less sympathetic than a university one. The realistic bad
outcome is not a lawsuit but a takedown request and public embarrassment on a
repository attached to a startup.

That counter-case was written before the permission arrived and is left
standing deliberately, because a decision that only records the
reasoning which supported it is not a record of a decision. The risk it
describes was real when it was written, and the permission is what
retired it.

The decision and its amendment are tracked in
[issue #142](https://github.com/heshipstech/blinklab/issues/142).

## The central finding

The openly licensed drowsiness datasets are the ones without video, and the
datasets with video are the ones that are gated or unlicensed.

That asymmetry held across every source searched. The most permissive licence
found anywhere in this sweep was CC0, on DD-Database, which contains EEG, EOG and
ECG traces and no video at all. The cleanest CC BY 4.0 licences sit on still
image collections labelled for eye state rather than drowsiness, with subject
identity deliberately stripped for anonymity. Meanwhile the video corpora that
carry real sleepiness labels are behind signed agreements, institutional email
checks, non-commercial clauses, or no licence at all.

The reason is not accidental. Face video is personal data, so the teams that
collect it under ethics approval restrict redistribution to keep their consent
promises. Anonymising the data enough to release it freely is exactly what
destroys the per-subject identity that requirement 3 needs. The two goals
genuinely conflict.

## Assessed and rejected

Grouped by the reason for rejection, because the reason is more useful than the
name.

### Blocked by a licence or an access gate

| Dataset           | Why it fails                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NTHU-DDD          | Signed licence agreement emailed to the lab, and the agreement must be signed by a department head or professor. A solo founder has neither. Also non-commercial.                                             |
| UL-DD             | Zenodo record displays CC BY 4.0, but access is restricted behind a separate Data Usage Agreement and an institutional or corporate research email, with stated auto-decline criteria. Files API returns 403. |
| mEBAL2            | Licence agreement must be printed, signed by hand, scanned and emailed with a postal address before any download.                                                                                             |
| ZJU Eyeblink      | Signed release agreement emailed for human approval, and the official page now returns 403 or 404. Effectively dead.                                                                                          |
| CEW               | Frictionless download, but the terms restrict use to researchers, forbid commercial use, and forbid redistributing even the link.                                                                             |
| RT-BENE / RT-GENE | CC BY-NC-SA 4.0, confirmed in Zenodo metadata. The NonCommercial term excludes a startup-attached project. Access itself is completely open, which makes the licence the only blocker.                        |
| DMD (Vicomtech)   | Sources conflict: a GitHub README carries an MIT badge while the distribution terms state academic purposes only, elsewhere CC BY-NC-ND. An unresolved conflict is not a permission.                          |
| HUST-LEBW         | Built from twenty commercial films, so third-party copyright sits on top of anything the authors could grant.                                                                                                 |
| SUST-DDD          | No LICENSE file, GitHub API reports no licence, and the Zenodo record commonly cited holds the paper rather than the videos.                                                                                  |
| MRL Eye Dataset   | No licence text of any kind on the official page. Also still images of cropped eyes.                                                                                                                          |
| YawDD             | No dataset licence field on IEEE DataPort, plus a participants information file suggesting consent limits. Labels are yawns, not drowsiness.                                                                  |
| 3MDAD             | No licence stated on the authors' pages or in accessible paper metadata.                                                                                                                                      |

### Wrong data, however good the licence

| Dataset                           | Licence                                             | Why it fails                                                                                                                                                                                                                                          |
| --------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DD-Database                       | CC0, the most permissive found anywhere             | EEG, EOG and ECG only. No video, no images.                                                                                                                                                                                                           |
| Raspberry Pi 5 drowsiness dataset | CC BY 4.0, genuinely open                           | Still images sampled to roughly 6 fps, which destroys blink dynamics. Labels are eye state and yawn. Subject identity stripped by anonymisation, so no leave one subject out.                                                                         |
| DrowsyFace Profiles               | CC BY 4.0                                           | Still images. No documented subject identity.                                                                                                                                                                                                         |
| UIBVFED Physical States           | CC BY 4.0                                           | Synthetic renders of virtual characters with acted sleepiness expressions. Encodes an artist's idea of sleepiness, not real blink timing.                                                                                                             |
| FL3D                              | Claimed CC BY-SA 4.0                                | Frames extracted from NITYMED, and a NoDerivatives source cannot yield a ShareAlike derivative, so the licence chain does not hold. Separately, frames containing blinks were deliberately removed, which deletes the exact signal blinklab measures. |
| DriverMVT                         | CC BY 4.0, clean licence, driver identity confirmed | Label density. Only 381 of 1464 metadata files carry the state column, and in a sampled 60 of those, drowsiness appeared in 18 rows out of 22,254, all from a single driver. Roughly 0.08 percent, concentrated in one person.                        |

## The three finalists

These three got a second, adversarial pass, because the first sweep returned
contradictory answers about them.

### DROZY, University of Liege

The best labels in existence for this problem, and unusable.

DROZY is the only candidate carrying **real KSS**, one to nine, self reported by
the subject immediately before each ten minute test. Fourteen subjects, three
tests each under increasing sleep deprivation, near-infrared video at 512 by 424,
subject identity in every filename. About 36 session-level KSS labels in total.

Its licence agreement of 18 July 2018 was read in full from the primary PDF. Two
things commonly assumed about it are wrong, and one thing decides it.

- Term 3, "the User cannot modify the database in any way", does **not** forbid
  computing features. The object of the verb is the corpus, which stays
  bit-identical. Term 8 confirms this by requiring citation for results "obtained
  by using in any way" the database, which a licence forbidding computation could
  not coherently do.
- Term 2, no redistribution "in full or in part", does **not** make published
  aggregate metrics a breach. A scalar is not recoverable database content.
- Term 4 is the blocker: "The Users can use the database for research and
  evaluation purposes only. Specifically, the Users cannot use the database for
  any commercial developments." There is no academic affiliation requirement
  anywhere in the agreement, so being unaffiliated is fine. But this project is
  the technical core of a startup and is published under MIT, which grants
  everyone downstream commercial use, the exact opposite of what term 4 reserves.

Term 4 gates use of the database at all, so the harmlessness of the outputs does
not cure it. The agreement is governed by Belgian law, and the EU text and data
mining exceptions do not help: the research exception in the 2019 Copyright in
the Digital Single Market Directive is limited to research organisations, and the
general exception applies only where rights have not been expressly reserved.

DROZY is not closed forever. Term 2 shows ULg-INTELSIG grants written approvals,
so a written permission would settle it. Without one, DROZY-derived results do
not belong in a public repository.

### NITYMED, University of the Peloponnese

Real in-car night video, and it fails on subject identity rather than on licence.

130 clips at 25 fps of 21 drivers, split into a Yawning folder and a Microsleep
folder. Downloadable today with no gate at all from the authors' own Kaggle
deposit, which was confirmed by an anonymous ranged request that returned real
zip bytes with no login challenge.

Its licence is genuinely contradictory, and both statements are first party:

- The authors' lab page links the CC BY 4.0 deed, with no NoDerivatives term.
- The authors' own Kaggle deposit declares CC BY-ND 4.0. This is not a third
  party mirror getting it wrong: the uploader account is the rights holder, and
  the authors' own citation list names that Kaggle DOI as citable release four.

Both statements have been stable for over three years. There is no tie-breaker,
so the operative licence is genuinely unresolved.

That matters less than it first appears, for two reasons. NoDerivatives is not
NonCommercial, so neither reading blocks commercial use. And per-second numeric
features are most plausibly new factual measurements rather than adapted
material, which under CC BY-ND 4.0 section 2(a)(1) is the thing that may not be
shared. So the licence conflict is probably survivable either way.

What actually rules NITYMED out is requirement 3. The released directory
structure is behaviour, then gender, then resolution. It is **not** organised per
driver, and per-clip driver identity is not recoverable from the released files.
Leave one subject out is impossible, so 7.6 cannot be built on it. The labels are
also behaviour categories rather than a sleepiness rating, so a classifier
trained on it honestly predicts "yawn clip versus microsleep clip".

### UTA-RLDD, University of Texas at Arlington

The best data by a wide margin, with no licence at all.

180 RGB videos of about ten minutes each, 60 subjects, three videos per subject,
111 GB. Labels are three classes derived from KSS: alert, low vigilant, drowsy,
where participants were shown the KSS table and told alert means KSS 1 to 3 and
drowsy means KSS 8 to 9. Subject identity is explicit and was confirmed by
reading the zip local headers, which are structured fold, subject, label. It
downloads with no account, no form and no approval, confirmed by a live ranged
request.

It clears requirements 1, 2 and 3 outright. On requirement 4 it does not fail so
much as fall outside the question: **there is no licence to fail.** This was
checked exhaustively and the absence is stable, not an oversight in the making.
The live site, the full Wayback history back to the earliest 2021 capture, the
Google Drive folder listing, the original UTA Apache index from 2022, and the
paper itself contain no licence, no terms of use, no EULA and no restriction on
commercial use. The only stated conditions are a citation request and a rule
about identity.

No licence means all rights reserved by default. Against that sit several facts
from primary sources, all pointing one way:

- The paper calls it "a new and publicly available real-life drowsiness dataset".
- It is hosted ungated and has been for five years.
- The only thing asked in return is citation.
- Most importantly, **the original authors themselves publish derived numeric
  features from these exact videos**, in a public repository, under MIT. The
  repository `rezaghoddoosian/Early-Drowsiness-Detection` contains around 46 MB
  of per-blink feature arrays computed from UTA-RLDD, under a licence that
  expressly permits commercial use and sublicensing.

That last point is the crux. The proposed Phase 7 artefact is the same class of
thing the dataset's own creators already published openly and permissively.

**Written permission was granted on 8 August 2026** by Professor Vassilis
Athitsos, the senior author, for exactly the use proposed here: publishing
derived numeric features and evaluation results. The absence of a licence is
therefore no longer the obstacle it was.

One honest complication survives that permission. The videos were self-recorded
by each participant on their own phone, so first-instance copyright vested in
the participants, and the lab's rights came through a consent form whose terms
are not published anywhere. No author can grant rights over a face beyond what
its owner allowed, which is why the safeguards below are not relaxed. Separately, the site states that only 36 of 60
participants agreed to have their faces published, and the mapping is not
released, so **no frame from this dataset may ever be published**.

### The exposure that is not about copyright

Across all three finalists the larger risk is data protection rather than
licensing, and it sits in a different place than expected.

Holding 111 GB of identifiable faces is the high-exposure step, and it happens
locally. What gets published is low exposure: numbers keyed to subject IDs that
were never mapped to names, because the identities are not distributed at all.
That asymmetry suggests the mitigation directly. Compute features, publish only
numbers, never publish a frame, keep subject IDs pseudonymous, and delete the
source video once the features exist.

### Blink-annotated, no drowsiness label

The Fogelton and Benesova benchmark set (Eyeblink8, TalkingFace, Researcher's
Night, ZJU annotations, Silesian5) is stated GPL3 and downloads directly with no
gate. It carries per-frame blink interval annotation but no sleepiness label of
any kind, so it cannot support 7.5 through 7.7.

It is worth keeping in view for a different job. Validating blink _detection_
against ground-truth blink intervals is a real result, and it is the one thing
this project could check against external data without a drowsiness label at all.
GPL3 on video data is legally unusual and its copyleft would need thought before
publishing derived files, so this is recorded as an option rather than a plan.

## What was not verified

Recorded so that a later reader knows where the holes are rather than assuming
there are none.

- **Inside the UTA-RLDD archives.** The ten zip files are 7.5 to 13 GB each,
  behind Google Drive's large-file confirmation flow, so no partial read was
  possible. A LICENSE or README inside one of them would be invisible to every
  check made here. Both distribution points present bare zips with no
  accompanying text, so this is unlikely, but it is untested. Downloading one
  fold and listing the archive root would close it cheaply.
- **The NITYMED access form.** The lab site asks for a name, affiliation and a
  business or academic email. That is what the page states; whether a personal
  address is actually rejected was not tested, because submitting the form would
  send personal data to a third party.
- **Inside the NITYMED archive.** An in-archive licence file could resolve the CC
  BY versus CC BY-ND conflict. The public file tree shows only two top-level
  folders with no README, but the archive itself was not opened.
- **The UTA-RLDD consent form.** Its terms are published nowhere: not on the
  site, not in the paper, not in any archive snapshot. This is the largest single
  unknown, and it is unknowable from outside. It means nobody, including the
  authors, can state with certainty what the participants agreed to.
- **Legal conclusions generally.** Every reading above is reasoning from primary
  licence text by a non-lawyer. The licence text is verified. The conclusions
  drawn from it are argued, not authoritative.

## How this search was done

Eleven agents in two passes. The first swept five angles in parallel: the classic
driver drowsiness corpora, the driver-facing alternatives, blink-annotated sets
as a fallback, the open dataset hosts (Zenodo, Figshare, OSF, Hugging Face,
Kaggle, PhysioNet, IEEE DataPort), and a deliberate what-if-this-fails branch.
That produced roughly forty assessments and three direct contradictions between
agents.

The second pass was adversarial and existed only to settle those contradictions:
one agent arguing that NITYMED is CC BY, another arguing the NoDerivatives term
binds, one testing access and subject identity empirically, one hunting for a
UTA-RLDD licence anywhere in five years of history, one reading DROZY's nine
terms against this project's exact facts, and one asked to build the strongest
honest case for using an unlicensed dataset.

Two habits did the real work and are worth repeating. Licences were read from the
primary document rather than from summaries, which is how the DROZY reading was
corrected: terms 2 and 3 are widely assumed to be the obstacles and neither is.
And download links were exercised rather than trusted, which is how three
distribution channels for NITYMED with three different gates were separated, and
how the UTA-RLDD subject structure was confirmed from zip headers without
downloading 111 GB.
