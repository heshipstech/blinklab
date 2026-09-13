"""The column-freeze manifest for the UTA-RLDD v2 read (roadmap 12.17).

The v2 read (row 12.18) is the ONE batched, pre-registered read of the
UTA-RLDD labels, carrying every new signal family together, because a
per-feature drip is how evidentiary freshness dies (amendment 16). That
read consumes a fixed set of per-second export columns, and between the
moment its columns are frozen and the moment the read happens, none of
them may be silently renamed, dropped, or re-typed — or the read would
be measuring a different instrument than its plan was written against.

These tests hold three things: the pure freeze logic (a column is
enforced only while signed-in and not yet released, the same
self-retiring shape as tools/drozyGuard.mjs); that the committed
manifest lists every column rldd.py actually reads, discovered from
rldd's own source so a new read cannot slip past the freeze unmapped;
and that the runner refuses a seconds.csv whose header drops an in-force
frozen column. The manifest ships UNSIGNED — the tool lands now, the
owner signs the dates after 12.16's and 14.9a's columns exist — so the
refusal is proven on a signed manifest constructed here, not on the
committed one, which by design enforces nothing yet.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from blinklab.column_freeze import (
    V2_READ_COLUMNS,
    ColumnFreezeError,
    FrozenColumn,
    check_header,
    enforced_columns,
    missing_frozen_columns,
)
from blinklab.rldd import RldError, load_video_features

ANALYSIS_ROOT = Path(__file__).resolve().parents[1]
RLDD_SOURCE = ANALYSIS_ROOT / "blinklab" / "rldd.py"

SIGNED = "2026-09-13"
RELEASED = "2026-09-20"


def test_a_column_is_in_force_only_while_signed_and_not_released() -> None:
    assert FrozenColumn("perclos").in_force() is False  # unsigned
    assert FrozenColumn("perclos", frozen_on=SIGNED).in_force() is True
    retired = FrozenColumn("perclos", frozen_on=SIGNED, released_on=RELEASED)
    assert retired.in_force() is False


def test_the_committed_manifest_ships_unsigned() -> None:
    # Nothing is frozen until the owner attests it is. The tool lands
    # now; the signature waits on 12.16's and 14.9a's columns existing.
    assert enforced_columns(V2_READ_COLUMNS) == []
    # An unsigned manifest cannot refuse anything, so enabling the tool
    # now cannot break a current run.
    check_header([], V2_READ_COLUMNS)  # does not raise


def test_missing_lists_only_in_force_columns_in_manifest_order() -> None:
    released = FrozenColumn(
        "blinkRatePerMin", frozen_on=SIGNED, released_on=RELEASED
    )
    manifest = (
        FrozenColumn("fps", frozen_on=SIGNED),  # in force
        FrozenColumn("perclos"),  # unsigned
        released,  # signed then released: retired
        FrozenColumn("longClosureCount", frozen_on=SIGNED),  # in force
    )
    # header carries none of them
    assert missing_frozen_columns(manifest, []) == ["fps", "longClosureCount"]


def test_a_signed_column_present_in_the_header_passes() -> None:
    manifest = (FrozenColumn("perclos", frozen_on=SIGNED),)
    check_header(["timestampMs", "perclos"], manifest)  # does not raise
    assert missing_frozen_columns(manifest, ["perclos"]) == []


def test_a_signed_column_missing_from_the_header_refuses_by_name() -> None:
    manifest = (FrozenColumn("perclos", frozen_on=SIGNED),)
    with pytest.raises(ColumnFreezeError, match="perclos"):
        check_header(["timestampMs", "fps"], manifest)


def test_a_released_column_retires_and_no_longer_refuses() -> None:
    # The self-retiring half: once the read has consumed the column and
    # the owner dates released_on, the freeze lifts on its own — nobody
    # has to remember to delete it. Same shape as drozyGuard.
    manifest = (
        FrozenColumn("perclos", frozen_on=SIGNED, released_on=RELEASED),
    )
    check_header([], manifest)  # missing perclos, but retired: no raise


def _rldd_read_columns() -> set[str]:
    """Every seconds.csv column rldd.py reads by name, from its source.

    Anchored on the `_num(row, "col")` / `_num(r, "col")` calls that are
    how load_video_features reaches into a per-second row. Reading the
    source rather than a remembered list is the drozyGuard discipline: a
    new column added to the v2 read shows up here without anyone
    updating this test."""
    source = RLDD_SOURCE.read_text(encoding="utf-8")
    return set(re.findall(r'_num\(\s*r(?:ow)?\s*,\s*"([^"]+)"\)', source))


def test_the_manifest_lists_every_column_the_v2_read_consumes() -> None:
    read = _rldd_read_columns()
    # The floor pins that the reader keeps finding real reads, so a
    # broken pattern cannot return nothing and agree with everything.
    assert len(read) >= 6
    manifest_names = {c.name for c in V2_READ_COLUMNS}
    unmapped = sorted(read - manifest_names)
    assert unmapped == [], (
        f"rldd.py reads seconds.csv columns absent from the freeze "
        f"manifest: {unmapped}. Add them to V2_READ_COLUMNS or the v2 "
        f"read can move a column the freeze never covered."
    )


def test_the_runner_refuses_a_seconds_csv_missing_an_in_force_column(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # The wired half: load_video_features (the loader analyse_rldd
    # drives) refuses when a frozen column is gone. Proven on a SIGNED
    # manifest injected here, because the committed one is unsigned by
    # design. perclos is dropped from the header; every other v2 column
    # stays, so only the freeze can be the reason it refuses.
    import blinklab.column_freeze as cf

    signed = tuple(
        FrozenColumn(c.name, frozen_on=SIGNED) for c in V2_READ_COLUMNS
    )
    monkeypatch.setattr(cf, "V2_READ_COLUMNS", signed)

    header = [
        "timestampMs",
        "fps",
        "blinkRatePerMin",
        "lastBlinkDurationMs",
        "lastBlinkAmplitudeMm",
        "lastBlinkPeakVelocityMmPerS",
        "longClosureCount",
    ]  # perclos deliberately absent
    row = ",".join("0" for _ in header)
    seconds = tmp_path / "Subject01_alert.seconds.csv"
    seconds.write_text(
        "# metadata line\n" + ",".join(header) + "\n" + row + "\n",
        encoding="utf-8",
    )
    with pytest.raises(RldError, match="perclos"):
        load_video_features(seconds)
