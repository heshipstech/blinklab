"""Independent re-implementation. Does not import the repo's evaluator."""
import csv
import os
import sys
from pathlib import Path

GT = Path("/PATH/TO/blinklab build/datasets/eyeblink8/eyeblink8")


def parse_tag(path):
    """Return dict with blinks list, frame_count, glasses, non_frontal."""
    text = path.read_text(encoding="utf-8", errors="replace").splitlines()
    glasses = None
    in_msg = False
    for ln in text:
        s = ln.strip()
        if s == "#message start":
            in_msg = True
            continue
        if s == "#message end":
            in_msg = False
            continue
        if in_msg:
            continue
        if s.lower().startswith("#glasses"):
            glasses = s.split(":", 1)[1].strip().upper()
    start = text.index("#start")
    rows = []
    for ln in text[start + 1:]:
        s = ln.strip()
        if not s or s.startswith("#"):
            continue
        rows.append(s.split(":"))
    frames = set()
    groups = {}
    closed = {}
    nonfrontal = 0
    maxf = -1
    for p in rows:
        assert len(p) == 19, (path, len(p))
        f = int(p[0])
        b = int(p[1])
        assert f not in frames, (path, f)
        frames.add(f)
        maxf = max(maxf, f)
        if p[2].strip().upper() == "N":
            nonfrontal += 1
        if b == -1:
            continue
        groups.setdefault(b, []).append(f)
        if "C" in (p[3].strip().upper(), p[5].strip().upper()):
            closed[b] = closed.get(b, 0) + 1
    blinks = []
    for b in sorted(groups):
        fs = groups[b]
        lo, hi = min(fs), max(fs)
        assert hi - lo + 1 == len(fs), (path, b, "gap")
        blinks.append({
            "id": b, "start": lo, "end": hi,
            "closed": closed.get(b, 0),
            "len": hi - lo + 1,
        })
    return {
        "name": path.stem,
        "blinks": blinks,
        "frame_count": maxf + 1,
        "row_count": len(rows),
        "glasses": glasses,
        "non_frontal": nonfrontal,
    }


def parse_measured(path):
    """Return (list of (start,end), header dict)."""
    header = {}
    data_lines = []
    with path.open() as fh:
        for ln in fh:
            if ln.startswith("#"):
                k, _, v = ln[1:].partition(":")
                header[k.strip()] = v.strip()
            else:
                data_lines.append(ln)
    rdr = csv.DictReader(data_lines)
    out = []
    for r in rdr:
        out.append((int(r["startFrame"]), int(r["endFrame"])))
    return out, header


def overlap(a, b, tol):
    s = max(a[0] - tol, b[0])
    e = min(a[1] + tol, b[1])
    return max(0, e - s + 1)


def match(det, ann, tol=4):
    cands = []
    for i, d in enumerate(det):
        for j, a in enumerate(ann):
            o = overlap(d, a, tol)
            if o > 0:
                cands.append((o, i, j))
    cands.sort(key=lambda c: (-c[0], c[1], c[2]))
    ud, ua = set(), set()
    pairs = []
    for _o, i, j in cands:
        if i in ud or j in ua:
            continue
        ud.add(i)
        ua.add(j)
        pairs.append((i, j))
    pairs.sort()
    return pairs


