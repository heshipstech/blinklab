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

from blinklab.pilot import InstrumentDefect, pilot_verdict_lines
from blinklab.round2 import (
    RefusedCalibration,
    Round2Rules,
    refused_calibration,
    round2_rules,
)
from blinklab.ruler_fit import RulerFitCrossCheck, ruler_fit_cross_check
from blinklab.validation import (
    PairPaths,
    ValidationError,
    find_pairs,
    load_pair,
)
from blinklab.validation_checks import (
    BASELINE_DRIFT_CEILING_PCT,
    BASELINE_OVER_RESTING_CEILING,
    EXPECTED_BLINKS,
    FACE_FRACTION_FLOOR,
    MARKER_SLACK_MS,
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
        "session",
        "marks",
        # Queued rule 3 of the round write-up: without the width, a
        # zero-width window and a fifteen-second one print the same
        # row, and probe P showed the zero-width case is a plausible
        # real file, not a hypothetical.
        "window (s)",
        "in window",
        "near start",
        "near end",
        "verdict",
        "closures at mark 2 / end",
        "baseline ready (s)",
        "baseline drift (%)",
        "baseline / resting",
    ]
    body = []
    for row in rows:
        window = row.window
        body.append(
            [
                row.label,
                row.session,
                # Two is the protocol. Three of the round's first three
                # participants pressed a different number, and the table
                # said nothing, so a reader had to open the file to find
                # out. The window still uses the first two marks.
                str(row.markers_found),
                dash(None if window is None else window.width_s, 1),
                "no log"
                if row.no_blinks_detected
                else dash(None if window is None else window.in_window),
                dash(None if window is None else window.near_start),
                dash(None if window is None else window.near_end),
                row.verdict,
                f"{dash(row.closures.at_mark)} / {dash(row.closures.at_end)}",
                dash(row.baseline.ready_after_s, 1),
                dash(row.baseline.drift_pct, 1),
                dash(row.baseline.over_resting, 2),
            ]
        )
    return table(headers, body)


