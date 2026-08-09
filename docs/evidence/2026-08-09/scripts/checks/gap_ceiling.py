"""Ceiling on how much of the miss rate the capture stutter could explain.

The converted mp4 is constant rate with the frame count preserved, so the
instrument saw exactly the frames the annotator labelled. The only route
left for a dropped frame to hurt is that a blink whose closure spans a
capture gap is represented by fewer samples, with an inflated apparent
eyelid velocity. So: how many blinks span a gap at all?
"""

import statistics
from pathlib import Path

ROOT = Path("/PATH/TO/blinklab build/datasets/eyeblink8/eyeblink8")

MISSED = {
    "26122013_223310_cam": (38, 10),
    "26122013_224532_cam": (88, 39),
    "26122013_230103_cam": (65, 21),
    "26122013_230654_cam": (31, 8),
    "27122013_151644_cam": (30, 4),
    "27122013_152435_cam": (41, 5),
    "27122013_153916_cam": (72, 30),
    "27122013_154548_cam": (43, 7),
}


def read_ts(p):
    out = []
    for line in p.read_text().splitlines():
        a = line.split()
        if len(a) == 2:
            try:
                out.append((int(a[0]), float(a[1])))
            except ValueError:
                pass
    return out


def runs(p):
    d, order = {}, []
    for line in p.read_text(errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        f = line.split(":")
        if len(f) < 2:
            continue
        try:
            fr, b = int(f[0]), int(f[1])
        except ValueError:
            continue
        if b == -1:
            continue
        if b not in d:
            d[b] = [fr, fr]
            order.append(b)
        else:
            d[b][1] = fr
    return [tuple(d[b]) for b in order]


print(f"{'clip':<22}{'blinks':>7}{'spanGap':>9}{'%':>7}{'missed':>8}"
      f"{'miss%':>7}{'lostFrInBlink':>15}")
tot_b = tot_g = tot_m = 0
for d in sorted(ROOT.iterdir(), key=lambda p: p.name):
    if not d.is_dir():
        continue
    txt, tag = list(d.glob("*.txt")), list(d.glob("*.tag"))
    if not txt or not tag:
        continue
    name = txt[0].stem
    if name not in MISSED:
        continue
    ts = read_ts(txt[0])
    tmap = dict(ts)
    dt = [b[1] - a[1] for a, b in zip(ts, ts[1:])]
    med = statistics.median(dt)
    # frames lost between frame i and i+1, rounded
    lost = {}
    for (fa, ta), (fb, tb) in zip(ts, ts[1:]):
        n = round((tb - ta) / med) - 1
        if n > 0:
            lost[fa] = n
    r = runs(tag[0])
    spanning = 0
    lost_in_blinks = 0
    for s, e in r:
        n = sum(lost.get(f, 0) for f in range(s, e))
        if n > 0:
            spanning += 1
            lost_in_blinks += n
    tb_, mb_ = MISSED[name]
    tot_b += len(r)
    tot_g += spanning
    tot_m += mb_
    print(f"{name:<22}{len(r):>7}{spanning:>9}{spanning/len(r)*100:>6.1f}%"
          f"{mb_:>8}{mb_/tb_*100:>6.1f}%{lost_in_blinks:>15}")

print()
print(f"TOTAL blinks {tot_b}, spanning a capture gap {tot_g} "
      f"({tot_g/tot_b*100:.1f}%), missed {tot_m} ({tot_m/tot_b*100:.1f}%)")
print()
print(f"CEILING: if every gap-spanning blink were missed for that reason,")
print(f"stutter explains at most {tot_g} of {tot_m} misses = "
      f"{tot_g/tot_m*100:.1f}% of the miss count,")
print(f"and recall would rise from {(tot_b-tot_m)/tot_b*100:.1f}% to at most "
      f"{(tot_b-tot_m+tot_g)/tot_b*100:.1f}%.")
