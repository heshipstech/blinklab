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
