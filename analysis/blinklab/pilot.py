"""The pilot researcher additions, increment 9 of the ladder.

Three commitments from docs/assessment-pilot-plan.md, in code:

- The pilot table re-derives every session's verdict from PRIMARY
  FACTS in the file (blinklab/verdict.py); the page's rendering is
  never trusted as input, only compared against.
- On any session where the page's exported report and the
  re-derivation disagree, the comparison raises InstrumentDefect and
  the cohort analysis STOPS — the round II precedent, not a per-row
  shrug. A session with no report file is a row that says so, not a
  defect: nothing exists to disagree with.
- Restraint: the pilot table prints NO recall figure and NO score
  aggregate. Six volunteers are a smoke test, and an unvalidated
  heuristic must not acquire a cohort mean by accident.
"""

from __future__ import annotations

from blinklab.loader import load_session
from blinklab.validation import PairPaths
from blinklab.verdict import derive_verdict

REPORT_PREFIX = "blinklab-report-"

# The page's own section-2 status words, from
# src/core/participantReport.ts. A test pins the rebuilt lines to the
# committed report fixture, so this mapping cannot drift from the
# page's without going red.
_STATUS_WORDS = {
    "ok": "OK",
    "refused": "REFUSED",
    "warned": "WARNED",
    "unknown": "UNKNOWN",
    "notApplicable": "NOT APPLICABLE",
}

# Refusals first, the page's own order for section 2.
_SECTION_ORDER = ("refused", "warned", "unknown", "notApplicable", "ok")


class InstrumentDefect(RuntimeError):
    """The page and the re-derivation disagree on one session.

    Neither side can be trusted over the other, so the cohort
    analysis stops rather than averaging over a disagreement.
    """


def verdict_section_lines(verdict: dict) -> list[str]:
    """The page's section-2 lines, rebuilt from the derived verdict."""
    lines: list[str] = []
    for status in _SECTION_ORDER:
        for finding in verdict["surfaces"]:
            if finding["status"] != status:
                continue
            word = _STATUS_WORDS[status]
            lines.append(
                f"{word} — {finding['surface']}: {finding['sentence']}"
            )
    return lines


def _check_report_agrees(paths: PairPaths, verdict: dict) -> str:
    """One session's page-vs-derivation comparison, or its absence."""
    if paths.report_path is None:
        return "no report file"
    report_text = paths.report_path.read_text(encoding="utf-8")
    for line in verdict_section_lines(verdict):
        if line not in report_text:
            surface = line.split(":", 1)[0]
            raise InstrumentDefect(
                f"INSTRUMENT DEFECT on {paths.label} "
                f"({paths.session_path.name}): the page's exported "
                f"report does not carry the re-derived finding "
                f"{surface!r}. The page and this analysis disagree "
                "about one session, neither can be trusted over the "
                "other, and the cohort analysis stops here — the "
                "round II precedent, not a per-row shrug."
            )
    return "report agrees"


def pilot_verdict_lines(pairs: list[PairPaths]) -> list[str]:
    """The pilot table: one line per session, verdicts only.

    Raises InstrumentDefect before printing anything when any
    session's exported report disagrees with the re-derivation.
    """
    rows: list[str] = []
    for paths in pairs:
        session = load_session(paths.session_path)
        verdict = derive_verdict(session)
        agreement = _check_report_agrees(paths, verdict)
        counts: dict[str, int] = {}
        for finding in verdict["surfaces"]:
            counts[finding["status"]] = counts.get(finding["status"], 0) + 1
        summary = ", ".join(
            f"{count} {_STATUS_WORDS[status].lower()}"
            for status in _SECTION_ORDER
            if (count := counts.get(status, 0)) > 0
        )
        pseudonym = session.metadata.get("participant_pseudonym", "-")
        rows.append(
            f"{paths.label}  headline {verdict['headline']}  {summary}  "
            f"{agreement}  pseudonym {pseudonym}"
        )
    return [
        "PILOT VERDICTS (docs/assessment-pilot-plan.md). Each verdict is",
        "re-derived from primary facts in the session file; the page's",
        "exported report is compared against it, never trusted as input.",
        "No detection figure and no aggregate of the unvalidated",
        "heuristic appears here, by the plan's own restraint.",
        "",
        *rows,
    ]
