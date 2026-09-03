"""UTA-RLDD drowsiness classification: the code the plan pre-registered.

docs/uta-rldd-plan.md was written and committed before this file existed,
and this file implements exactly what it fixed in advance — no more, and
nothing chosen after seeing a result. UTA-RLDD is used under written
permission from Professor Vassilis Athitsos (DATASETS.md); the required
citation wherever a result appears is Ghoddoosian, Galib and Athitsos,
"A Realistic Dataset and Baseline Temporal Model for Early Drowsiness
Detection," CVPR Workshops 2019.

This module reads NUMBERS ONLY. It never touches a frame, exactly as the
DROZY track never does. It reads the per-second feature CSVs the app
exported (`<subject>_<label>.seconds.csv`), reduces each video to one
feature vector, and runs the leave-one-subject-out evaluation the plan
fixed: multinomial logistic regression, standardised inside each fold, a
1/3 majority floor, balanced accuracy, a binary alert-vs-drowsy secondary,
and a 1000x label-shuffle control that doubles as a subject-leakage
detector. No sklearn or scipy is available here (deps are pandas and
matplotlib, numpy transitively), so the model is a small, deterministic
numpy softmax regression.

Two places the plan's "median over the window" needed a decision it did
not spell out, both made here BEFORE any result and recorded so they can
be checked:

- `amplitude_over_velocity_ms` has no per-second column of its own. It is
  computed per second as amplitude / velocity * 1000 (mm over mm/s is
  seconds; times 1000 is ms) where both are present, then medianed like
  the rest.
- `long_closures` reads a CUMULATIVE counter (`longClosureCount`, one
  count per closure, only ever rising within a video), so a median of it
  over the window is not a count of anything. The pre-registered feature
  is "count of closures beyond half a second", so it is taken as the
  WINDOW DELTA: the counter at the end of the window minus its value just
  before the window began — the closures that happened during seconds
  60-360.

A rare unmeasured feature (a video with no blink in the window, say) is
None here and imputed with the TRAINING fold's median at model time, never
across folds; the count of imputed values is reported, not hidden.
"""

from __future__ import annotations

import csv
import statistics
import warnings
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from blinklab.drozy import FEATURE_NAMES, MIN_USABLE_FPS

# The window the plan medians over: a 60 s settle, then seconds 60-360.
# A video whose recording does not reach the end of this window has
# "fewer than five measured minutes after the settle" and is excluded,
# by a rule fixed before any label is read (docs/uta-rldd-plan.md).
WINDOW_START_S = 60
WINDOW_END_S = 360

# The three self-declared states, and the label suffix each video's file
# name carries. The classes are balanced by construction: one video per
# state per subject.
LABELS: tuple[str, ...] = ("alert", "lowvigilant", "drowsy")

# The binary secondary named in advance: the two extremes, dropping the
# noisiest self-report in the middle.
BINARY_LABELS: tuple[str, ...] = ("alert", "drowsy")

# The model, fixed in advance. L2 strength and the solver's step count and
# rate are hyperparameters the plan did not number; they are fixed here a
# priori, because tuning them against the held-out subject is the exact
# leak the plan forbids. The penalty is deliberately LIGHT (0.1): with 7
# features and ~180 videos the model does not overfit much, and a heavy
# penalty would risk shrinking a genuine weak signal into a false null —
# the shuffle control already guards the overfitting direction. Standardised
# features keep the problem well conditioned, so plain full-batch gradient
# descent from a zero start is deterministic and needs no seed of its own.
L2_LAMBDA = 0.1
GD_ITERATIONS = 1000
GD_LEARNING_RATE = 0.5

# The negative control: 1000 label permutations from one recorded seed.
SHUFFLES = 1000
SEED = 20260903


class RldError(ValueError):
    """Raised rather than guessing. A file this module cannot read
    confidently is more useful as a named error than as a silently wrong
    feature vector, which would still produce a plausible accuracy."""


