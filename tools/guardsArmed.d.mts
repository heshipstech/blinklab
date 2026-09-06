// Types for the plain JavaScript reader next door. Same arrangement as
// the guards it reads: the reader stays .mjs because it touches the
// filesystem, and its caller is type checked.

/** Every guard, generator or ratchet in tools/, by module name, sorted. */
export function guardModules(root: string): string[];

/** Every unit test file's module name under test/, sorted. */
export function testedModules(root: string): string[];

/** Guards whose test is named for what it checks rather than for the module. */
export const NAMED_DIFFERENTLY: Record<string, string>;

/** Guards with no sibling test, so nothing runs them. */
export function unarmedGuards(root: string): string[];
