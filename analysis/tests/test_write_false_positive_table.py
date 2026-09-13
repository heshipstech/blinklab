"""The false-positive table's producer, held to the committed shape.

Roadmap 10.6, the tool half. `eyeblink8_false_positives.csv` is the
precision-side twin of `eyeblink8_misses.csv`: one row per detection
the matcher left UNPAIRED against the annotation, carrying the facts
the false-alarm autopsy (docs/false-alarm-character.txt) reads to name
a mechanism. Its only producer was an archived evidence script with
hardcoded paths and no test (docs/evidence/2026-08-09/scripts/tables/
autopsy.py); this is that producer as a tool, the sibling of
write_miss_table.py.

The digit-for-digit reproduction of the anchor run's 65-row table
needs that run's annotations, blink logs and per-second exports, which
live on the owner's machine, so it is the owner's step. What is
provable here is the nineteen columns, the ordering rule, the
refusals, and that the header matches the committed 2026-08-09
artefact byte for byte — all on synthetic fixtures.
"""

import sys
from pathlib import Path

import pytest

from blinklab.blink_log import BLINK_COLUMNS

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

from write_false_positive_table import (  # noqa: E402
    FALSE_POSITIVE_COLUMNS,
    collect_false_positives,
    render,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
COMMITTED = (
    REPO_ROOT
    / "docs/evidence/2026-08-09/tables-current-run"
    / "eyeblink8_false_positives.csv"
)

TAG_HEADER = "#eye-blink annotation file version 1.1\n#glasses: NO\n#start\n"


def _tag_row(
    frame: int, blink_id: int, closed: bool = False, non_frontal: bool = False
) -> str:
    """One annotation line in the real nineteen-field shape.

    Field index 2 is the non-frontal flag ("N"); index 3 is the left
    eye's fully-closed flag ("C").
    """
    return ":".join(
        [
            str(frame),
            str(blink_id),
            "N" if non_frontal else "X",
            "C" if closed else "X",
            "X",
            "X",
            "X",
            "236",
            "196",
            "142",
            "133",
            "257",
            "218",
            "281",
            "217",
            "320",
            "217",
            "344",
            "216",
        ]
    )


def write_clip(
    corpus: Path,
    subject: str,
    name: str,
    blinks: list[tuple[int, int, int, int]],
    total_frames: int,
    non_frontal_frames: tuple[int, ...] = (),
    times: dict[int, float] | None = None,
) -> None:
    """Write one clip's `.tag` (and its sibling `.txt` frame times).

    Each blink is (blink_id, start, end, closed_frames). Frames in
    `non_frontal_frames` carry the "N" flag. `times` writes the `.txt`
    the producer reads for the wall clock; omitted, no `.txt` is written
    and the wall-clock columns fall back to empty, as the tool allows.
    """
    frame_blink: dict[int, int] = {}
    frame_closed: dict[int, bool] = {}
    for blink_id, start, end, closed in blinks:
        for offset, frame in enumerate(range(start, end + 1)):
            frame_blink[frame] = blink_id
            frame_closed[frame] = offset < closed
    body = [
        _tag_row(
            frame,
            frame_blink.get(frame, -1),
            frame_closed.get(frame, False),
            frame in non_frontal_frames,
        )
        for frame in range(total_frames)
    ]
    directory = corpus / subject
    directory.mkdir(parents=True, exist_ok=True)
    (directory / f"{name}.tag").write_text(
        TAG_HEADER + "\n".join(body) + "\n", encoding="utf-8"
    )
    if times is not None:
        lines = [
            f"{frame} {seconds}" for frame, seconds in sorted(times.items())
        ]
        (directory / f"{name}.txt").write_text(
            "\n".join(lines) + "\n", encoding="utf-8"
        )


def write_log(
    measured: Path,
    name: str,
    detections: list[tuple[int, int]],
    mode: str = "stepped",
    frames_measured: int = 1000,
) -> None:
    """Write one clip's `<name>.blinks.csv` with the given detections."""
    lines = [
        "# source: file",
        f"# clip: {name}.mp4",
        f"# measurement_mode: {mode}",
        f"# frames_measured: {frames_measured}",
        ",".join(BLINK_COLUMNS),
    ]
    for start, end in detections:
        lines.append(f"{start},{end},{start * 33.3},200,3.5,70,50")
    measured.mkdir(parents=True, exist_ok=True)
    (measured / f"{name}.blinks.csv").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )


def write_seconds(
    measured: Path,
    name: str,
    rows: list[dict[str, str]],
) -> None:
    """Write one clip's `<name>.seconds.csv`, one row per second.

    The producer reads it positionally: row index i is second i. Each
    dict supplies whichever of apertureMm / baselineMm / shutBaselineMm
    / faceDetected a test cares about; the rest are blank.
    """
    columns = [
        "apertureMm",
        "baselineMm",
        "shutBaselineMm",
        "faceDetected",
    ]
    lines = ["# per-second export", ",".join(columns)]
    for row in rows:
        lines.append(",".join(row.get(column, "") for column in columns))
    measured.mkdir(parents=True, exist_ok=True)
    (measured / f"{name}.seconds.csv").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )


