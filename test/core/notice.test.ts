import { describe, expect, it } from "vitest";

import {
  DEMO_NOTICE,
  demoNoticeShort,
  demoNoticeText,
} from "../../src/core/notice";

describe("the permanent demo notice", () => {
  it("says the four things it exists to say", () => {
    // Each phrase is a promise PROJECT.md made in its non-goals. A
    // reword that drops one of them fails here, which is the point
    // of holding the text in one tested place.
    const notice = demoNoticeText();
    expect(notice).toContain("not a safety or medical device");
    expect(notice).toContain("not for clinical, workplace or safety use");
    expect(notice).toContain("not");
    expect(notice.toLowerCase()).toContain("diagnostic");
    expect(notice).toContain("never leave your browser");
    // The claim that used to sit here was that nothing left the device
    // at all. It was false: the vendored model reports its own usage to
    // Google. The notice now names that rather than denying it, and
    // this assertion is what stops the pleasanter sentence coming back.
    // ADR-0004.
    expect(notice).toContain("usage statistics to Google");
    // And since 5 September the request is intercepted before it
    // leaves, so the notice names the attempt AND the interception.
    // Either half alone is a different promise: "does send" understates
    // the protection, "sends nothing" is the retired lie.
    expect(notice).toContain("tries to send");
    expect(notice).toContain(
      "this page intercepts the request before it leaves the browser",
    );
  });

  it("is one string, used everywhere, so the wording cannot drift", () => {
    expect(demoNoticeText()).toBe(DEMO_NOTICE);
  });

  it("is short enough to actually be read", () => {
    // A notice nobody finishes is decoration. Long enough to be
    // specific, short enough to survive a glance.
    expect(DEMO_NOTICE.length).toBeLessThan(400);
    expect(DEMO_NOTICE.length).toBeGreaterThan(80);
  });
});

describe("the short notice", () => {
  it("still says demo and still says not a medical device", () => {
    // The two claims that cannot be dropped however short it gets. A
    // number without them, screenshotted and shared, is the exact
    // failure the notice exists to prevent.
    expect(demoNoticeShort().toLowerCase()).toContain("demo");
    expect(demoNoticeShort().toLowerCase()).toContain(
      "not a safety or medical device",
    );
  });

  it("is short enough to sit under a number without wrapping into a paragraph", () => {
    // Not a style preference. A caveat that becomes a paragraph gets
    // skipped, and a skipped caveat protects nobody.
    expect(demoNoticeShort().length).toBeLessThan(70);
  });

  it("is not a substring of the long notice, so rewording cannot break it silently", () => {
    expect(demoNoticeText()).not.toContain(demoNoticeShort());
  });
});
