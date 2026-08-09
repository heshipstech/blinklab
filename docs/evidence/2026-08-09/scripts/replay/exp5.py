import sys, os, random, statistics as st
sys.path.insert(0, "/PATH/TO/blinklab build/blinklab/analysis")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pathlib import Path
from blinklab.blink_match import Interval, match_blinks
from blinklab.eyeblink8 import load_annotation
import sim

CORPUS = Path("/PATH/TO/blinklab build/datasets/eyeblink8/eyeblink8")
CLIPS = ["26122013_223310_cam", "26122013_224532_cam", "26122013_230103_cam",
         "26122013_230654_cam", "27122013_151644_cam", "27122013_152435_cam",
         "27122013_153916_cam", "27122013_154548_cam"]
TAGS = {p.stem: p for p in CORPUS.rglob("*.tag")}
S = {c: sim.aperture_series(sim.load(c)) for c in CLIPS}
ANN = {c: load_annotation(TAGS[c]) for c in CLIPS}
ANNI = {c: [Interval(b.start_frame, b.end_frame) for b in ANN[c].blinks] for c in CLIPS}

print("15. FRAME-TO-FRAME JITTER of the aperture signal, open frames only")
for c in CLIPS:
    s = S[c]
    d = [abs(s[i] - s[i - 1]) for i in range(1, len(s))
         if s[i] is not None and s[i - 1] is not None]
    print(f"  {c:22s} median |delta| between adjacent frames: {st.median(d):.4f} mm")

print()
print("16. HOW MUCH EXTRA NOISE REPRODUCES THE SHIPPED APP'S BEHAVIOUR")
print("   (shipped: 45 false positives, 14.4% of found blinks split into 2 or more)")
print(f"   {'added noise sd':>15s} {'tp':>4s} {'fp':>4s} {'R%':>6s} {'P%':>6s} {'F1%':>6s} {'split%':>7s}")
for sd in (0.0, 0.02, 0.05, 0.08, 0.12, 0.18, 0.25):
    random.seed(7)
    TP = FP = FN = 0
    hit = multi = 0
    for c in CLIPS:
        s = [None if v is None else v + random.gauss(0, sd) for v in S[c]]
        ev, _t, _b = sim.simulate(s)
        iv = [Interval(e["startFrame"], e["endFrame"]) for e in ev]
        r = match_blinks(iv, ANNI[c])
        TP += r.true_positives; FP += r.false_positives; FN += r.false_negatives
        for bl in ANN[c].blinks:
            n = sum(1 for d in iv if d.overlap(Interval(bl.start_frame, bl.end_frame), 4) > 0)
            if n >= 1:
                hit += 1
            if n >= 2:
                multi += 1
    R = TP / (TP + FN); P = TP / (TP + FP)
    print(f"   {sd:15.3f} {TP:4d} {FP:4d} {R*100:6.1f} {P*100:6.1f} "
          f"{2*P*R/(P+R)*100:6.1f} {multi/hit*100:6.1f}%")

print()
print("17. THE SAME NOISE, with a one-frame reopen guard added to blink.ts")
print("   (a closure ends only after the aperture has been above the line for 2 frames)")


def simulate_guard(mm_series, fps=30.0, hold=2):
    thrf, hys, maxms = 0.5, 0.1, 500
    bstate = None; eye = "unknown"; closed_at = None; caf = None; armed = False
    above = 0; events = []
    for i, mm in enumerate(mm_series):
        now = i * 1000.0 / fps
        if bstate is None:
            bstate = ["learning", now, []]
        if bstate[0] == "learning":
            if mm is not None:
                bstate[2].append(mm)
            if now - bstate[1] >= 30000 and len(bstate[2]) >= 100:
                b = sim.bounded_baseline(bstate[2])
                if b is not None:
                    bstate = ["ready", b, []]
        else:
            if mm is not None:
                bstate[2].append(mm)
                bstate[2] = bstate[2][-600:]
                if len(bstate[2]) >= 300:
                    cand = sim.bounded_baseline(bstate[2])
                    if cand is not None and cand > bstate[1]:
                        bstate[1] = cand
        thr = bstate[1] * thrf if bstate[0] == "ready" else 4.0
        if mm is None:
            eye, closed_at, armed, caf, above = "unknown", None, False, None, 0
            continue
        if mm < thr:
            if eye != "closed":
                closed_at, caf = now, i
            armed = (eye == "closed" and armed) or (mm <= thr * (1 - hys))
            eye, above = "closed", 0
        else:
            if eye == "closed":
                above += 1
                if above < hold:
                    continue          # not yet a reopen
                dur = now - closed_at if closed_at is not None else None
                if dur is not None and dur <= maxms and armed:
                    events.append(dict(startFrame=caf, endFrame=i))
                eye, closed_at, armed, caf, above = "open", None, False, None, 0
            else:
                eye = "open"
    return events


for sd in (0.0, 0.08, 0.18):
    random.seed(7)
    TP = FP = FN = 0; hit = multi = 0
    for c in CLIPS:
        s = [None if v is None else v + random.gauss(0, sd) for v in S[c]]
        ev = simulate_guard(s)
        iv = [Interval(e["startFrame"], e["endFrame"]) for e in ev]
        r = match_blinks(iv, ANNI[c])
        TP += r.true_positives; FP += r.false_positives; FN += r.false_negatives
        for bl in ANN[c].blinks:
            n = sum(1 for d in iv if d.overlap(Interval(bl.start_frame, bl.end_frame), 4) > 0)
            if n >= 1:
                hit += 1
            if n >= 2:
                multi += 1
    R = TP / (TP + FN); P = TP / (TP + FP)
    print(f"   noise sd {sd:.2f}: tp={TP:3d} fp={FP:3d} R={R*100:5.1f}% P={P*100:5.1f}% "
          f"F1={2*P*R/(P+R)*100:5.1f}% split={multi/hit*100:.1f}%")
