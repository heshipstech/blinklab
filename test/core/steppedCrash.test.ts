import { describe, expect, it } from "vitest";
import { steppedCrashOutcome } from "../../src/core/steppedCrash";

// Roadmap 14.0e. When a stepped clip throws, the disposition turns on
// one fact: were any frames measured before it fell over? If so the
// throw is a mid-run MEASUREMENT crash, and the session it interrupted
// is a real, exportable file session whose provenance (source and clip
// name) must survive to the export. If not, the throw is a broken FILE
// the instrument never got a measurement out of, and the page returns
// to its camera-ready state. main.ts had this branch inline in a catch
// and, on the mid-run side, reset the source to "camera" and dropped
// the clip name before offering the export — so a crashed file session
// exported as a camera one. The decision lives here now so it can be
// tested and cannot silently diverge from the inner loop's crash path,
// which already keeps the provenance.

describe("steppedCrashOutcome", () => {
  it("is a measurement crash once any frame was measured", () => {
    expect(steppedCrashOutcome(1)).toEqual({ kind: "measurementCrash" });
  });

  it("is a measurement crash deep into a run", () => {
    expect(steppedCrashOutcome(1800)).toEqual({ kind: "measurementCrash" });
  });

  it("is a file failure when nothing was measured", () => {
    // The broken-file case: the throw came before a single frame, so
    // there is no session to keep and the page returns to the camera.
    expect(steppedCrashOutcome(0)).toEqual({ kind: "fileFailed" });
  });
});
