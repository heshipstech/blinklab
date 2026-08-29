"""The session verdict, re-derived from primary facts in the file.

The page assembles a SessionVerdict from its own state
(src/core/sessionVerdict.ts, pilot increment 3); this module derives
the SAME object from an exported session file, and the committed
fixtures under test/fixtures/verdict/ pin the two implementations to
identical bytes. The verdict is DERIVED, NEVER EXPORTED: the file
carries facts, both sides recompute, and on a real session where
they disagree the researcher tool declares an instrument defect
rather than trusting either.

The derivation rules, each stated because the file does not spell
the page's state directly:

- The evidence rate is the file's own ``sampled_fps`` string when
  the browser reported one, else the pandas-style median of the
  per-second ``fps`` column — the fallback the page will be bound to
  when the report panel lands, so the two sides compute from the
  same serialized numbers.
- The ruler-fit verdict REPLAYS the page's dwell machine
  (src/core/rulerFit.ts) over the exported ``apertureMm`` and
  ``baselineMm`` columns: same per-record inputs, same
  first-verdict-immediately rule, same fifteen-record dwell, so the
  replay lands on the page's spoken word, not on the instantaneous
  ratio.
- The camera outcome and the model trust are structural: a session
  file with rows exists only because a session ran to an export, and
  a record is written only through the trust gate, so both surfaces
  read ok from the file's existence. A session that failed either
  way never wrote this file.
- Number formatting follows ECMAScript's ``toFixed`` (closest value,
  ties away from zero for the non-negative numbers used here), not
  Python's banker's rounding — one formatting rule, the page's.

Refusals: a file missing the visibility counter predates the pilot's
export contract, a count row that disagrees with its timestamp rows
was edited or damaged, and a calibration flag that is not lowercase
true or false was hand-edited. Refusing beats guessing, the round II
precedent.
"""

from __future__ import annotations

import json
from decimal import ROUND_HALF_UP, Decimal

import pandas as pd

from blinklab.loader import Session

# The page's own thresholds, reused rather than re-chosen; a test
# reads src/core/constants.ts and holds the two sides together.
VERDICT_EVIDENCE_FLOOR_FPS = 25.0
VERDICT_RISK_FPS = 60.0

# The page's dwell: how many consecutive disagreeing records before
# the spoken ruler-fit verdict changes. src/core/rulerFit.ts.
RULER_FIT_DWELL_RECORDS = 15
BASELINE_OVER_RESTING_CEILING = 1.25

# The pinned refusal sentence, verbatim from src/core/baseline.ts
# and docs/calibration-refusal.txt; a test compares it against the
# decision document, exactly as the TypeScript side pins its copy.
# The report may not paraphrase a refusal, and neither may this
# mirror.
CALIBRATION_REFUSED_SENTENCE = (
    "Calibration was refused: while learning your baseline, the widest "
    "eye openings disagreed with the middle ones by more than the "
    "instrument allows, which usually means blinks or a squint "
    "contaminated the learning period. Numbers that depend on the blink "
    "line are withheld rather than guessed. Restart the camera and keep "
    "your eyes comfortably open for the first thirty seconds."
)


class VerdictError(ValueError):
    """A file the verdict cannot be derived from, named not guessed."""


def js_to_fixed(value: float, digits: int) -> str:
    """ECMAScript's toFixed for non-negative finite numbers.

    The spec picks the n with n / 10^digits closest to the exact
    double, and the larger n on a tie — 62.5 becomes 63 where
    Python's round() gives 62. Decimal(value) is the double's exact
    value, so the arithmetic sees exactly what JavaScript sees.
    """
    quantum = Decimal(1).scaleb(-digits)
    return str(Decimal(value).quantize(quantum, rounding=ROUND_HALF_UP))


def _finding(surface: str, status: str, sentence: str) -> dict[str, str]:
    # Key order is the canonical serialization's byte order; dicts
    # keep insertion order, exactly like the page's object literals.
    return {"surface": surface, "status": status, "sentence": sentence}


def _flag(metadata: dict[str, str], key: str) -> bool | None:
    """A boolean row, read strictly: true, false, or absent."""
    raw = metadata.get(key)
    if raw is None:
        return None
    if raw not in ("true", "false"):
        raise VerdictError(
            f"the metadata says {key}: {raw!r}, and the exporter writes "
            "only lowercase true and false — this file was edited or "
            "damaged on its way here"
        )
    return raw == "true"


