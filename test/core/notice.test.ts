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
    expect(notice).toContain("no data leaves your device");
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
