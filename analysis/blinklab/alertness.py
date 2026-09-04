"""Does a learned weighting beat the demo alertness heuristic?

Pre-registered in docs/alertness-score-plan.md, committed before this file
existed. This reads NUMBERS ONLY -- the same UTA-RLDD per-second feature CSVs
the classification run read, never a frame. UTA-RLDD is used under written
permission (DATASETS.md); the required citation wherever a result appears is
Ghoddoosian, Galib and Athitsos, "A Realistic Dataset and Baseline Temporal
Model for Early Drowsiness Detection," CVPR Workshops 2019.

Two things are compared on the identical usable set:

- THE BASELINE: the demo alertness heuristic (src/core/score.ts), the
  `100 - penalties` dial the README admits was never checked. It is
  reimplemented here per second -- PERCLOS, the growth of the long-closure
  counter over the preceding 60 s, the last blink duration, and the
  amplitude-over-velocity ratio, each a documented ramp -- and reduced to one
  number per video as the MEDIAN of that per-second score over 60-360 s, the
  same window and reduction the learned model's features use. The port is
  pinned to score.ts's own ramp outputs by test; it takes no labels.

- THE CONTENDER: the UTA-RLDD leave-one-subject-out logistic regression
  (blinklab.rldd), read out as the out-of-fold probability of the drowsy
  class for each held-out video.

Both are scored by threshold-free alert-vs-drowsy AUC (the Mann-Whitney
concordance, computed by hand -- no scipy or sklearn here). Two label-shuffle
controls, from one fixed seed, answer the plan's two bars: is the heuristic
above chance, and does the model beat it by a margin that survives shuffling.
"""

from __future__ import annotations

import math
import statistics
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from blinklab.rldd import (
    BINARY_LABELS,
    LABELS,
    SEED,
    SHUFFLES,
    WINDOW_END_S,
    WINDOW_START_S,
    VideoFeatures,
    _apply,
    _fit,
    _matrix,
    _num,
    _prep,
    _rows,
    _second_of,
    _softmax,
    label_of,
    load_video_features,
)

# --- the demo heuristic, ported from src/core/score.ts ------------------
# These constants and ramps mirror score.ts exactly; the port is pinned to
# its documented outputs by test, so a drift from score.ts reddens the build.
# The live app scores a rolling 60 s window; the .seconds.csv gives one row
# per second, so the window is 60 rows back in time.

SCORE_WINDOW_S = 60
PERCLOS_PENALTY_MAX = 40
PERCLOS_RAMP_FLOOR = 0.05
PERCLOS_RAMP_CEIL = 0.15
LONG_CLOSURE_PENALTY_EACH = 15
LONG_CLOSURE_PENALTY_MAX = 30
BLINK_DURATION_PENALTY_MAX = 15
BLINK_DURATION_RAMP_FLOOR_MS = 250
BLINK_DURATION_RAMP_CEIL_MS = 450
LID_SLUGGISH_PENALTY_MAX = 15
LID_SLUGGISH_RAMP_FLOOR_MS = 150
LID_SLUGGISH_RAMP_CEIL_MS = 300


class AlertnessError(ValueError):
    """Raised rather than guessing, the same discipline as RldError."""


def _ramp_points(
    value: float, floor: float, ceil: float, max_points: int
) -> int:
    """A linear ramp from floor to ceiling, capped at both ends, in whole
    points. Rounding is HALF UP to match JavaScript's Math.round, which
    Python's round() (banker's rounding) would get wrong on the .5 cases."""
    fraction = min(max((value - floor) / (ceil - floor), 0.0), 1.0)
    return int(math.floor(fraction * max_points + 0.5))


