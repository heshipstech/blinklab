"""Re-derive the instrument's per-frame aperture signal outside the app.

Faithful port of src/core/aperture.ts, headPose.ts, validityGate.ts.
Nothing in the repository is touched; the model file is read only.
"""
import sys, os, math, json, time
import numpy as np
import cv2
import mediapipe as mp
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision

MODEL = "/PATH/TO/blinklab build/blinklab/public/models/face_landmarker.task"
MP4 = "/PATH/TO/blinklab build/datasets/eyeblink8-mp4"
OUT = os.path.dirname(os.path.abspath(__file__)) + "/traces"
os.makedirs(OUT, exist_ok=True)

# constants.ts
IRIS_DIAMETER_MM = 11.7
RIGHT_EAR = dict(outerCorner=33, innerCorner=133, upperOuter=160, lowerOuter=144,
                 upperInner=158, lowerInner=153)
LEFT_EAR = dict(outerCorner=263, innerCorner=362, upperOuter=387, lowerOuter=373,
                upperInner=385, lowerInner=380)
RIGHT_RING = [469, 470, 471, 472]
LEFT_RING = [474, 475, 476, 477]
POSE_LIMITS = dict(maxPitchDeg=20, maxYawDeg=25, maxRollDeg=25)
LANDMARK_COUNT = 478


def euler_from_matrix(d):
    if d is None or len(d) != 16:
        return None
    m = lambda r, c: d[r * 4 + c]
    sp = -m(1, 2)
    sp = max(-1.0, min(1.0, sp))
    pitch = math.asin(sp)
    if abs(math.cos(pitch)) < 1e-6:
        return None
    yaw = math.atan2(m(0, 2), m(2, 2))
    roll = math.atan2(m(1, 0), m(1, 1))
    deg = lambda r: r * 180.0 / math.pi
    return (deg(pitch), deg(yaw), deg(roll))


def run(clip, w=640, h=480):
    base = mpp.BaseOptions(model_asset_path=MODEL)
    opts = vision.FaceLandmarkerOptions(
        base_options=base,
        running_mode=vision.RunningMode.VIDEO,
        num_faces=1,
        output_facial_transformation_matrixes=True,
    )
    lm = vision.FaceLandmarker.create_from_options(opts)
    cap = cv2.VideoCapture(os.path.join(MP4, clip + ".mp4"))
    rows = []
    idx = 0
    t0 = time.time()
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        ts_ms = int(round(idx * 1000.0 / 30.0))
        res = lm.detect_for_video(image, ts_ms)
        rec = dict(i=idx, face=0)
        if res.face_landmarks:
            pts = res.face_landmarks[0]
            rec["face"] = len(pts)
            if len(pts) == LANDMARK_COUNT:
                px = lambda p: (p.x * w, p.y * h)
                dist = lambda a, b: math.hypot(a[0] - b[0], a[1] - b[1])

                def aperture(earmap, ring):
                    ir = dist(px(pts[ring[0]]), px(pts[ring[2]]))
                    op = (dist(px(pts[earmap["upperOuter"]]), px(pts[earmap["lowerOuter"]])) +
                          dist(px(pts[earmap["upperInner"]]), px(pts[earmap["lowerInner"]]))) / 2.0
                    mmv = op * (IRIS_DIAMETER_MM / ir) if ir > 0 else None
                    return ir, op, mmv

                rir, rop, rmm = aperture(RIGHT_EAR, RIGHT_RING)
                lir, lop, lmm = aperture(LEFT_EAR, LEFT_RING)
                rec.update(rIris=rir, lIris=lir, rPx=rop, lPx=lop, rMm=rmm, lMm=lmm)
                mtx = res.facial_transformation_matrixes[0] if res.facial_transformation_matrixes else None
                pose = euler_from_matrix(list(np.asarray(mtx).flatten())) if mtx is not None else None
                if pose is None:
                    rec["gate"] = "noPose"
                else:
                    p, y, r = pose
                    rec.update(pitch=p, yaw=y, roll=r)
                    bad = (abs(p) > POSE_LIMITS["maxPitchDeg"] or abs(y) > POSE_LIMITS["maxYawDeg"]
                           or abs(r) > POSE_LIMITS["maxRollDeg"])
                    rec["gate"] = "invalid" if bad else "valid"
        rows.append(rec)
        idx += 1
        if idx % 2000 == 0:
            print(f"  {clip} {idx} frames {idx/(time.time()-t0):.1f} fps", flush=True)
    cap.release()
    lm.close()
    with open(os.path.join(OUT, clip + ".json"), "w") as fh:
        json.dump(rows, fh)
    print(f"{clip}: {idx} frames in {time.time()-t0:.0f}s", flush=True)


if __name__ == "__main__":
    for c in sys.argv[1:]:
        run(c)
