"""Per-setup deliberate-blink matrix, roadmap 11.6.

One row per setup, aggregating that setup's cued sessions: the catch
rate with the Wilson interval every published proportion carries, the
latency band of the answered cues, the duration band of the measured
blinks, the closure-cue cell that says there is no closure event
stream rather than inventing a tally from the wrong column, and the
three rates — delivered, processing, sampled — that condition every
number beside them.

Scoring is NOT reimplemented here: ``cue_events.blink_cue_latencies``
is the one rule for what "caught" means, shared with the per-event
table, because two scorers are two boundaries one refactor away from
disagreeing.

The ABSENT rules are the row's own. The DSLR reads ABSENT until that
rig returns. Tablets and Android read volunteer-supplied or ABSENT:
the project owns neither, so a session there labelled owner-sourced
is mislabelled data and refused, never a new device class. And the
matrix DESCRIBES setups without explaining them — the mechanism
sentence below travels with every rendering of the table.
"""

from __future__ import annotations

from dataclasses import dataclass
from statistics import median

from .cue_events import blink_cue_latencies, response_window_ms, session_cues
from .stats import wilson_interval

MECHANISM_SENTENCE = (
    "Per-setup differences in this table are described, never explained: "
    "the mechanism stays explicitly open until the same clip stepped on "
    "each device (roadmap 15.4a) says whether a gap is the setup or the "
    "sampling."
)

HEADER = [
    "setup",
    "sessions",
    "blink cues caught",
    "latency band",
    "duration band",
    "long closures per cued closure",
    "delivered fps",
    "processing fps",
    "sampled fps",
]

# The setups the table must speak about even with no data, each with
# the sentence its absence prints. The DSLR is the owner's rig, away;
# tablets and Android the project does not own at all.
ABSENT_SETUPS: dict[str, str] = {
    "dslr": "ABSENT until that rig returns",
    "tablet": "ABSENT (volunteer-supplied when present)",
    "android": "ABSENT (volunteer-supplied when present)",
}

# Setups the project owns no hardware for: their sessions can only be
# volunteer-supplied, and the row's setup cell says so.
VOLUNTEER_ONLY = ("tablet", "android")

SOURCES = ("owner", "volunteer")


class MatrixError(ValueError):
    """Input that cannot honestly sit in this table."""


@dataclass(frozen=True)
class LabelledSession:
    """One cued session with the labels the exports do not carry.

    The setup name and the source are the caller's manifest, not the
    file's own metadata, because "which rig this was" includes facts
    (an external camera, a volunteer's device) no export records.
    """

    setup: str
    source: str
    metadata: dict[str, str]
    blink_times_ms: list[float]
    blink_durations_ms: list[float]


def _check(session: LabelledSession) -> None:
    if session.source not in SOURCES:
        raise MatrixError(
            f"source {session.source!r} on setup {session.setup!r}: only "
            f"{SOURCES} can be said honestly"
        )
    if session.setup in VOLUNTEER_ONLY and session.source != "volunteer":
        raise MatrixError(
            f"setup {session.setup!r} labelled {session.source!r}: the "
            "project owns no such hardware, so its sessions are "
            "volunteer-supplied or the label is wrong"
        )
    for duration in session.blink_durations_ms:
        if duration < 0:
            raise MatrixError(
                f"a blink duration of {duration} ms on setup "
                f"{session.setup!r}: a negative duration is damage, not "
                "a measurement"
            )


def _rate_cell(sessions: list[LabelledSession], key: str) -> str:
    values = sorted(
        {
            value
            for session in sessions
            if (value := session.metadata.get(key)) is not None
            and value != "unknown"
        }
    )
    return ", ".join(values) if values else "-"


def _catch_cell(caught: int, issued: int) -> str:
    low, high = wilson_interval(caught, issued)
    percent = round(caught / issued * 100)
    return (
        f"{caught}/{issued} ({percent}%, "
        f"{round(low * 100)}-{round(high * 100)}%)"
    )


def _setup_row(setup: str, sessions: list[LabelledSession]) -> list[str]:
    issued = 0
    caught_latencies: list[float] = []
    closure_cues = 0
    durations: list[float] = []
    for session in sessions:
        cues = session_cues(session.metadata)
        if cues is None:
            raise MatrixError(
                f"a session on setup {setup!r} carries no cue block: a "
                "session without the cued protocol cannot sit in the "
                "cued matrix (the censoring it exists to break)"
            )
        window = response_window_ms(session.metadata)
        latencies = blink_cue_latencies(cues, window, session.blink_times_ms)
        issued += len(latencies)
        caught_latencies.extend(
            latency for latency in latencies.values() if latency is not None
        )
        closure_cues += sum(
            1 for cue in cues if cue.kind in ("close3", "close20")
        )
        durations.extend(session.blink_durations_ms)
    label = setup
    if setup in VOLUNTEER_ONLY:
        label = f"{setup} (volunteer-supplied)"
    catch = (
        _catch_cell(len(caught_latencies), issued)
        if issued > 0
        else "no blink cues in these exports"
    )
    latency_band = (
        f"{min(caught_latencies):.0f}-{max(caught_latencies):.0f} ms"
        if caught_latencies
        else "no catches to time"
    )
    duration_band = (
        f"{median(durations):.0f} ms "
        f"({min(durations):.0f}-{max(durations):.0f})"
        if durations
        else "no measured blinks"
    )
    closures = (
        "no closure event stream in these exports (11.0a's ruling)"
        if closure_cues > 0
        else "no closure cues issued"
    )
    return [
        label,
        str(len(sessions)),
        catch,
        latency_band,
        duration_band,
        closures,
        _rate_cell(sessions, "camera_delivered_fps"),
        _rate_cell(sessions, "measured_fps"),
        _rate_cell(sessions, "sampled_fps"),
    ]


def _absent_row(setup: str, sentence: str) -> list[str]:
    return [setup, "0"] + [sentence] * (len(HEADER) - 2)


def matrix_rows(sessions: list[LabelledSession]) -> list[list[str]]:
    """The matrix, one row per setup, alphabetical, ABSENT rows kept.

    A required setup with no sessions still prints — its absence is a
    fact about the record, and a table that silently dropped the DSLR
    row would read as a table that never owed one.
    """
    for session in sessions:
        _check(session)
    by_setup: dict[str, list[LabelledSession]] = {}
    for session in sessions:
        by_setup.setdefault(session.setup, []).append(session)
    rows = [_setup_row(setup, grouped) for setup, grouped in by_setup.items()]
    rows.extend(
        _absent_row(setup, sentence)
        for setup, sentence in ABSENT_SETUPS.items()
        if setup not in by_setup
    )
    rows.sort(key=lambda row: row[0])
    return rows
