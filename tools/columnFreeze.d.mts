// Types for the plain JavaScript guard next door. Same arrangement as
// drozyGuard, bundleGuard and resultGuard: the guard stays .mjs because
// it reads the disk, and its callers are type checked, because an
// untyped import makes every result `any`, which is how a guard
// silently stops guarding.

/** The manifest's home, owner-editable: docs/column-freeze.txt. */
export const MANIFEST_PATH: string;

/** One owner signature: the field, the dated sign-in, and the dated
 * sign-out when the field has retired (null while it is frozen). */
export type FreezeEntry = {
  field: string;
  signedIn: string;
  signedOut: string | null;
};

/** The verdict, as data rather than an exit code. */
export type FreezeVerdict = {
  ok: boolean;
  why: string;
};

/** The signature block: everything after the SIGNATURES heading. */
export function signatureBlock(manifestText: string): string;

/** Every signature entry in the manifest's SIGNATURES block. */
export function parseManifest(manifestText: string): FreezeEntry[];

/** The fields currently frozen: signed in and not signed out. */
export function frozenFields(manifestText: string): string[];

/** Every frozen field must be in the live header; none frozen is an
 * ok with its reason, never a silent pass. */
export function freezeVerdict(
  manifestText: string,
  liveColumns: readonly string[],
): FreezeVerdict;

/** The live per-second header, parsed from src/core/csv.ts's source. */
export function liveColumns(root: string): string[];

/** The committed manifest's text; throws when the file is gone. */
export function readManifest(root: string): string;
