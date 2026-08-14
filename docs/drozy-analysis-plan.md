# DROZY analysis plan, written before the answer was known

This document was written and committed **before any correlation between
a blinklab feature and a sleepiness rating had been computed**. That is
its whole purpose. Everything this project has published so far was a
measurement of blink detection, where the right answer already existed
in an annotation file. This is different: it asks whether the numbers
mean anything, and questions like that are easy to answer wrongly by
trying several things and reporting the one that worked.

The commit that adds this file contains no results. The results arrive
in a later commit, and can be checked against what is written here.

## The question

Do the per-second features blinklab already computes track how sleepy a
person said they were?

## The data

DROZY, University of Liege, used under written permission from Professor
Jacques Verly recorded in `DATASETS.md`. That permission's condition is
that the database and its paper are cited wherever results appear, in any
form. Cite: Massoz, Langohr, Francois and Verly, WACV 2016. (Citation
added 2026-08-14.) Each subject rated their own sleepiness on the
Karolinska Sleepiness Scale (KSS), 1 to 9, immediately before each
recording.

**20 sessions, not 36.** DROZY contains 16 recordings at 15 frames per
second, and blinklab refuses to measure blinks below 25 fps because at
that rate a 100 ms blink spans one and a half frames. Those 16 are
excluded, and the exclusion is a property of the frame rate alone, fixed
before any KSS value was consulted. See issue #192.

What survives: **20 sessions, 13 subjects, KSS 2 to 8.** Five subjects
have more than one usable session.

**The exclusion is not random with respect to the label, and this was
discovered after the plan was written.** DROZY's own README says the
15 fps recordings are "tests 2 and 3 of subjects 1->8, because of a
recording bug occurring in darkness". Tests 2 and 3 are the sleep
deprived ones. So the sessions this instrument cannot measure are
systematically the sleepier ones: the excluded 16 average **KSS 6.38**
against **4.60** for the analysed 20, a gap of 1.78 points, and every
KSS 9 in the dataset sits in the excluded group.

This is recorded here rather than quietly absorbed, because it changes
how the result must be read. A null result on this sample is a null
result on a set missing the top of the scale, which is weaker evidence
than a null result on the whole of it. The analysis prints this bias
above its own correlations so a reader meets it first.

Nothing about the plan was changed in response. The features, the
statistic, the correction, the controls and the decision rule are as
they were. Only the caveat is new.

Each session contributes one two minute window, seconds 60 to 180 of the
recording, transcoded to H.264 without resizing. The window is identical
for every subject, so recording length cannot masquerade as a signal.

## The features

Seven, all of them already computed by the app and exported per second.
No new measurement is invented for this analysis.

1. **Blink rate**, blinks per minute
2. **Blink duration**, mean closed phase in milliseconds
3. **Blink amplitude**, mean lid travel in millimetres
4. **Closing velocity**, mean peak speed in millimetres per second
5. **Amplitude over velocity**, mean ratio in milliseconds, the shape the
   literature associates with drowsiness
6. **PERCLOS**, mean share of the minute with eyes closed
7. **Long closures**, count of closures beyond half a second

## The tests, fixed in advance

**Primary.** Spearman rank correlation between each feature and KSS
across the 20 sessions. Rank based rather than linear, because KSS is an
ordinal scale and treating it as a distance is a claim nobody has earned.

**All seven are reported.** Not the best one. Seven tests on twenty
points will produce something that looks interesting by chance, so a
**Holm correction** is applied across the seven and both the raw and the
corrected p value are printed.

**Independence.** 20 sessions from 13 subjects are not 20 independent
observations. Five subjects have two or three usable sessions, so a
secondary check asks whether each feature moves in the same direction as
KSS _within_ a subject. A correlation across people that reverses inside
people is measuring people, not sleepiness.

**Negative control.** KSS labels are shuffled 1000 times with a fixed
seed and the whole analysis re-run. Any real effect must sit outside
that null distribution. This is roadmap row 7.7 and it is the check that
catches an analysis pipeline that would find a signal in noise.

## The decision rule, fixed in advance

A feature is reported as **tracking KSS** only if both hold:

1. Holm-corrected p below 0.05 on the primary test, and
2. the within-subject direction agrees with the across-subject direction
   for at least 3 of the 5 multi-session subjects.

Anything that passes one and fails the other is reported as **suggestive
and unconfirmed**, in those words.

If nothing passes, that is the result and it gets published exactly as
readily as a positive one would have been. **A null result here is
informative**: it would say that on 20 sessions this instrument's blink
features do not detectably track self-reported sleepiness, which is
worth knowing before building anything on the assumption that they do.

## What this cannot answer

- **Twenty sessions is small.** Absence of a correlation is not proof of
  absence, and a correlation that appears is not proof of much either.
- **KSS is self-reported.** People are poor judges of their own
  sleepiness, so the label carries its own noise, and no analysis can
  separate that from noise in the measurement.
- **This is correlation.** Nothing here establishes that a blink feature
  causes, predicts, or precedes anything.
- **These are two minute windows** from ten minute recordings under
  laboratory sleep deprivation. Nobody was driving, working, or tired for
  a reason of their own choosing.

## What would count as the analysis being wrong

Stated in advance so it can be checked later: if a later run with more
sessions, a different window, or a corrected frame rate floor reverses
any conclusion drawn here, that reversal belongs on the same page as the
original, in the same way the three Eyeblink8 numbers do.
