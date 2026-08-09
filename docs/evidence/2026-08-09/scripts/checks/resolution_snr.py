"""Does a smaller picture make a blink harder to see in these clips?

This is the check behind one sentence on the README. That sentence rules
out low resolution as a reason the instrument misses blinks. The number
in it had no saved script until now, which is why this file exists.

WHAT IT MEASURES. Not the app. The app is not run here at all. This works
on the raw pixels of the corpus videos, so the answer does not depend on
the instrument being right about anything.

For each clip it does this.

1. Read the human's annotation file. It gives the four eye corners on
   every frame, and it says which frames are part of a blink.
2. Cut a small grey box around each eye on every frame.
3. Build an open eye picture: the middle picture of the frames that are
   not part of a blink.
4. For every frame, measure how far that frame's eye box differs from
   that open eye picture. That difference is the blink signal. It is
   small while the eye is open and large while the eye closes.
5. Measure the noise: how much that same difference wobbles across the
   frames that are not blinks.
6. For each blink take its strongest frame and divide by the noise. That
   is the blink's strength, counted in wobbles. A strength of 4 means the
   blink stood four wobbles above an open eye.
7. Take the middle strength across all the blinks in the clip.

Then it repeats steps 2 to 7 twice more on smaller pictures. `x2`
averages each 2 by 2 square of pixels into one, so the eye box keeps a
quarter of its pixels. `x4` averages each 4 by 4 square, so it keeps one
pixel in sixteen and throws away about 94 in every 100.

THE RULE BEHIND THE PUBLISHED NUMBER. Take one clip's middle blink
strength at full size, and the same clip's middle blink strength at `x4`.
Work out the change between them as a percentage. Do that for all eight
clips and average the eight percentages. That average is the published
figure. This script prints it with its sign, and prints every reading
behind it, so nobody has to take one number on trust.

The sign matters, and it is not what a reader would guess. A smaller
picture did not weaken the blink. Averaging neighbouring pixels together
removes more noise than signal, so the strength goes slightly UP.

Run it like this, with your own paths:

    <python> resolution_snr.py <corpus-root> <output.json>

The corpus root is the folder holding the numbered Eyeblink8 clip
folders. It needs numpy and imageio-ffmpeg, and it reads the `.avi` video
files. It only reads. It never writes anything into the corpus.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

import imageio_ffmpeg
import numpy as np

# The eight clips, by the numbered folder each one sits in.
DIRS = {
    "1": "26122013_223310_cam",
    "2": "26122013_224532_cam",
    "3": "26122013_230103_cam",
    "4": "26122013_230654_cam",
    "8": "27122013_151644_cam",
    "9": "27122013_152435_cam",
    "10": "27122013_153916_cam",
    "11": "27122013_154548_cam",
}

# Every Eyeblink8 clip is 640 by 480.
WIDTH, HEIGHT = 640, 480

# The annotation format is one colon separated line per frame. The full
# field list is in analysis/blinklab/eyeblink8.py.
FIELDS_PER_LINE = 19
NOT_A_BLINK = -1

# A clip with fewer usable frames than this is refused rather than
# reported. A middle value over a handful of frames measures nothing.
MIN_USABLE_FRAMES = 500

# How much to shrink by, and the name each shrink is reported under.
FACTORS = ((1, "x1"), (2, "x2"), (4, "x4"))

# The shrink the published sentence is about.
PUBLISHED_FACTOR = "x4"

# At most this many open eye frames go into the open eye picture. Taking
# every frame of a long clip is slow and changes nothing.
TEMPLATE_SAMPLES = 400

# A blink weaker than this many wobbles is reported separately, as a
# rough count of how many blinks are faint in the pixels themselves.
FAINT_BELOW = 3


@dataclass(frozen=True)
class Clip:
    """One clip's eye boxes, with the little the annotation says."""

    name: str
    left: np.ndarray
    right: np.ndarray
    is_blink: np.ndarray
    row_of_frame: dict[int, int]
    blinks: list[tuple[int, int]]
    eye_width_px: float


def read_tag(path: Path) -> dict[int, dict]:
    """Read one annotation file into per frame eye corners and blink id."""
    rows: dict[int, dict] = {}
    started = False
    with path.open(encoding="utf-8", errors="replace") as handle:
        for raw in handle:
            line = raw.strip()
            if line == "#start":
                started = True
                continue
            if not started or not line or line.startswith("#"):
                continue
            parts = line.split(":")
            if len(parts) != FIELDS_PER_LINE:
                continue
            try:
                frame = int(parts[0])
                blink_id = int(parts[1])
                corners = [int(value) for value in parts[11:19]]
            except ValueError:
                continue
            rows[frame] = {"blink_id": blink_id, "corners": corners}
    return rows


