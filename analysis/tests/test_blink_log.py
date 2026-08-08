from pathlib import Path

import pytest

from blinklab.blink_log import BLINK_COLUMNS, load_blink_log

HEADER = ",".join(BLINK_COLUMNS)
META = (
    "# source: file\r\n"
    "# clip: a.mp4\r\n"
    "# measurement_mode: stepped\r\n"
    "# frames_measured: 5134\r\n"
)


def write(tmp_path: Path, body: str, name: str = "clip.blinks.csv") -> Path:
    path = tmp_path / name
    path.write_text(body, encoding="utf-8")
    return path


class TestReading:
    def test_reads_frames_and_timings(self, tmp_path: Path) -> None:
        body = META + HEADER + "\r\n374,382,6366.6,133.3,4.8,104.3,46.8\r\n"
        log = load_blink_log(write(tmp_path, body))
        assert len(log.blinks) == 1
        blink = log.blinks[0]
        assert (blink.start_frame, blink.end_frame) == (374, 382)
        assert blink.duration_ms == pytest.approx(133.3)
        assert blink.interval().start_frame == 374

    def test_knows_whether_every_frame_was_measured(
        self, tmp_path: Path
    ) -> None:
        # A watched run is capped by how fast the model happened to run
        # on that machine. Comparing a partial measurement against a
        # complete annotation would blame the detector for frames it
        # never saw, so an evaluation has to be able to tell.
        stepped = load_blink_log(
            write(tmp_path, META + HEADER + "\r\n1,4,10,50,1,1,1\r\n")
        )
        assert stepped.measured_completely is True
        assert stepped.frames_measured == 5134

        watched = load_blink_log(
            write(
                tmp_path,
                META.replace("stepped", "played")
                + HEADER
                + "\r\n1,4,10,50,1,1,1\r\n",
                name="b.blinks.csv",
            )
        )
        assert watched.measured_completely is False

    def test_a_log_with_no_blinks_is_readable_and_empty(
        self, tmp_path: Path
    ) -> None:
        # Zero blinks is a real result about a clip, unlike zero rows in
        # a session file. It must load so it can score zero recall
        # rather than vanish from the corpus.
        log = load_blink_log(write(tmp_path, META + HEADER + "\r\n"))
        assert log.blinks == []


class TestRefusals:
    def test_a_file_that_is_not_there(self, tmp_path: Path) -> None:
        with pytest.raises(ValueError, match="No blink log"):
            load_blink_log(tmp_path / "absent.csv")

    def test_an_empty_file(self, tmp_path: Path) -> None:
        with pytest.raises(ValueError, match="no header and no rows"):
            load_blink_log(write(tmp_path, META))

    def test_changed_columns(self, tmp_path: Path) -> None:
        with pytest.raises(ValueError, match="contract has changed"):
            load_blink_log(write(tmp_path, "startFrame,endFrame\r\n1,2\r\n"))

    def test_a_camera_session_is_refused_by_name(self, tmp_path: Path) -> None:
        # Frame columns are empty for a live camera. Dropping those rows
        # silently would report on whatever was left and call it a
        # result.
        body = META + HEADER + "\r\n,,10,50,1,1,1\r\n"
        with pytest.raises(ValueError, match="camera session"):
            load_blink_log(write(tmp_path, body))

    def test_a_blink_that_ends_before_it_starts(self, tmp_path: Path) -> None:
        body = META + HEADER + "\r\n40,10,10,50,1,1,1\r\n"
        with pytest.raises(ValueError, match="before it starts"):
            load_blink_log(write(tmp_path, body))

    def test_a_short_row(self, tmp_path: Path) -> None:
        with pytest.raises(ValueError, match="fields, expected"):
            load_blink_log(write(tmp_path, META + HEADER + "\r\n1,2\r\n"))
