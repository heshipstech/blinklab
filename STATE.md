Last increment: 7.3, DATASETS.md and the licensing gate, which returned NO
Last commit: on branch feat/7.3-datasets-gate, pull request pending
Live demo: https://heshipstech.github.io/blinklab/
Currently working: nothing, awaiting a decision on the gate
Next increment: undecided, because 7.3's gate failed and rows 7.4 to 7.7 are held for replanning under amendment 7. Two tracks are described in DATASETS.md. Track A, validating blink detection against the GPL3 blink-annotated benchmark set, needs no permission from anyone and can start whenever. Track B, a drowsiness classifier on UTA-RLDD, is defensible but the dataset carries no licence at all, so it is the maintainer's judgement call and is tracked in issue #142. Both tracks need 7.0, video upload mode, which is not built.
Known issues: #15 (actions majors), #90 (calibrated off screen boundary), #107 (backwards timestamps), #108 (log.md backfill), #115 (depth-qualified closure episodes), #142 (the gate decision)
Test count: 396 unit tests passing, plus 2 end to end tests, plus 20 Python tests