def conditions_table(rows: list[ParticipantRow]) -> str:
    headers = [
        "",
        "session",
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
                row.session,
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


def baseline_verdict(failures: list[str]) -> str:
    return "FAILED" if len(failures) >= BASELINE_FAILS_AT else "not met"


def criterion_one(
    rows: list[ParticipantRow],
    sound: list[ParticipantRow],
    unsound: list[ParticipantRow],
    missed: list[str],
) -> str:
    """Criterion 1, evaluated only on sessions with a working ruler.

    The exclusion has its own failure condition, from the plan, because
    otherwise it is a way to explain away a bad result: if more than
    half the sessions are excluded, the criterion is not evaluated and
    the round says something worse instead.
    """
    excluded = (
        ""
        if not unsound
        else " Excluded as unsound: "
        + ", ".join(f"{row.label} ({row.unsound_because})" for row in unsound)
        + "."
    )
    if rows and len(unsound) * 2 > len(rows):
        return (
            f"1. The detector does not generalise: NOT EVALUATED. "
            f"{len(unsound)} of {len(rows)} sessions have no working "
            f"baseline, which is more than half, so this round cannot "
            f"speak about the detector at all. The instrument could not "
            f"establish a baseline on ordinary hardware, and that is a "
            f"worse finding than the one this criterion looked for."
            f"{excluded}"
        )
    return (
        f"1. The detector does not generalise, at "
        f"{DETECTOR_FAILS_AT} or more missed among the "
        f"{len(sound)} sound sessions: "
        f"{len(missed)} missed ({', '.join(missed) or 'none'})."
        f" {'FAILED' if len(missed) >= DETECTOR_FAILS_AT else 'not met'}"
        f"{excluded}"
    )


def verdict_summary(rows: list[ParticipantRow]) -> list[str]:
    """The three pre-registered failure criteria, answered out loud."""
    # With nothing read there is no evidence in either direction, and
    # printing "not met" three times under an empty table would let a
    # reader who trusts the bottom of the page read a round that could
    # not read anybody as a round that met its criteria.
    if not rows:
        return [
            "The three failure criteria, fixed in the plan before any "
            "file was read:",
            "",
            "NOT EVALUATED. No session could be read, so this round "
            "carries no evidence about any criterion in either "
            "direction. The refusals above are the whole result.",
        ]
    # The plan's third correction: only sessions with a working ruler
    # are evidence about the detector. Unsound rows stay in the table
    # and are named here; they simply do not vote.
    sound = [row for row in rows if row.baseline_sound]
    unsound = [row for row in rows if not row.baseline_sound]
    missed = [row.label for row in sound if row.verdict == MISSED]
    over = [row.label for row in sound if row.verdict == OVER_COUNTED]
    unready = [row.label for row in rows if row.baseline.ready_after_s is None]
    drifted = [row.label for row in rows if row.baseline.drifted]
    implausible = [row.label for row in rows if row.baseline.implausible]
    gated = [row.label for row in rows if row.gate_would_refuse]
    low_face = [row.label for row in rows if row.face_below_floor]
    # Criterion 2's own tally, deliberately NOT the same set as
    # `unsound` above: this one is about the baseline failing on its own
    # terms, and it does not include a baseline that settled at an
    # implausible length. Named apart because the two were briefly the
    # same identifier and the second silently replaced the first.
    baseline_failures = sorted(set(unready) | set(drifted))

    lines = [
        "The three failure criteria, fixed in the plan before any file "
        "was read:",
        "",
        criterion_one(rows, sound, unsound, missed),
        f"2. The baseline does not generalise, at "
        f"{BASELINE_FAILS_AT} or more never ready or drifting past "
        f"{BASELINE_DRIFT_CEILING_PCT:.0f}%: "
        f"{len(unready)} never ready ({', '.join(unready) or 'none'}), "
        f"{len(drifted)} drifted ({', '.join(drifted) or 'none'})."
        f" {baseline_verdict(baseline_failures)}",
        f"3. The frame rate gate lets bad sessions through, at "
        f"{GATE_FAILS_AT} or more: "
        f"{len(gated)} would be refused by a true camera rate "
        f"({', '.join(gated) or 'none'})."
        f" {'FAILED' if len(gated) >= GATE_FAILS_AT else 'not met'}",
    ]
    if implausible:
        lines += [
            "",
            f'BASELINE TOO LONG TO BE "OPEN", above '
            f"{BASELINE_OVER_RESTING_CEILING:.2f} times the session's own "
            f"median aperture: {', '.join(implausible)}. The blink line "
            f"is half the baseline, so in these sessions it sits above "
            f"62 percent of resting and partial closures are being "
            f"counted as blinks. Readiness and drift do not see this, "
            f"because a baseline born wrong does not move.",
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
    # Queued rule 3 of the round write-up, the half the tool can take
    # without deciding a verdict: a mark can sit up to a second from
    # its press, so a window narrower than that slack cannot separate
    # its own count from the marker artefact. The verdict column still
    # prints what the plan computes; what such a window MEANS is a
    # rule for the next round's plan.
    narrow = [
        (row, row.window)
        for row in rows
        if row.window is not None
        and row.window.width_s * 1000.0 < MARKER_SLACK_MS
    ]
    if narrow:
        lines += [
            "",
            "WINDOW NARROWER THAN THE MARKER SLACK. A mark can sit up "
            "to a second from the moment it was pressed, so these "
            "windows cannot separate their own count from the marker "
            "artefact, and their verdicts are printed as computed "
            "rather than trusted: "
            + ", ".join(
                f"{row.label} ({window.width_s:.1f} s)"
                for row, window in narrow
            )
            + ".",
        ]
    return lines


def page_account_lines(
    checks: list[tuple[str, RulerFitCrossCheck]],
) -> list[str]:
    """The page's own ruler-fit account, held to this tool's.

    Not a plan rule: the plan's fifth check is computed by this tool
    either way, and the table above prints THAT. This section only
    says whether the page's live computation of the same statistic
    (baselineOverResting, since 23 August 2026) lands on the same
    bits, because two implementations of one check drift silently
    unless a report says so out loud. Files from before the column
    say nothing here — silence for a session that never spoke, never
    a verdict about it.
    """
    carrying = [
        (label, check) for label, check in checks if check.agrees is not None
    ]
    if not carrying:
        return []
    disagreeing = [
        (label, check) for label, check in carrying if check.agrees is False
    ]
    if not disagreeing:
        count = len(carrying)
        stated = (
            "the 1 session that carries it"
            if count == 1
            else f"all {count} sessions that carry it"
        )
        return [
            "",
            f"The page's own ruler-fit account matches this tool's "
            f"recomputation exactly on {stated}.",
        ]
    # Full precision, deliberately: two wrong implementations can
    # agree to two decimals, and this section exists to see past
    # the rounding the table above applies.
    return [
        "",
        "THE PAGE DISAGREES WITH THIS TOOL. baselineOverResting is "
        "the page's live computation of the ruler-fit ratio and must "
        "equal this tool's recomputation from the same rows to the "
        "last bit. It does not, so one of the two implementations is "
        "wrong, and nothing below this line should be trusted until "
        "it is known which:",
        *(
            f"{label}  page {check.page_ratio!r}, recomputed "
            f"{check.recomputed_ratio!r}"
            for label, check in disagreeing
        ),
    ]


def calibration_refused_lines(
    refused: list[RefusedCalibration],
) -> list[str]:
    """Rule 1: refusals counted first, each with its certificate."""
    if not refused:
        return []
    lines = ["CALIBRATION REFUSED", ""]
    for refusal in refused:
        lines.append(
            f"{refusal.label}  samples {dash(refusal.samples)}, "
            f"spread ratio {dash(refusal.spread_ratio, 3)}. The "
            f"instrument withheld every ruler-dependent number; this "
            f"session contributes no detector columns."
        )
        if refusal.violates_refusal_contract:
            lines.append(
                f"{refusal.label}  INSTRUMENT DEFECT: this refusal is "
                f"not ceiling-bound, and ceiling-bound is the only "
                f"signal a refusal can fire on. The committed "
                f"prediction in docs/validation-plan-round2.md is "
                f"broken and the round's analysis stops here until "
                f"this is explained."
            )
    return [*lines, ""]


def round2_rule_lines(rules: list[Round2Rules]) -> list[str]:
    """Rules 2-5, answered per session, mechanically."""
    lines = [
        "ROUND II RULES (docs/validation-plan-round2.md). Round II's "
        "failure criteria are registered with its protocol, not here; "
        "these are the mechanical rule outcomes:",
        "",
    ]
    for rule in rules:
        parts = [
            f"evidence rate {dash(rule.evidence_fps, 1)}"
            + (
                ""
                if rule.evidence_source is None
                else f" ({rule.evidence_source})"
            )
        ]
        if rule.evidence_unsound:
            parts.append("BELOW THE 25 FPS FLOOR, not detector evidence")
        # Probe C: with no marked window this line used to assert
        # "baseline constant across the marked window" anyway. None
        # now means there was nothing to judge, and the line says so.
        if rule.freeze_defect is None:
            parts.append("no marked window to judge the freeze")
        elif rule.freeze_defect:
            parts.append(
                "FREEZE DEFECT: baseline moved inside the marked window"
            )
        else:
            parts.append("baseline constant across the marked window")
        if rule.short_ruler:
            parts.append("SHORT RULER: baseline below the resting median")
        if rule.zero_width_window:
            parts.append("ZERO-WIDTH WINDOW, refused to score")
        lines.append(f"{rule.label}  " + "; ".join(parts) + ".")
    if not rules:
        lines.append("no scoreable sessions")
    return lines


def report(directory: Path, rules: str = "round1") -> tuple[list[str], int]:
    """The whole report, and the number of participants it refused.

    Raises InstrumentDefect in pilot mode when any session's exported
    report disagrees with the re-derived verdict: the cohort analysis
    stops rather than averaging over a disagreement.
    """
    pilot = rules == "pilot"
    round2 = rules == "round2" or pilot
    pairs = find_pairs(directory, pilot_reports=pilot)
    # The defect gate runs before anything is assembled: a defect must
    # stop the whole analysis, not decorate the bottom of a table.
    pilot_lines = pilot_verdict_lines(pairs) if pilot else []
    rows: list[ParticipantRow] = []
    accounts: list[tuple[str, RulerFitCrossCheck]] = []
    refusals: list[tuple[PairPaths, str]] = []
    calibration_refusals: list[RefusedCalibration] = []
    rule_outcomes: list[Round2Rules] = []
    for paths in pairs:
        try:
            pair = load_pair(paths)
            if round2:
                refusal = refused_calibration(pair)
                if refusal is not None:
                    # Rule 1: a refusal is a result, counted first,
                    # and it contributes no detector columns.
                    calibration_refusals.append(refusal)
                    continue
            row = row_for(pair)
            rows.append(row)
            if round2:
                rule_outcomes.append(round2_rules(pair, row))
            accounts.append(
                (row.label, ruler_fit_cross_check(pair.session.frame))
            )
        except ValidationError as error:
            # Never a skip. A person missing from the table is a person
            # nobody looks for, so a refusal takes a line of its own
            # naming who and why.
            refusals.append((paths, str(error)))

    noun = "participant" if len(pairs) == 1 else "participants"
    lines = [
        f"Validation round: {len(pairs)} {noun} in {directory}",
        f"Ground truth between the two marks: {EXPECTED_BLINKS} blinks.",
        "",
        *calibration_refused_lines(calibration_refusals),
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
        # load_pair already names the session file in its wrapping, so
        # only add the name when the reason does not start with it, or
        # session-level refusals print the same filename twice. When
        # the reason names the BLINKS file instead, the prefix is what
        # says whose pair it belongs to, and stays.
        lines += [
            f"{paths.label}  {reason}"
            if reason.startswith(paths.session_path.name)
            else f"{paths.label}  {paths.session_path.name}: {reason}"
            for paths, reason in refusals
        ]
        lines += [""]
    # Round I's three criteria belong to round I's plan; round II
    # prints its own rules section instead. Both keep the page account.
    lines += (
        round2_rule_lines(rule_outcomes) if round2 else verdict_summary(rows)
    )
    if pilot_lines:
        lines += ["", *pilot_lines]
    lines += page_account_lines(accounts)
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
    parser.add_argument(
        "--rules",
        choices=("round1", "round2", "pilot"),
        default="round1",
        help=(
            "which plan's rules read the files. The default is round I "
            "and is FROZEN: the published tables must stay reproducible. "
            "round2 applies docs/validation-plan-round2.md and is never "
            "inferred from the files. pilot is round II plus the "
            "assessment pilot's verdict table and the page-vs-analysis "
            "defect gate (docs/assessment-pilot-plan.md)."
        ),
    )
    arguments = parser.parse_args()
    try:
        lines, refused = report(arguments.directory, rules=arguments.rules)
    except ValidationError as error:
        # A folder-level refusal stops the run. Reporting on five people
        # while a sixth's file sits unread is not acceptable.
        print(f"REFUSED: {error}", file=sys.stderr)
        return 2
    except InstrumentDefect as defect:
        # The page and the analysis disagree about one session, so no
        # cohort table prints at all — neither side can be trusted
        # over the other until the defect is explained.
        print(str(defect), file=sys.stderr)
        return 3
    print("\n".join(lines))
    # A non-zero exit when anyone was refused, so a run that could not
    # read everybody cannot be mistaken for a clean one by a script.
    return 1 if refused else 0


if __name__ == "__main__":
    raise SystemExit(main())
