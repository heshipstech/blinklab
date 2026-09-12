import { describe, expect, it } from "vitest";

import { citedDocs } from "../../src/core/docCitations";
import { IDLE_READOUTS } from "../../src/core/idleStrings";
import {
  METRIC_PROVENANCE,
  kindSentence,
  metricProvenance,
  provenanceText,
} from "../../src/core/metricProvenance";

// Roadmap 14.3. Every rendered metric names its status in the
// record's real taxonomy, and the table here is the single source the
// popovers read. These tests hold the table to the page's own metric
// registry (the idle readout list) in both directions, and hold every
// "measured" status to at least one committed document, because a
// status that claims a measurement and cites nothing is the exact
// sentence this row exists to retire.

const labels = IDLE_READOUTS.map(([label]) => label);

describe("the provenance table covers the page's metrics exactly", () => {
  it("has an entry for every idle readout", () => {
    const missing = labels.filter(
      (label) => METRIC_PROVENANCE[label] === undefined,
    );
    expect(missing, "rendered metrics with no provenance entry").toEqual([]);
  });

  it("names no metric the page has stopped rendering", () => {
    const rendered = new Set(labels);
    const fossils = Object.keys(METRIC_PROVENANCE).filter(
      (label) => !rendered.has(label),
    );
    expect(fossils, "provenance entries for metrics not on the page").toEqual(
      [],
    );
  });

  it("refuses a label it has never heard of", () => {
    expect(() => metricProvenance("Brand new number")).toThrow(
      /no provenance entry/,
    );
  });
});

describe("every status speaks the record's taxonomy", () => {
  it("cites at least one committed document for every measured status", () => {
    for (const [label, entry] of Object.entries(METRIC_PROVENANCE)) {
      if (entry.kind === "measured") {
        expect(
          citedDocs(entry.status).length,
          `"${label}" claims a measurement and cites nothing`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("writes each status as at least one whole sentence", () => {
    for (const [label, entry] of Object.entries(METRIC_PROVENANCE)) {
      expect(entry.status.endsWith("."), `"${label}" trails off`).toBe(true);
      expect(entry.status.length, `"${label}" says nothing`).toBeGreaterThan(
        20,
      );
    }
  });

  it("gives each kind its own opening sentence", () => {
    expect(kindSentence("measured")).toContain("committed result");
    expect(kindSentence("convention")).toContain("fixed in advance");
    expect(kindSentence("unvalidated")).toContain("No ground truth");
    expect(kindSentence("bookkeeping")).toContain("its own work");
  });

  it("prefixes the popover text with the kind's sentence", () => {
    const entry = metricProvenance("Feature records");
    expect(provenanceText("Feature records")).toBe(
      `${kindSentence(entry.kind)} ${entry.status}`,
    );
  });
});

describe("the three statuses the roadmap row names, pinned", () => {
  // Row 14.3's own parenthetical is the acceptance test: the score is
  // cohort-level and unvalidated per person, PERCLOS is an
  // instrument-adjusted convention that includes blink time, and the
  // fixation split is conditioned on the device's delivered rate.
  it("the score is cohort-level AUC 0.70 and unvalidated per person", () => {
    const status = metricProvenance("Alertness score").status;
    expect(status).toContain("AUC 0.70");
    expect(status).toContain("across strangers");
    expect(status.toLowerCase()).toContain("unvalidated per person");
    expect(citedDocs(status)).toContain("docs/alertness-score-result.txt");
  });

  it("PERCLOS is an instrument-adjusted convention including blink time", () => {
    const status = metricProvenance(
      "PERCLOS (eyes closed share, last 60 s)",
    ).status;
    expect(status).toContain("instrument-adjusted");
    expect(status).toContain("blink time");
    expect(status).toContain("not comparable to published PERCLOS");
  });

  it("the fixation split is conditioned on the delivered rate", () => {
    for (const label of ["Gaze state", "Fixations in the last 10 s"]) {
      expect(metricProvenance(label).status).toContain("delivered frame rate");
    }
  });
});
