// Types for the plain JavaScript gate guard next door. Same
// arrangement as the other guards: the tool stays .mjs because it
// reads the disk, and its callers are type checked.

/** The shell commands a named workflow job runs, in order. */
export function ciGates(workflowText: string, jobName: string): string[];

/** The commands CONTRIBUTING tells a contributor to run. */
export function documentedGates(contributingText: string): string[];

/** The highest phase all of whose rows, and every earlier phase's, are ticked. */
export function phasesComplete(roadmapText: string): number;

/** The phase number README's summary sentence claims is complete. */
export function statedPhasesComplete(readmeText: string): number;

/** Whether a roadmap row is settled: done, declined, or moved. */
export function rowSettled(marker: string, text: string): boolean;
