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

from blinklab.column_freeze import ColumnFreezeError, check_header
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


def load_video_features(
    seconds_csv: str | Path, probe: ClipProbe | None = None
) -> VideoFeatures:
    """Reduce one `<subject>_<label>.seconds.csv` to one feature vector.

    Each feature is the MEDIAN over seconds 60-360 of its per-second
    column, except the two the plan's median did not fit cleanly and this
    module's docstring records: the amplitude/velocity ratio, computed per
    second before medianing, and the long-closure count, taken as the
    window delta of its cumulative counter.

    `probe` is this clip's ffprobe container facts, when a manifest is in
    play (roadmap 10.14b): the instrument's measured coverage is then
    cross-checked against the file, and a gap past the tolerance refuses
    the clip. None (the default) runs no such check, so a corpus without a
    manifest reads exactly as before."""
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

    # The column-freeze refusal (roadmap 12.17). Once the owner signs the
    # v2-read freeze, a seconds.csv whose header has dropped a frozen
    # column is refused here rather than silently read as a moved
    # instrument. Unsigned, this is a no-op. Wrapped into RldError so the
    # runner reports it as the read refusal it is.
    try:
        check_header(rows[0].keys())
    except ColumnFreezeError as error:
        raise RldError(f"{path.name}: {error}") from error

    fps = [v for v in (_num(r, "fps") for r in rows) if v is not None]
    if not fps:
        raise RldError(f"{path.name} never reported a frame rate")
    measured_fps = statistics.median(fps)

    seconds = [s for r in rows if (s := _second_of(r)) is not None]
    max_second = max(seconds) if seconds else -1
    reached_window_end = max_second >= WINDOW_END_S - 1

    if probe is not None:
        reason = coverage_refusal(max_second + 1, probe)
        if reason is not None:
            raise RldError(f"{path.name}: {reason}")

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


def load_corpus(
    measured_dir: str | Path, manifest: str | Path | None = None
) -> list[VideoFeatures]:
    """Every `*.seconds.csv` under a directory as a VideoFeatures, sorted
    by name so a run is reproducible. Usable or not, all are returned;
    the exclusion is applied visibly by the analysis, not silently here.

    `manifest` is an optional ffprobe manifest (roadmap 10.14b): when
    given, each clip that has an entry has its coverage cross-checked
    against the container, and a gap refuses that clip by name. A clip
    absent from the manifest is loaded without the check rather than
    refused, so a partial manifest narrows the cross-check rather than
    blocking the run. Omitted, nothing changes."""
    directory = Path(measured_dir)
    probes = read_manifest(manifest) if manifest is not None else {}
    out = [
        load_video_features(
            path, probes.get(path.name[: -len(".seconds.csv")])
        )
        for path in sorted(directory.glob("*.seconds.csv"))
    ]
    if not out:
        raise RldError(f"no *.seconds.csv files in {directory}")
    return out


# --- the container cross-check: the exclusion against ffprobe (10.14b) ---

# The coverage tolerance, stated rather than tuned. The instrument writes
# one row per measured second, so its last measured second plus one is how
# far into the clip it reached; the container's own duration is its packet
# count over its nominal rate. A clip fully measured has the two within a
# small margin — max(2 seconds, 2% of the container's duration): two
# seconds because a per-second instrument can legitimately stop a second
# or two short of the container's last frame, and 2% so a longer clip is
# allowed proportionally more. A gap past it is a coverage failure — the
# run stopped measuring before the clip ended — which is the exclusion
# this cross-checks against the file itself rather than the run's own word.
COVERAGE_GAP_FLOOR_S = 2.0
COVERAGE_GAP_FRACTION = 0.02

# The manifest one line per clip carries, exactly the three ffprobe fields
# the row names. rFrameRate is stored as ffprobe writes it ("30000/1001"),
# parsed to a float on read so nothing rounds at write time.
MANIFEST_COLUMNS = ["clip", "rFrameRate", "avgFrameRate", "nbReadPackets"]


def parse_frame_rate(text: str) -> float:
    """A frame rate ffprobe wrote as a fraction ("30000/1001") or a plain
    number, as a float. Zero for an unreadable or zero-denominator rate,
    which the coverage check reads as an unusable container duration."""
    text = (text or "").strip()
    if not text:
        return 0.0
    if "/" in text:
        num, _, den = text.partition("/")
        try:
            numerator, denominator = float(num), float(den)
        except ValueError:
            return 0.0
        return numerator / denominator if denominator else 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


