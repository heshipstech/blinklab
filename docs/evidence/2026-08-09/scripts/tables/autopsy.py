"""Miss autopsy for the Eyeblink8 run. Reads only; writes to scratch."""
from __future__ import annotations

import csv
import sys
from pathlib import Path

sys.path.insert(0, "/PATH/TO/blinklab build/blinklab/analysis")

from blinklab.blink_log import load_blink_log
from blinklab.blink_match import Interval, match_blinks
from blinklab.eyeblink8 import load_annotation

CORPUS = Path("/PATH/TO/blinklab build/datasets/eyeblink8/eyeblink8")
MEASURED = Path("/PATH/TO/blinklab build/datasets/eyeblink8-measured")
# Where the three tables are written. This ran in a scratch folder, so point
# it at any folder you can write to. Do not point it inside the repository.
OUT = Path("/PATH/TO/output-folder")

INSTRUMENT_FPS = 30.0


def load_nf(tag: Path) -> dict[int, bool]:
    """Per-frame non-frontal flag, which load_annotation only totals."""
    nf: dict[int, bool] = {}
    started = False
    for raw in tag.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if line == "#start":
            started = True
            continue
        if not started or not line or line.startswith("#"):
            continue
        parts = line.split(":")
        if len(parts) != 19:
            continue
        nf[int(parts[0])] = parts[2].strip().upper() == "N"
    return nf


def load_times(txt: Path) -> dict[int, float]:
    times: dict[int, float] = {}
    for raw in txt.read_text(encoding="utf-8", errors="replace").splitlines():
        parts = raw.split()
        if len(parts) != 2:
            continue
        try:
            times[int(parts[0])] = float(parts[1])
        except ValueError:
            continue
    return times


def load_seconds(path: Path) -> list[dict[str, str]]:
    lines = [l for l in path.read_text(encoding="utf-8").splitlines() if not l.startswith("#")]
    return list(csv.DictReader(lines))


def cell(rows: list[dict[str, str]], index: int, key: str) -> str:
    if 0 <= index < len(rows):
        return rows[index].get(key, "") or ""
    return ""


def gap_stats(times: dict[int, float], first: int, last: int) -> tuple[float, float]:
    """Max inter-frame gap strictly inside [first,last], and including one
    frame either side (the frame that enters the blink and the one that
    leaves it)."""
    inside = 0.0
    for f in range(first, last):
        a, b = times.get(f), times.get(f + 1)
        if a is not None and b is not None:
            inside = max(inside, b - a)
    edged = inside
    for f in (first - 1, last):
        a, b = times.get(f), times.get(f + 1)
        if a is not None and b is not None:
            edged = max(edged, b - a)
    return inside, edged


clips = sorted(CORPUS.rglob("*.tag"))
miss_rows: list[dict[str, object]] = []
false_rows: list[dict[str, object]] = []
summary: list[dict[str, object]] = []

