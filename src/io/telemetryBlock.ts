import { isBlockedTelemetryUrl } from "../core/telemetryPolicy";

// The telemetry block, ADR-0004's open question answered.
//
// The vendored MediaPipe bundle POSTs usage statistics to Google about
// a minute after the face model is created. We cannot patch the bundle
// without forking it, and a Content Security Policy strong enough to
// stop the call also complicates the same-origin WASM load. So the
// block lives here, in front of the browser's own send primitives:
// whichever one the library reaches for, the request is dropped before
// it leaves the page, and the caller is handed a synthetic success so a
// fire-and-forget POST neither throws nor hangs waiting on a reply.
//
// This is a net that catches, not a promise that the library will only
// ever throw one kind of ball. It wraps all three transports a page can
// use — fetch, XMLHttpRequest, sendBeacon — because which one MediaPipe
// uses is its implementation detail and could change under us. The pure
// decision of what counts as telemetry lives in core/telemetryPolicy,
// where it is tested without a browser; this file is only the plumbing
// that consults it.
//
// Install it before the model is ever created (main.ts does, at the
// top) so no request can slip out before the guard is up.

/** The pieces of a browser global this installer touches. */
interface TelemetryBlockTarget {
  fetch?: typeof fetch;
  XMLHttpRequest?: typeof XMLHttpRequest;
  navigator?: {
    sendBeacon?: (url: string | URL, data?: BodyInit | null) => boolean;
  };
}

// Idempotency is per target rather than a flag written onto it: the app
// installs once on globalThis, and the tests install on many throwaway
// fakes, and neither should be able to double-wrap. A WeakSet remembers
// which targets are already guarded without leaving a mark on them.
const guarded = new WeakSet<object>();

/** The URL a fetch argument names, as a string. */
function fetchUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

/**
 * A completed-but-empty success, so a caller awaiting the response sees
 * a 204 rather than a rejected promise. The block is silent on purpose:
 * telemetry that quietly succeeds is telemetry that does not retry.
 */
function noContent(): Response {
  return new Response(null, { status: 204, statusText: "No Content" });
}

/**
 * Tell an XHR caller its request finished, without a network round trip.
 *
 * A real XMLHttpRequest exposes status and readyState as read-only, so
 * the block cannot forge a 200 on the object. What it can do is fire the
 * lifecycle events a fire-and-forget sender listens for, so nothing is
 * left waiting on a load that will never come. Guarded because a
 * non-browser target (a worker, a bare test double) may have neither
 * Event nor a dispatcher.
 */
function completeQuietly(xhr: XMLHttpRequest): void {
  if (typeof Event === "undefined" || typeof xhr.dispatchEvent !== "function") {
    return;
  }
  queueMicrotask(() => {
    for (const type of ["readystatechange", "load", "loadend"]) {
      try {
        xhr.dispatchEvent(new Event(type));
      } catch {
        // A double never wired for events is fine to leave silent.
      }
    }
  });
}

function wrapFetch(target: TelemetryBlockTarget): void {
  const original = target.fetch;
  if (typeof original !== "function") {
    return;
  }
  const bound = original.bind(target);
  target.fetch = function blockedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    if (isBlockedTelemetryUrl(fetchUrl(input))) {
      return Promise.resolve(noContent());
    }
    return bound(input, init);
  };
}

function wrapXhr(target: TelemetryBlockTarget): void {
  const XHR = target.XMLHttpRequest;
  if (typeof XHR !== "function") {
    return;
  }
  const proto = XHR.prototype;
  const originalOpen = proto.open;
  const originalSend = proto.send;
  // Which instances are aimed at a blocked host, decided at open() and
  // read at send(). A WeakMap keeps that off the XHR objects themselves.
  const blocked = new WeakMap<XMLHttpRequest, boolean>();

  proto.open = function blockedOpen(
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ): void {
    blocked.set(
      this,
      isBlockedTelemetryUrl(typeof url === "string" ? url : String(url)),
    );
    // The real open only records the target; it sends nothing, so
    // calling it keeps the object valid for the events fired later.
    return (
      originalOpen as (
        this: XMLHttpRequest,
        method: string,
        url: string | URL,
        ...rest: unknown[]
      ) => void
    ).call(this, method, url, ...rest);
  };

  proto.send = function blockedSend(
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null,
  ): void {
    if (blocked.get(this)) {
      completeQuietly(this);
      return;
    }
    return originalSend.call(this, body);
  };
}

function wrapSendBeacon(target: TelemetryBlockTarget): void {
  const nav = target.navigator;
  if (!nav || typeof nav.sendBeacon !== "function") {
    return;
  }
  const bound = nav.sendBeacon.bind(nav);
  nav.sendBeacon = function blockedSendBeacon(
    url: string | URL,
    data?: BodyInit | null,
  ): boolean {
    if (isBlockedTelemetryUrl(typeof url === "string" ? url : String(url))) {
      // true means "queued for delivery"; nothing is queued, and the
      // caller has no way to tell, which is the whole point.
      return true;
    }
    return bound(url, data);
  };
}

/**
 * Wrap fetch, XMLHttpRequest and sendBeacon on `target` so blocked
 * telemetry never leaves the page. Idempotent, and safe to call on a
 * target missing any of the three.
 */
export function installTelemetryBlock(
  target: TelemetryBlockTarget = globalThis as unknown as TelemetryBlockTarget,
): void {
  if (guarded.has(target)) {
    return;
  }
  guarded.add(target);
  wrapFetch(target);
  wrapXhr(target);
  wrapSendBeacon(target);
}
