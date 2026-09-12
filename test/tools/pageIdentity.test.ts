import { describe, expect, it } from "vitest";

import { citedDocs } from "../../src/core/docCitations";
import {
  BRAND_INK,
  CONTENT_SECURITY_POLICY,
  EYE_OUTLINE_PATH,
  PAGE_DESCRIPTION,
  REPOSITORY_URL,
} from "../../src/core/pageIdentity";
import { readRepoFile, repoRoot } from "../../tools/resultGuard.mjs";
import { linkHrefs, missingRepoFiles } from "../../tools/uiGuard.mjs";

// Roadmap 14.0f2 [E7]. Three checks over the page's identity and its
// citations, all reading the disk.
//
// The audit's finding was that the honesty apparatus this project
// spent phases building is unreachable from the surface people
// actually visit: the conditions sentences cite `docs/*.txt` as bare
// paths, the nav bar links a profile and a mailbox but not the source,
// and `index.html` is twelve lines with no description and no icon.

const root = repoRoot();
const main = readRepoFile("src/main.ts", root);
const indexHtml = readRepoFile("index.html", root);

describe("no citation on this page dangles", () => {
  it("names a file for every document src cites", () => {
    // Every `docs/...` path anywhere in src/, comments included. A
    // comment citing a renamed file is a smaller defect than a link
    // that 404s, but it is the same defect, and reading every path is
    // simpler than deciding which ones reach the page.
    //
    // Honest about what this is: PREVENTIVE. All of them exist today,
    // so this caught nothing on the day it was written. It exists
    // because a rename is the cheapest way to break a citation and
    // nothing was watching for one.
    const cited = citedDocs(main)
      .concat(citedDocs(readRepoFile("src/core/samplingBounds.ts", root)))
      .concat(citedDocs(readRepoFile("src/core/fpsGate.ts", root)));
    const dangling = missingRepoFiles(cited, root);
    expect(
      dangling,
      `these documents are cited in src/ and do not exist: ${dangling.join(", ")}`,
    ).toEqual([]);
  });

  it("would notice one that does not exist", () => {
    // The check's own check, on a string rather than on the disk, so a
    // repository that happens to be clean cannot make it pass for the
    // wrong reason.
    const invented = citedDocs("see docs/no-such-document.txt for the rule");
    expect(invented).toEqual(["docs/no-such-document.txt"]);
    expect(missingRepoFiles(invented, root)).toEqual(invented);
  });

  it("reads the sentences that actually carry citations today", () => {
    // So the first test cannot pass by reading nothing.
    const cited = citedDocs(readRepoFile("src/core/samplingBounds.ts", root));
    expect(cited).toContain("docs/sampling-bounds.txt");
    expect(cited).toContain("docs/aperture-noise-floor.txt");
  });
});

describe("the tab icon is the mark the page already draws", () => {
  it("exists at all, which it did not until this row", () => {
    expect(missingRepoFiles(["public/favicon.svg"], root)).toEqual([]);
  });

  it("is the nav bar's own eye, not a second drawing of one", () => {
    // The held no-favicon choice is decided here by deciding as little
    // as possible: the icon is the mark the nav bar draws, on the
    // page's own ink, so nothing new was chosen about how this project
    // looks. Holding the path data to the module keeps it that way —
    // an icon redrawn without the header turns this red.
    const favicon = readRepoFile("public/favicon.svg", root);
    expect(favicon).toContain(EYE_OUTLINE_PATH);
    expect(favicon).toContain(BRAND_INK);
  });

  it("draws the same path in the nav bar, from the same constant", () => {
    // Stronger than the two files agreeing: the nav mark reads its
    // path from the module the icon is held to, so they cannot drift
    // even in principle.
    expect(main).toContain("EYE_OUTLINE_PATH");
    expect(main).not.toContain(EYE_OUTLINE_PATH);
  });

  it("is linked from the page", () => {
    expect(indexHtml).toContain("favicon.svg");
  });
});

describe("the page says what it is", () => {
  it("carries the description core owns, word for word", () => {
    expect(indexHtml).toContain(PAGE_DESCRIPTION);
  });

  it("claims nothing about where data goes", () => {
    // The shortest natural description of this page reaches for "no
    // data leaves your device", which is a RETIRED claim: it was
    // measured false. `claimGuard` walks index.html like every other
    // tracked file, so this is belt and braces — stated here because
    // the temptation belongs to descriptions specifically.
    expect(PAGE_DESCRIPTION).not.toMatch(/leaves?\s+(your|the|this)\s+device/i);
  });

  it("still carries the demo notice, which is not dropped for length", () => {
    expect(PAGE_DESCRIPTION).toContain("not a medical device");
  });
});

describe("the page carries its network policy in its own head", () => {
  // Roadmap 10.2b [D9]. GitHub Pages serves a fixed header set, so the
  // Content-Security-Policy is delivered as a meta tag in the page
  // itself — the one delivery this repository controls. The policy is
  // held to core the same way the description is, so the tag cannot
  // drift from the module that documents why each source is allowed.

  it("ships the Content-Security-Policy core owns, word for word", () => {
    expect(indexHtml).toContain('http-equiv="Content-Security-Policy"');
    expect(indexHtml).toContain(CONTENT_SECURITY_POLICY);
  });

  it("restricts connections, and connections only", () => {
    // connect-src alone, starting at 'self': scripts, styles, media
    // and workers keep their defaults, because the residual this row
    // closes is the NETWORK CALL (ADR-0004's telemetry attempt), and
    // a directive wider than its evidence would be a guess shipped to
    // real Safari users before the WebKit run that would catch it.
    expect(CONTENT_SECURITY_POLICY).toMatch(/^connect-src 'self'/);
    expect(CONTENT_SECURITY_POLICY).not.toContain(";");
  });
});

describe("the page links to its own source", () => {
  it("finds a link built from a quoted URL", () => {
    expect(linkHrefs('iconLink(\n  "https://example.com/x",\n  "X",')).toEqual([
      "https://example.com/x",
    ]);
  });

  it("finds one built from a constant, which the first version did not", () => {
    // The reader saw only quoted strings, so it went quiet the moment
    // this link's URL moved into a shared constant — the direction
    // this repository keeps moving things. A guard that falls silent
    // when the code improves is a guard that will be silent on the day
    // something is missing.
    expect(linkHrefs('iconLink(\n  REPOSITORY_URL,\n  "Source",')).toEqual([
      "REPOSITORY_URL",
    ]);
  });

  it("has a repository link, which the nav bar did not", () => {
    // The nav bar held a profile and a mailbox. A page whose whole
    // argument is that its numbers can be audited did not link the
    // thing a reader would audit.
    expect(linkHrefs(main)).toContain("REPOSITORY_URL");
    expect(REPOSITORY_URL).toMatch(/^https:\/\/github\.com\/[^/]+\/blinklab$/);
  });
});
