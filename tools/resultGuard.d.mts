// Types for the plain JavaScript guard next door. Same arrangement as
// bundleGuard, exportGuard and claimGuard: the guard stays .mjs because
// it reads the disk, and its callers are type checked, because an
// untyped import makes every result `any`, which is how a guard
// silently stops guarding.

/** The current run's numbers, parsed from docs/eyeblink8-result.txt. */
export type CurrentRun = {
  recallPercent: string;
  found: number;
  annotated: number;
  precisionPercent: string;
  invented: number;
  f1Percent: string;
  glasses: { recall: string; precision: string };
  noGlasses: { recall: string; precision: string };
  reproDir: string;
  missTotal: number;
  missFullyClosed: number;
  missPercent: string;
};

/** The repository root as a real filesystem path, not a percent-encoded one. */
export function repoRoot(): string;

/** Read a file as text, relative to the repository root. */
export function readRepoFile(relativePath: string, root: string): string;

/** Parse the current run out of the result file. Throws on a file it cannot read. */
export function parseResultFile(text: string): CurrentRun;

/** The count a document states before "unit tests", or null if it states none. */
export function statedUnitTestCount(docText: string): number | null;

/** The count a document states before "Python tests", or null. */
export function statedPythonTestCount(docText: string): number | null;

/** Count it()/test() calls across test test files. */
export function actualUnitTestCount(root: string): number;

/** Count def test_ functions across analysis/tests. */
export function actualPythonTestCount(root: string): number;
