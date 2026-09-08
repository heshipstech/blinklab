"""Write eyeblink8_misses.csv from a run's annotations and blink logs.

Roadmap 10.8a4. The miss table is what miss_autopsy.py, miss_overlap.py
and the TypeScript replay runner all join to, and its only producer was
an archived evidence script (docs/evidence/2026-08-09/scripts/tables/
autopsy.py) with hardcoded /PATH/TO/ constants, a sys.path.insert and no
test. So a new corpus run could not regenerate the file without editing
an archived script, which is the shape this project retired everywhere
else. This is that producer as a tool.

    uv run python tools/write_miss_table.py \\
        <corpus-root> <measured-dir> --out eyeblink8_misses.csv

The six columns are exactly those three consumers already read, and they
are all facts about the ANNOTATION except the clip name: which annotated
blinks appear is decided by the run's log, but each row's numbers come
from the ground truth, so the table describes what was missed, not how.

Two properties it has on purpose, both inherited from the honesty the
rest of this folder keeps.

It walks the corpus with sorted(rglob("*.tag")), the same order
load_corpus uses, so the row order is a fact about the corpus layout
(subject folders sorted as strings: "10" before "2") rather than a
choice remade here. A clip-name sort would produce the right rows in the
wrong order and fail a digit-for-digit check against the committed file.

It REFUSES a clip whose blink log is missing, and one measured in any
mode but stepped, rather than writing a shorter table. A missing log is
"we did not look", not "no misses here"; a watched run is capped by how
fast the model ran and would report frames it never saw as misses of the
detector. Both are the inverse of miss_autopsy.py's skip-and-continue,
and both name the clip.
"""

from __future__ import annotations

import argparse
import csv
import io
import sys
from pathlib import Path

from blinklab.blink_log import BlinkLog, load_blink_log
from blinklab.blink_match import Interval, match_blinks
from blinklab.eyeblink8 import Annotation, load_annotation

MISS_COLUMNS = [
    "clip",
    "blink_id",
    "startFrame",
    "endFrame",
    "frameLength",
    "fullyClosedFrames",
]


def misses_for_clip(
    annotation: Annotation, log: BlinkLog
) -> list[dict[str, str]]:
    """The annotated blinks this run's log did not pair, as table rows.

    match_blinks pairs detections to annotations one to one on best
    overlap; an annotation left unpaired is a miss. Every column but the
    clip name is read straight off the annotation's Blink, so the table
    says which blinks were missed, never why — the mechanism is the
    replay tool's question, and a column asserting it here would
    pre-register an answer this file cannot see.
    """
    detected = [blink.interval() for blink in log.blinks]
    annotated = [
        Interval(start_frame=blink.start_frame, end_frame=blink.end_frame)
        for blink in annotation.blinks
    ]
    result = match_blinks(detected, annotated)
    matched = {a_index for _d, a_index in result.pairs}
    rows: list[dict[str, str]] = []
    for index, blink in enumerate(annotation.blinks):
        if index in matched:
            continue
        rows.append(
            {
                "clip": annotation.name,
                "blink_id": str(blink.blink_id),
                "startFrame": str(blink.start_frame),
                "endFrame": str(blink.end_frame),
                "frameLength": str(blink.frame_count),
                "fullyClosedFrames": str(blink.fully_closed_frames),
            }
        )
    return rows


def collect_misses(corpus: Path, measured: Path) -> list[dict[str, str]]:
    """Every clip's misses, in the corpus walk's order.

    Raises ValueError, naming the clip, for a missing log or one not
    measured in stepped mode: a shorter table would silently answer a
    question nobody asked it.
    """
    rows: list[dict[str, str]] = []
    for tag in sorted(corpus.rglob("*.tag")):
        log_path = measured / f"{tag.stem}.blinks.csv"
        if not log_path.exists():
            raise ValueError(
                f"{tag.stem}: no blink log at {log_path}. Every clip the "
                "corpus annotates must have been measured; a shorter table "
                "would report 'no misses here' where the truth is 'we did "
                "not look'."
            )
        log = load_blink_log(log_path)
        if not log.measured_completely:
            raise ValueError(
                f"{tag.stem}: measured in "
                f"'{log.metadata.get('measurement_mode')}' mode, not stepped, "
                "so not every frame was seen. Blinks the run never looked at "
                "would arrive here as misses of the detector."
            )
        rows.extend(misses_for_clip(load_annotation(tag), log))
    return rows


def render(rows: list[dict[str, str]]) -> str:
    """The table as CSV text.

    Through Python's csv writer at its default dialect, which is CRLF
    with a trailing terminator — byte for byte what the archived
    producer wrote and what the committed table carries, so a new run's
    file joins the record rather than starting a second dialect of it.
    """
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(MISS_COLUMNS)
    for row in rows:
        writer.writerow([row[column] for column in MISS_COLUMNS])
    return buffer.getvalue()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("corpus", type=Path, help="Extracted Eyeblink8 root")
    parser.add_argument("measured", type=Path, help="Blink logs from the run")
    parser.add_argument(
        "--out",
        type=Path,
        help="Where to write the table; stdout if omitted",
    )
    args = parser.parse_args(argv)

    try:
        rows = collect_misses(args.corpus, args.measured)
    except ValueError as error:
        print(f"REFUSED: {error}", file=sys.stderr)
        return 1

    text = render(rows)
    if args.out is None:
        sys.stdout.write(text)
    else:
        # newline="" so the CRLF the csv writer produced is written
        # verbatim rather than translated by the platform.
        args.out.write_text(text, encoding="utf-8", newline="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
