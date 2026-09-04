"""Round II's six rules, held to docs/validation-plan-round2.md.

The plan was committed before any round II session exists, and these
tests were watched failing before blinklab/round2.py existed. The
frozen-default test is the most important one here: round I's
published tables must stay reproducible, so the round II rules must
be unreachable without explicit selection.
"""

from pathlib import Path

from blinklab.loader import COLUMNS
from blinklab.round2 import (
    ROUND2_SHORT_RULER_FLOOR,
    RefusedCalibration,
    refused_calibration,
    round2_rules,
)
from blinklab.validation import find_pairs, load_pair
from blinklab.validation_checks import row_for

BLINK_HEADER = (
    "startFrame,endFrame,atMs,durationMs,amplitudeMm,"
    "peakClosingVelocityMmPerS,amplitudeOverVelocityMs"
)


def session_row(
    timestamp: int,
    fps: str = "60",
    aperture: str = "7.0",
    baseline: str = "",
) -> str:
    cells = [str(timestamp), "true", fps, aperture, baseline] + [""] * 6
    cells += ["0", "", "", "", "", "", ""]
    assert len(cells) == len(COLUMNS)
    return ",".join(cells)


def write_pair(
    tmp_path: Path,
    metadata: list[str],
    rows: list[str],
    stamp: str = "2026-08-30T10-00-00-000",
) -> Path:
    (tmp_path / f"blinklab-session-{stamp}.csv").write_text(
        "\n".join(["# source: camera", *metadata, ",".join(COLUMNS), *rows])
        + "\n",
        encoding="utf-8",
    )
    (tmp_path / f"blinklab-blinks-{stamp}.csv").write_text(
        "\r\n".join(["# source: camera", BLINK_HEADER, ",,5000,120,4.2,95,44"])
        + "\r\n",
        encoding="utf-8",
    )
    return tmp_path


def loaded(tmp_path: Path):
    pairs = find_pairs(tmp_path)
    assert len(pairs) == 1
    return load_pair(pairs[0])


MARKS = ["# marker_1_seconds: 2.000", "# marker_2_seconds: 12.000"]


def marked_rows(baseline: str = "7.5") -> list[str]:
    # Rows straddling the 2 s and 12 s marks, one per second.
    return [
        session_row(ts, baseline=baseline) for ts in range(1000, 15000, 1000)
    ]


class TestTheRefusalIsCountedFirst:
    def test_a_refused_session_is_a_refusal_with_its_certificate(
        self, tmp_path: Path
    ) -> None:
        pair = loaded(
            write_pair(
                tmp_path,
                [
                    "# calibration_samples: 301",
                    "# calibration_spread_ratio: 1.378",
                    "# calibration_ceiling_bound: true",
                    "# calibration_refused: true",
                ],
                marked_rows(baseline=""),
            )
        )
        refusal = refused_calibration(pair)
        assert isinstance(refusal, RefusedCalibration)
        assert refusal.samples == 301
        assert refusal.spread_ratio == 1.378
        assert refusal.violates_refusal_contract is False

    def test_a_refusal_that_is_not_ceiling_bound_breaks_the_contract(
        self, tmp_path: Path
    ) -> None:
        # Committed prediction 2: every refusal that fires is
        # ceiling-bound, because that is the only signal that exists.
        # A file that says otherwise is an instrument defect, not a
        # participant result.
        pair = loaded(
            write_pair(
                tmp_path,
                [
                    "# calibration_ceiling_bound: false",
                    "# calibration_refused: true",
                ],
                marked_rows(baseline=""),
            )
        )
        refusal = refused_calibration(pair)
        assert refusal is not None
        assert refusal.violates_refusal_contract is True

    def test_an_ordinary_session_is_not_a_refusal(
        self, tmp_path: Path
    ) -> None:
        for metadata in ([], ["# calibration_refused: false"]):
            folder = tmp_path / str(len(metadata))
            folder.mkdir()
            pair = loaded(write_pair(folder, metadata, marked_rows()))
            assert refused_calibration(pair) is None


