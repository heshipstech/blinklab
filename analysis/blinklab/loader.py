"""Reading a recorded session, and refusing the ones that are broken.

A loader is where a project's honesty is either kept or quietly lost.
Every guard here exists because the alternative is worse than an
error: a file that half loads produces a plot that looks fine and a
statistic that is wrong, and nobody re-derives those by hand.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

from blinklab.metadata import read_metadata

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
    "baselineOverResting",
    "pupilDiameterMm",
]

# The header before pupilDiameterMm was appended (4 September 2026):
# every column but the last. Files exported between 23 August and then
# carry it, and load with the pupil column filled with NaN.
PRE_PUPIL_COLUMNS: list[str] = COLUMNS[:-1]

# What the exporter wrote before 23 August 2026, when the browser
# started writing its own account of the validation round's fifth
# check (baselineOverResting, src/core/rulerFit.ts). The validation
# round's six files, the dry run's and every session in the evidence
# folders carry this header, and the published tables must stay
# reproducible from them, so the loader accepts exactly this header
# too — not "any subset", this one known generation — and fills the
# newer columns with NaN, which is the truth: those sessions did not
# measure them.
LEGACY_COLUMNS: list[str] = COLUMNS[:-2]

# The header generations this loader accepts, newest first. Each is an
# exact known list, never a pattern; a file matching none is refused
# whole. Columns are append-only (src/core/csv.ts keeps every older
# header an exact prefix of the current one), so an older generation's
# missing trailing columns arrive as NaN.
ACCEPTED_GENERATIONS: list[list[str]] = [
    COLUMNS,
    PRE_PUPIL_COLUMNS,
    LEGACY_COLUMNS,
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
    def app_commit(self) -> str | None:
        """Which build wrote this file, or None for one that predates the row.

        Roadmap 10.1f2, ladder D6. The browser has stamped this into
        every export since remediation E2 and nothing read it, so a
        cohort table could average two instruments without saying so.
        None rather than a guess: exports before that build carry no
        such row, and they are old rather than damaged.
        """
        return self.metadata.get("app_commit")

    @property
    def protocol(self) -> str | None:
        """Which protocol this session was recorded under, or None.

        None is age rather than damage, the same as `app_commit`: the
        row shipped with the pilot contract and files older than it
        carry none. A caller that needs to know a session followed a
        given protocol must therefore treat None as "not stated" and
        not as "some other protocol".
        """
        return self.metadata.get("protocol")

    @property
    def records_dropped(self) -> int | None:
        """Per-second rows that fell out of the buffer, or None if unstated.

        None means nothing was dropped. The exporter writes this row
        ONLY when the buffer overran, and refuses to write a zero on
        purpose: a key that is always there and almost always zero
        teaches a reader to skip it, and the one session where it is
        not zero is the session that most needs reading.

        This docstring said the opposite until roadmap 10.1f4 — that
        the row was on every export, so a missing key meant an older
        build. The presence rules were exercised against the writers in
        10.1f3 and it was not, which is a reader stating a policy the
        writer never agreed to.

        An unreadable value is refused rather than defaulted, because
        "lots" quietly becoming zero is how a truncated session passes
        for a complete one.
        """
        return _records_dropped(self.metadata)

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


def cohort_commits(sessions: list[Session]) -> list[str]:
    """The distinct builds a set of sessions was recorded by, sorted.

    Roadmap 10.1f2, ladder D6. Sessions with no stamp are left out
    rather than counted as a build of their own: they predate the
    stamp, which is a different fact from being a different build, and
    `cohort_commit_line` says which.
    """
    return sorted(
        {
            session.app_commit
            for session in sessions
            if session.app_commit is not None
        }
    )


def cohort_commit_line(commits: list[str]) -> str:
    """One sentence about whether a cohort is one instrument.

    A table that averages across sessions is a table about one
    instrument, and until now nothing said whether it was. A cohort
    spanning a detector change would have been reported as one number
    with no note.
    """
    if not commits:
        return (
            "No session names the build that recorded it, so these "
            "files predate the build stamp and whether they share an "
            "instrument is unknown."
        )
    if len(commits) == 1:
        return f"All sessions were recorded by build {commits[0]}."
    return (
        f"These sessions come from {len(commits)} different builds "
        f"({', '.join(commits)}), so they are not one instrument and "
        "any number averaged across them describes more than one."
    )


def _records_dropped(metadata: dict[str, str]) -> int | None:
    """The dropped-row count, or None when the file predates the key.

    An unreadable value is refused rather than defaulted: "lots"
    quietly becoming zero is how a truncated session passes for a
    complete one.
    """
    raw = metadata.get("feature_records_dropped")
    if raw is None:
        return None
    try:
        return int(raw)
    except ValueError as error:
        raise SessionError(
            f"the metadata says feature_records_dropped: {raw!r}, "
            "which is not a count the exporter could have written"
        ) from error


def _read_metadata(path: Path) -> dict[str, str]:
    """The shared reader, with this module's own refusal."""
    return read_metadata(
        path,
        lambda key: SessionError(
            f"the metadata declares {key!r} twice, and the "
            "exporter never writes a key twice"
        ),
    )


