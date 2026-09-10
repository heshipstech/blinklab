"""Both shut-line placements over a retained session export.

Roadmap 12.0a. The live page draws "eyes shut" for PERCLOS and the
long-closure detector at EYES_SHUT_FRACTION (0.4) times the frozen
first-ready baseline — a population fraction on an open-eye number.
The pre-registered rule (docs/shut-line-rule.txt, committed before
any retained column is read for this question) re-places the line
personally: closed + 0.15 x (open - closed), adopted only when the
margin it buys clears 0.6 mm, twice the worst committed per-eye p95
of the 10.7a noise floor.

This module is the scoring instrument for that rule's floor-shift
prediction: it reads a retained export through the published loader
and reports BOTH placements side by side. The retained files carry
no guided calibration medians, so the personal pair is PROXIED from
the aperture column itself, fixed by the pre-registration before
any owner file is read: the open median is the session's median
measured aperture, the closed value its 1st percentile. The
eyes-shut share here is the fraction of measured one-second rows
strictly below a line — the same one-second approximation of the
live window rule that `rederive.py` states for the rate, counted
with the live consumers' own boundary convention (strictly below
closes; exactly at the line stays open, perclos.ts).

The adoption verdict is reported as its own fact and never censors
the numbers: a session whose span cannot fund the margin still
shows what the candidate line would have read, because "the rule
declines this session" and "the numbers are unknowable" are
different claims.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from blinklab.loader import load_session

# The rule under test, fixed by docs/shut-line-rule.txt.
SHUT_K = 0.15
ADOPTION_MARGIN_MM = 0.6

# The shipped rule this instrument compares against:
# EYES_SHUT_FRACTION in src/core/longClosure.ts, shared by perclos.ts.
POPULATION_SHUT_FRACTION = 0.4

# The proxies, fixed before any retained file is read.
OPEN_PROXY_QUANTILE = 0.5
CLOSED_PROXY_QUANTILE = 0.01


class ShutLineError(Exception):
    """A session this comparison cannot honestly be run on."""


@dataclass(frozen=True)
class ShutLineComparison:
    """One session, both placements.

    `old_line_mm` is None for a session whose baseline never froze:
    the population rule never placed a line there, and None says so
    where a zero would claim a measurement. `perclos_*` are fractions
    of measured rows strictly below each line; `longest_run_s_*` the
    longest CONSECUTIVE run of such rows, a duration proxy — runs are
    never added together, because summing them would be the dilution
    defect wearing a new column.
    """

    name: str
    measured_rows: int
    open_proxy_mm: float
    closed_proxy_mm: float
    old_line_mm: float | None
    new_line_mm: float
    adopted: bool
    perclos_old: float | None
    perclos_new: float
    longest_run_s_old: int | None
    longest_run_s_new: int


def _frozen_baseline_mm(frame: pd.DataFrame) -> float | None:
    """The one frozen shutBaselineMm, None if never present.

    The exporter writes this column from a value frozen once per
    session, so two distinct values is instrument damage and refuses
    rather than picking one.
    """
    values = pd.to_numeric(frame["shutBaselineMm"], errors="coerce").dropna()
    if values.empty:
        return None
    distinct = sorted({float(v) for v in values})
    if len(distinct) > 1:
        raise ShutLineError(
            "shutBaselineMm holds more than one value "
            f"({distinct[0]} and {distinct[-1]}), and a frozen baseline "
            "cannot vary within a session: this file was not written the "
            "way the export contract says"
        )
    return distinct[0]


def _longest_run(below: list[bool]) -> int:
    longest = 0
    run = 0
    for is_below in below:
        run = run + 1 if is_below else 0
        longest = max(longest, run)
    return longest


def compare_session(session_csv: str | Path) -> ShutLineComparison:
    """One session's shut line, both ways, or a refusal by name."""
    path = Path(session_csv)
    session = load_session(path)
    apertures = pd.to_numeric(
        session.frame["apertureMm"], errors="coerce"
    ).dropna()
    if apertures.empty:
        raise ShutLineError(
            f"{path.name} holds no measured aperture at all: there is "
            "nothing to place either line against"
        )
    open_proxy = float(apertures.quantile(OPEN_PROXY_QUANTILE))
    closed_proxy = float(apertures.quantile(CLOSED_PROXY_QUANTILE))
    span = open_proxy - closed_proxy
    if span <= 0:
        raise ShutLineError(
            f"{path.name} has no aperture span to place a line in "
            f"(open proxy {open_proxy}, closed proxy {closed_proxy}): a "
            "flat session cannot say where its own shut lives"
        )
    new_line = closed_proxy + SHUT_K * span
    frozen = _frozen_baseline_mm(session.frame)
    old_line = None if frozen is None else POPULATION_SHUT_FRACTION * frozen

    values = [float(v) for v in apertures]
    below_new = [v < new_line for v in values]
    perclos_new = sum(below_new) / len(values)
    if old_line is None:
        perclos_old = None
        longest_old = None
    else:
        below_old = [v < old_line for v in values]
        perclos_old = sum(below_old) / len(values)
        longest_old = _longest_run(below_old)

    name = path.name
    for prefix, suffix in (
        ("blinklab-session-", ".csv"),
        ("", ".seconds.csv"),
    ):
        if name.startswith(prefix) and name.endswith(suffix):
            name = name[len(prefix) : len(name) - len(suffix)]
            break

    return ShutLineComparison(
        name=name,
        measured_rows=len(values),
        open_proxy_mm=open_proxy,
        closed_proxy_mm=closed_proxy,
        old_line_mm=old_line,
        new_line_mm=new_line,
        adopted=SHUT_K * span >= ADOPTION_MARGIN_MM,
        perclos_old=perclos_old,
        perclos_new=perclos_new,
        longest_run_s_old=longest_old,
        longest_run_s_new=_longest_run(below_new),
    )


def compare_directory(folder: str | Path) -> list[ShutLineComparison]:
    """Every session export in a folder, both placements each.

    Accepts the app's own download naming and the corpus runner's,
    because the dry-run folders hold the first and a measured corpus
    directory the second, and the comparison is the same either way.
    """
    directory = Path(folder)
    paths = sorted(
        set(directory.glob("blinklab-session-*.csv"))
        | set(directory.glob("*.seconds.csv"))
    )
    if not paths:
        raise ShutLineError(
            f"no session exports under {directory}: nothing matching "
            "blinklab-session-*.csv or *.seconds.csv"
        )
    return [compare_session(path) for path in paths]
