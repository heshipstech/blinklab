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

/** One phase header's gate: what it waits on and what it lets through. */
export type PhaseGate = {
  phase: string;
  prerequisites: string[];
  exemptRows: string[];
  exemptOther: string[];
};

/** The rows one item of a gate's prose names. Throws on an unreadable item. */
export function expandRowRange(item: string): string[];

/** Every phase whose header carries a gate. */
export function phaseGates(roadmapText: string): PhaseGate[];

/** Claimed-startable rows whose phase will not let them start. */
export function gatedStartables(
  roadmapText: string,
): { id: string; why: string }[];
