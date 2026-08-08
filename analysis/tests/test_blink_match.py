import pytest

from blinklab.blink_match import Interval, combine, match_blinks


def i(start: int, end: int) -> Interval:
    return Interval(start_frame=start, end_frame=end)


class TestTheMatchingRule:
    def test_an_overlapping_detection_counts(self) -> None:
        result = match_blinks([i(10, 14)], [i(11, 16)])
        assert (result.true_positives, result.false_positives) == (1, 0)
        assert result.false_negatives == 0

    def test_a_detection_nowhere_near_anything_is_invented(self) -> None:
        result = match_blinks([i(500, 504)], [i(10, 14)])
        assert result.true_positives == 0
        assert result.false_positives == 1
        assert result.false_negatives == 1

    def test_tolerance_forgives_disagreement_about_the_edges(self) -> None:
        # A detector reports the reopening; an annotator marks the whole
        # closure. Three frames apart is not a missed blink.
        assert match_blinks([i(20, 21)], [i(14, 17)]).true_positives == 1
        # Far enough away and it is a different event.
        assert match_blinks([i(40, 41)], [i(14, 17)]).true_positives == 0

    def test_tolerance_of_zero_demands_real_overlap(self) -> None:
        assert (
            match_blinks(
                [i(20, 21)], [i(14, 17)], tolerance_frames=0
            ).true_positives
            == 0
        )

    def test_a_negative_tolerance_is_refused(self) -> None:
        with pytest.raises(ValueError, match="cannot be negative"):
            match_blinks([], [], tolerance_frames=-1)


class TestOneToOne:
    def test_two_detections_on_one_blink_leave_one_invented(self) -> None:
        # The rule that stops the evaluation being rigged. Without it a
        # detector that fires constantly scores perfect recall.
        result = match_blinks([i(10, 11), i(12, 13)], [i(10, 14)])
        assert result.true_positives == 1
        assert result.false_positives == 1
        assert result.recall == 1.0
        assert result.precision == 0.5

    def test_one_detection_cannot_claim_two_blinks(self) -> None:
        # A detection spanning two real blinks is credited with one and
        # the other is a miss, because it did not separate them.
        result = match_blinks([i(10, 40)], [i(11, 14), i(30, 34)])
        assert result.true_positives == 1
        assert result.false_negatives == 1

    def test_a_detector_that_fires_on_everything_scores_badly(self) -> None:
        # The rigging test, stated as an outcome. Five hundred
        # detections over five real blinks must not look good.
        detected = [i(n, n) for n in range(0, 500)]
        annotated = [i(10, 14), i(100, 104), i(200, 204), i(300, 304)]
        result = match_blinks(detected, annotated)
        assert result.recall == 1.0
        assert result.precision is not None
        assert result.precision < 0.01
        assert result.f1 is not None
        assert result.f1 < 0.02

    def test_best_overlap_wins_not_the_earliest(self) -> None:
        # A poor early detection must not claim an annotation that a
        # later, near-exact one covers, or one good detection and one
        # bad become two mediocre outcomes.
        result = match_blinks(
            [i(8, 10), i(10, 14)], [i(10, 14)], tolerance_frames=0
        )
        assert result.pairs == [(1, 0)]
        assert result.true_positives == 1


class TestTheNumbers:
    def test_recall_and_precision_on_a_mixed_result(self) -> None:
        detected = [i(10, 14), i(100, 104), i(900, 904)]
        annotated = [i(10, 14), i(100, 104), i(200, 204), i(300, 304)]
        result = match_blinks(detected, annotated)
        assert result.true_positives == 2
        assert result.false_positives == 1
        assert result.false_negatives == 2
        assert result.precision == pytest.approx(2 / 3)
        assert result.recall == pytest.approx(0.5)
        assert result.f1 == pytest.approx(2 * (2 / 3) * 0.5 / ((2 / 3) + 0.5))

    def test_a_clip_with_no_blinks_reports_no_recall_rather_than_zero(
        self,
    ) -> None:
        # None, not 0.0 and not 1.0. A clip with nothing to find says
        # nothing about whether the instrument can find things, and a
        # number would let empty clips move the headline figure.
        assert match_blinks([], []).recall is None
        assert match_blinks([], []).precision is None
        assert match_blinks([], []).f1 is None

    def test_finding_nothing_at_all_is_zero_recall_not_undefined(
        self,
    ) -> None:
        result = match_blinks([], [i(10, 14)])
        assert result.recall == 0.0
        assert result.precision is None


class TestCombining:
    def test_pools_counts_rather_than_averaging_rates(self) -> None:
        # A three blink clip must not carry the same weight as an
        # eighty-eight blink one, which is how a corpus is made to look
        # better than it is.
        small = match_blinks([i(0, 2)], [i(0, 2)])
        large = match_blinks([], [i(n, n + 2) for n in range(0, 300, 10)])
        pooled = combine([small, large])
        assert pooled.true_positives == 1
        assert pooled.false_negatives == 30
        assert pooled.recall == pytest.approx(1 / 31)
        # The dishonest version, averaging the two clips' recalls,
        # would have reported 50 percent.
        assert pooled.recall is not None
        assert pooled.recall < 0.05


class TestIntervalItself:
    def test_an_interval_that_ends_before_it_starts_is_refused(self) -> None:
        with pytest.raises(ValueError, match="ends before it starts"):
            Interval(start_frame=10, end_frame=4)

    def test_a_single_frame_interval_is_one_frame_long(self) -> None:
        assert i(7, 7).overlap(i(7, 7)) == 1
