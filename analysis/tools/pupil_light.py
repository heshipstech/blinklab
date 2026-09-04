"""Run the pre-registered light-response analysis on a recorded session.

The plan, fixed before any camera ran, is docs/pupil-light-plan.md
(roadmap 9.4). This tool reads a session CSV the app exported behind the
"Light response" stimulus screen, recovers each second's phase from the
stimulus start the app logged, and prints the verdict: detected, null, or
inconclusive, with the counts it was drawn from.

It reads numbers, never a frame, and prints numbers, never an identity: the
session's pseudonym and camera rows are ignored here.

Usage, from the analysis directory:

    PYTHONPATH="$PWD" .venv/bin/python tools/pupil_light.py <session.csv>
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

from blinklab.light_response import (
    analyse_light_response,
    stimulus_start_ms,
)
from blinklab.loader import load_session


def _report(result, start_ms: float) -> str:
    lines = [
        "Light-response analysis (docs/pupil-light-plan.md, roadmap 9.4)",
        f"  stimulus start (timestampMs clock): {start_ms:.1f}",
        f"  in-window seconds (dark|bright):    {result.in_window_seconds}",
        f"  usable seconds:                     {result.usable_seconds} "
        f"({result.usable_fraction:.1%})",
        f"  usable dark / bright:               "
        f"{result.usable_dark} / {result.usable_bright}",
        f"  usable-data gate cleared:           {result.gate_cleared}",
    ]
    if result.gate_cleared:
        lines += [
            f"  median dark pupil (mm):             "
            f"{result.median_dark_mm:.3f}",
            f"  median bright pupil (mm):           "
            f"{result.median_bright_mm:.3f}",
            f"  dark - bright (mm):                 "
            f"{result.dark_minus_bright_mm:+.3f}",
            f"  permutation 97.5th percentile (mm): "
            f"{result.permutation_percentile_mm:+.3f}",
            f"  one-sided permutation p:            {result.p_one_sided:.3f}",
        ]
    else:
        lines.append(f"  reason:                             {result.reason}")
    lines.append(f"  VERDICT: {result.verdict.upper()}")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("session", type=Path, help="a session CSV")
    args = parser.parse_args()

    session = load_session(args.session)
    start = stimulus_start_ms(session.metadata)
    timestamps = session.frame["timestampMs"].tolist()
    # NaN is the estimator's refusal; the analysis treats it as not usable.
    pupil = [
        None if value is None or math.isnan(value) else float(value)
        for value in session.frame["pupilDiameterMm"].tolist()
    ]
    result = analyse_light_response(timestamps, pupil, start)
    print(_report(result, start))


if __name__ == "__main__":
    main()
