import sys, os, csv, statistics as st
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
OFF = {"26122013_223310_cam": 0, "26122013_224532_cam": 0, "26122013_230103_cam": -1,
       "26122013_230654_cam": 0, "27122013_151644_cam": -1, "27122013_152435_cam": -1,
       "27122013_153916_cam": 0, "27122013_154548_cam": 0}

print("12. SIGNED BIAS of the replay against the shipped app (replay minus app, mm)")
hi, lo = [], []
for c in CLIPS:
    mm = sim.aperture_series(sim.load(c))
    with open(MEAS / f"{c}.seconds.csv") as fh:
        body = [l for l in fh if not l.startswith("#")]
    for r in csv.DictReader(body):
        try:
            t = float(r["timestampMs"]) / 1000.0
            a = float(r["apertureMm"]); b = float(r["baselineMm"])
        except (ValueError, TypeError):
            continue
        k = int(round(t * 30)) + OFF[c]
        if 0 <= k < len(mm) and mm[k] is not None and b:
            (lo if a < 0.6 * b else hi).append(mm[k] - a)
print(f"  open-ish samples (aperture >= 0.6 x baseline): n={len(hi)} median {st.median(hi):+.4f} mm")
print(f"  low samples      (aperture <  0.6 x baseline): n={len(lo)} median {st.median(lo):+.4f} mm")

print()
print("13. SPLITTING RATE: how many annotated blinks receive more than one detection")
for label, getter in (("shipped app", None), ("replay, uncapped", "sim")):
    tot = {}
    for c in CLIPS:
        if getter is None:
            iv = [b.interval() for b in load_blink_log(MEAS / f"{c}.blinks.csv").blinks]
        else:
            ev, _t, _b = sim.simulate(sim.aperture_series(sim.load(c)))
            iv = [Interval(e["startFrame"], e["endFrame"]) for e in ev]
        ann = load_annotation(TAGS[c])
        for bl in ann.blinks:
            n = sum(1 for d in iv if d.overlap(Interval(bl.start_frame, bl.end_frame), 4) > 0)
            tot[n] = tot.get(n, 0) + 1
    multi = sum(v for k, v in tot.items() if k >= 2)
    hit = sum(v for k, v in tot.items() if k >= 1)
    print(f"  {label:18s} blinks with >=1 detection {hit:3d}, of which split into 2+ : "
          f"{multi:3d} ({multi/hit*100:.1f}%)   extra detections spent: "
          f"{sum((k-1)*v for k,v in tot.items() if k>=2)}")

print()
print("14. THE HEADLINE LADDER, all on the shipped app's own exported log")
rs = []
for c in CLIPS:
    ann = load_annotation(TAGS[c])
    annots = [Interval(b.start_frame, b.end_frame) for b in ann.blinks]
    iv = [b.interval() for b in load_blink_log(MEAS / f"{c}.blinks.csv").blinks]
    first = min((d.start_frame for d in iv), default=0)
    keep = [Interval(b.start_frame, b.end_frame) for b in ann.blinks if b.end_frame >= first]
    rs.append((match_blinks(iv, annots), match_blinks(iv, keep)))


def show(label, sel):
    tp = sum(r.true_positives for r in sel); fp = sum(r.false_positives for r in sel)
    fn = sum(r.false_negatives for r in sel)
    R = tp / (tp + fn); P = tp / (tp + fp)
    print(f"  {label:56s} tp={tp:3d} fp={fp:3d} fn={fn:3d} R={R*100:5.1f}% P={P*100:5.1f}% F1={2*P*R/(P+R)*100:5.1f}%")


show("published", [a for a, b in rs])
show("annotated blinks the export cap made unreachable removed", [b for a, b in rs])
