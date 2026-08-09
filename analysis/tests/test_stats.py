"""Tests for the rank statistics behind the DROZY analysis.

These are the arithmetic the conclusions rest on, so they are checked
against hand worked cases and against the known failure modes, not only
against themselves.
"""

from __future__ import annotations

import pytest

from blinklab.stats import Corrected, holm, permutation_p, ranks, spearman


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
