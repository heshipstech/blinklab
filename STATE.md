Last increment: 7.4, stepped measurement for clips, pull request pending
Last commit: on branch feat/7.4-batch-runner
Live demo: https://heshipstech.github.io/blinklab/
Currently working: Track A, blink detection against external ground truth
Next increment: acquire the Eyeblink8 blink-annotated corpus and write its annotation parser, then the comparison against our own blink detection. Track A under ROADMAP amendment 7.
Known issues: #15 (actions majors), #90 (calibrated off screen boundary), #107 (backwards timestamps), #108 (log.md backfill), #115 (depth-qualified closure episodes), #142 (the gate decision)
Test count: 418 unit tests passing, plus 5 end to end tests, plus 23 Python tests
