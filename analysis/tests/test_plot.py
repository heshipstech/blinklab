"""The plot is a smoke test on purpose.

Asserting the shape of a picture is a losing game: it either pins
pixels, which breaks on a font update, or it asserts almost nothing.
What is worth checking is that a real recording draws without raising
and produces a file with content in it, and that the title carries the
labels, since a plot without its labels is a pretty shape.
"""

from pathlib import Path

from blinklab.loader import load_session
from blinklab.plot import _title, plot_session

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
