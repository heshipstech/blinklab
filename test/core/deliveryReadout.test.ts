import { describe, expect, it } from "vitest";

import { deliveryRateMessage } from "../../src/core/deliveryRate";
import { deliveryMetadataRows } from "../../src/core/sessionMetadata";

// What the page says about the camera's own rate, and what the export
// carries. Both are pure, so both can be checked without a camera,
// which is the only way these strings ever get read by anything.

describe("what the page says about the camera's rate", () => {
  it("names the delivered rate and how much of it was read", () => {
    expect(
      deliveryRateMessage({
        deliveredFps: 30.1,
        sampledFps: 29.9,
        readFraction: 0.993,
      }),
    ).toBe(
      "Camera delivery: 30 frames per second, of which this instrument read 30",
    );
  });

  it("a machine slower than its camera is told so, in frames", () => {
    // macbookair2's shape. The point of the sentence is the GAP: this
    // is the one case where a faster machine really would help, and
    // the page has never been able to say which case a viewer is in.
    expect(
      deliveryRateMessage({
        deliveredFps: 30,
        sampledFps: 24,
        readFraction: 0.8,
      }),
    ).toBe(
      "Camera delivery: 30 frames per second, of which this instrument read 24",
    );
  });

  it("says the browser cannot report it rather than going quiet", () => {
    // The correction the review asked for on a neighbouring item: a
    // limitation removed from the open is worse than one stated. A
    // browser without the delivery callback must not silently show
    // nothing where every other browser shows a rate.
    expect(
      deliveryRateMessage({
        deliveredFps: null,
        sampledFps: null,
        readFraction: null,
      }),
    ).toBe("Camera delivery: this browser does not report it");
  });

  it("says measuring while it has frames but not yet a rate", () => {
    expect(
      deliveryRateMessage({
        deliveredFps: 30,
        sampledFps: null,
        readFraction: null,
      }),
    ).toBe("Camera delivery: measuring...");
  });
});

describe("what the export carries about the camera's rate", () => {
  it("writes all three numbers, so analysis can separate them", () => {
    const rows = deliveryMetadataRows({
      deliveredFps: 30.05,
      sampledFps: 29.4,
      readFraction: 0.978,
    });
    expect(rows).toEqual([
      "# camera_delivered_fps: 30.1",
      "# sampled_fps: 29.4",
      "# delivered_frames_read_fraction: 0.978",
    ]);
  });

  it("an unmeasurable rate writes unknown, never zero", () => {
    // The same rule the rest of the export keeps: a zero here would
    // say the camera delivered nothing, which is a claim, and not
    // knowing is a different thing from measuring nothing.
    expect(
      deliveryMetadataRows({
        deliveredFps: null,
        sampledFps: null,
        readFraction: null,
      }),
    ).toEqual([
      "# camera_delivered_fps: unknown",
      "# sampled_fps: unknown",
      "# delivered_frames_read_fraction: unknown",
    ]);
  });

  it("a clip carries no camera delivery at all", () => {
    // A clip is stepped frame by frame off its own media clock, so
    // there is no camera and no delivery rate. Writing "unknown" there
    // would invite a reader to look for a camera that never existed.
    expect(deliveryMetadataRows(null)).toEqual([]);
  });
});
