"""Turn the Eyeblink8 corpus into something a browser can decode.

Eyeblink8 ships H.264 video inside an AVI container. No browser decodes
AVI, and neither does macOS's own avconvert, so the clips cannot be fed
to the instrument as they are.

The conversion is a REMUX, not a re-encode: the H.264 bitstream is
copied byte for byte into an MP4 container. That distinction is the
whole point of this file. The ground truth is indexed BY FRAME NUMBER,
so a conversion that dropped, duplicated or resampled a single frame
would silently shift every annotation against the video and produce a
confident, wrong accuracy figure. A remux cannot do that, and this
script verifies the frame count on both sides anyway rather than
trusting the claim.

Run it once, locally:

    uv sync --group corpus
    uv run python tools/prepare_eyeblink8.py <corpus-root> <output-dir>

ffmpeg comes from the pinned imageio-ffmpeg package rather than a
system install, so the version is recorded in the lockfile like every
other dependency. It is deliberately not in the dev group: continuous
integration has no corpus to prepare.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

FRAME_COUNT = re.compile(rb"frame=\s*(\d+)")


def ffmpeg_path() -> str:
    try:
        import imageio_ffmpeg
    except ImportError:  # pragma: no cover - depends on the extra group
        raise SystemExit(
            "imageio-ffmpeg is not installed. Run: uv sync --group corpus"
        ) from None
    return imageio_ffmpeg.get_ffmpeg_exe()


def count_frames(ffmpeg: str, path: Path) -> int:
    """Decode a file and count the frames that actually come out.

    Deliberately decodes rather than reading a container header. A
    header states an intention; this counts what a decoder really
    produces, which is what a browser will see.
    """
    result = subprocess.run(
        [
            ffmpeg,
            "-v",
            "quiet",
            "-stats",
            "-i",
            str(path),
            "-map",
            "0:v",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        check=True,
    )
    matches = FRAME_COUNT.findall(result.stderr)
    if not matches:
        raise ValueError(f"Could not count frames in {path.name}")
    return int(matches[-1])


def remux(ffmpeg: str, source: Path, target: Path) -> tuple[int, int]:
    """Copy the video stream into MP4 and verify nothing was lost."""
    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            ffmpeg,
            "-y",
            "-v",
            "error",
            "-i",
            str(source),
            "-c:v",
            "copy",
            "-an",
            # Start the output timeline at zero. Remuxing from AVI can
            # leave a start offset (one clip here began at 1.633 s), and
            # browsers handle that badly in opposite directions: Chrome
            # silently clamps every earlier seek to the first frame,
            # while Safari never answers them at all. Both report
            # `seekable` as starting at zero regardless, so the code
            # cannot even detect the situation. Normalising here is far
            # cheaper than teaching the stepper to find a hidden origin.
            "-avoid_negative_ts",
            "make_zero",
            "-muxpreload",
            "0",
            "-muxdelay",
            "0",
            "-movflags",
            "+faststart",
            str(target),
        ],
        check=True,
    )
    return count_frames(ffmpeg, source), count_frames(ffmpeg, target)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("corpus", type=Path, help="Extracted Eyeblink8 root")
    parser.add_argument("output", type=Path, help="Where to write MP4 files")
    args = parser.parse_args(argv)

    sources = sorted(args.corpus.rglob("*.avi"))
    if not sources:
        print(f"No .avi files found under {args.corpus}", file=sys.stderr)
        return 1

    ffmpeg = ffmpeg_path()
    failures = 0

    for source in sources:
        target = args.output / f"{source.stem}.mp4"
        before, after = remux(ffmpeg, source, target)
        ok = before == after
        if not ok:
            failures += 1
        print(
            f"{source.stem}: {before} frames in, {after} out "
            f"{'OK' if ok else 'FRAME COUNT CHANGED, DO NOT USE'}"
        )

    if failures:
        print(
            f"\n{failures} clip(s) changed frame count. The annotations are "
            "indexed by frame, so these cannot be used for evaluation.",
            file=sys.stderr,
        )
        return 1

    print(f"\n{len(sources)} clips remuxed, every frame accounted for.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
