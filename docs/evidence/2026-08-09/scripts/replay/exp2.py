import sys, os, json, math, statistics as st
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
ROWS = {c: sim.load(c) for c in CLIPS}
ANN = {c: load_annotation(TAGS[c]) for c in CLIPS}
ANNI = {c: [Interval(b.start_frame, b.end_frame) for b in ANN[c].blinks] for c in CLIPS}
BLINKFRAMES = {}
for c in CLIPS:
    s = set()
    for line in TAGS[c].read_text(errors="replace").splitlines():
        f = line.strip().split(":")
        if len(f) == 19 and not line.startswith("#"):
            try:
                if int(f[1]) != -1:
                    s.add(int(f[0]))
            except ValueError:
                pass
    BLINKFRAMES[c] = s


def series(c, mode, gate=True):
    rows = ROWS[c]
    ok = [r for r in rows if r.get("face") == 478 and r.get("rIris")]
    iris_open = st.median([(r["rIris"] + r["lIris"]) / 2 for r in ok
                           if r["i"] not in BLINKFRAMES[c]]) if ok else None
    out = []
    for r in rows:
        v = None
        if r.get("face") == 478 and r.get("rMm") is not None:
            if (not gate) or r.get("gate") == "valid":
                if mode == "mm":
                    v = (r["rMm"] + r["lMm"]) / 2
                elif mode == "px":                      # ruler removed entirely
                    v = (r["rPx"] + r["lPx"]) / 2
                elif mode == "frozen_iris":             # ruler held at its open-eye value
                    v = ((r["rPx"] + r["lPx"]) / 2) * (11.7 / iris_open)
        out.append(v)
    return out


def pooled(rs):
    tp = sum(r.true_positives for r in rs); fp = sum(r.false_positives for r in rs)
    fn = sum(r.false_negatives for r in rs)
    rec = tp / (tp + fn) if tp + fn else 0
    pre = tp / (tp + fp) if tp + fp else 0
    return tp, fp, fn, rec * 100, pre * 100, (2 * pre * rec / (pre + rec) * 100 if pre + rec else 0)


def go(label, mode="mm", gate=True, **kw):
    rs, per = [], []
    for c in CLIPS:
        ev, thr, base = sim.simulate(series(c, mode, gate), **kw)
        r = match_blinks([Interval(e["startFrame"], e["endFrame"]) for e in ev], ANNI[c])
        rs.append(r); per.append((c, len(ev), r.true_positives, r.false_positives, r.false_negatives))
    tp, fp, fn, rc, pr, f1 = pooled(rs)
    print(f"  {label:54s} {tp:4d} {fp:4d} {fn:4d} {rc:6.1f} {pr:6.1f} {f1:6.1f}")
    return per


print("=" * 90)
print("5. THE IRIS RULER, COUNTERFACTUAL: what the shrinking ruler costs")
print("=" * 90)
print(f"  {'configuration':54s} {'tp':>4s} {'fp':>4s} {'fn':>4s} {'R%':>6s} {'P%':>6s} {'F1%':>6s}")
go("SHIPPED: aperture in mm, per-frame iris ruler")
go("ruler frozen at its open-eye value (shrink removed)", mode="frozen_iris")
go("ruler removed entirely, raw pixels", mode="px")
go("no pose gate (validityGate.ts disabled)", gate=False)
go("no pose gate AND no export-style refusals", gate=False, learn_ms=0)

print()
print("=" * 90)
print("6. PER CLIP, python replay with the 50-row export cap REMOVED")
print("=" * 90)
per = go("uncapped", )
print(f"  {'clip':22s} {'ann':>4s} {'det':>4s} {'tp':>4s} {'fp':>4s} {'fn':>4s} {'R%':>6s}"
      f"  | shipped R%")
shipped = {}
for c in CLIPS:
    app = load_blink_log(MEAS / f"{c}.blinks.csv")
    r = match_blinks([b.interval() for b in app.blinks], ANNI[c])
    shipped[c] = r.true_positives / len(ANNI[c]) * 100
for c, n, tp, fp, fn in per:
    print(f"  {c:22s} {len(ANNI[c]):4d} {n:4d} {tp:4d} {fp:4d} {fn:4d} "
          f"{tp/len(ANNI[c])*100:6.1f}  | {shipped[c]:6.1f}")

print()
print("=" * 90)
print("7. THE SHIPPED OUTPUT ITSELF: are its 45 false positives split blinks")
print("=" * 90)


def merge(iv, gap):
    if not iv:
        return []
    iv = sorted(iv, key=lambda x: x.start_frame)
    out = [iv[0]]
    for x in iv[1:]:
        if x.start_frame - out[-1].end_frame - 1 <= gap:
            out[-1] = Interval(out[-1].start_frame, max(out[-1].end_frame, x.end_frame))
        else:
            out.append(x)
    return out


for gap in (0, 1, 2, 3, 5, 8, 12):
    rs = []
    for c in CLIPS:
        app = load_blink_log(MEAS / f"{c}.blinks.csv")
        rs.append(match_blinks(merge([b.interval() for b in app.blinks], gap), ANNI[c]))
    tp, fp, fn, rc, pr, f1 = pooled(rs)
    print(f"  shipped log, detections merged when <= {gap:2d} frames apart:"
          f" tp={tp:3d} fp={fp:3d} fn={fn:3d} R={rc:5.1f}% P={pr:5.1f}% F1={f1:5.1f}%")

print()
print("=" * 90)
print("8. WHERE THE REMAINING MISSES LIVE (uncapped replay)")
print("=" * 90)
buckets = {}
for c in CLIPS:
    ev, thr, base = sim.simulate(series(c, "mm"))
    r = match_blinks([Interval(e["startFrame"], e["endFrame"]) for e in ev], ANNI[c])
    found = {a for _d, a in r.pairs}
    for i, b in enumerate(ANN[c].blinks):
        k = ("FC=0 partial" if b.fully_closed_frames == 0 else
             "closure > 500 ms" if b.frame_count >= 16 else "ordinary")
        buckets.setdefault(k, [0, 0])
        buckets[k][0] += 1
        buckets[k][1] += 1 if i in found else 0
for k, (n, f) in sorted(buckets.items()):
    print(f"  {k:20s} n={n:3d} found={f:3d} recall={f/n*100:5.1f}%  misses={n-f}")
