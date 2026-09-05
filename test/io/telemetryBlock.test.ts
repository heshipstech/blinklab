import { describe, expect, it, vi } from "vitest";

import { installTelemetryBlock } from "../../src/io/telemetryBlock";

// ADR-0004. installTelemetryBlock wraps the three ways a browser can
// send a request — fetch, XMLHttpRequest and sendBeacon — so that a URL
// the core policy blocks (any googleapis.com host) is dropped before it
// reaches the network, and the caller is handed a synthetic success so
// a fire-and-forget telemetry call neither throws nor hangs. Everything
// else is passed straight through untouched.
//
// The installer takes its target as an argument, defaulting to
// globalThis in the app, so these tests hand it a fake window and watch
// what it does to each transport without a real browser.

const BLOCKED = "https://odml.pa.googleapis.com/v1/log";
const ALLOWED = "/mediapipe-wasm/vision_wasm_internal.js";

function makeTarget() {
  const realFetch = vi.fn(async () => new Response("ok", { status: 200 }));

  const reallySent = vi.fn();
  // A fresh class per target: the installer patches the prototype, so a
  // shared class would carry one test's patch into the next.
  class FakeXHR {
    url = "";
    open(_method: string, url: string): void {
      this.url = url;
    }
    send(): void {
      reallySent(this.url);
    }
    dispatchEvent(): boolean {
      return true;
    }
  }

  const realSendBeacon = vi.fn(
    (_url: string | URL, _data?: BodyInit | null) => true,
  );
  const navigator = { sendBeacon: realSendBeacon };

  const target = {
    fetch: realFetch as unknown as typeof fetch,
    XMLHttpRequest: FakeXHR as unknown as typeof XMLHttpRequest,
    navigator,
  };
  return { target, realFetch, reallySent, realSendBeacon };
}

describe("fetch", () => {
  it("drops a blocked URL and resolves a synthetic 204", async () => {
    const { target, realFetch } = makeTarget();
    installTelemetryBlock(target);

    const response = await target.fetch(BLOCKED);

    expect(realFetch).not.toHaveBeenCalled();
    expect(response.status).toBe(204);
  });

  it("passes an allowed URL through to the real fetch", async () => {
    const { target, realFetch } = makeTarget();
    installTelemetryBlock(target);

    const response = await target.fetch(ALLOWED);

    expect(realFetch).toHaveBeenCalledWith(ALLOWED, undefined);
    expect(response.status).toBe(200);
  });

  it("reads the URL from a Request object, not only a string", async () => {
    const { target, realFetch } = makeTarget();
    installTelemetryBlock(target);

    const response = await target.fetch(new Request(BLOCKED));

    expect(realFetch).not.toHaveBeenCalled();
    expect(response.status).toBe(204);
  });
});

describe("XMLHttpRequest", () => {
  it("does not send a blocked URL", () => {
    const { target, reallySent } = makeTarget();
    installTelemetryBlock(target);

    const xhr = new target.XMLHttpRequest();
    xhr.open("POST", BLOCKED);
    xhr.send();

    expect(reallySent).not.toHaveBeenCalled();
  });

  it("sends an allowed URL as normal", () => {
    const { target, reallySent } = makeTarget();
    installTelemetryBlock(target);

    const xhr = new target.XMLHttpRequest();
    xhr.open("GET", ALLOWED);
    xhr.send();

    expect(reallySent).toHaveBeenCalledOnce();
  });
});

describe("sendBeacon", () => {
  it("drops a blocked URL and reports it queued", () => {
    const { target, realSendBeacon } = makeTarget();
    installTelemetryBlock(target);

    const queued = target.navigator.sendBeacon(BLOCKED);

    expect(realSendBeacon).not.toHaveBeenCalled();
    expect(queued).toBe(true);
  });

  it("passes an allowed URL through to the real sendBeacon", () => {
    const { target, realSendBeacon } = makeTarget();
    installTelemetryBlock(target);

    target.navigator.sendBeacon(ALLOWED);

    expect(realSendBeacon).toHaveBeenCalledOnce();
  });
});

describe("installation", () => {
  it("is idempotent: installing twice does not double-wrap", async () => {
    const { target, realFetch } = makeTarget();
    installTelemetryBlock(target);
    installTelemetryBlock(target);

    await target.fetch(ALLOWED);
    expect(realFetch).toHaveBeenCalledOnce();

    await target.fetch(BLOCKED);
    expect(realFetch).toHaveBeenCalledOnce();
  });

  it("does not throw when a transport is absent", () => {
    // An environment with no XHR and no navigator (a worker, a test
    // runner) must still install the fetch guard without crashing.
    const only = {
      fetch: vi.fn(async () => new Response()) as unknown as typeof fetch,
    };
    expect(() => installTelemetryBlock(only)).not.toThrow();
  });
});
