"""Add the cause column to the miss table and the false-detection table."""
from __future__ import annotations

import csv
from pathlib import Path

# The folder autopsy.py wrote the three tables to. Same value as in that file.
OUT = Path("/PATH/TO/output-folder")
TRUNCATED = {"26122013_224532_cam": 4434, "27122013_153916_cam": 3287}

misses = list(csv.DictReader((OUT / "eyeblink8_misses.csv").open()))
for m in misses:
    cut = TRUNCATED.get(m["clip"])
    lost = cut is not None and int(m["endFrame"]) < cut
    closed = int(m["fullyClosedFrames"])
    m["outsideExportedLog"] = int(lost)
    if lost:
        m["cause"] = "A_export_log_capped_at_50"
    elif closed >= 15:
        m["cause"] = "B_closure_over_500ms_squint_gate"
    elif closed == 0:
        m["cause"] = "C_partial_blink_never_fully_closed"
    elif float(m["startTimeSecondsAt30fps"]) < 30.0:
        # The 30 s learn window is measured on the instrument's own
        # clock, and the instrument stepped the 30 fps mp4, so the
        # boundary is frame 900. The .txt capture clock drifts up to
        # 9.5 s away from that and would move one blink across it.
        m["cause"] = "D_warm_up_before_personal_baseline"
    else:
        m["cause"] = "E_UNEXPLAINED_detector_did_not_fire"

fields = list(misses[0].keys())
with (OUT / "eyeblink8_misses.csv").open("w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    w.writerows(misses)

falses = list(csv.DictReader((OUT / "eyeblink8_false_positives.csv").open()))
for x in falses:
    n = int(x["framesToNearestAnnotatedBlink"])
    x["kind"] = (
        # The matcher allows 4 frames of slack, so anything inside that
        # touched a real blink and lost the one-to-one contest.
        "double_fire_on_a_real_blink" if n <= 4
        else "near_a_real_blink" if n <= 60
        else "phantom_far_from_any_blink"
    )
ff = list(falses[0].keys())
with (OUT / "eyeblink8_false_positives.csv").open("w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=ff)
    w.writeheader()
    w.writerows(falses)

from collections import Counter
print("misses:", len(misses), sorted(Counter(m["cause"] for m in misses).items()))
print("false:", len(falses), sorted(Counter(x["kind"] for x in falses).items()))
print("\nmiss table columns:", ", ".join(fields))
print("\nfalse table columns:", ", ".join(ff))
