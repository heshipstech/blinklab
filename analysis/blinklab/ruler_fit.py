"""The page's own account of the ruler-fit check, read back and re-derived.

Since 23 August 2026 the browser computes the validation round's
fifth check live (src/core/rulerFit.ts) and writes the running ratio
into every row as `baselineOverResting`. That makes two
implementations of one statistic, in two languages, and two
implementations drift silently unless something compares them. This
module is the comparison: the LAST value the page wrote — the
whole-file number — against this side's own derivation from the
same rows, the one `baseline_settling` already computes for the
published table.

The equality is EXACT, not a tolerance. Both sides divide the same
two float64 values: the exporter writes shortest round-tripping
decimals, the loader parses them back to the identical floats, and
both medians average the same middle pair. A tolerance would be a
place for a real defect to hide, and two wrong implementations can
agree to two decimals — the first session where the bits differ is
a bug in one of them, which is precisely the finding this exists to
surface.

What this cannot see, stated plainly: a file whose column is all
NaN might be a legacy export (honest, predates the column) or a new
export that failed to write it — after loading, the two are the
same frame. Such a file is reported as not comparable, never as a
disagreement.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from blinklab.validation_checks import baseline_settling


@dataclass(frozen=True)
class RulerFitCrossCheck:
    """One session's two accounts of the same ratio."""

    # The last non-NaN baselineOverResting the page wrote, which is
    # its whole-file statistic. None when the column carries nothing.
    page_ratio: float | None
    # This tool's own derivation, the same value the published
    # table's "baseline / resting" column prints.
    recomputed_ratio: float | None

    @property
    def agrees(self) -> bool | None:
        """True, False, or None for "the page never spoke".

        A page that wrote a ratio this tool cannot derive from the
        same rows is False, not None: live, both sides are computed
        on the same tick from the same state, so that shape means
        one of them is broken.
        """
        if self.page_ratio is None:
            return None
        if self.recomputed_ratio is None:
            return False
        return self.page_ratio == self.recomputed_ratio


def ruler_fit_cross_check(frame: pd.DataFrame) -> RulerFitCrossCheck:
    """Both accounts of the ratio, from one loaded session frame."""
    page = None
    if "baselineOverResting" in frame:
        written = frame["baselineOverResting"].dropna()
        if not written.empty:
            page = float(written.iloc[-1])
    return RulerFitCrossCheck(
        page_ratio=page,
        recomputed_ratio=baseline_settling(frame).over_resting,
    )
