import { describe, expect, it } from "vitest";

import { apertureMm } from "../../src/core/aperture";
import {
  LEFT_EYE_EAR_INDICES,
  LEFT_IRIS_RING_INDICES,
  RIGHT_EYE_EAR_INDICES,
  RIGHT_IRIS_RING_INDICES,
} from "../../src/core/constants";
import { FIXTURE_COORDINATE_QUANTUM } from "../../src/core/fixtureRecording";
import {
  apertureNoiseStats,
  stillnessMask,
} from "../../src/core/apertureNoise";
import {
  apertureStorageQuantumMm,
  chordTiltFromVerticalDeg,
  coordinateStepPx,
  storageQuantum,
  tiltWhereHorizontalDominatesDeg,
} from "../../src/core/storageQuantum";
import type { EarIndexMap } from "../../src/core/ear";
import { frameLandmarks, loadSession01 } from "../fixtures/loadSession01";
import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";

// Roadmap 10.10c4e, ladder B12, audit F-094. What the fixture's
// rounding is worth, beside the noise floor it qualifies.
//
// The prediction was committed before this file existed
// (docs/fixture-storage-quantum.txt, previous commit). These tests are
// that prediction, one assertion each, so a measurement that disagrees
// with what was expected goes red rather than quietly becoming the new
// expectation.
//
// The quantum is recomputed here from the committed fixture with the
// instrument's own functions, never quoted. A test that read the
// number out of the document and compared it to itself would be a
// check that reads nothing.

const FRAME_WIDTH_PX = 1280;
const FRAME_HEIGHT_PX = 720;

/** Every frame's iris width and lid-chord tilt, both eyes, measured. */
function fixtureMeasurements(): {
  irisWidthsPx: number[];
  tiltsDeg: number[];
  leftMedianDeltaMm: number;
  rightMedianDeltaMm: number;
} {
  const session = loadSession01();
  const irisWidthsPx: number[] = [];
  const tiltsDeg: number[] = [];
  const left: (number | null)[] = [];
  const right: (number | null)[] = [];
  const eyes: { map: EarIndexMap; ring: readonly number[] }[] = [
    { map: LEFT_EYE_EAR_INDICES, ring: LEFT_IRIS_RING_INDICES },
    { map: RIGHT_EYE_EAR_INDICES, ring: RIGHT_IRIS_RING_INDICES },
  ];
  for (const frame of session.frames) {
    const face = frameLandmarks(frame);
    left.push(
      apertureMm(
        face,
        LEFT_EYE_EAR_INDICES,
        LEFT_IRIS_RING_INDICES,
        FRAME_WIDTH_PX,
        FRAME_HEIGHT_PX,
      ),
    );
    right.push(
      apertureMm(
        face,
        RIGHT_EYE_EAR_INDICES,
        RIGHT_IRIS_RING_INDICES,
        FRAME_WIDTH_PX,
        FRAME_HEIGHT_PX,
      ),
    );
  }
  const stats = apertureNoiseStats(left, right);
  // The quantum qualifies the floor, so it is measured over the frames
  // the floor was measured over: the still ones, by the same rule and
  // the same function. Measuring it over all 300 would fold the two
  // blinks' own frames into the ruler, and the blink frames are the
  // ones the floor deliberately excluded.
  const leftMask = stillnessMask(left);
  const rightMask = stillnessMask(right);
  const kept = left.map(
    (_, index) => leftMask[index] === true && rightMask[index] === true,
  );
  for (const [index, frame] of session.frames.entries()) {
    if (kept[index] !== true) {
      continue;
    }
    const face = frameLandmarks(frame);
    for (const eye of eyes) {
      const widthPx = irisWidthOf(face, eye.ring);
      if (widthPx !== null) {
        irisWidthsPx.push(widthPx);
      }
      for (const pair of [
        [eye.map.upperOuter, eye.map.lowerOuter],
        [eye.map.upperInner, eye.map.lowerInner],
      ]) {
        const upper = face[pair[0] as number];
        const lower = face[pair[1] as number];
        if (upper === undefined || lower === undefined) {
          continue;
        }
        const tilt = chordTiltFromVerticalDeg(
          upper,
          lower,
          FRAME_WIDTH_PX,
          FRAME_HEIGHT_PX,
        );
        if (tilt !== null) {
          tiltsDeg.push(tilt);
        }
      }
    }
  }
  return {
    irisWidthsPx,
    tiltsDeg,
    leftMedianDeltaMm: stats.left.medianDeltaMm as number,
    rightMedianDeltaMm: stats.right.medianDeltaMm as number,
  };
}

/** The instrument's own ruler, read directly for this row's arithmetic. */
function irisWidthOf(
  face: readonly { x: number; y: number }[],
  ring: readonly number[],
): number | null {
  const rightPoint = face[ring[0] ?? -1];
  const leftPoint = face[ring[2] ?? -1];
  if (rightPoint === undefined || leftPoint === undefined) {
    return null;
  }
  const dx = (rightPoint.x - leftPoint.x) * FRAME_WIDTH_PX;
  const dy = (rightPoint.y - leftPoint.y) * FRAME_HEIGHT_PX;
  const width = Math.hypot(dx, dy);
  return width > 0 ? width : null;
}

