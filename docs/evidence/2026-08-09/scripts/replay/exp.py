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

DATA = {}
for c in CLIPS:
    rows = sim.load(c)
    ann = load_annotation(TAGS[c])
    fc, bf = set(), {}
    for line in TAGS[c].read_text(errors="replace").splitlines():
        if line.startswith("#") or ":" not in line:
            continue
        f = line.strip().split(":")
        if len(f) != 19:
            continue
        try:
            fi, bid = int(f[0]), int(f[1])
        except ValueError:
            continue
        if bid != -1:
            bf[fi] = bid
            if "C" in (f[3].strip().upper(), f[5].strip().upper()):
                fc.add(fi)
    DATA[c] = dict(rows=rows, ann=ann, fc=fc, blinkframe=bf,
                   annots=[Interval(b.start_frame, b.end_frame) for b in ann.blinks])


def eye_series(rows, which):
    out = []
    for r in rows:
        v = None
        if r.get("face") == 478 and r.get("gate") == "valid":
            rm, lm = r.get("rMm"), r.get("lMm")
            if rm is not None and lm is not None:
                v = {"mean": (rm + lm) / 2, "min": min(rm, lm), "max": max(rm, lm),
                     "right": rm, "left": lm}[which]
        out.append(v)
    return out


def pooled(rs):
    tp = sum(r.true_positives for r in rs); fp = sum(r.false_positives for r in rs)
    fn = sum(r.false_negatives for r in rs)
    rec = tp / (tp + fn) if tp + fn else 0
    pre = tp / (tp + fp) if tp + fp else 0
    f1 = 2 * pre * rec / (pre + rec) if pre + rec else 0
    return tp, fp, fn, rec * 100, pre * 100, f1 * 100


def run(**kw):
    which = kw.pop("which", "mean")
    log_cap = kw.pop("log_cap", None)
    rs = []
    for c in CLIPS:
        s = eye_series(DATA[c]["rows"], which)
        ev, thr, base = sim.simulate(s, log_cap=log_cap, **kw)
        det = [Interval(e["startFrame"], e["endFrame"]) for e in ev]
        rs.append(match_blinks(det, DATA[c]["annots"]))
    return pooled(rs)


print("=" * 84)
print("1. THE IRIS RULER, measured where it matters: aperture.ts divides by it mid blink")
print("=" * 84)
print(f"{'clip':22s} {'irisPx open':>12s} {'irisPx shut':>12s} {'change':>8s} "
      f"{'apPx open':>10s} {'apPx shut':>10s} {'mm inflation at shut':>21s}")
for c in CLIPS:
    rows, fc, bf = DATA[c]["rows"], DATA[c]["fc"], DATA[c]["blinkframe"]
    op_i, sh_i, op_a, sh_a = [], [], [], []
    for r in rows:
        if r.get("face") != 478 or r.get("rIris") is None:
            continue
        iris = (r["rIris"] + r["lIris"]) / 2
        ap = (r["rPx"] + r["lPx"]) / 2
        if r["i"] in fc:
            sh_i.append(iris); sh_a.append(ap)
        elif r["i"] not in bf:
            op_i.append(iris); op_a.append(ap)
    if not sh_i:
        continue
    mo, ms = st.median(op_i), st.median(sh_i)
    print(f"{c:22s} {mo:12.2f} {ms:12.2f} {(ms/mo-1)*100:+7.1f}% "
          f"{st.median(op_a):10.2f} {st.median(sh_a):10.2f} {(mo/ms-1)*100:+20.1f}%")

print()
print("=" * 84)
print("2. HOW MUCH OF THE FULL OPEN-TO-SHUT TRAVEL THE ARM LINE DEMANDS")
print("=" * 84)
print(f"{'clip':22s} {'open(med)':>10s} {'shut(med)':>10s} {'line0.50':>9s} {'arm0.45':>9s} "
      f"{'travel needed':>14s} {'margin arm-shut':>16s}")
tot = []
for c in CLIPS:
    rows, fc, bf = DATA[c]["rows"], DATA[c]["fc"], DATA[c]["blinkframe"]
    s = eye_series(rows, "mean")
    ev, thr, base = sim.simulate(s)
    op = [s[i] for i in range(len(s)) if s[i] is not None and i not in bf]
    sh = [s[i] for i in fc if i < len(s) and s[i] is not None]
    b = st.median([x for x in base if x])
    o, u = st.median(op), st.median(sh)
    need = (o - 0.45 * b) / (o - u) * 100
    print(f"{c:22s} {o:10.3f} {u:10.3f} {0.5*b:9.3f} {0.45*b:9.3f} {need:13.1f}% "
          f"{(0.45*b-u)/(o-u)*100:15.1f}%")
    tot.append(need)
print(f"{'corpus median':22s} {'':10s} {'':10s} {'':9s} {'':9s} {st.median(tot):13.1f}%")