for tag in clips:
    name = tag.stem
    ann = load_annotation(tag)
    nf = load_nf(tag)
    times = load_times(tag.with_suffix(".txt"))
    log = load_blink_log(MEASURED / f"{name}.blinks.csv")
    secs = load_seconds(MEASURED / f"{name}.seconds.csv")

    detected = [b.interval() for b in log.blinks]
    annotated = [Interval(b.start_frame, b.end_frame) for b in ann.blinks]
    result = match_blinks(detected, annotated)
    matched_a = {a for _d, a in result.pairs}
    matched_d = {d for d, _a in result.pairs}

    # First second whose baselineMm is non-empty: the moment the personal
    # threshold replaced the fixed 4 mm fallback.
    ready_second: int | None = None
    for i, row in enumerate(secs):
        if (row.get("baselineMm") or "").strip():
            ready_second = i
            break

    first_exported_frame = min((d.start_frame for d in detected), default=None)
    last_exported_frame = max((d.end_frame for d in detected), default=None)

    # Drift between the original capture clock and the instrument's
    # constant 30 fps clock, at the last annotated frame.
    last_frame = max(times) if times else 0
    drift = (times.get(last_frame, 0.0) - last_frame / INSTRUMENT_FPS)

    for index, b in enumerate(ann.blinks):
        t_txt = times.get(b.start_frame)
        t_inst = b.start_frame / INSTRUMENT_FPS
        sec_inst = int(t_inst)
        inside, edged = gap_stats(times, b.start_frame, b.end_frame)
        overlaps_nf = any(nf.get(f, False) for f in range(b.start_frame, b.end_frame + 1))
        row = {
            "clip": name,
            "blink_id": b.blink_id,
            "startFrame": b.start_frame,
            "endFrame": b.end_frame,
            "frameLength": b.frame_count,
            "fullyClosedFrames": b.fully_closed_frames,
            "overlapsNF": int(overlaps_nf),
            "startTimeSeconds": "" if t_txt is None else round(t_txt, 4),
            "startTimeSecondsAt30fps": round(t_inst, 4),
            "inFirstThirtySeconds": int((t_txt if t_txt is not None else t_inst) < 30.0),
            "maxInterFrameGapInsideBlink": round(inside, 4),
            "maxInterFrameGapWithEdges": round(edged, 4),
            "secondsRowIndex": sec_inst,
            "apertureMmAtThatSecond": cell(secs, sec_inst, "apertureMm"),
            "baselineMmAtThatSecond": cell(secs, sec_inst, "baselineMm"),
            "shutBaselineMmAtThatSecond": cell(secs, sec_inst, "shutBaselineMm"),
            "faceDetectedAtThatSecond": cell(secs, sec_inst, "faceDetected"),
            "baselineReadySecond": "" if ready_second is None else ready_second,
            "beforeBaselineReady": int(
                ready_second is not None and sec_inst < ready_second
            ),
            "beforeFirstExportedDetection": int(
                first_exported_frame is not None and b.end_frame < first_exported_frame
            ),
            "matched": int(index in matched_a),
        }
        if index not in matched_a:
            miss_rows.append(row)

    for index, d in enumerate(log.blinks):
        if index in matched_d:
            continue
        t_txt = times.get(d.start_frame)
        t_inst = d.start_frame / INSTRUMENT_FPS
        sec_inst = int(t_inst)
        inside, edged = gap_stats(times, d.start_frame, d.end_frame)
        overlaps_nf = any(
            nf.get(f, False) for f in range(d.start_frame, d.end_frame + 1)
        )
        # Distance in frames to the closest annotated blink.
        nearest = min(
            (
                min(
                    abs(d.start_frame - a.end_frame),
                    abs(a.start_frame - d.end_frame),
                )
                if (d.end_frame < a.start_frame or d.start_frame > a.end_frame)
                else 0
            )
            for a in annotated
        ) if annotated else -1
        false_rows.append(
            {
                "clip": name,
                "startFrame": d.start_frame,
                "endFrame": d.end_frame,
                "frameLength": d.end_frame - d.start_frame + 1,
                "durationMs": round(d.duration_ms, 1),
                "overlapsNF": int(overlaps_nf),
                "startTimeSeconds": "" if t_txt is None else round(t_txt, 4),
                "startTimeSecondsAt30fps": round(t_inst, 4),
                "inFirstThirtySeconds": int(
                    (t_txt if t_txt is not None else t_inst) < 30.0
                ),
                "maxInterFrameGapInsideBlink": round(inside, 4),
                "maxInterFrameGapWithEdges": round(edged, 4),
                "secondsRowIndex": sec_inst,
                "apertureMmAtThatSecond": cell(secs, sec_inst, "apertureMm"),
                "baselineMmAtThatSecond": cell(secs, sec_inst, "baselineMm"),
                "shutBaselineMmAtThatSecond": cell(secs, sec_inst, "shutBaselineMm"),
                "faceDetectedAtThatSecond": cell(secs, sec_inst, "faceDetected"),
                "baselineReadySecond": "" if ready_second is None else ready_second,
                "beforeBaselineReady": int(
                    ready_second is not None and sec_inst < ready_second
                ),
                "framesToNearestAnnotatedBlink": nearest,
            }
        )

    summary.append(
        {
            "clip": name,
            "annotated": len(annotated),
            "exportedDetections": len(detected),
            "tp": result.true_positives,
            "fn": result.false_negatives,
            "fp": result.false_positives,
            "frames": ann.frame_count,
            "clipSecondsTxt": round(times.get(last_frame, 0.0), 2) if times else 0,
            "clipSeconds30fps": round(ann.frame_count / INSTRUMENT_FPS, 2),
            "clockDriftSeconds": round(drift, 2),
            "baselineReadySecond": ready_second,
            "firstExportedDetectionFrame": first_exported_frame,
            "lastExportedDetectionFrame": last_exported_frame,
            "nonFrontalFrames": ann.non_frontal_frames,
        }
    )

miss_fields = list(miss_rows[0].keys())
with (OUT / "eyeblink8_misses.csv").open("w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=miss_fields)
    w.writeheader()
    w.writerows(miss_rows)

false_fields = list(false_rows[0].keys())
with (OUT / "eyeblink8_false_positives.csv").open("w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=false_fields)
    w.writeheader()
    w.writerows(false_rows)

with (OUT / "eyeblink8_clip_summary.csv").open("w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(summary[0].keys()))
    w.writeheader()
    w.writerows(summary)

print("misses", len(miss_rows), "false", len(false_rows))
for s in summary:
    print(s)
