// The one decision behind the telemetry block, ADR-0004.
//
// The vendored MediaPipe bundle sends a POST to
// https://odml.pa.googleapis.com/v1/log about a minute after the face
// model is created. Our own video and measurements never leave the
// browser, but that call does, and it was made without our asking. This
// module answers the only question the interceptors need: is a URL one
// the running app has no legitimate reason to reach, and so refuses to
// let leave?
//
// The rule is host-based and deliberately total. Every asset the app
// needs — the WASM runtime, the model file — is vendored and served
// from our own origin as a relative URL. Nothing here calls any
// googleapis.com host on purpose. So any absolute URL pointing at that
// domain, apex or subdomain, is telemetry we did not choose, and the io
// layer drops it.

/** The registrable domain the app never has a reason to contact. */
const BLOCKED_HOST = "googleapis.com";

/**
 * The host of a URL, lowercased, or null when the string names no host.
 *
 * A relative path like "/mediapipe-wasm/..." is same origin by
 * definition and names no host: that returns null, and the caller reads
 * null as "ours, allow it". A protocol-relative "//host/path" names a
 * host but no scheme, so it is given one before parsing, or a library
 * could dodge the block simply by dropping the https.
 */
function hostOf(url: string): string | null {
  const candidate = url.startsWith("//") ? `https:${url}` : url;
  try {
    return new URL(candidate).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Whether a request to this URL is telemetry the app refuses to send.
 *
 * True only for the apex host and its subdomains, matched on a dot
 * boundary. A substring test would wrongly catch "example.com" when
 * "googleapis.com" merely appears in its path, and a bare suffix test
 * would wrongly catch a look-alike registrable domain like
 * "notgoogleapis.com". Neither is the same host, so neither is blocked.
 */
export function isBlockedTelemetryUrl(url: string): boolean {
  const host = hostOf(url);
  if (host === null) {
    return false;
  }
  return host === BLOCKED_HOST || host.endsWith(`.${BLOCKED_HOST}`);
}
