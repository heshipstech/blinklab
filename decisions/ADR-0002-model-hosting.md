# ADR-0002: Vendor the model, copy the WASM at build time

Date: 2026-07-30
Status: accepted

## Context

SECURITY stance and constraint 6: the running app makes no third party network calls, ever. The FaceLandmarker needs two artefacts: the model file (3.7 MB, not published on npm) and the MediaPipe WASM runtime (33 MB, shipped inside the locked npm package).

## Options considered

1. Load both from Google's CDN at runtime. Simplest, and forbidden by our own privacy rules. Rejected.
2. Fetch both at build time with a download script. Keeps the repo lean, but makes every build depend on a third party server being up and unchanged.
3. Vendor the model file in the repo, copy the WASM out of the version locked npm package at build time. Chosen.

## Decision

Option 3. The model is committed at `public/models/face_landmarker.task`. The WASM is copied by `npm run prepare-assets`, which runs automatically before dev and build, into a gitignored folder. Everything is served from our own origin.

## Consequences

- Good: zero runtime third party calls, reproducible builds pinned by git and the lockfile, offline development works.
- Bad: the repo permanently carries a 3.7 MB binary, and model upgrades are manual, deliberate commits.
- The deployed site grows by roughly 37 MB of model and WASM. A later ADR may prune unused WASM variants if the 8.7 size budget demands it.