def _row_score(
    newest: dict[str, str], oldest_closure_count: float | None
) -> float | None:
    """The heuristic score for one second, or None when that second has no
    face or no PERCLOS -- the same "no face, no score" gate as score.ts."""
    perclos = _num(newest, "perclos")
    face = (newest.get("faceDetected") or "").strip().lower() == "true"
    if not face or perclos is None:
        return None
    points = _ramp_points(
        perclos, PERCLOS_RAMP_FLOOR, PERCLOS_RAMP_CEIL, PERCLOS_PENALTY_MAX
    )
    count = _num(newest, "longClosureCount")
    if count is not None and oldest_closure_count is not None:
        delta = max(0, int(count) - int(oldest_closure_count))
        points += min(
            delta * LONG_CLOSURE_PENALTY_EACH, LONG_CLOSURE_PENALTY_MAX
        )
    duration = _num(newest, "lastBlinkDurationMs")
    if duration is not None:
        points += _ramp_points(
            duration,
            BLINK_DURATION_RAMP_FLOOR_MS,
            BLINK_DURATION_RAMP_CEIL_MS,
            BLINK_DURATION_PENALTY_MAX,
        )
    amplitude = _num(newest, "lastBlinkAmplitudeMm")
    velocity = _num(newest, "lastBlinkPeakVelocityMmPerS")
    if amplitude is not None and velocity is not None and velocity > 0:
        points += _ramp_points(
            amplitude / velocity * 1000,
            LID_SLUGGISH_RAMP_FLOOR_MS,
            LID_SLUGGISH_RAMP_CEIL_MS,
            LID_SLUGGISH_PENALTY_MAX,
        )
    return 100 - points


def heuristic_video_score(seconds_csv: str | Path) -> float | None:
    """One video's demo-heuristic alertness: the median over seconds 60-360
    of the per-second `100 - penalties`, or None if no second in the window
    was scorable. Mirrors src/core/score.ts run once per second."""
    rows = _rows(Path(seconds_csv))
    by_second: dict[int, dict[str, str]] = {}
    for row in rows:
        second = _second_of(row)
        if second is not None:
            by_second[second] = row
    if not by_second:
        return None
    seconds = sorted(by_second)
    counts = {s: _num(by_second[s], "longClosureCount") for s in seconds}
    scores: list[float] = []
    for t in seconds:
        if not (WINDOW_START_S <= t < WINDOW_END_S):
            continue
        oldest = min(s for s in seconds if t - SCORE_WINDOW_S <= s <= t)
        score = _row_score(by_second[t], counts[oldest])
        if score is not None:
            scores.append(score)
    return statistics.median(scores) if scores else None


# --- the metric: AUC as the Mann-Whitney concordance --------------------


def _average_ranks(values: np.ndarray) -> np.ndarray:
    """1-based ranks with ties averaged, so AUC counts a tie as half a win."""
    order = np.argsort(values, kind="mergesort")
    sorted_values = values[order]
    ranks = np.empty(len(values), dtype=float)
    i = 0
    n = len(values)
    while i < n:
        j = i
        while j + 1 < n and sorted_values[j + 1] == sorted_values[i]:
            j += 1
        ranks[order[i : j + 1]] = (i + j) / 2.0 + 1.0
        i = j + 1
    return ranks


def auc(scores: np.ndarray, positive: np.ndarray) -> float:
    """The area under the ROC curve for a one-dimensional score: the share of
    positive/negative pairs the score orders correctly, ties counted a half.
    Higher score means more likely positive."""
    positive = positive.astype(bool)
    n_pos = int(positive.sum())
    n_neg = int((~positive).sum())
    if n_pos == 0 or n_neg == 0:
        raise AlertnessError(
            "AUC needs both classes present; a corpus with one class alone "
            "cannot be scored"
        )
    ranks = _average_ranks(scores)
    rank_sum_pos = float(ranks[positive].sum())
    return (rank_sum_pos - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg)


# --- the contender: out-of-fold probabilities under leave-one-subject-out


