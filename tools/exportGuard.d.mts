// Types for the plain JavaScript guard next door.
//
// Same arrangement as bundleGuard: the guard stays .mjs because it
// shells out to git and reads the disk, and its callers are type
// checked, because an untyped import makes every result `any`, which is
// how a guard silently stops guarding.

/** Every filename `downloadTextFile` can produce, with stamps filled in. */
export function downloadedFilenames(mainSource: string): string[];

/** The repository root as a real filesystem path, not a percent-encoded one. */
export function repoRoot(): string;

/** Read a file as text. Separate so the parser can be tested with no disk. */
export function readText(path: string): string;

/** Ask git, not a glob library, whether this path would be refused. */
export function gitRefusesToTrack(filename: string, repoRoot: string): boolean;
