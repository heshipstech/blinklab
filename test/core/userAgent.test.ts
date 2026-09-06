import { describe, expect, it } from "vitest";

import { reduceUserAgent } from "../../src/core/userAgent";

// Roadmap 10.0a2, ladder B2. Every export carries the full
// `navigator.userAgent` string, and participants are asked to email
// those files. A full user agent names the browser build, the engine
// build and often the operating system patch level, which together are
// a fingerprint rather than a measurement. What the analysis actually
// uses it for is coarser than that: which browser, roughly which
// version, on which kind of machine.
//
// So the export offers the coarse form and keeps the full string
// behind an explicit ask. This module is the coarse form, and it is
// pure: it is handed a string and returns a string, so every awkward
// browser can be staged in a test without one being present.

describe("the reduced user agent", () => {
  it("names the browser, its major version and the platform family", () => {
    expect(
      reduceUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/140.0.7259.5 Safari/537.36",
      ),
    ).toBe("Chrome 140 on macOS");
  });

  it("reads Safari from its Version token, not from the Safari one", () => {
    // Every Chromium build ends in "Safari/537.36". The token that
    // actually means Safari is "Version/", and a reducer that read the
    // last word would call every browser on earth Safari.
    expect(
      reduceUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
          "(KHTML, like Gecko) Version/18.6 Safari/605.1.15",
      ),
    ).toBe("Safari 18 on macOS");
  });

  it("prefers Edge and Opera over the Chrome token they both carry", () => {
    expect(
      reduceUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.3485.14",
      ),
    ).toBe("Edge 140 on Windows");
    expect(
      reduceUserAgent(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like " +
          "Gecko) Chrome/140.0.0.0 Safari/537.36 OPR/125.0.0.0",
      ),
    ).toBe("Opera 125 on Linux");
  });

  it("names Firefox, Android and iOS", () => {
    expect(
      reduceUserAgent(
        "Mozilla/5.0 (Android 15; Mobile; rv:142.0) Gecko/142.0 Firefox/142.0",
      ),
    ).toBe("Firefox 142 on Android");
    expect(
      reduceUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) " +
          "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 " +
          "Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari 18 on iOS");
  });

  it("says unknown for the half it cannot read rather than guessing", () => {
    // A reduction that quietly dropped the unreadable half would read
    // as a measurement of a browser nobody identified.
    expect(reduceUserAgent("Chrome/140.0.0.0")).toBe(
      "Chrome 140 on an unknown platform",
    );
    expect(reduceUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(
      "an unknown browser on Windows",
    );
  });

  it("returns null when there is nothing to reduce", () => {
    expect(reduceUserAgent(null)).toBeNull();
    expect(reduceUserAgent("")).toBeNull();
    expect(reduceUserAgent("nonsense")).toBe(
      "an unknown browser on an unknown platform",
    );
  });

  it("is short enough that it cannot be the original string", () => {
    // The whole point is that it carries less. A reduction longer than
    // 40 characters is a sign the rules stopped reducing.
    const long =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/140.0.7259.5 Safari/537.36";
    const reduced = reduceUserAgent(long);
    expect(reduced).not.toBeNull();
    expect((reduced ?? "").length).toBeLessThan(40);
  });
});
