"""Round II's rules, held to docs/validation-plan-round2.md.

The plan was committed 27 August 2026, before any round II session
exists, and this module was written after these rules had failing
tests. Nothing here touches the round I code paths: round I's
published tables must stay reproducible from the recovered files, so
these rules run only when the report tool is told `--rules round2`,
never by inference from the files.

Two named constants, neither of them tuned:

- The evidence floor is the page's own 25 fps gate, reused rather
  than re-chosen.
- The short-ruler floor is 1.0 by geometry: a ruler below the
  session's own resting median puts the blink line deep under the
  open eye, and partial closures are counted as blinks. The freeze
  traded away the only recovery path for that shape and queued this
  check; this is that check.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from blinklab.validation import (
    SessionPair,
    ValidationError,
    session_markers_ms,
)
from blinklab.validation_checks import ParticipantRow

ROUND2_EVIDENCE_FLOOR_FPS = 25.0
ROUND2_SHORT_RULER_FLOOR = 1.0

SAMPLED_SOURCE = "sampled_fps"
FALLBACK_SOURCE = "per-second fps over the marked window"


@dataclass(frozen=True)
class RefusedCalibration:
    """A session the instrument refused to calibrate, counted first.

    A refusal is the instrument doing its job: the row contributes no
    detector columns and travels with its birth certificate, so a
    refusal rate can be computed and each refusal explained.
    """

    label: str
    samples: int | None
    spread_ratio: float | None
    ceiling_bound: bool | None

    @property
    def violates_refusal_contract(self) -> bool:
        """Committed prediction 2: every refusal is ceiling-bound.

        ceilingBound is the only signal the refusal fires on, so a
        file that says refused without saying ceiling-bound is an
        instrument defect, not a participant result, and the report
        must say so instead of counting it calmly.
        """
        return self.ceiling_bound is not True


def _flag(pair: SessionPair, key: str) -> bool | None:
    """A calibration flag, read strictly: true, false, or absent.

    The exporter writes only lowercase true and false for these keys,
    so any other value — probe A's capitalized True included — is a
    hand-edited or damaged file, and reading it as false would score
    a refused session as an ordinary participant with nothing said.
    Refusing beats guessing.
    """
    raw = pair.session.metadata.get(key)
    if raw is None:
        return None
    if raw not in ("true", "false"):
        raise ValidationError(
            f"the metadata says {key}: {raw!r}, and the exporter "
            f"writes only true or false for it, so this file has "
            f"been edited or damaged and cannot be scored"
        )
    return raw == "true"


def _number(pair: SessionPair, key: str) -> float | None:
    raw = pair.session.metadata.get(key)
    if raw is None or raw == "unknown":
        return None
    try:
        value = float(raw)
    except ValueError:
        return None
    # Probe B: NaN parses as a float and compares below no floor, so
    # a damaged sampled_fps sailed through as sound evidence. A
    # non-finite value is not a measurement.
    return value if math.isfinite(value) else None


def refused_calibration(pair: SessionPair) -> RefusedCalibration | None:
    """The refusal in a session's metadata, or None for an ordinary one.

    Only an explicit `calibration_refused: true` is a refusal: a
    missing key is a file from before the refusal existed, and a
    `false` is a calibration that happened. Neither may be promoted
    into a refusal by this reader.
    """
    if _flag(pair, "calibration_refused") is not True:
        return None
    samples = _number(pair, "calibration_samples")
    return RefusedCalibration(
        label=pair.label,
        samples=None if samples is None else int(samples),
        spread_ratio=_number(pair, "calibration_spread_ratio"),
        ceiling_bound=_flag(pair, "calibration_ceiling_bound"),
    )


@dataclass(frozen=True)
class Round2Rules:
    """The per-session outcomes of the plan's mechanical rules."""

    label: str
    # Rule 2: the rate the evidence actually arrived at. The sampled
    # rate the export measured wins; the per-second fps column over
    # the marked window is the named fallback for older files.
    evidence_fps: float | None
    evidence_source: str | None
    # Rule 3: the freeze makes the baseline a constant, so this is
    # not a percentage, it is a count of distinct values between the
    # marks. More than one is the freeze broken in the field. None
    # means there is no marked window to judge — probe C caught this
    # tool asserting constancy over a window that did not exist.
    freeze_defect: bool | None
    # Rule 4.
    short_ruler: bool
    # Rule 5: only zero width refuses; the width itself is already a
    # column of the round I table.
    zero_width_window: bool

    @property
    def evidence_unsound(self) -> bool:
        """Below the page's own gate floor: not detector evidence."""
        return (
            self.evidence_fps is not None
            and self.evidence_fps < ROUND2_EVIDENCE_FLOOR_FPS
        )


def round2_rules(pair: SessionPair, row: ParticipantRow) -> Round2Rules:
    markers = session_markers_ms(pair.session)
    frame = pair.session.frame
    windowed = (
        frame[
            (frame["timestampMs"] >= markers[0])
            & (frame["timestampMs"] <= markers[1])
        ]
        if len(markers) >= 2
        else frame.iloc[0:0]
    )

    sampled = _number(pair, "sampled_fps")
    if sampled is not None:
        evidence, source = sampled, SAMPLED_SOURCE
    else:
        window_fps = windowed["fps"].dropna()
        evidence = None if window_fps.empty else float(window_fps.median())
        source = None if evidence is None else FALLBACK_SOURCE

    freeze: bool | None = None
    if len(markers) >= 2:
        freeze = windowed["baselineMm"].dropna().nunique() > 1

    over = row.baseline.over_resting
    window = row.window
    return Round2Rules(
        label=row.label,
        evidence_fps=evidence,
        evidence_source=source,
        freeze_defect=freeze,
        short_ruler=over is not None and over < ROUND2_SHORT_RULER_FLOOR,
        zero_width_window=window is not None and window.width_s == 0,
    )
