"""Reading the files a validation round sends back.

The six-person round is described in `docs/validation-plan.md`, written
before any of these files existed. This module is the reading half: it
turns a folder of exported CSVs into paired sessions, and refuses, by
name, everything it cannot trust.

Nothing here computes a check. That is deliberate. If the checks and
the reader arrive together it becomes very easy to let a refusal soften
into a default, and a default is how a session that failed ends up
reported as a session that passed.

Why a second blink log reader exists beside `blink_log.py`: that one
refuses any row without frame numbers, and a live camera session writes
exactly that, because a frame index means nothing to a person sitting
at a webcam. Its refusal is correct and must stay, since it is what
protects the Eyeblink8 comparison from being handed a camera recording.
So this is the mirror of it, and each refuses what the other is for.
"""

from __future__ import annotations

import csv
import math
import re
from dataclasses import dataclass, field
from pathlib import Path

from blinklab.blink_log import BLINK_COLUMNS
from blinklab.loader import Session, SessionError, load_session

SESSION_PREFIX = "blinklab-session-"
BLINKS_PREFIX = "blinklab-blinks-"

# `# marker_1_seconds: 42.500`, written by sessionMetadataRows in
# src/core/sessionMetadata.ts.
MARKER_KEY = re.compile(r"^marker_(\d+)_seconds$")


class ValidationError(ValueError):
    """A file the round cannot be read from, named rather than guessed."""


@dataclass(frozen=True)
class CameraBlink:
    """One blink from a live session: a time, never a frame."""

    at_ms: float
    duration_ms: float
    amplitude_mm: float | None


@dataclass(frozen=True)
class CameraBlinkLog:
    """One live session's detections, and how it was measured."""

    name: str
    blinks: list[CameraBlink]
    metadata: dict[str, str] = field(default_factory=dict)

    @property
    def blinks_lost(self) -> int:
        """Rows the exporter says it detected but could not write.

        The blink log declares its own truncation rather than looking
        complete, which is the fix from #172. Reading the declaration
        and ignoring it would put the defect straight back.
        """
        detected = self.metadata.get("blinks_detected")
        recorded = self.metadata.get("blinks_recorded")
        if detected is None or recorded is None:
            return 0
        try:
            return max(0, int(detected) - int(recorded))
        except ValueError:
            return 0


def _read_metadata(path: Path) -> dict[str, str]:
    """The `# key: value` block above the header, as written."""
    metadata: dict[str, str] = {}
    with path.open(encoding="utf-8", newline="") as handle:
        for line in handle:
            if not line.startswith("#"):
                break
            key, separator, value = line.lstrip("# ").partition(":")
            if separator:
                key = key.strip()
                # A dict would resolve a repeated key in favour of
                # whichever line came last, silently. The exporter
                # never writes a key twice, so which value is true
                # cannot be known from here.
                if key in metadata:
                    raise ValidationError(
                        f"{path.name}: the metadata declares {key!r} "
                        "twice, and the exporter never writes a key "
                        "twice"
                    )
                metadata[key] = value.strip()
    return metadata


def _refuse_clip(metadata: dict[str, str], name: str) -> None:
    """A clip run answers a different question and must not be mixed in.

    The round is about live webcams in real rooms. A clip recorded at a
    fixed rate through a file has neither a camera nor a room, and its
    numbers would sit in the published table looking like somebody's
    laptop.
    """
    source = metadata.get("source")
    if source == "file":
        raise ValidationError(
            f"{name}: this is a clip run, not a camera session. The "
            "validation round measures live webcams, and a clip "
            "carries no camera and no room."
        )


