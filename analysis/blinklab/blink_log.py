"""Reading the blink log the browser exports.

The per-second CSV answers what the eyes were doing during a second.
This one answers when each blink happened, in FRAMES, which is the only
unit a comparison against a human annotator can use.

Refuses rather than guesses, for the same reason the session loader
does: an evaluation built on a file that half-loaded still produces a
number, and that number looks exactly like a real one.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path

from blinklab.blink_match import Interval
from blinklab.metadata import read_metadata

# The contract from src/core/blinkLog.ts, in the order it is written.
BLINK_COLUMNS = [
    "startFrame",
    "endFrame",
    "atMs",
    "durationMs",
    "amplitudeMm",
    "peakClosingVelocityMmPerS",
    "amplitudeOverVelocityMs",
]


@dataclass(frozen=True)
class DetectedBlink:
    """One blink the instrument reported."""

    start_frame: int
    end_frame: int
    at_ms: float
    duration_ms: float

    def interval(self) -> Interval:
        return Interval(start_frame=self.start_frame, end_frame=self.end_frame)


@dataclass(frozen=True)
class BlinkLog:
    """One clip's detections, with the metadata that says how it was
    measured."""

    name: str
    blinks: list[DetectedBlink]
    metadata: dict[str, str] = field(default_factory=dict)

    @property
    def measured_completely(self) -> bool:
        """Whether every frame of the source was measured.

        Only a stepped run guarantees it. A watched run is capped by how
        fast the model happened to run on that machine, and comparing a
        partial measurement against a complete annotation would blame
        the detector for frames it never saw.
        """
        return self.metadata.get("measurement_mode") == "stepped"

    @property
    def frames_measured(self) -> int | None:
        """How many frames the instrument looked at, or None.

        None for two different files: one whose export predates the
        row, and one whose row cannot be read. Roadmap 10.1f4 states
        the policy rather than changing it, because the caller here is
        a coverage report that prints "unstated" either way, and
        splitting the two would change what a corpus run refuses. The
        merge is named so the next reader knows it is a choice.
        """
        raw = self.metadata.get("frames_measured")
        if raw is None:
            return None
        try:
            return int(raw)
        except ValueError:
            return None


def _read_metadata(path: Path) -> dict[str, str]:
    """The shared reader.

    This module used to accept a repeated key while loader.py and
    validation.py refused one, so the same damaged file was rejected by
    two readers and silently misread by the third. Roadmap 10.16.
    """
    return read_metadata(
        path,
        lambda key: ValueError(
            f"{path.name}: the metadata declares {key!r} twice, and "
            "the exporter never writes a key twice"
        ),
    )


def load_blink_log(path: Path) -> BlinkLog:
    """Read one exported blink log.

    Raises ValueError, naming the problem, for anything it cannot read
    with confidence.
    """
    if not path.exists():
        raise ValueError(f"No blink log at {path}")

    metadata = _read_metadata(path)
    text = path.read_text(encoding="utf-8")
    rows = [
        line
        for line in text.splitlines()
        if line.strip() and not line.startswith("#")
    ]
    if not rows:
        raise ValueError(f"{path.name} has no header and no rows")

    reader = csv.reader(rows)
    header = next(reader)
    if header != BLINK_COLUMNS:
        raise ValueError(
            f"{path.name}: columns are {header}, expected {BLINK_COLUMNS}. "
            "The browser's blink log contract has changed, or this is a "
            "different file."
        )

    blinks: list[DetectedBlink] = []
    for number, row in enumerate(reader, start=2):
        if len(row) != len(BLINK_COLUMNS):
            raise ValueError(
                f"{path.name} row {number}: {len(row)} fields, expected "
                f"{len(BLINK_COLUMNS)}"
            )
        start_raw, end_raw = row[0], row[1]
        # Empty frame numbers mean a live camera session, where a frame
        # index means nothing to anyone. Such a file cannot be compared
        # against a frame-indexed annotation at all, so say so rather
        # than silently drop rows and report on what is left.
        if start_raw == "" or end_raw == "":
            raise ValueError(
                f"{path.name} row {number}: no frame numbers. This is a "
                "camera session, and only a clip can be compared against "
                "frame-indexed ground truth."
            )
        try:
            start_frame = int(start_raw)
            end_frame = int(end_raw)
            at_ms = float(row[2])
            duration_ms = float(row[3])
        except ValueError as error:
            raise ValueError(
                f"{path.name} row {number}: could not read the numbers"
            ) from error
        if end_frame < start_frame:
            raise ValueError(
                f"{path.name} row {number}: blink ends at frame "
                f"{end_frame} before it starts at {start_frame}"
            )
        blinks.append(
            DetectedBlink(
                start_frame=start_frame,
                end_frame=end_frame,
                at_ms=at_ms,
                duration_ms=duration_ms,
            )
        )

    return BlinkLog(name=path.stem, blinks=blinks, metadata=metadata)
