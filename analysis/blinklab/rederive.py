"""Re-derive the RLDD blink rate under the observed-time definition.

Roadmap 10.12b changed what the live page's `blinkRatePerMin` MEANS:
the rolling count now divides by observed (fed-frame) time instead of
the wall clock, so a face-loss gap no longer dilutes the rate into
looking calm. The retained RLDD per-second files were exported before
that change, and their rate column is frozen at the old definition —
the files cannot be re-exported without re-measuring the corpus.

What the files DO hold is enough to re-derive: the paired blink log
carries every blink's time, and the per-second rows say which seconds
the instrument actually measured a face. So the new rate here is
blinks-in-window over observed-seconds-in-window — the same idea as
the live definition, at the one-second granularity the retained files
have. An observed second is a row with a measured aperture, which is
an APPROXIMATION of the live path's per-frame credit rule and is
stated as one: at 25 frames per second and above, a second with any
fed frame is close to a fully credited second, and a second with none
credits nothing under either rule.

The OLD number is taken through `load_video_features` — the published
derivation itself, not a reimplementation — so the comparison is
against exactly what docs/uta-rldd-result.txt printed.

DROZY needs no re-derivation and none is offered: `blinklab/drozy.py`
derives its rate from the blink-event count over the window's real
length and never read the app's rolling column, so 10.12b does not
touch it. Its result file's caveat says so in words; this module is
the RLDD half.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

from blinklab.rldd import WINDOW_END_S, WINDOW_START_S, load_video_features


class RederiveError(Exception):
    """A file this comparison needs is missing or unreadable."""


@dataclass(frozen=True)
class RederivedRate:
    """One video's rate, both ways.

    `old_rate_per_min` is the published derivation (the window median
    of the exported column, via the real loader). `new_rate_per_min`
    is blinks over observed time, or None when no window second was
    observed — a refusal, because dividing by nothing would invent an
    infinite rate and zero would invent a calm one.

    `blink_log` says where the numerator came from: "present" when
    the paired log was read, "absent-no-blinks" when no log exists
    AND the seconds file carries no blink evidence anywhere — which
    is the exporter's own behaviour, because the corpus runner clicks
    the blinks export only when the button is enabled and a session
    with no blinks disables it. A zero-blink video writes no log by
    design, and its zero is a measured count.
    """

    name: str
    old_rate_per_min: float | None
    blink_count: int
    observed_seconds: int
    new_rate_per_min: float | None
    blink_log: str


def _blink_times_ms(blinks_csv: Path) -> list[float]:
    """Every blink's `atMs` from one blink log, metadata stripped."""
    body = [
        line
        for line in blinks_csv.read_text(encoding="utf-8").splitlines()
        if not line.startswith("#")
    ]
    times: list[float] = []
    for row in csv.DictReader(body):
        raw = (row.get("atMs") or "").strip()
        try:
            times.append(float(raw))
        except ValueError:
            continue
    return times


def _seconds_rows(seconds_csv: Path) -> list[dict[str, str]]:
    """The per-second rows, `# ...` metadata stripped."""
    body = [
        line
        for line in seconds_csv.read_text(encoding="utf-8").splitlines()
        if not line.startswith("#")
    ]
    return list(csv.DictReader(body))


def _blink_evidence(rows: list[dict[str, str]]) -> bool:
    """Whether the seconds file itself says any blink was measured.

    Two witnesses, either sufficient: `lastBlinkDurationMs` is written
    from the first blink on and stays, so one filled cell proves a
    blink; `blinkRatePerMin` above zero anywhere proves the same where
    a truncated file might have lost the sticky columns. Checked over
    the WHOLE file rather than the window, because the blink log is
    session-wide: a blink anywhere means a log was written.
    """
    for row in rows:
        if (row.get("lastBlinkDurationMs") or "").strip():
            return True
        raw = (row.get("blinkRatePerMin") or "").strip()
        try:
            if float(raw) > 0:
                return True
        except ValueError:
            continue
    return False


def _observed_window_seconds(rows: list[dict[str, str]]) -> int:
    """Window rows whose aperture was measured: the denominator."""
    observed = 0
    for row in rows:
        raw_ms = (row.get("timestampMs") or "").strip()
        raw_aperture = (row.get("apertureMm") or "").strip()
        try:
            second = int(float(raw_ms) // 1000)
            float(raw_aperture)
        except ValueError:
            continue
        if WINDOW_START_S <= second < WINDOW_END_S:
            observed += 1
    return observed


def rederive_video(
    seconds_csv: str | Path, blinks_csv: str | Path
) -> RederivedRate:
    """One video's old and re-derived rate, or a refusal by name."""
    seconds_path = Path(seconds_csv)
    blinks_path = Path(blinks_csv)
    features = load_video_features(seconds_path)
    rows = _seconds_rows(seconds_path)
    if blinks_path.exists():
        blink_log = "present"
        window_start_ms = WINDOW_START_S * 1000
        window_end_ms = WINDOW_END_S * 1000
        blink_count = sum(
            1
            for at in _blink_times_ms(blinks_path)
            if window_start_ms <= at < window_end_ms
        )
    elif _blink_evidence(rows):
        # The seconds file says blinks happened, so a log was written
        # and is not here: that is loss, and a lost numerator refuses
        # by name rather than guessing.
        raise RederiveError(
            f"{blinks_path.name} is missing: the re-derivation needs the "
            "blink log beside its per-second file, because the events "
            "are the numerator — and this per-second file's own blink "
            "columns say blinks were measured, so a log was written"
        )
    else:
        # No log and no evidence anywhere: the zero-blink export, and
        # zero is a measured count.
        blink_log = "absent-no-blinks"
        blink_count = 0
    observed = _observed_window_seconds(rows)
    new_rate = (blink_count / observed) * 60 if observed else None
    return RederivedRate(
        name=f"{features.subject}_{features.label}",
        old_rate_per_min=features.blink_rate_per_min,
        blink_count=blink_count,
        observed_seconds=observed,
        new_rate_per_min=new_rate,
        blink_log=blink_log,
    )


def rederive_directory(measured_dir: str | Path) -> list[RederivedRate]:
    """Every video in a measured directory, both rates each.

    One missing pair refuses the whole directory rather than quietly
    narrowing the comparison to the files that happen to have logs —
    a corpus comparison over a silent subset is the kind of number
    that looks complete and is not.
    """
    directory = Path(measured_dir)
    seconds_files = sorted(directory.glob("*.seconds.csv"))
    if not seconds_files:
        raise RederiveError(f"no *.seconds.csv under {directory}")
    results: list[RederivedRate] = []
    for seconds_path in seconds_files:
        stem = seconds_path.name[: -len(".seconds.csv")]
        results.append(
            rederive_video(seconds_path, directory / f"{stem}.blinks.csv")
        )
    return results
