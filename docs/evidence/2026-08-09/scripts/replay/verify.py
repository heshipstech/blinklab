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


def ann_intervals(name):
    a = load_annotation(TAGS[name])
    return a, [Interval(b.start_frame, b.end_frame) for b in a.blinks]


def score(events, annots):
    det = [Interval(e["startFrame"], e["endFrame"]) for e in events
           if e["startFrame"] is not None]
    return match_blinks(det, annots)


def pooled(rs):
    tp = sum(r.true_positives for r in rs); fp = sum(r.false_positives for r in rs)
    fn = sum(r.false_negatives for r in rs)
    rec = tp / (tp + fn) if tp + fn else 0
    pre = tp / (tp + fp) if tp + fp else 0
    f1 = 2 * pre * rec / (pre + rec) if pre + rec else 0
    return tp, fp, fn, rec, pre, f1


print("=" * 78)
print("A. FIDELITY: python replay of the ported state machines vs the shipped app")
print("=" * 78)
cache = {}
for c in CLIPS:
    rows = sim.load(c)
    mm = sim.aperture_series(rows)
    cache[c] = (rows, mm)
    ev_uncapped, thr, base = sim.simulate(mm)
    ev_capped = ev_uncapped[-50:] if len(ev_uncapped) > 50 else ev_uncapped
    a, annots = ann_intervals(c)
    app = load_blink_log(MEAS / f"{c}.blinks.csv")
    r_app = match_blinks([b.interval() for b in app.blinks], annots)
    r_sim = score(ev_capped, annots)
    r_unc = score(ev_uncapped, annots)
    print(f"{c}  app: n={len(app.blinks):3d} tp={r_app.true_positives:3d} fp={r_app.false_positives:3d} "
          f"| sim capped: n={len(ev_capped):3d} tp={r_sim.true_positives:3d} fp={r_sim.false_positives:3d} "
          f"| sim uncapped: n={len(ev_uncapped):3d} tp={r_unc.true_positives:3d} fp={r_unc.false_positives:3d}")

print()
print("=" * 78)
print("B. WHAT THE 50-ROW EXPORT CAP COSTS")
print("=" * 78)
rs_app, rs_cap, rs_unc = [], [], []
for c in CLIPS:
    rows, mm = cache[c]
    ev, thr, base = sim.simulate(mm)
    a, annots = ann_intervals(c)
    app = load_blink_log(MEAS / f"{c}.blinks.csv")
    rs_app.append(match_blinks([b.interval() for b in app.blinks], annots))
    rs_cap.append(score(ev[-50:] if len(ev) > 50 else ev, annots))
    rs_unc.append(score(ev, annots))
for label, rs in (("shipped app (cap 50)", rs_app), ("sim, cap 50", rs_cap), ("sim, NO cap", rs_unc)):
    tp, fp, fn, rec, pre, f1 = pooled(rs)
    print(f"  {label:24s} tp={tp:3d} fp={fp:3d} fn={fn:3d}  R={rec*100:5.1f}%  P={pre*100:5.1f}%  F1={f1*100:5.1f}%")

print()
print("=" * 78)
print("C. THE APERTURE FLOOR: what a fully-closed eye actually reads")
print("=" * 78)
print(f"{'clip':22s} {'baseline':>9s} {'thr(0.5)':>9s} {'arm(0.45)':>9s} {'shut(0.4)':>9s}"
      f" {'FCmedian':>9s} {'FC/base':>8s} {'open med':>9s}")
floors = {}
for c in CLIPS:
    rows, mm = cache[c]
    ev, thr, base = sim.simulate(mm)
    a, _ = ann_intervals(c)
    fc_frames = set()
    blink_frames = set()
    import re
    for line in TAGS[c].read_text(errors="replace").splitlines():
        if line.startswith("#") or ":" not in line:
            continue
        f = line.strip().split(":")
        if len(f) != 19:
            continue
        try:
            fi = int(f[0]); bid = int(f[1])
        except ValueError:
            continue
        if bid != -1:
            blink_frames.add(fi)
            if f[3] == "C" or f[5] == "C":
                fc_frames.add(fi)
    n = len(mm)
    fcv = [mm[i] / base[i] for i in fc_frames if i < n and mm[i] is not None and base[i]]
    openv = [mm[i] / base[i] for i in range(n) if i not in blink_frames and mm[i] is not None and base[i]]
    bmed = st.median([b for b in base if b]) if any(base) else None
    floors[c] = dict(fc=sorted(fcv), open=sorted(openv))
    print(f"{c:22s} {bmed:9.3f} {bmed*0.5:9.3f} {bmed*0.45:9.3f} {bmed*0.4:9.3f}"
          f" {st.median(fcv)*bmed if fcv else 0:9.3f} {st.median(fcv) if fcv else 0:8.3f}"
          f" {st.median(openv) if openv else 0:9.3f}")

allfc = sorted(x for c in CLIPS for x in floors[c]["fc"])
allop = sorted(x for c in CLIPS for x in floors[c]["open"])


def q(v, p):
    return v[max(0, min(len(v) - 1, int(round(p / 100 * (len(v) - 1)))))]


print(f"\nCORPUS, aperture / concurrent baseline at annotated FULLY CLOSED frames (n={len(allfc)}):")
print(f"  p05 {q(allfc,5):.3f}  p25 {q(allfc,25):.3f}  median {q(allfc,50):.3f}  p75 {q(allfc,75):.3f}  p95 {q(allfc,95):.3f}")
print(f"  share of fully-closed frames NOT below the 0.50 blink line : {sum(1 for x in allfc if x>=0.50)/len(allfc)*100:.1f}%")
print(f"  share of fully-closed frames NOT below the 0.45 ARM line   : {sum(1 for x in allfc if x>0.45)/len(allfc)*100:.1f}%")
print(f"CORPUS, same ratio on non-blink (open) frames (n={len(allop)}):")
print(f"  p05 {q(allop,5):.3f}  median {q(allop,50):.3f}  p95 {q(allop,95):.3f}")
print(f"  share of OPEN frames already below the 0.50 blink line: {sum(1 for x in allop if x<0.50)/len(allop)*100:.2f}%")

json.dump({c: floors[c] for c in CLIPS}, open(os.path.dirname(os.path.abspath(__file__)) + "/floors.json", "w"))
