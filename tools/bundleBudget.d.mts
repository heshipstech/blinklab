// Types for the plain JavaScript guard next door. Same arrangement as
// the other guards: the module stays .mjs because it reads the disk,
// and its callers are type checked, because an untyped import makes
// every result `any`, which is how a guard silently stops guarding.

/** One built JavaScript chunk. */
export type BundleChunk = {
  name: string;
  bytes: number;
};

/** The verdict, as data rather than an exit code. */
export type BudgetVerdict = {
  ok: boolean;
  total: number;
  why: string;
};

/** The byte ceiling for all built JavaScript together. */
export const BUNDLE_BUDGET_BYTES: number;

/** Every built JavaScript chunk in a directory, with its size. */
export function bundleChunks(distAssetsDir: string): BundleChunk[];

/** Whether the chunks fit the budget, and by how much. */
export function budgetVerdict(
  chunks: readonly BundleChunk[],
  budgetBytes?: number,
): BudgetVerdict;
