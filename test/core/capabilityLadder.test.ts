import { describe, expect, it } from "vitest";

import {
  capabilityLadder,
  IRIS_SOUND_SESSION_PX,
} from "../../src/core/capabilityLadder";
import { BLINK_RISK_FPS, MIN_BLINK_FPS } from "../../src/core/constants";
import { citedDocs } from "../../src/core/docCitations";

// Roadmap 13.6a. The capability ladder says what THIS SETUP can
// deliver, from numbers the session already measured — the delivered
// rate against the committed sampling model's bands, the iris ruler
// against the smallest iris the record has published a sound session
// at — and says "unknown" where the page could not find out, never a
// guess. The light rung is unknown BY DESIGN until 13.6b derives a
// threshold from committed data. One test per verdict boundary, every
// null path yielding unknown, and every judging sentence citing the
// document its boundary came from.

function rung(inputs: Parameters<typeof capabilityLadder>[0], name: string) {
  const found = capabilityLadder(inputs).find((r) => r.rung === name);
  expect(found, name).toBeDefined();
  return found as NonNullable<typeof found>;
}

const NONE = { sampledFps: null, irisWidthPx: null };

describe("the delivered-rate rung", () => {
  it("reads ok at the certain-catch rate, boundary inclusive", () => {
    expect(
      rung({ ...NONE, sampledFps: BLINK_RISK_FPS }, "deliveredRate").status,
    ).toBe("ok");
    expect(rung({ ...NONE, sampledFps: 126.7 }, "deliveredRate").status).toBe(
      "ok",
    );
  });

  it("reads warned inside the risk band, both edges honest", () => {
    // Exactly at the 25 floor the gate admits the session (fpsGate's
    // own boundary), so the ladder says warned, not refused.
    expect(
      rung({ ...NONE, sampledFps: MIN_BLINK_FPS }, "deliveredRate").status,
    ).toBe("warned");
    expect(rung({ ...NONE, sampledFps: 59.9 }, "deliveredRate").status).toBe(
      "warned",
    );
  });

  it("reads refused below the floor the detector itself refuses at", () => {
    expect(rung({ ...NONE, sampledFps: 24.9 }, "deliveredRate").status).toBe(
      "refused",
    );
  });

  it("reads unknown where delivery was never reported", () => {
    expect(rung(NONE, "deliveredRate").status).toBe("unknown");
  });

  it("cites the sampling model at every status", () => {
    for (const fps of [null, 20, 30, 90]) {
      const sentence = rung(
        { ...NONE, sampledFps: fps },
        "deliveredRate",
      ).sentence;
      expect(citedDocs(sentence)).toContain("docs/blink-sample-rate.txt");
    }
  });
});

describe("the iris-ruler rung", () => {
  it("reads ok at the smallest published-sound iris, boundary inclusive", () => {
    expect(
      rung({ ...NONE, irisWidthPx: IRIS_SOUND_SESSION_PX }, "irisRuler").status,
    ).toBe("ok");
  });

  it("reads warned below it, because millimetres ride fewer pixels", () => {
    expect(rung({ ...NONE, irisWidthPx: 21.9 }, "irisRuler").status).toBe(
      "warned",
    );
  });

  it("reads unknown where no iris was measured", () => {
    expect(rung(NONE, "irisRuler").status).toBe("unknown");
  });

  it("cites the adoption condition that committed the 22 pixel line", () => {
    for (const px of [null, 15, 30]) {
      const sentence = rung({ ...NONE, irisWidthPx: px }, "irisRuler").sentence;
      expect(citedDocs(sentence)).toContain("docs/frame-rate-negotiation.txt");
    }
  });
});

describe("the light rung", () => {
  it("is unknown whatever the session measured, by design until 13.6b", () => {
    expect(rung(NONE, "light").status).toBe("unknown");
    expect(rung({ sampledFps: 90, irisWidthPx: 40 }, "light").status).toBe(
      "unknown",
    );
  });

  it("says WHY it is unknown, naming the row that will rule it", () => {
    expect(rung(NONE, "light").sentence).toContain("13.6b");
  });
});

describe("the ladder as a whole", () => {
  it("always renders exactly its three rungs, in ladder order", () => {
    expect(capabilityLadder(NONE).map((r) => r.rung)).toEqual([
      "deliveredRate",
      "irisRuler",
      "light",
    ]);
  });

  it("keeps the derived constant at the published value", () => {
    // The 22 px line is docs/frame-rate-negotiation.txt's adoption
    // condition — the smallest iris the record has published a sound
    // session at. A quietly moved constant would re-rule that
    // document from here.
    expect(IRIS_SOUND_SESSION_PX).toBe(22);
  });
});
