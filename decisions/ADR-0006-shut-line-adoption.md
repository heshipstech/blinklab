# ADR-0006: the shut line goes personal when a guided line exists

Status: accepted. Date: 2026-09-12.

## Context

Two consumers of "eyes shut" — PERCLOS and the long-closure detector —
draw one shared line at `EYES_SHUT_FRACTION` (0.4) times
`shutBaselineMm`, the aperture baseline frozen at first ready
(`src/core/longClosure.ts`, `src/core/perclos.ts`). That is a
population fraction applied to an open-eye statistic: no committed
measurement has ever checked that 40 percent of a frozen baseline is
where a given person's shut eye lives. Meanwhile the guided
calibration measures exactly that — the person's own closed median —
and only the blink line uses it. The September audit's ladder carries
the cost as item A9 (findings F-005, F-030): a face whose true floor
sits above the population line reads PERCLOS 0 forever while its own
measured floor sits unused, and the dry run's P80 phone trace is the
recorded suspect for that shape.

The export already reserved the slot: `shutLineMm` and
`shutLineSource` ride every per-second row, with `shutLineSource`
reading "none" or "passive" today and the comment noting that no
guided line serves the shut baseline yet (SPEC.md's record block).

## Options considered

1. **Keep the population rule everywhere.** Rejected: it is the
   documented mis-ruler A9 names, and the instrument already holds the
   personal measurement it declines to use.
2. **Fit a per-session shut line to each session's own data.**
   Rejected: a line fitted to the session it judges is the moving
   ruler this project rejected when it froze the baseline.
3. **Adopt a personal shut line, placed by a pre-registered rule,
   when and only when a guided calibration exists.** Accepted.

## Decision

When a session has a guided line, the shut line becomes personal, in
the same form the blink line already uses and under the rule
pre-registered before any retained column was read for the question
(`docs/shut-line-rule.txt`, roadmap 12.0a): both lines are
`closed + k x (open - closed)`, the blink line at k = 0.5 (today's
midpoint, restated), the shut line at k = 0.15 with an adoption
margin — the personal shut line is used only when 0.15 x the
open-to-closed span clears 0.6 mm, twice the worst committed per-eye
p95 of the 10.7a noise floor. A session that fails the margin keeps
the population rule, and `shutLineSource` says which rule ran either
way. Adoption lifts the PERCLOS and long-closure baseline-refusal
exactly as a guided line lifts it for blinks. No guided line, no
change; a clip never has a stored line by construction.

This ADR records the DECISION and its rule. The rule's scoring — the
owner's recorded droop session through both placements, the
floor-shift comparison over the retained dry-run exports, the P80
trace's PERCLOS under its own floor, and Eyeblink8 predicted
unchanged — belongs to roadmap 12.0a and is published there whichever
way it lands. If the scoring falsifies the rule, the adoption does
not proceed as written and the outcome section of
`docs/shut-line-rule.txt` says what happened; this ADR is then
superseded by its successor rather than edited, the ADR-0002/0004
convention.

## Consequences

- Good: one person, one ruler — the two watchers of "shut" read the
  person's own measured floor instead of a one-face fraction, on the
  same condition the blink line already honours.
- Good: the export can no longer be ambiguous about which rule ran:
  `shutLineMm`/`shutLineSource` carry the line and its source per row,
  and the two duration quantities are named in SPEC.md and
  MODEL_CARD.md (roadmap 12.0b), so a cross-session comparison knows
  what it is conditioning on.
- Bad: PERCLOS and long-closure numbers become line-conditioned across
  sessions the way blink durations already are — a session measured
  under the personal rule is not directly comparable to one measured
  under the population rule. Recorded as the price of measuring
  people with their own ruler.
- Bad: sessions without a guided calibration keep the known mis-ruler,
  and the record says so rather than pretending the fix reaches them.
- Open: the rule is committed and unscored until the owner's droop
  session and the retained-export comparison run. Until then no
  sentence in this repository claims the personal shut line improves
  anything; it claims only that the rule was fixed before the data
  was read.
