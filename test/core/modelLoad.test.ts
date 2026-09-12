import { describe, expect, it } from "vitest";

import {
  idleModelLoad,
  MODEL_LOAD_TIMEOUT_MS,
  modelLoadResolved,
  modelLoadStarted,
  modelLoadTick,
  type ModelLoadState,
} from "../../src/core/modelLoad";

// Roadmap 13.10's second Check clause, verbatim: timeout plus no model
// is a VISIBLE STUCK STATE, never healthy idle. The page used to wait
// on the model download with no clock at all, so a download that hung
// left "Loading the measuring model..." on screen forever — a stuck
// state wearing a healthy idle's clothes, with nothing for a visitor
// to click. The reducer here is the rule; main.ts drives it.

const LOADING: ModelLoadState = modelLoadStarted(idleModelLoad, 1000);

describe("the load timeout", () => {
  it("lands a silent load in failed, never back in idle", () => {
    const after = modelLoadTick(LOADING, 1000 + MODEL_LOAD_TIMEOUT_MS);
    expect(after).toEqual({ kind: "failed", why: "timeout" });
  });

  it("holds at the last millisecond and fires exactly at the bound", () => {
    expect(modelLoadTick(LOADING, 1000 + MODEL_LOAD_TIMEOUT_MS - 1).kind).toBe(
      "loading",
    );
    expect(modelLoadTick(LOADING, 1000 + MODEL_LOAD_TIMEOUT_MS).kind).toBe(
      "failed",
    );
  });

  it("cannot kill a model that already arrived", () => {
    const ready = modelLoadResolved(LOADING, true);
    expect(modelLoadTick(ready, 1000 + MODEL_LOAD_TIMEOUT_MS * 10)).toEqual({
      kind: "ready",
    });
  });

  it("a second start while loading keeps the first clock", () => {
    // Otherwise every retry click pushes the timeout further out and
    // a hung download can be kept "loading" forever by hoping at it.
    const joined = modelLoadStarted(LOADING, 60_000);
    expect(modelLoadTick(joined, 1000 + MODEL_LOAD_TIMEOUT_MS).kind).toBe(
      "failed",
    );
  });
});

describe("resolutions", () => {
  it("a download error is failed with its own name, not the timeout's", () => {
    expect(modelLoadResolved(LOADING, false)).toEqual({
      kind: "failed",
      why: "error",
    });
  });

  it("a model that arrives late is still a model", () => {
    // The race in main.ts may declare the timeout while the download
    // quietly completes afterwards; the next retry should then be
    // instant rather than re-fetching 15.8 MB.
    const timedOut = modelLoadTick(LOADING, 1000 + MODEL_LOAD_TIMEOUT_MS);
    expect(modelLoadResolved(timedOut, true)).toEqual({ kind: "ready" });
  });

  it("a retry after failure restarts the clock", () => {
    const failed = modelLoadResolved(LOADING, false);
    const retried = modelLoadStarted(failed, 500_000);
    expect(retried).toEqual({ kind: "loading", startedAtMs: 500_000 });
    expect(modelLoadTick(retried, 500_000 + 1).kind).toBe("loading");
  });

  it("ticking idle or failed changes nothing", () => {
    expect(modelLoadTick(idleModelLoad, 9e9)).toEqual(idleModelLoad);
    const failed = modelLoadResolved(LOADING, false);
    expect(modelLoadTick(failed, 9e9)).toEqual(failed);
  });
});

describe("the constant carries its derivation", () => {
  it("is twice the slowest stated profile's uncompressed fetch, rounded", () => {
    // docs/cold-load.txt: 16.13 MB at 2 Mbps is 64.5 s, and the
    // timeout must never kill an honest slow load, so it sits at
    // about twice that. Pinned as a value so a quiet edit reddens.
    expect(MODEL_LOAD_TIMEOUT_MS).toBe(120_000);
  });
});