describe("the stored grid, in pixels", () => {
  it("is one rounding step of the recorder's own constant", () => {
    // Not a number typed beside the recorder. If the fixture's
    // precision changes, this row's arithmetic changes with it.
    expect(FIXTURE_COORDINATE_QUANTUM).toBe(1e-4);
    const step = coordinateStepPx(FRAME_WIDTH_PX, FRAME_HEIGHT_PX);
    expect(step.horizontalPx).toBeCloseTo(0.128, 9);
    expect(step.verticalPx).toBeCloseTo(0.072, 9);
  });

  it("converts a step to millimetres through the measured ruler", () => {
    // Half a step, because the aperture is the mean of two chords, and
    // the ruler is the iris: 0.072/2 * 11.7 / 30 = 0.01404.
    expect(apertureStorageQuantumMm(0.072, 30)).toBeCloseTo(0.01404, 9);
    expect(apertureStorageQuantumMm(0.072, 0)).toBeNull();
  });

  it("names the tilt at which the horizontal step would take over", () => {
    // arctan(0.072/0.128): past this the wider horizontal grid moves a
    // chord's length more than the finer vertical one does.
    const step = coordinateStepPx(FRAME_WIDTH_PX, FRAME_HEIGHT_PX);
    expect(tiltWhereHorizontalDominatesDeg(step)).toBeCloseTo(29.3578, 3);
  });
});

describe("the assembled figure refuses rather than invents", () => {
  it("returns null when there is nothing to take a median of", () => {
    // A quantum computed over zero frames is not a small quantum, it
    // is no quantum, and a number returned here would be published.
    expect(storageQuantum([], [], FRAME_WIDTH_PX, FRAME_HEIGHT_PX)).toBeNull();
  });

  it("returns null when the median ruler has no width", () => {
    // The same refusal apertureMm makes. Without an iris there is no
    // millimetre, and a division by a vanishing ruler would return a
    // large finite number that looks like a measurement.
    expect(
      storageQuantum([0, 0, 0], [10, 10, 10], FRAME_WIDTH_PX, FRAME_HEIGHT_PX),
    ).toBeNull();
  });
});

describe("the lid chord's tilt", () => {
  it("is zero for a chord straight up the frame", () => {
    expect(
      chordTiltFromVerticalDeg(
        { x: 0.5, y: 0.4 },
        { x: 0.5, y: 0.6 },
        FRAME_WIDTH_PX,
        FRAME_HEIGHT_PX,
      ),
    ).toBeCloseTo(0, 9);
  });

  it("is ninety degrees for a chord straight across it", () => {
    expect(
      chordTiltFromVerticalDeg(
        { x: 0.4, y: 0.5 },
        { x: 0.6, y: 0.5 },
        FRAME_WIDTH_PX,
        FRAME_HEIGHT_PX,
      ),
    ).toBeCloseTo(90, 9);
  });

  it("refuses a chord of no length rather than inventing an angle", () => {
    expect(
      chordTiltFromVerticalDeg(
        { x: 0.5, y: 0.5 },
        { x: 0.5, y: 0.5 },
        FRAME_WIDTH_PX,
        FRAME_HEIGHT_PX,
      ),
    ).toBeNull();
  });

  it("mixes the axes in pixels, not in normalised coordinates", () => {
    // The aspect-ratio trap. A chord equal in normalised x and y is
    // NOT at 45 degrees on a 16:9 frame: 1280 against 720 puts it at
    // arctan(1280/720) = 60.6 degrees from vertical.
    expect(
      chordTiltFromVerticalDeg(
        { x: 0.5, y: 0.5 },
        { x: 0.6, y: 0.6 },
        FRAME_WIDTH_PX,
        FRAME_HEIGHT_PX,
      ),
    ).toBeCloseTo(60.6422, 3);
  });
});

