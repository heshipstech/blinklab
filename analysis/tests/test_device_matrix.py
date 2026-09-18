"""The per-setup deliberate-blink matrix, roadmap 11.6.

The report tool's tests, failing first on ADVERSARIAL synthetics: a
blink event sitting inside two cue windows must count once, a latency
on the window's edge is caught while one past it is missed, a plain
session cannot sit in a cued matrix, a self-disagreeing cue block is
refused by the cue reader's own error, and an absurd duration outlier
prints honestly rather than being trimmed. The ABSENT rules are the
row's own: the DSLR reads ABSENT until that rig returns, and tablets
and Android read volunteer-supplied or ABSENT.
"""

from __future__ import annotations

import pytest

from blinklab.cue_events import CueError
from blinklab.device_matrix import (
    MECHANISM_SENTENCE,
    LabelledSession,
    MatrixError,
    matrix_rows,
)


def cued_metadata(
    cues: list[tuple[str, float]],
    window_ms: float = 1000.0,
    delivered: str = "29.8",
    processing: str = "29.8",
    sampled: str = "29.8",
) -> dict[str, str]:
    metadata = {
        "cue_protocol_start_ms": "10000",
        "cue_response_window_ms": str(window_ms),
        "cues": str(len(cues)),
        "camera_delivered_fps": delivered,
        "measured_fps": processing,
        "sampled_fps": sampled,
    }
    for index, (kind, seconds) in enumerate(cues, start=1):
        metadata[f"cue_{index}_kind"] = kind
        metadata[f"cue_{index}_seconds"] = str(seconds)
    return metadata


def session(
    setup: str = "macbook-pro-builtin",
    source: str = "owner",
    cues: list[tuple[str, float]] | None = None,
    blink_times_ms: list[float] | None = None,
    durations_ms: list[float] | None = None,
    **metadata_kwargs: str,
) -> LabelledSession:
    if cues is None:
        cues = [("blink", 5.0), ("blink", 15.0)]
    return LabelledSession(
        setup=setup,
        source=source,
        metadata=cued_metadata(cues, **metadata_kwargs),
        blink_times_ms=blink_times_ms if blink_times_ms is not None else [],
        blink_durations_ms=durations_ms if durations_ms is not None else [],
    )


def row_for(rows: list[list[str]], setup_prefix: str) -> list[str]:
    for row in rows:
        if row[0].startswith(setup_prefix):
            return row
    raise AssertionError(f"no row starting {setup_prefix!r}")


class TestCatchScoring:
    def test_catch_cell_counts_over_cues_with_a_wilson_interval(self) -> None:
        # Two blink cues at 15 s and 25 s on the record clock; one
        # answered 200 ms after the first cue.
        rows = matrix_rows(
            [session(blink_times_ms=[15200.0], durations_ms=[100.0])]
        )
        row = row_for(rows, "macbook")
        assert row[2] == "1/2 (50%, 9-91%)"

    def test_one_blink_event_cannot_answer_two_cues(self) -> None:
        # ADVERSARIAL: cues 500 ms apart share a 1000 ms window, and a
        # single event sits inside both. Counting it twice would read
        # 2/2; the one-event-per-cue rule reads 1/2.
        rows = matrix_rows(
            [
                session(
                    cues=[("blink", 5.0), ("blink", 5.5)],
                    blink_times_ms=[15600.0],
                )
            ]
        )
        row = row_for(rows, "macbook")
        assert row[2].startswith("1/2")

    def test_the_window_edge_is_inclusive_and_one_past_it_is_out(self) -> None:
        caught = matrix_rows(
            [session(cues=[("blink", 5.0)], blink_times_ms=[16000.0])]
        )
        missed = matrix_rows(
            [session(cues=[("blink", 5.0)], blink_times_ms=[16001.0])]
        )
        assert row_for(caught, "macbook")[2].startswith("1/1")
        assert row_for(missed, "macbook")[2].startswith("0/1")

    def test_zero_of_n_still_carries_an_interval(self) -> None:
        # 0/2 is what the sessions support, not certainty of failure.
        rows = matrix_rows([session()])
        row = row_for(rows, "macbook")
        assert row[2].startswith("0/2 (0%, ")
        assert row[2] != "0/2 (0%, 0-0%)"


