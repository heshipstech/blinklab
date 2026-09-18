// Roadmap 14.6: the record-yourself walkthrough, refusal-first.
//
// The probe (docs/record-yourself-probe.txt) established the fact
// this page's wording rests on: a browser recording stamps frames on
// the wall clock, so the stepper refuses it BY NAME rather than
// measuring garbage. The owner's fork, decided 18 September 2026, is
// to ship the walkthrough on top of that refusal rather than build a
// constant-rate recording path — so these sentences teach the visitor
// what the refusal means and how to bring a file the pipeline can
// measure, and the refusal they quote is pinned against the function
// that actually speaks it, never copied prose left to rot.

/** The stable opening of stepCalibration's variableRateRefusal — a
 * test holds this prefix to the sentence the pipeline produces. */
export const RECORD_REFUSAL_PREFIX =
  "Could not step this clip: its first frames are not evenly spaced";

export const RECORD_WALKTHROUGH_STEPS: readonly string[] = [
  "Record a short clip of yourself with your device's own camera " +
    "app — ten to thirty seconds, your face filling about a third of " +
    "the frame, in the light you would normally sit in.",
  "Save or share it as an ordinary video file. A camera app records " +
    "at a constant frame rate, which is what frame-by-frame " +
    "measurement needs.",
  "Load it with Choose file above. The clip is stepped frame by " +
    "frame through the same pipeline a live session uses, and the " +
    "same readouts fill in.",
];

export const RECORD_WHY_NOT_HERE =
  "Why not record right here, in the browser? Because a browser " +
  "recording stamps frames on the wall clock, its frames are not " +
  "evenly spaced, and this page refuses to measure a clip like that " +
  'rather than measure it wrongly: you would see "' +
  RECORD_REFUSAL_PREFIX +
  '...". That fact was established by a committed probe ' +
  "(docs/record-yourself-probe.txt) that records its outcome on " +
  "every test run, so if a browser ever starts recording at a " +
  "constant rate, the record will say so before this paragraph does.";