@dataclass(frozen=True)
class VideoFeatures:
    """One UTA-RLDD video reduced to the seven pre-registered features.

    Every feature may be None, meaning NOT MEASURED rather than zero: a
    window with no detected blink has no blink duration, and writing 0 ms
    would be a claim about an eyelid nothing supports."""

    subject: str
    label: str
    measured_fps: float
    reached_window_end: bool
    blink_rate_per_min: float | None
    blink_duration_ms: float | None
    blink_amplitude_mm: float | None
    closing_velocity_mm_s: float | None
    amplitude_over_velocity_ms: float | None
    perclos: float | None
    long_closures: float | None

    @property
    def usable(self) -> bool:
        """Whether this video clears both before-the-label gates: the
        25 fps floor blinklab needs to measure a blink, and a recording
        that actually covers the five-minute window."""
        return self.measured_fps >= MIN_USABLE_FPS and self.reached_window_end

    def vector(self) -> list[float | None]:
        return [getattr(self, name) for name in FEATURE_NAMES]


def _rows(seconds_csv: Path) -> list[dict[str, str]]:
    """The per-second rows of one export, its `# ...` metadata stripped."""
    text = seconds_csv.read_text(encoding="utf-8")
    body = [line for line in text.splitlines() if not line.startswith("#")]
    if not body:
        raise RldError(f"{seconds_csv.name} has no rows below its metadata")
    rows = list(csv.DictReader(body))
    if not rows:
        raise RldError(f"{seconds_csv.name} has a header and no data")
    return rows