class TestTheEvidenceRate:
    def test_prefers_the_sampled_fps_the_export_carries(
        self, tmp_path: Path
    ) -> None:
        pair = loaded(
            write_pair(
                tmp_path,
                [*MARKS, "# sampled_fps: 28.0"],
                marked_rows(),
            )
        )
        rules = round2_rules(pair, row_for(pair))
        assert rules.evidence_fps == 28.0
        assert rules.evidence_source == "sampled_fps"
        assert rules.evidence_unsound is False

    def test_below_the_floor_is_unsound(self, tmp_path: Path) -> None:
        pair = loaded(
            write_pair(
                tmp_path,
                [*MARKS, "# sampled_fps: 22.0"],
                marked_rows(),
            )
        )
        rules = round2_rules(pair, row_for(pair))
        assert rules.evidence_unsound is True

    def test_falls_back_to_window_fps_and_says_so(
        self, tmp_path: Path
    ) -> None:
        # No sampled_fps row: the per-second fps column inside the
        # marked window decides, and the source names the fallback so
        # the report cannot print a fallback as a measurement.
        rows = [
            session_row(ts, fps="20", baseline="7.5")
            for ts in range(1000, 15000, 1000)
        ]
        pair = loaded(write_pair(tmp_path, list(MARKS), rows))
        rules = round2_rules(pair, row_for(pair))
        assert rules.evidence_fps == 20.0
        assert rules.evidence_source == "per-second fps over the marked window"
        assert rules.evidence_unsound is True


class TestTheFreezeDefect:
    def test_any_drift_inside_the_window_is_a_defect(
        self, tmp_path: Path
    ) -> None:
        # The freeze makes the baseline a constant. Two distinct
        # values between the marks is not "4 percent drift", it is
        # the freeze broken in the field.
        rows = [
            session_row(ts, baseline="7.5") for ts in range(1000, 8000, 1000)
        ]
        rows += [
            session_row(ts, baseline="7.8") for ts in range(8000, 15000, 1000)
        ]
        pair = loaded(write_pair(tmp_path, list(MARKS), rows))
        rules = round2_rules(pair, row_for(pair))
        assert rules.freeze_defect is True

    def test_a_constant_baseline_passes(self, tmp_path: Path) -> None:
        pair = loaded(write_pair(tmp_path, list(MARKS), marked_rows()))
        rules = round2_rules(pair, row_for(pair))
        assert rules.freeze_defect is False


class TestTheShortRuler:
    def test_flagged_at_the_natural_line(self, tmp_path: Path) -> None:
        # Baseline 6.0 against a resting median of 7.0: a ruler below
        # the eye it measures. The floor is 1.0 by geometry, not a
        # tuned constant.
        assert ROUND2_SHORT_RULER_FLOOR == 1.0
        rows = [
            session_row(ts, aperture="7.0", baseline="6.0")
            for ts in range(1000, 15000, 1000)
        ]
        pair = loaded(write_pair(tmp_path, list(MARKS), rows))
        rules = round2_rules(pair, row_for(pair))
        assert rules.short_ruler is True

    def test_a_sane_ruler_is_not_short(self, tmp_path: Path) -> None:
        rows = [
            session_row(ts, aperture="7.0", baseline="7.7")
            for ts in range(1000, 15000, 1000)
        ]
        pair = loaded(write_pair(tmp_path, list(MARKS), rows))
        rules = round2_rules(pair, row_for(pair))
        assert rules.short_ruler is False


class TestTheZeroWidthWindow:
    def test_two_marks_in_the_same_moment_refuse_to_score(
        self, tmp_path: Path
    ) -> None:
        marks = [
            "# marker_1_seconds: 2.000",
            "# marker_2_seconds: 2.000",
        ]
        pair = loaded(write_pair(tmp_path, marks, marked_rows()))
        rules = round2_rules(pair, row_for(pair))
        assert rules.zero_width_window is True

    def test_an_ordinary_window_scores(self, tmp_path: Path) -> None:
        pair = loaded(write_pair(tmp_path, list(MARKS), marked_rows()))
        rules = round2_rules(pair, row_for(pair))
        assert rules.zero_width_window is False


