"""The first picture of a real recording.

Three panels, because three things happened in every session and they
explain each other: how open the eyes were, what share of the last
minute they spent closed, and how often they blinked. Drawing them on
one shared time axis is the cheapest way to see whether the numbers
agree with the person who produced them.
"""

from __future__ import annotations

from pathlib import Path

import matplotlib

# Chosen before pyplot is imported: CI has no display, and a plot
# that only renders on a laptop is not a check.
matplotlib.use("Agg")

import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

from blinklab.loader import Session  # noqa: E402

# The fractions the browser applies to a PASSIVE baseline. They are a
# fallback now, not the answer: a person who has calibrated has a
# stored guided line that overrides the baseline entirely, and half
# their baseline is simply not what the detector read. Files exported
# from 7 September 2026 carry the line itself (roadmap 10.13a, ladder
# A8); older ones do not, and for those these are the best that can be
# done, said out loud in the legend rather than implied.
BLINK_LINE_FRACTION = 0.5
SHUT_LINE_FRACTION = 0.4


def _line_series(
    frame: pd.DataFrame,
    column: str,
    source_column: str,
    baseline_column: str,
    fraction: float,
    name: str,
) -> tuple[pd.Series, str]:
    """The line the detector read, or the best reconstruction of it.

    Returns the series and the legend label, because the two must not
    come apart: a reconstructed line drawn under a label that says
    "measured" is worse than no line, since a reader would check the
    aperture against it and believe the answer.
    """
    exported = frame[column]
    if exported.notna().any():
        sources = frame[source_column].dropna().unique()
        named = ", ".join(sorted(str(source) for source in sources))
        return exported, f"{name} ({named})"
    return (
        frame[baseline_column] * fraction,
        f"{name} (reconstructed from the baseline)",
    )


def blink_line_series(frame: pd.DataFrame) -> tuple[pd.Series, str]:
    """The blink line the detector read, and what to call it."""
    return _line_series(
        frame,
        "blinkLineMm",
        "blinkLineSource",
        "baselineMm",
        BLINK_LINE_FRACTION,
        "blink line",
    )


def shut_line_series(frame: pd.DataFrame) -> tuple[pd.Series, str]:
    """The shut line PERCLOS and the long-closure detector read."""
    return _line_series(
        frame,
        "shutLineMm",
        "shutLineSource",
        "shutBaselineMm",
        SHUT_LINE_FRACTION,
        "shut line",
    )


def plot_session(session: Session, path: str | Path) -> Path:
    """Draw one session to a PNG and return where it landed."""
    frame = session.frame
    seconds = (frame["timestampMs"] - frame["timestampMs"].iloc[0]) / 1000.0

    figure, axes = plt.subplots(3, 1, figsize=(11, 8), sharex=True)

    aperture = axes[0]
    aperture.plot(seconds, frame["apertureMm"], linewidth=1, label="aperture")
    # Gaps are gaps: pandas leaves NaN where nothing was measured and
    # matplotlib breaks the line there, which is the honest picture.
    blink_line, blink_label = blink_line_series(frame)
    aperture.plot(
        seconds,
        blink_line,
        linewidth=1,
        linestyle="--",
        label=blink_label,
    )
    shut_line, shut_label = shut_line_series(frame)
    aperture.plot(
        seconds,
        shut_line,
        linewidth=1,
        linestyle=":",
        label=shut_label,
    )
    aperture.set_ylabel("millimetres")
    aperture.set_title(_title(session))
    aperture.legend(loc="upper right", fontsize="small")

    closure = axes[1]
    closure.plot(seconds, frame["perclos"] * 100, linewidth=1)
    closure.set_ylabel("PERCLOS %")

    rate = axes[2]
    rate.plot(seconds, frame["blinkRatePerMin"], linewidth=1)
    rate.set_ylabel("blinks / min")
    rate.set_xlabel("seconds into the session")

    for axis in axes:
        axis.grid(alpha=0.3)

    figure.tight_layout()
    path = Path(path)
    figure.savefig(path, dpi=110)
    plt.close(figure)
    return path


def _title(session: Session) -> str:
    before = session.metadata.get("kss_before", "not asked")
    after = session.metadata.get("kss_after", "not asked")
    minutes = session.duration_s / 60.0
    return (
        f"blinklab session, {minutes:.1f} min  |  "
        f"sleepiness before: {before}  |  after: {after}"
    )
