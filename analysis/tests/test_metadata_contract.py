"""The metadata border between the two languages, asserted from both sides.

`test_csv_contract.py` next door holds the 18 data columns. It has held
them since Phase 7 and nothing has drifted. The metadata block above
those columns is a different story: 57 keys written by six TypeScript
modules, read by a dozen Python functions, and nothing anywhere checked
that the two lists were the same list. A renamed key left both suites
green and turned a Python gate into a pass-through — the reader would
find nothing, take its default, and report a session as fine.

So the same mechanism, applied to the metadata. Roadmap 10.1f1, ladder
D6 and B16.

Two things about the reader are worth stating, because both are ways a
contract test can look green while reading almost nothing.

The obvious regex is `line("key"` on one line. Thirteen keys in
`sessionMetadata.ts` alone are written by a `line(` call that wraps
across lines, including `sampled_fps`, which the session verdict is
derived from on both sides of this border. A reader that matched only
the one-line form would have found 29 of 42 there and reported success.

And `# key: value` appears in prose, in the comments that explain the
format. A reader that did not strip comments would report a metadata
key called `key`, which nothing writes and nothing reads.
"""

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CORE = REPO_ROOT / "src" / "core"
SPEC = REPO_ROOT / "SPEC.md"

# Every TypeScript module that writes a `# key: value` row, plus the
# one that assembles them. Named rather than globbed: a new writer has
# to be added here on purpose, which is the moment to ask whether its
# keys are documented and read. `csv.ts` writes no key of its own today
# and is watched because it is where one would be added.
WRITERS = [
    "sessionMetadata",
    "blinkLog",
    "csv",
    "frameClock",
    "frameTrace",
    "kss",
    "stepCalibration",
]

# What the analysis track believes the browser writes. Written out
# rather than derived, so a change on the TypeScript side has to be
# acknowledged here by a human editing this list. `N` stands for the
# index in a family of keys built per marker or per interruption.
EXPECTED_WRITTEN = [
    "app_commit",
    "blinks_detected",
    "blinks_recorded",
    "calibration_ceiling_bound",
    "calibration_refused",
    "calibration_samples",
    "calibration_spread_ratio",
    "camera",
    "camera_declared_fps",
    "camera_delivered_fps",
    "camera_resolution",
    "clip",
    "clip_duration_s",
    "delivered_frames_read_fraction",
    "device_pixel_ratio",
    "face_detected_fraction",
    "facing_mode",
    "feature_records_dropped",
    "feature_records_note",
    "frame_interval_s",
    "frames_measured",
    "frames_recorded",
    "frames_sought",
    "hardware_concurrency",
    "inexact_landings",
    "interruption_N_seconds",
    "kss_after",
    "kss_after_at_seconds",
    "kss_before",
    "light_cycles",
    "light_phase_ms",
    "light_settle_ms",
    "light_stimulus",
    "light_stimulus_start_ms",
    "marker_N_seconds",
    "marker_N_visibility_changes",
    "markers",
    "measured_fps",
    "measurement_frame",
    "measurement_mode",
    "median_iris_width_note",
    "median_iris_width_px",
    "observed_duration_seconds",
    "orientation",
    "participant_pseudonym",
    "perclos_min_observed_ms",
    "perclos_min_samples",
    "pose_valid_fraction",
    "protocol",
    "records",
    "sampled_fps",
    "screen",
    "source",
    "user_agent",
    "user_agent_form",
    "viewport",
    "visibility_changes",
]

# What this folder actually reads out of a metadata block. Also written
# out: a key added here has to exist on the other side, and the test
# below reads every `metadata.get("...")` literal in the tree and
# demands it appear here, so a new read cannot be added silently.
READ_BY_PYTHON = [
    # Roadmap 10.1f2: three keys the browser had written into every
    # export since remediation E2 that nothing read. A cohort table
    # could mix two builds without saying so, and a truncated session
    # was indistinguishable from a short one.
    "app_commit",
    "feature_records_dropped",
    "protocol",
    "blinks_detected",
    "blinks_recorded",
    "calibration_samples",
    "calibration_spread_ratio",
    "frames_measured",
    "kss_after",
    "kss_before",
    "light_stimulus_start_ms",
    "marker_N_seconds",
    "marker_N_visibility_changes",
    "markers",
    "measurement_mode",
    "participant_pseudonym",
    "pose_valid_fraction",
    "sampled_fps",
    "source",
    "visibility_changes",
]


def strip_comments(source: str) -> str:
    """Block and line comments removed, so prose about the format is not read.

    `# key: value` is how these comments describe the block, so a reader
    that skipped this step would report a key called `key`.
    """
    without_blocks = re.sub(r"/\*.*?\*/", "", source, flags=re.S)
    return re.sub(r"//[^\n]*", "", without_blocks)


def family(key: str) -> str:
    """A per-index key reduced to its family.

    marker_1_seconds becomes marker_N_seconds.
    """
    return re.sub(r"_\d+_", "_N_", key)


def keys_in(source: str) -> set[str]:
    """Every metadata key one TypeScript source writes.

    Three shapes, because the writers use three. `line("x", …)`, whether
    or not the call wraps across lines, which `\\s*` is what covers.
    `line(\\`marker_${i}_seconds\\`, …)`, a family built per index,
    normalised to its family name. And a bare template row,
    `\\`# frames_measured: …\\``, which is how the modules outside
    sessionMetadata write.
    """
    clean = strip_comments(source)
    found = set(re.findall(r'line\(\s*"([a-z_0-9]+)"', clean))
    for match in re.finditer(r"line\(\s*`([^`]+)`", clean):
        found.add(re.sub(r"\$\{[^}]*\}", "N", match.group(1)))
    found.update(re.findall(r"`# ([a-z_0-9]+):", clean))
    return found


