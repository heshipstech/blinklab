from pathlib import Path
from blinklab.blink_log import load_blink_log
A=Path("/PATH/TO/blinklab build/datasets/eyeblink8-measured")
B=Path("/PATH/TO/blinklab build/datasets/eyeblink8-measured-capfix")
short={"26122013_223310_cam","26122013_230103_cam","26122013_230654_cam","27122013_151644_cam","27122013_152435_cam","27122013_154548_cam"}
changed=0
for name in sorted(short):
    a=[(b.start_frame,b.end_frame) for b in load_blink_log(A/f"{name}.blinks.csv").blinks]
    b=[(x.start_frame,x.end_frame) for x in load_blink_log(B/f"{name}.blinks.csv").blinks]
    same = a==b
    if not same: changed+=1
    print(f"{name:24} n {len(a)}->{len(b)}  identical={same}")
print("short clips whose detections changed:", changed, "of 6")
