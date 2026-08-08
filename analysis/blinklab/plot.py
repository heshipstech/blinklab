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

from blinklab.loader import Session  # noqa: E402

# Mirrors the thresholds the browser applies, so the lines drawn here
# are the lines the instrument actually used, not an approximation.
BLINK_LINE_FRACTION = 0.5
SHUT_LINE_FRACTION = 0.4


def plot_session(session: Session, path: str | Path) -> Path:
    """Draw one session to a PNG and return where it landed."""
    frame = session.frame
    seconds = (frame["timestampMs"] - frame["timestampMs"].iloc[0]) / 1000.0

    figure, axes = plt.subplots(3, 1, figsize=(11, 8), sharex=True)

    aperture = axes[0]
    aperture.plot(seconds, frame["apertureMm"], linewidth=1, label="aperture")
    # Gaps are gaps: pandas leaves NaN where nothing was measured and
    # matplotlib breaks the line there, which is the honest picture.
    aperture.plot(
        seconds,
        frame["baselineMm"] * BLINK_LINE_FRACTION,
        linewidth=1,
        linestyle="--",
        label="blink line",
    )
    aperture.plot(
        seconds,
        frame["shutBaselineMm"] * SHUT_LINE_FRACTION,
        linewidth=1,
        linestyle=":",
        label="shut line",
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
