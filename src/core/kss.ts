// The Karolinska Sleepiness Scale, 1 to 9: the project's first
// LABEL. Everything else here measures the eyes; this asks the
// person. Phase 7 needs both, because features with nothing to
// predict are not a dataset, they are a recording.
//
// The anchors are the instrument. Rewording "very sleepy, great
// effort to keep awake, fighting sleep" into something friendlier
// would change what people report, so the text lives here as data
// and the UI is not allowed to paraphrase it.
export type KssRating = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type KssStep = {
  rating: KssRating;
  label: string;
};

export const KSS_SCALE: readonly KssStep[] = [
  { rating: 1, label: "Extremely alert" },
  { rating: 2, label: "Very alert" },
  { rating: 3, label: "Alert" },
  { rating: 4, label: "Rather alert" },
  { rating: 5, label: "Neither alert nor sleepy" },
  { rating: 6, label: "Some signs of sleepiness" },
  { rating: 7, label: "Sleepy, but no effort to keep awake" },
  { rating: 8, label: "Sleepy, some effort to keep awake" },
  {
    rating: 9,
    label: "Very sleepy, great effort to keep awake, fighting sleep",
  },
];

// Whole steps only: the scale is ordinal, so 4.5 is not a sleepiness,
// it is an average of two answers, and an average of an ordinal
// scale is not a point on it.
export function isKssRating(value: unknown): value is KssRating {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 9
  );
}

function describe(rating: KssRating | null): string {
  if (rating === null) {
    // A person who declines is not a 5. Inventing a midpoint would
    // put a fabricated label into a training set, which is the one
    // thing a labelling step must never do.
    return "skipped";
  }
  const step = KSS_SCALE.find((candidate) => candidate.rating === rating);
  return `${String(rating)} (${step?.label ?? ""})`;
}

// A KSS answer describes a whole session, not one second, so it must
// not become a per-second column repeated three thousand times.
// These are comment lines above the CSV header: pandas skips them
// with comment="#", and a spreadsheet shows them as two stray rows a
// human can read. Both lines are always written, because "asked and
// declined" is data and an absent line is not.
export function kssMetadataRows(
  before: KssRating | null,
  after: KssRating | null,
  afterAtMs: number | null = null,
): string[] {
  const rows = [
    `# kss_before: ${describe(before)}`,
    `# kss_after: ${describe(after)}`,
  ];
  // WHEN the after answer was given, on the record clock, so a reader
  // knows which moment a session-level label describes. Roadmap 14.0a:
  // the answer used to attach to whichever export came first, which
  // could be mid-session. Absent when the question was never asked,
  // never a zero; a skipped answer still carries its moment, because
  // "asked and declined at 61 s" is data.
  if (afterAtMs !== null) {
    rows.push(`# kss_after_at_seconds: ${(afterAtMs / 1000).toFixed(3)}`);
  }
  return rows;
}