def load_camera_blinks(path: str | Path) -> CameraBlinkLog:
    """Read one live session's blink log, or refuse it by name."""
    path = Path(path)
    if not path.exists():
        raise ValidationError(f"no such file: {path}")

    text = path.read_text(encoding="utf-8")
    if text.startswith("\ufeff"):
        # Excel's "CSV UTF-8" save adds this mark. Still a refusal,
        # deliberately: a file that has been through Excel may be
        # damaged in ways the mark merely advertises. The message just
        # points at the right culprit.
        raise ValidationError(
            f"{path.name}: the file begins with a byte order mark, "
            'which the exporter never writes and Excel\'s "CSV UTF-8" '
            "save adds. This file has been through another program on "
            "its way here."
        )

    metadata = _read_metadata(path)
    _refuse_clip(metadata, path.name)

    rows = [
        line
        for line in text.splitlines()
        if line.strip() and not line.startswith("#")
    ]
    if not rows:
        raise ValidationError(f"{path.name}: no header and no rows")

    reader = csv.reader(rows)
    header = next(reader)
    if header != BLINK_COLUMNS:
        raise ValidationError(
            f"{path.name}: columns are {header}, expected "
            f"{BLINK_COLUMNS}. This was not written by the page's "
            "blink log exporter."
        )

    blinks: list[CameraBlink] = []
    for number, row in enumerate(reader, start=2):
        if len(row) != len(BLINK_COLUMNS):
            raise ValidationError(
                f"{path.name} row {number}: {len(row)} fields, expected "
                f"{len(BLINK_COLUMNS)}"
            )
        # Frame numbers present means a clip, the mirror of the refusal
        # in blink_log.py. Checked as well as the metadata line above,
        # because the two say the same thing by different routes and a
        # file that disagrees with itself should be refused twice over
        # rather than believed once.
        if row[0] != "" or row[1] != "":
            raise ValidationError(
                f"{path.name} row {number}: this row has frame numbers, "
                "so it came from a clip rather than a live camera."
            )
        try:
            at_ms = float(row[2])
            duration_ms = float(row[3])
            # An empty cell means NOT MEASURED and must never become a
            # zero. A blink whose shape could not be analysed is not a
            # blink of zero amplitude. Parsed inside this try on
            # purpose: it used to sit below it, where one corrupt cell
            # raised a bare ValueError that crashed the whole report.
            amplitude = None if row[4] == "" else float(row[4])
        except ValueError as error:
            raise ValidationError(
                f"{path.name} row {number}: could not read the time, "
                "the duration or the amplitude"
            ) from error
        # float() happily parses "inf" and "nan", and a NaN time is
        # invisible to every window comparison, so it would silently
        # count as outside the marks.
        finite = [at_ms, duration_ms] + (
            [] if amplitude is None else [amplitude]
        )
        if not all(math.isfinite(value) for value in finite):
            raise ValidationError(
                f"{path.name} row {number}: a time, duration or "
                "amplitude that is not a finite number"
            )
        blinks.append(
            CameraBlink(
                at_ms=at_ms,
                duration_ms=duration_ms,
                amplitude_mm=amplitude,
            )
        )

    # A header with no rows cannot come from the page: the exporter
    # returns nothing at all when no blink was detected, which is why a
    # MISSING file is the honest signal for that and is not refused.
    # So an empty one arrived some other way, most likely truncated in
    # transit, and accepting it would make a damaged file and a real
    # detection failure look identical in the table.
    if not blinks:
        raise ValidationError(
            f"{path.name}: a header and no rows. The page never writes "
            "that file at all when nothing was detected, so this one "
            "lost its rows somewhere between the browser and here."
        )

    times = [blink.at_ms for blink in blinks]
    if times != sorted(times):
        raise ValidationError(
            f"{path.name}: blinks are not in time order, and every "
            "window this round cuts assumes they are."
        )
    return CameraBlinkLog(name=path.stem, blinks=blinks, metadata=metadata)


def session_markers_ms(session: Session) -> list[float]:
    """The marked moments, in milliseconds on the records' own clock.

    Markers live in the per-second file only; the blink log carries
    source and coverage metadata and nothing else. Both files stamp
    times on the same clock, so a marker read here cuts a window in the
    blink log without a conversion.

    The declared count is checked against the lines actually found. A
    file that says three markers and carries two has lost one, and
    quietly reporting on the two would be the exact shape of failure
    this project keeps meeting.
    """
    found: dict[int, float] = {}
    for key, value in session.metadata.items():
        match = MARKER_KEY.match(key)
        if match is None:
            continue
        try:
            seconds = float(value)
        except ValueError as error:
            raise ValidationError(
                f"marker {match.group(1)} is not a number: {value!r}"
            ) from error
        # float() parses "inf" and "nan" without complaint. An infinite
        # mark makes a window that never ends, and a NaN one is
        # invisible to every comparison, so nothing sits in its window
        # and the verdict reads MISSED, silently. The probe run's one
        # wrong prediction was here: the order check below does NOT
        # catch NaN, because sorted() carries the same object across
        # and list comparison tests identity before equality.
        if not math.isfinite(seconds):
            raise ValidationError(
                f"marker {match.group(1)} is not a finite number: {value!r}"
            )
        found[int(match.group(1))] = seconds * 1000.0

    declared_raw = session.metadata.get("markers")
    if declared_raw is not None:
        try:
            declared = int(declared_raw)
        except ValueError as error:
            raise ValidationError(
                f"the markers count is not a number: {declared_raw!r}"
            ) from error
        if declared != len(found):
            raise ValidationError(
                f"the file declares {declared} markers and carries "
                f"{len(found)}"
            )

    ordered = [found[index] for index in sorted(found)]
    if ordered != sorted(ordered):
        raise ValidationError(
            "the markers are numbered in one order and timed in "
            "another, so which window they cut cannot be known"
        )
    return ordered


