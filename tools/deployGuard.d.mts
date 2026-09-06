// Types for the plain JavaScript guard next door. Same arrangement as
// the other guards: it stays .mjs because it reads the disk, and its
// caller is type checked.

/** A workflow file's text, by name, from .github/workflows. */
export function readWorkflow(name: string, root: string): string;

/** The top-level trigger names in a workflow's `on:` block. Throws when there are none. */
export function deployTriggers(workflowText: string): string[];