print()
print("=" * 84)
print("3. MISSED BLINKS: how deep did they actually go")
print("=" * 84)
recs = []
for c in CLIPS:
    s = eye_series(DATA[c]["rows"], "mean")
    ev, thr, base = sim.simulate(s)
    det = [Interval(e["startFrame"], e["endFrame"]) for e in ev]
    res = match_blinks(det, DATA[c]["annots"])
    found = {a for _d, a in res.pairs}
    for i, b in enumerate(DATA[c]["ann"].blinks):
        lo, hi = max(0, b.start_frame - 2), min(len(s) - 1, b.end_frame + 2)
        vals = [(s[k], thr[k], base[k]) for k in range(lo, hi + 1) if s[k] is not None and base[k]]
        if not vals:
            continue
        mn = min(vals, key=lambda t: t[0] / t[2])
        recs.append(dict(clip=c, found=i in found, fc=b.fully_closed_frames,
                         nframes=b.frame_count, depth=mn[0] / mn[2],
                         below_line=mn[0] < mn[1], armed=mn[0] <= mn[1] * 0.9,
                         nulls=sum(1 for k in range(b.start_frame, b.end_frame + 1)
                                   if k < len(s) and s[k] is None)))


def dist(sel, key="depth"):
    v = sorted(r[key] for r in sel)
    if not v:
        return "n=0"
    q = lambda p: v[max(0, min(len(v) - 1, int(round(p / 100 * (len(v) - 1)))))]
    return f"n={len(v):3d} p10={q(10):.3f} med={q(50):.3f} p90={q(90):.3f}"


F = [r for r in recs if r["found"]]
M = [r for r in recs if not r["found"]]
print(f"  FOUND  min aperture / baseline: {dist(F)}")
print(f"  MISSED min aperture / baseline: {dist(M)}")
print(f"  missed blinks that never went below the 0.50 line : "
      f"{sum(1 for r in M if not r['below_line'])} of {len(M)} ({sum(1 for r in M if not r['below_line'])/len(M)*100:.1f}%)")
print(f"  missed blinks that crossed 0.50 but missed the 0.45 ARM line: "
      f"{sum(1 for r in M if r['below_line'] and not r['armed'])} of {len(M)} "
      f"({sum(1 for r in M if r['below_line'] and not r['armed'])/len(M)*100:.1f}%)")
print(f"  missed blinks that DID arm (lost to duration, nulls or the export cap): "
      f"{sum(1 for r in M if r['armed'])} of {len(M)} ({sum(1 for r in M if r['armed'])/len(M)*100:.1f}%)")
print(f"  missed blinks containing a refused (null) frame: {sum(1 for r in M if r['nulls'] > 0)}")
print(f"  found  blinks containing a refused (null) frame: {sum(1 for r in F if r['nulls'] > 0)}")

print()
print("=" * 84)
print("4. COUNTERFACTUAL SWEEPS (uncapped log throughout, so the export bug is removed)")
print("=" * 84)
print(f"  {'configuration':52s} {'tp':>4s} {'fp':>4s} {'fn':>4s} {'R%':>6s} {'P%':>6s} {'F1%':>6s}")


def show(label, **kw):
    tp, fp, fn, r, p, f = run(**kw)
    print(f"  {label:52s} {tp:4d} {fp:4d} {fn:4d} {r:6.1f} {p:6.1f} {f:6.1f}")


show("SHIPPED, but with the 50-row export cap applied", log_cap=50)
show("SHIPPED constants, no export cap")
print("  -- threshold fraction (arm line = fraction x 0.9) --")
for tf in (0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75):
    show(f"BASELINE_THRESHOLD_FRACTION = {tf}", threshold_fraction=tf)
print("  -- arming depth (hysteresis) at the shipped 0.5 line --")
for h in (0.0, 0.05, 0.10, 0.20):
    show(f"APERTURE_HYSTERESIS_FRACTION = {h}", hysteresis=h)
print("  -- best pair --")
for tf in (0.60, 0.65, 0.70):
    for h in (0.0, 0.05, 0.10):
        show(f"fraction {tf} + hysteresis {h}", threshold_fraction=tf, hysteresis=h)
print("  -- other single constants --")
show("MAX_BLINK_DURATION_MS = 1000", max_blink_ms=1000)
show("BASELINE_LEARN_MS = 0 (no warm up)", learn_ms=0)
show("no ratchet (baseline frozen at first ready)", ratchet=False)
show("ratchet with no ceiling (pre fix #126)", ceiling_factor=1e9)
show("per-eye MINIMUM instead of the mean of both", which="min")
show("subject right eye alone", which="right")
show("subject left eye alone", which="left")
show("no pose gate", **{})
json.dump(recs, open(os.path.dirname(os.path.abspath(__file__)) + "/perblink.json", "w"))
