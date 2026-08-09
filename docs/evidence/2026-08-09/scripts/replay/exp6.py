import sys, os, csv, statistics as st
sys.path.insert(0,"/PATH/TO/blinklab build/blinklab/analysis")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pathlib import Path
from blinklab.blink_log import load_blink_log
import sim
MEAS=Path("/PATH/TO/blinklab build/datasets/eyeblink8-measured")
CLIPS=["26122013_223310_cam","26122013_224532_cam","26122013_230103_cam","26122013_230654_cam",
       "27122013_151644_cam","27122013_152435_cam","27122013_153916_cam","27122013_154548_cam"]
print("18. THE SPLIT PAIRS IN THE SHIPPED LOG (gap 0 = exactly one frame above the line)")
print(f"  {'clip':22s} {'frames A':>12s} {'durA ms':>8s} {'ampA mm':>8s} {'frames B':>12s} {'durB ms':>8s} {'ampB mm':>8s} {'replay mm at the gap frame / baseline':>0s}")
n=0
for c in CLIPS:
    bl=load_blink_log(MEAS/f"{c}.blinks.csv").blinks
    mm=sim.aperture_series(sim.load(c))
    ev,thr,base=sim.simulate(mm)
    bl=sorted(bl,key=lambda b:b.start_frame)
    for a,b in zip(bl,bl[1:]):
        if b.start_frame-a.end_frame-1==0:
            n+=1
            k=a.end_frame
            v = (mm[k]/base[k]) if 0<=k<len(mm) and mm[k] is not None and base[k] else None
            amp=lambda x: f"{x.amplitude_mm:8.2f}" if getattr(x,'amplitude_mm',None) else "     n/a"
            print(f"  {c:22s} {a.start_frame:5d}-{a.end_frame:<6d} {a.duration_ms:8.0f} {amp(a)} "
                  f"{b.start_frame:5d}-{b.end_frame:<6d} {b.duration_ms:8.0f} {amp(b)}  "
                  f"{'' if v is None else f'{v:.3f}'}")
print(f"  total gap-0 pairs: {n}")
