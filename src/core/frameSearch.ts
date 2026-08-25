// Where does this clip's first frame actually live?
//
// Not always at zero, and not always where the browser says. A file
// remuxed from another container can carry a start offset: the
// Eyeblink8 clips begin about 1.7 seconds in, and seeking to zero on
// one lands in empty space where no frame exists at all. Every probe
// then finishes — the seek is perfectly valid — while no frame ever
// arrives, calibration collects nothing, and the run refuses with
// "could not work out this clip's frame rate", which blames the file
// for a question nobody asked correctly.
//
// The stepper used to ask `video.seekable` for the answer, on the
// reasoning that it is "the browser's own answer to what I can ask
// for". That worked until it did not: on 25 August 2026 a new machine
// reported `seekable: 0.00-527.83` for a clip whose first frame is at
// 1.700, and the whole corpus refused while a sixty second cut of the
// byte-identical stream measured perfectly. A browser reporting the
// seekable RANGE is not promising a frame at its start.
//
// So this asks the only witness that cannot be wrong: seek somewhere,
// and see whether a frame comes back. A probe that returns a time is
// standing on a real decoded frame, and that frame's own timestamp is
// where it begins.
//
// Pure and browser-free: the caller supplies the probe, so the search
// can be tested against a synthetic clip with no browser in sight.

/**
 * Seek to a time and report the media time of the frame we landed on,
 * or null when no frame arrived — either because the seek landed in
 * empty space, or because the browser never said where it landed.
 */
export type FrameProbe = (timeSeconds: number) => Promise<number | null>;

/**
 * How far past the timeline's claimed start to look before giving up.
 * Generous, because the cost of searching is a few seconds once per
 * clip and the cost of giving up early is refusing a measurable
 * recording. A clip whose first two minutes hold no frame at all is
 * not a clip this instrument should quietly invent an origin for.
 */
export const FIRST_FRAME_SEARCH_LIMIT_S = 120;

/**
 * The first probe offset, and the ratio it grows by. Doubling finds a
 * gap of any size in a logarithmic number of probes rather than
 * marching through it: the old fixed 10 ms march covered 0.6 seconds
 * in its whole budget and could never have crossed a 1.7 second gap.
 */
const FIRST_PROBE_OFFSET_S = 0.05;
const PROBE_GROWTH = 2;

/**
 * How tightly the boundary is pinned before the search stops. Four
 * milliseconds is under one frame interval at 250 frames per second,
 * so no frame can hide inside the remaining uncertainty.
 */
const BOUNDARY_PRECISION_S = 0.004;

export type FirstFrameSearch = {
  /** The first frame's own media time, or null when none was found. */
  firstFrameSeconds: number | null;
  /** How many probes it took, so a slow search is visible as one. */
  probes: number;
};

/**
 * Find the media time of the clip's first frame.
 *
 * Two phases. First a doubling forward search from the claimed start,
 * which crosses a gap of unknown size cheaply and stops at the first
 * probe that stands on a frame. That frame is an UPPER bound: the
 * first frame is at or before it.
 *
 * Then a binary search between the last empty probe and that bound.
 * The test is "does a frame come back", and it is unambiguous in this
 * direction: a probe strictly BELOW the best known frame time cannot
 * land on that same frame, because a frame's window begins at its own
 * timestamp. So a probe that returns nothing really is in empty space,
 * and a probe that returns a frame has found an earlier one.
 *
 * The smallest media time ever observed is the answer. Returns null
 * rather than a guess when no frame is found at all, because an
 * invented origin would silently shift every measurement after it.
 */
export async function findFirstFrame(
  probe: FrameProbe,
  claimedStartSeconds: number,
  endSeconds: number | null,
): Promise<FirstFrameSearch> {
  let probes = 0;
  const ask = async (timeSeconds: number): Promise<number | null> => {
    probes += 1;
    return probe(timeSeconds);
  };

  const start = Number.isFinite(claimedStartSeconds) ? claimedStartSeconds : 0;
  const limit =
    endSeconds !== null && Number.isFinite(endSeconds)
      ? Math.min(endSeconds, start + FIRST_FRAME_SEARCH_LIMIT_S)
      : start + FIRST_FRAME_SEARCH_LIMIT_S;

  // The claimed start itself, first. A clip that begins where it says
  // it begins costs exactly one probe, which is every ordinary clip.
  // A frame landed on here is already the first one: nothing can be
  // seekable before the start of the seekable range.
  const atStart = await ask(start);
  if (atStart !== null) {
    return { firstFrameSeconds: atStart, probes };
  }

  // Doubling, but never past the searchable window. Clamping matters:
  // a plain doubling sequence can step clean OVER a short stretch of
  // video and report a clip with frames as having none — 0.8, 1.6,
  // 3.2 jumps straight across a clip that runs from 1.7 to 3.0. The
  // clamped probe lands inside the window instead, and the search
  // stops when clamping stops making progress.
  const ceiling = limit - BOUNDARY_PRECISION_S;
  let lastEmpty = start;
  let bound: number | null = null;
  let previous = start;
  for (let offset = FIRST_PROBE_OFFSET_S; ; offset *= PROBE_GROWTH) {
    const at = Math.min(start + offset, ceiling);
    if (at <= previous) break;
    previous = at;
    const landed = await ask(at);
    if (landed !== null) {
      bound = landed;
      break;
    }
    lastEmpty = at;
  }

  if (bound === null) {
    return { firstFrameSeconds: null, probes };
  }

  // Narrow the gap. `bound` only ever falls, `lastEmpty` only ever
  // rises, so this terminates whatever the probes say.
  while (bound - lastEmpty > BOUNDARY_PRECISION_S) {
    const middle = (lastEmpty + bound) / 2;
    const landed = await ask(middle);
    if (landed !== null && landed < bound) {
      bound = landed;
    } else {
      lastEmpty = middle;
    }
  }

  return { firstFrameSeconds: bound, probes };
}
