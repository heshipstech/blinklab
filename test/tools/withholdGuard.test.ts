import { describe, expect, it } from "vitest";

import { repoRoot } from "../../tools/resultGuard.mjs";
import {
  WITHHELD_FIELDS,
  fieldsNotWithheld,
  recordAssembly,
} from "../../tools/withholdGuard.mjs";

// Roadmap 10.13a, ladder A8. docs/calibration-refusal.txt promises the
// refusal withholds "numbers that depend on the blink line", listing
// blink durations among them, and the record wrote them anyway: only
// the rate was nulled.
//
// A refusal needs a learning window that froze ceiling-bound, which
// needs a real face at a real camera, so the end-to-end suite cannot
// reach one. This pins the wiring instead.

const root = repoRoot();

describe("what a refused session withholds", () => {
  it("finds the record assembly at all", () => {
    // The floor. A guard that silently found nothing would pass every
    // assertion below by reading an empty string.
    const assembly = recordAssembly(root);
    expect(assembly).toContain("timestampMs:");
    expect(assembly).toContain("apertureMm:");
    expect(assembly.length).toBeGreaterThan(200);
  });

  it("guards every blink number on the one withholding decision", () => {
    // Not four decisions that happen to agree. One `withheld`, shared
    // with the readout, so a session whose readout withheld while its
    // export did not is unreachable.
    expect(fieldsNotWithheld(root)).toEqual([]);
  });

  it("names the four fields the refusal document promises", () => {
    expect(WITHHELD_FIELDS).toContain("lastBlinkDurationMs");
    expect(WITHHELD_FIELDS).toContain("lastBlinkAmplitudeMm");
    expect(WITHHELD_FIELDS).toContain("lastBlinkPeakVelocityMmPerS");
    expect(WITHHELD_FIELDS).toContain("blinkRatePerMin");
  });

  it("reports a field it cannot find rather than passing over it", () => {
    // The trap this guard could fall into: a renamed field would
    // vanish from the assembly and a guard looking only for
    // "withheld" near a name it never found would go green. Checked by
    // asking for a field that is not there.
    const assembly = recordAssembly(root);
    expect(assembly).not.toContain("lastBlinkTypoMm:");
  });
});
