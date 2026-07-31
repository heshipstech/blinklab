import { describe, expect, it } from "vitest";

import {
  LEFT_EYE_EAR_INDICES,
  RIGHT_EYE_EAR_INDICES,
} from "../../src/core/constants";
import { eyeAspectRatio, eyeLandmarksFromFace } from "../../src/core/ear";
import { sparklineSegments, type EarSample } from "../../src/core/sparkline";
import { frameLandmarks, loadSession01 } from "../fixtures/loadSession01";

const WIDTH = 600;
const HEIGHT = 80;
const WINDOW_MS = 10000;
const EAR_MAX = 0.6;

describe("sparklineSegments", () => {
  it("maps known samples to hand checkable canvas points", () => {
    const nowMs = 10000;
    const samples: EarSample[] = [
      { timestampMs: 0, ear: 0.6 },
      { timestampMs: 5000, ear: 0.3 },
      { timestampMs: 10000, ear: 0 },
    ];
    expect(
      sparklineSegments(samples, nowMs, WINDOW_MS, WIDTH, HEIGHT, EAR_MAX),
    ).toEqual([
      [
        { x: 0, y: 0 },
        { x: 300, y: 40 },
        { x: 600, y: 80 },
      ],
    ]);
  });

  it("splits into separate segments where the ear was null", () => {
    const nowMs = 10000;
    const samples: EarSample[] = [
      { timestampMs: 9000, ear: 0.3 },
      { timestampMs: 9500, ear: null },
      { timestampMs: 10000, ear: 0.3 },
    ];
    const segments = sparklineSegments(
      samples,
      nowMs,
      WINDOW_MS,
      WIDTH,
      HEIGHT,
      EAR_MAX,
    );
    expect(segments.length).toBe(2);
    expect(segments[0]?.length).toBe(1);
    expect(segments[1]?.length).toBe(1);
  });

  it("drops samples older than the window and returns nothing for none", () => {
    const samples: EarSample[] = [{ timestampMs: 0, ear: 0.3 }];
    expect(
      sparklineSegments(samples, 20000, WINDOW_MS, WIDTH, HEIGHT, EAR_MAX),
    ).toEqual([]);
    expect(
      sparklineSegments([], 20000, WINDOW_MS, WIDTH, HEIGHT, EAR_MAX),
    ).toEqual([]);
  });

  it("clamps an ear above the fixed scale to the top edge", () => {
    const segments = sparklineSegments(
      [{ timestampMs: 10000, ear: 0.9 }],
      10000,
      WINDOW_MS,
      WIDTH,
      HEIGHT,
      EAR_MAX,
    );
    expect(segments[0]?.[0]?.y).toBe(0);
  });

  it("maps the whole fixture to one unbroken segment", () => {
    const session = loadSession01();
    const samples: EarSample[] = session.frames.map((frame) => {
      const face = frameLandmarks(frame);
      const right = eyeLandmarksFromFace(face, RIGHT_EYE_EAR_INDICES);
      const left = eyeLandmarksFromFace(face, LEFT_EYE_EAR_INDICES);
      const rightEar = right === null ? null : eyeAspectRatio(right);
      const leftEar = left === null ? null : eyeAspectRatio(left);
      return {
        timestampMs: frame.timestampMs,
        ear:
          rightEar === null || leftEar === null
            ? null
            : (rightEar + leftEar) / 2,
      };
    });
    const last = samples[samples.length - 1];
    const segments = sparklineSegments(
      samples,
      last?.timestampMs ?? 0,
      WINDOW_MS,
      WIDTH,
      HEIGHT,
      EAR_MAX,
    );
    expect(segments.length).toBe(1);
    expect(segments[0]?.length).toBe(300);
  });
});
