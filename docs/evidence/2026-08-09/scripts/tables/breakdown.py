from __future__ import annotations

import csv
import statistics
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, "/PATH/TO/blinklab build/blinklab/analysis")
from blinklab.blink_log import load_blink_log
from blinklab.blink_match import Interval, match_blinks
from blinklab.eyeblink8 import load_annotation

# The folder autopsy.py wrote the three tables to. Same value as in that file.
OUT = Path("/PATH/TO/output-folder")
CORPUS = Path("/PATH/TO/blinklab build/datasets/eyeblink8/eyeblink8")
MEASURED = Path("/PATH/TO/blinklab build/datasets/eyeblink8-measured")

misses = list(csv.DictReader((OUT / "eyeblink8_misses.csv").open()))
falses = list(csv.DictReader((OUT / "eyeblink8_false_positives.csv").open()))
clips = list(csv.DictReader((OUT / "eyeblink8_clip_summary.csv").open()))

TRUNCATED = {
    c["clip"]
    for c in clips
    if int(c["exportedDetections"]) == 50
    and int(c["firstExportedDetectionFrame"]) > 1000
}
print("clips whose exported log hit the 50 cap AND lost their opening:", sorted(TRUNCATED))
print("clips at exactly 50 exported:", sorted(c["clip"] for c in clips if int(c["exportedDetections"]) == 50))
print()

# ---------- every annotated blink, for the before/after split ----------
all_blinks = []
for tag in sorted(CORPUS.rglob("*.tag")):
    name = tag.stem
    ann = load_annotation(tag)
    log = load_blink_log(MEASURED / f"{name}.blinks.csv")
    detected = [b.interval() for b in log.blinks]
    annotated = [Interval(b.start_frame, b.end_frame) for b in ann.blinks]
    res = match_blinks(detected, annotated)
    matched = {a for _d, a in res.pairs}
    first_exported = min((d.start_frame for d in detected), default=10**9)
    for i, b in enumerate(ann.blinks):
        all_blinks.append(
            {
                "clip": name,
                "start": b.start_frame,
                "end": b.end_frame,
                "sec": b.start_frame / 30.0,
                "closed": b.fully_closed_frames,
                "len": b.frame_count,
                "matched": i in matched,
                "truncated_zone": name in TRUNCATED and b.end_frame < first_exported,
            }
        )

print("TOTAL annotated", len(all_blinks), "matched", sum(b["matched"] for b in all_blinks))
print()

# ---------- warm up ----------
def recall(rows):
    n = len(rows)
    return (sum(r["matched"] for r in rows), n,
            (100.0 * sum(r["matched"] for r in rows) / n) if n else None)

warm = [b for b in all_blinks if b["sec"] < 30.0]
late = [b for b in all_blinks if b["sec"] >= 30.0]
print("WARM UP (baseline ready at second 30 in every clip)")
print("  blinks in first 30 s of a clip:", recall(warm))
print("  blinks after 30 s:            ", recall(late))
warm_clean = [b for b in warm if b["clip"] not in TRUNCATED]
late_clean = [b for b in late if b["clip"] not in TRUNCATED]
print("  excluding the 2 truncated clips:")
print("    first 30 s:", recall(warm_clean))
print("    after 30 s:", recall(late_clean))
print("  per clip first-30s recall:")
for c in sorted({b["clip"] for b in all_blinks}):
    r = [b for b in warm if b["clip"] == c]
    print(f"    {c} {recall(r)}")
print()

# ---------- truncation zone ----------
tz = [b for b in all_blinks if b["truncated_zone"]]
print("TRUNCATION ZONE (annotated blinks that end before the first surviving")
print("exported detection, in the 2 clips whose 50-row log lost its opening)")
print("  ", recall(tz))
for c in sorted(TRUNCATED):
    r = [b for b in tz if b["clip"] == c]
    print(f"    {c}: {len(r)} annotated blinks in the discarded stretch, matched {sum(x['matched'] for x in r)}")
print()

# ---------- miss taxonomy ----------
print("MISS TAXONOMY, 124 misses")
print("  overlapsNF (non frontal):", sum(int(m["overlapsNF"]) for m in misses))
print("  fullyClosedFrames == 0 (partial blink):", sum(1 for m in misses if int(m["fullyClosedFrames"]) == 0))
print("  in a truncated clip's discarded opening:", sum(1 for m in misses if m["clip"] in TRUNCATED and int(m["beforeFirstExportedDetection"])))
print("  startTimeSeconds < 30 (warm up):", sum(1 for m in misses if int(m["inFirstThirtySeconds"])))
print("  faceDetected false at that second:", sum(1 for m in misses if m["faceDetectedAtThatSecond"] != "true"))
gaps = [float(m["maxInterFrameGapInsideBlink"]) for m in misses]
gapse = [float(m["maxInterFrameGapWithEdges"]) for m in misses]
print("  max in-blink gap  >60 ms:", sum(1 for g in gaps if g > 0.060), " >50 ms:", sum(1 for g in gaps if g > 0.050), " >40 ms:", sum(1 for g in gaps if g > 0.040))
print("  with edges        >60 ms:", sum(1 for g in gapse if g > 0.060), " >50 ms:", sum(1 for g in gapse if g > 0.050))
print("  frameLength distribution:", sorted(Counter(int(m["frameLength"]) for m in misses).items()))
print("  fullyClosedFrames distribution:", sorted(Counter(int(m["fullyClosedFrames"]) for m in misses).items()))
print()

