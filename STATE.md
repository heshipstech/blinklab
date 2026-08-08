Last increment: 7.0, video file upload mode, pull request pending
Last commit: on branch feat/7.0-video-upload
Live demo: https://heshipstech.github.io/blinklab/
Currently working: nothing, between increments
Next increment: Track A, blink detection measured against the GPL3 blink-annotated benchmark set. This replaces 7.4 to 7.7 as written, under ROADMAP amendment 7, because 7.3's licensing gate returned no. Track B, a drowsiness classifier on UTA-RLDD, stays a maintainer decision and is tracked in issue #142.
Known issues: #15 (actions majors), #90 (calibrated off screen boundary), #107 (backwards timestamps), #108 (log.md backfill), #115 (depth-qualified closure episodes), #142 (the gate decision), #145 (a clip played in real time drops frames when inference is slower than playback)
Test count: 413 unit tests passing, plus 4 end to end tests, plus 23 Python tests