def _check_columns(found: list[str]) -> list[str]:
    """The header's own generation of the contract, or a refusal.

    Three headers are real: the current one and the two the exporter
    wrote before pupilDiameterMm (4 September 2026) and before
    baselineOverResting (23 August 2026). Anything else is still
    refused whole — a generation is an exact list, never a pattern.
    """
    for generation in ACCEPTED_GENERATIONS:
        if found == generation:
            return generation
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

    with path.open(encoding="utf-8") as handle:
        text = handle.read()
    if text.startswith("\ufeff"):
        # Excel's "CSV UTF-8" save adds this mark, so a participant who
        # opened their export "just to look" and hit save produces one.
        # Deliberately still a refusal rather than tolerated: a file
        # that has been through Excel may be damaged in ways the mark
        # merely advertises, and the message should say what happened
        # rather than list every column as missing.
        raise SessionError(
            "the file begins with a byte order mark, which the exporter "
            'never writes and Excel\'s "CSV UTF-8" save adds. This file '
            "has been through another program on its way here."
        )

    metadata = _read_metadata(path)
    # Parsed here rather than lazily, so a damaged count is refused
    # when the file is opened rather than at whatever moment a caller
    # happens to ask. A loader that half succeeds is worse than one
    # that fails, which is this module's oldest rule.
    _records_dropped(metadata)

    # pandas gets exactly the lines the checks below see. It used to
    # read the file itself with comment="#", which cuts a line at a
    # hash ANYWHERE in it, while the pre-check only skips lines that
    # START with one. The two readers saw different files, and the
    # difference was silent: a hash inside a cell dropped the row's
    # tail to NaN with no refusal.
    kept = [
        line
        for line in text.splitlines(keepends=True)
        if not line.startswith("#")
    ]
    rows = list(csv.reader(kept))
    if not rows:
        raise SessionError("the file has no header, so it is not a session")
    generation = _check_columns(rows[0])
    if len(rows) == 1:
        raise SessionError(
            "the file has a header and no rows, which claims a recording "
            "that did not happen"
        )
    for number, row in enumerate(rows[1:], start=2):
        if len(row) != len(generation):
            raise SessionError(
                f"row {number} has {len(row)} fields, "
                f"expected {len(generation)}"
            )

    frame = pd.read_csv(
        io.StringIO("".join(kept)),
        # An empty cell means NOT MEASURED, the same thing the
        # FeatureRecord contract means by null, and NaN is how pandas
        # spells it. Nothing here may turn one into a zero.
        true_values=["true"],
        false_values=["false"],
    )
    # A legacy file gets the newer columns as NaN so every consumer
    # sees one shape of frame. NaN and not zero: those sessions never
    # measured this, and the whole codebase's rule is that the two
    # are different claims.
    for name in COLUMNS:
        if name not in generation:
            frame[name] = float("nan")
    for name in BOOLEAN_COLUMNS:
        try:
            frame[name] = frame[name].astype("boolean")
        except (TypeError, ValueError) as error:
            raise SessionError(
                f"column {name} holds a value that is neither true nor false"
            ) from error

    # A cell that is not a number leaves its whole column as strings,
    # and the crash arrives later, inside a check, as a bare pandas
    # error no caller catches. Refuse here, naming the column, so one
    # corrupt cell costs one participant a refusal row instead of
    # costing everybody the table.
    for name in COLUMNS:
        if name in BOOLEAN_COLUMNS:
            continue
        if not pd.api.types.is_numeric_dtype(
            frame[name]
        ) or pd.api.types.is_bool_dtype(frame[name]):
            raise SessionError(
                f"column {name} holds a value that is not a number"
            )

    if not frame["timestampMs"].is_monotonic_increasing:
        raise SessionError(
            "timestamps are not in order, and every statistic downstream "
            "assumes they are"
        )

    return Session(frame=frame, metadata=metadata)
