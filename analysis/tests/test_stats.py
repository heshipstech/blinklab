"""Tests for the rank statistics behind the DROZY analysis.

These are the arithmetic the conclusions rest on, so they are checked
against hand worked cases and against the known failure modes, not only
against themselves.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from blinklab.stats import (
    BootstrapInterval,
    Corrected,
    binomial_at_least,
    holm,
    permutation_p,
    ranks,
    spearman,
    subject_bootstrap,
    wilson_interval,
)


def _pooled_mean(subjects: list[list[float]]) -> float:
    """Mean over every row of every subject in the resample."""
    rows = [value for subject in subjects for value in subject]
    return sum(rows) / len(rows)


class TestRanks:
    def test_ranks_a_simple_list(self) -> None:
        assert ranks([10.0, 30.0, 20.0]) == [1.0, 3.0, 2.0]

    def test_ties_share_the_average_position(self) -> None:
        # Two values tied for positions 2 and 3 both get 2.5. This is the
        # normal case on a 1 to 9 scale over twenty sessions, not an edge
        # case, and breaking ties arbitrarily would invent an ordering
        # the data does not contain.
        assert ranks([1.0, 5.0, 5.0, 9.0]) == [1.0, 2.5, 2.5, 4.0]

    def test_all_tied(self) -> None:
        assert ranks([7.0, 7.0, 7.0]) == [2.0, 2.0, 2.0]


class TestSpearman:
    def test_perfect_agreement(self) -> None:
        assert spearman([1.0, 2.0, 3.0, 4.0], [10.0, 20.0, 30.0, 40.0]) == 1.0

    def test_perfect_disagreement(self) -> None:
        assert spearman([1.0, 2.0, 3.0, 4.0], [40.0, 30.0, 20.0, 10.0]) == -1.0

    def test_monotonic_but_not_linear_still_scores_one(self) -> None:
        # This is why the analysis is rank based. A curve that always
        # rises is a perfect rank correlation even though a straight line
        # fits it badly.
        assert spearman([1.0, 2.0, 3.0, 4.0], [1.0, 4.0, 9.0, 16.0]) == 1.0

    def test_ties_do_not_break_it(self) -> None:
        # The textbook shortcut with the 6*d^2 term is WRONG with ties and
        # would return something above 1 here. Computing Pearson on the
        # ranks is correct and is what this does.
        rho = spearman([1.0, 2.0, 2.0, 3.0], [1.0, 2.0, 3.0, 4.0])
        assert -1.0 <= rho <= 1.0
        assert rho == pytest.approx(0.9486, abs=0.001)

    def test_a_flat_variable_returns_zero_rather_than_failing(self) -> None:
        # If every session scored the same KSS there is no correlation to
        # find. Zero is the honest answer. NaN would propagate silently
        # into a report and an exception would stop a run over a
        # non-problem.
        assert spearman([1.0, 2.0, 3.0], [5.0, 5.0, 5.0]) == 0.0

    def test_refuses_too_few_points(self) -> None:
        with pytest.raises(ValueError):
            spearman([1.0, 2.0], [1.0, 2.0])

    def test_refuses_mismatched_lengths(self) -> None:
        with pytest.raises(ValueError):
            spearman([1.0, 2.0, 3.0], [1.0, 2.0])


class TestPermutationP:
    def test_a_perfect_correlation_is_rare_by_chance(self) -> None:
        xs = [float(i) for i in range(8)]
        p = permutation_p(xs, xs, iterations=2000)
        assert p < 0.01

    def test_noise_is_not_significant(self) -> None:
        xs = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0]
        ys = [3.0, 1.0, 4.0, 1.0, 5.0, 9.0, 2.0, 6.0]
        assert permutation_p(xs, ys, iterations=2000) > 0.05

    def test_never_returns_exactly_zero(self) -> None:
        # Ten thousand shuffles cannot establish that something is
        # impossible, so the smallest reportable p is 1/(iterations+1).
        xs = [float(i) for i in range(10)]
        assert permutation_p(xs, xs, iterations=1000) > 0

    def test_is_reproducible(self) -> None:
        xs = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]
        ys = [2.0, 1.0, 4.0, 3.0, 6.0, 5.0]
        first = permutation_p(xs, ys, iterations=500, seed=7)
        second = permutation_p(xs, ys, iterations=500, seed=7)
        assert first == second


class TestHolm:
    def test_corrects_and_keeps_the_raw_value(self) -> None:
        out = holm([("a", 0.9, 0.001, 20), ("b", 0.1, 0.5, 20)])
        assert [c.name for c in out] == ["a", "b"]
        assert out[0].p_raw == 0.001
        assert out[0].p_holm == pytest.approx(0.002)

    def test_is_monotonic(self) -> None:
        # A corrected p must never fall below the one ranked ahead of it,
        # or a weaker result could print as stronger than a better one.
        out = holm(
            [
                ("a", 0.9, 0.01, 20),
                ("b", 0.8, 0.02, 20),
                ("c", 0.7, 0.03, 20),
                ("d", 0.6, 0.04, 20),
            ]
        )
        values = [c.p_holm for c in out]
        assert values == sorted(values)

    def test_never_exceeds_one(self) -> None:
        out = holm([("a", 0.1, 0.9, 20), ("b", 0.1, 0.95, 20)])
        assert all(c.p_holm <= 1.0 for c in out)

    def test_a_single_test_is_uncorrected(self) -> None:
        out = holm([("only", 0.5, 0.04, 20)])
        assert out[0].p_holm == pytest.approx(0.04)

    def test_returns_the_declared_type(self) -> None:
        out = holm([("a", 0.5, 0.04, 20)])
        assert isinstance(out[0], Corrected)


class TestWilsonInterval:
    """The interval a counted proportion is entitled to.

    Roadmap 10.10c1, ladder B8. Every headline in this project is a
    count over a count — 341 blinks found of 408 annotated, 0 sound
    sessions of 3 — and every one of them was published as a single
    percentage. A percentage with no interval invites the reader to
    treat 83.6% as the answer rather than as one draw from a corpus
    of eight clips.

    Wilson rather than the textbook normal approximation, and the
    reason is the second case above. The normal approximation on 0 of
    3 gives the interval [0, 0]: it says the detector is certainly
    perfect at failing, from three observations. Wilson gives 0 to
    56%, which is what three observations actually support.
    """

    def test_it_reproduces_the_published_recall_interval(self) -> None:
        # The number the README publishes beside 341 of 408.
        low, high = wilson_interval(341, 408)
        assert round(low * 100, 1) == 79.7
        assert round(high * 100, 1) == 86.9

    def test_a_zero_count_still_has_an_upper_bound(self) -> None:
        # Validation criterion 1: 0 of 3 sessions cleared it. The
        # honest statement is not "0%", it is "somewhere below 56%".
        low, high = wilson_interval(0, 3)
        assert low == 0.0
        assert round(high * 100, 1) == 56.1

    def test_a_perfect_count_still_has_a_lower_bound(self) -> None:
        # The mirror image, and the other case the normal
        # approximation gets wrong: 3 of 3 is not certainty.
        low, high = wilson_interval(3, 3)
        assert round(low * 100, 1) == 43.9
        assert high == 1.0

    def test_more_trials_narrow_the_interval(self) -> None:
        # The property that makes it worth printing at all.
        narrow = wilson_interval(800, 1000)
        wide = wilson_interval(8, 10)
        assert (narrow[1] - narrow[0]) < (wide[1] - wide[0])

    def test_the_interval_contains_the_point(self) -> None:
        for successes, trials in ((341, 408), (65, 406), (0, 3), (3, 3)):
            low, high = wilson_interval(successes, trials)
            assert low <= successes / trials <= high

    def test_a_wider_confidence_gives_a_wider_interval(self) -> None:
        ninety = wilson_interval(341, 408, confidence=0.90)
        ninety_nine = wilson_interval(341, 408, confidence=0.99)
        assert ninety[0] > ninety_nine[0]
        assert ninety[1] < ninety_nine[1]

    def test_no_trials_is_refused_rather_than_answered(self) -> None:
        # Zero observations support no interval at all, and returning
        # 0 to 1 would look like a measurement of total ignorance
        # rather than the absence of a measurement.
        with pytest.raises(ValueError):
            wilson_interval(0, 0)

    def test_more_successes_than_trials_is_refused(self) -> None:
        with pytest.raises(ValueError):
            wilson_interval(5, 3)


CASES = json.loads(
    (
        Path(__file__).resolve().parents[2]
        / "test"
        / "fixtures"
        / "wilson-cases.json"
    ).read_text(encoding="utf-8")
)


class TestTheIntervalAgreesAcrossTheBorder:
    """One formula, two implementations, one committed table.

    `tools/wilson.mjs` computes these for the README block, which is
    generated from the counts this side publishes rather than from a
    fresh measurement. Two implementations of one formula is what this
    repository keeps finding fault with, so both suites read this table
    and recompute it.

    They are not bit-identical and are not asked to be: this side takes
    the normal quantile from the standard library, the other computes
    it by bisection over a published series. The comparison is to nine
    decimals here because this side generated the table; the other side
    allows 1e-6, five orders finer than the one decimal any published
    sentence shows.
    """

    def test_the_table_is_not_empty_and_holds_the_headline(self) -> None:
        # The floor: an empty table would make the loop below assert
        # nothing and report success.
        assert len(CASES) > 8
        assert any(
            case["successes"] == 341 and case["trials"] == 408
            for case in CASES
        )
        assert any(case["successes"] == 0 for case in CASES)

    def test_every_case_recomputes(self) -> None:
        for case in CASES:
            low, high = wilson_interval(
                case["successes"], case["trials"], case["confidence"]
            )
            assert round(low, 9) == case["low"], case
            assert round(high, 9) == case["high"], case


class TestBinomialAtLeast:
    """How often a bar this loose is cleared by chance alone.

    Roadmap 10.10c2, ladder B11. DROZY's within-subject bar asks that
    at least 3 of 5 subjects agree on the sign of an effect. Each
    subject is a coin flip under the null, so the bar is cleared half
    the time by nothing at all, and it alone granted three "suggestive"
    verdicts in the published result.

    A bar with a chance rate of 0.5 is not a bar. Printing the rate
    beside it is what lets a reader see that without doing the
    arithmetic themselves.
    """

    def test_the_drozy_bar_is_a_coin_flip(self) -> None:
        # 3, 4 or 5 heads out of 5: (10 + 5 + 1) / 32.
        assert binomial_at_least(3, 5, 0.5) == pytest.approx(0.5)

    def test_a_stricter_bar_is_rarer(self) -> None:
        assert binomial_at_least(5, 5, 0.5) == pytest.approx(1 / 32)
        assert binomial_at_least(4, 5, 0.5) == pytest.approx(6 / 32)

    def test_no_successes_required_is_certain(self) -> None:
        assert binomial_at_least(0, 5, 0.5) == pytest.approx(1.0)

    def test_more_successes_than_trials_is_impossible(self) -> None:
        assert binomial_at_least(6, 5, 0.5) == 0.0

    def test_it_matches_a_hand_worked_asymmetric_case(self) -> None:
        # Two or more of three at p = 1/3: 3(1/3)^2(2/3) + (1/3)^3
        # = 6/27 + 1/27 = 7/27.
        assert binomial_at_least(2, 3, 1 / 3) == pytest.approx(7 / 27)

    def test_a_probability_outside_zero_and_one_is_refused(self) -> None:
        with pytest.raises(ValueError):
            binomial_at_least(1, 5, 1.5)

    def test_negative_trials_are_refused(self) -> None:
        with pytest.raises(ValueError):
            binomial_at_least(1, -1, 0.5)


class TestSubjectBootstrap:
    """Roadmap 10.10c2b. The DROZY intervals resample by SUBJECT, not by
    row, because rows within a person are not independent. These pin the
    resampling unit, seed reproducibility, and the refusals — on
    synthetic data, because the real per-subject table is 10.10c3's and
    the owner's."""

    def test_the_point_is_the_observed_statistic(self) -> None:
        # Four correct in one subject, one wrong in another: 4 of 5.
        result = subject_bootstrap(
            [[1.0, 1.0, 1.0, 1.0], [0.0]], _pooled_mean, seed=1
        )
        assert isinstance(result, BootstrapInterval)
        assert result.point == pytest.approx(0.8)

    def test_the_same_seed_reproduces_the_interval(self) -> None:
        args = ([[1.0, 0.0, 1.0], [0.0, 1.0], [1.0]], _pooled_mean)
        first = subject_bootstrap(*args, seed=42)
        second = subject_bootstrap(*args, seed=42)
        assert first == second

    def test_it_resamples_subjects_not_rows(self) -> None:
        # Two subjects, A all-correct and B one-wrong. Resampling SUBJECTS
        # can draw {A, A} (accuracy 1.0) or {B, B} (accuracy 0.0), each a
        # quarter of the time, so the 95% interval spans the whole [0, 1].
        # Resampling the five ROWS instead would cluster near 0.8 and put
        # neither 0.0 nor 1.0 at a tail — so these bounds can only come
        # from subject-level resampling.
        result = subject_bootstrap(
            [[1.0, 1.0, 1.0, 1.0], [0.0]], _pooled_mean, seed=7
        )
        assert result.low == 0.0
        assert result.high == 1.0

    def test_a_dominant_subject_does_not_swamp_the_interval(self) -> None:
        # One subject carries a hundred correct rows, two carry one wrong
        # row each. A by-ROW bootstrap sits at ~0.98 because the hundred
        # rows drown the two, and its lower bound never falls near zero. A
        # by-SUBJECT bootstrap drops the big subject entirely whenever the
        # three draws miss it (about 30% of the time), so the lower bound
        # is 0.0 — the two answers plainly differ, which is the whole
        # reason the resampling unit is the subject.
        subjects = [[1.0] * 100, [0.0], [0.0]]
        result = subject_bootstrap(subjects, _pooled_mean, seed=3)
        assert result.point == pytest.approx(100 / 102)
        assert result.low == 0.0
        assert result.high == pytest.approx(1.0)

    def test_a_paired_difference_statistic_is_supported(self) -> None:
        # The alertness Bar 2 use: each subject contributes its own paired
        # differences, and the statistic is their pooled mean. The
        # bootstrap is schema-agnostic — it never looks inside a subject.
        subjects = [[0.5, 0.3], [0.4], [0.6, 0.2, 0.4]]
        result = subject_bootstrap(subjects, _pooled_mean, seed=11)
        assert result.low <= result.point <= result.high

    def test_no_subjects_is_refused(self) -> None:
        with pytest.raises(ValueError, match="subject"):
            subject_bootstrap([], _pooled_mean, seed=1)

    def test_zero_resamples_is_refused(self) -> None:
        with pytest.raises(ValueError, match="resample"):
            subject_bootstrap([[1.0]], _pooled_mean, seed=1, resamples=0)

    def test_confidence_outside_zero_and_one_is_refused(self) -> None:
        with pytest.raises(ValueError, match="confidence"):
            subject_bootstrap([[1.0]], _pooled_mean, seed=1, confidence=1.5)
