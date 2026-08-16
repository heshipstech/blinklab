# analysis

The Python track of Phase 7. Everything here reads sessions the
browser recorded and asks whether the numbers mean anything. Nothing
here runs in the browser, and nothing in the browser depends on it.

## Why it is a separate language and a separate CI job

The browser side measures. This side judges. Keeping them apart means
a broken plot never blocks a fix to the instrument, and it forces the
only thing they share to be explicit: the CSV contract, written in
`../SPEC.md` and asserted from this side in
`tests/test_csv_contract.py`.

## The two readers, and why neither is the other

`loader.py` reads the per-second session file. `blink_log.py` reads the
blink log of a CLIP, and refuses any row without frame numbers, because
only a frame index can be compared against a human annotator's marks.

`validation.py` reads the blink log of a LIVE CAMERA session, which has
no frame numbers at all, and refuses any row that has them. The two
refusals are mirrors and both are load bearing: the first is what stops
a webcam recording being scored against Eyeblink8 ground truth, and the
second is what stops a clip appearing in the validation round's table
looking like somebody's laptop.

`validation.py` also pairs a folder of exports. Read
`docs/validation-plan.md` first: it fixes what the round measures and
was committed before any session file existed.

The round's three layers are deliberately separate. `validation.py`
reads and refuses, `validation_checks.py` judges, and
`tools/validation_report.py` prints:

```
PYTHONPATH="$PWD" .venv/bin/python tools/validation_report.py \
    "$DATASETS/validation-round"
```

It exits non-zero when any participant was refused, so a run that could
not read everybody cannot be mistaken for a clean one.

## Running it

The environment is pinned by `uv.lock`, which fixes the Python
version as well as the packages, so this folder resolves identically
on a laptop and in CI.

```
cd analysis
uv sync
uv run pytest
uv run ruff check .
```

If `uv` is not installed: `curl -LsSf https://astral.sh/uv/install.sh | sh`
