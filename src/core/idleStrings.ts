// What every readout says before anything has run.
//
// Roadmap 14.0b (audit B19): the idle page used to say "Alertness
// score: measuring..." and "Blinks: 0", which asserts a measurement
// in progress and a count of something never counted, to a visitor
// deciding whether to trust the instrument. The strings are a table
// here, label and value, so the page seeds them, re-applies them
// whenever nothing is running and nothing has been kept, docs/UI.md
// lists them, and the guard holds the two to each other.
//
// "not measuring" where a number would sit; "no valid measurement"
// where the running page says the same when it has none, so the line
// count and the layout never change as a session starts.

export const IDLE_READOUTS: readonly (readonly [string, string])[] = [
  ["Alertness score", "not measuring"],
  ["Eye aspect ratio", "no valid measurement"],
  ["Eyelid aperture", "no valid measurement"],
  ["Pupil diameter", "no valid measurement"],
  ["Aperture stability", "not measuring"],
  ["PERCLOS (eyes closed share, last 60 s)", "not measuring"],
  ["Long closures", "not measuring"],
  ["Iris offset", "no valid measurement"],
  ["Looking toward", "no valid measurement"],
  ["Gaze state", "no valid measurement"],
  ["Fixations in the last 10 s", "not measuring"],
  ["Head pose", "no valid measurement"],
  ["Blinks", "not measuring"],
  ["Personal blink threshold", "not learned yet"],
  ["Ruler fit", "not measuring"],
  ["Feature records", "none yet (about one per second)"],
];

/** The label and value joined the way writeReadout() splits them. */
export function idleReadoutText(label: string, value: string): string {
  return `${label}: ${value}`;
}
