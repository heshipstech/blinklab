# NEEDS-REVIEW — blinklab, 2026-08-14

Items from the close-out audit that are **not mine to act on**. Each is parked
with the evidence needed to decide. ~~Nothing here has been changed.~~

**That last sentence was true on 14 August and is not now.** Items resolved
since are marked in place rather than deleted, each with the date and the pull
request, so the file still reads as the audit left it with the answers written
on top. Every item was re-checked against the repository or the GitHub API on
2026-08-15, not against the previous version of this document. Doing that found
one thing this file had wrong in the optimistic direction: the account-name
scrub was recorded as complete when one path had survived it.

The audit itself is in [AUDIT-2026-08-14.md](AUDIT-2026-08-14.md).

**The secrets phase is clean, by the strongest test available.** Every one of
the 1,062 blobs in the object database — reachable, unreachable and dangling
alike — was decompressed and grepped for the full provider pattern set: zero
hits. gitleaks over the working tree and all 178 reachable commits: no leaks.
No `.env`, key, dump or credential file has ever existed in the 255 distinct
paths this repository has held. Nothing needs rotating.

Everything below is about a public repository publishing things that need a
decision, not about leaked credentials.

---

## 1 · A file three live documents say is withheld on licence grounds is committed

`docs/evidence/2026-08-09/tables-current-run/eyeblink8_misses.csv` is tracked,
published, and carries exactly the five fields those documents named as the
problem: `blink_id`, `startFrame`, `endFrame`, `frameLength`,
`fullyClosedFrames`. Those reproduce the corpus's own human-marked blink
intervals for 50 of the 408 annotated blinks — the annotation, not this
project's measurements.

Saying otherwise when this was written. **Three of the four were corrected on
2026-08-15 by PR #248**, and the fourth is the one that matters:

- ~~`docs/evidence/2026-08-09/README.md:105` — "The third table of the set,
  `eyeblink8_misses.csv`, is deliberately not here"~~ corrected: it now says
  this is true of `tables/` and that the file **is** committed under
  `tables-current-run/`
- ~~the same file at `:289` — "`eyeblink8_misses.csv` is not committed"~~
  corrected: struck through in place, with the licence reasoning kept because
  it is the withholding that never happened, not the concern
- ~~`findings/issue-179-stale-tables.md:60` — "is **not** committed", and `:80`
  "can be rebuilt whenever the licence question is answered"~~ both struck
  through in place
- **`DATASETS.md:383` still records the copyleft question as unanswered**, and
  it still reads "its copyleft would need thought before publishing derived
  files". Verified 2026-08-15. **This is the whole of what remains here.**

The corpus licence, checked against the primary source rather than the repo's
summary: blinkingmatters.com/research states all its data is under **GPL3**.
This repository is **public** and **MIT**.

Three states were possible and the repo was in the worst of them: the rule
existed in writing and the repository broke it. **PR #248 moved it out of that
state on 2026-08-15** by correcting the statements, so the repository no longer
contradicts itself out loud. That is a smaller thing than it sounds: correcting
what is true about the file is not a ruling on whether it should be there.

What remains is the ruling. Either retire the rule, which means doing the
copyleft analysis and writing the answer into DATASETS.md, or remove the file
and keep `scripts/tables/autopsy.py` as the rebuild path. `REMEDIATION.md`
stage E4 exists for exactly this and is queued last; the repo being public is
the argument for moving it up.

**Note on a related earlier judgement.** A sibling repo's decision log records
a recommendation to strip these columns being _withdrawn_ on the grounds that
the dataset is "GPL3 and ungated by the repo's own documentation". The first
half is right; the second is not — the documentation gated it explicitly, in
four places, and after #248 it is gated in one, `DATASETS.md:383`. That
withdrawal still deserves revisiting.

---

## 2 · Two committed artefacts are real human data in a public repo

- **`test/fixtures/session-01.json`** — 4.7 MB, 300 frames × 478 face landmarks
  with timestamps, produced by the dev-only "Record fixture" button from a real
  face. The repo's own documents call it "the repo's only recorded human data"
  and "the owner's fixture".
