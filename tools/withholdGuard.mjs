import { readRepoFile } from "./resultGuard.mjs";

// What the refusal actually withholds, read out of main.ts. Roadmap
// 10.13a, ladder A8.
//
// docs/calibration-refusal.txt promises that "numbers that depend on
// the blink line are withheld rather than guessed", and lists blink
// durations among them. The record wrote them anyway: only the rate
// was nulled, so a refused session exported durations, amplitudes and
// velocities measured against a line the instrument had just said it
// could not vouch for.
//
// A refusal cannot be reached in the end-to-end suite, because it
// needs a learning window that froze ceiling-bound and that needs a
// real face in front of a real camera. So this reads the wiring
// instead: the four blink fields in the record assembly must each be
// guarded by the one `withheld` decision. A pin on the source rather
// than on behaviour is weaker than a test, and it is what is available
// here; it is at least a pin on the thing itself rather than on a
// description of it.

/** The record fields the refusal must withhold, and nothing less. */
export const WITHHELD_FIELDS = [
  "blinkRatePerMin",
  "lastBlinkDurationMs",
  "lastBlinkAmplitudeMm",
  "lastBlinkPeakVelocityMmPerS",
];

/** The `assembleFeatureRecord({ ... })` call in main.ts, as text. */
export function recordAssembly(root) {
  const source = readRepoFile("src/main.ts", root);
  const start = source.indexOf("assembleFeatureRecord({");
  if (start === -1) {
    throw new Error("main.ts no longer assembles a feature record");
  }
  // To the matching close, counted rather than matched with a regex: a
  // record literal holds nested braces and objects.
  let depth = 0;
  for (let i = source.indexOf("{", start); i < source.length; i += 1) {
    const char = source[i];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }
  throw new Error("the feature record assembly is not closed");
}

/**
 * The fields whose value in that assembly does NOT mention `withheld`.
 *
 * A field is taken to run from its own name to the next field's name,
 * which is why the list above is checked in the order the assembly
 * writes them.
 */
export function fieldsNotWithheld(root) {
  const assembly = recordAssembly(root);
  const missing = [];
  for (const field of WITHHELD_FIELDS) {
    const at = assembly.indexOf(`${field}:`);
    if (at === -1) {
      missing.push(field);
      continue;
    }
    const rest = assembly.slice(at);
    const nextField = /\n\s{12}[a-zA-Z]+:/.exec(rest.slice(field.length + 1));
    const value = rest.slice(
      0,
      nextField === null ? undefined : field.length + 1 + nextField.index,
    );
    if (!value.includes("withheld")) {
      missing.push(field);
    }
  }
  return missing;
}