matched_blinks = [b for b in all_blinks if b["matched"]]
print("BASE RATES over all 408 annotated blinks")
print("  frameLength: found median", statistics.median([b["len"] for b in matched_blinks]),
      " missed median", statistics.median([int(m["frameLength"]) for m in misses]))
print("  fullyClosedFrames==0 share: found", f"{100*sum(1 for b in matched_blinks if b['closed']==0)/len(matched_blinks):.1f}%",
      " missed", f"{100*sum(1 for m in misses if int(m['fullyClosedFrames'])==0)/len(misses):.1f}%")
print("  frameLength<=4 share: found", f"{100*sum(1 for b in matched_blinks if b['len']<=4)/len(matched_blinks):.1f}%",
      " missed", f"{100*sum(1 for m in misses if int(m['frameLength'])<=4)/len(misses):.1f}%")
print()

# ---------- exclusive attribution, in priority order ----------
print("EXCLUSIVE ATTRIBUTION of the 124 misses, first matching cause wins")
order = []
for m in misses:
    if m["clip"] in TRUNCATED and int(m["beforeFirstExportedDetection"]):
        order.append("export log capped at 50, detection discarded")
    elif int(m["inFirstThirtySeconds"]):
        order.append("warm up, before personal baseline")
    elif int(m["overlapsNF"]):
        order.append("non frontal")
    elif float(m["maxInterFrameGapInsideBlink"]) > 0.050:
        order.append("dropped frame inside the blink")
    elif int(m["fullyClosedFrames"]) == 0:
        order.append("partial blink, never fully closed")
    else:
        order.append("UNEXPLAINED")
for k, v in Counter(order).most_common():
    print(f"  {v:4}  {k}")
print()

# ---------- unexplained, per clip ----------
unexp = [m for m, o in zip(misses, order) if o == "UNEXPLAINED"]
print("UNEXPLAINED per clip:", sorted(Counter(m["clip"] for m in unexp).items()))
print("UNEXPLAINED frameLength:", sorted(Counter(int(m["frameLength"]) for m in unexp).items()))
print("UNEXPLAINED fullyClosedFrames:", sorted(Counter(int(m["fullyClosedFrames"]) for m in unexp).items()))
ap = [float(m["apertureMmAtThatSecond"]) for m in unexp if m["apertureMmAtThatSecond"]]
bl = [float(m["baselineMmAtThatSecond"]) for m in unexp if m["baselineMmAtThatSecond"]]
print("UNEXPLAINED aperture at that second: n", len(ap), "median", round(statistics.median(ap), 2) if ap else None)
print("UNEXPLAINED baseline at that second: n", len(bl), "median", round(statistics.median(bl), 2) if bl else None)
print()

# ---------- false positives ----------
print("FALSE POSITIVES, 45")
print("  in first 30 s:", sum(1 for f in falses if int(f["inFirstThirtySeconds"])))
print("  before baseline ready:", sum(1 for f in falses if int(f["beforeBaselineReady"])))
print("  overlapsNF:", sum(1 for f in falses if int(f["overlapsNF"])))
print("  max in-blink gap >50 ms:", sum(1 for f in falses if float(f["maxInterFrameGapInsideBlink"]) > 0.050))
print("  per clip:", sorted(Counter(f["clip"] for f in falses).items()))
near = [int(f["framesToNearestAnnotatedBlink"]) for f in falses]
print("  frames to nearest annotated blink: min", min(near), "median", statistics.median(near), "max", max(near))
print("  within 10 frames of a real blink (double fire):", sum(1 for n in near if n <= 10))
print("  within 30 frames:", sum(1 for n in near if n <= 30))
print("  >100 frames from any real blink:", sum(1 for n in near if n > 100))
print("  durationMs: median", statistics.median(float(f["durationMs"]) for f in falses),
      "min", min(float(f["durationMs"]) for f in falses),
      "max", max(float(f["durationMs"]) for f in falses))
print("  duration <= 100 ms:", sum(1 for f in falses if float(f["durationMs"]) <= 100))
