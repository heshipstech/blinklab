import { describe, expect, it } from "vitest";

import { isBlockedTelemetryUrl } from "../../src/core/telemetryPolicy";

// ADR-0004. The vendored MediaPipe bundle POSTs usage statistics to
// https://odml.pa.googleapis.com/v1/log about a minute after the face
// model is created, needing no detections. The block that stops it
// hangs off this one pure decision: is a URL one we refuse to let leave
// the page? The io layer wraps fetch, XHR and sendBeacon, but the rule
// they all consult is here, where it can be checked without a browser.
//
// The whole point is that the app makes no legitimate call to any
// googleapis.com host: the WASM runtime and the model are vendored and
// served same origin. So the rule is host-based and total, and these
// tests pin the traps that a looser rule would fall into.

describe("the telemetry URL the model tries to send", () => {
  it("blocks the exact endpoint ADR-0004 measured", () => {
    expect(isBlockedTelemetryUrl("https://odml.pa.googleapis.com/v1/log")).toBe(
      true,
    );
  });

  it("blocks the apex googleapis.com host", () => {
    expect(isBlockedTelemetryUrl("https://googleapis.com/anything")).toBe(true);
  });

  it("blocks any subdomain of googleapis.com", () => {
    expect(isBlockedTelemetryUrl("https://storage.googleapis.com/x")).toBe(
      true,
    );
  });

  it("blocks a protocol-relative URL naming the host", () => {
    // A request written as //host/path names a host but no scheme. The
    // matcher must still see the host, or a library could dodge the
    // block by dropping https:.
    expect(isBlockedTelemetryUrl("//odml.pa.googleapis.com/v1/log")).toBe(true);
  });

  it("matches the host case-insensitively", () => {
    expect(isBlockedTelemetryUrl("HTTPS://ODML.PA.GOOGLEAPIS.COM/v1/log")).toBe(
      true,
    );
  });
});

describe("everything the app legitimately loads", () => {
  it("allows a same-origin relative path", () => {
    // The model and WASM are served from our own origin as relative
    // URLs. Blocking these would break the app, not protect it.
    expect(
      isBlockedTelemetryUrl("/mediapipe-wasm/vision_wasm_internal.js"),
    ).toBe(false);
  });

  it("allows an unparseable string rather than guessing it is telemetry", () => {
    expect(isBlockedTelemetryUrl("not a url")).toBe(false);
    expect(isBlockedTelemetryUrl("")).toBe(false);
  });
});

describe("the near misses a looser rule would catch or miss", () => {
  it("does not block a host that only mentions googleapis in its path", () => {
    // The host is example.com; the string googleapis.com is in the path.
    // A substring rule would wrongly block this.
    expect(isBlockedTelemetryUrl("https://example.com/googleapis.com")).toBe(
      false,
    );
  });

  it("does not block a look-alike host that merely ends in the letters", () => {
    // notgoogleapis.com ends with "googleapis.com" but is a different
    // registrable domain. Only a dot-boundary match is correct.
    expect(isBlockedTelemetryUrl("https://notgoogleapis.com/x")).toBe(false);
    expect(isBlockedTelemetryUrl("https://evilgoogleapis.com/x")).toBe(false);
  });
});
