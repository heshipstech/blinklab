// Roadmap 13.7, the pure summarizer half: the honest mode menu.
//
// The probe (the io half) asks the live track for a handful of
// resolution-and-rate trades and records what each ask NEGOTIATED,
// on 13.2's own pattern: settings read after the ask, a refusing
// browser recorded rather than thrown. This module turns those
// readings into the menu a person chooses from, and its one design
// rule is that every row is keyed by what negotiation DELIVERED,
// never by what was asked. A webcam that answers five asks with
// 1080p30 has ONE mode, and a menu listing five nominal modes it
// will not grant is the dishonesty this row exists to end.
//
// Two claims are kept apart on purpose. The capability ladder
// (13.6a) judges the DELIVERED rate after a session measured it;
// this menu judges a NEGOTIATION before any frame arrives, so every
// rate sentence here says "negotiated" and reminds the reader that
// delivery is measured live. A negotiation is a promise, and the
// record already holds a device whose promise and delivery differ.
//
// The ruler sentence states the resolution trade RELATIVELY: the
// iris is the millimetre ruler and it runs on source pixels, so a
// 1280-wide mode carries 67% of a 1920-wide mode's pixels per
// millimetre whatever the absolute iris turns out to be. No absolute
// pixel count is promised, because none is measured until a face is.

import { BLINK_RISK_FPS, MIN_BLINK_FPS } from "./constants";
import type { TrackReading } from "./frameRateNegotiation";
import type { SurfaceStatus } from "./sessionVerdict";

/** One resolution-and-rate ask the probe puts to the track. */
export type ModeAsk = {
  widthPx: number;
  heightPx: number;
  fps: number;
};

/**
 * The canonical asks, as literals: full resolution at the default
 * rate and at 60, and the half-resolution buy of 60 — the three
 * corners of the trade the row names. The io half iterates this
 * list; a test pins it so a reshuffle is a deliberate edit.
 */
export const MODE_PROBE_ASKS: ModeAsk[] = [
  { widthPx: 1920, heightPx: 1080, fps: 30 },
  { widthPx: 1920, heightPx: 1080, fps: 60 },
  { widthPx: 1280, heightPx: 720, fps: 60 },
];

/** What one ask negotiated, read from the track afterwards. */
export type ModeProbeReading = {
  asked: ModeAsk;
  negotiated: TrackReading;
  applyFailed: boolean;
};

export type ModeMenuRow = {
  /** The negotiated truth: "1920x1080 at 30 fps", with "unknown"
   * standing wherever the browser reported nothing. */
  label: string;
  /** Every ask that landed on these settings. */
  asked: ModeAsk[];
  negotiated: TrackReading;
  rateStatus: SurfaceStatus;
  rateSentence: string;
  rulerSentence: string;
};

export type ModeMenu = {
  rows: ModeMenuRow[];
  /** Asks whose applyConstraints threw: recorded, never a row, and
   * never silently dropped. */
  notGranted: ModeAsk[];
};

function labelOf(negotiated: TrackReading): string {
  const size =
    negotiated.widthPx === null || negotiated.heightPx === null
      ? "unknown"
      : `${String(negotiated.widthPx)}x${String(negotiated.heightPx)}`;
  const rate =
    negotiated.frameRate === null
      ? "unknown fps"
      : `${String(negotiated.frameRate)} fps`;
  return size === "unknown" && negotiated.frameRate === null
    ? "unknown"
    : `${size} at ${rate}`;
}

