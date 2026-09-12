"""The cued protocol's per-event table, roadmap 11.0b.

The schedule is read OUT OF THE FILE — the ``cue_N_*`` rows
``sessionMetadata.ts`` writes — never out of this repository's
constants. That is what lets a scaled test run score against its own
scaled times, and an old file score against what it actually asked,
whatever the schedule says today.

What each cue kind can be scored against here follows 11.0a's own
rulings. Blink cues score against the blink log's events, first event
inside the window, one event per cue. The two closure cues have no
event stream in any export yet — the per-second columns carry counts,
not events — so their rows SAY so and name row 13.3, which owns the
closure error, rather than inventing a tally from the wrong column.
The look-away is excluded by design: nothing the blink or closure
path sees can answer it, and a number about nothing helps nobody.
"""

from __future__ import annotations

from dataclasses import dataclass


class CueError(ValueError):
    """A file whose cue block disagrees with itself."""


@dataclass(frozen=True)
class CueRow:
    index: int
    kind: str
    at_ms: float
    """On the record clock: the protocol start plus the cue's offset."""


def session_cues(metadata: dict[str, str]) -> list[CueRow] | None:
    """The schedule the file carries, or None when no protocol ran.

    Absence of the start row is an ordinary session — the exporter
    writes the block only when the protocol ran. A block that IS
    present and disagrees with itself is damage, refused by name: a
    file that declares three cues and carries two has lost one, and
    which one cannot be known from here (the markers precedent).
    """
    start_raw = metadata.get("cue_protocol_start_ms")
    if start_raw is None:
        return None
    try:
        start_ms = float(start_raw)
    except ValueError as error:
        raise CueError(f"cue start is not a number: {start_raw!r}") from error
    window_raw = metadata.get("cue_response_window_ms")
    if window_raw is None:
        raise CueError(
            "the cue block carries a start and no response window, so "
            "no tally from this file could say what it counted"
        )
    count_raw = metadata.get("cues")
    if count_raw is None:
        raise CueError("the cue block carries a start and no cue count")
    try:
        count = int(count_raw)
    except ValueError as error:
        raise CueError(
            f"the cue count is not a number: {count_raw!r}"
        ) from error
    cues: list[CueRow] = []
    for index in range(1, count + 1):
        kind = metadata.get(f"cue_{index}_kind")
        seconds = metadata.get(f"cue_{index}_seconds")
        if kind is None or seconds is None:
            raise CueError(
                f"the file declares {count} cues and cue {index} is "
                "missing its rows"
            )
        try:
            offset_s = float(seconds)
        except ValueError as error:
            raise CueError(
                f"cue {index} start is not a number: {seconds!r}"
            ) from error
        cues.append(
            CueRow(index=index, kind=kind, at_ms=start_ms + offset_s * 1000.0)
        )
    return cues


def response_window_ms(metadata: dict[str, str]) -> float:
    """The window the file's own tally uses. Callers reach this only
    after ``session_cues`` accepted the block, which proved the row is
    there; an unreadable value is still refused by name."""
    raw = metadata.get("cue_response_window_ms")
    if raw is None:
        raise CueError("no response window row")
    try:
        return float(raw)
    except ValueError as error:
        raise CueError(f"response window is not a number: {raw!r}") from error


def _rate(metadata: dict[str, str], key: str) -> str:
    """A rate cell, or a dash. A dash and not 'unknown': these cells
    sit beside a tally in a fixed-width table, and absence here is an
    ordinary session (a clip, a rate not yet measurable), never
    damage."""
    value = metadata.get(key)
    return "-" if value is None or value == "unknown" else value


def cue_event_rows(
    metadata: dict[str, str],
    blink_times_ms: list[float],
) -> list[list[str]] | None:
    """One table row per instruction cue, rates beside every tally.

    The columns: index, kind, cue time in seconds on the record clock,
    the tally, then the delivered rate, the processing rate and the
    sampled fps — the three numbers that condition every catch rate,
    printed beside every tally because a tally quoted without them is
    a number about an unknown instrument (the row's own Check).
    """
    cues = session_cues(metadata)
    if cues is None:
        return None
    window = response_window_ms(metadata)
    delivered = _rate(metadata, "camera_delivered_fps")
    processing = _rate(metadata, "measured_fps")
    sampled = _rate(metadata, "sampled_fps")
    used: set[int] = set()
    rows: list[list[str]] = []
    for cue in cues:
        if cue.kind == "blink":
            tally = "missed"
            for position, at_ms in enumerate(blink_times_ms):
                if position in used:
                    continue
                latency = at_ms - cue.at_ms
                if 0 <= latency <= window:
                    used.add(position)
                    tally = f"caught ({latency:.0f} ms)"
                    break
        elif cue.kind in ("close3", "close20"):
            tally = "no closure event stream in this export; row 13.3"
        elif cue.kind == "lookAway":
            tally = "excluded by design (11.0a)"
        else:
            tally = f"unknown cue kind {cue.kind!r}"
        rows.append(
            [
                str(cue.index),
                cue.kind,
                f"{cue.at_ms / 1000:.3f}",
                tally,
                delivered,
                processing,
                sampled,
            ]
        )
    return rows
