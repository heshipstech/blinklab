"""How hard DROZY's within-subject bar actually is.

Roadmap 10.10c2, ladder B11. The published result grants three
"suggestive and unconfirmed" verdicts, and every one of them rests on
the within-subject column alone: at least 3 of 5 multi-session subjects
agreeing on the sign of an effect.

Under the null each subject is a coin flip, so that bar is cleared half
the time by nothing at all. A bar cleared half the time is not a bar,
and the result file said nothing about it.

The table cannot be regenerated to carry the annotation: recomputing it
needs a re-extract from DROZY.zip and would recreate the derived video
DATASETS.md requires destroyed. So the arithmetic is stated in the
result file's prose and recomputed here from the counts that file
already publishes, which is the same arrangement the README's intervals
use.
"""

from __future__ import annotations

import re
from pathlib import Path

from blinklab.stats import binomial_at_least

REPO_ROOT = Path(__file__).resolve().parents[2]
RESULT = REPO_ROOT / "docs" / "drozy-result.txt"


def agreement_counts() -> list[tuple[int, int]]:
    """Every "k/n agree" cell in the published primary table."""
    text = RESULT.read_text(encoding="utf-8")
    start = text.find("PRIMARY, Spearman against KSS across sessions")
    assert start != -1, "the result file has no primary table"
    end = text.find("\nNEGATIVE CONTROL", start)
    section = text[start : None if end == -1 else end]
    return [
        (int(agree), int(total))
        for agree, total in re.findall(r"(\d+)/(\d+) agree", section)
    ]


class TestTheBarIsACoinFlip:
    def test_the_table_is_found_rather_than_assumed(self) -> None:
        # The floor. A reader that matched nothing would make every
        # assertion below run over an empty list and report success.
        counts = agreement_counts()
        assert len(counts) == 7, counts
        assert all(total == 5 for _, total in counts), counts

    def test_the_published_chance_rate_is_the_computed_one(self) -> None:
        # The result file states 0.500 in words. This is that number,
        # recomputed from the denominators the table itself carries.
        for _, total in agreement_counts():
            assert binomial_at_least(3, total, 0.5) == 0.5

    def test_the_result_file_states_it_where_the_column_is_read(
        self,
    ) -> None:
        text = RESULT.read_text(encoding="utf-8")
        assert "cleared 0.500 of" in text
        assert "is not a bar" in text

    def test_the_file_fixes_the_rule_for_later_bars(self) -> None:
        # B11's other half: a bar added after this may not grant a
        # verdict alone unless its chance rate is below 0.05.
        text = RESULT.read_text(encoding="utf-8")
        assert "must state its chance" in text
        assert "below\n0.05" in text or "below 0.05" in text


class TestTheAlertnessReadingIsNotAnEquivalence:
    """Ladder B9. A test that never had the power to find a difference
    cannot report one, and this file twice said it had."""

    def test_the_retired_phrasing_is_gone(self) -> None:
        text = (REPO_ROOT / "docs" / "alertness-score-result.txt").read_text(
            encoding="utf-8"
        )
        headline = text.split("WHAT THIS IS, AND WHAT IT IS NOT")[0]
        assert "not distinguishable from chance" not in headline
        assert "about as good as a fitted one here." not in text

    def test_it_states_what_the_control_could_have_seen(self) -> None:
        text = (REPO_ROOT / "docs" / "alertness-score-result.txt").read_text(
            encoding="utf-8"
        )
        assert "no evidence either way" in text
        # The detectable edge, which the file already reported as the
        # null's 97.5th percentile, now named as what it means.
        assert "about 0.14" in text
        assert "+0.141" in text
