// Roadmap 13.7's io half: the resolution-versus-rate probe.
//
// Each canonical ask goes to the LIVE track on 13.2's own pattern —
// applyConstraints with ideals (a refusing track is recorded, never
// thrown), settings read back afterwards, because the settings are
// the negotiation's answer and the ask is only the question. The
// sweep ends by restoring what the session had before the first ask:
// a probe is a question, and a question must not change the
// instrument that answered it. Choosing a mode is the separate,
// deliberate act below.

import {
  MODE_PROBE_ASKS,
  type ModeAsk,
  type ModeProbeReading,
} from "../core/modeMenu";
import type { TrackReading } from "../core/frameRateNegotiation";

/** The two members this module needs; a fake track in tests carries
 * exactly these, so the sweep is testable without a camera. */
export type ProbeTrack = {
  applyConstraints(constraints: MediaTrackConstraints): Promise<void>;
  getSettings(): MediaTrackSettings;
};

function constraintsFor(ask: ModeAsk): MediaTrackConstraints {
  return {
    width: { ideal: ask.widthPx },
    height: { ideal: ask.heightPx },
    frameRate: { ideal: ask.fps },
  };
}

function readingOf(settings: MediaTrackSettings): TrackReading {
  return {
    widthPx: typeof settings.width === "number" ? settings.width : null,
    heightPx: typeof settings.height === "number" ? settings.height : null,
    frameRate:
      typeof settings.frameRate === "number" ? settings.frameRate : null,
  };
}

export async function probeModes(
  track: ProbeTrack,
  asks: readonly ModeAsk[] = MODE_PROBE_ASKS,
): Promise<ModeProbeReading[]> {
  const before = track.getSettings();
  const readings: ModeProbeReading[] = [];
  for (const asked of asks) {
    let applyFailed = false;
    try {
      await track.applyConstraints(constraintsFor(asked));
    } catch {
      applyFailed = true;
    }
    readings.push({
      asked,
      negotiated: applyFailed
        ? { widthPx: null, heightPx: null, frameRate: null }
        : readingOf(track.getSettings()),
      applyFailed,
    });
  }
  try {
    await track.applyConstraints({
      width: { ideal: before.width },
      height: { ideal: before.height },
      frameRate: { ideal: before.frameRate },
    });
  } catch {
    // The restore was refused, so the last granted ask stands — and
    // the menu the caller renders says exactly what each ask grants,
    // so nothing about the track's state is secret.
  }
  return readings;
}

/** Apply one chosen ask. True when the track took it; false is a
 * refusal reported to the caller, never an exception. */
export async function applyModeAsk(
  track: ProbeTrack,
  ask: ModeAsk,
): Promise<boolean> {
  try {
    await track.applyConstraints(constraintsFor(ask));
    return true;
  } catch {
    return false;
  }
}