- **`analysis/tests/fixtures/session-fixture.csv`** — an unmodified product of
  the app's own CSV export: two KSS metadata lines (`kss_before: 6`,
  `kss_after: 6`) and 57 per-second rows whose fps values carry real
  measurement noise. `.gitignore` ignores `blinklab-session-*.csv` under a
  comment saying an exported CSV is a recording; this one is tracked under a
  different name.

If both are the author's own, that is a decision anyone can defend — but it is
recorded nowhere for the CSV, and the landmark fixture's README documents its
shape rather than its subject. If either is anyone else's, that is face
geometry and self-reported sleepiness from an identifiable person, published.

One ADR or a line in `test/fixtures/README.md` and `MODEL_CARD.md`'s
"who it has been tested on" table settles it either way.

---

## 3 · The published DROZY correlations are not reproducible from current main

Every measured evidence run behind the published numbers was produced on
9 August. Remediation B4 (PR #225, 12 August) then changed the blink-shape
window — the project's own "only genuine arithmetic error the audit found".

Re-measuring a clip on current main gives byte-identical blink _intervals_ but
different amplitude, closing velocity and A/V columns. So:

- **Track A is safe.** Recall, precision and F1 depend only on the intervals.
- **The DROZY result is not.** Three of its correlations are shape-derived, and
  those are exactly the columns PR #225 moved.

Re-measuring needs a re-extract and re-transcode from the 2.3 GB archive — which
would recreate the derived video the DATASETS.md safeguard requires destroyed —
plus roughly 3.1 hours of compute. That is an owner-side decision, not something
a read-only audit should start.

Until it is done, the honest minimum is one sentence in `docs/drozy-result.txt`
and the README's DROZY section naming the measuring commit and noting that
PR #225 postdates it. **I have not written that sentence** — it qualifies a
published result, which is yours.

**WRITTEN 2026-08-15, with the owner's approval of the wording.** Both
documents now carry the caveat, and `STATE.md` points at it. The measuring
commit is `bd2a98d`: the run's own files are stamped 9 August 22:10 to 22:41,
and that was `main`'s head at 22:03. Its newest code change was PR #190.
`tools/drozyGuard.mjs` reads that commit out of the result file and requires
the caveat only while `git log bd2a98d..HEAD -- src/core/blinkShape.ts` is
non-empty, so re-measuring retires the warning by itself.

Three commit-level checks were added to the audit's empirical one, and all
agree with it. PR #218 touched `aperture.ts`, but the diff is an import move,
`toPixels` relocated to `geometry.ts`, so the millimetre aperture every other
feature depends on is unchanged. PR #197 changed the status line, not the
export, as its own commit message records. PR #229's backwards-clock guard
fires only on a frame stamped earlier than the state carries, which a
clip-derived clock never produces. **The re-measure decision itself is still
open**: this records which rows are old, it does not recompute them.

---

## 4 · Smaller decisions

| Item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Why it is yours                                         | Effort     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------- |
| ~~**Dependabot alerts are disabled at the repository level.** I added `.github/dependabot.yml`, which configures version updates — alerts and security updates are a settings toggle I cannot flip. Settings → Advanced Security~~ **DONE 2026-08-14.** Alerts are on and report **0 open**, which agrees with `npm audit` at every severity. Verified against a control rather than assumed: `gh api -i repos/heshipstech/blinklab/vulnerability-alerts` → 204 (the endpoint 404s when alerts are disabled), while a deliberately wrong path → 404           | ~~Repo setting~~ Done                                   | ~~2 min~~  |
| **`feat/5.8-fixation-stats` survives on the remote**, and it is now one of TWELVE stale remote branches, not one. Its commit is the pre-squash original of PR #99, so nothing is lost by deleting it. All twelve were checked against `gh pr list` on 2026-08-15: eleven MERGED, one CLOSED on purpose. Deleting a remote branch is still yours                                                                                                                                                                                                               | STOP #4                                                 | 1 min      |
| ~~**20 local branches** whose upstreams are gone. All squash-merged, so `git cherry` misreports them as unmerged; the reliable test is `git diff main <branch>`. None is published — the remote has only `main` and the branch above~~ **Re-counted 2026-08-15: TWO local branches, not 20, and the remote now carries twelve stale ones rather than one.** `git diff main <branch>` is no longer a usable test either, since `main` has moved far ahead of all of them; the PR state from `gh pr list` is. Full verified inventory in REMEDIATION.md Stage H | Housekeeping, already at REMEDIATION.md:278             | 10 min     |
| **7 commits carry a personal Gmail** as author; the other 145 use the noreply form. Changing them is a history rewrite on a public repo with 119 PRs                                                                                                                                                                                                                                                                                                                                                                                                          | STOP #3                                                 | —          |
| ~~**The macOS account name appears in 22 committed lines** across five audit documents, as absolute paths. `docs/evidence/` already has a path-scrubbing convention; `docs/audit/` did not get it~~ **DONE.** PR #243 scrubbed most of them to `<repo>` on 2026-08-14 but MISSED ONE, a memory-directory path at `appendix-chunk-1-all-findings.md:691`, neutralised to `~/.claude/projects/<this-project>/` on 2026-08-15. `git grep` for the account name now returns nothing                                                                               | ~~Low, but it is your name in a public repo~~ Done      | ~~15 min~~ |
| **No CSP, `X-Frame-Options` or `Permissions-Policy` on the deployed page.** GitHub Pages serves a fixed header set and cannot be configured, so this is a hosting limit. For a page that requests camera access, the only lever is an in-document `<meta http-equiv>` CSP, which cannot express `frame-ancestors`                                                                                                                                                                                                                                             | Platform constraint; worth recording rather than fixing | —          |
| **The demo is fully indexable and has no favicon, description or OG tags.** A project-path `robots.txt` cannot work — robots.txt is only read at the origin root, and no user-level Pages site exists there                                                                                                                                                                                                                                                                                                                                                   | Product decision: do you want it indexed?               | 20 min     |
| ~~**Nothing on the page says which commit is live.** Given this project's stamp discipline, the published artefact is the one place it does not reach. Roughly five lines: inject `GITHUB_SHA` via vite `define` and render it in the footer~~ **DONE 2026-08-14 in #244 (`5132cf2`)** — a `stamp-build-commit` vite plugin injects `<meta name="build-commit">` at build time, `dev` locally. Verified live rather than in the source: `curl -s https://heshipstech.github.io/blinklab/` returns the tag, and it has matched `main` on every deploy since    | ~~Nice-to-have~~ Done                                   | ~~15 min~~ |
| **`DROZY.zip`, 2.3 GB, is retained** beside the repo while DATASETS.md says source video is deleted once features are computed. The verifier confirmed the extracted folder holds no video and the archive is outside the repository, so the safeguard's intent holds — but the two statements should agree                                                                                                                                                                                                                                                   | Wording, or delete the archive                          | 5 min      |
| **README says DATASETS.md "records roughly forty public datasets"**; it records twenty, from roughly forty assessments. The process number became a record number                                                                                                                                                                                                                                                                                                                                                                                             | One-line correction, but it is your prose               | 2 min      |
| ~~**`docs/UI.md` claims to list every string the page can show** and is missing two CameraState kinds added by PR #223/#224, plus the Retry button and a clip processing-rate string~~ **DONE 2026-08-14 in #243.** `modelFailed` and `measurementFailed` are both listed with the PR that added them, the "Retry loading the model" button has its own paragraph, and the processing-rate string is in the readout table. Verified 2026-08-15                                                                                                                | ~~Documentation of UI you own~~ Done                    | ~~20 min~~ |
| **CHANGELOG.md** absent while seven release tags exist; ROADMAP row 8.3 reads as entirely undone while REMEDIATION records it two-thirds done                                                                                                                                                                                                                                                                                                                                                                                                                 | Founder preference                                      | 30 min     |

---

## 5 · Two things I deliberately did not "fix"

- **Two markdown links in `docs/audit/` appendices resolve to the wrong path**
  and 404 on GitHub. They are inside _quotations_ of README's own text.
  Correcting them would falsify the quotation, which in an audit appendix is
  worse than a broken link. Left as they are, recorded here.
- **`npm audit fix` was run without `--force`.** It cleared the last transitive
  advisory with semver-compatible changes only; nothing was pushed past a major
  boundary, and no `overrides` entry was invented.
