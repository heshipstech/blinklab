import type { Contribution, ScoreBreakdown } from "./score";

// The contribution panel: the arithmetic behind the score, shown
// rather than hidden. 6.5 made the score an exact sum of named
// parts; this turns "you scored 72" into "you scored 72 BECAUSE of
// these three things", which is the whole explainability promise
// made visible. Presentation only: it computes nothing, it selects
// and phrases what the scorer already decided.
export const PANEL_DRIVER_LIMIT = 3;

// The drivers worth naming: signals that actually cost points, the
// biggest first. A signal that cost nothing drove nothing, and an
// unavailable signal has no points to attribute, so neither appears.
// Ties break by the scorer's own declaration order rather than by
// name or by chance, so two equal drivers cannot swap places from
// one second to the next and make the panel flicker.
export function topDrivers(
  breakdown: ScoreBreakdown,
  limit: number = PANEL_DRIVER_LIMIT,
): Contribution[] {
  return breakdown.contributions
    .map((contribution, order) => ({ contribution, order }))
    .filter(({ contribution }) => contribution.available)
    .filter(({ contribution }) => contribution.points > 0)
    .sort((a, b) =>
      b.contribution.points === a.contribution.points
        ? a.order - b.order
        : b.contribution.points - a.contribution.points,
    )
    .slice(0, limit)
    .map(({ contribution }) => contribution);
}

// One line per driver, tested so the panel cannot drift from its
// contract, and so the singular reads like English.
export function formatDriver(contribution: Contribution): string {
  const unit = contribution.points === 1 ? "point" : "points";
  return `${contribution.name}: -${String(contribution.points)} ${unit}`;
}

// The sentence above the list. Two honesty duties: say plainly when
// nothing is costing points (an empty list should not look like a
// broken panel), and count the signals that had no value at all,
// because absent evidence must be visible rather than read as
// alertness, the rule this project has kept since the 4.6 fps gate.
//
// A colon promises that a list follows, so when the sentence ends in
// one it must be the LAST clause: review caught "Top drivers of the
// score: 2 signals unavailable." reading as though the unavailable
// signals were the drivers, absence misread as cost.
export function panelSummary(breakdown: ScoreBreakdown): string {
  const drivers = topDrivers(breakdown);
  const unavailable = breakdown.contributions.filter(
    (contribution) => !contribution.available,
  ).length;
  const noun = unavailable === 1 ? "signal" : "signals";
  const missing =
    unavailable === 0 ? "" : `${String(unavailable)} ${noun} unavailable.`;
  if (drivers.length === 0) {
    return missing === ""
      ? "Nothing is costing points."
      : `Nothing is costing points. ${missing}`;
  }
  return missing === ""
    ? "Top drivers of the score:"
    : `${missing} Top drivers of the score:`;
}
