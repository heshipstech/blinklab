import os
from pathlib import Path

import pytest

from blinklab.eyeblink8 import load_annotation, load_corpus

HEADER = "#eye-blink annotation file version 1.1\n#glasses: NO\n#start\n"


def row(frame: int, blink_id: int, left: str = "X", right: str = "X") -> str:
    """One annotation line in the real nineteen field shape."""
    return ":".join(
        [
            str(frame),
            str(blink_id),
            "X",
            left,
            "X",
            right,
            "X",
            "236",
            "196",
            "142",
            "133",
            "257",
            "218",
            "281",
            "217",
            "320",
            "217",
            "344",
            "216",
        ]
    )


def write(tmp_path: Path, body: str, name: str = "clip.tag") -> Path:
    path = tmp_path / name
    path.write_text(body, encoding="utf-8")
    return path


class TestReadingBlinks:
    def test_groups_consecutive_frames_into_one_blink(
        self, tmp_path: Path
    ) -> None:
        # The central fact of this format: a blink is a RUN of frames
        # sharing an id, not a single instant. Counting rows instead of
        # runs would report five blinks here rather than one.
        body = HEADER + "\n".join(
            [
                row(0, -1),
                row(1, 1),
                row(2, 1, left="C"),
                row(3, 1, left="C"),
                row(4, 1),
                row(5, -1),
            ]
        )
        annotation = load_annotation(write(tmp_path, body))
        assert len(annotation.blinks) == 1
        blink = annotation.blinks[0]
        assert (blink.start_frame, blink.end_frame) == (1, 4)
        assert blink.frame_count == 4
        assert blink.fully_closed_frames == 2

    def test_separates_two_blinks_with_different_ids(
        self, tmp_path: Path
    ) -> None:
        body = HEADER + "\n".join(
            [row(0, 1), row(1, 1), row(2, -1), row(3, 2), row(4, 2)]
        )
        annotation = load_annotation(write(tmp_path, body))
        assert [(b.start_frame, b.end_frame) for b in annotation.blinks] == [
            (0, 1),
            (3, 4),
        ]

    def test_counts_a_closure_marked_on_either_eye(
        self, tmp_path: Path
    ) -> None:
        # A blink annotated on only one eye is still a blink.
        body = HEADER + "\n".join([row(0, 1, right="C"), row(1, 1)])
        annotation = load_annotation(write(tmp_path, body))
        assert annotation.blinks[0].fully_closed_frames == 1

    def test_frame_count_is_the_last_frame_plus_one(
        self, tmp_path: Path
    ) -> None:
        # Frames are zero indexed, so a file ending at frame 4 describes
        # five frames. An off by one here would misalign every
        # comparison against the video by one frame.
        body = HEADER + "\n".join([row(index, -1) for index in range(5)])
        assert load_annotation(write(tmp_path, body)).frame_count == 5

    def test_reads_the_glasses_flag(self, tmp_path: Path) -> None:
        # Worth having separately: the project's own owner wears strong
        # prescription glasses, so per clip results should be readable
        # split by this.
        body = "#glasses: YES\n#start\n" + row(0, -1)
        assert load_annotation(write(tmp_path, body)).wears_glasses is True

    def test_ignores_the_free_text_message_block(self, tmp_path: Path) -> None:
        body = (
            "#glasses: NO\n#message start\nnot: a header line\n"
            "#message end\n#start\n" + row(0, -1)
        )
        annotation = load_annotation(write(tmp_path, body))
        assert "not" not in annotation.header
        assert annotation.wears_glasses is False


class TestRefusals:
    def test_a_file_that_is_not_there(self, tmp_path: Path) -> None:
        with pytest.raises(ValueError, match="No annotation file"):
            load_annotation(tmp_path / "absent.tag")

    def test_no_start_line(self, tmp_path: Path) -> None:
        with pytest.raises(ValueError, match="no '#start' line"):
            load_annotation(write(tmp_path, "#glasses: NO\n" + row(0, -1)))

    def test_a_start_line_with_nothing_after_it(self, tmp_path: Path) -> None:
        # An empty result is the most dangerous shape: every downstream
        # metric still computes and every one of them is meaningless.
        with pytest.raises(ValueError, match="no annotation rows"):
            load_annotation(write(tmp_path, HEADER))

    def test_wrong_field_count(self, tmp_path: Path) -> None:
        with pytest.raises(ValueError, match="19 colon-separated fields"):
            load_annotation(write(tmp_path, HEADER + "0:-1:X:X\n"))

    def test_a_frame_id_that_is_not_a_number(self, tmp_path: Path) -> None:
        broken = row(0, -1).replace("0:-1:", "zero:-1:", 1)
        with pytest.raises(ValueError, match="whole numbers"):
            load_annotation(write(tmp_path, HEADER + broken))

    def test_a_frame_annotated_twice(self, tmp_path: Path) -> None:
        body = HEADER + "\n".join([row(3, -1), row(3, 1)])
        with pytest.raises(ValueError, match="annotated more than once"):
            load_annotation(write(tmp_path, body))

    def test_a_blink_interval_with_a_hole_in_it(self, tmp_path: Path) -> None:
        # Frames 1 and 4 share an id but 2 and 3 do not. Either the file
        # means one long blink or two short ones, and guessing would put
        # an invented interval into the ground truth.
        body = HEADER + "\n".join(
            [row(1, 1), row(2, -1), row(3, -1), row(4, 1)]
        )
        with pytest.raises(ValueError, match="the interval has a gap"):
            load_annotation(write(tmp_path, body))

    def test_a_corpus_directory_with_no_annotations(
        self, tmp_path: Path
    ) -> None:
        with pytest.raises(ValueError, match="No .tag annotation files"):
            load_corpus(tmp_path)


class TestTheRealCorpus:
    """Skipped unless the corpus has been prepared locally.

    The videos are 300 MB and cannot be committed, so these run on a
    developer machine and are absent in continuous integration. That is
    stated here rather than hidden, because a test that silently skips
    is a test that silently stops protecting anything.
    """

    # Read from the environment, never hardcoded. A path baked into a
    # public repository leaks whose machine it is and where their files
    # live, and it works for exactly one person.
    #
    #   BLINKLAB_EYEBLINK8=/path/to/eyeblink8 uv run pytest
    ROOT = Path(os.environ.get("BLINKLAB_EYEBLINK8", "/nonexistent"))

    @pytest.mark.skipif(
        not ROOT.exists(),
        reason="set BLINKLAB_EYEBLINK8 to run against the real corpus",
    )
    def test_reads_all_eight_clips(self) -> None:
        corpus = load_corpus(self.ROOT)
        assert len(corpus) == 8
        assert sum(len(a.blinks) for a in corpus) == 408
        # One clip is annotated as glasses, which matters because this
        # project's known weak spot is strong prescription lenses.
        assert sum(1 for a in corpus if a.wears_glasses) == 1

    @pytest.mark.skipif(
        not ROOT.exists(),
        reason="set BLINKLAB_EYEBLINK8 to run against the real corpus",
    )
    def test_every_blink_is_a_plausible_length(self) -> None:
        # A blink that lasted one frame or several seconds would mean
        # the grouping is being read wrongly.
        for annotation in load_corpus(self.ROOT):
            for blink in annotation.blinks:
                assert 2 <= blink.frame_count <= 60