def _loso_probabilities(
    x: np.ndarray, y: np.ndarray, subjects: np.ndarray, n_classes: int
) -> np.ndarray:
    """The held-out class probabilities for every row, aligned to input
    order. Each subject's rows are predicted by a model trained only on the
    others -- the same fold scheme and in-fold standardisation as rldd, read
    out as probabilities instead of argmax labels."""
    probs = np.empty((len(y), n_classes))
    for held in sorted(set(subjects.tolist())):
        test_mask = subjects == held
        train_mask = ~test_mask
        median, scale = _prep(x[train_mask])
        weights, bias = _fit(
            _apply(x[train_mask], median, scale), y[train_mask], n_classes
        )
        logits = _apply(x[test_mask], median, scale) @ weights + bias
        probs[test_mask] = _softmax(logits)
    return probs


# --- the corpus, carrying both scores -----------------------------------


@dataclass(frozen=True)
class ScoredVideo:
    """One video's rldd feature vector plus its demo-heuristic score."""

    features: VideoFeatures
    heuristic_score: float | None


def load_scored_corpus(measured_dir: str | Path) -> list[ScoredVideo]:
    """Every `<subject>_<label>.seconds.csv` reduced to its feature vector
    and its heuristic score, numbers only. Files without a known label are
    skipped, exactly as rldd.load_corpus skips them."""
    directory = Path(measured_dir)
    out: list[ScoredVideo] = []
    for path in sorted(directory.glob("*.seconds.csv")):
        stem = path.name[: -len(".seconds.csv")]
        if label_of(stem) is None:
            continue
        out.append(
            ScoredVideo(
                features=load_video_features(path),
                heuristic_score=heuristic_video_score(path),
            )
        )
    if not out:
        raise AlertnessError(f"no labelled .seconds.csv files in {directory}")
    return out


# --- the comparison and its two shuffle controls ------------------------


@dataclass(frozen=True)
class AlertnessComparison:
    """The head-to-head and the two label-shuffle nulls the plan fixed."""

    n_videos: int
    n_subjects: int
    n_alert: int
    n_drowsy: int
    heuristic_auc: float
    model_auc: float
    null_heuristic: np.ndarray
    null_diff: np.ndarray
    heuristic_spearman: float
    model_spearman: float

    @property
    def diff(self) -> float:
        return self.model_auc - self.heuristic_auc

    @staticmethod
    def _p_value(null: np.ndarray, observed: float) -> float:
        at_least = int((null >= observed).sum())
        return (1 + at_least) / (1 + len(null))

    @staticmethod
    def _pct975(null: np.ndarray) -> float:
        return float(np.percentile(null, 97.5))

    @property
    def heuristic_p(self) -> float:
        return self._p_value(self.null_heuristic, self.heuristic_auc)

    @property
    def diff_p(self) -> float:
        return self._p_value(self.null_diff, self.diff)

    @property
    def heuristic_null_975(self) -> float:
        return self._pct975(self.null_heuristic)

    @property
    def diff_null_975(self) -> float:
        return self._pct975(self.null_diff)

    @property
    def heuristic_above_chance(self) -> bool:
        """Bar 1: the demo heuristic separates alert from drowsy above the
        97.5th percentile of its shuffled null."""
        return (
            self.heuristic_auc > self.heuristic_null_975
            and self.heuristic_p < 0.025
        )

    @property
    def model_beats_heuristic(self) -> bool:
        """Bar 2: the learned model's AUC edge over the heuristic is positive
        and above the 97.5th percentile of the shuffled-difference null."""
        return (
            self.diff > 0
            and self.diff > self.diff_null_975
            and self.diff_p < 0.025
        )

    @property
    def verdict(self) -> str:
        """The plan's four outcomes, in its own words."""
        if self.heuristic_above_chance and self.model_beats_heuristic:
            return (
                "the demo heuristic already tracks drowsiness above chance, "
                "and a learned weighting beats it"
            )
        if self.heuristic_above_chance:
            return (
                "the demo heuristic already tracks drowsiness above chance, "
                "and the learned model does not beat it beyond the shuffle"
            )
        if self.model_beats_heuristic:
            return (
                "the heuristic is at or below chance, and the learned model "
                "out-separates it"
            )
        return "nothing separates these labels through either score"


