import csv, os, statistics as st, json

MEAS = "/PATH/TO/blinklab build/datasets/eyeblink8-measured"
CLIPS = ["26122013_223310_cam","26122013_224532_cam","26122013_230103_cam","26122013_230654_cam",
         "27122013_151644_cam","27122013_152435_cam","27122013_153916_cam","27122013_154548_cam"]

def read_csv(path):
    rows=[]
    meta={}
    with open(path) as f:
        lines=[l for l in f]
    hdr=None
    body=[]
    for l in lines:
        if l.startswith("#"):
            k,_,v=l[1:].strip().partition(":")
            meta[k.strip()]=v.strip()
            continue
        if hdr is None:
            hdr=[c.strip() for c in l.strip().split(",")]
        else:
            body.append(l)
    for r in csv.DictReader(body, fieldnames=hdr):
        rows.append(r)
    return meta, rows

def f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None

out={}
for c in CLIPS:
    m_s, sec = read_csv(os.path.join(MEAS, c+".seconds.csv"))
    m_b, bl  = read_csv(os.path.join(MEAS, c+".blinks.csv"))
    # exported rows
    nexp=len(bl)
    firstFrame = f(bl[0]["startFrame"]) if bl else None
    lastFrame  = f(bl[-1]["endFrame"]) if bl else None
    # lastBlinkDurationMs change count = lower bound on detections
    prev=None
    changes=[]
    for r in sec:
        v=f(r["lastBlinkDurationMs"])
        if v is not None and v!=prev:
            changes.append(f(r["timestampMs"])/1000.0)
        prev=v
    # aperture / baseline
    ratios=[]; apert=[]; base=[]
    faceFalse=0; apNull=0
    for r in sec:
        a=f(r["apertureMm"]); b=f(r["baselineMm"])
        if r["faceDetected"]=="false": faceFalse+=1
        if a is None: apNull+=1
        if a is not None: apert.append(a)
        if b is not None: base.append(b)
        if a is not None and b is not None and b>0: ratios.append(a/b)
    ratios.sort()
    def pct(xs,p):
        if not xs: return None
        i=max(0,min(len(xs)-1,int(round(p/100*(len(xs)-1)))))
        return xs[i]
    # blink amplitudes vs baseline at that second
    secByS={int(f(r["timestampMs"])//1000):r for r in sec}
    amps=[]
    for r in bl:
        amp=f(r["amplitudeMm"]); at=f(r["atMs"])
        if amp is None or at is None: continue
        s=int(at//1000)
        rr=secByS.get(s) or secByS.get(s-1)
        b=f(rr["baselineMm"]) if rr else None
        if b: amps.append(amp/b)
    amps.sort()
    out[c]={
      "frames_measured": m_s.get("frames_measured"),
      "clip_duration_s": m_s.get("clip_duration_s"),
      "measured_fps": m_s.get("measured_fps"),
      "seconds_rows": len(sec),
      "exported_blink_rows": nexp,
      "first_exported_startFrame": firstFrame,
      "last_exported_endFrame": lastFrame,
      "lastBlinkDuration_changes": len(changes),
      "first_duration_change_s": changes[0] if changes else None,
      "changes_before_first_export_s": None,
      "faceDetected_false_seconds": faceFalse,
      "aperture_null_seconds": apNull,
      "baseline_first_s": next((f(r["timestampMs"])/1000 for r in sec if f(r["baselineMm"]) is not None), None),
      "baseline_min": min(base) if base else None,
      "baseline_max": max(base) if base else None,
      "shutBaseline": next((f(r["shutBaselineMm"]) for r in sec if f(r["shutBaselineMm"]) is not None), None),
      "ratio_p01": pct(ratios,1), "ratio_p05": pct(ratios,5), "ratio_p10": pct(ratios,10),
      "ratio_p25": pct(ratios,25), "ratio_p50": pct(ratios,50), "ratio_p90": pct(ratios,90),
      "ratio_min": ratios[0] if ratios else None,
      "frac_seconds_below_0.50": sum(1 for r in ratios if r<0.50)/len(ratios) if ratios else None,
      "frac_seconds_below_0.45": sum(1 for r in ratios if r<0.45)/len(ratios) if ratios else None,
      "amp_over_baseline_p10": pct(amps,10), "amp_over_baseline_p50": pct(amps,50), "amp_over_baseline_p90": pct(amps,90),
      "n_amp": len(amps),
      "_changes": changes,
    }
    # compute changes before first exported blink time
    if bl:
        at0=f(bl[0]["atMs"])/1000.0
        out[c]["first_exported_atMs_s"]=at0
        out[c]["changes_before_first_export_s"]=sum(1 for t in changes if t < at0)

print(json.dumps({k:{kk:vv for kk,vv in v.items() if kk!="_changes"} for k,v in out.items()}, indent=1))
with open(os.path.dirname(os.path.abspath(__file__))+"/probe.json","w") as fh:
    json.dump(out, fh, indent=1)
