# Security policy

## What this is

blinklab is a research and learning project: a browser demo that measures
blinks from a webcam, plus the analysis code behind its published numbers. It
is **not a medical device** and is not used to make decisions about anyone.

Read in full on 7 September 2026, claims `4470daba`. That stamp records a READ, not an edit: it goes stale when a claim in this file changes, and not when a generated block or a count figure moves. This first one was made by an automated pass, which is weaker evidence than the maintainer's own read and is labelled so rather than left to be assumed. Roadmap 10.0b6.

Two properties shape what a vulnerability means here:

- **Everything runs in the browser.** There is no server, no account, no
  database and no API. The deployed page is static files on GitHub Pages.
- **Camera frames never leave the device.** The page requests camera access and
  processes frames locally with MediaPipe. Nothing is uploaded, and there is no
  endpoint to upload to.

## Reporting

Use the **Email** contact link at the bottom of the published page,
https://heshipstech.github.io/blinklab/, and say in the subject line that the
report is a security one. That reaches the maintainer directly and keeps the
report out of public issues while it is being fixed.

This file used to send reporters to GitHub's private vulnerability reporting.
That channel is switched off for this repository, so the instruction pointed at
a door that does not open. Last verified switched off on 6 September 2026, by
the September audit; if it is ever enabled, this section changes with it and the
verification date moves. The dating rule is `dependabot.yml`'s.

Please do not open a public issue for anything exploitable.

There is no bug bounty. This is a single-maintainer project and a response may
take a few days.

## What is worth reporting

- Anything that causes camera frames, landmark data or a stored calibration to
  leave the device
- A way to make the page execute code from a source it should not trust
- A dependency advisory with a demonstrated path into the published bundle —
  note that `npm audit --omit=dev` currently reports zero, and the dev-tree
  advisories are tracked separately
- Personal or participant data that should not be in a public repository

## What is out of scope

- GitHub Pages platform behaviour. Pages serves a fixed header set and cannot
  be configured, so no HTTP security header can be set for the deployed site.
  **That is a limit on HEADERS, not on policy.** An earlier version of this
  section said the absence of a Content-Security-Policy was "not a defect this
  repository can fix", which was wrong: a policy can be delivered as a
  `<meta http-equiv="Content-Security-Policy">` tag in the page itself, and
  roadmap row 10.2b is that work. `X-Frame-Options` has no meta equivalent and
  remains a genuine hosting limit. Corrected 7 September 2026, by the first
  full read under the stamp at the top of this file.
- Automated scanner output with no demonstrated impact.
- The accuracy of the published measurements. That is not a security question —
  it is the subject of the audit and remediation documents, and corrections are
  welcome as ordinary issues.

## Related documents

[AUDIT_REPORT_AUG_2026.md](AUDIT_REPORT_AUG_2026.md) is the August 2026 audit
and [docs/audit/2026-09-06-audit-report.md](docs/audit/2026-09-06-audit-report.md)
is the September one. **Known open items live in
[REMEDIATION-2026-09.md](REMEDIATION-2026-09.md)**, the live tracker.
`REMEDIATION.md` is the retired August ladder and says so at its own first
line; this section pointed at it as though it were current until 7 September
2026, which is the sort of thing a full read is for. Where the project stands
overall is the generated block at the top of [STATE.md](STATE.md).
