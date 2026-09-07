"""The plot is a smoke test on purpose.

Asserting the shape of a picture is a losing game: it either pins
pixels, which breaks on a font update, or it asserts almost nothing.
What is worth checking is that a real recording draws without raising
and produces a file with content in it, and that the title carries the
labels, since a plot without its labels is a pretty shape.
"""

from pathlib import Path

import pandas as pd

from blinklab.loader import load_session
from blinklab.plot import _title, blink_line_series, plot_session

FIXTURE = Path(__file__).parent / "fixtures" / "session-fixture.csv"


def test_a_real_session_draws(tmp_path: Path) -> None:
    session = load_session(FIXTURE)
    out = plot_session(session, tmp_path / "session.png")
    assert out.exists()
    # A PNG that is only a header would also "exist".
    assert out.stat().st_size > 10_000


def test_the_title_carries_the_labels(tmp_path: Path) -> None:
    session = load_session(FIXTURE)
    title = _title(session)
    assert "sleepiness before: 6" in title
    assert "after: 6" in title
    assert "min" in title


def test_a_session_without_labels_still_titles(tmp_path: Path) -> None:
    session = load_session(FIXTURE)
    session.metadata = {}
    assert "not asked" in _title(session)


class TestTheLineItDraws:
    """Roadmap 10.13a, ladder A8 (audit F-007).

    plot.py reconstructed the blink line as half the baseline. That is
    the passive line, and it is simply the wrong line whenever a person
    had calibrated: their stored guided line overrides the baseline,
    the detector reads it, and the picture drew a threshold nothing had
    used. The export now carries the line the detector actually read,
    so the picture reads it too.
    """

    def test_prefers_the_exported_line_over_the_reconstruction(self) -> None:
        frame = pd.DataFrame(
            {
                "baselineMm": [8.0, 8.0],
                "blinkLineMm": [3.4, 3.4],
                "blinkLineSource": pd.array(
                    ["guided", "guided"], dtype="string"
                ),
            }
        )
        line, label = blink_line_series(frame)
        # Half the baseline would be 4.0, and the detector read 3.4.
        assert list(line) == [3.4, 3.4]
        assert "guided" in label

    def test_falls_back_for_a_file_written_before_the_column(self) -> None:
        # An older export has the column filled with NA by the loader.
        # Reconstructing is the only thing left, and the label says so
        # rather than letting the picture imply it was measured.
        frame = pd.DataFrame(
            {
                "baselineMm": [8.0, 8.0],
                "blinkLineMm": [float("nan"), float("nan")],
                "blinkLineSource": pd.array([None, None], dtype="string"),
            }
        )
        line, label = blink_line_series(frame)
        assert list(line) == [4.0, 4.0]
        assert "reconstructed" in label

    def test_names_a_passive_line_as_the_line_that_was_read(self) -> None:
        frame = pd.DataFrame(
            {
                "baselineMm": [8.0, 8.0],
                "blinkLineMm": [4.0, 4.0],
                "blinkLineSource": pd.array(
                    ["passive", "passive"], dtype="string"
                ),
            }
        )
        _, label = blink_line_series(frame)
        assert "passive" in label
        assert "reconstructed" not in label

    def test_names_every_source_a_session_used(self) -> None:
        # A session that started before its baseline was ready and then
        # got one holds two sources, and hiding either would let a
        # reader think one line ran throughout.
        frame = pd.DataFrame(
            {
                "baselineMm": [8.0, 8.0],
                "blinkLineMm": [float("nan"), 4.0],
                "blinkLineSource": pd.array(
                    ["none", "passive"], dtype="string"
                ),
            }
        )
        _, label = blink_line_series(frame)
        assert "none" in label
        assert "passive" in label
