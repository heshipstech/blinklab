// Types for the plain JavaScript guard next door.
//
// The guard itself stays .mjs because it runs under node with no build
// step, and a corpus run should not depend on a compiler being healthy.
// But its callers are type checked, and an untyped import would make
// every result `any`, which is how a guard silently stops guarding.

/** Either the one bundle we found, or why we refuse to guess. */
export type BundleResult =
  | { ok: true; bundle: string }
  | { ok: false; reason: "no-build" | "no-bundle-in-page" }
  | {
      ok: false;
      reason: "many-builds" | "many-bundles-in-page";
      bundles: string[];
    };

/**
 * The decision. Every refusal carries a message, and the message always
 * names a command the reader can run, because the failure this guards
 * against looked exactly like success.
 */
export type CheckResult =
  | { ok: true; bundle: string }
  | { ok: false; message: string; bundle?: string; served?: string };

export function builtBundle(distFileNames: readonly string[]): BundleResult;

export function servedBundle(html: string): BundleResult;

export function checkBundle(input: {
  distFileNames: readonly string[];
  html: string;
}): CheckResult;
