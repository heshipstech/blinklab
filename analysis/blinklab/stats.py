"""The statistics the DROZY plan calls for, written out rather than imported.

Three reasons this is not scipy. The analysis environment is pinned and
deliberately small. Every one of these is a dozen lines. And a reader who
wants to check the arithmetic can read it here instead of trusting that
the right function was called with the right arguments.

Everything is rank based, because the Karolinska Sleepiness Scale is
ordinal. The gap between 7 and 8 is not known to be the same size as the
gap between 2 and 3, so treating the numbers as distances would be a
claim nobody has earned.

See docs/drozy-analysis-plan.md, written before any of this was run.
"""

from __future__ import annotations

import random
from dataclasses import dataclass


def ranks(values: list[float]) -> list[float]:
    """Ranks, with ties sharing the average of the positions they cover.

    Ties matter here rather than being a detail. KSS is a 1 to 9 scale on
    twenty sessions, so ties are the normal case, not the exception, and
    a ranking that broke them arbitrarily would invent an ordering the
    data does not contain.
    """
    order = sorted(range(len(values)), key=lambda i: values[i])
    out = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        average = (i + j) / 2 + 1
        for k in range(i, j + 1):
            out[order[k]] = average
        i = j + 1
    return out


def spearman(xs: list[float], ys: list[float]) -> float:
    """Spearman's rank correlation, computed as Pearson on the ranks.

    The shortcut formula with the 6*d^2 term is wrong when there are
    ties, and here there always are, so it is not used.
    """
    if len(xs) != len(ys):
        raise ValueError("spearman needs two lists of the same length")
    if len(xs) < 3:
        raise ValueError("spearman needs at least three points")
    rx, ry = ranks(xs), ranks(ys)
    n = len(rx)
    mx, my = sum(rx) / n, sum(ry) / n
    num = sum((rx[i] - mx) * (ry[i] - my) for i in range(n))
    dx = sum((r - mx) ** 2 for r in rx)
    dy = sum((r - my) ** 2 for r in ry)
    if dx == 0 or dy == 0:
        # One variable never varies, so there is no correlation to find.
        # Zero is the honest answer, not an error and not NaN.
        return 0.0
    return num / (dx * dy) ** 0.5


def permutation_p(
    xs: list[float],
    ys: list[float],
    iterations: int = 10000,
    seed: int = 20260809,
) -> float:
    """Two sided p from shuffling, not from a table.

    A t approximation assumes things about twenty tied ordinal points
    that are not true. Shuffling assumes nothing: it asks how often
    chance alone produces a correlation this strong, by producing chance
    ten thousand times.

    The seed is fixed and stated so the number is reproducible. It is the
    date, chosen before any result was seen and never changed after.
    """
    observed = abs(spearman(xs, ys))
    rng = random.Random(seed)
    shuffled = list(ys)
    hits = 0
    for _ in range(iterations):
        rng.shuffle(shuffled)
        if abs(spearman(xs, shuffled)) >= observed:
            hits += 1
    # Add one to both parts. A p of exactly zero would claim the observed
    # value is impossible by chance, which ten thousand shuffles cannot
    # establish.
    return (hits + 1) / (iterations + 1)


@dataclass(frozen=True)
class Corrected:
    name: str
    rho: float
    p_raw: float
    p_holm: float
    n: int


def holm(results: list[tuple[str, float, float, int]]) -> list[Corrected]:
    """Holm correction across a family of tests.

    Seven tests on twenty points will turn up something that looks
    interesting by chance. Holm is used rather than Bonferroni because it
    is uniformly more powerful and just as valid, and the raw p is
    printed beside the corrected one so a reader can see what the
    correction cost.

    The step down enforces monotonicity: a corrected p can never be lower
    than the one before it in the sorted order, or a later test could
    look stronger than an earlier one it was ranked behind.
    """
    ordered = sorted(results, key=lambda r: r[2])
    m = len(ordered)
    out: list[Corrected] = []
    running = 0.0
    for index, (name, rho, p_raw, n) in enumerate(ordered):
        adjusted = min(1.0, (m - index) * p_raw)
        running = max(running, adjusted)
        out.append(
            Corrected(name=name, rho=rho, p_raw=p_raw, p_holm=running, n=n)
        )
    return out
