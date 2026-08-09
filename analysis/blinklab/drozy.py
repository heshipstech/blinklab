"""Reading DROZY, and turning one session into one row of features.

DROZY is used under written permission from Professor Jacques Verly,
recorded in DATASETS.md. The condition is citation of the database and
the WACV 2016 paper wherever results appear:

    Quentin Massoz, Thomas Langohr, Clementine Francois and Jacques G.
    Verly. "The ULg Multimodality Drowsiness Database (called DROZY) and
    Examples of Use." IEEE Winter Conference on Applications of Computer
    Vision (WACV), 2016.

This module reads NUMBERS ONLY. It never touches a video frame and never
will. The safeguards in DATASETS.md are not relaxed by the permission,
because the people in those recordings agreed to be filmed by a
university laboratory and no author can grant rights over a face beyond
what its owner allowed.

The analysis this feeds was written down before any result was computed.
See docs/drozy-analysis-plan.md.
"""

from __future__ import annotations

import csv
import statistics
from dataclasses import dataclass
from pathlib import Path

# KSS.txt is 14 rows of 3, one row per subject and one column per
# session. A zero means the session never happened, which is not the
# same as a rating of zero: the scale starts at 1.
_SESSION_NEVER_HAPPENED = 0

# The frame rate floor from src/core/constants.ts. Below this blinklab
# refuses to measure blinks at all, because a 100 ms blink spans one and
# a half frames at 15 fps. Sixteen DROZY recordings sit below it, and
# excluding them is a property of the frame rate alone. Issue #192.
MIN_USABLE_FPS = 25


class DrozyError(ValueError):
    """Raised rather than guessing. A file this module cannot read
    confidently is more useful as an error than as a silently empty
    result, because an empty result still produces a plausible number."""


@dataclass(frozen=True)
class SessionFeatures:
    """One DROZY session reduced to the seven features named in the plan.

    Every field may be None, and None means NOT MEASURED rather than
    zero. A session where no blink was ever detected has no mean blink
    duration, and recording that as 0 ms would be a claim about somebody's
    eyelid that nothing supports.
    """

    subject: int
    session: int
    kss: int
    measured_fps: float
    blink_rate_per_min: float | None
    blink_duration_ms: float | None
    blink_amplitude_mm: float | None
    closing_velocity_mm_s: float | None
    amplitude_over_velocity_ms: float | None
    perclos: float | None
    long_closures: int | None

    @property
    def usable(self) -> bool:
        """Whether blinklab was able to measure blinks here at all."""
        return self.measured_fps >= MIN_USABLE_FPS

    def feature(self, name: str) -> float | None:
        return getattr(self, name)


# The seven, in the order the plan lists them. Kept as data rather than
# written out at each call site, so the analysis cannot quietly test a
# different set from the one that was pre-registered.
FEATURE_NAMES: tuple[str, ...] = (
    "blink_rate_per_min",
    "blink_duration_ms",
    "blink_amplitude_mm",
    "closing_velocity_mm_s",
    "amplitude_over_velocity_ms",
    "perclos",
    "long_closures",
)

FEATURE_LABELS: dict[str, str] = {
    "blink_rate_per_min": "blink rate, per minute",
    "blink_duration_ms": "blink duration, ms",
    "blink_amplitude_mm": "blink amplitude, mm",
    "closing_velocity_mm_s": "closing velocity, mm/s",
    "amplitude_over_velocity_ms": "amplitude over velocity, ms",
    "perclos": "PERCLOS, share of the minute",
    "long_closures": "long closures, count",
}


def load_kss(path: str | Path) -> dict[tuple[int, int], int]:
    """Read KSS.txt into {(subject, session): rating}.

    Sessions that never happened are absent from the result rather than
    present as zero, so a caller cannot accidentally treat "did not
    happen" as "rated zero" on a scale that starts at one.
    """
    text = Path(path).read_text(encoding="utf-8")
    ratings: dict[tuple[int, int], int] = {}
    for subject, line in enumerate(text.splitlines(), start=1):
        parts = line.split()
        if not parts:
            continue
        if len(parts) != 3:
            raise DrozyError(
                f"KSS.txt line {subject} has {len(parts)} values, expected 3"
            )
        for session, raw in enumerate(parts, start=1):
            try:
                value = int(raw)
            except ValueError as error:
                raise DrozyError(
                    f"KSS.txt line {subject} holds {raw!r}, "
                    f"which is not a number"
                ) from error
            if value == _SESSION_NEVER_HAPPENED:
                continue
            if not 1 <= value <= 9:
                raise DrozyError(
                    f"KSS.txt line {subject} holds {value}, "
                    f"outside the 1 to 9 scale"
                )
            ratings[(subject, session)] = value
    if not ratings:
        raise DrozyError("KSS.txt held no ratings at all")
    return ratings


