// Roadmap 13.13's io half: the re-attempt itself.
//
// The lost-face event rode a wedged tracker state to the end of a
// clip because nothing ever walked away from it. This adapter is the
// walking away: close the instance we have (best effort — a wedged
// instance may refuse even to die, and the point is to leave it, not
// to win an argument with it), then load a fresh one through the
// same loader the page trusts, Cache API bytes first, so a re-attempt
// costs a load and never a download.
//
// Every failure path returns rather than throws. A session that lost
// its face keeps its honest no-face state on a failed re-attempt and
// the next signal tries again; a recovery that can crash the page is
// worse than the defect it recovers from.

import type { FaceLandmarker } from "@mediapipe/tasks-vision";

import { loadLandmarker, type LandmarkerLoad } from "./landmarker";

export async function reacquireLandmarker(
  current: FaceLandmarker | null,
  load: () => Promise<LandmarkerLoad> = loadLandmarker,
): Promise<FaceLandmarker | null> {
  try {
    current?.close();
  } catch {
    // Left behind either way.
  }
  try {
    const loaded = await load();
    return loaded.landmarker;
  } catch {
    return null;
  }
}
