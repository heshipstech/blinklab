"""Column-freeze manifest for the UTA-RLDD v2 read (roadmap 12.17).

The labels of UTA-RLDD are read exactly once more: one batched,
pre-registered v2 read (row 12.18) carries every new signal family
together, because a per-feature drip is how evidentiary freshness dies
(amendment 16). That single read consumes a fixed set of per-second
export columns, and between the moment its column set is frozen and the
moment the read happens, none of those columns may be silently renamed,
dropped, or re-typed — or the pre-registration would be reading a
different instrument than the one it was written against.

This is the freeze. Each entry names one column the v2 read depends on
and carries two owner-signed dates: ``frozen_on``, when the column was
declared frozen, and ``released_on``, when the read consumed it and the
freeze retired. A column is IN FORCE only while it is signed-in and not
yet released; the corpus runner then refuses any seconds.csv whose
header is missing an in-force column. Same self-retiring shape as
tools/drozyGuard.mjs: the requirement lifts on its own when the
condition that justified it ends, so nobody has to remember to delete a
stale guard.

The dates are LEFT BLANK here on purpose. The tool and its tests land
now (12.17's own text splits it so); the owner signs the freeze after
12.16's and 14.9a's columns exist and before 12.18a's plan is
committed, which is a judgement about evidentiary readiness and the
owner's to make, not this file's. Unsigned, the manifest enforces
nothing — which is exactly right: nothing is frozen until someone
attests it is, and enabling the tool now therefore cannot break a
current run.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass


class ColumnFreezeError(Exception):
    """A seconds.csv header dropped a column the v2 read froze."""


@dataclass(frozen=True)
class FrozenColumn:
    """One per-second export column the v2 read depends on, with the
    owner's freeze dates. Blank dates mean unsigned: not yet frozen."""

    name: str
    frozen_on: str = ""
    released_on: str = ""

    def in_force(self) -> bool:
        """Frozen and not yet released. An unsigned column (no
        ``frozen_on``) enforces nothing; a released one has retired."""
        return bool(self.frozen_on) and not self.released_on


# The columns analysis/blinklab/rldd.py reads from each
# ``<subject>_<label>.seconds.csv`` to build one VideoFeatures — the v2
# read's column dependency, today. The dates are unsigned; the owner
# extends this with 12.16's and 14.9a's columns and signs it when those
# exist. test_column_freeze.py reads rldd.py's own source and holds this
# list to the columns rldd actually consumes, so a read added without a
# manifest entry reddens the build.
V2_READ_COLUMNS: tuple[FrozenColumn, ...] = (
    FrozenColumn("timestampMs"),
    FrozenColumn("fps"),
    FrozenColumn("blinkRatePerMin"),
    FrozenColumn("lastBlinkDurationMs"),
    FrozenColumn("lastBlinkAmplitudeMm"),
    FrozenColumn("lastBlinkPeakVelocityMmPerS"),
    FrozenColumn("perclos"),
    FrozenColumn("longClosureCount"),
)


def enforced_columns(manifest: Iterable[FrozenColumn]) -> list[str]:
    """The column names a freeze currently enforces: signed-in and not
    released, in manifest order."""
    return [column.name for column in manifest if column.in_force()]


def missing_frozen_columns(
    manifest: Iterable[FrozenColumn],
    header: Iterable[str],
) -> list[str]:
    """The in-force frozen columns absent from ``header``, in manifest
    order. Empty means the header carries every frozen column."""
    present = set(header)
    return [name for name in enforced_columns(manifest) if name not in present]


def check_header(
    header: Iterable[str],
    manifest: Iterable[FrozenColumn] | None = None,
) -> None:
    """Raise :class:`ColumnFreezeError` if ``header`` drops any in-force
    frozen column. A no-op while the manifest is unsigned (nothing in
    force). The default manifest is read at call time, so a test may
    swap ``V2_READ_COLUMNS`` to exercise the signed path."""
    active = V2_READ_COLUMNS if manifest is None else manifest
    missing = missing_frozen_columns(active, header)
    if missing:
        raise ColumnFreezeError(
            "seconds.csv header is missing v2-read columns frozen for the "
            f"pre-registered read: {', '.join(missing)}. The freeze is in "
            "force (a signed frozen_on with no released_on), so the read "
            "refuses rather than silently measuring a moved instrument."
        )
