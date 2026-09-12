import { percentile } from "./statistics";

// Delegate truth and inference percentiles, in the export (roadmap
// 13.5, brief D8).
//
// src/io/landmarker.ts asks MediaPipe for the GPU delegate, and the
// vendored tasks-vision 1.0.1 cannot say which delegate actually
// EXECUTED: a GPU request that fails inside the runtime falls back to
// CPU silently, with no field anywhere admitting it. So the export
// records everything on this side of that wall — which delegate the
// successful load requested, whether the one CPU retry fired, whether
// this page could produce a webgl2 context at all — and the
// discriminating evidence for what actually ran: the p50 and p95 of
// the model's own inference times, which sit far apart on the two
// delegates. The one thing that cannot be recorded is written as a
// row rather than omitted, because a reader of a bare CSV should not
// need MODEL_CARD.md to learn the instrument's limit.
//
// These are machine rows, so they are unconditional and appear in
// clip mode too: a clip session runs the same model on the same
// machine, and the delegate question is exactly as open there.
// "unknown" where nothing was measured, never a guess.

/**
 * The inference sample cap, following IRIS_SAMPLE_CAP's precedent
 * rather than inventing a third convention. A three minute session at
 * 60 frames per second is about 10,800 inferences, so this does not
 * bind in practice, and the note row says so out loud when it does.
 */
export const INFERENCE_SAMPLE_CAP = 20000;

export type LandmarkerDelegate = "GPU" | "CPU";

export type DelegateTruth = {
  /** The delegate of the load that succeeded, or null before any did. */
  requested: LandmarkerDelegate | null;
  /**
   * Whether the first, GPU load was rejected — the cause of the one
   * CPU retry. Null before any load finished, which line() semantics
   * would round to false and this module refuses to.
   */
  gpuRejected: boolean | null;
  /**
   * Whether this page could create a webgl2 context, read once by
   * io/webgl2Probe.ts. Null when the probe itself threw, which is
   * "unknown" and never "unsupported": a throwing canvas is not a
   * measurement of the GPU.
   */
  webgl2Supported: boolean | null;
};

export type InferencePercentiles = { p50Ms: number; p95Ms: number };

/** Both percentiles or neither: half a spread is not a spread. */
export function inferencePercentiles(
  samplesMs: readonly number[],
): InferencePercentiles | null {
  const p50 = percentile(samplesMs, 50);
  const p95 = percentile(samplesMs, 95);
  if (p50 === null || p95 === null) {
    return null;
  }
  return { p50Ms: p50, p95Ms: p95 };
}

function cell(value: string | null): string {
  return value ?? "unknown";
}

/**
 * The delegate block, written into every export. Unconditional by
 * design where the camera blocks are conditional: these rows describe
 * the machine and the model runtime, which a clip session has too.
 */
export function delegateMetadataRows(
  truth: DelegateTruth,
  inferenceSamplesMs: readonly number[],
): string[] {
  const spread = inferencePercentiles(inferenceSamplesMs);
  const rows = [
    `# delegate_requested: ${cell(truth.requested)}`,
    `# delegate_gpu_load: ${cell(
      truth.gpuRejected === null ? null : truth.gpuRejected ? "rejected" : "ok",
    )}`,
    // A constant row on purpose. What executed is the fact a reader
    // wants, the API withholds it, and a file that stays silent about
    // a limit invites the request row above to be read as the answer.
    `# delegate_executed: unobservable`,
    `# webgl2_supported: ${cell(
      truth.webgl2Supported === null
        ? null
        : truth.webgl2Supported
          ? "true"
          : "false",
    )}`,
    `# inference_p50_ms: ${spread === null ? "unknown" : spread.p50Ms.toFixed(1)}`,
    `# inference_p95_ms: ${spread === null ? "unknown" : spread.p95Ms.toFixed(1)}`,
  ];
  if (inferenceSamplesMs.length >= INFERENCE_SAMPLE_CAP) {
    // The iris median's WARNING precedent: a truncated record says so
    // in the file rather than looking complete.
    rows.push(
      `# inference_note: computed over the first ${INFERENCE_SAMPLE_CAP} ` +
        `inferences, later inferences not sampled`,
    );
  }
  return rows;
}