class TestLatencyAndDurationBands:
    def test_latency_band_spans_the_caught_latencies(self) -> None:
        rows = matrix_rows(
            [
                session(
                    cues=[("blink", 5.0), ("blink", 15.0)],
                    blink_times_ms=[15120.0, 25340.0],
                )
            ]
        )
        row = row_for(rows, "macbook")
        assert row[3] == "120-340 ms"

    def test_no_catches_says_so_rather_than_timing_nothing(self) -> None:
        rows = matrix_rows([session()])
        assert row_for(rows, "macbook")[3] == "no catches to time"

    def test_duration_band_keeps_the_outlier(self) -> None:
        # ADVERSARIAL: a 6-second "blink" is damage or a discovery,
        # and either way trimming it would hide it.
        rows = matrix_rows([session(durations_ms=[80.0, 90.0, 6000.0])])
        assert row_for(rows, "macbook")[4] == "90 ms (80-6000)"

    def test_a_negative_duration_is_refused_by_name(self) -> None:
        with pytest.raises(MatrixError, match="duration"):
            matrix_rows([session(durations_ms=[-5.0])])


class TestRatesOnEveryRow:
    def test_every_data_row_prints_the_three_rates(self) -> None:
        rows = matrix_rows([session()])
        row = row_for(rows, "macbook")
        assert row[6] == "29.8"
        assert row[7] == "29.8"
        assert row[8] == "29.8"

    def test_missing_rates_read_as_a_dash_never_a_number(self) -> None:
        rows = matrix_rows(
            [session(delivered="unknown", processing="7.0", sampled="7.0")]
        )
        row = row_for(rows, "macbook")
        assert row[6] == "-"

    def test_two_sessions_rates_are_listed_not_averaged(self) -> None:
        rows = matrix_rows([session(sampled="29.8"), session(sampled="12.0")])
        row = row_for(rows, "macbook")
        assert row[8] == "12.0, 29.8"


class TestRefusals:
    def test_a_session_without_the_cued_protocol_cannot_join(self) -> None:
        plain = LabelledSession(
            setup="macbook-pro-builtin",
            source="owner",
            metadata={"sampled_fps": "29.8"},
            blink_times_ms=[],
            blink_durations_ms=[],
        )
        with pytest.raises(MatrixError, match="cued"):
            matrix_rows([plain])

    def test_a_self_disagreeing_cue_block_is_refused(self) -> None:
        broken = session()
        broken.metadata["cues"] = "3"
        with pytest.raises(CueError):
            matrix_rows([broken])

    def test_an_unknown_source_is_refused(self) -> None:
        with pytest.raises(MatrixError, match="source"):
            matrix_rows([session(source="somebody")])


class TestAbsentColumns:
    def test_the_dslr_reads_absent_until_the_rig_returns(self) -> None:
        rows = matrix_rows([session()])
        row = row_for(rows, "dslr")
        assert row[1] == "0"
        assert "ABSENT" in row[2]
        assert "rig" in row[2]

    def test_tablet_and_android_read_absent_without_volunteers(self) -> None:
        rows = matrix_rows([session()])
        for setup in ("tablet", "android"):
            row = row_for(rows, setup)
            assert "ABSENT" in row[2]
            assert "volunteer" in row[2]

    def test_a_volunteer_android_session_is_labelled_as_such(self) -> None:
        rows = matrix_rows([session(setup="android", source="volunteer")])
        row = row_for(rows, "android")
        assert "volunteer-supplied" in row[0]

    def test_an_owner_android_session_is_a_labelling_error(self) -> None:
        # The project owns no Android hardware; an owner-sourced
        # Android session is mislabelled data, not a new device class.
        with pytest.raises(MatrixError, match="volunteer"):
            matrix_rows([session(setup="android", source="owner")])


class TestClosureCuesAndMechanism:
    def test_closure_cues_say_there_is_no_event_stream(self) -> None:
        rows = matrix_rows([session(cues=[("blink", 5.0), ("close3", 15.0)])])
        row = row_for(rows, "macbook")
        assert "no closure event stream" in row[5]

    def test_without_closure_cues_the_cell_says_none_were_issued(self) -> None:
        rows = matrix_rows([session()])
        assert row_for(rows, "macbook")[5] == "no closure cues issued"

    def test_the_mechanism_stays_explicitly_open(self) -> None:
        assert "described, never explained" in MECHANISM_SENTENCE
        assert "15.4a" in MECHANISM_SENTENCE