@dataclass(frozen=True)
class PairPaths:
    """One participant's files, before anything has been read."""

    label: str
    stamp: str
    session_path: Path
    # None means the page wrote no blink log, which is a RESULT and not
    # an accident. See find_pairs.
    blinks_path: Path | None


@dataclass(frozen=True)
class SessionPair:
    """One participant's session, loaded."""

    label: str
    stamp: str
    session: Session
    blinks: CameraBlinkLog | None

    @property
    def no_blinks_detected(self) -> bool:
        """Whether the page detected nothing at all this session."""
        return self.blinks is None


def find_pairs(directory: str | Path) -> list[PairPaths]:
    """Pair the exports in a folder, refusing anything unaccounted for.

    A session file with no blink log is NOT an error, and this is the
    single most important line in the module. `serialiseBlinkEvents`
    returns nothing when no blink was ever detected, so a total
    instrument failure produces no second file, and that looks exactly
    like a participant who forgot to press the button. Dropping such a
    person would hide the worst outcome the round can produce, so the
    pair is returned with `blinks_path` set to None and the report says
    "no blinks detected" out loud.

    The reverse IS an error: a blink log with no session file means the
    session file was lost in the post, and reporting on the others
    while somebody's data sits unread in the folder is not acceptable.

    So is a stray CSV. A participant who renames a file before emailing
    it would otherwise be silently invisible, which is the same defect
    wearing different clothes.
    """
    directory = Path(directory)
    if not directory.is_dir():
        raise ValidationError(f"no such folder: {directory}")

    sessions: dict[str, Path] = {}
    blinks: dict[str, Path] = {}
    strays: list[str] = []
    # Every entry in the folder is accounted for, not just `*.csv`.
    # The old glob was case sensitive and extension bound, so a blinks
    # file renamed to `.CSV` or `.csv.txt` in transit was not paired,
    # not a stray, not refused: its session paired with nothing, the
    # row read "no log", and a file holding ten detected blinks became
    # a MISSED verdict that criterion 1 counted against the detector.
    for path in sorted(directory.iterdir()):
        if path.name == ".DS_Store":
            # The one exception, by name: macOS drops this into any
            # folder Finder has opened, and refusing the round over it
            # would train people to expect refusals that mean nothing.
            continue
        if path.is_file() and path.name.endswith(".csv"):
            if path.name.startswith(SESSION_PREFIX):
                sessions[path.name[len(SESSION_PREFIX) : -len(".csv")]] = path
                continue
            if path.name.startswith(BLINKS_PREFIX):
                blinks[path.name[len(BLINKS_PREFIX) : -len(".csv")]] = path
                continue
        strays.append(path.name)

    if strays:
        raise ValidationError(
            "these files are in the folder and are not exports this "
            f"round knows how to read: {', '.join(strays)}. A renamed "
            "file would otherwise be skipped without a word."
        )
    orphans = sorted(set(blinks) - set(sessions))
    if orphans:
        raise ValidationError(
            "these blink logs have no matching session file, so their "
            f"participant cannot be reported on at all: {orphans}"
        )
    if not sessions:
        raise ValidationError(f"no session exports in {directory}")

    return [
        PairPaths(
            label=f"P{position}",
            stamp=stamp,
            session_path=sessions[stamp],
            blinks_path=blinks.get(stamp),
        )
        # Sorted by the stamp, which is an ISO time with its colons
        # swapped for dashes, so it sorts by name and by time at once.
        for position, stamp in enumerate(sorted(sessions), start=1)
    ]


def load_pair(paths: PairPaths) -> SessionPair:
    """Load one participant's files, or refuse them by name.

    Raises rather than returning a partial pair. The caller is expected
    to catch, and to print a refusal row for that participant rather
    than dropping them: a person missing from the table is a person
    nobody looks for.
    """
    try:
        session = load_session(paths.session_path)
    except SessionError as error:
        raise ValidationError(f"{paths.session_path.name}: {error}") from error

    _refuse_clip(session.metadata, paths.session_path.name)

    blinks = (
        None
        if paths.blinks_path is None
        else load_camera_blinks(paths.blinks_path)
    )
    return SessionPair(
        label=paths.label,
        stamp=paths.stamp,
        session=session,
        blinks=blinks,
    )
