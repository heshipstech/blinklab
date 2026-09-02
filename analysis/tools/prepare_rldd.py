"""Flatten UTA-RLDD's fold/subject/label tree into the flat .mp4 folder
the corpus runner measures, trimmed to the window the plan uses.

UTA-RLDD is used under written permission from Professor Vassilis
Athitsos, recorded in DATASETS.md. This tool only prepares video for
LOCAL feature extraction. The safeguards are not relaxed: numbers only,
never a frame, the source video deleted once its features exist, and no
frame from this dataset may ever be published (only 36 of 60
participants consented to face publication and the mapping is not
released). The evaluation plan is docs/uta-rldd-plan.md.

What it does, per source video:

- Derives the SUBJECT and the drowsiness LABEL from the file's path.
  UTA-RLDD is organised fold / subject / label, with the label as a
  KSS-derived code in the file name: 0 alert, 5 low vigilant, 10 drowsy.
  The subject id is prefixed with the fold, because leave-one-subject-out
  needs each subject to be exactly one group and subject numbers can
  repeat across folds (docs/uta-rldd-plan.md).
- Writes a flat `<subject>_<label>.mp4` whose name the corpus runner
  turns into `<subject>_<label>.seconds.csv`, so the label and the LOSO
  group survive into the analysis.
- Keeps only the FIRST SIX MINUTES (`-t 360`): a thirty second baseline,
  a settle, then the 60 to 360 second window the plan medians over. This
  roughly halves the stepped-measurement time versus the ten minute
  originals.
- REMUXES (stream copy) rather than re-encoding, which is far faster and
  lossless. UTA-RLDD's phone recordings are H.264, which browsers
  decode; a clip that will not play surfaces as a runner failure rather
  than a silent wrong number, and can be re-encoded then.

Run it once, locally. Dry run first (no --go) to check the mapping:

    uv sync --group corpus
    uv run python analysis/tools/prepare_rldd.py <root> <out>   # dry run
    uv run python analysis/tools/prepare_rldd.py <root> <out> --fold 1 --go

ffmpeg comes from the pinned imageio-ffmpeg package when it is
installed (the same as prepare_eyeblink8.py), and falls back to a system
ffmpeg on PATH otherwise, so a plain `brew install ffmpeg` also works.
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

VIDEO_SUFFIXES = frozenset({".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"})

# The first six minutes: 30 s baseline + 30 s settle + the 60-360 s
# window docs/uta-rldd-plan.md medians over.
WINDOW_SECONDS = 360

_FOLD = re.compile(r"fold[\s_-]*0*(\d+)", re.IGNORECASE)
_LABEL_CODES = {"0": "alert", "5": "lowvigilant", "10": "drowsy"}


class PrepareError(ValueError):
    """Raised rather than guessing. A path this tool cannot read
    confidently is more useful as a named refusal than as a video
    filed under the wrong subject or label."""


@dataclass(frozen=True)
class ClipPlan:
    """What one source video becomes: which subject, which label, and
    the flat output name the runner will turn into a CSV."""

    source: Path
    subject: str
    label: str
    fold: int | None

    @property
    def output_name(self) -> str:
        return f"{self.subject}_{self.label}.mp4"


def _sanitise(part: str) -> str:
    """A path fragment reduced to letters and digits, so a subject id is
    a single token the CSV name can carry without ambiguity."""
    return re.sub(r"[^0-9A-Za-z]", "", part)


def label_of(source: Path) -> str | None:
    """The drowsiness class this video declares, or None if unreadable.

    The KSS code in the file name is tried first (0/5/10, the dataset's
    own convention), then a keyword anywhere in the path as a fallback
    for mirrors that renamed the files. An unrecognised label returns
    None so the caller can skip and warn rather than mislabel."""
    stem = source.stem.strip().lower()
    if stem in _LABEL_CODES:
        return _LABEL_CODES[stem]
    hay = str(source).lower()
    if "drows" in hay or "sleep" in hay:
        return "drowsy"
    if "lowvigil" in hay or "low_vigil" in hay or "low-vigil" in hay:
        return "lowvigilant"
    if "alert" in hay:
        return "alert"
    return None


def fold_of(source: Path, root: Path) -> int | None:
    """The fold number from the path below root, or None if absent."""
    try:
        relative = source.relative_to(root)
    except ValueError:
        relative = source
    for part in relative.parts:
        match = _FOLD.fullmatch(part) or _FOLD.search(part)
        if match:
            return int(match.group(1))
    return None


def subject_of(source: Path, fold: int | None) -> str:
    """A subject id unique across the whole dataset.

    The immediate parent folder names the subject within a fold; the
    fold is prefixed because subject numbers can repeat across folds and
    leave-one-subject-out must not put one person in two groups."""
    parent = _sanitise(source.parent.name) or "unknown"
    return f"f{fold}s{parent}" if fold is not None else f"s{parent}"


def plan_clip(source: Path, root: Path) -> ClipPlan | None:
    """Everything needed to place one video, or None if its label cannot
    be read (the one thing there is no safe default for)."""
    label = label_of(source)
    if label is None:
        return None
    fold = fold_of(source, root)
    return ClipPlan(
        source=source,
        subject=subject_of(source, fold),
        label=label,
        fold=fold,
    )


def plan_corpus(
    root: Path, only_fold: int | None
) -> tuple[list[ClipPlan], list[Path]]:
    """Every video under root as a ClipPlan, plus the ones skipped for an
    unreadable label. Sorted so a run is reproducible."""
    plans: list[ClipPlan] = []
    skipped: list[Path] = []
    for source in sorted(root.rglob("*")):
        if source.suffix.lower() not in VIDEO_SUFFIXES:
            continue
        plan = plan_clip(source, root)
        if plan is None:
            skipped.append(source)
            continue
        if only_fold is not None and plan.fold != only_fold:
            continue
        plans.append(plan)
    return plans, skipped


def ffmpeg_path() -> str:
    """The pinned imageio-ffmpeg if present, else a system ffmpeg."""
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        system = shutil.which("ffmpeg")
        if system is None:
            raise SystemExit(
                "No ffmpeg. Run `uv sync --group corpus`, or "
                "`brew install ffmpeg`."
            ) from None
        return system


def remux_window(ffmpeg: str, plan: ClipPlan, target: Path) -> None:
    """Copy the first WINDOW_SECONDS of the video stream into a flat MP4.

    A stream copy, not a re-encode: fast and lossless. The timeline is
    normalised to start at zero for the same reason prepare_eyeblink8
    does it, so the browser stepper is not handed a hidden start offset."""
    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            ffmpeg,
            "-y",
            "-v",
            "error",
            "-t",
            str(WINDOW_SECONDS),
            "-i",
            str(plan.source),
            "-c:v",
            "copy",
            "-an",
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


def _summarise(plans: list[ClipPlan]) -> str:
    labels: dict[str, int] = {}
    for plan in plans:
        labels[plan.label] = labels.get(plan.label, 0) + 1
    subjects = len({plan.subject for plan in plans})
    parts = ", ".join(
        f"{name} {count}" for name, count in sorted(labels.items())
    )
    return f"{len(plans)} videos, {subjects} subjects ({parts})"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path, help="Extracted UTA-RLDD root")
    parser.add_argument("output", type=Path, help="Where to write flat MP4s")
    parser.add_argument(
        "--fold",
        type=int,
        default=None,
        help="Only this fold (e.g. --fold 1 for the pilot)",
    )
    parser.add_argument(
        "--go",
        action="store_true",
        help="Actually transcode. Without it this is a dry run.",
    )
    args = parser.parse_args(argv)

    if not args.root.is_dir():
        print(f"No such folder: {args.root}", file=sys.stderr)
        return 1

    plans, skipped = plan_corpus(args.root, args.fold)
    if not plans:
        print(
            f"No videos with a readable label under {args.root}"
            + (f" for fold {args.fold}" if args.fold is not None else ""),
            file=sys.stderr,
        )
        return 1

    print(_summarise(plans))
    for plan in plans:
        print(f"  {plan.output_name:<28} <- {plan.source}")
    if skipped:
        print(f"\nSkipped {len(skipped)} file(s) with no readable label:")
        for source in skipped:
            print(f"  {source}")

    if not args.go:
        print("\nDry run. Re-run with --go to transcode.")
        return 0

    ffmpeg = ffmpeg_path()
    for index, plan in enumerate(plans, start=1):
        target = args.output / plan.output_name
        print(f"[{index}/{len(plans)}] {plan.output_name}")
        remux_window(ffmpeg, plan, target)
    print(f"\n{len(plans)} clips prepared in {args.output}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
