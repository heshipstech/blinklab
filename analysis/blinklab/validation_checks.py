"""The checks the six-person round runs, and nothing else.

Every rule here is fixed by `docs/validation-plan.md`, which was
committed before any session file existed. Nothing in this module
chooses what to measure. If you find yourself editing it to try a
different cut, stop and read the plan, because that is the move it
exists to prevent.

Separate from `validation.py` on purpose. That module reads and
refuses; this one judges. Keeping them apart is what stops a refusal
softening into a default when a check finds it inconvenient.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from blinklab.loader import Session
from blinklab.validation import CameraBlinkLog, SessionPair, session_markers_ms

# The protocol asks for ten deliberate blinks between the two marks.
EXPECTED_BLINKS = 10

# How far a mark can sit from the moment it was pressed.
#
# src/main.ts stamps a marker with `lastRecordAtMs`, the timestamp of
# the most recent per-second record, not with the click. The records
# are written about once a second, so a mark can land up to about one
# second EARLY. A window that must hold exactly ten blinks can
# therefore swallow one from the second before mark 1, or drop one that
# happened just before mark 2 was pressed.
#
# This is why the window count never travels alone. Without the
# boundary counts a marker artefact and a real miss are the same number
# in the table, and the round would conclude the opposite of what the
# data supports.
MARKER_SLACK_MS = 1000.0

# From the plan. Below this share of records carrying a face, every
# other number in the row is provisional. Chosen blind, before any data
# existed, so that it could not be chosen to suit a result.
FACE_FRACTION_FLOOR = 0.90

# Set 16 August from the owner's own three sessions, which measured
# 0.0, 0.0 and 5.0 percent, before any volunteer file existed. Three
# times the largest of the three. A session above this is a finding and
# not a reason to move the number.
BASELINE_DRIFT_CEILING_PCT = 15.0

# The plan's second correction. The blink line is half the baseline, so
# a baseline 1.25 times the session's own median aperture puts that
# line at 62 percent of resting, and past that the detector counts
# partial closures as blinks. Derived from the design, not from the
# three measurements, which read 1.12, 1.41 and 1.15.
BASELINE_OVER_RESTING_CEILING = 1.25

COUNTED = "counted"
AMBIGUOUS = "ambiguous"
MISSED = "missed"
OVER_COUNTED = "over-counted"


@dataclass(frozen=True)
class WindowCount:
    """The ten marked blinks, with the slack that makes them readable."""

    in_window: int
    near_start: int
    near_end: int
    # Blinks inside the window but within the slack of a mark, which a
    # one second shift could push OUT. The lower bound needs them.
    edge_of_window: int
    verdict: str

    @property
    def lowest_possible(self) -> int:
        return self.in_window - self.edge_of_window

    @property
    def highest_possible(self) -> int:
        return self.in_window + self.near_start + self.near_end


def count_between_marks(
    blinks: CameraBlinkLog,
    markers_ms: list[float],
    expected: int = EXPECTED_BLINKS,
) -> WindowCount | None:
    """Count the marked blinks, and say how sure that count is.

    None when there are fewer than two marks, which means the check
    cannot be computed. That is reported as such and never as a zero: a
    zero is a claim about the instrument, and this is a claim about the
    file.
    """
    if len(markers_ms) < 2:
        return None
    start, end = markers_ms[0], markers_ms[1]

    times = [blink.at_ms for blink in blinks.blinks]
    in_window = [time for time in times if start <= time <= end]
    near_start = [
        time for time in times if start - MARKER_SLACK_MS <= time < start
    ]
    near_end = [time for time in times if end < time <= end + MARKER_SLACK_MS]
    edge = [
        time
        for time in in_window
        if time < start + MARKER_SLACK_MS or time > end - MARKER_SLACK_MS
    ]

    counted = len(in_window)
    lowest = counted - len(edge)
    highest = counted + len(near_start) + len(near_end)
    if counted == expected:
        verdict = COUNTED
    elif lowest <= expected <= highest:
        verdict = AMBIGUOUS
    elif highest < expected:
        verdict = MISSED
    else:
        verdict = OVER_COUNTED

    return WindowCount(
        in_window=counted,
        near_start=len(near_start),
        near_end=len(near_end),
        edge_of_window=len(edge),
        verdict=verdict,
    )


@dataclass(frozen=True)
class BaselineSettling:
    """Whether the ruler got made, stayed still, and is a sane length."""

    # None means it never became ready at all, which is the worst
    # result this check can carry: every blink in that session was
    # judged against a ruler that does not exist.
    ready_after_s: float | None
    drift_pct: float | None
    first_mm: float | None
    last_mm: float | None
    # The eye's own scale, and the baseline as a multiple of it. Added
    # 16 August by the plan's second correction, because readiness and
    # drift both passed on a session whose ruler was 39 percent too
    # long. See over_resting.
    resting_median_mm: float | None
    over_resting: float | None

    @property
    def drifted(self) -> bool:
        return (
            self.drift_pct is not None
            and self.drift_pct > BASELINE_DRIFT_CEILING_PCT
        )

    @property
    def implausible(self) -> bool:
        """Whether the learned baseline is too long to be "open".

        Measured on the owner's three devices: the same face gave a
        median aperture of 6.88, 6.93 and 6.33 mm, within 10 percent,
        while the baselines learned from those measurements were 7.69,
        9.80 and 7.30, a spread of 34 percent. A handful of frames in
        one learning window read up to 10.35 mm against a window
        median of 7.51, and a 90th percentile follows them.

        Drift cannot see this, because a baseline born wrong does not
        move. That session's drift was 0.0.
        """
        return (
            self.over_resting is not None
            and self.over_resting > BASELINE_OVER_RESTING_CEILING
        )


def baseline_settling(frame: pd.DataFrame) -> BaselineSettling:
    """When the baseline arrived, how far it moved, and how long it is.

    The baseline is allowed to rise and never to fall, by design, so
    the drift is expected to be positive or zero. A large rise means
    the ruler moved underneath the measurement and the blinks late in
    the session were judged against a different bar from the early
    ones.

    The resting median is taken over the WHOLE session rather than over
    the eye-open frames. Filtering by the blink line would use the
    baseline to choose the frames that judge the baseline, and a check
    must not take its own answer as its input: a baseline could then
    excuse itself by declaring more frames to be blinks.

    The cost of that choice, stated rather than hidden: a session with
    a large share of closed frames drags this median down and inflates
    the ratio. On the three measured sessions the two definitions
    differed by 0.4, 1.7 and 1.1 percent, so the protocol's one five
    second closure does not move it. A session that spent most of its
    time shut would, and would deserve the flag anyway.
    """
    empty = BaselineSettling(None, None, None, None, None, None)
    ready = frame[frame["baselineMm"].notna()]
    if ready.empty or frame.empty:
        return empty

    first_at = float(frame["timestampMs"].iloc[0])
    ready_at = float(ready["timestampMs"].iloc[0])
    first_mm = float(ready["baselineMm"].iloc[0])
    last_mm = float(ready["baselineMm"].iloc[-1])
    drift = None if first_mm == 0 else (last_mm - first_mm) / first_mm * 100.0

    apertures = frame["apertureMm"].dropna()
    resting = None if apertures.empty else float(apertures.median())
    over = None if resting is None or resting == 0 else first_mm / resting
    return BaselineSettling(
        ready_after_s=(ready_at - first_at) / 1000.0,
        drift_pct=drift,
        first_mm=first_mm,
        last_mm=last_mm,
        resting_median_mm=resting,
        over_resting=over,
    )


@dataclass(frozen=True)
class ClosureCount:
    """The long closure counter, read either side of the second mark."""

    at_mark: int | None
    at_end: int | None

    @property
    def fired(self) -> bool | None:
        if self.at_mark is None or self.at_end is None:
            return None
        return self.at_end > self.at_mark


def long_closures(
    frame: pd.DataFrame, markers_ms: list[float]
) -> ClosureCount:
    """The counter at mark 2 and at the last row.

    Reported as two numbers rather than as a yes or a no, because two
    closures mean something different from one and a bare boolean would
    hide it.
    """
    if frame.empty or "longClosureCount" not in frame:
        return ClosureCount(None, None)
    counts = frame["longClosureCount"]
    at_end = None if counts.dropna().empty else int(counts.dropna().iloc[-1])
    if len(markers_ms) < 2:
        return ClosureCount(None, at_end)
    before = frame[frame["timestampMs"] <= markers_ms[1]]["longClosureCount"]
    at_mark = None if before.dropna().empty else int(before.dropna().iloc[-1])
    return ClosureCount(at_mark, at_end)


def processing_fps_median(frame: pd.DataFrame) -> float | None:
    """The rate the page's frame handler actually ran at."""
    if frame.empty or "fps" not in frame:
        return None
    usable = frame["fps"].dropna()
    return None if usable.empty else float(usable.median())


