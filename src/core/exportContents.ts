// What a person is told an exported file contains, before they send it
// to anyone.
//
// Roadmap 10.0a2, ladder B2. The export writes a metadata header above
// the per-second records: the camera's label, the browser, the
// machine's core count, its screen and viewport, and a pseudonym if
// one was set. The two sleepiness answers sit there too. None of that
// is wrong to write and none of it is secret, but this project's
// validation and pilot plans ask participants to email these files,
// and until now the page said nothing about what was in one.
//
// The sentence is built from the metadata keys rather than written
// beside them, so a row that leaves the export takes its disclosure
// with it. Same arrangement as storedData.ts: the list lives in one
// tested place and the interface and the README both render it.

import {
  type DeviceInfo,
  deviceMetadataRows,
  pseudonymMetadataRows,
} from "./sessionMetadata";

/**
 * A device with nothing filled in, used only to ask the row builders
 * which keys they write.
 *
 * The keys are read out of the builders rather than listed beside
 * them, so a row that leaves the export takes its disclosure with it
 * and a row that arrives without one is caught by the test.
 */
const NOTHING_KNOWN: DeviceInfo = {
  cameraLabel: null,
  cameraWidthPx: null,
  cameraHeightPx: null,
  cameraDeclaredFps: null,
  facingMode: null,
  userAgent: null,
  hardwareConcurrency: null,
  viewportWidthPx: null,
  viewportHeightPx: null,
  screenWidthPx: null,
  screenHeightPx: null,
  devicePixelRatio: null,
  orientation: null,
};

/** The key out of a `# key: value` metadata row. */
function keyOf(row: string): string {
  return row.slice(2, row.indexOf(":"));
}

/**
 * Every metadata key the export can write about the machine and the
 * person, asked of the row builders themselves.
 */
export function writtenMetadataKeys(): readonly string[] {
  return [
    ...deviceMetadataRows(NOTHING_KNOWN),
    ...pseudonymMetadataRows("a pseudonym"),
  ].map(keyOf);
}

/**
 * The metadata keys a reader would not guess from "one record per
 * second", and which therefore have to be named out loud.
 *
 * Deliberately not every key. `records` and `camera_declared_fps`
 * describe the measurement and are what the file is for; these
 * describe the machine and the person holding it.
 */
export const DISCLOSED_METADATA_KEYS: readonly string[] = [
  "camera",
  "user_agent",
  "hardware_concurrency",
  "screen",
  "viewport",
  "participant_pseudonym",
];

/**
 * One sentence naming what an exported file carries beside the
 * records, and where the file goes.
 *
 * Throws when a disclosed key is not among the keys the export
 * actually writes. A disclosure that lists a row nobody writes is the
 * same defect as a row nobody discloses, pointed the other way, and
 * this project has now met both.
 */
export function exportContentsSentence(writtenKeys: readonly string[]): string {
  const written = new Set(writtenKeys);
  for (const key of DISCLOSED_METADATA_KEYS) {
    if (!written.has(key)) {
      throw new Error(
        `export disclosure: ${key} is named here but the export no ` +
          `longer writes it, so the sentence describes a file that ` +
          `does not exist`,
      );
    }
  }
  return EXPORT_CONTENTS;
}

/**
 * The sentence itself, as one constant, so the generator that writes
 * README's Privacy section can read it out of this file rather than
 * keep a second copy. `tools/privacyBlock.mjs` reads these literals.
 */
export const EXPORT_CONTENTS =
  "Above the records the file carries a header describing this " +
  "session: the camera's label (camera), the browser (user_agent), " +
  "the machine's core count (hardware_concurrency), its screen and " +
  "window sizes (screen, viewport), your two sleepiness answers, and " +
  "the pseudonym if you set one (participant_pseudonym). The file is " +
  "written to your own disk and nothing is uploaded, so sending it to " +
  "anyone is your own act.";
