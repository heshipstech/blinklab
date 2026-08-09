import sys, os, csv, json
sys.path.insert(0, "/PATH/TO/blinklab build/blinklab/analysis")
from pathlib import Path
from blinklab.blink_log import load_blink_log
from blinklab.blink_match import Interval, match_blinks
from blinklab.eyeblink8 import load_annotation

CORPUS = Path("/PATH/TO/blinklab build/datasets/eyeblink8/eyeblink8")
MEAS = Path("/PATH/TO/blinklab build/datasets/eyeblink8-measured")

rows = []
clipinfo = {}
for tag in sorted(CORPUS.rglob("*.tag")):
    name = tag.stem
    log = load_blink_log(MEAS / f"{name}.blinks.csv")
    ann = load_annotation(tag)
    det = [b.interval() for b in log.blinks]
    annot = [Interval(b.start_frame, b.end_frame) for b in ann.blinks]
    res = match_blinks(det, annot)
    matched_a = {a for _d, a in res.pairs}
    matched_d = {d for d, _a in res.pairs}
    first_exp = min((d.start_frame for d in det), default=None)
    last_exp = max((d.end_frame for d in det), default=None)
    clipinfo[name] = dict(n_ann=len(annot), n_det=len(det), tp=res.true_positives,
                          fp=res.false_positives, fn=res.false_negatives,
                          first_exported_start=first_exp, last_exported_end=last_exp,
                          capped=len(det) >= 50)
    for i, b in enumerate(ann.blinks):
        fcs = None
        try:
            fcs = b.fully_closed_frames
        except Exception:
            fcs = None
        rows.append(dict(clip=name, idx=i, start=b.start_frame, end=b.end_frame,
                         length=b.end_frame - b.start_frame + 1,
                         fc=fcs,
                         found=i in matched_a,
                         before_first_export=(first_exp is not None and b.end_frame < first_exp),
                         start_s_at30=b.start_frame / 30.0))

print(json.dumps(clipinfo, indent=1))

def rate(sel):
    n = len(sel); k = sum(1 for r in sel if r["found"])
    return n, k, (k / n * 100 if n else None)

allr = rows
print("\nCORPUS", rate(allr))

# warm-up: baseline becomes ready at t=30 s = frame 900 on the 30 fps instrument clock
inlog = [r for r in allr if not r["before_first_export"]]
print("in-log-coverage", rate(inlog))
warm = [r for r in inlog if r["start_s_at30"] < 30]
cold = [r for r in inlog if r["start_s_at30"] >= 30]
print("first 30 s (fixed 4.0 mm threshold)", rate(warm))
print("after 30 s (0.5 x baseline)        ", rate(cold))

# by fully closed frames
import collections
buckets = collections.defaultdict(list)
for r in inlog:
    fc = r["fc"]
    k = "0" if fc == 0 else "1-2" if fc <= 2 else "3-4" if fc <= 4 else "5-7" if fc <= 7 else "8-14" if fc <= 14 else "15+"
    buckets[k].append(r)
print("\nrecall by annotated fully-closed frames (log-covered blinks only)")
for k in ["0", "1-2", "3-4", "5-7", "8-14", "15+"]:
    if k in buckets:
        n, kk, p = rate(buckets[k])
        print(f"  FC {k:>4}  n={n:3d}  found={kk:3d}  recall={p:5.1f}%")

# per clip warm/cold
print("\nper clip: warm-up vs steady, log-covered only")
for c in sorted(clipinfo):
    w = [r for r in inlog if r["clip"] == c and r["start_s_at30"] < 30]
    d = [r for r in inlog if r["clip"] == c and r["start_s_at30"] >= 30]
    print(f"  {c}  warm {rate(w)}  steady {rate(d)}")

with open(os.path.dirname(os.path.abspath(__file__)) + "/misses.json", "w") as fh:
    json.dump(dict(rows=rows, clipinfo=clipinfo), fh)
