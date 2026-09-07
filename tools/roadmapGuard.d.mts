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

/** The phrase a gate caveat opens with. */
export const GATE_CAVEAT: string;

/** Every row carrying a gate caveat, with the rows it waits on. */
export function gateCaveats(
  roadmapText: string,
): { id: string; waitsOn: string[] }[];

/** The caveats whose constants are now due a re-read. */
export function ripeCaveats(roadmapText: string): { id: string; why: string }[];

/** Rows that are retired and blocked at the same time. */
export function retiredWithBlocker(roadmapText: string): string[];

/** A row and every row it is a lettered part of, longest first. */
export function rowAncestry(id: string): string[];
