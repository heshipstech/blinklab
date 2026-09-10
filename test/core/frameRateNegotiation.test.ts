import { describe, expect, it } from "vitest";

import {
  FRAME_RATE_ASK_FPS,
  negotiationMetadataRows,
  resolutionChange,
  type FrameRateNegotiation,
} from "../../src/core/frameRateNegotiation";

// Roadmap 13.2, brief C1. The page has never asked a camera for more
// than its default rate — every session in the record declares 30.0 —
// and the committed sampling model says delivery at 60 roughly doubles
// the odds of catching a minimal blink (docs/blink-sample-rate.txt,
// 0.48 to 0.96 at the 3.40 mm minimum). The ask is a MEASUREMENT:
// capabilities read, settings before, the ideal-60 constraint, settings
// after, all recorded. This file holds the pure half: the one thing
// the row's builder test must prove is that a resolution change caused
// by the frame-rate step is SURFACED, never silent, because the iris
// ruler runs on source pixels and a rate bought by resolution is a
// trade the record has to name (docs/frame-rate-negotiation.txt).

function aNegotiation(
  overrides: Partial<FrameRateNegotiation> = {},
): FrameRateNegotiation {
  return {
    declaredMaxFps: 60,
    before: { frameRate: 30, widthPx: 1920, heightPx: 1080 },
    after: { frameRate: 60, widthPx: 1920, heightPx: 1080 },
    askedFps: FRAME_RATE_ASK_FPS,
    applyFailed: false,
    ...overrides,
  };
}

describe("the resolution guard", () => {
  it("reads null when the frame-rate step left the resolution alone", () => {
    expect(resolutionChange(aNegotiation())).toBeNull();
  });

  it("surfaces a trade as from and to, never silently", () => {
    const change = resolutionChange(
      aNegotiation({
        after: { frameRate: 60, widthPx: 1280, heightPx: 720 },
      }),
    );
    expect(change).toEqual({ from: "1920x1080", to: "1280x720" });
  });

  it("cannot call an unreported resolution unchanged", () => {
    // A browser that reports no width has not proven the resolution
    // held; "unknown" and "unchanged" are different claims, and this
    // function refuses to upgrade one into the other.
    const change = resolutionChange(
      aNegotiation({
        before: { frameRate: 30, widthPx: null, heightPx: null },
      }),
    );
    expect(change).toEqual({ from: "unknown", to: "1920x1080" });
  });
});

describe("the export rows", () => {
  it("writes the whole step: declared, asked, before, after, verdict", () => {
    const rows = negotiationMetadataRows(aNegotiation());
    expect(rows).toEqual([
      "# frame_rate_declared_max: 60",
      "# frame_rate_asked: 60",
      "# frame_rate_before: 30",
      "# frame_rate_after: 60",
      "# frame_rate_apply: ok",
      "# frame_rate_resolution_change: none",
    ]);
  });

  it("says unknown where the browser said nothing, and failed out loud", () => {
    const rows = negotiationMetadataRows(
      aNegotiation({
        declaredMaxFps: null,
        before: { frameRate: null, widthPx: 1920, heightPx: 1080 },
        after: { frameRate: null, widthPx: 1920, heightPx: 1080 },
        applyFailed: true,
      }),
    );
    expect(rows).toContain("# frame_rate_declared_max: unknown");
    expect(rows).toContain("# frame_rate_before: unknown");
    expect(rows).toContain("# frame_rate_after: unknown");
    expect(rows).toContain("# frame_rate_apply: failed");
  });

  it("carries a resolution trade into the file in one readable cell", () => {
    const rows = negotiationMetadataRows(
      aNegotiation({
        after: { frameRate: 60, widthPx: 1280, heightPx: 720 },
      }),
    );
    expect(rows).toContain(
      "# frame_rate_resolution_change: 1920x1080 -> 1280x720",
    );
  });

  it("is absent off the camera, the pseudonym rule", () => {
    // A clip has no track to negotiate with; the step never ran, so
    // there is nothing to report — absence, not six unknowns.
    expect(negotiationMetadataRows(null)).toEqual([]);
  });
});