def _calibration(metadata: dict[str, str]) -> dict[str, str]:
    refused = _flag(metadata, "calibration_refused")
    if refused is None:
        return _finding(
            "calibration",
            "unknown",
            "The learning window never froze, so no ruler was born and "
            "no refusal fired.",
        )
    # Parsed strictly even though only the branch flag decides: a
    # damaged certificate must refuse here, not surface later as a
    # wrong sentence.
    _flag(metadata, "calibration_ceiling_bound")
    if refused:
        return _finding(
            "calibration", "refused", CALIBRATION_REFUSED_SENTENCE
        )
    samples = metadata.get("calibration_samples")
    spread = metadata.get("calibration_spread_ratio")
    if samples is None or spread is None:
        raise VerdictError(
            "the file says calibration_refused: false but carries no "
            "birth certificate — the exporter writes all four rows "
            "together, so this file lost some on its way here"
        )
    return _finding(
        "calibration",
        "ok",
        f"Calibration accepted: {int(samples)} samples, spread ratio "
        f"{js_to_fixed(float(spread), 3)}, ceiling unbound.",
    )


def _evidence(session: Session) -> dict[str, str]:
    sampled = session.metadata.get("sampled_fps")
    if sampled is not None and sampled != "unknown":
        rate: float | None = float(sampled)
        source = "the measured rate of distinct frames read"
    else:
        fps = session.frame["fps"].dropna()
        rate = None if fps.empty else float(fps.median())
        source = (
            "the processing rate, because this browser does not "
            "report delivery"
        )
    if rate is None:
        return _finding(
            "evidenceRate",
            "unknown",
            "No evidence rate could be measured for this session.",
        )
    shown = js_to_fixed(rate, 1)
    if rate < VERDICT_EVIDENCE_FLOOR_FPS:
        return _finding(
            "evidenceRate",
            "refused",
            f"The evidence rate was {shown} frames per second "
            f"({source}), below the {VERDICT_EVIDENCE_FLOOR_FPS:g} a "
            "short blink needs, so temporal blink numbers were "
            "withheld rather than guessed.",
        )
    if rate < VERDICT_RISK_FPS:
        return _finding(
            "evidenceRate",
            "warned",
            f"The evidence rate was {shown} frames per second "
            f"({source}): quick or shallow blinks can be missed below "
            f"{VERDICT_RISK_FPS:g}.",
        )
    return _finding(
        "evidenceRate",
        "ok",
        f"The evidence rate was {shown} frames per second ({source}), "
        f"above the {VERDICT_RISK_FPS:g} risk band.",
    )


def _interruption_count(metadata: dict[str, str]) -> int:
    raw = metadata.get("visibility_changes")
    if raw is None:
        raise VerdictError(
            "the file carries no visibility counter, so it predates "
            "the pilot's export contract and no verdict can be "
            "derived from it"
        )
    count = int(raw)
    listed = sum(
        1 for key in metadata if key.startswith("interruption_")
        and key.endswith("_seconds")
    )
    if listed and listed != count:
        raise VerdictError(
            f"the file counts {count} visibility changes but lists "
            f"{listed} interruption timestamps, and the exporter "
            "derives both from one array — this file was edited or "
            "damaged on its way here"
        )
    return count


def _interruptions(count: int) -> dict[str, str]:
    if count == 0:
        return _finding(
            "interruptions",
            "ok",
            "The page stayed visible throughout the measurement.",
        )
    return _finding(
        "interruptions",
        "warned",
        f"The page was hidden or the machine slept {count} time(s) "
        "during this session; determinism is a claim about an "
        "uninterrupted measurement.",
    )


def _ruler_fit_shown(session: Session) -> str | None:
    """Replay the page's dwell machine over the exported columns."""
    apertures: list[float] = []
    shown: str | None = None
    pending = 0
    frame = session.frame
    for aperture, baseline in zip(
        frame["apertureMm"], frame["baselineMm"], strict=True
    ):
        if not pd.isna(aperture):
            apertures.append(float(aperture))
        if pd.isna(baseline) or not apertures:
            pending = 0
            continue
        median = float(pd.Series(apertures).median())
        if median <= 0:
            pending = 0
            continue
        ratio = float(baseline) / median
        verdict = (
            "tooLong" if ratio > BASELINE_OVER_RESTING_CEILING else "fits"
        )
        if shown is None or verdict == shown:
            shown = shown or verdict
            pending = 0
            continue
        pending += 1
        if pending >= RULER_FIT_DWELL_RECORDS:
            shown = verdict
            pending = 0
    return shown


