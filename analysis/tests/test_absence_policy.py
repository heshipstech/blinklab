"""What each reader does when a metadata key is not there.

Roadmap 10.1f4, ladder D6. The increment before this one split the 57
keys by WHEN they are written: 21 that every export carries and 36
written only when the thing they describe happened. This is the other
end of that. A reader meeting an absent key has to do something, and
until now what it did was a property of whichever line happened to be
written, stated in a docstring where anyone thought to state it and
nowhere otherwise.

Three things can be right, and which one is right is a judgement about
the measurement rather than about the code:

  * take a default, when absence means the thing did not happen and the
    analysis is still sound without it;
  * report unknown, when absence means the analysis cannot answer this
    particular question but can answer the others;
  * refuse, when absence means the file is not what it claims to be and
    anything derived from it would be a number nobody could check.

The danger is the first one taken by accident. A reader that defaults
where it should refuse turns a damaged file into a calm wrong answer,
and that is the exact defect this whole run of increments keeps
finding: `blinks_lost` shrugging a ValueError into zero so a file that
SAID it lost rows printed as a clean count, and `_number` letting NaN
through every floor comparison because NaN compares below nothing.

So every policy is written down here and exercised: the reader is
called with a block it can read, then with the same block minus one
key, and the answer is held to the stated one. A docstring saying "None
when absent" beside a function that raises is a docstring; this is a
test.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import pandas as pd
import pytest

from blinklab import round2, validation_checks, verdict
from blinklab.blink_log import BlinkLog
from blinklab.light_response import LightResponseError, stimulus_start_ms
from blinklab.loader import Session, _records_dropped
from blinklab.validation import CameraBlinkLog, SessionPair, _refuse_clip

# A stand-in for "the reader raised", so a policy can name a refusal in
# the same table as a value.
REFUSES = object()


def session(metadata: dict[str, str]) -> Session:
    """A loaded session carrying nothing but its metadata block.

    The frame is empty on purpose: every reader under test here reads
    the block, and handing it rows would let one of them answer from
    the wrong place without the test noticing.
    """
    return Session(frame=pd.DataFrame(), metadata=metadata)


def pair(metadata: dict[str, str]) -> SessionPair:
    return SessionPair(
        label="P1",
        stamp="2026-08-30T10-00-00-000",
        session=session(metadata),
        blinks=None,
    )


def blink_log(metadata: dict[str, str]) -> BlinkLog:
    return BlinkLog(name="clip", blinks=[], metadata=metadata)


def camera_blinks(metadata: dict[str, str]) -> CameraBlinkLog:
    return CameraBlinkLog(name="P1", blinks=[], metadata=metadata)


@dataclass(frozen=True)
class ReadSite:
    """One key, one reader, and what the reader does without it."""

    key: str
    where: str
    read: Callable[[dict[str, str]], Any]
    # A block the reader can read. Small on purpose: only the keys this
    # particular reader consults, so removing the key under test is the
    # only difference between the two calls.
    present: dict[str, str]
    # What `read` returns when `key` is gone, or REFUSES when it raises.
    without: Any


READ_SITES = [
    ReadSite(
        "app_commit",
        "loader.Session.app_commit",
        lambda meta: session(meta).app_commit,
        {"app_commit": "abc1234"},
        None,
        # Absence is age, not damage: every export before the build
        # stamp shipped carries no such row, and the round report says
        # so in words rather than guessing a build.
    ),
    ReadSite(
        "protocol",
        "loader.Session.protocol",
        lambda meta: session(meta).protocol,
        {"protocol": "docs/assessment-pilot-plan.md 2026-08-28"},
        None,
    ),
    ReadSite(
        "feature_records_dropped",
        "loader.Session.records_dropped",
        _records_dropped,
        {"feature_records_dropped": "12"},
        None,
        # The exporter writes this row ONLY when rows were dropped, so
        # absence means nothing was lost. Zero would mean the same
        # thing here, which is exactly why the exporter refuses to
        # write a zero: a key that is always present and usually zero
        # teaches readers to skip it.
    ),
    ReadSite(
        "measurement_mode",
        "blink_log.BlinkLog.measured_completely",
        lambda meta: blink_log(meta).measured_completely,
        {"measurement_mode": "stepped"},
        False,
        # Not-stepped is the safe answer. Claiming complete coverage
        # for a file that does not say so would let a partial
        # measurement be scored against a complete annotation, which
        # blames the detector for frames it never saw.
    ),
    ReadSite(
        "frames_measured",
        "blink_log.BlinkLog.frames_measured",
        lambda meta: blink_log(meta).frames_measured,
        {"frames_measured": "1800"},
        None,
    ),
    ReadSite(
        "blinks_detected",
        "validation.CameraBlinkLog.blinks_lost",
        lambda meta: camera_blinks(meta).blinks_lost,
        {"blinks_detected": "40", "blinks_recorded": "38"},
        0,
        # Half a declaration is refused earlier, by
        # `_refuse_broken_truncation_declaration`, which is why this
        # reader is allowed to answer zero: by the time it runs, the
        # pair is either whole or the file is already gone.
    ),
    ReadSite(
        "blinks_recorded",
        "validation.CameraBlinkLog.blinks_lost",
        lambda meta: camera_blinks(meta).blinks_lost,
        {"blinks_detected": "40", "blinks_recorded": "38"},
        0,
    ),
    ReadSite(
        "source",
        "validation._refuse_clip",
        lambda meta: _refuse_clip(meta, "P1"),
        {"source": "camera"},
        None,
        # This gate refuses a file that SAYS it is a clip. A file that
        # says nothing is not a clip declaring itself, so the gate lets
        # it through and the checks downstream judge it on its numbers.
    ),
    ReadSite(
        "visibility_changes",
        "verdict._interruption_count",
        verdict._interruption_count,
        {"visibility_changes": "2"},
        REFUSES,
        # The one refusal among the counters. Every export since the
        # pilot contract carries this row, so a session file without it
        # predates the contract the verdict is defined against, and
        # deriving a verdict from it would answer a question this file
        # was never asked.
    ),
    ReadSite(
        "pose_valid_fraction",
        "verdict._pose",
        lambda meta: verdict._pose(meta)["status"],
        {"pose_valid_fraction": "0.980"},
        "unknown",
        # Unknown rather than a default, because a pose fraction is a
        # published percentage: 0.000 would read as "every frame
        # failed" and 1.000 as "none did", and both are claims the file
        # does not make.
    ),
    ReadSite(
        "markers",
        "verdict._marked_window",
        lambda meta: verdict._marked_window(meta, 0)["status"],
        {
            "markers": "2",
            "marker_1_seconds": "42.000",
            "marker_2_seconds": "55.500",
        },
        "notApplicable",
        # A session with no marks did not follow the marked protocol.
        # Not applicable and refused are different words on the report
        # and mean different things to whoever reads it.
    ),
    ReadSite(
        "marker_1_seconds",
        "verdict._marked_window",
        lambda meta: verdict._marked_window(meta, 0)["status"],
        {
            "markers": "2",
            "marker_1_seconds": "42.000",
            "marker_2_seconds": "55.500",
        },
        REFUSES,
        # A file counting two marks and listing one lost a line: the
        # exporter writes the count and the timestamps from one array,
        # so they cannot disagree in a file it wrote.
    ),
    ReadSite(
        "calibration_samples",
        "verdict._calibration",
        lambda meta: verdict._calibration(meta)["status"],
        {
            "calibration_refused": "false",
            "calibration_ceiling_bound": "false",
            "calibration_samples": "301",
            "calibration_spread_ratio": "1.129",
        },
        REFUSES,
        # Same argument as the markers: the birth certificate's four
        # rows are written together or not at all, so three of four is
        # a file that lost one on its way here.
    ),
    ReadSite(
        "calibration_refused",
        "verdict._calibration",
        lambda meta: verdict._calibration(meta)["status"],
        {
            "calibration_refused": "false",
            "calibration_ceiling_bound": "false",
            "calibration_samples": "301",
            "calibration_spread_ratio": "1.129",
        },
        "unknown",
        # The absence that means the window never froze at all: no
        # ruler was born and no refusal fired. Unknown rather than not
        # applicable, and the difference is worth the words. A session
        # with no marks did not follow the marked protocol, so that
        # question does not apply to it. A session whose baseline never
        # froze was trying to calibrate and did not get there, so the
        # question applies and the answer is not known.
    ),
    ReadSite(
        "sampled_fps",
        "round2._number",
        lambda meta: round2._number(pair(meta), "sampled_fps"),
        {"sampled_fps": "59.9"},
        None,
        # None, and the caller then falls back to the per-second fps
        # column and SAYS which source it used. A default number here
        # would be an evidence rate nobody measured.
    ),
    ReadSite(
        "calibration_spread_ratio",
        "validation_checks._number",
        lambda meta: validation_checks._number(
            session(meta), "calibration_spread_ratio"
        ),
        {"calibration_spread_ratio": "1.129"},
        None,
    ),
    ReadSite(
        "light_stimulus_start_ms",
        "light_response.stimulus_start_ms",
        stimulus_start_ms,
        {"light_stimulus_start_ms": "5000"},
        REFUSES,
        # No stimulus ran during this session, so there is no schedule
        # to sort the rows into. Answering zero would invent one.
    ),
    ReadSite(
        "participant_pseudonym",
        "pilot.report",
        lambda meta: meta.get("participant_pseudonym", "-"),
        {"participant_pseudonym": "participant-01"},
        "-",
        # Identity here is voluntary, so absence is a person who
        # declined rather than a row that went missing, and the table
        # prints a dash rather than the word unknown.
    ),
    ReadSite(
        "kss_before",
        "plot._title",
        lambda meta: meta.get("kss_before", "not asked"),
        {"kss_before": "3 (Alert)"},
        "not asked",
    ),
    ReadSite(
        "kss_after",
        "plot._title",
        lambda meta: meta.get("kss_after", "not asked"),
        {"kss_after": "4"},
        "not asked",
    ),
]


@pytest.mark.parametrize("site", READ_SITES, ids=lambda site: site.where)
class TestEveryReaderStatesWhatAbsenceMeans:
    def test_the_reader_reads_the_key_when_it_is_there(
        self, site: ReadSite
    ) -> None:
        """The floor under the test below.

        A reader that raised on every input would satisfy a stated
        refusal, and a reader that returned the default on every input
        would satisfy a stated default. Neither is a reader. So the
        present case is exercised first, and it must not raise.
        """
        assert site.key in site.present, site.where
        site.read(site.present)

    def test_absence_gives_the_stated_answer(self, site: ReadSite) -> None:
        without = {
            key: value
            for key, value in site.present.items()
            if key != site.key
        }
        if site.without is REFUSES:
            with pytest.raises(
                (
                    verdict.VerdictError,
                    LightResponseError,
                ),
            ):
                site.read(without)
        else:
            assert site.read(without) == site.without, site.where


class TestThePolicyTableIsTheWholeContract:
    def test_every_key_python_reads_has_a_policy(self) -> None:
        """No read site left to whatever its code happens to do.

        `READ_BY_PYTHON` in the contract test next door is the list of
        keys this folder reads, held there against what the browser
        writes. Every one of them has to appear here too, so a key
        given a reader cannot be given one without a decision about
        what its absence means.
        """
        from tests.test_metadata_contract import READ_BY_PYTHON

        covered = {site.key for site in READ_SITES}
        # The marker family is read per index; the policy is one rule.
        covered.add("marker_N_seconds")
        covered.add("marker_N_visibility_changes")
        missing = sorted(set(READ_BY_PYTHON) - covered)
        assert missing == [], f"no stated absence policy: {missing}"

    def test_the_table_is_not_empty_and_names_real_readers(self) -> None:
        # The floor. An empty table would make the parametrised tests
        # above collect nothing and report success.
        assert len(READ_SITES) > 15
        assert all("." in site.where for site in READ_SITES)

    def test_both_kinds_of_policy_are_represented(self) -> None:
        # A table where everything refused, or everything defaulted,
        # would mean the distinction had collapsed and nobody noticed.
        assert any(site.without is REFUSES for site in READ_SITES)
        assert any(site.without is None for site in READ_SITES)
        assert any(isinstance(site.without, str) for site in READ_SITES)