def _seconds(count: int, **overrides: dict[int, str]) -> list[dict[str, str]]:
    """`count` per-second rows, every one carrying a trusted face and a
    settled baseline unless a per-index override says otherwise."""
    rows: list[dict[str, str]] = []
    for index in range(count):
        row = {
            "apertureMm": "8.0",
            "baselineMm": "9.0",
            "shutBaselineMm": "7.5",
            "faceDetected": "true",
        }
        for column, per_index in overrides.items():
            if index in per_index:
                row[column] = per_index[index]
        rows.append(row)
    return rows


def test_the_columns_are_the_nineteen_the_committed_table_has() -> None:
    assert FALSE_POSITIVE_COLUMNS == [
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


def test_an_unpaired_detection_is_a_false_positive(tmp_path: Path) -> None:
    # One annotated blink at 100..106 and a detection at 50..52 that
    # pairs with nothing: it is a false alarm, and it is the only row.
    corpus = tmp_path / "corpus"
    measured = tmp_path / "measured"
    write_clip(corpus, "1", "clipA", [(12, 100, 106, 4)], total_frames=200)
    write_log(measured, "clipA", detections=[(50, 52)])
    write_seconds(measured, "clipA", _seconds(10))
    rows = collect_false_positives(corpus, measured)
    assert len(rows) == 1
    row = rows[0]
    assert row["clip"] == "clipA"
    assert row["startFrame"] == 50
    assert row["endFrame"] == 52
    assert row["frameLength"] == 3


def test_a_detection_that_pairs_is_not_a_false_positive(
    tmp_path: Path,
) -> None:
    # The detection overlaps the annotation, so match_blinks pairs it and
    # it is not in the table.
    corpus = tmp_path / "corpus"
    measured = tmp_path / "measured"
    write_clip(corpus, "1", "clipA", [(12, 100, 106, 4)], total_frames=200)
    write_log(measured, "clipA", detections=[(101, 105)])
    write_seconds(measured, "clipA", _seconds(10))
    assert collect_false_positives(corpus, measured) == []


def test_frames_to_nearest_annotation_is_zero_when_overlapping(
    tmp_path: Path,
) -> None:
    # A false alarm can overlap an annotated blink and still be unpaired
    # (a second detection the matcher did not use). Distance is then 0.
    corpus = tmp_path / "corpus"
    measured = tmp_path / "measured"
    write_clip(corpus, "1", "clipA", [(12, 100, 110, 4)], total_frames=200)
    # 101..104 pairs; 106..108 overlaps the same annotation but is the
    # extra detection, so it is the false positive, distance 0.
    write_log(measured, "clipA", detections=[(101, 104), (106, 108)])
    write_seconds(measured, "clipA", _seconds(10))
    rows = collect_false_positives(corpus, measured)
    assert len(rows) == 1
    assert rows[0]["framesToNearestAnnotatedBlink"] == 0


def test_frames_to_nearest_annotation_counts_the_gap(tmp_path: Path) -> None:
    # A detection well away from the one annotation: the gap is the
    # frames between them.
    corpus = tmp_path / "corpus"
    measured = tmp_path / "measured"
    write_clip(corpus, "1", "clipA", [(12, 100, 106, 4)], total_frames=200)
    write_log(measured, "clipA", detections=[(50, 52)])
    write_seconds(measured, "clipA", _seconds(10))
    rows = collect_false_positives(corpus, measured)
    # 52 to 100 is 48 frames.
    assert rows[0]["framesToNearestAnnotatedBlink"] == 48


def test_overlaps_non_frontal_when_a_span_frame_is_flagged(
    tmp_path: Path,
) -> None:
    corpus = tmp_path / "corpus"
    measured = tmp_path / "measured"
    write_clip(
        corpus,
        "1",
        "clipA",
        [(12, 100, 106, 4)],
        total_frames=200,
        non_frontal_frames=(51,),
    )
    write_log(measured, "clipA", detections=[(50, 52)])
    write_seconds(measured, "clipA", _seconds(10))
    rows = collect_false_positives(corpus, measured)
    assert rows[0]["overlapsNF"] == 1


def test_before_baseline_reads_the_ready_second(tmp_path: Path) -> None:
    # The baseline is empty for the first three seconds and settles at
    # second 3. A false alarm in second 1 fired before it was ready.
    corpus = tmp_path / "corpus"
    measured = tmp_path / "measured"
    write_clip(corpus, "1", "clipA", [(12, 100, 106, 4)], total_frames=300)
    write_log(measured, "clipA", detections=[(45, 47)])  # second 1
    seconds = _seconds(10, baselineMm={0: "", 1: "", 2: ""})
    write_seconds(measured, "clipA", seconds)
    rows = collect_false_positives(corpus, measured)
    assert rows[0]["baselineReadySecond"] == 3
    assert rows[0]["beforeBaselineReady"] == 1


def test_after_baseline_is_not_before_it(tmp_path: Path) -> None:
    corpus = tmp_path / "corpus"
    measured = tmp_path / "measured"
    write_clip(corpus, "1", "clipA", [(12, 200, 206, 4)], total_frames=400)
    write_log(measured, "clipA", detections=[(150, 152)])  # second 5
    seconds = _seconds(10, baselineMm={0: "", 1: ""})
    write_seconds(measured, "clipA", seconds)
    rows = collect_false_positives(corpus, measured)
    assert rows[0]["baselineReadySecond"] == 2
    assert rows[0]["beforeBaselineReady"] == 0


def test_the_per_second_join_reads_the_start_second(tmp_path: Path) -> None:
    # A detection starting at frame 50 sits in second int(50/30) == 1;
    # its aperture/baseline/face come from that row.
    corpus = tmp_path / "corpus"
    measured = tmp_path / "measured"
    write_clip(corpus, "1", "clipA", [(12, 200, 206, 4)], total_frames=400)
    write_log(measured, "clipA", detections=[(50, 52)])
    seconds = _seconds(
        10,
        apertureMm={1: "3.2"},
        faceDetected={1: "false"},
    )
    write_seconds(measured, "clipA", seconds)
    rows = collect_false_positives(corpus, measured)
    assert rows[0]["secondsRowIndex"] == 1
    assert rows[0]["apertureMmAtThatSecond"] == "3.2"
    assert rows[0]["faceDetectedAtThatSecond"] == "false"


def test_row_order_follows_the_corpus_walk_not_the_clip_name(
    tmp_path: Path,
) -> None:
    corpus = tmp_path / "corpus"
    measured = tmp_path / "measured"
    write_clip(corpus, "10", "zzz_cam", [(1, 150, 155, 3)], total_frames=300)
    write_clip(corpus, "2", "aaa_cam", [(1, 160, 165, 3)], total_frames=300)
    write_log(measured, "zzz_cam", detections=[(50, 52)])
    write_log(measured, "aaa_cam", detections=[(60, 62)])
    write_seconds(measured, "zzz_cam", _seconds(10))
    write_seconds(measured, "aaa_cam", _seconds(10))
    rows = collect_false_positives(corpus, measured)
    # Folder walk: "10/zzz_cam" before "2/aaa_cam"; a clip-name sort
    # would give the reverse.
    assert [row["clip"] for row in rows] == ["zzz_cam", "aaa_cam"]


def test_refuses_a_clip_whose_blink_log_is_missing(tmp_path: Path) -> None:
    corpus = tmp_path / "corpus"
    measured = tmp_path / "measured"
    write_clip(corpus, "1", "clipA", [(12, 100, 106, 4)], total_frames=200)
    write_seconds(measured, "clipA", _seconds(10))
    with pytest.raises(ValueError, match="clipA"):
        collect_false_positives(corpus, measured)


def test_refuses_a_clip_whose_seconds_export_is_missing(
    tmp_path: Path,
) -> None:
    # The seconds table is where the aperture/baseline/face columns come
    # from; without it the row cannot be filled, and a shorter table
    # would drop the clip silently.
    corpus = tmp_path / "corpus"
    measured = tmp_path / "measured"
    write_clip(corpus, "1", "clipA", [(12, 100, 106, 4)], total_frames=200)
    write_log(measured, "clipA", detections=[(50, 52)])
    with pytest.raises(ValueError, match="clipA"):
        collect_false_positives(corpus, measured)


def test_refuses_a_run_that_did_not_measure_every_frame(
    tmp_path: Path,
) -> None:
    corpus = tmp_path / "corpus"
    measured = tmp_path / "measured"
    write_clip(corpus, "1", "clipA", [(12, 100, 106, 4)], total_frames=200)
    write_log(measured, "clipA", detections=[(50, 52)], mode="watched")
    write_seconds(measured, "clipA", _seconds(10))
    with pytest.raises(ValueError, match="stepped"):
        collect_false_positives(corpus, measured)


def test_render_uses_crlf_and_a_trailing_newline() -> None:
    text = render([dict.fromkeys(FALSE_POSITIVE_COLUMNS, "") | {"clip": "c"}])
    assert text.endswith("\r\n")
    assert text.count("\r\n") == 2
    assert "\n" not in text.replace("\r\n", "")


def test_the_header_matches_the_committed_artefact() -> None:
    committed = COMMITTED.read_bytes()
    first_line = committed.split(b"\r\n", 1)[0]
    assert render([]).encode("utf-8").rstrip(b"\r\n") == first_line