function rateVerdict(frameRate: number | null): {
  status: SurfaceStatus;
  sentence: string;
} {
  const measuredLive =
    "a negotiation is a promise, and delivery is measured live.";
  if (frameRate === null) {
    return {
      status: "unknown",
      sentence:
        "Rate not negotiated: this browser reported no frame rate for " +
        `the mode, so no band can be claimed from silence — ${measuredLive}`,
    };
  }
  if (frameRate < MIN_BLINK_FPS) {
    return {
      status: "refused",
      sentence:
        `A negotiated ${String(frameRate)} frames per second sits below ` +
        `the ${String(MIN_BLINK_FPS)} frames per second floor where blink ` +
        "detection refuses (docs/blink-sample-rate.txt) — " +
        measuredLive,
    };
  }
  if (frameRate >= BLINK_RISK_FPS) {
    return {
      status: "ok",
      sentence:
        `A negotiated ${String(frameRate)} frames per second sits at or ` +
        `above ${String(BLINK_RISK_FPS)}, where the committed sampling ` +
        "model puts a minimal blink's catch odds near certain " +
        "(docs/blink-sample-rate.txt) — " +
        measuredLive,
    };
  }
  return {
    status: "warned",
    sentence:
      `A negotiated ${String(frameRate)} frames per second sits in the ` +
      `${String(MIN_BLINK_FPS)} to ${String(BLINK_RISK_FPS)} band, where ` +
      "a minimal blink's catch odds run from about half to certain " +
      "(docs/blink-sample-rate.txt) — " +
      measuredLive,
  };
}

function rulerSentence(
  widthPx: number | null,
  widestPx: number | null,
): string {
  if (widthPx === null || widestPx === null) {
    return (
      "Ruler share unknown: the browser did not report this mode's " +
      "width, and the millimetre ruler's pixel share cannot be claimed " +
      "from silence."
    );
  }
  if (widthPx >= widestPx) {
    return (
      "The widest mode probed, so the iris ruler rides the most source " +
      "pixels per millimetre this camera offered."
    );
  }
  const share = Math.round((widthPx / widestPx) * 100);
  return (
    `Carries about ${String(share)}% of the widest probed mode's source ` +
    "pixels per millimetre, because the iris ruler runs on source pixels " +
    "and this mode is narrower."
  );
}

/**
 * The honest menu. Rows are keyed by negotiated settings, ordered
 * widest first and faster first within a width, unknowns last, so
 * the render is deterministic whatever order the probe ran in.
 */
export function modeMenu(readings: ModeProbeReading[]): ModeMenu {
  const notGranted: ModeAsk[] = [];
  const byOutcome = new Map<
    string,
    { negotiated: TrackReading; asked: ModeAsk[] }
  >();
  for (const reading of readings) {
    if (reading.applyFailed) {
      notGranted.push(reading.asked);
      continue;
    }
    const key = labelOf(reading.negotiated);
    const existing = byOutcome.get(key);
    if (existing === undefined) {
      byOutcome.set(key, {
        negotiated: reading.negotiated,
        asked: [reading.asked],
      });
    } else {
      existing.asked.push(reading.asked);
    }
  }
  const widestPx = Array.from(byOutcome.values()).reduce<number | null>(
    (widest, outcome) =>
      outcome.negotiated.widthPx !== null &&
      (widest === null || outcome.negotiated.widthPx > widest)
        ? outcome.negotiated.widthPx
        : widest,
    null,
  );
  const rows = Array.from(byOutcome.values()).map(
    ({ negotiated, asked }): ModeMenuRow => {
      const rate = rateVerdict(negotiated.frameRate);
      return {
        label: labelOf(negotiated),
        asked,
        negotiated,
        rateStatus: rate.status,
        rateSentence: rate.sentence,
        rulerSentence: rulerSentence(negotiated.widthPx, widestPx),
      };
    },
  );
  rows.sort((a, b) => {
    const aw = a.negotiated.widthPx;
    const bw = b.negotiated.widthPx;
    if (aw === null && bw === null) {
      return a.label.localeCompare(b.label);
    }
    if (aw === null) {
      return 1;
    }
    if (bw === null) {
      return -1;
    }
    if (aw !== bw) {
      return bw - aw;
    }
    const ar = a.negotiated.frameRate;
    const br = b.negotiated.frameRate;
    if (ar === null && br === null) {
      return a.label.localeCompare(b.label);
    }
    if (ar === null) {
      return 1;
    }
    if (br === null) {
      return -1;
    }
    return br - ar;
  });
  return { rows, notGranted };
}
