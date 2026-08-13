# Issue #177: the Python virtual environment is broken by a folder rename

This is the written record of what was checked on 9 August 2026. Nothing here
needs a data file. It is all facts about the machine.

## What is wrong

A virtual environment is the sandbox that holds one folder's Python packages.
The one in `analysis/.venv/` is broken.

The project folder was renamed from `a previous project` to `blinklab build`. The
scripts inside `analysis/.venv/bin/` still point at the old name. Line 2 of
`analysis/.venv/bin/pytest` still executes a path under the old folder name. That
path does not exist any more, so the command fails with "No such file or
directory".

This is not only `pytest`. 14 files in `analysis/.venv/bin/` still carry the old
path: `activate`, `activate.bat`, `activate.csh`, `activate.fish`, `activate.nu`,
`f2py`, `fonttools`, `numpy-config`, `py.test`, `pyftmerge`, `pyftsubset`,
`pygmentize`, `pytest`, `ttx`.

So every documented way of entering that environment is broken, including the
`activate` scripts.

## The workaround in use today

```
cd analysis
.venv/bin/python -m pytest
```

This works and gives 61 passed, 2 skipped. It works because `.venv/bin/python` is
a symbolic link, not a script with a path written inside it. The link points at a
Python installed outside the project, which the rename did not touch.

## Two things checked before the repair was written

1. **`uv` is installed but not on the command path.** `uv` is the package manager
   this project uses. It sits in `~/.local/bin/uv`. Typing `uv` in a fresh shell
   gives "command not found", so the commands in `analysis/README.md` fail before
   they reach the virtual environment problem.
2. **`pyproject.toml` and `uv.lock` are intact.** Both are present in `analysis/`.
   `pyproject.toml` declares Python 3.12 or newer, pandas and matplotlib as
   dependencies, pytest and ruff in the `dev` group, and `imageio-ffmpeg` in a
   separate `corpus` group. `uv.lock` is 129,281 bytes. `analysis/.venv/pyvenv.cfg`
   records that the environment was created by `uv` version 0.12.3 against Python
   3.12. So the environment can be rebuilt from what is on disk. Nothing is lost.

## The repair

```
cd analysis
rm -rf .venv
~/.local/bin/uv sync
~/.local/bin/uv run pytest
```

The expected result is 61 passed, 2 skipped. Add
`~/.local/bin/uv sync --group corpus` if the corpus tools are needed, which pulls
in `imageio-ffmpeg`. That group is deliberately kept out of the default install,
so continuous integration never has to fetch it.

## Nothing to do about version control

`.gitignore` already lists `analysis/.venv/`, so the broken environment was never
committed and never will be.
