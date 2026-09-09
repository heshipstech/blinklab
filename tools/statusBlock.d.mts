// Types for the plain JavaScript status block tool next door. Same
// arrangement as the other generated blocks: the tool stays .mjs
// because it reads the disk, and its callers are type checked.

export const BEGIN_MARKER: string;
export const END_MARKER: string;

/** The retirement notice a document opens with, or null. */
export function retiredNotice(docText: string): string | null;

/** The status block, built entirely from the record. */
export function buildStatusBlock(root: string): string;

/** Splice a freshly built block over the committed one. */
export function spliceStatusBlock(docText: string, block: string): string;

/** The block as committed, so a test can compare it byte for byte. */
export function committedStatusBlock(docText: string): string;
