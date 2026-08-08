"""Reading the Eyeblink8 ground truth.

Eyeblink8 is a set of eight webcam recordings in which a human marked,
frame by frame, where the blinks are. It is the first external truth
this project has ever been measured against, so the reading of it has
to be at least as careful as the measuring.

The annotation format is one colon-separated line per frame:

    frameID : blink_id : NF : LE_FC : LE_NV : RE_FC : RE_NV
            : F_X : F_Y : F_W : F_H
            : LE_LX : LE_LY : LE_RX : LE_RY
            : RE_LX : RE_LY : RE_RX : RE_RY

blink_id is -1 when the frame is not part of a blink, and otherwise an
integer shared by every frame of the same blink. That grouping IS the
ground truth: a blink is a run of frames carrying one id, not a single
instant. FC means fully closed and NV means not visible; both are 'X'
when they do not apply, which is most of the time.

Everything here refuses rather than guesses. A file this project cannot
read confidently is more useful as an error than as a silently empty
result, because an empty result still produces a plausible score.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

# frameID, blink_id, four eye flags, one non-frontal flag, four face box
# numbers, eight eye corner numbers.
_FIELDS_PER_LINE = 19

_NOT_A_BLINK = -1


@dataclass(frozen=True)
class Blink:
    """One annotated blink, as a closed interval of frame indices."""

    blink_id: int
    start_frame: int
    end_frame: int
    fully_closed_frames: int

    @property
    def frame_count(self) -> int:
        # Closed interval: a blink annotated on frames 10 to 12 covers
        # three frames, not two.
        return self.end_frame - self.start_frame + 1


@dataclass(frozen=True)
class Annotation:
    """One clip's ground truth."""

    name: str
    blinks: list[Blink]
    frame_count: int
    non_frontal_frames: int
    header: dict[str, str] = field(default_factory=dict)

    @property
    def wears_glasses(self) -> bool:
        return self.header.get("glasses", "NO").strip().upper() == "YES"


def _parse_header(lines: list[str]) -> dict[str, str]:
    """Read the `#key: value` block above the annotations.

    The free text between `#message start` and `#message end` is skipped
    deliberately: it is a note to humans, and pretending to parse it
    would invent structure that is not there.
    """
    header: dict[str, str] = {}
    in_message = False
    for line in lines:
        stripped = line.strip()
        if stripped == "#message start":
            in_message = True
            continue
        if stripped == "#message end":
            in_message = False
            continue
        if in_message or not stripped.startswith("#"):
            continue
        key, separator, value = stripped[1:].partition(":")
        if separator:
            header[key.strip()] = value.strip()
    return header


def load_annotation(path: Path) -> Annotation:
    """Read one `.tag` file into blink intervals.

    Raises ValueError, naming the problem, for anything it cannot read
    with confidence.
    """
    if not path.exists():
        raise ValueError(f"No annotation file at {path}")

    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    header = _parse_header(lines)

    try:
        start = next(
            index
            for index, line in enumerate(lines)
            if line.strip() == "#start"
        )
    except StopIteration as error:
        raise ValueError(
            f"{path.name} has no '#start' line, so where the annotations "
            "begin is unknown"
        ) from error

    # blink_id -> frames carrying it. A dict rather than a running
    # interval because the ids are not guaranteed to be contiguous, and
    # assuming they were would silently merge two blinks into one.
    frames_by_blink: dict[int, list[int]] = {}
    closed_by_blink: dict[int, int] = {}
    seen_frames: set[int] = set()
    highest_frame = -1
    non_frontal = 0

    for offset, raw in enumerate(lines[start + 1 :], start=start + 2):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue

        parts = line.split(":")
        if len(parts) != _FIELDS_PER_LINE:
            raise ValueError(
                f"{path.name} line {offset}: expected "
                f"{_FIELDS_PER_LINE} colon-separated fields, found "
                f"{len(parts)}"
            )

        try:
            frame = int(parts[0])
            blink_id = int(parts[1])
        except ValueError as error:
            raise ValueError(
                f"{path.name} line {offset}: frame id and blink id must "
                f"be whole numbers, found {parts[0]!r} and {parts[1]!r}"
            ) from error

        if frame in seen_frames:
            raise ValueError(
                f"{path.name} line {offset}: frame {frame} is annotated "
                "more than once"
            )
        seen_frames.add(frame)
        highest_frame = max(highest_frame, frame)

        if parts[2].strip().upper() == "N":
            non_frontal += 1

        if blink_id == _NOT_A_BLINK:
            continue

        frames_by_blink.setdefault(blink_id, []).append(frame)
        # FC marks a frame where the eye is fully closed. Either eye
        # counts, because a blink annotated on one eye is still a blink.
        if "C" in (parts[3].strip().upper(), parts[5].strip().upper()):
            closed_by_blink[blink_id] = closed_by_blink.get(blink_id, 0) + 1

    if not seen_frames:
        raise ValueError(
            f"{path.name} has a '#start' line but no annotation rows after it"
        )

    blinks: list[Blink] = []
    for blink_id, frames in sorted(frames_by_blink.items()):
        first, last = min(frames), max(frames)
        # A run with holes in it means the file disagrees with itself
        # about where one blink ends, and guessing which reading is
        # right would put an invented interval into the ground truth.
        if last - first + 1 != len(frames):
            raise ValueError(
                f"{path.name}: blink {blink_id} covers frames {first} to "
                f"{last} but only {len(frames)} of them are annotated, so "
                "the interval has a gap"
            )
        blinks.append(
            Blink(
                blink_id=blink_id,
                start_frame=first,
                end_frame=last,
                fully_closed_frames=closed_by_blink.get(blink_id, 0),
            )
        )

    return Annotation(
        name=path.stem,
        blinks=blinks,
        frame_count=highest_frame + 1,
        non_frontal_frames=non_frontal,
        header=header,
    )


def load_corpus(root: Path) -> list[Annotation]:
    """Read every clip's annotation under a corpus directory.

    Refuses an empty result. A corpus that silently yields nothing is
    the most dangerous shape here, because every downstream metric would
    still compute and every one of them would be meaningless.
    """
    tags = sorted(root.rglob("*.tag"))
    if not tags:
        raise ValueError(f"No .tag annotation files found under {root}")
    return [load_annotation(tag) for tag in tags]
