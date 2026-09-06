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

# What the analysis track believes the browser writes, split by WHEN.
#
# Roadmap 10.1f3, ladder D6. The distinction is the whole reason this
# split exists: a key that is always written and turns up missing is a
# damaged file, and a key that is written only sometimes and turns up
# missing is an ordinary session. A reader cannot tell those apart from
# the absence, so the contract has to say which the key is.
#
# `N` stands for the index in a family of keys built per marker or per
# interruption.

# Every session export carries these, whatever happened in the session.
# A file missing one has lost a line on its way here, and a reader is
# entitled to refuse it. Held below against SPEC.md's when-written
# column, which `test/core/metadataPresence.test.ts` exercises by
# calling the real row builders with the arguments three real sessions
# supply — so this list is transitively held to the exporter itself,
# not to a second description of it.
ALWAYS_WRITTEN = [
    "app_commit",
    "camera",
    "clip",
    "clip_duration_s",
    "face_detected_fraction",
    "frames_measured",
    "kss_after",
    "kss_before",
    "markers",
    "measured_fps",
    "measurement_frame",
    "measurement_mode",
    "median_iris_width_px",
    "observed_duration_seconds",
    "perclos_min_observed_ms",
    "perclos_min_samples",
    "pose_valid_fraction",
    "protocol",
    "records",
    "source",
    "visibility_changes",
]

# Written only when the thing they describe happened, each with the
# condition in words. Absence here is a fact about the session, not a
# damaged file, so a reader that refuses one of these refuses good
# measurements.
CONDITIONAL = {
    "blinks_detected": "the blink log, which is a different file",
    "blinks_recorded": "the blink log, which is a different file",
    "calibration_ceiling_bound": "a baseline that froze",
    "calibration_refused": "a baseline that froze",
    "calibration_samples": "a baseline that froze",
    "calibration_spread_ratio": "a baseline that froze",
    "camera_declared_fps": "a camera session",
    "camera_delivered_fps": "a camera session with a measurable rate",
    "camera_resolution": "a camera session",
    "delivered_frames_read_fraction": (
        "a camera session with a measurable rate"
    ),
    "device_pixel_ratio": "a camera session",
    "facing_mode": "a camera session",
    "feature_records_dropped": "rows lost to the per-second buffer",
    "feature_records_note": "rows lost to the per-second buffer",
    "frame_interval_s": "a stepped clip",
    "frames_recorded": "the frame trace, which is a different file",
    "frames_sought": "a stepped clip",
    "hardware_concurrency": "a camera session",
    "inexact_landings": "a stepped clip",
    "interruption_N_seconds": "one row per interruption",
    "kss_after_at_seconds": "an after-answer that was given",
    "light_cycles": "a light-response session",
    "light_phase_ms": "a light-response session",
    "light_settle_ms": "a light-response session",
    "light_stimulus": "a light-response session",
    "light_stimulus_start_ms": "a light-response session",
    "marker_N_seconds": "one row per marker",
    "marker_N_visibility_changes": "one row per marker",
    "median_iris_width_note": "an iris sample that hit its cap",
    "orientation": "a camera session",
    "participant_pseudonym": "a pseudonym that was set",
    "sampled_fps": "a camera session with a measurable rate",
    "screen": "a camera session",
    "user_agent": "a camera session",
    "user_agent_form": "a camera session",
    "viewport": "a camera session",
}

# The two kinds together are the whole contract.
EXPECTED_WRITTEN = ALWAYS_WRITTEN + list(CONDITIONAL)

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


def spec_presence() -> dict[str, str]:
    """SPEC.md's when-written cell for each key, keyed by the key.

    A cell reading exactly "Every export" is a promise the exporter
    keeps for every file. Anything else names a condition, and
    "Every export, once a baseline resolved" is one of those: it reads
    like a promise and is not, which is why the comparison is against
    the exact string rather than against a prefix.
    """
    text = SPEC.read_text(encoding="utf-8")
    start = text.find("### The session metadata block")
    assert start != -1, "SPEC.md has no session metadata block section"
    end = text.find("\n## ", start)
    section = text[start : None if end == -1 else end]
    return {
        key: when.strip()
        for key, when in re.findall(
            r"^\| *`([a-z_0-9N]+)` *\| *([^|]*?) *\|", section, re.M
        )
    }


class TestWhenEachKeyIsWritten:
    """Which keys a reader may demand, and which it must do without.

    The exercise that makes this mean anything lives on the other side:
    `test/core/metadataPresence.test.ts` calls the real row builders
    with the arguments three real sessions supply — a thin camera
    session, a clip, and a session where every optional thing happened —
    and holds SPEC.md's column to what comes out. This end holds the
    Python lists to that same column, so a reader here that believes a
    key is unconditional is believing something the exporter was made
    to prove.

    Writing the column by reading the writers was not enough. It was
    written that way in 10.1f1 and was wrong about seven keys, six of
    them in the same direction: `line()` writes `unknown` rather than
    dropping a row, so a value that may be unknown was described as a
    row that may be absent. Those are different claims, and the reader
    on this side acts on the difference.
    """

    def test_the_reader_finds_a_rule_for_every_key(self) -> None:
        # The floor. A reader that matched nothing would make both
        # comparisons below run against an empty dictionary.
        rules = spec_presence()
        assert len(rules) > 40
        assert sorted(rules) == declared_keys()

    def test_no_key_is_both_kinds(self) -> None:
        assert set(ALWAYS_WRITTEN) & set(CONDITIONAL) == set()

    def test_the_unconditional_keys_are_the_ones_spec_promises(self) -> None:
        rules = spec_presence()
        promised = sorted(
            key for key, when in rules.items() if when == "Every export"
        )
        assert promised == sorted(ALWAYS_WRITTEN)

    def test_every_conditional_key_names_its_condition(self) -> None:
        # In both places: a condition in words here, and a cell in
        # SPEC.md that is not the unconditional promise.
        rules = spec_presence()
        for key, condition in CONDITIONAL.items():
            assert condition, key
            assert rules[key] != "Every export", key


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
