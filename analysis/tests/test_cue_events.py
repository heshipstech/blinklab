"""The cued protocol's per-event table, roadmap 11.0b.

The schedule is read OUT OF THE FILE — the cue rows sessionMetadata
writes — never out of this repository's constants: a scaled test run
scores against its own scaled times, and a schedule change scores old
files against what those files actually asked.
"""

import pytest

from blinklab.cue_events import CueError, cue_event_rows, session_cues


def meta(**extra: str) -> dict[str, str]:
    base = {
        "cue_protocol_start_ms": "10000",
        "cue_response_window_ms": "2000",
        "cues": "3",
        "cue_1_kind": "blink",
        "cue_1_seconds": "30.000",
        "cue_2_kind": "close3",
        "cue_2_seconds": "35.000",
        "cue_3_kind": "lookAway",
        "cue_3_seconds": "42.000",
        "camera_delivered_fps": "29.9",
        "measured_fps": "30.00",
        "sampled_fps": "29.8",
    }
    base.update(extra)
    return base


class TestReadingTheScheduleBack:
    def test_no_start_means_no_protocol_and_no_table(self) -> None:
        # Absence is an ordinary session, never damage: the exporter
        # writes the block only when the protocol ran.
        assert session_cues({}) is None
        assert cue_event_rows({}, []) is None

    def test_cue_times_land_on_the_record_clock(self) -> None:
        cues = session_cues(meta())
        assert cues is not None
        # 10000 ms start + 30 s into the protocol.
        assert cues[0].at_ms == 40000.0
        assert cues[0].kind == "blink"

    def test_a_declared_count_the_rows_do_not_carry_is_refused(self) -> None:
        # The markers precedent: a file that says three and carries two
        # has lost one, and which one cannot be known from here.
        broken = meta()
        del broken["cue_3_kind"]
        with pytest.raises(CueError, match="cue 3"):
            session_cues(broken)

    def test_a_protocol_block_missing_its_window_is_refused(self) -> None:
        broken = meta()
        del broken["cue_response_window_ms"]
        with pytest.raises(CueError, match="window"):
            session_cues(broken)


class TestTheTally:
    def test_a_blink_inside_the_window_is_caught_with_its_latency(
        self,
    ) -> None:
        rows = cue_event_rows(meta(), [40500.0])
        assert rows is not None
        blink_row = rows[0]
        assert blink_row[1] == "blink"
        assert "caught" in blink_row[3]
        assert "500" in blink_row[3]

    def test_a_blink_outside_the_window_is_a_miss(self) -> None:
        rows = cue_event_rows(meta(), [43000.0])
        assert rows is not None
        assert "missed" in rows[0][3]

    def test_one_event_catches_at_most_one_cue(self) -> None:
        # Two blink cues, one event: the second cue must not reuse it.
        two = meta(
            cues="2",
            cue_1_kind="blink",
            cue_1_seconds="30.000",
            cue_2_kind="blink",
            cue_2_seconds="31.000",
            cue_3_kind="",
            cue_3_seconds="",
        )
        del two["cue_3_kind"]
        del two["cue_3_seconds"]
        rows = cue_event_rows(two, [40500.0])
        assert rows is not None
        tallies = [row[3] for row in rows]
        assert sum("caught" in tally for tally in tallies) == 1

    def test_closures_and_the_look_away_say_why_they_have_no_tally(
        self,
    ) -> None:
        rows = cue_event_rows(meta(), [])
        assert rows is not None
        close_row = rows[1]
        assert close_row[1] == "close3"
        assert "13.3" in close_row[3]
        look_row = rows[2]
        assert "excluded" in look_row[3]

    def test_every_tally_carries_the_three_rates_beside_it(self) -> None:
        # The row's Check, verbatim: delivered rate, processing rate
        # and sampled fps beside EVERY tally.
        rows = cue_event_rows(meta(), [])
        assert rows is not None
        for row in rows:
            assert row[4] == "29.9"
            assert row[5] == "30.00"
            assert row[6] == "29.8"

    def test_an_unknown_rate_prints_as_a_dash_not_a_guess(self) -> None:
        thin = meta()
        del thin["camera_delivered_fps"]
        rows = cue_event_rows(thin, [])
        assert rows is not None
        assert rows[0][4] == "-"
