# CLAUDE.md

Standing instructions for the agent working this repository. This file
is the ritual's memory: the owner's process directives live here so a
fresh session starts already knowing them, instead of re-learning them
from the transcript of the last one.

## The increment ritual (owner directive, 15 September 2026)

**Work in the smallest increments possible, and push and merge each one
to GitHub as soon as it is green.** A granular history of merges is a
goal in itself, not a by-product: many small merged PRs beat one large
one, every day.

The loop, per increment:

1. Make the smallest coherent change the guards allow (see the floor
   below).
2. Run the light gates: `npx prettier --check .`, `npx tsc --noEmit`,
   `npx eslint src test tools`, the touched test files, and
   `npm run counts:check` when a test was added or removed.
3. Commit with a subject that names the roadmap row and the slice.
4. Push to `claude/state-md-review-test-tmhlhh`, open a PR against
   `main`, and merge it the moment CI is green (rebase merge, full
   40-character head sha).
5. Reset the branch onto the new main
   (`git checkout -B <branch> origin/main` and force-push with lease)
   and start the next increment.

One branch, one open PR at a time: the next increment starts only after
the previous one merges.

**CI is watched on a ~5-minute cadence** (owner directive, 15 September
2026): after pushing a PR, arm a check-in at +5 minutes; while CI is
still running, each check-in re-arms itself at +5; merge the moment it
is green. Never one long timer per cycle — the merge should land within
minutes of CI finishing, not whenever a generous timer happens to fire.

**Maximise the contribution yield of every increment** (owner
directive, 15 September 2026). A rebase merge lands every commit of a
PR on `main`, and each authored commit there counts, so an increment is
split into as many honest, coherent commits as it naturally divides
into — the pure module, its tests, the SPEC/contract rows, the docs and
count cascade — each with its own real subject, all in the one PR. Only
the PR head must pass the guards; the intermediate commits need only be
honest. Merges stay rebase (a merge commit would add one count but
break the linear history the guards and branch resets lean on), and an
issue is filed when a real follow-up exists — never to farm the graph.

## The floor under "smallest"

An increment cannot be smaller than what the guards hold together in
one commit. The known atoms:

- **A new export key** must land with its SPEC.md table row, the Python
  contract list entry (`analysis/tests/test_metadata_contract.py`), the
  presence classification (`test/core/metadataPresence.test.ts` when the
  key is emitted by the assembled export), regenerated verdict fixtures
  when the fixtures' sessions emit it, and a unit test — the
  `metadataKeys`/presence/fixture guards refuse any partial landing.
- **A touch to any `DETECTOR_SOURCES` file** (`tools/detectorRatchet.mjs`)
  must land with a dated `DETECTOR CHANGED, not yet re-measured` caveat
  in `docs/eyeblink8-result.txt` naming the commit — by its exact
  subject line, because rebase merges rewrite shas. The ratchet reads
  COMMITTED history, so run `test/tools/detectorRatchet.test.ts` after
  committing, not before.
- **A test-count change** moves five places together:
  `test/collected-tests.txt`, README.md's and ARCHITECTURE.md's "N unit
  tests" sentences, STATE.md's current-entry footer, and
  `node tools/writeStatusBlock.mjs`.
- **A `src/` change** needs a LEARNING.md entry in the same PR.
- **README.md, STATE.md and MODEL_CARD.md are stamped**: if one changes,
  its stamp must be within two days of the commit date, so a cascade
  that touches them on a stale stamp also bumps the stamp.

## Standing scope rules

- Merge on green without waiting for the owner; report, don't ask,
  unless the work needs owner hardware, owner data, an owner signature,
  or a genuine design fork the owner has asked to steer.
- Never reuse the user-placed `sessionMarkers` stream for anything but
  the person's own marks: its entries are the validation protocol's
  ground truth.
- e2e inside the container is unreliable; CI's Chromium run is the
  arbiter. Do not block an increment on a local e2e pass.