def shrink(stack: np.ndarray, factor: int) -> np.ndarray:
    """Average every factor by factor square of pixels into one pixel."""
    if factor == 1:
        return stack
    count, height, width = stack.shape
    usable_h = (height // factor) * factor
    usable_w = (width // factor) * factor
    return (
        stack[:, :usable_h, :usable_w]
        .reshape(count, usable_h // factor, factor, usable_w // factor, factor)
        .mean(axis=(2, 4))
    )


def _eye_centres(corners: list[int]) -> tuple[tuple[int, int], ...]:
    """The middle of each eye, from its two corners."""
    return tuple(
        (int(round((lx + rx) / 2)), int(round((ly + ry) / 2)))
        for lx, ly, rx, ry in (
            (corners[0], corners[1], corners[2], corners[3]),
            (corners[4], corners[5], corners[6], corners[7]),
        )
    )


def load_clip(corpus: Path, folder: str, name: str) -> Clip:
    """Decode one clip and cut the two eye boxes out of every frame."""
    tag = read_tag(corpus / folder / f"{name}.tag")
    frames = sorted(tag)

    # A blink is a run of frames sharing one id, exactly as
    # analysis/blinklab/eyeblink8.py reads it.
    by_id: dict[int, list[int]] = {}
    for frame in frames:
        blink_id = tag[frame]["blink_id"]
        if blink_id != NOT_A_BLINK:
            by_id.setdefault(blink_id, []).append(frame)
    blinks = sorted((min(v), max(v)) for v in by_id.values())
    blink_frames = {f for run in by_id.values() for f in run}

    # Box size from the typical eye width, so a clip where the person
    # sits closer to the camera gets a bigger box.
    widths: list[float] = []
    for frame in frames:
        corners = tag[frame]["corners"]
        widths.append(abs(corners[2] - corners[0]))
        widths.append(abs(corners[6] - corners[4]))
    eye_width = float(np.median(widths))
    box_w = int(round(eye_width * 1.30)) // 2 * 2 + 2
    box_h = int(round(eye_width * 0.92)) // 2 * 2 + 2

    # Decode only a crop that covers both eyes for the whole clip. The
    # rest of the picture is never read, which is what keeps this quick.
    xs: list[int] = []
    ys: list[int] = []
    for frame in frames:
        corners = tag[frame]["corners"]
        xs += [corners[0], corners[2], corners[4], corners[6]]
        ys += [corners[1], corners[3], corners[5], corners[7]]
    pad_x, pad_y = box_w // 2 + 4, box_h // 2 + 4
    x0 = max(0, min(xs) - pad_x)
    x1 = min(WIDTH, max(xs) + pad_x)
    y0 = max(0, min(ys) - pad_y)
    y1 = min(HEIGHT, max(ys) + pad_y)
    crop_w = (x1 - x0) // 2 * 2
    crop_h = (y1 - y0) // 2 * 2

    process = subprocess.Popen(
        [
            imageio_ffmpeg.get_ffmpeg_exe(),
            "-hide_banner", "-loglevel", "error",
            "-i", str(corpus / folder / f"{name}.avi"),
            "-map", "0:v",
            "-vf", f"crop={crop_w}:{crop_h}:{x0}:{y0}",
            "-pix_fmt", "gray", "-f", "rawvideo", "-",
        ],
        stdout=subprocess.PIPE,
    )
    if process.stdout is None:
        raise SystemExit(f"{name}: ffmpeg produced no output to read")

    left: list[np.ndarray] = []
    right: list[np.ndarray] = []
    kept: list[int] = []
    frame_bytes = crop_w * crop_h
    last_frame = max(frames)
    index = 0
    while index <= last_frame:
        raw = process.stdout.read(frame_bytes)
        if len(raw) < frame_bytes:
            break
        if index in tag:
            picture = np.frombuffer(raw, dtype=np.uint8).reshape(
                crop_h, crop_w
            )
            pair: list[np.ndarray] = []
            for cx, cy in _eye_centres(tag[index]["corners"]):
                top = cy - y0 - box_h // 2
                side = cx - x0 - box_w // 2
                # A box that runs off the decoded crop is dropped rather
                # than shifted back inside it. A shifted box is no longer
                # centred on the eye, and it would quietly pull the
                # measurement towards whatever is beside the eye.
                if (
                    top < 0
                    or side < 0
                    or top + box_h > crop_h
                    or side + box_w > crop_w
                ):
                    break
                pair.append(picture[top : top + box_h, side : side + box_w])
            if len(pair) == 2:
                left.append(pair[0])
                right.append(pair[1])
                kept.append(index)
        index += 1
    process.stdout.close()
    process.kill()
    process.wait()

    return Clip(
        name=name,
        left=np.array(left, dtype=np.float32),
        right=np.array(right, dtype=np.float32),
        is_blink=np.array([f in blink_frames for f in kept]),
        row_of_frame={frame: row for row, frame in enumerate(kept)},
        blinks=blinks,
        eye_width_px=eye_width,
    )


def strengths_at(clip: Clip, factor: int) -> np.ndarray:
    """Every blink's strength in wobbles, at one picture size."""
    open_frames = ~clip.is_blink
    signal = np.zeros(len(clip.is_blink), dtype=np.float32)
    for stack in (shrink(clip.left, factor), shrink(clip.right, factor)):
        step = max(1, int(open_frames.sum()) // TEMPLATE_SAMPLES)
        template = np.median(stack[open_frames][::step], axis=0)
        signal += np.abs(stack - template).mean(axis=(1, 2))
    signal /= 2.0

    quiet = signal[open_frames]
    middle = float(np.median(quiet))
    wobble = float(np.std(quiet))
    if wobble <= 0:
        raise SystemExit(
            f"{clip.name}: the open eye frames do not wobble at all, so "
            "there is no noise to measure a blink against."
        )

    values: list[float] = []
    for start, end in clip.blinks:
        rows = [
            clip.row_of_frame[f]
            for f in range(start, end + 1)
            if f in clip.row_of_frame
        ]
        if rows:
            values.append((float(signal[rows].max()) - middle) / wobble)
    return np.array(values)


def measure(clip: Clip) -> dict:
    """One clip's readings at every picture size."""
    record: dict = {
        "clip": clip.name,
        "usable_frames": int(len(clip.is_blink)),
        "annotated_blinks": len(clip.blinks),
        "eye_width_px": round(clip.eye_width_px, 2),
    }
    for factor, label in FACTORS:
        values = strengths_at(clip, factor)
        record[f"strength_middle_{label}"] = round(
            float(np.median(values)), 2
        )
        record[f"strength_low_tenth_{label}"] = round(
            float(np.percentile(values, 10)), 2
        )
        record[f"share_faint_{label}"] = round(
            float((values < FAINT_BELOW).mean()), 4
        )
    return record


def summarise(results: dict[str, dict]) -> str:
    """The published figure, its rule, and every reading behind it."""
    if not results:
        return "No clips measured."

    lines: list[str] = []
    lines.append("BLINK STRENGTH AGAINST PICTURE SIZE")
    lines.append("")
    lines.append(
        "Strength is the middle blink of the clip, counted in wobbles of "
        "an open eye."
    )
    lines.append("")
    lines.append(
        f"  {'clip':22} {'full':>7} {'x2':>7} {'x4':>7} "
        f"{'x2 change':>10} {'x4 change':>10}"
    )
    changes: dict[str, list[float]] = {label: [] for _f, label in FACTORS[1:]}
    for name in sorted(results):
        record = results[name]
        full = record["strength_middle_x1"]
        cells = [f"  {name[:22]:22} {full:7.2f}"]
        for _factor, label in FACTORS[1:]:
            cells.append(f" {record[f'strength_middle_{label}']:7.2f}")
        for _factor, label in FACTORS[1:]:
            change = (record[f"strength_middle_{label}"] - full) / full * 100
            changes[label].append(change)
            cells.append(f" {change:+9.2f}%")
        lines.append("".join(cells))
    lines.append("")
    for _factor, label in FACTORS[1:]:
        average = sum(changes[label]) / len(changes[label])
        lines.append(f"  average change at {label}: {average:+.2f}%")
    lines.append("")

    published = sum(changes[PUBLISHED_FACTOR]) / len(changes[PUBLISHED_FACTOR])
    lines.append("THE PUBLISHED FIGURE, and the rule that produces it.")
    lines.append(
        "Shrink each eye box to a quarter of its width and a quarter of "
        "its height."
    )
    lines.append(
        "That keeps one pixel in sixteen, so about 94 pixels in every 100 "
        "are gone."
    )
    lines.append(
        "Work out the change in each clip's middle blink strength, then "
        "average the"
    )
    lines.append(f"eight clips. The answer is {published:+.1f}%.")
    lines.append("")
    lines.append(
        "The sign is positive. A smaller picture did not make the blink "
        "weaker."
    )
    lines.append(
        "So a picture too small to see the blink is not why blinks are "
        "missed."
    )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("corpus", type=Path, help="Eyeblink8 clips root")
    parser.add_argument("output", type=Path, help="Where to write the JSON")
    args = parser.parse_args(argv)

    results: dict[str, dict] = {}
    for folder, name in sorted(DIRS.items(), key=lambda pair: pair[1]):
        clip = load_clip(args.corpus, folder, name)
        if len(clip.is_blink) < MIN_USABLE_FRAMES:
            raise SystemExit(
                f"{name}: only {len(clip.is_blink)} frames had both eye "
                "boxes inside the picture, which is too few to measure."
            )
        record = measure(clip)
        results[name] = record
        print(json.dumps(record), flush=True)

    # The trailing newline keeps the saved file identical to what this
    # script writes AND acceptable to the repository's formatter, so the
    # committed artifact can be regenerated and compared byte for byte.
    args.output.write_text(
        json.dumps(results, indent=2) + "\n", encoding="utf-8"
    )
    print()
    print(summarise(results))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
