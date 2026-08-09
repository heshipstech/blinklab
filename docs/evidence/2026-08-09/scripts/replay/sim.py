"""Exact Python port of baseline.ts + blink.ts, replayed on the traced aperture.

Used only to ask counterfactual questions. Nothing is written back to the repo.
"""
import json, os, math, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TRACES = HERE + "/traces"

# constants.ts, verbatim
BASELINE_LEARN_MS = 30000
BASELINE_MIN_SAMPLES = 100
BASELINE_PERCENTILE = 90
BASELINE_THRESHOLD_FRACTION = 0.5
BASELINE_RECENT_CAP = 600
BASELINE_RISE_MIN_SAMPLES = 300
BASELINE_MEDIAN_CEILING_FACTOR = 1.4
BASELINE_MEDIAN_PERCENTILE = 50
APERTURE_HYSTERESIS_FRACTION = 0.1
MAX_BLINK_DURATION_MS = 500
BLINK_APERTURE_THRESHOLD_MM = 4.0
BLINK_LOG_CAP = 50
EYES_SHUT_FRACTION = 0.4


def percentile(vals, p):
    if not vals:
        return None
    s = sorted(vals)
    rank = max(1, math.ceil((p / 100.0) * len(s)))
    return s[rank - 1]


def bounded_baseline(samples, ceiling_factor=BASELINE_MEDIAN_CEILING_FACTOR,
                     pct=BASELINE_PERCENTILE):
    wide = percentile(samples, pct)
    middle = percentile(samples, BASELINE_MEDIAN_PERCENTILE)
    if wide is None or middle is None:
        return wide
    return min(wide, middle * ceiling_factor)


def load(clip):
    with open(os.path.join(TRACES, clip + ".json")) as fh:
        return json.load(fh)


def aperture_series(rows, use_gate=True):
    """stabilityMm per frame, or None where the app would have had none."""
    out = []
    for r in rows:
        mm = None
        if r.get("face") == 478 and r.get("rMm") is not None and r.get("lMm") is not None:
            if (not use_gate) or r.get("gate") == "valid":
                mm = (r["rMm"] + r["lMm"]) / 2.0
        out.append(mm)
    return out


def simulate(mm_series, fps=30.0,
             threshold_fraction=BASELINE_THRESHOLD_FRACTION,
             hysteresis=APERTURE_HYSTERESIS_FRACTION,
             max_blink_ms=MAX_BLINK_DURATION_MS,
             learn_ms=BASELINE_LEARN_MS,
             ratchet=True,
             ceiling_factor=BASELINE_MEDIAN_CEILING_FACTOR,
             fixed_warmup_mm=BLINK_APERTURE_THRESHOLD_MM,
             log_cap=None,
             pct=BASELINE_PERCENTILE):
    """Returns (events, per-frame threshold, per-frame baseline)."""
    bstate = None            # ("learning", startedAtMs, samples) | ("ready", baselineMm, recent)
    eye = "unknown"
    closed_at = None
    closed_at_frame = None
    armed = False
    events = []
    thr_trace = []
    base_trace = []
    for i, mm in enumerate(mm_series):
        now = i * 1000.0 / fps
        # baselineStep
        if bstate is None:
            bstate = ["learning", now, []]
        if bstate[0] == "learning":
            if mm is not None:
                bstate[2].append(mm)
            if now - bstate[1] >= learn_ms and len(bstate[2]) >= BASELINE_MIN_SAMPLES:
                b = bounded_baseline(bstate[2], ceiling_factor, pct)
                if b is not None:
                    bstate = ["ready", b, []]
        else:
            if mm is not None:
                bstate[2].append(mm)
                if len(bstate[2]) > BASELINE_RECENT_CAP:
                    bstate[2] = bstate[2][-BASELINE_RECENT_CAP:]
                if ratchet and len(bstate[2]) >= BASELINE_RISE_MIN_SAMPLES:
                    cand = bounded_baseline(bstate[2], ceiling_factor, pct)
                    if cand is not None and cand > bstate[1]:
                        bstate[1] = cand
        personal = bstate[1] * threshold_fraction if bstate[0] == "ready" else None
        thr = personal if personal is not None else fixed_warmup_mm
        thr_trace.append(thr)
        base_trace.append(bstate[1] if bstate[0] == "ready" else None)

        # blinkStep
        if mm is None:
            eye, closed_at, armed, closed_at_frame = "unknown", None, False, None
            continue
        if mm < thr:
            reached = mm <= thr * (1 - hysteresis)
            if eye != "closed":
                closed_at = now
                closed_at_frame = i
            armed = (eye == "closed" and armed) or reached
            eye = "closed"
        else:
            dur = (now - closed_at) if (eye == "closed" and closed_at is not None) else None
            if dur is not None and dur <= max_blink_ms and armed:
                events.append(dict(startFrame=closed_at_frame, endFrame=i,
                                   atMs=now, durationMs=dur))
            eye, closed_at, armed, closed_at_frame = "open", None, False, None
    if log_cap is not None and len(events) > log_cap:
        events = events[-log_cap:]
    return events, thr_trace, base_trace
