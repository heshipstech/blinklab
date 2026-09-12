import { describe, expect, it } from "vitest";

import {
  delegateMetadataRows,
  inferencePercentiles,
  INFERENCE_SAMPLE_CAP,
  type DelegateTruth,
} from "../../src/core/delegateTruth";

// Roadmap 13.5, brief D8. The executed delegate is unobservable in the
// vendored API, so the export records everything on this side of that
// wall — the request, the one CPU retry's outcome, the webgl2 probe —
// and the discriminating evidence: the p50 and p95 of the model's own
// inference times. The row's Check asks for null-in/unknown-out
// explicitly, so that is the first test in the file.

const NOTHING_MEASURED: DelegateTruth = {
  requested: null,
  gpuRejected: null,
  webgl2Supported: null,
};

const ORDINARY: DelegateTruth = {
  requested: "GPU",
  gpuRejected: false,
  webgl2Supported: true,
};

describe("delegateMetadataRows", () => {
  it("null in, unknown out: nothing measured is said, not guessed", () => {
    expect(delegateMetadataRows(NOTHING_MEASURED, [])).toEqual([
      "# delegate_requested: unknown",
      "# delegate_gpu_load: unknown",
      "# delegate_executed: unobservable",
      "# webgl2_supported: unknown",
      "# inference_p50_ms: unknown",
      "# inference_p95_ms: unknown",
    ]);
  });

  it("records the ordinary session: GPU asked, load ok, webgl2 there", () => {
    const rows = delegateMetadataRows(ORDINARY, [7.25]);
    expect(rows).toContain("# delegate_requested: GPU");
    expect(rows).toContain("# delegate_gpu_load: ok");
    expect(rows).toContain("# webgl2_supported: true");
  });

  it("records the retry: a rejected GPU load and the CPU that ran", () => {
    const rows = delegateMetadataRows(
      { requested: "CPU", gpuRejected: true, webgl2Supported: false },
      [],
    );
    expect(rows).toContain("# delegate_requested: CPU");
    expect(rows).toContain("# delegate_gpu_load: rejected");
    expect(rows).toContain("# webgl2_supported: false");
  });

  it("says unobservable whatever else it knows", () => {
    // The one thing the vendored API cannot report is named as a row,
    // never omitted: a reader of a bare CSV should not need
    // MODEL_CARD.md to learn the instrument's limit.
    for (const truth of [NOTHING_MEASURED, ORDINARY]) {
      expect(delegateMetadataRows(truth, [5])).toContain(
        "# delegate_executed: unobservable",
      );
    }
  });

  it("prints the percentiles to a tenth of a millisecond", () => {
    const rows = delegateMetadataRows(
      ORDINARY,
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    // Nearest rank over 1..20: p50 is the 10th value, p95 the 19th.
    expect(rows).toContain("# inference_p50_ms: 10.0");
    expect(rows).toContain("# inference_p95_ms: 19.0");
  });

  it("declares a capped sample set, and only a capped one", () => {
    // The iris median's WARNING precedent: a truncated record says so
    // in the file rather than looking complete.
    const under = delegateMetadataRows(
      ORDINARY,
      Array.from({ length: INFERENCE_SAMPLE_CAP - 1 }, () => 5),
    );
    expect(under.some((row) => row.startsWith("# inference_note:"))).toBe(
      false,
    );
    const at = delegateMetadataRows(
      ORDINARY,
      Array.from({ length: INFERENCE_SAMPLE_CAP }, () => 5),
    );
    expect(at).toContain(
      `# inference_note: computed over the first ${INFERENCE_SAMPLE_CAP} ` +
        "inferences, later inferences not sampled",
    );
  });
});

describe("inferencePercentiles", () => {
  it("returns null on no samples, never a zero", () => {
    expect(inferencePercentiles([])).toBeNull();
  });

  it("keeps the p95 at or above the p50", () => {
    const spread = inferencePercentiles([3, 9, 4, 30, 5, 6, 5, 4, 6, 5]);
    expect(spread).not.toBeNull();
    expect(spread?.p95Ms ?? 0).toBeGreaterThanOrEqual(spread?.p50Ms ?? 1);
  });

  it("reads a one-sample session as that sample twice", () => {
    expect(inferencePercentiles([7.5])).toEqual({ p50Ms: 7.5, p95Ms: 7.5 });
  });
});
