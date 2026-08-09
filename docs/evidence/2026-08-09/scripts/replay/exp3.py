import sys, os, csv, math, statistics as st
sys.path.insert(0, "/PATH/TO/blinklab build/blinklab/analysis")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pathlib import Path
from blinklab.blink_log import load_blink_log
from blinklab.blink_match import Interval, match_blinks
from blinklab.eyeblink8 import load_annotation
import sim

CORPUS = Path("/PATH/TO/blinklab build/datasets/eyeblink8/eyeblink8")
MEAS = Path("/PATH/TO/blinklab build/datasets/eyeblink8-measured")
CLIPS = ["26122013_223310_cam", "26122013_224532_cam", "26122013_230103_cam",
         "26122013_230654_cam", "27122013_151644_cam", "27122013_152435_cam",
         "27122013_153916_cam", "27122013_154548_cam"]
TAGS = {p.stem: p for p in CORPUS.rglob("*.tag")}

print("=" * 88)
print("9. FIDELITY OF THE REPLAY: browser GPU aperture vs this CPU aperture, same frames")
print("=" * 88)
print(f"{'clip':22s} {'n':>5s} {'best frame offset':>18s} {'median |diff| mm':>17s} {'median % diff':>14s}")
for c in CLIPS:
    rows = sim.load(c)
    mm = sim.aperture_series(rows)
    app = []
    with open(MEAS / f"{c}.seconds.csv") as fh:
        body = [l for l in fh if not l.startswith("#")]
    for r in csv.DictReader(body):
        try:
            t = float(r["timestampMs"]); a = float(r["apertureMm"])
        except (ValueError, TypeError):
            continue
        app.append((t / 1000.0, a))
    best = None
    for off in range(-3, 4):
        d = []
        for s, a in app:
            k = int(round(s * 30)) + off
            if 0 <= k < len(mm) and mm[k] is not None:
                d.append(abs(mm[k] - a))
        if d and (best is None or st.median(d) < best[1]):
            best = (off, st.median(d), len(d))
    off, med, n = best
    pct = []
    for s, a in app:
        k = int(round(s * 30)) + off
        if 0 <= k < len(mm) and mm[k] is not None and a > 0:
            pct.append(abs(mm[k] - a) / a * 100)
    print(f"{c:22s} {n:5d} {off:18d} {med:17.3f} {st.median(pct):13.1f}%")

print()
print("=" * 88)
print("10. THE SHIPPED LOG'S OWN CHATTER: gaps between consecutive detections")
print("=" * 88)
gaps = []
inside = {}
for c in CLIPS:
    app = load_blink_log(MEAS / f"{c}.blinks.csv")
    iv = sorted([b.interval() for b in app.blinks], key=lambda x: x.start_frame)
    for a, b in zip(iv, iv[1:]):
        gaps.append(b.start_frame - a.end_frame - 1)
    ann = load_annotation(TAGS[c])
    for bl in ann.blinks:
        n = sum(1 for d in iv if d.overlap(Interval(bl.start_frame, bl.end_frame), 4) > 0)
        inside[n] = inside.get(n, 0) + 1
import collections
h = collections.Counter(gaps)
print("  gap in frames between consecutive exported detections (whole corpus):")
for g in sorted(h):
    if g <= 12:
        print(f"    {g:3d} frames : {h[g]:3d}")
print(f"    >12 frames : {sum(v for k, v in h.items() if k > 12)}")
print(f"  total consecutive pairs: {len(gaps)};  pairs 2 frames apart or less: "
      f"{sum(v for k,v in h.items() if k<=2)} ({sum(v for k,v in h.items() if k<=2)/len(gaps)*100:.1f}%)")
print("\n  how many exported detections land on each annotated blink (tolerance 4):")
for n in sorted(inside):
    print(f"    {n} detections : {inside[n]:3d} annotated blinks")

print()
print("=" * 88)
print("11. WHAT THE 500 ms CEILING COSTS, and where those closures went")
print("=" * 88)
for c in CLIPS:
    ann = load_annotation(TAGS[c])
    long_ann = [b for b in ann.blinks if b.frame_count >= 16]
    lc = None
    with open(MEAS / f"{c}.seconds.csv") as fh:
        body = [l for l in fh if not l.startswith("#")]
    for r in csv.DictReader(body):
        try:
            lc = int(r["longClosureCount"])
        except (ValueError, TypeError):
            pass
    print(f"  {c:22s} annotated closures >= 16 frames: {len(long_ann):2d}   "
          f"longClosureCount logged by the app: {lc}")