def _num(row: dict[str, str], column: str) -> float | None:
    """One cell as a float, or None for a blank/unparseable one. A blank
    means the app declined to measure that second, which is not zero."""
    raw = (row.get(column) or "").strip()
    if raw == "":
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def _second_of(row: dict[str, str]) -> int | None:
    ms = _num(row, "timestampMs")
    return None if ms is None else int(ms // 1000)


def _median(values: list[float]) -> float | None:
    return statistics.median(values) if values else None


def label_of(name: str) -> str | None:
    """The declared state a file name carries, or None. The label is a
    known suffix, so the subject id before it may itself hold underscores
    (`Fold1part1_01`) without the split becoming ambiguous."""
    for label in LABELS:
        if name.endswith(f"_{label}"):
            return label
    return None


def load_video_features(seconds_csv: str | Path) -> VideoFeatures:
    """Reduce one `<subject>_<label>.seconds.csv` to one feature vector.

    Each feature is the MEDIAN over seconds 60-360 of its per-second
    column, except the two the plan's median did not fit cleanly and this
    module's docstring records: the amplitude/velocity ratio, computed per
    second before medianing, and the long-closure count, taken as the
    window delta of its cumulative counter."""
    path = Path(seconds_csv)
    stem = (
        path.name[: -len(".seconds.csv")]
        if path.name.endswith(".seconds.csv")
        else path.stem
    )
    label = label_of(stem)
    if label is None:
        raise RldError(
            f"{path.name} does not end in a known label "
            f"({', '.join(LABELS)}); refusing to guess its class"
        )
    subject = stem[: -(len(label) + 1)]
    if not subject:
        raise RldError(f"{path.name} has a label but no subject before it")

    rows = _rows(path)

    fps = [v for v in (_num(r, "fps") for r in rows) if v is not None]
    if not fps:
        raise RldError(f"{path.name} never reported a frame rate")
    measured_fps = statistics.median(fps)

    seconds = [s for r in rows if (s := _second_of(r)) is not None]
    max_second = max(seconds) if seconds else -1
    reached_window_end = max_second >= WINDOW_END_S - 1

    window = [
        r
        for r in rows
        if (s := _second_of(r)) is not None
        and WINDOW_START_S <= s < WINDOW_END_S
    ]

    rate = _median(
        [v for r in window if (v := _num(r, "blinkRatePerMin")) is not None]
    )
    duration = _median(
        [
            v
            for r in window
            if (v := _num(r, "lastBlinkDurationMs")) is not None
        ]
    )
    amplitude = _median(
        [
            v
            for r in window
            if (v := _num(r, "lastBlinkAmplitudeMm")) is not None
        ]
    )
    velocity = _median(
        [
            v
            for r in window
            if (v := _num(r, "lastBlinkPeakVelocityMmPerS")) is not None
        ]
    )
    ratios = [
        amp / vel * 1000
        for r in window
        if (amp := _num(r, "lastBlinkAmplitudeMm")) is not None
        and (vel := _num(r, "lastBlinkPeakVelocityMmPerS")) is not None
        and vel != 0
    ]
    ratio = _median(ratios)
    perclos = _median(
        [v for r in window if (v := _num(r, "perclos")) is not None]
    )
    long_closures = _long_closure_delta(rows)

    return VideoFeatures(
        subject=subject,
        label=label,
        measured_fps=measured_fps,
        reached_window_end=reached_window_end,
        blink_rate_per_min=rate,
        blink_duration_ms=duration,
        blink_amplitude_mm=amplitude,
        closing_velocity_mm_s=velocity,
        amplitude_over_velocity_ms=ratio,
        perclos=perclos,
        long_closures=long_closures,
    )


def _long_closure_delta(rows: list[dict[str, str]]) -> float | None:
    """Long closures DURING the window, from the cumulative counter.

    `longClosureCount` only rises within a video (one count per closure),
    so the closures during seconds 60-360 are the counter at the last
    in-window second minus its value at the last second before the window.
    Before-window absent means the count started at zero."""
    before = 0.0
    end: float | None = None
    for row in rows:
        second = _second_of(row)
        count = _num(row, "longClosureCount")
        if second is None or count is None:
            continue
        if second < WINDOW_START_S:
            before = count
        elif second < WINDOW_END_S:
            end = count
    if end is None:
        return None
    return max(end - before, 0.0)


def load_corpus(measured_dir: str | Path) -> list[VideoFeatures]:
    """Every `*.seconds.csv` under a directory as a VideoFeatures, sorted
    by name so a run is reproducible. Usable or not, all are returned;
    the exclusion is applied visibly by the analysis, not silently here."""
    directory = Path(measured_dir)
    out = [
        load_video_features(path)
        for path in sorted(directory.glob("*.seconds.csv"))
    ]
    if not out:
        raise RldError(f"no *.seconds.csv files in {directory}")
    return out


# --- the model: multinomial logistic regression, L2, pure numpy ---------


def _prep(train: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """The in-fold median (for imputing) and (mean, std) columns, from the
    TRAINING rows only. Fitting these on all the data first is the small,
    invisible leak the plan exists to forbid."""
    # A feature unmeasured across the WHOLE training fold has no median,
    # and numpy warns about the all-NaN column; the warning is expected
    # here, because the next line handles exactly that case.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=RuntimeWarning)
        median = np.nanmedian(train, axis=0)
    # Zero is the neutral fill for such a column, and it is standardised
    # away below.
    median = np.where(np.isnan(median), 0.0, median)
    filled = np.where(np.isnan(train), median, train)
    mean = filled.mean(axis=0)
    std = filled.std(axis=0)
    std = np.where(std == 0, 1.0, std)
    return median, np.vstack([mean, std])


def _apply(x: np.ndarray, median: np.ndarray, scale: np.ndarray) -> np.ndarray:
    filled = np.where(np.isnan(x), median, x)
    return (filled - scale[0]) / scale[1]


def _softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - logits.max(axis=1, keepdims=True)
    exp = np.exp(shifted)
    return exp / exp.sum(axis=1, keepdims=True)


def _fit(
    x: np.ndarray, y: np.ndarray, n_classes: int
) -> tuple[np.ndarray, np.ndarray]:
    """Softmax regression weights, full-batch gradient descent from zero.

    Deterministic: a zero start plus a fixed step and count means the same
    training data always yields the same weights, no seed required. L2 is
    on the weights, never the intercept."""
    n, d = x.shape
    weights = np.zeros((d, n_classes))
    bias = np.zeros(n_classes)
    onehot = np.zeros((n, n_classes))
    onehot[np.arange(n), y] = 1.0
    for _ in range(GD_ITERATIONS):
        probs = _softmax(x @ weights + bias)
        error = probs - onehot
        grad_w = x.T @ error / n + L2_LAMBDA * weights
        grad_b = error.mean(axis=0)
        weights -= GD_LEARNING_RATE * grad_w
        bias -= GD_LEARNING_RATE * grad_b
    return weights, bias


def _predict(
    x: np.ndarray, weights: np.ndarray, bias: np.ndarray
) -> np.ndarray:
    return np.argmax(x @ weights + bias, axis=1)


# --- the evaluation: leave-one-subject-out ------------------------------


@dataclass(frozen=True)
class LosoResult:
    """One leave-one-subject-out pass, pooled over the held-out folds."""

    labels: tuple[str, ...]
    truth: np.ndarray
    predicted: np.ndarray
    subjects: np.ndarray
    imputed_cells: int

    @property
    def balanced_accuracy(self) -> float:
        return balanced_accuracy(self.truth, self.predicted, len(self.labels))

    @property
    def confusion(self) -> np.ndarray:
        matrix = np.zeros((len(self.labels), len(self.labels)), dtype=int)
        for true_i, pred_i in zip(self.truth, self.predicted, strict=True):
            matrix[true_i, pred_i] += 1
        return matrix

    def per_subject_accuracy(self) -> dict[str, float]:
        out: dict[str, float] = {}
        for subject in sorted(set(self.subjects.tolist())):
            mask = self.subjects == subject
            out[subject] = float(
                (self.truth[mask] == self.predicted[mask]).mean()
            )
        return out


def balanced_accuracy(
    truth: np.ndarray, predicted: np.ndarray, n_classes: int
) -> float:
    """The mean of the per-class recalls, over the classes actually
    present in the truth. Balanced because a single held-out subject
    contributes only a handful of videos; the pool is where it lives."""
    recalls = []
    for cls in range(n_classes):
        mask = truth == cls
        if mask.any():
            recalls.append(float((predicted[mask] == cls).mean()))
    return float(np.mean(recalls)) if recalls else 0.0


def _matrix(
    videos: list[VideoFeatures], labels: tuple[str, ...]
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """The usable videos as (X with NaN for unmeasured, y, subject ids)."""
    index = {label: i for i, label in enumerate(labels)}
    x = np.array(
        [
            [np.nan if v is None else v for v in video.vector()]
            for video in videos
        ],
        dtype=float,
    )
    y = np.array([index[video.label] for video in videos], dtype=int)
    subjects = np.array([video.subject for video in videos])
    return x, y, subjects


def leave_one_subject_out(
    videos: list[VideoFeatures], labels: tuple[str, ...] = LABELS
) -> LosoResult:
    """Hold out every video of one subject, train on the rest, predict the
    held-out videos; pool over all subjects. No subject is ever in both
    splits — the whole point of the row this implements."""
    usable = [v for v in videos if v.usable and v.label in labels]
    if not usable:
        raise RldError("no usable videos for the requested labels")
    x, y, subjects = _matrix(usable, labels)
    truth: list[int] = []
    predicted: list[int] = []
    ordered_subjects: list[str] = []
    imputed = int(np.isnan(x).sum())
    for held in sorted(set(subjects.tolist())):
        test_mask = subjects == held
        train_mask = ~test_mask
        median, scale = _prep(x[train_mask])
        train_x = _apply(x[train_mask], median, scale)
        test_x = _apply(x[test_mask], median, scale)
        weights, bias = _fit(train_x, y[train_mask], len(labels))
        preds = _predict(test_x, weights, bias)
        truth.extend(y[test_mask].tolist())
        predicted.extend(preds.tolist())
        ordered_subjects.extend(subjects[test_mask].tolist())
    return LosoResult(
        labels=labels,
        truth=np.array(truth),
        predicted=np.array(predicted),
        subjects=np.array(ordered_subjects),
        imputed_cells=imputed,
    )


@dataclass(frozen=True)
class ShuffleControl:
    """The label-shuffle null and where the observed accuracy falls in it."""

    observed: float
    null: np.ndarray
    floor: float

    @property
    def p_value(self) -> float:
        """One-sided permutation p: how often chance reached the observed
        accuracy, with the +1 that keeps a zero-count from reading as an
        impossible p of exactly zero."""
        at_least = int((self.null >= self.observed).sum())
        return (1 + at_least) / (1 + len(self.null))

    @property
    def null_percentile_975(self) -> float:
        return float(np.percentile(self.null, 97.5))

    @property
    def null_std(self) -> float:
        return float(np.std(self.null))

    @property
    def above_null(self) -> bool:
        """The plan's first bar: the observed accuracy is past the 97.5th
        percentile of the shuffled null, a one-sided permutation p below
        0.025."""
        return (
            self.observed > self.null_percentile_975 and self.p_value < 0.025
        )

    @property
    def clears_floor_by_margin(self) -> bool:
        """The plan's second bar: the observed accuracy is above the
        majority floor by more than twice the null's own spread, so the
        margin is one the shuffled distribution shows is not chance."""
        return self.observed - self.floor > 2 * self.null_std

    @property
    def detected(self) -> bool:
        """The plan's decision rule: a finding needs BOTH bars."""
        return self.above_null and self.clears_floor_by_margin

    @property
    def suggestive(self) -> bool:
        """One bar cleared and the other failed — reported in those words,
        never as a finding."""
        return (
            self.above_null or self.clears_floor_by_margin
        ) and not self.detected

    @property
    def verdict(self) -> str:
        """The plan's three outcomes, in its own words."""
        if self.detected:
            return "detecting drowsiness"
        if self.suggestive:
            return "suggestive and unconfirmed"
        return "null: does not beat chance"


def shuffle_control(
    videos: list[VideoFeatures],
    labels: tuple[str, ...] = LABELS,
    shuffles: int = SHUFFLES,
    seed: int = SEED,
) -> ShuffleControl:
    """Permute the labels across videos `shuffles` times from the fixed
    seed, re-run the whole leave-one-subject-out on each, and record where
    the real balanced accuracy sits in that null. A held-out accuracy that
    SURVIVES its labels being shuffled was never reading drowsiness; one
    that COLLAPSES to the null is the honest shape of no-signal-or-leak."""
    usable = [v for v in videos if v.usable and v.label in labels]
    observed = leave_one_subject_out(usable, labels).balanced_accuracy
    x, y, subjects = _matrix(usable, labels)
    rng = np.random.default_rng(seed)
    null = np.empty(shuffles)
    for i in range(shuffles):
        shuffled = rng.permutation(y)
        null[i] = _loso_on_arrays(x, shuffled, subjects, len(labels))
    floor = 1.0 / len(labels)
    return ShuffleControl(observed=observed, null=null, floor=floor)


def _loso_on_arrays(
    x: np.ndarray, y: np.ndarray, subjects: np.ndarray, n_classes: int
) -> float:
    """Leave-one-subject-out balanced accuracy straight from arrays, so
    the 1000 shuffles do not each rebuild VideoFeatures objects."""
    truth: list[int] = []
    predicted: list[int] = []
    for held in sorted(set(subjects.tolist())):
        test_mask = subjects == held
        train_mask = ~test_mask
        median, scale = _prep(x[train_mask])
        weights, bias = _fit(
            _apply(x[train_mask], median, scale), y[train_mask], n_classes
        )
        preds = _predict(_apply(x[test_mask], median, scale), weights, bias)
        truth.extend(y[test_mask].tolist())
        predicted.extend(preds.tolist())
    return balanced_accuracy(np.array(truth), np.array(predicted), n_classes)