def declared_keys() -> list[str]:
    """Every metadata key the browser can write, from the writers."""
    keys: set[str] = set()
    for writer in WRITERS:
        keys |= keys_in((CORE / f"{writer}.ts").read_text(encoding="utf-8"))
    return sorted(keys)


def spec_keys() -> list[str]:
    """The keys SPEC.md's session-metadata table names, in its first column."""
    text = SPEC.read_text(encoding="utf-8")
    start = text.find("### The session metadata block")
    assert start != -1, "SPEC.md has no session metadata block section"
    end = text.find("\n## ", start)
    section = text[start : None if end == -1 else end]
    # The formatter pads the columns, so the cell is matched with its
    # padding rather than assumed flush. A regex that assumed flush
    # found exactly one key of 57 and the comparison still ran.
    return sorted(re.findall(r"^\| *`([a-z_0-9N]+)` *\|", section, re.M))


class TestTheReaderItself:
    """A contract test is worth what its reader reads, and no more."""

    def test_finds_a_call_that_wraps_across_lines(self) -> None:
        # Thirteen real keys are written this way, sampled_fps among
        # them. A one-line regex finds none of them and says nothing.
        assert keys_in('    line(\n      "user_agent",\n      x,\n    ),') == {
            "user_agent"
        }

    def test_finds_a_family_built_per_index(self) -> None:
        assert keys_in("line(`marker_${marker.index}_seconds`, v)") == {
            "marker_N_seconds"
        }

    def test_ignores_the_format_described_in_a_comment(self) -> None:
        # Every one of these writers explains itself with a `# key:
        # value` example. None of them writes a key called `key`.
        assert keys_in("// rows as `# key: value` lines\n") == set()
        assert keys_in("/* the `# key: value` block */\n") == set()

    def test_finds_a_bare_template_row(self) -> None:
        assert keys_in("`# frames_measured: ${n}`") == {"frames_measured"}


class TestTheContract:
    def test_every_writer_is_where_we_think_it_is(self) -> None:
        for writer in WRITERS:
            assert (CORE / f"{writer}.ts").exists(), writer

    def test_the_written_keys_are_the_expected_ones(self) -> None:
        assert declared_keys() == sorted(EXPECTED_WRITTEN)

    def test_the_reader_finds_a_useful_number_of_keys(self) -> None:
        # A reader that broke would return an empty set, and every
        # comparison above would then be against an empty list on both
        # sides. This is the floor that makes the rest mean something.
        assert len(declared_keys()) > 40

    def test_every_key_python_reads_is_one_the_browser_writes(self) -> None:
        written = set(declared_keys())
        missing = [key for key in READ_BY_PYTHON if key not in written]
        assert missing == [], (
            f"these are read here and written by nobody: {missing}"
        )

    def test_every_read_in_the_tree_is_declared_here(self) -> None:
        # The other direction. A new `metadata.get("x")` anywhere in the
        # analysis track has to be added to READ_BY_PYTHON, which is the
        # moment to check that the browser writes x at all.
        literals: set[str] = set()
        for path in sorted(REPO_ROOT.glob("analysis/**/*.py")):
            if "__pycache__" in path.parts or path.name == Path(__file__).name:
                continue
            source = path.read_text(encoding="utf-8")
            literals.update(
                family(key)
                for key in re.findall(
                    r'metadata\.get\(\s*"([a-z_0-9]+)"', source
                )
            )
        undeclared = sorted(literals - set(READ_BY_PYTHON))
        assert undeclared == [], (
            f"read somewhere in analysis/ and not declared here: {undeclared}"
        )


def spec_record_fields() -> list[str]:
    """The field names in SPEC.md's FeatureRecord code block."""
    text = SPEC.read_text(encoding="utf-8")
    start = text.find("export type FeatureRecord = {")
    assert start != -1, "SPEC.md has no FeatureRecord block"
    end = text.find("};", start)
    return re.findall(r"^\s{2}([A-Za-z]+):", text[start:end], re.M)


class TestTheSpecification:
    def test_the_spec_reader_finds_the_table_at_all(self) -> None:
        # The formatter pads the table's columns. The first version of
        # the reader assumed the cells were flush, found one key of 57,
        # and the comparison below still ran — against a list of one on
        # one side and 57 on the other, which fails loudly, but a
        # different pair of lists would not have. This is the floor.
        assert len(spec_keys()) > 40

    def test_the_spec_documents_every_key_and_invents_none(self) -> None:
        assert spec_keys() == declared_keys()

    def test_the_spec_record_block_is_the_real_record(self) -> None:
        """SPEC's ts block said it was kept current and was two fields behind.

        `baselineOverResting` landed on 23 August and `pupilDiameterMm`
        after it, and both reached the CSV, the schema and the analysis
        while this document went on describing sixteen fields. The
        columns are the record's own field set, tested next door, so
        holding the block to them holds it to the record.
        """
        from tests.test_csv_contract import declared_columns

        assert spec_record_fields() == declared_columns()
