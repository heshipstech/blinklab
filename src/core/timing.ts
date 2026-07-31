import { INFERENCE_BUDGET_MS } from "./constants";
import { pushBounded } from "./ringBuffer";

export function pushSample(
  samples: readonly number[],
  sample: number,
  maxSamples: number,
): number[] {
  return pushBounded(samples, sample, maxSamples);
}

export function meanDurationMs(samples: readonly number[]): number | null {
  if (samples.length === 0) {
    return null;
  }
  let sum = 0;
  for (const sample of samples) {
    sum += sample;
  }
  return sum / samples.length;
}

export function inferenceMessage(meanMs: number | null): string {
  if (meanMs === null) {
    return "Inference time: measuring...";
  }
  const rounded = String(Math.round(meanMs));
  const budget = String(INFERENCE_BUDGET_MS);
  return meanMs > INFERENCE_BUDGET_MS
    ? `Inference time: ${rounded} ms, over the ${budget} ms budget`
    : `Inference time: ${rounded} ms (budget ${budget} ms)`;
}
