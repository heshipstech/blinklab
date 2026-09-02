"""The per-miss mechanism classifier, held to docs/miss-character.txt.

Watched failing before analysis/tools/miss_autopsy.py existed. The
tool answers the question docs/miss-trace.txt set up: for each missed
blink, what did the aperture the instrument read actually do during
the frames a human marked closed? Each miss is assigned one verdict
from the per-frame trace, and the classifier refuses to name a
mechanism the trace cannot show. These tests pin every verdict on
synthetic traces where the answer is hand-checkable, plus the
refusals on damaged input.

The trace row format is src/core/frameTrace.ts:
frameIndex, mediaTimeSeconds, apertureMm, blinkLineMm — an empty
aperture or line cell meaning null (no trusted face on that frame).
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

from miss_autopsy import (  # noqa: E402
    MissVerdict,
    classify_miss,
    clip_trace_from_rows,
    summarise,
)


def miss(clip: str, blink_id: str, start: int, end: int, closed: int) -> dict:
    return {
        "clip": clip,
        "blink_id": blink_id,
        "startFrame": str(start),
        "endFrame": str(end),
        "frameLength": str(end - start + 1),
        "fullyClosedFrames": str(closed),
    }


def trace(rows: list[tuple[int, object, object]]):
    """Build one clip's trace from (frameIndex, apertureMm, blinkLineMm).

    A cell of None becomes an empty CSV cell (no trusted reading).
    """
    header = "frameIndex,mediaTimeSeconds,apertureMm,blinkLineMm"
    lines = [header]
    for frame_index, aperture, line in rows:
        a = "" if aperture is None else repr(aperture)
        b = "" if line is None else repr(line)
        lines.append(f"{frame_index},{frame_index / 30},{a},{b}")
    return clip_trace_from_rows(lines)


class TestTheFourVerdicts:
    def test_above_line_when_aperture_never_crosses(self) -> None:
        # The closed span is frames 10..13. The aperture dips a
        # little but stays above the line on every measured frame:
        # the signal never crossed. min_ratio is the smallest
        # aperture/line over the span, here 7.0/4.0 = 1.75.
        clip = trace(
            [
                (10, 8.0, 4.0),
                (11, 7.0, 4.0),
                (12, 7.2, 4.0),
                (13, 8.0, 4.0),
            ]
        )
        v = classify_miss(miss("A", "1", 10, 13, 3), clip)
        assert isinstance(v, MissVerdict)
        assert v.mechanism == "above_line"
        assert v.min_ratio == 1.75
        assert v.measured_frames == 4

    def test_crossed_line_when_some_frame_dips_below(self) -> None:
        # Frame 12 read 3.5 against a line of 4.0: the signal WAS
        # below the line, yet the blink was missed. That implicates
        # the detector's state machine, not the aperture.
        clip = trace(
            [
                (10, 8.0, 4.0),
                (11, 5.0, 4.0),
                (12, 3.5, 4.0),
                (13, 6.0, 4.0),
            ]
        )
        v = classify_miss(miss("A", "1", 10, 13, 3), clip)
        assert v.mechanism == "crossed_line"
        # A ratio is not reported for a crossing: the question there
        # is the state machine, not the margin.
        assert v.min_ratio is None

    def test_not_measured_when_no_frame_covers_the_span(self) -> None:
        # The trace has frames on either side but none inside
        # [20, 23]: the closure fell where the instrument produced no
        # row at all. The sampling story.
        clip = trace([(10, 8.0, 4.0), (30, 8.0, 4.0)])
        v = classify_miss(miss("A", "1", 20, 23, 3), clip)
        assert v.mechanism == "not_measured"
        assert v.measured_frames == 0

    def test_no_trusted_face_when_all_apertures_null(self) -> None:
        # The span has frames, but the model returned no trusted face
        # on any of them (aperture null throughout): a trust failure,
        # distinct from a coverage gap and from a signal that held
        # above the line.
        clip = trace(
            [
                (10, None, None),
                (11, None, None),
                (12, None, None),
                (13, None, None),
            ]
        )
        v = classify_miss(miss("A", "1", 10, 13, 3), clip)
        assert v.mechanism == "no_trusted_face"


class TestTheSpanBoundary:
    def test_only_frames_inside_the_annotation_span_count(self) -> None:
        # A crossing OUTSIDE [10, 13] must not turn this into a
        # crossed_line verdict: frame 14 dips below the line but is
        # past the annotation's own end, so the span is above_line.
        clip = trace(
            [
                (10, 7.0, 4.0),
                (11, 6.0, 4.0),
                (12, 6.0, 4.0),
                (13, 7.0, 4.0),
                (14, 2.0, 4.0),
            ]
        )
        v = classify_miss(miss("A", "1", 10, 13, 3), clip)
        assert v.mechanism == "above_line"

    def test_a_single_untrusted_frame_is_skipped_not_fatal(self) -> None:
        # One null frame among trusted ones is simply not measured;
        # the verdict rests on the frames that carry a reading.
        clip = trace(
            [
                (10, 7.0, 4.0),
                (11, None, None),
                (12, 6.5, 4.0),
                (13, 7.0, 4.0),
            ]
        )
        v = classify_miss(miss("A", "1", 10, 13, 3), clip)
        assert v.mechanism == "above_line"
        assert v.measured_frames == 3


class TestItRefuses:
    def test_a_duplicate_frame_index_refuses(self) -> None:
        # One clip cannot measure the same frame twice: a duplicated
        # frameIndex means the trace is damaged, and silently keeping
        # one would hide that.
        with pytest.raises(ValueError, match="frame 11"):
            trace([(10, 8.0, 4.0), (11, 7.0, 4.0), (11, 6.0, 4.0)])

    def test_a_backwards_span_refuses(self) -> None:
        clip = trace([(10, 8.0, 4.0)])
        with pytest.raises(ValueError, match="startFrame"):
            classify_miss(miss("A", "1", 13, 10, 3), clip)


class TestTheSummary:
    def test_counts_and_closed_frame_share_per_mechanism(self) -> None:
        # Two above_line (one closed-frame, one shallow) and one
        # crossed_line. The closed-frame share is over the misses in
        # each mechanism; a share over an empty mechanism is None,
        # never zero.
        flat = trace([(10, 8.0, 4.0), (11, 7.0, 4.0)])
        dip = trace([(20, 8.0, 4.0), (21, 3.0, 4.0)])
        verdicts = [
            classify_miss(miss("A", "1", 10, 11, 2), flat),
            classify_miss(miss("A", "2", 10, 11, 0), flat),
            classify_miss(miss("A", "3", 20, 21, 2), dip),
        ]
        summary = summarise(verdicts)
        assert summary.counts["above_line"] == 2
        assert summary.counts["crossed_line"] == 1
        assert summary.closed_share["above_line"] == 0.5
        assert summary.closed_share["crossed_line"] == 1.0
        assert summary.closed_share.get("not_measured") is None
