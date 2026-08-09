"""Do blinklab's features track self-reported sleepiness?

This runs the analysis written down in docs/drozy-analysis-plan.md,
which was committed BEFORE any correlation was computed. Nothing here
chooses what to test. The seven features, the statistic, the correction,
the controls and the decision rule were all fixed in advance, and this
script exists to execute that plan rather than to explore.

If you find yourself editing this file to try a different feature or a
different cut of the data, stop and read the plan first. That is the
exact move it exists to prevent.

Usage, from the analysis directory:

    PYTHONPATH="$PWD" .venv/bin/python tools/analyse_drozy.py \\
        <measured-dir> <kss-file>

DROZY is used under written permission from Professor Jacques Verly.
Cite the database and the WACV 2016 paper wherever these results appear.
"""

from __future__ import annotations

import argparse
import random

from blinklab.drozy import (
    FEATURE_LABELS,
    FEATURE_NAMES,
    MIN_USABLE_FPS,
    SessionFeatures,
    load_all,
)
from blinklab.stats import holm, permutation_p, spearman

SHUFFLES = 1000
SHUFFLE_SEED = 20260809

# From the plan. A feature must clear BOTH to be called a finding.
HOLM_ALPHA = 0.05
MIN_AGREEING_SUBJECTS = 3


def _paired(
    sessions: list[SessionFeatures], name: str
) -> tuple[list[float], list[float]]:
    """The (feature, KSS) pairs where the feature was actually measured.

    A session with no blinks has no mean blink duration. It is dropped
    from that feature's test rather than counted as zero, and the count
    of what was dropped is printed, because a correlation computed on
    twelve of twenty points is a different claim from one on twenty.
    """
    xs: list[float] = []
    ys: list[float] = []
    for s in sessions:
        value = s.feature(name)
        if value is None:
            continue
        xs.append(float(value))
        ys.append(float(s.kss))
    return xs, ys


def _within_subject_agreement(
    sessions: list[SessionFeatures], name: str, across_sign: float
) -> tuple[int, int]:
    """How many multi-session subjects move the same way as the group.

    A correlation across people that reverses inside people is measuring
    people, not sleepiness. This is the check for that, and the plan
    requires at least three of five to agree.
    """
    by_subject: dict[int, list[SessionFeatures]] = {}
    for s in sessions:
        by_subject.setdefault(s.subject, []).append(s)
    agree = 0
    total = 0
    for runs in by_subject.values():
        usable = [r for r in runs if r.feature(name) is not None]
        if len(usable) < 2:
            continue
        total += 1
        ordered = sorted(usable, key=lambda r: r.kss)
        first = float(ordered[0].feature(name) or 0.0)
        last = float(ordered[-1].feature(name) or 0.0)
        if ordered[0].kss == ordered[-1].kss:
            total -= 1
            continue
        within_sign = 1.0 if last > first else (-1.0 if last < first else 0.0)
        if within_sign != 0.0 and within_sign == across_sign:
            agree += 1
    return agree, total


def _shuffled_null(
    sessions: list[SessionFeatures], name: str
) -> tuple[float, float]:
    """The strongest correlation chance alone produces, and the median.

    Roadmap row 7.7. If the observed correlation sits comfortably inside
    this, the pipeline would have found a signal in noise and the result
    means nothing.
    """
    xs, ys = _paired(sessions, name)
    if len(xs) < 3:
        return 0.0, 0.0
    rng = random.Random(SHUFFLE_SEED)
    shuffled = list(ys)
    seen: list[float] = []
    for _ in range(SHUFFLES):
        rng.shuffle(shuffled)
        seen.append(abs(spearman(xs, shuffled)))
    seen.sort()
    return seen[-1], seen[len(seen) // 2]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("measured_dir")
    parser.add_argument("kss_file")
    args = parser.parse_args()

    every = load_all(args.measured_dir, args.kss_file)
    usable = [s for s in every if s.usable]
    excluded = [s for s in every if not s.usable]

    print("DROZY, do blinklab's features track reported sleepiness?")
    print("Plan fixed in advance: docs/drozy-analysis-plan.md")
    print()
    print(f"  sessions measured   {len(every)}")
    print(
        f"  excluded            {len(excluded)}"
        f"   below {MIN_USABLE_FPS} fps, issue #192"
    )
    print(f"  analysed            {len(usable)}")
    if not usable:
        print("\nNothing usable. Stopping rather than reporting on nothing.")
        return 1
    subjects = sorted({s.subject for s in usable})
    kss_values = [s.kss for s in usable]
    print(f"  subjects            {len(subjects)}")
    print(f"  KSS range           {min(kss_values)} to {max(kss_values)}")
    print()

    print("PRIMARY, Spearman against KSS across sessions")
    print(
        f"  {'feature':<32}{'n':>4}{'rho':>8}{'p raw':>9}"
        f"{'p Holm':>9}  within-subject"
    )

    raw: list[tuple[str, float, float, int]] = []
    for name in FEATURE_NAMES:
        xs, ys = _paired(usable, name)
        if len(xs) < 3:
            print(
                f"  {FEATURE_LABELS[name]:<32}{len(xs):>4}   too few to test"
            )
            continue
        rho = spearman(xs, ys)
        p = permutation_p(xs, ys, iterations=SHUFFLES, seed=SHUFFLE_SEED)
        raw.append((name, rho, p, len(xs)))

    corrected = holm(raw)
    verdicts: dict[str, str] = {}
    for c in corrected:
        sign = 1.0 if c.rho > 0 else -1.0
        agree, total = _within_subject_agreement(usable, c.name, sign)
        passes_p = c.p_holm < HOLM_ALPHA
        passes_within = agree >= MIN_AGREEING_SUBJECTS
        if passes_p and passes_within:
            verdicts[c.name] = "TRACKS KSS"
        elif passes_p or passes_within:
            verdicts[c.name] = "suggestive and unconfirmed"
        else:
            verdicts[c.name] = "no"
        print(
            f"  {FEATURE_LABELS[c.name]:<32}{c.n:>4}{c.rho:>8.3f}"
            f"{c.p_raw:>9.4f}{c.p_holm:>9.4f}  {agree}/{total} agree"
        )

    print()
    print("NEGATIVE CONTROL, KSS shuffled 1000 times, roadmap 7.7")
    print(f"  {'feature':<32}{'observed':>10}{'chance max':>12}{'median':>9}")
    for c in corrected:
        worst, median = _shuffled_null(usable, c.name)
        print(
            f"  {FEATURE_LABELS[c.name]:<32}{abs(c.rho):>10.3f}"
            f"{worst:>12.3f}{median:>9.3f}"
        )

    print()
    print("VERDICT, by the rule fixed before the data was seen")
    print(
        f"  a feature TRACKS KSS only if Holm p < {HOLM_ALPHA} AND at least "
        f"{MIN_AGREEING_SUBJECTS} of the multi-session subjects agree"
    )
    for c in corrected:
        print(f"  {FEATURE_LABELS[c.name]:<32}{verdicts[c.name]}")

    found = [n for n, v in verdicts.items() if v == "TRACKS KSS"]
    print()
    if found:
        print(
            f"  {len(found)} of {len(corrected)} features cleared both bars."
        )
    else:
        print(
            "  Nothing cleared both bars. On these 20 sessions this "
            "instrument's\n  features do not detectably track self-reported "
            "sleepiness. That is\n  the result, and the plan said it would be "
            "published as readily as\n  a positive one."
        )
    print()
    print("Cite: Massoz, Langohr, Francois and Verly, WACV 2016.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
