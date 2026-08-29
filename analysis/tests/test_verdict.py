"""The Python half of the verdict pin, increment 5 of the pilot.

The page derives a SessionVerdict from its own state
(src/core/sessionVerdict.ts); this suite holds the analysis side's
re-derivation from PRIMARY FACTS in the exported file to the same
bytes. The committed fixtures under test/fixtures/verdict/ are the
pin: a synthetic session CSV beside the canonical verdict JSON, and
BOTH implementations must reproduce the JSON byte for byte — the
TypeScript side from literal inputs (test/core/
sessionVerdictFixture.test.ts), this side from the CSV alone. A
mutation on either side lands on the same committed bytes, which is
what "mutations both directions" means.

The verdict is DERIVED, NEVER EXPORTED: the file carries facts, the
verdict is recomputed, and on a real session where the page and this
module disagree the researcher tool will declare an instrument
defect rather than trusting either.
"""

from pathlib import Path

import pandas as pd
import pytest

from blinklab.loader import Session, load_session
from blinklab.verdict import (
    CALIBRATION_REFUSED_SENTENCE,
    VERDICT_EVIDENCE_FLOOR_FPS,
    VERDICT_RISK_FPS,
    VerdictError,
    canonical_verdict_json,
    derive_verdict,
    js_to_fixed,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURES = REPO_ROOT / "test" / "fixtures" / "verdict"


def fixture_session(name: str) -> Session:
    return load_session(FIXTURES / f"{name}-session.csv")


def expected_json(name: str) -> str:
    return (FIXTURES / f"{name}-verdict.json").read_text(encoding="utf-8")


def surface(verdict: dict, name: str) -> dict:
    found = [
        entry for entry in verdict["surfaces"] if entry["surface"] == name
    ]
    assert len(found) == 1
    return found[0]


class TestTheBytePin:
    def test_good_fixture_reproduces_the_committed_bytes(self) -> None:
        verdict = derive_verdict(fixture_session("good"))
        assert canonical_verdict_json(verdict) == expected_json("good")

    def test_refused_fixture_reproduces_the_committed_bytes(self) -> None:
        verdict = derive_verdict(fixture_session("refused"))
        assert canonical_verdict_json(verdict) == expected_json("refused")

    def test_degraded_fixture_reproduces_the_committed_bytes(self) -> None:
        verdict = derive_verdict(fixture_session("degraded"))
        assert canonical_verdict_json(verdict) == expected_json("degraded")

    def test_the_fixture_files_carry_no_derived_verdict(self) -> None:
        # Derived, never exported: the CSV holds primary facts only,
        # so no verdict sentence and no verdict vocabulary may appear
        # in it. Checked on the fixtures because they are this repo's
        # canonical examples of what an export looks like.
        for name in ("good", "refused", "degraded"):
            csv_text = (FIXTURES / f"{name}-session.csv").read_text(
                encoding="utf-8"
            )
            verdict = derive_verdict(fixture_session(name))
            assert "headline" not in csv_text
            for entry in verdict["surfaces"]:
                assert entry["sentence"] not in csv_text


class TestSharedConstants:
    def test_the_refusal_sentence_is_the_published_one(self) -> None:
        # The report may not paraphrase the refusal, and neither may
        # this mirror: the constant is pinned to the sentence the
        # decision document froze, exactly as the TypeScript side
        # pins its copy.
        published = (REPO_ROOT / "docs" / "calibration-refusal.txt").read_text(
            encoding="utf-8"
        )
        collapsed = " ".join(published.split())
        assert CALIBRATION_REFUSED_SENTENCE in collapsed

    def test_the_thresholds_are_reused_not_rechosen(self) -> None:
        # The floor is the page's own 25 fps gate and the risk band
        # its 60, read from the TypeScript source the way
        # test_csv_contract reads the column list, so the two sides
        # cannot drift apart silently.
        source = (REPO_ROOT / "src" / "core" / "constants.ts").read_text(
            encoding="utf-8"
        )
        assert f"MIN_BLINK_FPS = {VERDICT_EVIDENCE_FLOOR_FPS:g}" in source
        assert f"BLINK_RISK_FPS = {VERDICT_RISK_FPS:g}" in source


class TestJsToFixed:
    def test_matches_the_ecmascript_rounding(self) -> None:
        # toFixed picks the closest n/10^f and the LARGER n on a tie,
        # so 62.5 becomes 63 where Python's round() would give 62.
        assert js_to_fixed(62.5, 0) == "63"
        assert js_to_fixed(0.62 * 100, 0) == "62"
        assert js_to_fixed(13.5, 1) == "13.5"
        assert js_to_fixed(1.129, 3) == "1.129"
        assert js_to_fixed(60.0, 1) == "60.0"


class TestDerivationRules:
    def test_a_file_without_the_visibility_counter_is_refused(self) -> None:
        session = fixture_session("good")
        del session.metadata["visibility_changes"]
        with pytest.raises(VerdictError, match="visibility"):
            derive_verdict(session)

    def test_a_count_that_disagrees_with_its_rows_is_refused(self) -> None:
        # The exporter derives the count row from the same array as
        # the timestamp rows, so a file where they disagree was
        # edited or damaged, and which one is true cannot be known.
        session = fixture_session("degraded")
        session.metadata["visibility_changes"] = "3"
        with pytest.raises(VerdictError, match="interruption"):
            derive_verdict(session)

    def test_calibration_flags_are_read_strictly(self) -> None:
        # The exporter writes lowercase true and false only; probe
        # A's capitalized True is a hand-edited file. Refusing beats
        # guessing, the round II precedent.
        session = fixture_session("good")
        session.metadata["calibration_refused"] = "True"
        with pytest.raises(VerdictError, match="calibration_refused"):
            derive_verdict(session)

    def test_a_never_frozen_calibration_is_unknown(self) -> None:
        session = fixture_session("good")
        for key in (
            "calibration_samples",
            "calibration_spread_ratio",
            "calibration_ceiling_bound",
            "calibration_refused",
        ):
            del session.metadata[key]
        finding = surface(derive_verdict(session), "calibration")
        assert finding["status"] == "unknown"

    def test_an_absent_pose_fraction_is_unknown_never_zero(self) -> None:
        session = fixture_session("good")
        del session.metadata["pose_valid_fraction"]
        finding = surface(derive_verdict(session), "pose")
        assert finding["status"] == "unknown"
        assert "0" not in finding["sentence"]

    def test_an_interruption_inside_the_window_refuses_it(self) -> None:
        session = fixture_session("degraded")
        session.metadata["marker_2_visibility_changes"] = "1"
        session.metadata["marker_1_visibility_changes"] = "0"
        verdict = derive_verdict(session)
        assert surface(verdict, "markedWindow")["status"] == "refused"
        assert verdict["headline"] == "refused"

    def test_unattributed_interruptions_leave_the_window_unknown(
        self,
    ) -> None:
        # A pre-pilot file has interruptions counted but no counter
        # at the markers: whether the window was disturbed is
        # unknown, never silently ok.
        session = fixture_session("degraded")
        del session.metadata["marker_1_visibility_changes"]
        del session.metadata["marker_2_visibility_changes"]
        finding = surface(derive_verdict(session), "markedWindow")
        assert finding["status"] == "unknown"

    def test_a_zero_width_window_refuses_to_score(self) -> None:
        session = fixture_session("good")
        session.metadata["marker_2_seconds"] = session.metadata[
            "marker_1_seconds"
        ]
        finding = surface(derive_verdict(session), "markedWindow")
        assert finding["status"] == "refused"

    def test_no_markers_is_not_applicable_distinct_from_unknown(self) -> None:
        session = fixture_session("good")
        session.metadata["markers"] = "0"
        for key in (
            "marker_1_seconds",
            "marker_2_seconds",
            "marker_1_visibility_changes",
            "marker_2_visibility_changes",
        ):
            del session.metadata[key]
        finding = surface(derive_verdict(session), "markedWindow")
        assert finding["status"] == "notApplicable"

    def test_the_dwell_replay_flips_only_after_a_settled_run(self) -> None:
        # The page's spoken ruler-fit verdict dwells for fifteen
        # records before changing its mind, and the exported columns
        # carry exactly the per-record inputs, so the replay must
        # land on the page's word, not on the instantaneous ratio.
        # 14 records over the ceiling do not flip; the 15th does.
        def session_with(tail: int) -> Session:
            rows = 5 + tail
            frame = pd.DataFrame(
                {
                    "timestampMs": [1000 * (i + 1) for i in range(rows)],
                    "faceDetected": [True] * rows,
                    "fps": [60.0] * rows,
                    "apertureMm": [7.0] * rows,
                    "baselineMm": [7.9] * 5 + [12.0] * tail,
                    "shutBaselineMm": [float("nan")] * rows,
                    "blinkRatePerMin": [float("nan")] * rows,
                    "lastBlinkDurationMs": [float("nan")] * rows,
                    "lastBlinkAmplitudeMm": [float("nan")] * rows,
                    "lastBlinkPeakVelocityMmPerS": [float("nan")] * rows,
                    "perclos": [float("nan")] * rows,
                    "longClosureCount": [0] * rows,
                    "fixationCount": [0] * rows,
                    "fixationMedianMs": [float("nan")] * rows,
                    "fixating": [False] * rows,
                    "onScreen": [True] * rows,
                    "baselineOverResting": [float("nan")] * rows,
                }
            )
            base = fixture_session("good")
            return Session(frame=frame, metadata=dict(base.metadata))

        still_fits = surface(derive_verdict(session_with(14)), "rulerFit")
        assert still_fits["status"] == "ok"
        flipped = surface(derive_verdict(session_with(15)), "rulerFit")
        assert flipped["status"] == "warned"

    def test_the_fallback_evidence_rate_names_its_source(self) -> None:
        finding = surface(
            derive_verdict(fixture_session("degraded")), "evidenceRate"
        )
        assert finding["status"] == "warned"
        assert "processing rate" in finding["sentence"]


class TestDamagedNumbers:
    """The adversarial pass's findings, docs/pilot-adversarial.txt.

    Probes P1-P5 confirmed the mirror crashed with bare tracebacks on
    non-numeric metadata cells, and P1b found worse: a nan pose
    fraction derived a verdict that calmly said "NaN percent". Every
    numeric cell now goes through one strict reader that refuses, by
    key, anything that does not parse to a finite number — crashed
    and refused must never be the same outcome, and neither may
    nonsense rendered calmly.
    """

    def test_a_non_finite_pose_fraction_refuses_by_key(self) -> None:
        for poison in ("inf", "nan", "-inf"):
            session = fixture_session("good")
            session.metadata["pose_valid_fraction"] = poison
            with pytest.raises(VerdictError, match="pose_valid_fraction"):
                derive_verdict(session)

    def test_a_non_finite_sampled_rate_refuses_by_key(self) -> None:
        session = fixture_session("good")
        session.metadata["sampled_fps"] = "inf"
        with pytest.raises(VerdictError, match="sampled_fps"):
            derive_verdict(session)

    def test_a_non_numeric_spread_refuses_by_key(self) -> None:
        session = fixture_session("good")
        session.metadata["calibration_spread_ratio"] = "abc"
        with pytest.raises(VerdictError, match="calibration_spread_ratio"):
            derive_verdict(session)

    def test_a_non_numeric_counter_refuses_by_key(self) -> None:
        session = fixture_session("good")
        session.metadata["visibility_changes"] = "abc"
        with pytest.raises(VerdictError, match="visibility_changes"):
            derive_verdict(session)

    def test_a_non_numeric_marker_refuses_by_key(self) -> None:
        session = fixture_session("good")
        session.metadata["marker_1_seconds"] = "abc"
        with pytest.raises(VerdictError, match="marker_1_seconds"):
            derive_verdict(session)

    def test_a_non_finite_fps_column_refuses_by_name(self) -> None:
        # The fallback rate is the median of the per-second fps
        # column; an inf cell would make the median inf and the
        # sentence nonsense. The column is named like the keys are.
        session = fixture_session("good")
        session.metadata["sampled_fps"] = "unknown"
        session.frame["fps"] = session.frame["fps"].astype(float)
        session.frame.loc[0, "fps"] = float("inf")
        with pytest.raises(VerdictError, match="fps"):
            derive_verdict(session)
