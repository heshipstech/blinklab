# Contributing

Written 15 August 2026, against the state of `main` on that date.

blinklab is a solo learning project built in public. It is not looking for
feature contributions, and there is no roadmap row for this file: it exists
because a public repository should say what it is and how it works, not because
a team is being recruited.

**Issues are welcome, especially ones that say a published number is wrong.**
That is the contribution this project values most. Every headline figure here
has been wrong at least once, each time for a reason inside this code rather
than in the data, and each correction is still printed beside the current
number.

## What you can rely on

- **Nothing you measure leaves your browser.** There is no server, no account
  and no database. The one exception is documented in
  `decisions/ADR-0004-model-telemetry.md`: the vendored MediaPipe library sends
  its own usage statistics to Google, which is inside the dependency rather
  than in any code here. The page used to deny any reporting at all, which was
  false, and the correction is on the page.
- **The numbers can be checked.** `docs/eyeblink8-result.txt` and
  `docs/drozy-result.txt` are committed, and continuous integration fails when
  a summary document stops agreeing with them.

## If you do open a pull request

The gates below run on every pull request, and a gate you skip locally fails
there instead. From the repository root:

```bash
npm run lint && npm run typecheck && npm test && npm run coverage && npm run build && npm run bundle:budget && npm run format:check && npm run e2e
```

In `analysis/`:

```bash
.venv/bin/ruff check . && .venv/bin/ruff format --check . && .venv/bin/python -m pytest
```

Three rules hold, and each was learned by breaking:

1. **Never push to `main`.** Branch, pull request, green CI, then merge.
2. **A change under `src/` writes a `LEARNING.md` entry**, or says in a commit
   message why not, as `No LEARNING entry: <reason>`. CI enforces this. The
   convention held for 130 pull requests on intent alone and then lapsed
   without anyone noticing.
3. **Prove the check can fail.** A test that passes against the bug it claims
   to catch is worse than no test, because it certifies. The usual method here
   is to mutate the fix back out and watch the suite go red.

## Where the documents are

| File              | What it is                                                |
| ----------------- | --------------------------------------------------------- |
| `README.md`       | what this measures, and the results with their history    |
| `STATE.md`        | the save state: where things stand right now              |
| `ROADMAP.md`      | the numbered increments and their amendments              |
| `SPEC.md`         | the contracts between modules                             |
| `ARCHITECTURE.md` | why `src/core` is pure and what that buys                 |
| `LEARNING.md`     | one concept per increment, the reason this project exists |
| `docs/log.md`     | one dated line per increment                              |
| `docs/UI.md`      | every element the page can show, and every string         |
| `REMEDIATION.md`  | the fix ladder after the August 2026 audit                |
| `NEEDS-REVIEW.md` | decisions the audit parked for the owner                  |

## Security

See `SECURITY.md`. Short version: there is no server to attack, so the
interesting reports are about what the page stores, what it ships, and what it
claims.
