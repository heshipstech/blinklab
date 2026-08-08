"""Comparing detected blinks against a human's annotations.

This is the file where the project finds out whether it works, so the
rules it uses have to be decided before the numbers are seen and stated
plainly enough that someone can disagree with them.

THE MATCHING RULE. A detected blink counts as correct when it overlaps
an annotated blink, allowing a few frames of slack at either end. Blink
detectors report the moment the eye reopens while an annotator marks
the whole closure, so demanding exact agreement about the edges would
punish a detector that found every blink perfectly.

MATCHING IS ONE TO ONE, and this is the part that matters most. Each
annotated blink can be claimed by at most one detection, and each
detection can claim at most one annotated blink. Without that rule a
detector that fired on every single frame would score perfect recall,
which is the standard way this kind of evaluation is quietly rigged.

WHAT THE NUMBERS MEAN. Recall is the share of real blinks found; a low
recall means the instrument is blind to some blinks. Precision is the
share of detections that were real; a low precision means it invents
blinks. They trade off, so both are always reported, never one alone.
"""

from __future__ import annotations

from dataclasses import dataclass

# Blink detectors report the reopening; annotators mark the closure. A
# few frames of disagreement about the edges is not a miss. At the 30
# frames per second these corpora were recorded at, four frames is
# about 130 ms.
DEFAULT_TOLERANCE_FRAMES = 4


@dataclass(frozen=True)
class Interval:
    """A closed interval of frame indices."""

    start_frame: int
    end_frame: int

    def __post_init__(self) -> None:
        if self.end_frame < self.start_frame:
            raise ValueError(
                f"Interval ends before it starts: {self.start_frame} to "
                f"{self.end_frame}"
            )

    def overlap(self, other: Interval, tolerance: int = 0) -> int:
        """Frames shared with another interval, after widening by tolerance.

        Returns 0 when they do not touch. A positive number is used both
        as the test for a match and as its quality, so the best
        available pairing can be chosen rather than the first.
        """
        start = max(self.start_frame - tolerance, other.start_frame)
        end = min(self.end_frame + tolerance, other.end_frame)
        return max(0, end - start + 1)


@dataclass(frozen=True)
class MatchResult:
    """The outcome of comparing one clip, or a whole corpus."""

    true_positives: int
    false_positives: int
    false_negatives: int
    pairs: list[tuple[int, int]]

    @property
    def detected(self) -> int:
        return self.true_positives + self.false_positives

    @property
    def annotated(self) -> int:
        return self.true_positives + self.false_negatives

    @property
    def recall(self) -> float | None:
        """Share of real blinks found. None when there were none.

        None rather than 0.0 or 1.0 deliberately. A clip with no
        annotated blinks says nothing about whether the instrument can
        find blinks, and letting it contribute a number would let empty
        clips move the headline figure.
        """
        if self.annotated == 0:
            return None
        return self.true_positives / self.annotated

    @property
    def precision(self) -> float | None:
        """Share of detections that were real. None when none were made."""
        if self.detected == 0:
            return None
        return self.true_positives / self.detected

    @property
    def f1(self) -> float | None:
        precision, recall = self.precision, self.recall
        if precision is None or recall is None:
            return None
        if precision + recall == 0:
            return 0.0
        return 2 * precision * recall / (precision + recall)


def match_blinks(
    detected: list[Interval],
    annotated: list[Interval],
    tolerance_frames: int = DEFAULT_TOLERANCE_FRAMES,
) -> MatchResult:
    """Pair detections with annotations, one to one, best overlap first.

    Greedy on overlap rather than on order. Taking pairs in time order
    would let an early, poor detection claim an annotation that a later,
    better one overlapped almost exactly, turning one good detection and
    one bad one into two mediocre outcomes.
    """
    if tolerance_frames < 0:
        raise ValueError("tolerance_frames cannot be negative")

    candidates: list[tuple[int, int, int]] = []
    for d_index, d in enumerate(detected):
        for a_index, a in enumerate(annotated):
            shared = d.overlap(a, tolerance_frames)
            if shared > 0:
                candidates.append((shared, d_index, a_index))

    # Best overlap first; ties broken by index so the result does not
    # depend on dictionary or sort instability.
    candidates.sort(key=lambda c: (-c[0], c[1], c[2]))

    used_detected: set[int] = set()
    used_annotated: set[int] = set()
    pairs: list[tuple[int, int]] = []
    for _shared, d_index, a_index in candidates:
        if d_index in used_detected or a_index in used_annotated:
            continue
        used_detected.add(d_index)
        used_annotated.add(a_index)
        pairs.append((d_index, a_index))

    pairs.sort()
    return MatchResult(
        true_positives=len(pairs),
        false_positives=len(detected) - len(pairs),
        false_negatives=len(annotated) - len(pairs),
        pairs=pairs,
    )


def combine(results: list[MatchResult]) -> MatchResult:
    """Pool per-clip results into one.

    Pools the COUNTS rather than averaging the rates. Averaging per-clip
    recall would give a clip with three blinks the same weight as one
    with eighty-eight, which is how a corpus with one easy short clip
    can be made to look better than it is.
    """
    return MatchResult(
        true_positives=sum(r.true_positives for r in results),
        false_positives=sum(r.false_positives for r in results),
        false_negatives=sum(r.false_negatives for r in results),
        pairs=[],
    )