def _mean_or_none(values: list[float]) -> float | None:
    return statistics.fmean(values) if values else None


def _floats(rows: list[dict[str, str]], column: str) -> list[float]:
    """Every parseable number in a column, skipping blanks.

    A blank means the app declined to measure that second, which is a
    different fact from zero, so blanks are dropped rather than counted.
    """
    out: list[float] = []
    for row in rows:
        raw = (row.get(column) or "").strip()
        if raw == "":
            continue
        try:
            out.append(float(raw))
        except ValueError:
            continue
    return out


def load_session_features(
    seconds_csv: str | Path,
    blinks_csv: str | Path | None,
    subject: int,
    session: int,
    kss: int,
) -> SessionFeatures:
    """Reduce one measured session to one row.

    seconds_csv is blinklab's per-second export. blinks_csv is its blink
    event log, which does not exist when no blink was detected, so None
    is a legitimate argument rather than an error.
    """
    seconds_path = Path(seconds_csv)
    text = seconds_path.read_text(encoding="utf-8")
    body = [line for line in text.splitlines() if not line.startswith("#")]
    if not body:
        raise DrozyError(
            f"{seconds_path.name} has no rows below its header block"
        )
    rows = list(csv.DictReader(body))
    if not rows:
        raise DrozyError(f"{seconds_path.name} has a header and no data")

    fps_values = _floats(rows, "fps")
    if not fps_values:
        raise DrozyError(f"{seconds_path.name} never reported a frame rate")
    measured_fps = statistics.median(fps_values)

    perclos = _mean_or_none(_floats(rows, "perclos"))
    closures = _floats(rows, "longClosureCount")
    long_closures = int(max(closures)) if closures else None

    # Blink shape comes from the event log, not the per-second file. The
    # per-second file carries only the LAST blink's numbers, repeated
    # until the next one, so averaging it would weight a blink by how
    # long it happened to stay the most recent.
    durations: list[float] = []
    amplitudes: list[float] = []
    velocities: list[float] = []
    ratios: list[float] = []
    blink_count = 0
    if blinks_csv is not None and Path(blinks_csv).exists():
        blink_text = Path(blinks_csv).read_text(encoding="utf-8")
        blink_body = [
            line
            for line in blink_text.splitlines()
            if not line.startswith("#")
        ]
        blink_rows = list(csv.DictReader(blink_body)) if blink_body else []
        blink_count = len(blink_rows)
        durations = _floats(blink_rows, "durationMs")
        amplitudes = _floats(blink_rows, "amplitudeMm")
        velocities = _floats(blink_rows, "peakClosingVelocityMmPerS")
        ratios = _floats(blink_rows, "amplitudeOverVelocityMs")

    # Rate from the event count over the window's real length, rather
    # than from the app's rolling estimate, so every session is measured
    # the same way over the same span.
    window_seconds = len(rows)
    rate = (blink_count / window_seconds) * 60 if window_seconds else None

    return SessionFeatures(
        subject=subject,
        session=session,
        kss=kss,
        measured_fps=measured_fps,
        blink_rate_per_min=rate,
        blink_duration_ms=_mean_or_none(durations),
        blink_amplitude_mm=_mean_or_none(amplitudes),
        closing_velocity_mm_s=_mean_or_none(velocities),
        amplitude_over_velocity_ms=_mean_or_none(ratios),
        perclos=perclos,
        long_closures=long_closures,
    )


def load_all(
    measured_dir: str | Path, kss_path: str | Path
) -> list[SessionFeatures]:
    """Every measured session, usable or not, sorted by subject then session.

    Unusable sessions are RETURNED rather than dropped here. Deciding
    what to exclude belongs to the analysis, where the rule can be stated
    once and applied visibly, not to the loader where it would be silent.
    """
    ratings = load_kss(kss_path)
    directory = Path(measured_dir)
    out: list[SessionFeatures] = []
    for seconds_path in sorted(directory.glob("*.seconds.csv")):
        name = seconds_path.name[: -len(".seconds.csv")]
        try:
            subject_text, session_text = name.split("-", 1)
            subject, session = int(subject_text), int(session_text)
        except ValueError as error:
            raise DrozyError(
                f"{seconds_path.name} is not named "
                f"<subject>-<session>.seconds.csv"
            ) from error
        kss = ratings.get((subject, session))
        if kss is None:
            raise DrozyError(
                f"{name} has measurements but no KSS rating. Either "
                f"the rating file says this session never happened, "
                f"or the wrong KSS.txt was supplied."
            )
        blinks_path = directory / f"{name}.blinks.csv"
        out.append(
            load_session_features(
                seconds_path,
                blinks_path if blinks_path.exists() else None,
                subject,
                session,
                kss,
            )
        )
    if not out:
        raise DrozyError(f"no *.seconds.csv files in {directory}")
    return out
