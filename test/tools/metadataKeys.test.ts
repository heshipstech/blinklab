import { describe, expect, it } from "vitest";

import {
  declaredMetadataKeys,
  exportRowBuilders,
  keysIn,
  specMetadataKeys,
  specPresenceRules,
  stripComments,
} from "../../tools/metadataKeys.mjs";
import { repoRoot } from "../../tools/resultGuard.mjs";

// Roadmap 10.1f1, ladder D6 and B16. The metadata contract, from the
// TypeScript side. `analysis/tests/test_metadata_contract.py` reads the
// same keys out of the same writers and holds them to its own list;
// this holds them to SPEC.md's table.
//
// Both sides are needed, and the reason was measured rather than
// assumed. Renaming `sampled_fps` in `sessionMetadata.ts` reddened
// three Python tests and left the whole TypeScript suite green. So the
// browser could rename a key its own suite never mentions and only the
// analysis track would notice, on a machine nobody may run that day —
// and `sampled_fps` is the key the session verdict is derived from on
// both sides of the border.

const root = repoRoot();

describe("the reader", () => {
  it("finds a call that wraps across lines", () => {
    // Thirteen keys in sessionMetadata.ts are written this way. A
    // one-line pattern finds none of them and reports success.
    expect([
      ...keysIn('    line(\n      "user_agent",\n      x,\n    ),'),
    ]).toEqual(["user_agent"]);
  });

  it("reduces a per-index family to its family name", () => {
    expect([...keysIn("line(`marker_${marker.index}_seconds`, v)")]).toEqual([
      "marker_N_seconds",
    ]);
  });

  it("does not read the format described in a comment", () => {
    // Every writer explains itself with a `# key: value` example, and
    // none of them writes a key called `key`.
    expect([...keysIn("// rows as `# key: value` lines\n")]).toEqual([]);
    expect([...keysIn("/* the `# key: value` block */\n")]).toEqual([]);
    expect(stripComments("a // b\nc")).toBe("a \nc");
  });

  it("finds a bare template row", () => {
    expect([...keysIn("`# frames_measured: ${n}`")]).toEqual([
      "frames_measured",
    ]);
  });
});

describe("the contract", () => {
  it("finds a useful number of keys, so a green result means something", () => {
    // A reader that broke would return nothing, and the comparison
    // below would then be empty against empty.
    expect(declaredMetadataKeys(root).length).toBeGreaterThan(40);
    expect(specMetadataKeys(root).length).toBeGreaterThan(40);
  });

  it("documents every key the writers emit, and invents none", () => {
    expect(specMetadataKeys(root)).toEqual(declaredMetadataKeys(root));
  });

  it("carries the keys the analysis track actually reads", () => {
    // Named here as well as in the Python list, so a rename on this
    // side reddens THIS suite rather than only the other one. These
    // five are the ones a Python gate would silently default on.
    const keys = declaredMetadataKeys(root);
    for (const key of [
      "sampled_fps",
      "pose_valid_fraction",
      "calibration_samples",
      "measurement_mode",
      "participant_pseudonym",
    ]) {
      expect(keys, `${key} is read by the analysis track`).toContain(key);
    }
  });
});

describe("when each key is written", () => {
  // Roadmap 10.1f3. `test/core/metadataPresence.test.ts` does the
  // exercising; these are the floors under the two readers it uses, so
  // a reader that quietly stopped finding anything could not carry it.

  it("reads a when-written rule for every documented key", () => {
    const rules = specPresenceRules(root);
    expect(Object.keys(rules).sort()).toEqual(specMetadataKeys(root));
    expect(rules["source"]).toBe("Every export");
  });

  it("reads the export's own row builders rather than a copy of them", () => {
    const builders = exportRowBuilders(root);
    expect(builders.length).toBeGreaterThan(8);
    expect(builders[0]).toBe("sourceMetadataRows");
    expect(builders).toContain("provenanceMetadataRows");
    // Each name appears once: a list with a duplicate would make the
    // presence test's order comparison pass on a coincidence.
    expect(new Set(builders).size).toBe(builders.length);
  });

  it("refuses a tree it cannot find the export in", () => {
    // The silent success this repository keeps meeting: a reader that
    // returned nothing here would report an empty builder list, and a
    // test comparing two empty lists is a test of nothing.
    expect(() => exportRowBuilders("/nonexistent")).toThrow();
  });
});