def evaluate(measured_dir, tol=4, verbose=True):
    tags = sorted(GT.rglob("*.tag"))
    rows = []
    TP = FP = FN = 0
    tot_ann_frames = 0
    tot_meas_frames = 0
    all_misses = []
    all_fps = []
    for t in tags:
        a = parse_tag(t)
        mpath = Path(measured_dir) / (a["name"] + ".blinks.csv")
        det, hdr = parse_measured(mpath)
        ann = [(b["start"], b["end"]) for b in a["blinks"]]
        pairs = match(det, ann, tol)
        tp = len(pairs)
        fp = len(det) - tp
        fn = len(ann) - tp
        TP += tp
        FP += fp
        FN += fn
        matched_a = {j for _, j in pairs}
        matched_d = {i for i, _ in pairs}
        for k, b in enumerate(a["blinks"]):
            if k not in matched_a:
                all_misses.append((a["name"], b))
        for i, d in enumerate(det):
            if i not in matched_d:
                all_fps.append((a["name"], d, ann))
        mf = int(hdr["frames_measured"])
        tot_meas_frames += mf
        tot_ann_frames += a["frame_count"]
        rows.append({
            "clip": a["name"], "glasses": a["glasses"],
            "true": len(ann), "found": tp, "miss": fn, "false": fp,
            "recall": tp / len(ann) * 100,
            "prec": tp / len(det) * 100 if det else float("nan"),
            "measured": mf, "annotated": a["frame_count"],
            "rowcount": a["row_count"],
            "fps": hdr.get("measured_fps"),
            "nonfrontal": a["non_frontal"],
            "detected": len(det),
            "minblink": min(b["len"] for b in a["blinks"]),
        })
    rec = TP / (TP + FN)
    pre = TP / (TP + FP)
    f1 = 2 * rec * pre / (rec + pre)
    if verbose:
        print(f"== {measured_dir}  tol={tol}")
        print(f"TP={TP} FP={FP} FN={FN} detected={TP+FP} annotated={TP+FN}")
        print(f"recall={rec*100:.4f}%  prec={pre*100:.4f}%  f1={f1*100:.4f}%")
        print(f"{'clip':24s}{'gl':>4s}{'true':>6s}{'found':>6s}{'miss':>6s}"
              f"{'false':>6s}{'recall':>9s}{'prec':>9s}{'meas':>8s}{'ann':>8s}"
              f"{'fps':>7s}{'NF':>5s}{'minlen':>7s}")
        for r in rows:
            print(f"{r['clip']:24s}{('yes' if r['glasses']=='YES' else '-'):>4s}"
                  f"{r['true']:>6d}{r['found']:>6d}{r['miss']:>6d}"
                  f"{r['false']:>6d}{r['recall']:>8.1f}%{r['prec']:>8.1f}%"
                  f"{r['measured']:>8d}{r['annotated']:>8d}"
                  f"{str(r['fps']):>7s}{r['nonfrontal']:>5d}{r['minblink']:>7d}")
        print(f"totals: measured={tot_meas_frames} annotated={tot_ann_frames}")
        for g in ("YES", "NO"):
            sub = [r for r in rows if r["glasses"] == g]
            tp = sum(r["found"] for r in sub)
            tr = sum(r["true"] for r in sub)
            de = sum(r["detected"] for r in sub)
            print(f"glasses={g}: {len(sub)} clips, recall {tp/tr*100:.4f}% "
                  f"({tp}/{tr}), precision {tp/de*100:.4f}% ({tp}/{de})")
    return rows, (TP, FP, FN), all_misses, all_fps


if __name__ == "__main__":
    cap = "/PATH/TO/blinklab build/datasets/eyeblink8-measured-capfix"
    orig = "/PATH/TO/blinklab build/datasets/eyeblink8-measured"
    rows, tot, misses, fps = evaluate(cap)
    print()
    print("== fully closed share of misses ==")
    closedmiss = [m for m in misses if m[1]["closed"] > 0]
    print(f"{len(closedmiss)} of {len(misses)} = "
          f"{len(closedmiss)/len(misses)*100:.4f}%")
    print()
    print("== false positives sitting on a real blink ==")
    on = 0
    lens = []
    for name, d, ann in fps:
        lens.append(d[1] - d[0] + 1)
        if any(overlap(d, a, 0) > 0 for a in ann):
            on += 1
    lens.sort()
    import statistics
    print(f"{on} of {len(fps)} overlap an annotated blink (tol=0)")
    on4 = sum(1 for name, d, ann in fps
              if any(overlap(d, a, 4) > 0 for a in ann))
    print(f"{on4} of {len(fps)} overlap an annotated blink (tol=4)")
    print(f"fp lengths: median={statistics.median(lens)} "
          f"<=3 frames: {sum(1 for x in lens if x <= 3)} of {len(lens)}")
    print()
    print("#" * 60)
    rows2, tot2, misses2, fps2 = evaluate(orig)
    print()
    print("== original-run fp on real blink ==")
    on = sum(1 for name, d, ann in fps2 if any(overlap(d, a, 0) > 0 for a in ann))
    lens2 = sorted(d[1] - d[0] + 1 for name, d, ann in fps2)
    print(f"{on} of {len(fps2)}; median len {statistics.median(lens2)}")
