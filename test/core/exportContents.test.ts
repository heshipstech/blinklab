import { describe, expect, it } from "vitest";

import {
  DISCLOSED_METADATA_KEYS,
  exportContentsSentence,
  writtenMetadataKeys,
} from "../../src/core/exportContents";

// Roadmap 10.0a2, ladder B2. A person clicking Export CSV is told
// nothing about what the file carries beyond the per-second records.
// It also carries a camera label, a browser string, the machine's core
// count, its screen and viewport sizes, the two sleepiness answers and
// a pseudonym if one was set. None of that is secret and none of it is
// wrong to write; the defect is that the page asks people to email
// these files and never says what is in them.
//
// So the sentence is a tested constant derived from the metadata keys
// themselves, shown beside the export buttons and quoted into README.
// It refuses to be built when a key it names has left the export,
// because a disclosure that lists a row nobody writes is the same
// defect pointing the other way.

// Read out of the row builders, not typed out beside them: a row that
// leaves the export must take its disclosure with it.
const REAL_KEYS = writtenMetadataKeys();

describe("what the export says it contains", () => {
  it("names every disclosed key in one sentence", () => {
    const sentence = exportContentsSentence(REAL_KEYS);
    for (const key of DISCLOSED_METADATA_KEYS) {
      expect(sentence, `the sentence never mentions ${key}`).toContain(key);
    }
  });

  it("says the file stays on this device", () => {
    // The disclosure exists to be read before someone emails the file,
    // so it has to say both halves: what is in it, and that sending it
    // is the reader's own act.
    const sentence = exportContentsSentence(REAL_KEYS);
    expect(sentence).toContain("your own disk");
    expect(sentence).toContain("nothing is uploaded");
  });

  it("refuses when a key it names is no longer written", () => {
    // A row removed from the export must break this sentence rather
    // than leave it describing a file that no longer exists.
    const without = REAL_KEYS.filter((key) => key !== "user_agent");
    expect(() => exportContentsSentence(without)).toThrow(/user_agent/);
  });

  it("reads its key list out of the row builders", () => {
    // If this ever stops holding, the list below was typed by hand
    // again and the derivation is decoration.
    expect(REAL_KEYS).toContain("user_agent");
    expect(REAL_KEYS).toContain("user_agent_form");
    expect(REAL_KEYS).toContain("participant_pseudonym");
  });

  it("names only keys the export actually writes", () => {
    // The other direction: a disclosed key invented here and never
    // written would be a promise about a file nobody produces.
    for (const key of DISCLOSED_METADATA_KEYS) {
      expect(REAL_KEYS, `${key} is disclosed but never written`).toContain(key);
    }
  });
});