@dataclass(frozen=True)
class ClipProbe:
    """One clip's container facts from ffprobe: the rates it declares and
    the packet count it actually holds. nb_read_packets is the true frame
    count of the (trimmed) file, and dividing it by the nominal rate gives
    the container's own duration, which the instrument's coverage is held
    against."""

    clip: str
    r_frame_rate: float
    avg_frame_rate: float
    nb_read_packets: int

    @property
    def container_seconds(self) -> float:
        if self.r_frame_rate <= 0:
            return 0.0
        return self.nb_read_packets / self.r_frame_rate


def coverage_refusal(measured_seconds: float, probe: ClipProbe) -> str | None:
    """Why the instrument's coverage disagrees with the container, or None.

    measured_seconds is the last second the instrument measured plus one;
    the container's duration is its packet count over its nominal rate. A
    gap past max(2 s, 2%) means the run stopped before the clip ended —
    the coverage failure the exclusion is meant to catch, confirmed
    against the file rather than the run's own frame count."""
    container = probe.container_seconds
    gap = abs(measured_seconds - container)
    allowed = max(COVERAGE_GAP_FLOOR_S, container * COVERAGE_GAP_FRACTION)
    if gap > allowed:
        return (
            f"coverage gap of {gap:.1f} s: the instrument measured "
            f"{measured_seconds:.0f} s but the container holds "
            f"{container:.1f} s ({probe.nb_read_packets} frames at "
            f"{probe.r_frame_rate:.3f} fps), past the {allowed:.1f} s bar "
            "(2%, floor 2 s)"
        )
    return None


def read_manifest(path: str | Path) -> dict[str, ClipProbe]:
    """The ffprobe manifest as clip name -> ClipProbe, its `#` metadata
    lines skipped like every CSV here. Raises RldError, naming the row,
    for a line whose packet count is not a whole number."""
    lines = [
        line
        for line in Path(path).read_text(encoding="utf-8").splitlines()
        if not line.startswith("#")
    ]
    out: dict[str, ClipProbe] = {}
    for row in csv.DictReader(lines):
        clip = (row.get("clip") or "").strip()
        packets = (row.get("nbReadPackets") or "").strip()
        try:
            frames = int(packets)
        except ValueError as error:
            raise RldError(
                f"manifest row for {clip!r} has a non-integer frame count "
                f"{packets!r}"
            ) from error
        out[clip] = ClipProbe(
            clip=clip,
            r_frame_rate=parse_frame_rate(row.get("rFrameRate", "")),
            avg_frame_rate=parse_frame_rate(row.get("avgFrameRate", "")),
            nb_read_packets=frames,
        )
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


@dataclass(frozen=True)
class StandardizedModel:
    """The pre-registered softmax model fit to the WHOLE usable corpus on
    standardised features.

    `coefficients` is indexed (feature, class). Because every feature was
    z-scored before the fit, each entry is the effect of a one-standard-
    deviation change in that feature on that class's logit, so the
    magnitudes are comparable across features that live in different units
    — millimetres, milliseconds, a fraction. That comparability is the
    whole point of a STANDARDISED coefficient, and it is what the analysis
    plan promised and never printed."""

    feature_names: tuple[str, ...]
    labels: tuple[str, ...]
    coefficients: np.ndarray


def standardized_coefficients(
    videos: list[VideoFeatures], labels: tuple[str, ...] = LABELS
) -> StandardizedModel:
    """The standardised coefficients of the model fit to every usable
    video, for INTERPRETATION — which features it leans on and in which
    direction.

    This fits on the whole corpus, so it is NOT a held-out claim: it has
    seen every subject, and reporting its accuracy would be the leak the
    plan forbids. The held-out number stays with leave_one_subject_out;
    this only describes the shape of the fit. Deterministic for the same
    reason _fit is — a zero start and a fixed step — so "recomputed from
    the records" is a byte-for-byte claim rather than a hope."""
    usable = [v for v in videos if v.usable and v.label in labels]
    if not usable:
        raise RldError("no usable videos for the requested labels")
    x, y, _subjects = _matrix(usable, labels)
    median, scale = _prep(x)
    weights, _bias = _fit(_apply(x, median, scale), y, len(labels))
    return StandardizedModel(
        feature_names=tuple(FEATURE_NAMES),
        labels=labels,
        coefficients=weights,
    )


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
