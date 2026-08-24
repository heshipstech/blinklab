// Types for the plain JavaScript guard next door, same bargain as
// bundleGuard: the guard stays .mjs so a corpus run needs no compiler,
// and its callers are type checked so its results are never `any`.

/** Either the flat clips to measure, or why there is nothing to. */
export type ClipSelection =
  { ok: true; clips: string[] } | { ok: false; message: string };

export function selectClips(input: {
  clipsDir: string;
  entries: readonly string[];
}): ClipSelection;
