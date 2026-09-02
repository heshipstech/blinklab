"""The UTA-RLDD prep tool's path parsing, which decides which subject and
which label every video is filed under. Getting this wrong would silently
mislabel the training data, so it is pinned. The transcode itself calls
ffmpeg and is not exercised here; the mapping is."""

from __future__ import annotations

from pathlib import Path

from tools.prepare_rldd import (
    fold_of,
    label_of,
    plan_clip,
    plan_corpus,
    subject_of,
)


def _make(root: Path, relative: str) -> Path:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"")
    return path


class TestLabelOf:
    def test_reads_the_kss_codes(self) -> None:
        assert label_of(Path("Fold1/7/0.mp4")) == "alert"
        assert label_of(Path("Fold1/7/5.mp4")) == "lowvigilant"
        assert label_of(Path("Fold1/7/10.mp4")) == "drowsy"

    def test_falls_back_to_keywords_in_the_path(self) -> None:
        assert label_of(Path("subject7/drowsy_take.mov")) == "drowsy"
        assert label_of(Path("subject7/alert.mov")) == "alert"
        assert label_of(Path("s7/low-vigilant.mov")) == "lowvigilant"

    def test_returns_none_for_an_unreadable_label(self) -> None:
        # No safe default: better a named skip than a mislabelled video.
        assert label_of(Path("Fold1/7/clip_003.mp4")) is None


class TestFoldAndSubject:
    def test_finds_the_fold_number(self, tmp_path: Path) -> None:
        root = tmp_path
        assert fold_of(root / "Fold3" / "7" / "0.mp4", root) == 3
        assert fold_of(root / "fold_04" / "7" / "0.mp4", root) == 4
        assert fold_of(root / "no-fold-here" / "0.mp4", root) is None

    def test_subject_id_carries_the_fold_for_uniqueness(self) -> None:
        # Subject "7" in fold 1 and fold 2 are different people, and
        # leave-one-subject-out must never put one person in two groups.
        assert subject_of(Path("Fold1/7/0.mp4"), 1) == "f1s7"
        assert subject_of(Path("Fold2/7/0.mp4"), 2) == "f2s7"
        assert subject_of(Path("loose/7/0.mp4"), None) == "s7"


class TestPlanClip:
    def test_names_the_output_from_subject_and_label(self) -> None:
        plan = plan_clip(Path("root/Fold1/7/10.mp4"), Path("root"))
        assert plan is not None
        assert plan.subject == "f1s7"
        assert plan.label == "drowsy"
        assert plan.output_name == "f1s7_drowsy.mp4"

    def test_returns_none_when_the_label_cannot_be_read(self) -> None:
        assert plan_clip(Path("root/Fold1/7/notes.mp4"), Path("root")) is None


class TestPlanCorpus:
    def _tree(self, root: Path) -> None:
        for fold in (1, 2):
            for subject in (1, 2):
                for code in ("0", "5", "10"):
                    _make(root, f"Fold{fold}/{subject}/{code}.mp4")
        _make(root, "Fold1/1/readme.txt")  # not a video
        _make(root, "Fold1/2/bloopers.mp4")  # a video with no label

    def test_plans_every_labelled_video_and_reports_skips(
        self, tmp_path: Path
    ) -> None:
        self._tree(tmp_path)
        plans, skipped = plan_corpus(tmp_path, None)
        # 2 folds x 2 subjects x 3 labels = 12 labelled videos.
        assert len(plans) == 12
        assert len({p.subject for p in plans}) == 4
        # The unlabelled video is skipped, the .txt is ignored entirely.
        assert [s.name for s in skipped] == ["bloopers.mp4"]

    def test_fold_filter_selects_the_pilot(self, tmp_path: Path) -> None:
        self._tree(tmp_path)
        plans, _ = plan_corpus(tmp_path, only_fold=1)
        assert len(plans) == 6
        assert {p.fold for p in plans} == {1}
        assert {p.label for p in plans} == {"alert", "lowvigilant", "drowsy"}

    def test_is_reproducible_in_sorted_order(self, tmp_path: Path) -> None:
        self._tree(tmp_path)
        first, _ = plan_corpus(tmp_path, None)
        second, _ = plan_corpus(tmp_path, None)
        assert [p.output_name for p in first] == [
            p.output_name for p in second
        ]