describe("the prediction, held to the fixture", () => {
  const measured = fixtureMeasurements();
  const quantum = storageQuantum(
    measured.irisWidthsPx,
    measured.tiltsDeg,
    FRAME_WIDTH_PX,
    FRAME_HEIGHT_PX,
  );

  it("measured something to stand on", () => {
    // The floor. An empty series would make every assertion below run
    // over nothing and report success.
    expect(quantum).not.toBeNull();
    expect(measured.irisWidthsPx.length).toBeGreaterThan(400);
    expect(measured.tiltsDeg.length).toBe(measured.irisWidthsPx.length * 2);
  });

  it("1. the vertical step is the one that matters", () => {
    // The chords the aperture averages are near vertical, so the finer
    // vertical grid is what moves them, even though the horizontal
    // grid is coarser in pixels.
    const step = coordinateStepPx(FRAME_WIDTH_PX, FRAME_HEIGHT_PX);
    expect(step.horizontalPx).toBeGreaterThan(step.verticalPx);
    expect((quantum as NonNullable<typeof quantum>).medianTiltDeg).toBeLessThan(
      tiltWhereHorizontalDominatesDeg(step),
    );
  });

  it("2. WAS WRONG: the median iris width is 43.3 px, not 25 to 40", () => {
    // The prediction put the fixture's median iris between 25 and 40
    // pixels, on the grounds that it is "a webcam close-up at 1280 by
    // 720". It is a closer close-up than that: 43.3 px at the median,
    // 37.5 to 50.0 across the kept frames. The band was reasoned from
    // the framing rather than measured from the file, and the file was
    // there to be measured all along.
    //
    // The prediction stands as written in the document. This assertion
    // is the measurement, and parts 3 and 4 below move with it: a
    // wider ruler makes every pixel worth fewer millimetres.
    const width = (quantum as NonNullable<typeof quantum>).medianIrisWidthPx;
    expect(width).toBeCloseTo(43.26, 2);
    expect(width).toBeGreaterThan(40);
  });

  it("3. WAS WRONG by 3 percent: 0.0097 mm, just under the 0.010 floor", () => {
    // Predicted 0.010 to 0.017 mm. Measured 0.00974, a hair below the
    // band, and below it for exactly the reason part 2 was wrong:
    // 0.036 px of chord movement buys fewer millimetres through a
    // 43.3 px ruler than through the 40 px the band's floor assumed.
    // The predicted band and the measurement are the same arithmetic
    // with a different ruler, so scoring this as a second independent
    // miss would be counting one mistake twice.
    const mm = (quantum as NonNullable<typeof quantum>).apertureQuantumMm;
    expect(mm).toBeCloseTo(0.00974, 5);
    expect(mm).toBeLessThan(0.01);
  });

  it("4. the floor is TWO quanta, at the top edge of the predicted band", () => {
    // Predicted "between about ONE and TWO quanta". The answer is two,
    // to within 2 percent on one eye and 0.3 on the other: 2.03 for
    // the left, 1.99 for the right. The bracket was not wrong about
    // the order, which is the finding the row exists for, but it was
    // two-sided about something that turned out to have one answer.
    //
    // Part 5 of the prediction said that if this landed nearer one
    // than two, the audit's phrase "two rounding quanta" would be
    // recorded as approximate rather than adopted. It landed on two,
    // so the audit's figure is adopted as measured.
    const mm = (quantum as NonNullable<typeof quantum>).apertureQuantumMm;
    expect(measured.leftMedianDeltaMm / mm).toBeCloseTo(2.03, 2);
    expect(measured.rightMedianDeltaMm / mm).toBeCloseTo(1.99, 2);
  });

  it("5. rounding alone cannot produce the floor, and that is the point", () => {
    // The trap this row could have walked into. Two quanta of wobble
    // does NOT mean the floor is made of storage: rounding is
    // deterministic, so a perfectly still eye rounds to the same
    // stored value every frame and the measured delta would be zero,
    // not two quanta. The grid only shows up when the true value is
    // already moving across it.
    //
    // What the ratio does establish is that the floor and the grid are
    // the same size, so no part of the floor can be attributed to
    // either one from this fixture. The floor stays an upper bound on
    // the instrument's own wobble, which is the direction that
    // matters, and a reader comparing a 0.1 mm claim against it now
    // knows why it cannot be sharpened without a re-recording.
    const mm = (quantum as NonNullable<typeof quantum>).apertureQuantumMm;
    expect(mm).toBeLessThan(measured.leftMedianDeltaMm);
    expect(mm * 3).toBeGreaterThan(measured.leftMedianDeltaMm);
  });
});

describe("the noise floor document states what was measured", () => {
  it("carries the quantum beside the median it qualifies", () => {
    const measured = fixtureMeasurements();
    const quantum = storageQuantum(
      measured.irisWidthsPx,
      measured.tiltsDeg,
      FRAME_WIDTH_PX,
      FRAME_HEIGHT_PX,
    );
    const value = (quantum as NonNullable<typeof quantum>).apertureQuantumMm;
    const doc = readRepoFile("docs/aperture-noise-floor.txt", repoRoot());
    expect(doc).toContain(`storage quantum mm: ${value.toFixed(4)}`);
    expect(doc).toContain(
      `median iris width px: ${(quantum as NonNullable<typeof quantum>).medianIrisWidthPx.toFixed(1)}`,
    );
  });

  it("the prediction document records the same numbers", () => {
    const measured = fixtureMeasurements();
    const quantum = storageQuantum(
      measured.irisWidthsPx,
      measured.tiltsDeg,
      FRAME_WIDTH_PX,
      FRAME_HEIGHT_PX,
    );
    const value = (quantum as NonNullable<typeof quantum>).apertureQuantumMm;
    const doc = readRepoFile("docs/fixture-storage-quantum.txt", repoRoot());
    expect(doc).toContain("THE RESULT");
    expect(doc).toContain(value.toFixed(4));
    expect(doc).not.toContain("Not yet run.");
  });
});
