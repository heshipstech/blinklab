import type { StoredBlinkCalibration } from "../../src/core/guidedCalibration";

// One stored guided line for tests that need a person to have
// calibrated, without every one of them restating the shape (roadmap
// 10.13a, ladder A8). The stamp is synthetic on purpose: no test
// carries a real camera's name or a real person's working distance.
export function aStoredLine(
  overrides: Partial<StoredBlinkCalibration> = {},
): StoredBlinkCalibration {
  return {
    personalLineMm: 3.4,
    openMedianMm: 7,
    closedMedianMm: 1.8,
    openSampleCount: 90,
    closedSampleCount: 45,
    stamp: {
      cameraLabel: "a webcam",
      frameWidthPx: 1280,
      frameHeightPx: 720,
      irisWidthPx: 40,
      recordedAtIso: "2026-09-07T00:00:00.000Z",
    },
    ...overrides,
  };
}
