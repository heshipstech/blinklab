# Security policy

## What this is

blinklab is a research and learning project: a browser demo that measures
blinks from a webcam, plus the analysis code behind its published numbers. It
is **not a medical device** and is not used to make decisions about anyone.

Two properties shape what a vulnerability means here:

- **Everything runs in the browser.** There is no server, no account, no
  database and no API. The deployed page is static files on GitHub Pages.
- **Camera frames never leave the device.** The page requests camera access and
  processes frames locally with MediaPipe. Nothing is uploaded, and there is no
  endpoint to upload to.

## Reporting

Open a **private** vulnerability report through GitHub: the Security tab →
"Report a vulnerability". That keeps the report out of public issues while it
is being fixed.

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
  be configured, so the absence of a Content-Security-Policy or
  `X-Frame-Options` on the deployed site is a hosting limit, not a defect this
  repository can fix. It is recorded in the audit rather than left implicit.
- Automated scanner output with no demonstrated impact.
- The accuracy of the published measurements. That is not a security question —
  it is the subject of the audit and remediation documents, and corrections are
  welcome as ordinary issues.

## Related documents

[AUDIT_REPORT_AUG_2026.md](AUDIT_REPORT_AUG_2026.md) is the August 2026 audit;
[REMEDIATION.md](REMEDIATION.md) records what has been fixed since. Known open
items live there rather than being rediscovered.
