// What a throw out of a stepped clip's run means, decided from one fact:
// how many frames were measured before it (roadmap 14.0e).
//
// A stepped run is a loop inside an await with no per-frame crash
// wrapper, so its throws land in beginVideoFile's outer catch. There
// they mean one of two very different things:
//
//   measurementCrash  Frames were measured, then something threw. The
//                     session is a real file session that ended badly,
//                     and its records stay exportable — with the file
//                     provenance (source and clip name) it was measured
//                     under, exactly as the played loop's own crash path
//                     already keeps them. Overwriting the source with
//                     "camera" before the export, as the inline branch
//                     once did, describes a crashed file run as a camera
//                     one.
//
//   fileFailed        Nothing was measured, so the throw is a file the
//                     instrument could not read. There is no session to
//                     keep, and the page returns to its camera-ready
//                     state.
//
// Pure: the decision is here so it is tested and cannot drift from the
// loop path that already treats a mid-run crash this way. Acting on it —
// which state to show, whether to reset the source — is main.ts's job.

export type SteppedCrashOutcome =
  { readonly kind: "measurementCrash" } | { readonly kind: "fileFailed" };

export function steppedCrashOutcome(
  framesMeasured: number,
): SteppedCrashOutcome {
  return framesMeasured > 0
    ? { kind: "measurementCrash" }
    : { kind: "fileFailed" };
}
