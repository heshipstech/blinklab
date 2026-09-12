// The webgl2 probe, roadmap 13.5.
//
// MediaPipe's GPU delegate runs on WebGL2, so whether this page can
// create a webgl2 context at all is the nearest OBSERVABLE fact to
// "could the GPU delegate exist here". It is evidence beside the
// request, never the executed delegate: the vendored API keeps that
// to itself, and the export says so in its own row.

/**
 * Whether a webgl2 context can be created, or null when the probe
 * itself threw. Null is "unknown" and never "unsupported": a canvas
 * that throws is not a measurement of the GPU.
 */
export function probeWebgl2(): boolean | null {
  try {
    return document.createElement("canvas").getContext("webgl2") !== null;
  } catch {
    return null;
  }
}