def _number(session: Session, key: str) -> float | None:
    """A metadata value as a number, or None when it says unknown.

    The exporter writes "unknown" rather than dropping the row, which
    is the right choice for a file a person reads and the wrong thing
    to hand to float().
    """
    raw = session.metadata.get(key)
    if raw is None or raw == "unknown":
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def _text(session: Session, key: str) -> str | None:
    raw = session.metadata.get(key)
    return None if raw is None or raw == "unknown" else raw


@dataclass(frozen=True)
class ParticipantRow:
    """One person's row of the published table."""

    label: str
    # The session's own name, taken from its filename. Labels are
    # POSITIONAL and shift when a session is added: the dry run's
    # MacBook re-test was P4 on 17 August and became P5 the moment a
    # sixth session arrived, which silently falsified the published
    # write-up. A row that carries its own name cannot do that.
    session: str
    window: WindowCount | None
    closures: ClosureCount
    baseline: BaselineSettling
    face_detected_fraction: float | None
    median_iris_width_px: float | None
    measurement_frame: str | None
    camera: str | None
    camera_declared_fps: float | None
    processing_fps_median: float | None
    visibility_changes: float | None
    records: float | None
    observed_duration_seconds: float | None
    markers_found: int
    blinks_lost: int
    no_blinks_detected: bool

    @property
    def verdict(self) -> str:
        """The window verdict, or why there is not one.

        A session with no blink log at all counts as MISSED, not as a
        missing value: the page detected nothing, which is a result
        about the instrument and the worst one this round can produce.
        """
        if self.no_blinks_detected:
            return MISSED
        if self.window is None:
            return "not markable"
        return self.window.verdict

    @property
    def baseline_sound(self) -> bool:
        """Whether this session's ruler can be trusted at all.

        The plan's third correction, 18 August, found by the dry run. A
        session whose baseline never settled, drifted past the ceiling,
        or is longer than 1.25 times its own median aperture is not
        evidence about the DETECTOR in either direction. The dry run's
        P3 counted 10 of 10 with a ruler 41 percent too long, which is a
        pass earned by a loose threshold rather than by working.

        The row is still reported in full. This only decides whether it
        counts toward criterion 1.
        """
        return (
            self.baseline.ready_after_s is not None
            and not self.baseline.drifted
            and not self.baseline.implausible
        )

    @property
    def unsound_because(self) -> str | None:
        """Why the ruler is not trusted, named rather than implied."""
        if self.baseline.ready_after_s is None:
            return "baseline never became ready"
        if self.baseline.drifted:
            return "baseline drifted past the ceiling"
        if self.baseline.implausible:
            return "baseline is too long to be open"
        return None

    @property
    def face_below_floor(self) -> bool:
        fraction = self.face_detected_fraction
        return fraction is not None and fraction < FACE_FRACTION_FLOOR

    @property
    def gate_would_refuse(self) -> bool:
        """Whether a true camera rate would close the 25 fps gate here.

        Remediation D1's held question. The gate reads the processing
        rate today, so a 20 fps camera behind a 60 Hz display reads
        about 60 and the gate stays open on a session whose blink
        timings are guesses.
        """
        declared = self.camera_declared_fps
        processing = self.processing_fps_median
        if declared is None or processing is None:
            return False
        return declared < 25 <= processing