class TestTheDefaultIsFrozen:
    def test_the_default_report_never_speaks_round_two(
        self, tmp_path: Path
    ) -> None:
        """Round I's published tables must stay reproducible.

        A refused-calibration file read by the DEFAULT invocation is
        reported exactly as the round I rules would report it, and no
        round II wording appears anywhere. The round II rules run
        only behind explicit selection.
        """
        import sys

        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
        from validation_report import report

        write_pair(
            tmp_path,
            [
                *MARKS,
                "# calibration_ceiling_bound: true",
                "# calibration_refused: true",
            ],
            marked_rows(),
        )
        lines, refused = report(tmp_path)
        text = "\n".join(lines)
        assert "ROUND II" not in text
        assert "CALIBRATION REFUSED" not in text
        assert refused == 0

    def test_round_two_counts_the_refusal_first(self, tmp_path: Path) -> None:
        import sys

        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
        from validation_report import report

        write_pair(
            tmp_path,
            [
                *MARKS,
                "# calibration_samples: 301",
                "# calibration_spread_ratio: 1.378",
                "# calibration_ceiling_bound: true",
                "# calibration_refused: true",
            ],
            marked_rows(baseline=""),
        )
        lines, refused = report(tmp_path, rules="round2")
        text = "\n".join(lines)
        assert "CALIBRATION REFUSED" in text
        assert "301" in text
        assert "1.378" in text
        # The refused session contributes no detector columns: with
        # the only session refused, the checks table has nobody left.
        assert "no readable sessions" in text


class TestWhatTheAdversarialPassFound:
    """docs/validation-round2-adversarial.txt, probes A, B and C."""

    def test_an_unrecognized_refused_flag_is_a_loud_refusal(
        self, tmp_path: Path
    ) -> None:
        # Probe A: `calibration_refused: True`, capital T. The
        # exporter writes only lowercase, so this file was edited or
        # damaged, and scoring it as an ordinary participant is the
        # silent wrong result the probe predicted. Refusing beats
        # guessing.
        import pytest

        from blinklab.validation import ValidationError

        pair = loaded(
            write_pair(
                tmp_path,
                [
                    "# calibration_ceiling_bound: true",
                    "# calibration_refused: True",
                ],
                marked_rows(),
            )
        )
        with pytest.raises(ValidationError, match="calibration_refused"):
            refused_calibration(pair)

    def test_a_refusal_with_a_damaged_ceiling_flag_is_a_loud_refusal(
        self, tmp_path: Path
    ) -> None:
        # A refused session whose ceiling flag is unreadable is a
        # damaged file, not an instrument defect: the defect line is
        # reserved for a file that legibly says refused-but-unbound.
        import pytest

        from blinklab.validation import ValidationError

        pair = loaded(
            write_pair(
                tmp_path,
                [
                    "# calibration_ceiling_bound: maybe",
                    "# calibration_refused: true",
                ],
                marked_rows(baseline=""),
            )
        )
        with pytest.raises(ValidationError, match="calibration_ceiling_bound"):
            refused_calibration(pair)

    def test_a_nan_sampled_rate_falls_back_instead_of_passing(
        self, tmp_path: Path
    ) -> None:
        # Probe B: NaN parses as a float and compares below no floor,
        # so it sailed through as sound evidence. A non-finite rate
        # is not a measurement: the per-second column decides, and
        # the source says so.
        pair = loaded(
            write_pair(
                tmp_path,
                [*MARKS, "# sampled_fps: NaN"],
                marked_rows(),
            )
        )
        rules = round2_rules(pair, row_for(pair))
        assert rules.evidence_fps == 60.0
        assert rules.evidence_source == "per-second fps over the marked window"

    def test_no_marked_window_is_said_not_asserted_constant(
        self, tmp_path: Path
    ) -> None:
        # Probe C: with no marks the tool printed "baseline constant
        # across the marked window" for a session that has no marked
        # window. The freeze verdict is None there, and the report
        # says so instead of asserting constancy over nothing.
        pair = loaded(write_pair(tmp_path, [], marked_rows()))
        rules = round2_rules(pair, row_for(pair))
        assert rules.freeze_defect is None
