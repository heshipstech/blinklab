"""Write eyeblink8_false_positives.csv from a run's annotations, blink
logs and per-second exports.

Roadmap 10.6, the tool half. The false-positive table is the precision-
side twin of the miss table (analysis/tools/write_miss_table.py): one
row per detection the matcher left UNPAIRED against the annotation, the
facts the false-alarm autopsy (docs/false-alarm-character.txt) reads to
name a mechanism. Its only producer was an archived evidence script
with hardcoded /PATH/TO/ constants, a sys.path.insert and no test
(docs/evidence/2026-08-09/scripts/tables/autopsy.py). This is that
producer as a tool.

    PYTHONPATH="$PWD" .venv/bin/python tools/write_false_positive_table.py \\
        <corpus-root> <measured-dir> --out eyeblink8_false_positives.csv

The nineteen columns are exactly those the committed 2026-08-09
artefact carries, in its order, so a new run's file joins the record
rather than starting a second dialect of it. Unlike the miss table's
six columns — all facts about the annotation — a false alarm is a
DETECTION, so its columns are read from the detection, from where it
sits relative to the annotation (framesToNearestAnnotatedBlink,
overlapsNF), and from the run's own per-second state at the second it
fired (aperture, baseline, face, whether the baseline was ready yet).

Two properties inherited from write_miss_table.py. It walks the corpus
with sorted(rglob("*.tag")), the same order load_corpus uses, so the
row order is a fact about the corpus layout rather than a choice remade
here. And it REFUSES a clip whose blink log or per-second export is
missing, or one measured in any mode but stepped, rather than writing a
shorter table: a missing file is "we did not look", not "no false
alarms here", and a watched run is capped by how fast the model ran.
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

INSTRUMENT_FPS = 30.0

FALSE_POSITIVE_COLUMNS = [
    "clip",
    "startFrame",
    "endFrame",
    "frameLength",
    "durationMs",
    "overlapsNF",
    "startTimeSeconds",
    "startTimeSecondsAt30fps",
    "inFirstThirtySeconds",
    "maxInterFrameGapInsideBlink",
    "maxInterFrameGapWithEdges",
    "secondsRowIndex",
    "apertureMmAtThatSecond",
    "baselineMmAtThatSecond",
    "shutBaselineMmAtThatSecond",
    "faceDetectedAtThatSecond",
    "baselineReadySecond",
    "beforeBaselineReady",
    "framesToNearestAnnotatedBlink",
]


def load_non_frontal(tag: Path) -> dict[int, bool]:
    """Per-frame non-frontal flag, which load_annotation only totals.

    The autopsy asks whether a false alarm's span TOUCHED a non-frontal
    frame, which the annotation's running total cannot answer, so the
    flag is read per frame from the same nineteen-field line
    (field index 2 is "N" when the head is turned).
    """
    flags: dict[int, bool] = {}
    started = False
    for raw in tag.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if line == "#start":
            started = True
            continue
        if not started or not line or line.startswith("#"):
            continue
        parts = line.split(":")
        if len(parts) != 19:
            continue
        flags[int(parts[0])] = parts[2].strip().upper() == "N"
    return flags


def load_frame_times(txt: Path) -> dict[int, float]:
    """Frame index -> capture-clock seconds, from the clip's `.txt`.

    Missing or unreadable rows are skipped rather than guessed, and a
    missing file yields an empty map: the wall-clock columns then fall
    back to the 30 fps instrument clock, which is always derivable.
    """
    times: dict[int, float] = {}
    if not txt.exists():
        return times
    for raw in txt.read_text(encoding="utf-8", errors="replace").splitlines():
        parts = raw.split()
        if len(parts) != 2:
            continue
        try:
            times[int(parts[0])] = float(parts[1])
        except ValueError:
            continue
    return times


def load_seconds(path: Path) -> list[dict[str, str]]:
    """The per-second export as rows, `#` metadata lines skipped.

    Read positionally: row index i is second i, the same join the
    archived producer used to reach apertureMm and the rest.
    """
    lines = [
        line
        for line in path.read_text(encoding="utf-8").splitlines()
        if not line.startswith("#")
    ]
    return list(csv.DictReader(lines))


def _cell(rows: list[dict[str, str]], index: int, key: str) -> str:
    if 0 <= index < len(rows):
        return rows[index].get(key, "") or ""
    return ""


def _ready_second(seconds: list[dict[str, str]]) -> int | None:
    """The first second whose baselineMm is non-empty: the moment the
    personal threshold replaced the fixed 4 mm fallback."""
    for index, row in enumerate(seconds):
        if (row.get("baselineMm") or "").strip():
            return index
    return None


def _gap_stats(
    times: dict[int, float], first: int, last: int
) -> tuple[float, float]:
    """Max inter-frame gap strictly inside [first, last], and the same
    including the frame that enters the span and the one that leaves it.

    Zero when no two consecutive frames inside the span have times,
    which is what a clip with no `.txt` clock produces.
    """
    inside = 0.0
    for frame in range(first, last):
        before, after = times.get(frame), times.get(frame + 1)
        if before is not None and after is not None:
            inside = max(inside, after - before)
    edged = inside
    for frame in (first - 1, last):
        before, after = times.get(frame), times.get(frame + 1)
        if before is not None and after is not None:
            edged = max(edged, after - before)
    return inside, edged


def _nearest_annotation(
    annotated: list[Interval], start: int, end: int
) -> int:
    """Frames from [start, end] to the closest annotated blink, 0 when
    they overlap, -1 when the clip annotates no blink at all."""
    if not annotated:
        return -1
    distances: list[int] = []
    for blink in annotated:
        if end < blink.start_frame:
            distances.append(blink.start_frame - end)
        elif start > blink.end_frame:
            distances.append(start - blink.end_frame)
        else:
            distances.append(0)
    return min(distances)


def false_positives_for_clip(
    annotation: Annotation,
    log: BlinkLog,
    non_frontal: dict[int, bool],
    times: dict[int, float],
    seconds: list[dict[str, str]],
) -> list[dict[str, object]]:
    """The detections this run's log did not pair, as table rows.

    match_blinks pairs detections to annotations one to one on best
    overlap; a detection left unpaired is a false alarm. Every column is
    a fact about the detection, its neighbourhood, or the run's state at
    the second it fired — never a mechanism, which is the autopsy's
    question and would pre-register an answer this file cannot see.
    """
    detected = [blink.interval() for blink in log.blinks]
    annotated = [
        Interval(start_frame=blink.start_frame, end_frame=blink.end_frame)
        for blink in annotation.blinks
    ]
    result = match_blinks(detected, annotated)
    matched = {detection for detection, _annotation in result.pairs}

    ready = _ready_second(seconds)
    rows: list[dict[str, object]] = []
    for index, blink in enumerate(log.blinks):
        if index in matched:
            continue
        start, end = blink.start_frame, blink.end_frame
        wall = times.get(start)
        instrument_seconds = start / INSTRUMENT_FPS
        second_index = int(instrument_seconds)
        inside, edged = _gap_stats(times, start, end)
        overlaps_nf = any(
            non_frontal.get(frame, False) for frame in range(start, end + 1)
        )
        rows.append(
            {
                "clip": annotation.name,
                "startFrame": start,
                "endFrame": end,
                "frameLength": end - start + 1,
                "durationMs": round(blink.duration_ms, 1),
                "overlapsNF": int(overlaps_nf),
                "startTimeSeconds": "" if wall is None else round(wall, 4),
                "startTimeSecondsAt30fps": round(instrument_seconds, 4),
                "inFirstThirtySeconds": int(
                    (wall if wall is not None else instrument_seconds) < 30.0
                ),
                "maxInterFrameGapInsideBlink": round(inside, 4),
                "maxInterFrameGapWithEdges": round(edged, 4),
                "secondsRowIndex": second_index,
                "apertureMmAtThatSecond": _cell(
                    seconds, second_index, "apertureMm"
                ),
                "baselineMmAtThatSecond": _cell(
                    seconds, second_index, "baselineMm"
                ),
                "shutBaselineMmAtThatSecond": _cell(
                    seconds, second_index, "shutBaselineMm"
                ),
                "faceDetectedAtThatSecond": _cell(
                    seconds, second_index, "faceDetected"
                ),
                "baselineReadySecond": "" if ready is None else ready,
                "beforeBaselineReady": int(
                    ready is not None and second_index < ready
                ),
                "framesToNearestAnnotatedBlink": _nearest_annotation(
                    annotated, start, end
                ),
            }
        )
    return rows


def collect_false_positives(
    corpus: Path, measured: Path
) -> list[dict[str, object]]:
    """Every clip's false alarms, in the corpus walk's order.

    Raises ValueError, naming the clip, for a missing blink log or
    per-second export, or a log not measured in stepped mode: a shorter
    table would silently answer a question nobody asked it.
    """
    rows: list[dict[str, object]] = []
    for tag in sorted(corpus.rglob("*.tag")):
        name = tag.stem
        log_path = measured / f"{name}.blinks.csv"
        seconds_path = measured / f"{name}.seconds.csv"
        if not log_path.exists():
            raise ValueError(
                f"{name}: no blink log at {log_path}. Every clip the corpus "
                "annotates must have been measured; a shorter table would "
                "report 'no false alarms here' where the truth is 'we did "
                "not look'."
            )
        if not seconds_path.exists():
            raise ValueError(
                f"{name}: no per-second export at {seconds_path}. The "
                "aperture, baseline and face columns are read from it, so a "
                "clip without one cannot be filled."
            )
        log = load_blink_log(log_path)
        if not log.measured_completely:
            raise ValueError(
                f"{name}: measured in "
                f"'{log.metadata.get('measurement_mode')}' mode, not "
                "stepped, so not every frame was seen. Detections on frames "
                "the run never revisited would arrive here uncomparable."
            )
        rows.extend(
            false_positives_for_clip(
                load_annotation(tag),
                log,
                load_non_frontal(tag),
                load_frame_times(tag.with_suffix(".txt")),
                load_seconds(seconds_path),
            )
        )
    return rows


def render(rows: list[dict[str, object]]) -> str:
    """The table as CSV text, through Python's csv writer at its default
    CRLF dialect — byte for byte what the archived producer wrote and
    what the committed table carries."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(FALSE_POSITIVE_COLUMNS)
    for row in rows:
        writer.writerow([row[column] for column in FALSE_POSITIVE_COLUMNS])
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
        rows = collect_false_positives(args.corpus, args.measured)
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
