// Types for the plain JavaScript roadmap guard next door. Same
// arrangement as the other guards: the tool stays .mjs because it
// reads the disk, and its callers are type checked.

/** Unticked rows carrying a blocked marker, with what would unblock each. */
export function blockedRows(
  roadmapText: string,
): { id: string; reason: string }[];

/** One row's whole line, by its number. Throws when it is not there. */
export function roadmapRow(roadmapText: string, id: string): string;

/** Whether the app asks the landmarker for blendshapes. */
export function blendshapesEnabled(root: string): boolean;

/** The rows the ladder claims can still be started. */
export function startableClaims(roadmapText: string): string[];

/** The claimed-startable rows the ladder has since overtaken, with why. */
export function staleStartables(
  roadmapText: string,
): { id: string; why: string }[];
