import sys, os
sys.path.insert(0,"/PATH/TO/blinklab build/blinklab/analysis")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pathlib import Path
from blinklab.blink_log import load_blink_log
from blinklab.blink_match import Interval, match_blinks
from blinklab.eyeblink8 import load_annotation
CORPUS=Path("/PATH/TO/blinklab build/datasets/eyeblink8/eyeblink8")
MEAS=Path("/PATH/TO/blinklab build/datasets/eyeblink8-measured")
CLIPS=["26122013_223310_cam","26122013_224532_cam","26122013_230103_cam","26122013_230654_cam",
       "27122013_151644_cam","27122013_152435_cam","27122013_153916_cam","27122013_154548_cam"]
TAGS={p.stem:p for p in CORPUS.rglob("*.tag")}
def merge(iv,gap):
    iv=sorted(iv,key=lambda x:x.start_frame); out=[iv[0]]
    for x in iv[1:]:
        if x.start_frame-out[-1].end_frame-1<=gap: out[-1]=Interval(out[-1].start_frame,max(out[-1].end_frame,x.end_frame))
        else: out.append(x)
    return out
def ladder(label, gap=None, drop_uncovered=False):
    TP=FP=FN=0
    for c in CLIPS:
        ann=load_annotation(TAGS[c]); iv=[b.interval() for b in load_blink_log(MEAS/f"{c}.blinks.csv").blinks]
        if gap is not None: iv=merge(iv,gap)
        first=min(d.start_frame for d in iv)
        A=[Interval(b.start_frame,b.end_frame) for b in ann.blinks if (not drop_uncovered) or b.end_frame>=first]
        r=match_blinks(iv,A); TP+=r.true_positives; FP+=r.false_positives; FN+=r.false_negatives
    R=TP/(TP+FN); P=TP/(TP+FP)
    print(f"  {label:62s} tp={TP:3d} fp={FP:3d} fn={FN:3d} R={R*100:5.1f}% P={P*100:5.1f}% F1={2*P*R/(P+R)*100:5.1f}%")
print("19. SHIPPED LOG, two defects removed in turn (nothing retuned, nothing re-run)")
ladder("as published")
ladder("A: split detections <=2 frames apart merged", gap=2)
ladder("B: blinks the 50-row export cap made unreachable removed", drop_uncovered=True)
ladder("A + B", gap=2, drop_uncovered=True)
