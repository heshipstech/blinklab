"""The miss table's producer, held to the shape three tools already read.

Roadmap 10.8a4. `eyeblink8_misses.csv` is what `miss_autopsy.py`,
`miss_overlap.py` and the TypeScript replay runner all join to, and its
only producer was an archived evidence script with hardcoded paths and
no test. This is that producer as a tool: it emits the six committed
columns from a run's annotations and blink logs, in the order the corpus
walk yields, and it REFUSES a clip whose log is missing or was not
measured completely rather than writing a shorter table.

The digit-for-digit reproduction of the committed 2026-08-21-rearm table
needs that run's annotations (a third-party download) and its blink logs
(the owner's machine), so it is the owner's step during the regression
run. What is provable here is the format, the ordering rule, and the
refusals, on synthetic fixtures — plus that the header matches the real
committed artefact byte for byte.
"""

import sys
from pathlib import Path

import pytest

from blinklab.blink_log import BLINK_COLUMNS

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

from write_miss_table import (  # noqa: E402
    MISS_COLUMNS,
    collect_misses,
    render,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
COMMITTED_REARM = (
    REPO_ROOT / "docs/evidence/2026-08-21-rearm/eyeblink8_misses.csv"
)

TAG_HEADER = "#eye-blink annotation file version 1.1\n#glasses: NO\n#start\n"


def _tag_row(frame: int, blink_id: int, closed: bool = False) -> str:
    """One annotation line in the real nineteen-field shape.

    `closed` marks the left eye fully closed (field index 3), which is
    what load_annotation counts into fully_closed_frames.
    """
    left = "C" if closed else "X"
    return ":".join(
        [
            str(frame),
            str(blink_id),
            "X",
            left,
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
) -> None:
    """Write one clip's `.tag` under corpus/<subject>/<name>.tag.

    Each blink is (blink_id, start, end, closed_frames): a contiguous run
    of frames carrying that id, the first `closed_frames` of them marked
    fully closed. Frames outside every blink carry -1.
    """
    frame_blink: dict[int, int] = {}
    frame_closed: dict[int, bool] = {}
    for blink_id, start, end, closed in blinks:
        for offset, frame in enumerate(range(start, end + 1)):
            frame_blink[frame] = blink_id
            frame_closed[frame] = offset < closed
    body_rows = [
        _tag_row(
            frame,
            frame_blink.get(frame, -1),
            frame_closed.get(frame, False),
        )
        for frame in range(total_frames)
    ]
    directory = corpus / subject
    directory.mkdir(parents=True, exist_ok=True)
    (directory / f"{name}.tag").write_text(
        TAG_HEADER + "\n".join(body_rows) + "\n", encoding="utf-8"
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
        # Only start and end matter to the match; the rest are plausible
        # numbers so load_blink_log reads the row without complaint.
        lines.append(f"{start},{end},{start * 33.3},200,3.5,70,50")
    measured.mkdir(parents=True, exist_ok=True)
    (measured / f"{name}.blinks.csv").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )


def test_the_columns_are_the_six_the_committed_table_has() -> None:
    assert MISS_COLUMNS == [
        "clip",
        "blink_id",
        "startFrame",
        "endFrame",
        "frameLength",
        "fullyClosedFrames",
    ]


def test_a_missed_blink_appears_with_its_annotation_facts(
    tmp_path: Path,
) -> None:
    # One blink over frames 100..106 (7 frames, 4 fully closed), and a
    # log that detected nothing. It is a miss, and every column but the
    # clip name is a fact about the ANNOTATION, not the detection.
    corpus = tmp_path / "corpus"
    measured = tmp_path / "measured"
    write_clip(corpus, "1", "clipA", [(12, 100, 106, 4)], total_frames=200)
    write_log(measured, "clipA", detections=[])
    rows = collect_misses(corpus, measured)
    assert rows == [
        {
            "clip": "clipA",
            "blink_id": "12",
            "startFrame": "100",
            "endFrame": "106",
            "frameLength": "7",
            "fullyClosedFrames": "4",
        }
    ]


def test_a_detected_blink_is_not_a_miss(tmp_path: Path) -> None:
    # The same blink, this time detected by an overlapping detection.
    # match_blinks pairs it, so it is not in the table.
    corpus = tmp_path / "corpus"
    measured = tmp_path / "measured"
    write_clip(corpus, "1", "clipA", [(12, 100, 106, 4)], total_frames=200)
    write_log(measured, "clipA", detections=[(101, 105)])
    assert collect_misses(corpus, measured) == []


def test_row_order_follows_the_corpus_walk_not_the_clip_name(
    tmp_path: Path,
) -> None:
    # The trap the archived producer's `sorted(rglob("*.tag"))` avoids
    # and a clip-name sort would spring. Subject folders sort as
    # strings, so "10" comes before "2"; the clip in folder "10" is
    # named to sort LAST alphabetically, so the folder walk and a
    # clip-name sort disagree. The committed file follows the folder
    # walk, and only a fixture where the two orders differ can prove it.
    corpus = tmp_path / "corpus"
    measured = tmp_path / "measured"
    write_clip(corpus, "10", "zzz_cam", [(1, 50, 55, 3)], total_frames=200)
    write_clip(corpus, "2", "aaa_cam", [(1, 60, 65, 3)], total_frames=200)
    write_log(measured, "zzz_cam", detections=[])
    write_log(measured, "aaa_cam", detections=[])
    rows = collect_misses(corpus, measured)
    # Folder walk: "10/zzz_cam" before "2/aaa_cam". Clip-name sort would
    # give the reverse.
    assert [row["clip"] for row in rows] == ["zzz_cam", "aaa_cam"]


def test_refuses_a_clip_whose_blink_log_is_missing(tmp_path: Path) -> None:
    # The opposite of miss_autopsy's skip-and-continue. A clip the corpus
    # annotates but the run did not measure is "we did not look", not
    # "no misses here", and a shorter table would say the wrong one.
    corpus = tmp_path / "corpus"
    measured = tmp_path / "measured"
    write_clip(corpus, "1", "clipA", [(12, 100, 106, 4)], total_frames=200)
    measured.mkdir(parents=True, exist_ok=True)
    with pytest.raises(ValueError, match="clipA"):
        collect_misses(corpus, measured)


def test_refuses_a_run_that_did_not_measure_every_frame(
    tmp_path: Path,
) -> None:
    # A watched run is capped by how fast the model happened to run, so
    # blinks it never saw would arrive here as misses of the detector.
    # The miss table is only honest over a stepped run, the same rule
    # evaluate_eyeblink8 applies to the score.
    corpus = tmp_path / "corpus"
    measured = tmp_path / "measured"
    write_clip(corpus, "1", "clipA", [(12, 100, 106, 4)], total_frames=200)
    write_log(measured, "clipA", detections=[], mode="watched")
    with pytest.raises(ValueError, match="stepped"):
        collect_misses(corpus, measured)


def test_render_uses_crlf_and_a_trailing_newline() -> None:
    # The committed table was written by Python's csv writer, whose
    # default line terminator is CRLF, trailing one included. A miss
    # table that joined a trace's CRLF rows with bare LF would be a
    # third dialect, which is the whole thing this producer avoids.
    text = render(
        [
            {
                "clip": "clipA",
                "blink_id": "12",
                "startFrame": "100",
                "endFrame": "106",
                "frameLength": "7",
                "fullyClosedFrames": "4",
            }
        ]
    )
    assert text.endswith("\r\n")
    assert text.count("\r\n") == 2
    assert "\n" not in text.replace("\r\n", "")


def test_the_header_matches_the_committed_rearm_table() -> None:
    # The closest a container without the corpus can get to the
    # digit-for-digit clause: the header the producer writes is the
    # header the committed artefact carries, byte for byte.
    committed = COMMITTED_REARM.read_bytes()
    first_line = committed.split(b"\r\n", 1)[0]
    assert render([]).encode("utf-8").rstrip(b"\r\n") == first_line
