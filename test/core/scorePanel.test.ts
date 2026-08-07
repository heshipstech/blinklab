import { describe, expect, it } from "vitest";

import type { Contribution, ScoreBreakdown } from "../../src/core/score";
import {
  formatDriver,
  panelSummary,
  topDrivers,
  PANEL_DRIVER_LIMIT,
} from "../../src/core/scorePanel";

// Breakdowns are staged by hand here, not produced by scoreRecords:
// the panel's contract is with the ScoreBreakdown shape, and a test
// that went through the scorer would be testing the scorer twice.
function breakdown(points: {
  perclos?: number;
  closures?: number;
  blinks?: number | null;
  lids?: number | null;
}): ScoreBreakdown {
  const contributions: Contribution[] = [
    {
      name: "eyes closed share",
      points: points.perclos ?? 0,
      available: true,
    },
    { name: "long closures", points: points.closures ?? 0, available: true },
    {
      name: "slow blinks",
      points: points.blinks ?? 0,
      available: points.blinks !== null,
    },
    {
      name: "sluggish lids",
      points: points.lids ?? 0,
      available: points.lids !== null,
    },
  ];
  const sum = contributions.reduce((a, c) => a + c.points, 0);
  return { score: 100 - sum, contributions };
}

describe("topDrivers", () => {
  it("returns nothing when nothing cost points", () => {
    expect(topDrivers(breakdown({}))).toEqual([]);
  });

  it("excludes signals that cost zero, they drove nothing", () => {
    const drivers = topDrivers(breakdown({ perclos: 12 }));
    expect(drivers.map((d) => d.name)).toEqual(["eyes closed share"]);
  });

  it("sorts by points descending", () => {
    const drivers = topDrivers(
      breakdown({ perclos: 8, closures: 30, blinks: 15 }),
    );
    expect(drivers.map((d) => d.name)).toEqual([
      "long closures",
      "slow blinks",
      "eyes closed share",
    ]);
  });

  it("keeps only the top three when four signals all cost points", () => {
    const drivers = topDrivers(
      breakdown({ perclos: 40, closures: 30, blinks: 15, lids: 10 }),
    );
    expect(drivers).toHaveLength(PANEL_DRIVER_LIMIT);
    expect(drivers.map((d) => d.name)).toEqual([
      "eyes closed share",
      "long closures",
      "slow blinks",
    ]);
  });

  it("can hide a driver equal to the smallest shown, the honest limit", () => {
    // The cut is not tie-aware, so the hidden contribution is not
    // always strictly smallest: it can EQUAL the last one shown.
    // The docs state the true invariant, no larger than the smallest
    // shown, and this pins the case that proves it.
    const tied = breakdown({ perclos: 20, closures: 15, blinks: 8, lids: 8 });
    const shown = topDrivers(tied);
    expect(shown.map((d) => d.name)).toEqual([
      "eyes closed share",
      "long closures",
      "slow blinks",
    ]);
    const smallestShown = shown[shown.length - 1]?.points ?? 0;
    const hidden = tied.contributions.find((c) => c.name === "sluggish lids");
    expect(hidden?.points).toBe(smallestShown);
    expect(hidden?.points).toBeLessThanOrEqual(smallestShown);
  });

  it("breaks ties by the canonical order, so the panel cannot jitter", () => {
    // Equal points must not swap places frame to frame: the order
    // the scorer declares its contributions in is the tiebreak.
    const drivers = topDrivers(
      breakdown({ perclos: 15, closures: 15, blinks: 15, lids: 15 }),
    );
    expect(drivers.map((d) => d.name)).toEqual([
      "eyes closed share",
      "long closures",
      "slow blinks",
    ]);
  });

  it("sorts before it cuts, so the biggest driver can never be dropped", () => {
    // Review's mutation: slicing before sorting passed every test,
    // because no case had its biggest driver in the fourth declared
    // position. Here the smallest three are declared first, so a cut
    // taken before the sort would throw away the only real driver.
    const drivers = topDrivers(
      breakdown({ perclos: 2, closures: 3, blinks: 4, lids: 40 }),
    );
    expect(drivers.map((d) => d.name)).toEqual([
      "sluggish lids",
      "slow blinks",
      "long closures",
    ]);
    expect(drivers[0]?.points).toBe(40);
  });

  it("drops an unavailable signal even if it somehow carries points", () => {
    // The scorer always zeroes an unavailable signal's points, so
    // this shape cannot arrive today. The panel refuses it anyway:
    // review deleted the availability filter and every test still
    // passed, because none staged the two conditions apart.
    const contradictory: ScoreBreakdown = {
      score: 90,
      contributions: [
        { name: "eyes closed share", points: 10, available: true },
        { name: "long closures", points: 0, available: true },
        { name: "slow blinks", points: 25, available: false },
        { name: "sluggish lids", points: 0, available: true },
      ],
    };
    expect(topDrivers(contradictory).map((d) => d.name)).toEqual([
      "eyes closed share",
    ]);
  });

  it("never returns an unavailable signal, even asked for more", () => {
    const drivers = topDrivers(
      breakdown({ perclos: 10, blinks: null, lids: null }),
      4,
    );
    expect(drivers.map((d) => d.name)).toEqual(["eyes closed share"]);
  });
});

