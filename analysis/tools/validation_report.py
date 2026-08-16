"""Turn a folder of validation-round exports into one published table.

This runs the plan in docs/validation-plan.md, which was committed
before any session file existed. Nothing here chooses what to measure.

Usage, from the analysis directory:

    PYTHONPATH="$PWD" .venv/bin/python tools/validation_report.py \\
        "$DATASETS/validation-round"

The raw files stay outside this repository. What gets published is this
output, and camera names travel with it because comparing devices is
the whole point of the iris column. Nothing here prints a user agent.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from blinklab.validation import (
    PairPaths,
    ValidationError,
    find_pairs,
    load_pair,
)
from blinklab.validation_checks import (
    EXPECTED_BLINKS,
    FACE_FRACTION_FLOOR,
    MISSED,
    OVER_COUNTED,
    ParticipantRow,
    row_for,
)

# The three pre-registered failure criteria, from the plan.
DETECTOR_FAILS_AT = 3
BASELINE_FAILS_AT = 2
GATE_FAILS_AT = 2


def dash(value: object, digits: int | None = None) -> str:
    """A missing number prints as a dash, never as a zero."""
    if value is None:
        return "-"
    if digits is not None and isinstance(value, float):
        return f"{value:.{digits}f}"
    return str(value)


def table(headers: list[str], rows: list[list[str]]) -> str:
    widths = [len(head) for head in headers]
    for row in rows:
        for index, cell in enumerate(row):
            widths[index] = max(widths[index], len(cell))
    line = "  ".join(
        head.ljust(widths[index]) for index, head in enumerate(headers)
    )
    rule = "  ".join("-" * width for width in widths)
    body = [
        "  ".join(cell.ljust(widths[index]) for index, cell in enumerate(row))
        for row in rows
    ]
    return "\n".join([line, rule, *body])


def checks_table(rows: list[ParticipantRow]) -> str:
    headers = [
        "",
        "in window",
        "near start",
        "near end",
        "verdict",
        "closures at mark 2 / end",
        "baseline ready (s)",
        "baseline drift (%)",
    ]
    body = []
    for row in rows:
        window = row.window
        body.append(
            [
                row.label,
                "no log"
                if row.no_blinks_detected
                else dash(None if window is None else window.in_window),
                dash(None if window is None else window.near_start),
                dash(None if window is None else window.near_end),
                row.verdict,
                f"{dash(row.closures.at_mark)} / {dash(row.closures.at_end)}",
                dash(row.baseline.ready_after_s, 1),
                dash(row.baseline.drift_pct, 1),
            ]
        )
    return table(headers, body)


def conditions_table(rows: list[ParticipantRow]) -> str:
    headers = [
        "",
        "camera",
        "face seen (%)",
        "iris (px)",
        "measured in",
        "declared fps",
        "processing fps",
        "tab hidden",
        "duration (s)",
    ]
    body = []
    for row in rows:
        fraction = row.face_detected_fraction
        body.append(
            [
                row.label,
                row.camera or "-",
                dash(None if fraction is None else fraction * 100, 1),
                dash(row.median_iris_width_px, 1),
                row.measurement_frame or "-",
                dash(row.camera_declared_fps, 1),
                dash(row.processing_fps_median, 1),
                dash(
                    None
                    if row.visibility_changes is None
                    else int(row.visibility_changes)
                ),
                dash(row.observed_duration_seconds, 1),
            ]
        )
    return table(headers, body)


def verdict_summary(rows: list[ParticipantRow]) -> list[str]:
    """The three pre-registered failure criteria, answered out loud."""
    missed = [row.label for row in rows if row.verdict == MISSED]
    over = [row.label for row in rows if row.verdict == OVER_COUNTED]
    unready = [row.label for row in rows if row.baseline.ready_after_s is None]
    gated = [row.label for row in rows if row.gate_would_refuse]
    low_face = [row.label for row in rows if row.face_below_floor]

    lines = [
        "The three failure criteria, fixed in the plan before any file "
        "was read:",
        "",
        f"1. The detector does not generalise, at "
        f"{DETECTOR_FAILS_AT} or more missed: "
        f"{len(missed)} missed ({', '.join(missed) or 'none'})."
        f" {'FAILED' if len(missed) >= DETECTOR_FAILS_AT else 'not met'}",
        f"2. The baseline does not generalise, at "
        f"{BASELINE_FAILS_AT} or more never ready: "
        f"{len(unready)} never ready ({', '.join(unready) or 'none'})."
        f" {'FAILED' if len(unready) >= BASELINE_FAILS_AT else 'not met'}",
        f"3. The frame rate gate lets bad sessions through, at "
        f"{GATE_FAILS_AT} or more: "
        f"{len(gated)} would be refused by a true camera rate "
        f"({', '.join(gated) or 'none'})."
        f" {'FAILED' if len(gated) >= GATE_FAILS_AT else 'not met'}",
        "",
        "The drift half of criterion 2 cannot be answered yet: the "
        "threshold is NOT YET SET in the plan, and it must be set from "
        "the owner's own two sessions before any of these files were "
        "opened. Drift is printed above and not judged.",
    ]
    if over:
        lines += [
            "",
            f"Over-counted, which is not a failure criterion and is "
            f"reported because precision is the other half of the "
            f"question: {', '.join(over)}.",
        ]
    if low_face:
        lines += [
            "",
            f"Below the {FACE_FRACTION_FLOOR:.0%} face-detected floor, "
            f"so every other number in these rows is provisional: "
            f"{', '.join(low_face)}.",
        ]
    lost = [row for row in rows if row.blinks_lost > 0]
    if lost:
        lines += [
            "",
            "TRUNCATED FILES. These blink logs say they detected more "
            "blinks than they wrote, so their window counts are a floor "
            "and not a count: "
            + ", ".join(f"{row.label} lost {row.blinks_lost}" for row in lost)
            + ".",
        ]
    return lines


def report(directory: Path) -> tuple[list[str], int]:
    """The whole report, and the number of participants it refused."""
    pairs = find_pairs(directory)
    rows: list[ParticipantRow] = []
    refusals: list[tuple[PairPaths, str]] = []
    for paths in pairs:
        try:
            rows.append(row_for(load_pair(paths)))
        except ValidationError as error:
            # Never a skip. A person missing from the table is a person
            # nobody looks for, so a refusal takes a line of its own
            # naming who and why.
            refusals.append((paths, str(error)))

    lines = [
        f"Validation round: {len(pairs)} participants in {directory}",
        f"Ground truth between the two marks: {EXPECTED_BLINKS} blinks.",
        "",
        "CHECKS",
        "",
        checks_table(rows) if rows else "no readable sessions",
        "",
        "CONDITIONS",
        "",
        conditions_table(rows) if rows else "no readable sessions",
        "",
    ]
    if refusals:
        lines += ["REFUSED", ""]
        lines += [
            f"{paths.label}  {paths.session_path.name}: {reason}"
            for paths, reason in refusals
        ]
        lines += [""]
    lines += verdict_summary(rows)
    return lines, len(refusals)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="The six-person validation round's published table."
    )
    parser.add_argument(
        "directory",
        type=Path,
        help="folder holding the exported session and blink CSVs",
    )
    arguments = parser.parse_args()
    try:
        lines, refused = report(arguments.directory)
    except ValidationError as error:
        # A folder-level refusal stops the run. Reporting on five people
        # while a sixth's file sits unread is not acceptable.
        print(f"REFUSED: {error}", file=sys.stderr)
        return 2
    print("\n".join(lines))
    # A non-zero exit when anyone was refused, so a run that could not
    # read everybody cannot be mistaken for a clean one by a script.
    return 1 if refused else 0


if __name__ == "__main__":
    raise SystemExit(main())
