// Types for the plain JavaScript disk half of the replay runner next
// door, which reaches the filesystem so its caller does not have to.

/** Whether this run was asked to perform the join and write the table. */
export function runRequested(): boolean;

/** Read a file as UTF-8 text. */
export function readText(path: string): string;

/** Every `<clip>.frames.csv` in a directory, keyed by clip stem. */
export function readTraceDir(traceDir: string): Map<string, string>;

/** Write text to disk verbatim. */
export function writeText(path: string, text: string): void;
