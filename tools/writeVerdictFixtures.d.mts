// Types for the plain JavaScript writer next door, which reaches the
// disk so its caller does not have to.

/** Whether this run was asked to rewrite the fixtures. */
export function updateRequested(): boolean;

/** Write one fixture, replacing what is there. */
export function writeFixture(
  relativePath: string,
  text: string,
  root: string,
): void;