def _spearman(a: np.ndarray, b: np.ndarray) -> float:
    """Spearman rank correlation: Pearson on the average ranks."""
    ra = _average_ranks(a) - _average_ranks(a).mean()
    rb = _average_ranks(b) - _average_ranks(b).mean()
    denom = math.sqrt(float((ra * ra).sum()) * float((rb * rb).sum()))
    return float((ra * rb).sum() / denom) if denom > 0 else 0.0


def _ordinal_spearmans(corpus: list[ScoredVideo]) -> tuple[float, float]:
    """The secondary: how each drowsiness score orders the three states
    (alert < low-vigilant < drowsy). The heuristic's drowsiness is minus its
    alertness; the model's is its out-of-fold expected ordinal."""
    kept = [
        sv
        for sv in corpus
        if sv.features.usable
        and sv.features.label in LABELS
        and sv.heuristic_score is not None
    ]
    if len({sv.features.label for sv in kept}) < 2:
        raise AlertnessError("the ordinal secondary needs at least two states")
    x, y, subjects = _matrix([sv.features for sv in kept], LABELS)
    probs = _loso_probabilities(x, y, subjects, len(LABELS))
    ordinal_axis = np.arange(len(LABELS), dtype=float)
    model_drowsiness = probs @ ordinal_axis
    heuristic_drowsiness = np.array([-sv.heuristic_score for sv in kept])
    truth = y.astype(float)
    return (
        _spearman(heuristic_drowsiness, truth),
        _spearman(model_drowsiness, truth),
    )


def compare(
    corpus: list[ScoredVideo],
    shuffles: int = SHUFFLES,
    seed: int = SEED,
) -> AlertnessComparison:
    """The pre-registered head-to-head: alert-vs-drowsy AUC for the heuristic
    and the leave-one-subject-out model, with the two label-shuffle nulls."""
    kept = [
        sv
        for sv in corpus
        if sv.features.usable
        and sv.features.label in BINARY_LABELS
        and sv.heuristic_score is not None
    ]
    if not kept:
        raise AlertnessError(
            "no usable alert/drowsy videos with a heuristic score to compare"
        )
    features = [sv.features for sv in kept]
    x, y, subjects = _matrix(features, BINARY_LABELS)
    drowsy_index = BINARY_LABELS.index("drowsy")
    positive = (y == drowsy_index).astype(int)
    if positive.sum() == 0 or positive.sum() == len(positive):
        raise AlertnessError(
            "the comparison needs both alert and drowsy videos"
        )

    # Heuristic drowsiness is minus the alertness score: higher = drowsier.
    heuristic = np.array([-sv.heuristic_score for sv in kept])
    heuristic_auc = auc(heuristic, positive)
    model_probs = _loso_probabilities(x, y, subjects, len(BINARY_LABELS))
    model_auc = auc(model_probs[:, drowsy_index], positive)

    rng = np.random.default_rng(seed)
    null_heuristic = np.empty(shuffles)
    null_diff = np.empty(shuffles)
    for i in range(shuffles):
        shuffled = rng.permutation(y)
        shuffled_positive = (shuffled == drowsy_index).astype(int)
        heur_shuf = auc(heuristic, shuffled_positive)
        probs_shuf = _loso_probabilities(
            x, shuffled, subjects, len(BINARY_LABELS)
        )
        model_shuf = auc(probs_shuf[:, drowsy_index], shuffled_positive)
        null_heuristic[i] = heur_shuf
        null_diff[i] = model_shuf - heur_shuf

    heuristic_spearman, model_spearman = _ordinal_spearmans(corpus)
    return AlertnessComparison(
        n_videos=len(kept),
        n_subjects=len(set(subjects.tolist())),
        n_alert=int((y != drowsy_index).sum()),
        n_drowsy=int((y == drowsy_index).sum()),
        heuristic_auc=heuristic_auc,
        model_auc=model_auc,
        null_heuristic=null_heuristic,
        null_diff=null_diff,
        heuristic_spearman=heuristic_spearman,
        model_spearman=model_spearman,
    )