describe("formatDriver", () => {
  it("names the signal and its cost in points", () => {
    expect(
      formatDriver({ name: "eyes closed share", points: 12, available: true }),
    ).toBe("eyes closed share: -12 points");
  });

  it("says point, singular, for exactly one", () => {
    expect(
      formatDriver({ name: "long closures", points: 1, available: true }),
    ).toBe("long closures: -1 point");
  });
});

describe("panelSummary", () => {
  it("says plainly when nothing is costing points", () => {
    expect(panelSummary(breakdown({}))).toBe("Nothing is costing points.");
  });

  it("counts the drivers when some exist", () => {
    expect(panelSummary(breakdown({ perclos: 12, closures: 15 }))).toBe(
      "Top drivers of the score:",
    );
  });

  it("reports unavailable signals rather than hiding them", () => {
    // Absent evidence must be visible: a missing signal is not an
    // alert signal, the rule this project has kept since 4.6.
    expect(panelSummary(breakdown({ blinks: null }))).toBe(
      "Nothing is costing points. 1 signal unavailable.",
    );
    expect(panelSummary(breakdown({ blinks: null, lids: null }))).toBe(
      "Nothing is costing points. 2 signals unavailable.",
    );
    // The colon introduces the list, so it must come last: the
    // other order reads as though the unavailable signals were the
    // drivers, which is absence misread as cost.
    expect(
      panelSummary(breakdown({ perclos: 12, blinks: null, lids: null })),
    ).toBe("2 signals unavailable. Top drivers of the score:");
  });
});

describe("the panel as a whole, staged snapshots", () => {
  it("renders the ladder's staged cases exactly", () => {
    const render = (b: ScoreBreakdown): string[] => [
      panelSummary(b),
      ...topDrivers(b).map(formatDriver),
    ];

    expect(render(breakdown({}))).toEqual(["Nothing is costing points."]);

    expect(
      render(breakdown({ perclos: 40, closures: 30, blinks: 15 })),
    ).toEqual([
      "Top drivers of the score:",
      "eyes closed share: -40 points",
      "long closures: -30 points",
      "slow blinks: -15 points",
    ]);

    expect(
      render(breakdown({ perclos: 8, closures: 15, blinks: 4, lids: 2 })),
    ).toEqual([
      "Top drivers of the score:",
      "long closures: -15 points",
      "eyes closed share: -8 points",
      "slow blinks: -4 points",
    ]);

    expect(render(breakdown({ perclos: 3, blinks: null, lids: null }))).toEqual(
      [
        "2 signals unavailable. Top drivers of the score:",
        "eyes closed share: -3 points",
      ],
    );
  });

  it("keeps the panel consistent with the score's own arithmetic", () => {
    // The panel may show only the top three, so its lines need not
    // sum to the full penalty: what must hold is that every line it
    // shows is a real contribution with its real points.
    const b = breakdown({ perclos: 40, closures: 30, blinks: 15, lids: 10 });
    for (const driver of topDrivers(b)) {
      const source = b.contributions.find((c) => c.name === driver.name);
      expect(source).toBeDefined();
      expect(driver.points).toBe(source?.points);
    }
  });
});
