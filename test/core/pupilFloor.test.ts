import { describe, expect, it } from "vitest";

import {
  SWEEP_BLURS,
  SWEEP_MIN_MEANINGFUL_WIDTH_PX,
  SWEEP_WIDTHS,
  resolvesAt,
  resolutionFloor,
  sweepCsv,
  syntheticEye,
} from "../../src/core/pupilFloor";
import {
  updateRequested,
  writeFixture,
} from "../../tools/writeVerdictFixtures.mjs";
import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";

// Roadmap 13.11. The floor is a MEASUREMENT, so the table it produces
// is committed and this file is what holds the two together: the
// generator runs here, and the committed CSV has to come back
// digit for digit. Same arrangement as the verdict fixtures, and for
// the same reason — a table typed by hand is somebody's idea of what
// the sweep says.

const root = repoRoot();
const TABLE = "docs/evidence/2026-09-07-pupil-floor/resolution-sweep.csv";

describe("the synthetic eye", () => {
  it("is a dark disc on a bright iris", () => {
    const field = syntheticEye(40, 0);
    expect(field).not.toBeNull();
    const centre = ((field?.width ?? 1) - 1) / 2;
    const middle =
      field?.samples[
        Math.round(centre) * (field.width ?? 1) + Math.round(centre)
      ];
    const corner = field?.samples[0];
    expect(middle).toBeLessThan(corner ?? 0);
  });

  it("is bigger than the iris, so a full-radius ray stays inside it", () => {
    // A ray running off the edge is refused for a reason that has
    // nothing to do with resolution, which would make the sweep
    // measure the raster instead of the estimator.
    const field = syntheticEye(40, 0);
    expect(field?.width ?? 0).toBeGreaterThan(40);
  });

  it("blurs, and blurring lowers the centre-to-rim contrast", () => {
    const sharp = syntheticEye(40, 0);
    const soft = syntheticEye(40, 4);
    const centreOf = (f: typeof sharp): number => {
      const w = f?.width ?? 1;
      const c = Math.round((w - 1) / 2);
      return f?.samples[c * w + c] ?? 0;
    };
    expect(centreOf(soft)).toBeGreaterThan(centreOf(sharp));
  });

  it("refuses an eye too small or a blur that is not one", () => {
    expect(syntheticEye(1, 0)).toBeNull();
    expect(syntheticEye(40, -1)).toBeNull();
    expect(syntheticEye(Number.NaN, 0)).toBeNull();
    expect(syntheticEye(40, 0, 0)).toBeNull();
    expect(syntheticEye(40, 0, 1)).toBeNull();
  });
});

describe("the floor", () => {
  it("is monotone in iris width at every blur, above the meaningful minimum", () => {
    // The Check's second clause, and the property that makes "the
    // floor" a meaningful phrase at all: once the estimator resolves
    // at a width it must resolve at every larger one, or the sweep is
    // reporting the first of several islands.
    for (const blur of SWEEP_BLURS) {
      let resolvedYet = false;
      for (const width of SWEEP_WIDTHS) {
        if (width < SWEEP_MIN_MEANINGFUL_WIDTH_PX) {
          continue;
        }
        const resolved = resolvesAt(width, blur);
        if (resolvedYet) {
          expect(
            resolved,
            `blur ${String(blur)} resolved below ${String(width)} and then stopped`,
          ).toBe(true);
        }
        resolvedYet = resolvedYet || resolved;
      }
    }
  });

  it("is NOT monotone below that minimum, which is why the minimum exists", () => {
    // Measured, not assumed. At three pixels of iris the pupil is
    // 1.2 px across and the disc is not a disc; four pixels resolves
    // where three does not. That is the raster's geometry talking,
    // not the estimator's, and a sweep that reported it as a floor
    // would be publishing an artefact.
    expect(SWEEP_MIN_MEANINGFUL_WIDTH_PX).toBe(4);
    expect(resolvesAt(2, 0)).toBe(true);
    expect(resolvesAt(3, 0)).toBe(false);
  });

  it("rises with blur, which is the mechanism the prediction named", () => {
    const floors = SWEEP_BLURS.map(
      (b) => resolutionFloor(SWEEP_WIDTHS, b) ?? 0,
    );
    for (let i = 1; i < floors.length; i += 1) {
      expect(floors[i] ?? 0).toBeGreaterThanOrEqual(floors[i - 1] ?? 0);
    }
  });

  it("sits far below the 43 px the owner's webcam delivered", () => {
    // The headline. Even at a blur of four pixels, which is a heavily
    // softened image, the floor is less than half the iris width the
    // light-response run actually had.
    for (const blur of SWEEP_BLURS) {
      const floor = resolutionFloor(SWEEP_WIDTHS, blur);
      expect(floor).not.toBeNull();
      expect(floor ?? 999).toBeLessThan(43);
    }
    expect(resolvesAt(43, 4)).toBe(true);
  });
});

describe("the committed table", () => {
  it("reproduces digit for digit from the generator", () => {
    const generated = sweepCsv();
    if (updateRequested()) {
      writeFixture(TABLE, generated, root);
    }
    expect(readRepoFile(TABLE, root)).toBe(generated);
  });
});