def _ruler_fit(session: Session) -> dict[str, str]:
    shown = _ruler_fit_shown(session)
    if shown is None:
        return _finding(
            "rulerFit",
            "unknown",
            "The ruler-fit check had not settled by the end of this "
            "session.",
        )
    if shown == "tooLong":
        return _finding(
            "rulerFit",
            "warned",
            "The ruler measured too long against this session's own "
            "resting eye, so blink durations run long.",
        )
    return _finding(
        "rulerFit", "ok", "The ruler fit this session's own resting eye."
    )


def _camera_outcome() -> dict[str, str]:
    # Structural: this file's rows exist because a session ran to an
    # export. Every failure kind either never records or never
    # exports, so there is nothing true a failure row could say here.
    return _finding(
        "cameraOutcome",
        "ok",
        "The session ran and ended without a camera failure.",
    )


def _pose(metadata: dict[str, str]) -> dict[str, str]:
    raw = metadata.get("pose_valid_fraction")
    if raw is None or raw == "unknown":
        return _finding(
            "pose",
            "unknown",
            "No pose-validity fraction was recorded for this session.",
        )
    percent = js_to_fixed(float(raw) * 100, 0)
    return _finding(
        "pose",
        "ok",
        f"Head pose was within the measurement limits for {percent} "
        "percent of frames; frames outside the limits were refused "
        "individually as they happened.",
    )


def _model_trust() -> dict[str, str]:
    # Structural: a record is written only through the trust gate, so
    # rows in the file are themselves the evidence the checks passed.
    return _finding(
        "modelTrust",
        "ok",
        "The face model's output passed its trust checks.",
    )


def _marked_window(
    metadata: dict[str, str], interruption_count: int
) -> dict[str, str]:
    if int(metadata.get("markers", "0")) < 2:
        return _finding(
            "markedWindow",
            "notApplicable",
            "No marked window exists in this session — it did not "
            "follow the marked protocol.",
        )
    first = metadata.get("marker_1_seconds")
    second = metadata.get("marker_2_seconds")
    if first is None or second is None:
        raise VerdictError(
            "the file counts two or more markers but does not list "
            "them — the exporter writes both from one array, so this "
            "file was edited or damaged on its way here"
        )
    width = float(second) - float(first)
    if width == 0:
        return _finding(
            "markedWindow",
            "refused",
            "The two marks landed in the same moment, so the window "
            "has zero width and cannot be scored.",
        )
    at_first = metadata.get("marker_1_visibility_changes")
    at_second = metadata.get("marker_2_visibility_changes")
    inside = (
        None
        if at_first is None or at_second is None
        else int(at_second) - int(at_first)
    )
    if inside is None and interruption_count > 0:
        return _finding(
            "markedWindow",
            "unknown",
            "Interruptions occurred but cannot be attributed to a "
            "phase, so whether the marked window was disturbed is "
            "unknown.",
        )
    if inside is not None and inside > 0:
        return _finding(
            "markedWindow",
            "refused",
            f"The page was hidden {inside} time(s) inside the marked "
            "window, so its ground truth cannot be trusted — "
            "declared, not deleted.",
        )
    return _finding(
        "markedWindow",
        "ok",
        f"The marked window spans {js_to_fixed(width, 1)} seconds, "
        "undisturbed.",
    )


# Worst first, the page's own order: a refusal outranks a warning
# outranks an unknown, and notApplicable never leads.
_HEADLINE_PRECEDENCE = ("refused", "warned", "unknown")


def derive_verdict(session: Session) -> dict:
    """The verdict, re-derived; shaped exactly like the page's object."""
    interruption_count = _interruption_count(session.metadata)
    surfaces = [
        _calibration(session.metadata),
        _evidence(session),
        _interruptions(interruption_count),
        _ruler_fit(session),
        _camera_outcome(),
        _pose(session.metadata),
        _model_trust(),
        _marked_window(session.metadata, interruption_count),
    ]
    headline = next(
        (
            status
            for status in _HEADLINE_PRECEDENCE
            if any(entry["status"] == status for entry in surfaces)
        ),
        "ok",
    )
    return {"surfaces": surfaces, "headline": headline}


def canonical_verdict_json(verdict: dict) -> str:
    """The byte-for-byte serialization both implementations pin.

    Two space indent, no ASCII escaping, trailing newline: exactly
    JSON.stringify(verdict, null, 2) plus a final newline on the
    page's side.
    """
    return json.dumps(verdict, indent=2, ensure_ascii=False) + "\n"
