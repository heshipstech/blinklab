// Types for the plain JavaScript reader next door. Same arrangement as
// the guards it reads: the reader stays .mjs because it touches the
// filesystem, and its caller is type checked.

/** One test file and the tools modules it imports. */
export type TestImports = {
  file: string;
  modules: string[];
};

/** Every rule-carrying module in tools/, by module name, sorted. */
export function declaredModules(root: string): string[];

/** Declarations with no module behind them, sorted. */
export function orphanDeclarations(root: string): string[];

/** The tools modules one source file imports, in source order. */
export function moduleImports(source: string): string[];

/** Every test file under test/, with the tools modules it imports. */
export function testImports(root: string): TestImports[];

/** The modules nothing in `imported` reaches. */
export function unarmed(modules: string[], imported: string[]): string[];

/** Rule-carrying modules no test imports, so nothing runs them. */
export function unarmedGuards(root: string): string[];