def session_name(stamp: str) -> str:
    """The readable part of an export's filename stamp.

    `iphone17promax-2026-08-19T11-54-11-743` becomes `iphone17promax`,
    and a stamp that is only a date keeps its date.
    """
    head = stamp.split("-2026", 1)[0]
    return head if head else stamp


def row_for(pair: SessionPair) -> ParticipantRow:
    """Every column of the plan, computed for one participant."""
    session = pair.session
    markers = session_markers_ms(session)
    frame = session.frame
    return ParticipantRow(
        label=pair.label,
        session=session_name(pair.stamp),
        window=(
            None
            if pair.blinks is None
            else count_between_marks(pair.blinks, markers)
        ),
        closures=long_closures(frame, markers),
        baseline=baseline_settling(frame),
        face_detected_fraction=_number(session, "face_detected_fraction"),
        median_iris_width_px=_number(session, "median_iris_width_px"),
        measurement_frame=_text(session, "measurement_frame"),
        camera=_text(session, "camera"),
        camera_declared_fps=_number(session, "camera_declared_fps"),
        processing_fps_median=processing_fps_median(frame),
        visibility_changes=_number(session, "visibility_changes"),
        records=_number(session, "records"),
        observed_duration_seconds=_number(
            session, "observed_duration_seconds"
        ),
        markers_found=len(markers),
        blinks_lost=0 if pair.blinks is None else pair.blinks.blinks_lost,
        no_blinks_detected=pair.no_blinks_detected,
    )
