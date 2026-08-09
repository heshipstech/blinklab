import { describe, expect, it } from "vitest";

import {
  builtBundle,
  checkBundle,
  servedBundle,
  type BundleResult,
  type CheckResult,
} from "../../tools/bundleGuard.mjs";

// Narrowing helpers. `expect` does not teach TypeScript anything, so
// without these every assertion on a refusal reads as a possible
// success and the compiler is right to complain.
function refusal(result: CheckResult): string {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected a refusal, got a match");
  return result.message;
}

function refusedBundle(result: BundleResult): string {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected a refusal, got a bundle");
  return result.reason;
}

function acceptedBundle(result: BundleResult): string {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected a bundle, got a refusal");
  return result.bundle;
}

// The two real bundle names from 9 August 2026. BPaEeGYT is what the
// blink log fix built. CcVgRq3D is what the leftover server from the
// night before was still serving, and measuring it produced a false
// result of 69.1% that read as a real one.
const BUILT = "index-BPaEeGYT.js";
const STALE = "index-CcVgRq3D.js";

const pageServing = (bundle: string): string =>
  `<!doctype html><html><head><script type="module" crossorigin src="/blinklab/assets/${bundle}"></script></head><body><div id="app"></div></body></html>`;

describe("builtBundle, what this repository has built", () => {
  it("finds the one bundle among the other build output", () => {
    const result = builtBundle([BUILT, "index-D4kQ1a.css", "logo.svg"]);
    expect(result).toEqual({ ok: true, bundle: BUILT });
  });

  it("refuses when nothing was built", () => {
    expect(builtBundle(["logo.svg"]).ok).toBe(false);
    expect(refusedBundle(builtBundle([]))).toBe("no-build");
  });

  it("refuses two bundles rather than picking one", () => {
    // Which one the server is serving is exactly the question, so
    // guessing here would defeat the whole guard.
    expect(refusedBundle(builtBundle([BUILT, STALE]))).toBe("many-builds");
  });
});

describe("servedBundle, what the page actually references", () => {
  it("reads the bundle out of a served page", () => {
    expect(servedBundle(pageServing(STALE))).toEqual({
      ok: true,
      bundle: STALE,
    });
  });

  it("counts a name repeated in the page once", () => {
    // A preload hint plus the script tag is two mentions of one bundle,
    // which is normal and must not read as two bundles.
    const html = `<link rel="modulepreload" href="/assets/${BUILT}"><script src="/assets/${BUILT}"></script>`;
    expect(servedBundle(html)).toEqual({ ok: true, bundle: BUILT });
  });

  it("refuses a page with no bundle at all", () => {
    // Something is answering on the port, but it is not this app.
    expect(servedBundle("<html><body>hello</body></html>").ok).toBe(false);
  });

  it("accepts hashes containing dash and underscore", () => {
    // Vite hashes are base64url, so these characters are legal and a
    // stricter pattern would reject a real bundle.
    expect(acceptedBundle(servedBundle(pageServing("index-a_b-C9.js")))).toBe(
      "index-a_b-C9.js",
    );
  });
});

describe("checkBundle, the decision", () => {
  it("agrees when the server serves what we built", () => {
    const result = checkBundle({
      distFileNames: [BUILT, "index-x.css"],
      html: pageServing(BUILT),
    });
    expect(result).toEqual({ ok: true, bundle: BUILT });
  });

  // THE REGRESSION. This is 9 August 2026 exactly: a fresh build on
  // disk, a leftover server answering with the previous night's bundle,
  // and an HTTP 200 that made it all look fine.
  it("refuses the 9 August case, a stale server answering happily", () => {
    const message = refusal(
      checkBundle({ distFileNames: [BUILT], html: pageServing(STALE) }),
    );
    expect(message).toContain("REFUSING TO MEASURE");
    // Both names must appear, or the reader cannot tell which is which.
    expect(message).toContain(BUILT);
    expect(message).toContain(STALE);
  });

  it("tells the reader how to fix every refusal", () => {
    // The failure this guards against LOOKED like success. A message
    // that only says "mismatch" leaves the reader in the same fog that
    // cost twenty minutes.
    const cases = [
      { distFileNames: [], html: pageServing(BUILT) },
      { distFileNames: [BUILT, STALE], html: pageServing(BUILT) },
      { distFileNames: [BUILT], html: "<html></html>" },
      { distFileNames: [BUILT], html: pageServing(STALE) },
    ];
    for (const input of cases) {
      const message = refusal(checkBundle(input));
      expect(message.length).toBeGreaterThan(40);
      // Every refusal names a command the reader can run.
      expect(message).toMatch(/npm run build|lsof|Delete dist/);
    }
  });
});
