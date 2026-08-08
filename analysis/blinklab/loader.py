"""Reading a recorded session, and refusing the ones that are broken.

A loader is where a project's honesty is either kept or quietly lost.
Every guard here exists because the alternative is worse than an
error: a file that half loads produces a plot that looks fine and a
statistic that is wrong, and nobody re-derives those by hand.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

# The shared contract, in the order the browser writes it. Kept in
# step with src/core/csv.ts by tests/test_csv_contract.py, which reads
# the TypeScript source and compares.
COLUMNS: list[str] = [
    "timestampMs",
    "faceDetected",
    "fps",
    "apertureMm",
    "baselineMm",
    "shutBaselineMm",
    "blinkRatePerMin",
    "lastBlinkDurationMs",
    "lastBlinkAmplitudeMm",
    "lastBlinkPeakVelocityMmPerS",
    "perclos",
    "longClosureCount",
    "fixationCount",
    "fixationMedianMs",
    "fixating",
    "onScreen",
]

BOOLEAN_COLUMNS = {"faceDetected", "fixating", "onScreen"}


class SessionError(ValueError):
    """A recording that cannot be trusted, named rather than guessed at."""


@dataclass
class Session:
    """One recording: its rows, and the little it knows about itself."""

    frame: pd.DataFrame
    metadata: dict[str, str] = field(default_factory=dict)

    @property
    def duration_s(self) -> float:
        """Wall time the recording spans, from timestamps not row count.

        The browser writes about one row per second, not exactly one,
        so counting rows would drift by roughly a minute per hour.
        """
        if self.frame.empty:
            return 0.0
        span = (
            self.frame["timestampMs"].iloc[-1]
            - self.frame["timestampMs"].iloc[0]
        )
        return float(span) / 1000.0


def _read_metadata(path: Path) -> dict[str, str]:
    """Pull the `# key: value` block the exporter writes above the header.

    pandas skips these with comment="#", which is what makes them a
    good place for session level facts, but it also means the only
    labels a session carries would be dropped on the floor unless
    something reads them deliberately.
    """
    metadata: dict[str, str] = {}
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            if not line.startswith("#"):
                break
            key, separator, value = line.lstrip("# ").partition(":")
            if separator:
                metadata[key.strip()] = value.strip()
    return metadata


def _check_columns(found: list[str]) -> None:
    if found == COLUMNS:
        return
    missing = [name for name in COLUMNS if name not in found]
    unknown = [name for name in found if name not in COLUMNS]
    if missing:
        raise SessionError(f"missing columns: {', '.join(missing)}")
    if unknown:
        raise SessionError(f"unknown columns: {', '.join(unknown)}")
    raise SessionError(
        "columns are in the wrong order, which means the file was not "
        "written by this project's exporter"
    )


def load_session(path: str | Path) -> Session:
    """Load one recorded session, or refuse it with a readable reason."""
    path = Path(path)
    if not path.exists():
        raise SessionError(f"no such file: {path}")

    metadata = _read_metadata(path)

    with path.open(encoding="utf-8") as handle:
        rows = list(
            csv.reader(line for line in handle if not line.startswith("#"))
        )
    if not rows:
        raise SessionError("the file has no header, so it is not a session")
    _check_columns(rows[0])
    if len(rows) == 1:
        raise SessionError(
            "the file has a header and no rows, which claims a recording "
            "that did not happen"
        )
    for number, row in enumerate(rows[1:], start=2):
        if len(row) != len(COLUMNS):
            raise SessionError(
                f"row {number} has {len(row)} fields, expected {len(COLUMNS)}"
            )

    frame = pd.read_csv(
        path,
        comment="#",
        # An empty cell means NOT MEASURED, the same thing the
        # FeatureRecord contract means by null, and NaN is how pandas
        # spells it. Nothing here may turn one into a zero.
        true_values=["true"],
        false_values=["false"],
    )
    for name in BOOLEAN_COLUMNS:
        frame[name] = frame[name].astype("boolean")

    if not frame["timestampMs"].is_monotonic_increasing:
        raise SessionError(
            "timestamps are not in order, and every statistic downstream "
            "assumes they are"
        )

    return Session(frame=frame, metadata=metadata)
