# ADR-0005: explainability keeps priority, and mobile is in scope

Status: accepted. Date: 2026-09-07.

## Context

Two lines in PROJECT.md had been under an open decision since 7
September 2026, when the first full read under that file's own stamp
found them. Neither was a defect in the code. Both were the file
describing a project that had moved.

**One: explainability against accuracy.** PROJECT.md says
"Explainability beats accuracy whenever the two compete", and its Non
goals repeat it: "Not optimised for accuracy over teachability. When a
simple explainable method and a complex accurate one compete, choose
the simple one and write down why." Roadmap amendment 16, accepted
5 September 2026, sets this era's goal as raising accuracy to the most
this class of hardware can deliver.

Those are not necessarily in conflict. Pursuing accuracy hard while
refusing an unexplainable method is a coherent position. The problem is
that nothing in the repository said so, so a reader met two sentences
pointing in different directions and no rule for the case where they
actually meet.

**Two: mobile.** PROJECT.md lists under Out of scope: "Mobile support,
until an ADR argues for it." The phone surface of roadmap row 14.0b is
merged. A 375-wide phone viewport runs in the end-to-end suite on every
pull request. MODEL_CARD's device list records that sessions behind the
published numbers came from phones, and the validation dry run's phone
out-resolved the DSLR rig. The ADR that this file's own wording
requires was never written, and the work shipped anyway.

A project that declares something out of scope while shipping it is
making exactly the kind of unchecked claim the rest of this repository
spends its guards preventing.

## Options considered

**On explainability:**

1. **Drop the priority; let accuracy lead the era.** Rejected. The
   priority is not decoration here, it is the reason the project's
   results can be argued with. Every constant is defended in a comment,
   every refusal is a named function, every published number is held to
   a file by a test. A model that improved recall and could not be
   interrogated would break the one property that makes this work worth
   reading.
2. **Keep the priority and say nothing more.** Rejected. That is the
   present state, and the present state is what left two sentences
   contradicting a third with no tie-break.
3. **Keep the priority and write the tie-break down.** Accepted.

**On mobile:**

1. **Remove the phone work to match the document.** Rejected. The phone
   is the first-named device class of the goal, a phone out-resolved the
   DSLR rig in this project's own dry run, and the surface is merged and
   tested. Deleting shipped, tested work to satisfy a stale line in a
   charter is the wrong direction of repair.
2. **Leave the line and treat it as dead.** Rejected. A false line in
   the file that says what the project is for is the most expensive
   false line available.
3. **Bring the document to what shipped.** Accepted.

## Decision

**Explainability keeps priority, and the tie-break is now stated.** An
accuracy gain is taken when it can be explained. An accuracy gain that
cannot be explained is recorded and not shipped: it goes into the
result files as a measured fact about what is possible, and it does not
go into the page or the score.

This is not new practice, it is existing practice given a rule. Roadmap
12.3 already frames the blendshape witness as a landmark-fed head over
mesh points rather than an appearance model, chosen that way so the
answer stays interrogable whichever way it comes out. Amendment 16's
"raise accuracy to the hardware's ceiling" is read as raising it
through instrument work — a corrected stepper, an honest frame driver,
a personal ruler — rather than through a method nobody can audit.

**Mobile is in scope, as a measurement surface.** The line moves out of
Out of scope. Capability remains per SETUP and not per device class,
which roadmap amendment 16 already settled and which the dry run
demanded: a phone that out-resolves a DSLR rig is not a lesser tier, it
is a different setup with its own measured numbers. No claim about a
device class follows from this decision, and none is made by it.

## Consequences

- Good: the file that says what this project is for now agrees with
  what it ships, which is the standard the rest of the repository is
  held to by test.
- Good: the case where the two priorities meet has an answer written
  before it arrives rather than after, which is the same discipline as
  committing a prediction before reading data.
- Good: roadmap row 10.0b, the last of the truth pass, can close. It
  was blocked on this decision and on nothing else.
- Bad: "recorded and not shipped" costs something real. If an
  unexplainable method turns out to be markedly better, this project
  will publish that it is better and still not use it. That is the
  price of the priority, and it is now explicit instead of implied.
- Bad: mobile in scope widens what validation has to cover. Phase 15's
  layers and row 13.1's session survival kit already assume phones, so
  the cost was being paid without the scope admitting it.
- Open: nothing. Both questions are answered. If the era's accuracy
  goal ever demands an unexplainable method, that is a new ADR
  superseding this one, not a reinterpretation of it.
