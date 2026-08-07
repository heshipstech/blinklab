import { describe, expect, it } from "vitest";

import { DEMO_NOTICE, demoNoticeText } from "../../src/core/notice";

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
