"""The `# key: value` block every export writes above its header.

Roadmap 10.16, ladder A27. Three modules read this block and each had
its own copy of the loop: loader.py and validation.py refused a
repeated key with different messages, and blink_log.py did not refuse
one at all, so the same file could be rejected by one reader and
silently misread by another. The rule is one rule, so it lives in one
place, and each caller supplies the exception its own tests and callers
expect.

pandas skips these lines with comment="#", which is what makes them a
good place for session-level facts, and also why something has to read
them deliberately or the only labels a session carries go on the floor.
"""

from collections.abc import Callable
from pathlib import Path


def read_metadata(
    path: Path, on_repeat: Callable[[str], Exception]
) -> dict[str, str]:
    """Every metadata key above the header, refusing a repeated one.

    A dict would resolve a repeated key in favour of whichever line came
    last, silently. The exporter never writes a key twice, so a file
    that does has been edited or damaged, and which value is true cannot
    be known from here. `on_repeat` is handed the key and returns the
    exception to raise, so each reader keeps its own error type.
    """
    metadata: dict[str, str] = {}
    with path.open(encoding="utf-8", newline="") as handle:
        for line in handle:
            if not line.startswith("#"):
                break
            key, separator, value = line.lstrip("# ").partition(":")
            if separator:
                key = key.strip()
                if key in metadata:
                    raise on_repeat(key)
                metadata[key] = value.strip()
    return metadata
