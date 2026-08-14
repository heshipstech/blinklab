# Appendix: Chunk 5, all findings as produced

The complete, unedited output of the six Chunk 5 auditors and the twelve
skeptics who tested them. `chunk-5-ui-and-access.md` is the write-up;
this file is the raw record behind it.

Produced 10 August 2026.

---

## Verification key

- **SURVIVED** a skeptic told to refute it, severity as corrected.
- **REFUTED** as stated. The corrected statement is given.
- **UNTESTED**. No skeptic saw it. Treat as a lead, not a conclusion.

Each finding also carries whether the auditor judged it a
`silent-violation` or `unreached-roadmap-work`. Roadmap row 8.8, the
accessibility pass, is unticked, so work that row would deliver is an
openly tracked unfinished increment rather than a broken rule.

---

## All 53 findings

### C5-01. Both overlays are keyboard dead ends: no key on the keyboard closes them

|                             |                        |
| --------------------------- | ---------------------- |
| Constraint                  | A8                     |
| Classified                  | unreached-roadmap-work |
| Severity as filed           | critical               |
| Verdict as filed            | violation              |
| Verification                | **REFUTED**            |
| Severity after verification | **low**                |

**Evidence.** Calibration: focused "Recalibrate gaze", pressed Enter, overlay opened (progress read "Follow the dot (1/9). Click anywhere to cancel."). Then Escape, Enter, Space, Home, End, Escape all returned `overlay hidden = false`; a later mouse click at (640,300) returned `hidden = true`. Heatmap: same sequence plus Tab, Shift+Tab, ArrowLeft, Backspace, all `overlayHidden=false`; a mouse click closed it. Source: the only dismissal is `calibrationOverlay.addEventListener("click", ...)` at src/main.ts:952 and `heatmapOverlay.addEventListener("click", ...)` at src/main.ts:1052; zero keyboard listeners exist in src/.

**Detail.** A keyboard-only visitor who opens either overlay with Enter can never get back to the page and must reload the tab; the calibration one also stalls forever at dot 1 of 9 when no face is present. Row 8.8 (ROADMAP.md:124) covers keyboard navigation and is unticked, so this is unreached work rather than a broken written promise, but it is the most severe item in this chunk because the outcome is an unrecoverable state, not missing polish.

**Corrected statement.** Neither overlay can be dismissed from the keyboard, only by click, which is what docs/UI.md specifies; focus is not trapped and the page underneath stays operable

**Skeptic's reasoning.** The mechanism is real but the severity and its rationale collapsed. VERIFIED TRUE: on my own build (served on an isolated port 4917, bundle hash index-DNpIyELs.js confirmed via curl, after finding port 4399 already held by another auditor) I pressed Escape, Enter, Space, Backspace, Delete, ArrowLeft, ArrowUp, Home, End, PageDown, Alt+ArrowLeft, q, Tab and Shift+Tab on the open calibration overlay and every one returned calHidden=false; only the click handlers at src/main.ts:952 and src/main.ts:1052 close them. REFUTED, point by point. (1) "Can never get back to the page" is false: focus is NOT trapped. Tabbing while the overlay was open walked a 19-element ring of the underlying page, all operable: BODY, A, INPUT#clip-input, INPUT#step-toggle, two more checkboxes, INPUT#eye-markers, INPUT#face-mesh, BUTTON#export-csv, the nine KSS buttons, Skip, and back to Calibrate gaze. (2) "Unrecoverable state" is overstated: recovery is a reload, itself a keyboard action, and the calibration profile persists under blinklab-calibration-profile-v1 (src/io/calibrationStore.ts:8), so the reload loses nothing durable; the keyboard-reachable clip file input also reaches beginVideoFile -> resetSession() (src/main.ts:581), which hides both overlays at src/main.ts:612-614. (3) The brief's own premise that test/MANUAL.md item 10 promises "focus is always visible" is FALSE for this repo: MANUAL.md is 65 lines and `grep -rin "keyboard\|focus\|tab through\|mouse" test/MANUAL.md` exits 1 with no matches; item 10 is about eyelid ring dots. That was the only candidate broken promise, and it does not exist. (4) The behaviour is the DOCUMENTED design, not a silent gap: docs/UI.md:296 says "Opens on Calibrate gaze. Closes on any click, or on completion." and the progress string at UI.md:303 tells the user "Click anywhere to cancel." Code matches spec exactly. (5) "Stalls forever at dot 1 of 9" is an artefact of the faceless fake-camera rig; the real user path auto-closes at src/main.ts:1894-1895. (6) A related premise also fails: the focused button DOES show a native focus ring, computed `outline style=auto width=1px color=rgb(0, 95, 204)` with `:focus-visible` true. Hard constraint 7 is not touched (a readable state renders). What remains is exactly the keyboard navigation that ROADMAP.md:124 row 8.8 is unticked to deliver: unreached, openly tracked work behind a documented click-to-dismiss interim design, so low, not critical. Worktree confirmed clean: `git status --porcelain` returned no output at the end; nothing in the repo was modified and no install was run.

### C5-02. A wrong-shaped stored calibration profile throws inside processFrame and kills the only animation frame loop for good

|                             |                  |
| --------------------------- | ---------------- |
| Constraint                  | A7               |
| Classified                  | silent-violation |
| Severity as filed           | critical         |
| Verdict as filed            | violation        |
| Verification                | **REFUTED**      |
| Severity after verification | **low**          |

**Evidence.** Driven on the real page. localStorage key blinklab-calibration-profile-v1 set to '{"not":"a profile"}', then the camera started with the repo's own 478-landmark fixture fed in as the face. Playwright pageerror: "TypeError: Cannot read properties of undefined (reading 'slope')". Sampled every 2 s for 10 s afterwards: {"fps":"Frames per second: 137","ap":"Eyelid aperture, right: 7.1 mm, left: 7.2 mm","inf":"Inference time: 3479 ms, over the 30 ms budget"} — byte-identical at t+0, +2, +4, +6, +8 s. Same crash for stored values "[]" and '"a bare string"'.

**Detail.** src/io/calibrationStore.ts:37 casts `JSON.parse(raw) as CalibrationProfile` with no runtime check, so any valid JSON is accepted. src/main.ts:1219 then calls `calibratedPoint(calibrationProfile, offset)` → src/core/calibrationProfile.ts:97 reads `profile.horizontal.slope`. The throw escapes processFrame, and src/io/frameLoop.ts:3-6 calls `onFrame(nowMs)` BEFORE `requestAnimationFrame(tick)`, so the loop is never rescheduled. The page then holds six confident frozen readouts forever (fps, aperture, EAR, iris offset, head pose, inference time), the Alertness box empties, the Feature records line vanishes, and the banner still reads "No alerts at this time." No document covers this: SPEC.md itself says isFeatureRecord is a runtime schema for the model boundary, but the localStorage boundary has none.

**Corrected statement.** loadCalibrationProfile accepts any well-formed JSON, so a hand-written wrong-shaped profile throws in processFrame and permanently ends the rAF loop (reachable only by devtools or a foreign script, not by the app itself)

**Skeptic's reasoning.** Mechanism confirmed, grading refuted. I reproduced it in Chromium with my own server and my own bundle patch (stubbing only loadLandmarker to feed the repo's syntheticFace 478-point face): storing {"not":"a profile"} produced pageerror "TypeError: Cannot read properties of undefined (reading 'slope')" and my rAF counter froze at 41 across t+4s/+7s/+10s while both controls (no profile, valid profile) advanced 966 to 2198. Page text froze at "Frames per second: measuring...", "Eyelid aperture, right: 5.6 mm, left: 5.6 mm", "Blinks: 0", banner "No alerts at this time.", no error shown. frameLoop.ts:1-7 calls onFrame before requestAnimationFrame with no try/catch, and main.ts:2758 adds none, so the loop dies for good. But the trigger is not reachable by any user action or environment condition. The realistic corruption modes are already handled: "", "{", '{"a":1' all throw inside JSON.parse and are caught at calibrationStore.ts:38-40 returning null, and stored "null" is caught by the === null guard at main.ts:1216. Only well-formed JSON of a different shape throws. The app can never write that: saveCalibrationProfile(profile: CalibrationProfile) at calibrationStore.ts:28 is the sole writer, called once at main.ts:1892 with a solver result, and git log --follow src/core/calibrationProfile.ts shows one commit (64da930) so the type has never changed shape under the -v1 key; a NaN slope stringifies to {"slope":null}, shape intact, no throw. So reaching it needs devtools or a foreign script writing the app's own namespaced key, which is the brief's "delete its model file by hand" category, not the "storage is blocked" category. Not unreached roadmap work either: 8.8 is accessibility, unrelated. SPEC.md:117-127 scopes its "page never crashes and never shows stale numbers" sentence to the five enumerated states, none of which is foreign localStorage content, so no existing promise is broken. Also partly duplicative of the already-established finding that calibrationStore.ts can end the only rAF loop permanently. Real defect, worth a runtime shape check, but low, not critical, and not a silent violation of A7. git -C the worktree status --porcelain is empty at the end; nothing in the repo was modified and no npm install was run.

### C5-03. A full localStorage kills the frame loop mid-calibration and leaves the overlay and every number frozen

|                             |                  |
| --------------------------- | ---------------- |
| Constraint                  | A7               |
| Classified                  | silent-violation |
| Severity as filed           | critical         |
| Verdict as filed            | violation        |
| Verification                | **SURVIVED**     |
| Severity after verification | **medium**       |

**Evidence.** Storage.prototype.setItem overridden to throw QuotaExceededError for blinklab keys (an ordinary browser condition, not a corruption). Ran a full calibration with the fixture face. Playwright pageerror: "QuotaExceededError: The quota has been exceeded." Overlay still visible: true. Readouts before and 2.5 s after: both exactly {"fps":"Frames per second: 66","rec":"Feature records: 15 this session (about one per second)","ap":"Eyelid aperture, right: 7.6 mm, left: 7.4 mm","banner":"No alerts at this time."} — FRAME LOOP ALIVE? false.

**Detail.** src/io/calibrationStore.ts:12 `localStorage.setItem(STORAGE_KEY, ...)` has no try/catch, and src/main.ts:1885 calls it from inside processFrame, inside the rAF loop. This needs no tampering to happen: vite.config.ts serves the app from https://heshipstech.github.io/blinklab/, and every project on heshipstech.github.io shares one localStorage bucket and one quota. A separate follow-up click does dismiss the stuck overlay, but the instrument stays dead and silent behind it, and only a reload recovers.

**Corrected statement.** Duplicate of the already-filed C2-07/M1: unguarded localStorage.setItem inside processFrame ends the app's only frame loop for good, freezing the overlay and leaving stale numbers on screen

**Skeptic's reasoning.** MECHANISM CONFIRMED INDEPENDENTLY, SEVERITY AND NOVELTY BOTH WRONG.

What survives. src/io/frameLoop.ts:2-5 is `onFrame(nowMs); requestAnimationFrame(tick);` — it re-schedules only after the callback returns, and it is the app's only rAF (grep -rn requestAnimationFrame src/ hits that file alone). I ran the repo's loop source verbatim in real Chromium with real rAF, throwing once on tick 3: `{"ticksAfter1500ms":3}`, pageerror "Error: boom from processFrame". Dead forever, one throw. The reachable throw is real: src/io/calibrationStore.ts:12 and :28 call localStorage.setItem with no try/catch, src/main.ts:1885/1892 call them from inside processFrame, and 1885 sits BEFORE `calibrationOverlay.hidden = true` at main.ts:1897, so the overlay is left up. SPEC.md:119 says unconditionally "The page never crashes and never shows stale numbers", and frozen readouts are stale numbers, so this is a broken written promise. It is NOT unreached roadmap work: ROADMAP.md:124 row 8.8 is the accessibility pass and has nothing to do with storage. No open issue covers it (gh issue list: 7 open, none related).

Where the finding is wrong.

1. NOT A NEW FINDING. This is already filed in this repository, twice, with the same mechanism and the same two line numbers: docs/audit/appendix-chunk-2-all-findings.md:129-146 as C2-07 ("Any throw inside a frame handler kills the display loop permanently, and calibrationStore's writes are unguarded"), verdict SURVIVED, severity already corrected from high to MEDIUM; and docs/audit/chunk-2-core-purity.md:145-190 as M1, "Writing throws, and freezes the app permanently... On a browser with a full storage quota, finishing a calibration freezes the camera view with nothing on screen explaining it." My own briefing lists it as ALREADY ESTABLISHED. Re-filing it at critical is an escalation of an adjudicated item, not a discovery.

2. THE AUDITOR'S TRIGGER EVIDENCE IS CIRCULAR AND THE REAL LIKELIHOOD IS LOWER THAN CLAIMED. "Storage.prototype.setItem overridden to throw QuotaExceededError" proves the consequence, not that the condition is "ordinary". I measured the real condition with no stubbing at all, in real Chromium: filling the origin with 64 KiB co-tenant chunks took 5,177,344 chars (~9.9 MiB UTF-16) before a genuine "QuotaExceededError: ... exceeded the quota", and then blinklab's own 18,433-char write STILL SUCCEEDED (appWriteError: null) because the co-tenant's last failed chunk left ~64 KiB of slack. To make blinklab's write actually throw I had to squeeze the origin down to 145 remaining one-character keys; only then did I get "QuotaExceededError: ... Setting the value of 'blinklab-calibration-samples-v1' exceeded the quota." So the shared heshipstech.github.io origin argument is directionally right (origins do share one bucket) but the failure needs ~5 MB of foreign data AND a co-tenant that packed to within ~18 KB of the ceiling. The app writes only two fixed keys and overwrites them, so it can never exhaust its own quota.

3. NOT CRITICAL. No data loss, no wrong number is emitted, no security impact, every documented degraded state still works, a click still dismisses the overlay, DOM handlers stay bound, and a reload fully recovers. Consequence is severe (silent permanent stop, this project's self-named worst failure mode) but likelihood is low and conditional on a third party. That is medium, exactly where chunk 2 already landed it. The more likely thrower in the same unguarded handler remains the WASM call landmarker.detectForVideo at main.ts:1569, as chunk 2 also noted.

Not verified by me: I did not drive a full 9x30 calibration with a real face, because captureStep (src/core/calibrationCapture.ts:63) needs a non-null offset and the fake Chromium camera has no face; I confirmed the write site and the loop-death consequence separately instead.

Worktree confirmed clean: `git -C "<repo>/.claude/worktrees/audit-fresh" status --porcelain` returned empty output. No npm install was run; built with npx vite build to /private/tmp/.../scratchpad/sk3/dist.

### C5-04. The compensating control for the missing src/ui is void: UI.md was obsolete two hours after it merged and no automated check ties it to the code

|                             |                  |
| --------------------------- | ---------------- |
| Constraint                  | B2               |
| Classified                  | silent-violation |
| Severity as filed           | critical         |
| Verdict as filed            | violation        |
| Verification                | **SURVIVED**     |
| Severity after verification | **medium**       |

**Evidence.** `git log --format='%h %ad %s' --date=short -- docs/UI.md` returns exactly one line: `87945c5 2026-08-08 docs: a complete UI specification (#161)`. `git log --oneline 87945c5..HEAD -- src/main.ts | wc -l` returns `15` (PRs #162 through #198), out of 38 commits total since. `grep -rn 'UI\.md' . --exclude-dir=node_modules --exclude-dir=.git` finds it referenced only in README.md:512 and prose audit files: no test, no lint rule, no CI step. AUDIT_PLAN.md:163 defines B2 as `Source layout is src/core, src/io, src/ui, src/main.ts`.

**Detail.** The very next commit after UI.md, 24fd269 (#162) "nav bar, status banner, two-column top, live signals box", invalidated its page anatomy; UI.md merged 17:43 on 8 August and #162 landed the same evening. Fifteen main.ts changes later nothing has updated it, and nothing can fail when it drifts. README.md:512 still advertises it as "every element the page can show... and every string it can contain", which is now false in every section. No ROADMAP row and none of the ten amendments (ROADMAP.md:5-22) cover the interface campaign or the documentation of it.

**Corrected statement.** docs/UI.md has never been updated since its single commit and is now false in most sections, while README.md:512 still advertises it as complete; no check can fail when it drifts

**Skeptic's reasoning.** SURVIVES on substance, REFUTED on framing and severity. Verified true: `git log -- docs/UI.md` returns one commit (87945c5, 2026-08-08); 15 src/main.ts commits since; `grep -rn 'UI\.md'` hits only README.md:512 and audit prose, no test/lint/CI. In a real browser (my own vite build served on :4199), idle state, the drift is WORSE than filed: `.box` computed styles show all seven boxes at display:block/visibility:visible (ALERTNESS 287x158, EYES 300x230, BLINKS 300x230), contradicting UI.md:44's bolded "everything except the Source box is hidden unless the state is `running`" and its section 7 table; the graph strip sits inside `.page-column` at width 1233 of 1280, top 526, refuting UI.md:56 "Full window width, above everything" and UI.md:365 "The graph strip stays full width at the top"; `document.querySelector('h1').innerText` is "Alertness measurement demo" not `blinklab` (UI.md:92 vs src/main.ts:169); the rendered notice omits "This is a learning project." which UI.md:77 still quotes (deleted by #185). REFUTED points: (1) The title's premise is false. SPEC.md:11 gives a WRITTEN REASON for the missing src/ui and names the real compensating control, which is not UI.md: "every string it renders that carries meaning is produced by a tested pure function in `core`... the renderer never computes a measurement." That control is INTACT: DEMO_NOTICE (src/core/notice.ts:10) and all seven cameraStateMessage strings (src/core/cameraState.ts:29-44) match the page exactly. UI.md-as-compensating-control is a prior auditor's construct (appendix-chunk-1-all-findings.md:911), not a repo promise, so B2 is NOT a silent violation. (2) "now false in every section" is overstated: section 2's seven-state table matches cameraState.ts:2-11 exactly and section 5.2's status strings match character for character. (3) Critical is 2-3 notches too high: no measurement, published number, or user-visible string is affected; the shipped page renders the correct disclaimer. (4) The "no ROADMAP row / no amendment" paragraph duplicates recorded C1-20 (corrected to low), and the omitted-elements slice duplicates C1-60 (low). It remains a violation rather than unreached roadmap work because README.md:512 affirmatively promises UI.md holds "every element the page can show... and every string it can contain", and the browser shows a nav bar, status banner and footer recorded nowhere in it; row 8.8 (accessibility) does not cover documentation accuracy, and no ROADMAP row, amendment or open issue discloses the staleness. Severity medium: the harm is that the only written map of the interface layer is false in most sections, so future interface work (including the untouched 8.8 pass) would be designed against a wrong page. Worktree confirmed clean: `git status --porcelain` returned empty.

### C5-05. One exception anywhere in processFrame permanently kills the frame loop, and the page then displays frozen numbers as if live

|                             |                  |
| --------------------------- | ---------------- |
| Constraint                  | A7               |
| Classified                  | silent-violation |
| Severity as filed           | critical         |
| Verdict as filed            | violation        |
| Verification                | **SURVIVED**     |
| Severity after verification | **medium**       |

**Evidence.** src/io/frameLoop.ts:3-4 `onFrame(nowMs); requestAnimationFrame(tick);` — the re-arm is AFTER the call, not in a finally, with no try/catch. Same shape at frameLoop.ts:60-61 for the played-clip loop. processFrame spans src/main.ts:1533-2265 with ZERO try/catch (the only four `catch` in main.ts are at lines 668, 679, 854, 876, all before 1533), and it calls landmarker.detectForVideo at main.ts:1569 and drawImage at 1561 unguarded. Measured: I injected one single throw into processFrame in a built copy served from my scratchpad. Before: "Frames per second: 58". 4 s later: "Frames per second: 58". 8 s later: "Frames per second: 58". Meanwhile the browser's own requestAnimationFrame ran 241 frames in 1 s, and the status banner still read "No alerts at this time."

**Detail.** This is the general case of the single instance chunk 2 found in calibrationStore. Any throw from MediaPipe (GPU context loss, wasm trap), from a canvas call, or from any of the 733 lines of core calls, ends the instrument forever with the video frozen and every readout stuck at its last value. SPEC.md:119 states "The page never crashes and never shows stale numbers." No written reason exists; ROADMAP 8.8 is accessibility and does not cover this.

**Corrected statement.** Duplicate of C2-07: processFrame has no try/catch and the loop re-arms after the call, so any throw stops the only rAF loop with readouts frozen and no message (needs an external fault; reload recovers)

**Skeptic's reasoning.** Mechanism and consequence both reproduce, so the finding stands, but "critical" and "new" do not. VERIFIED IN CODE: src/io/frameLoop.ts:3-4 re-arms after onFrame with no guard (same at :60-61); `grep -n "try {\|catch\|finally" src/main.ts` returns only 651/668/673/679/698/854/874/876/879, nothing after, so processFrame (1533+) is unguarded around drawVideoFrame at 1561, landmarker.detectForVideo at 1569, and saveCalibrationSamples/Profile at 1885/1892 which reach bare localStorage.setItem at src/io/calibrationStore.ts:13 and :29. VERIFIED IN A REAL BROWSER, UNMODIFIED BUILD: I built to my scratchpad, served on :4899, drove it with Playwright and a fake camera, then installed the fault at RUNTIME rather than editing source (overrode CanvasRenderingContext2D.prototype.drawImage to throw, simulating a lost surface). Before: "Frames per second: 237". t+2s: 239. t+8s: 239, while the browser's own requestAnimationFrame ticked 1,907 times. Canvas dataURL identical 1.2s apart. Banner still "No alerts at this time." A regex for stopped/stalled/error/failed/frozen/reload over document.body.innerText returned null. One pageerror: "simulated canvas surface fault". NOT UNREACHED ROADMAP WORK: ROADMAP.md:135 row 8.8 is accessibility only and no row covers frame-loop error containment; SPEC.md:119 "The page never crashes and never shows stale numbers" is a live promise and grep for stale/frozen/crash/watchdog across SPEC.md, ROADMAP.md, docs/UI.md, MODEL_CARD.md, decisions/ and STATE.md finds no disclosure. WHERE THE AUDITOR IS WRONG: (1) DUPLICATE. This is C2-07 at docs/audit/appendix-chunk-2-all-findings.md:130-146, already filed, already marked SURVIVED, and already severity-corrected to MEDIUM by a prior skeptic; the auditor concedes the overlap in their own Detail, then re-files at critical. (2) NO NEW REACHABILITY EVIDENCE. Injecting a throw into a modified build is circular: it demonstrates the code shape they already read, not a trigger a user hits. The prior skeptic did the real arithmetic (a full 9-target calibration writes 18,433 bytes, ~0.4% of a 5 MB quota, so the app cannot exhaust its own storage) and landed on medium; I likewise had to install the fault by hand and saw nothing throw spontaneously. (3) OVERSTATED. "Permanently" is per-session, not persistent: DOM handlers stay bound and a reload recovers, and no wrong number is produced, only a stale one. Real but medium, and it should be merged into C2-07 rather than counted twice. Worktree confirmed clean: `git -C .../audit-fresh status --porcelain` printed nothing, HEAD 076e11b.

### C5-06. A failed model load is completely invisible: the page looks like a working instrument stuck on "measuring..." forever

|                             |                  |
| --------------------------- | ---------------- |
| Constraint                  | A7               |
| Classified                  | silent-violation |
| Severity as filed           | critical         |
| Verdict as filed            | violation        |
| Verification                | **SURVIVED**     |
| Severity after verification | **high**         |

**Evidence.** src/main.ts:869-883 `ensureLandmarker` catches the failure and does only `console.error("face landmarker failed to load:", error)`. Tested: built to scratchpad, deleted models/face_landmarker.task from MY copy of dist, served it. Console: `Failed to fetch model: ./models/face_landmarker.task (404)`. On screen after 14 s with the camera running: status banner = "No alerts at this time." (nothing else), canvas visible, "Frames per second: 240", and every readout still at its idle string — "Alertness score: measuring...", "Eyelid aperture: no valid measurement", "Blinks: 0". Repeated with public/mediapipe-wasm deleted (the prepare-assets-never-ran case): identical silence, and the console error is literally just "Event".

**Detail.** No written reason. docs/UI.md:107-143 enumerates "every possible string" for the status line and "every possible string" for the model status, and neither list contains a load failure. The code comment at main.ts:877 defers it to "2.5 territory", but ROADMAP.md:50 row 2.5 is ticked and delivered only the 468-landmark guard. So this is a deferral to work that already shipped without it.

**Corrected statement.** A failed model load is never reported: the camera path runs on forever with no message and no retry button, and the clip path prints "Measured 60 frames" with a false frame-rate cause

**Skeptic's reasoning.** CONFIRMED with my own harness (own vite build to scratchpad, own node static server that 404s one path, own probe.mjs; I did not run the auditor's script).

CAMERA PATH, side by side on identical builds. Baseline (model 200): "Alertness score: no face in frame" / "Inference time: 17 ms (budget 30 ms)" / "Feature records: 15 this session". Model 404: status region still reads "No alerts at this time.", canvas visible 640x360, "Frames per second: 240", and the Alertness, Inference and Feature-records lines are simply ABSENT while "Eyelid aperture: no valid measurement", "Aperture stability: measuring...", "PERCLOS: measuring...", "Blinks: 0" persist. Console only: `face landmarker failed to load: Error: Failed to fetch model: ./models/face_landmarker.task (404)`.

REAL USER PATH, not a hand-deleted file. I aborted the model request mid-flight with route.abort("connectionfailed") to simulate a dropped connection on the 3.7 MB model (ADR-0002-model-hosting.md:8, plus 11.5 MB of WASM) and got the identical silent page: `face landmarker failed to load: TypeError: Failed to fetch`. There is also NO recovery affordance: my second getByRole('button', {name: /start camera/i}).click() timed out after 30 s because the button is hidden while running (docs/UI.md:98, "Start camera | Visible when: Not running"), so the only fix is a reload the user is never told to do. I tested the hypothesis that this needs a broken deploy and it does not, and I refuted one of my own escape routes: .github/workflows/deploy.yml:27 runs `npm run build`, whose prebuild hook does run prepare-assets, so the gitignored WASM IS present on the real deploy.

CLIP PATH IS WORSE THAN THE FINDING SAYS. With the model dead, loading test/fixtures/clip-60fps-60frames.mp4 prints: "Measured 60 frames at 60.0 frames per second, in 0 s... NO BLINKS WERE MEASURED IN THIS CLIP, and that is a refusal rather than a failure. All 60 frames were read, but it runs at 60.0 frames per second, below the 25 a short blink needs... Everything else in the export is still valid." Zero frames reached the model. src/core/fpsGate.ts:38-53 clipRefusedMessage unconditionally blames frame rate, and src/main.ts:827 calls it on `framesMeasured > 0 && framesBlinkMeasurable === 0`, which is exactly the dead-model signature. So it is not silence, it is a confident wrong diagnosis (60.0 fps called "below the 25") attached to a success claim. docs/log.md:70 records this exact lesson already learned once: "the deeper fault was that 'Measured 0 frames' was printed as a result rather than a failure".

NOT UNREACHED ROADMAP WORK. Row 8.8 (accessibility) is irrelevant here. No ROADMAP row covers model-load failure. The comment at src/main.ts:877 defers to "2.5 territory"; `git log -L 869,880:src/main.ts` shows it landed 2026-07-30 in #33 when 2.5 was still ahead, but ROADMAP.md:50 row 2.5 is now [x] and test/MANUAL.md:16 confirms 2.5 shipped only the 468-count guard, so the pointer is dangling. NOT DISCLOSED: SPEC.md:121-127 lists five degraded states and this is not one; docs/UI.md:107-143 enumerates "every possible string" for the status line and the model status and neither contains a load failure; ADR-0002 covers hosting but not failure; MODEL_CARD.md is silent; `gh issue list` shows 7 open issues, none related; no e2e test blocks the model.

SEVERITY CUT critical -> high. Two corrections to the finding. Its quoted strings are slightly off: I got an empty Alertness line, not "Alertness score: measuring...", and the clip path is not silent at all. And critical overreaches: the page does not crash or blank, no stored data or published number is affected, a reload fixes it, and it needs an asset fetch to fail on an otherwise correct deploy. Compare the calibrationStore whole-page blank in this same audit, which a skeptic already cut to medium. High is right because the trigger is an ordinary network failure on a 15 MB first load, the user has no recovery affordance, and the clip path states a false cause.

Repo untouched: everything I wrote went to scratchpad/skeptic-a7, and `git -C "<repo>/.claude/worktrees/audit-fresh" status --porcelain` returns empty at the end.

### C5-07. No modal semantics: focus walks behind the open overlay and operates controls the user cannot see

|                             |                        |
| --------------------------- | ---------------------- |
| Constraint                  | A8                     |
| Classified                  | unreached-roadmap-work |
| Severity as filed           | high                   |
| Verdict as filed            | violation              |
| Verification                | **REFUTED**            |
| Severity after verification | **low**                |

**Evidence.** With the calibration overlay up, Tab moved focus to BODY, then the LinkedIn link, the clip file input, and all four checkboxes. `document.elementFromPoint` at the centre and both corners of every one of those focused rects returned `COVERED BY DIV[calibration-overlay] z=10`. Pressing Space then flipped the face-mesh checkbox from `checked:false` to `checked:true` while the overlay stayed open. The same walk under the heatmap overlay returned `COVERED BY CANVAS` for eight consecutive Tab stops.

**Detail.** Neither overlay sets `inert`, `aria-modal`, `role="dialog"` or any focus containment (src/main.ts:920 and :972 are plain divs with only position, inset, background, zIndex and cursor). The result is not a focus trap but its opposite: focus escapes onto obscured controls, so a keyboard user silently changes measurement settings behind a wall they cannot see through.

**Corrected statement.** Overlays have no modal semantics, so Tab reaches draw-only controls hidden behind them (unreached ROADMAP 8.8, already recorded in AUDIT_PLAN.md)

**Skeptic's reasoning.** The mechanics reproduce (my own Playwright script against a scratchpad build: with the calibration overlay open, Tab reached the LinkedIn link, clip file input, all four checkboxes, Export CSV and the KSS buttons; elementFromPoint returned COVERED-BY DIV[calibration-overlay] z=10 at centre and both corners of every rect; Space flipped Face mesh checked:false to checked:true with overlayStillOpen:true; Escape did nothing). But the finding is refuted as scored, for four reasons. (1) The promise it would need to break does not exist: test/MANUAL.md item 10 is about eyelid dot rings, not focus, and `grep -rn -i keyboard ./*.md ./docs ./test ./decisions` returns only ROADMAP.md:124 and AUDIT_PLAN.md, with zero hits for "focus" anywhere in test/ or docs/. (2) It falls squarely inside unticked ROADMAP row 8.8, "Accessibility pass: keyboard navigation, focus states" — modal focus containment is keyboard navigation, so this is unreached increment work, openly tracked. (3) The existing behaviour is documented as designed: docs/UI.md:298 "Closes on any click" and test/MANUAL.md item 33 "Clicking the overlay cancels without storing". (4) It is already written down in the repository at AUDIT_PLAN.md:354-357, which states both overlays are "dismissed by mouse click only, with no `tabindex`, no `role=\"dialog\"` and no Escape handler". The harm claim is also overstated: the three overlay-reachable checkboxes are draw-only (mirrorToggle feeds `mirrored`, used once at src/main.ts:1560 in frameTransform; eyeMarkerToggle feeds showEyeMarkers; faceMeshToggle feeds showFaceMesh), and the only measurement-affecting checkbox, step-toggle, is read once at clip load (src/main.ts:733), so the demonstrated Space press changes no measurement. The overlay self-completes after nine dots (src/main.ts:1881-1899; MANUAL item 33: "roughly 30 to 60 seconds total"), so the keyboard user is not trapped. I verified the calibration overlay only; the heatmap walk was not reproduced, though src/main.ts:970-977 is structurally identical. Worktree confirmed clean: `git -C .../audit-fresh status --porcelain` returned empty; no repo files modified, build went to scratchpad, no npm install run.

### C5-08. Focus indicator is completely unreadable while an overlay is open, measured in pixels

|                             |                        |
| --------------------------- | ---------------------- |
| Constraint                  | A8                     |
| Classified                  | unreached-roadmap-work |
| Severity as filed           | high                   |
| Verdict as filed            | violation              |
| Verification                | **REFUTED**            |
| Severity after verification | **low**                |

**Evidence.** Screenshot pixel sample of a 26x26 box around the focused Mirror checkbox. No overlay, focused: 321 blue ring pixels, luminance 83-255. No overlay, blurred: 177 blue pixels (the checkbox accent alone). Calibration overlay up, focused: 0 blue ring pixels, luminance 12-38. Overlay up, blurred: 0 blue pixels, luminance 16-38. Focused and blurred share an identical max luminance of 38.

**Detail.** The DOM focus ring is still computed (`outline: auto 1px rgb(0, 95, 204)`) but is painted under `rgba(0,0,0,0.85)` at z-index 10, and under the heatmap's fully opaque `#101418`, so it is not perceivable at all. Worth separating from the finding above because it survives even if focus containment is added but the ring is left unstyled.

**Corrected statement.** Focus ring on background controls is hidden by the modal scrim, a duplicate of the missing focus containment (unreached roadmap row 8.8)

**Skeptic's reasoning.** The pixel measurement reproduces exactly (my probe7.cjs: focused/no-overlay ring=274 blue=318 lum=83-255; blurred blue=174; overlay-up focused AND blurred both blue=0 lum=4-37), but it fails as an independent finding on two counts. (1) Its stated reason for existing is false. I tested the claim directly in probe8.cjs by placing a plain unstyled button INSIDE each scrim and keyboard-focusing it: inside rgba(0,0,0,0.85) the UA ring paints clearly, and inside the opaque #101418 heatmap scrim it measures ring=502 focused vs ring=0 blurred. Chrome's `outline: auto` renders at full contrast on both overlay backgrounds, so the moment focus containment is added the ring is perfectly visible and this finding evaporates. It does not "survive" containment; it is the same defect viewed from the other side, and a full-viewport scrim hiding what is behind it is the definitional behaviour of a modal, not a bug in the ring. (2) No promise is broken. The premise that test/MANUAL.md item 10 asserts "Tab through every control with the keyboard: focus is always visible" is wrong for this repo: `grep -c keyboard test/MANUAL.md` returns 0, and item 10 reads "(2.3) With your face in frame, exactly two rings of green dots trace your eyelid rims..." — eyelid dots, not focus. The only written commitment to focus states is ROADMAP.md:124 "- [ ] 8.8 Accessibility pass: keyboard navigation, focus states...", which is UNTICKED, while docs/UI.md:24 documents the overlays as "Full window, above everything" and docs/UI.md:303 documents "Click anywhere to cancel". So this is unreached roadmap work with no broken promise: nothing crashes, no measurement is wrong, the overlay dismisses on click. "High" is far too severe; what real harm exists belongs to the focus-containment finding this duplicates. Worktree confirmed clean: `git -C ".../audit-fresh" status --porcelain` returned empty output, and no npm install was run.

### C5-09. A returning visitor with a saved calibration profile can never open the heatmap, by keyboard or by mouse

|                             |                  |
| --------------------------- | ---------------- |
| Constraint                  | A7               |
| Classified                  | silent-violation |
| Severity as filed           | high             |
| Verdict as filed            | violation        |
| Verification                | **SURVIVED**     |
| Severity after verification | **medium**       |

**Evidence.** Seeded `blinklab-calibration-profile-v1` in localStorage, loaded the page: button read `{ text: 'Gaze heatmap', disabled: true }` (the profile-present label, so the profile did load). After starting the camera: still `{ text: 'Gaze heatmap', disabled: true }`. Cause: render() force-disables heatmapButton at src/main.ts:545-552 whenever the source is not running, and the only call that re-enables it, `refreshHeatmapButton()` at src/main.ts:1900, fires solely on a successful in-session calibration solve.

**Detail.** docs/UI.md:307 states the heatmap overlay "Opens on Gaze heatmap. Requires a calibration profile." The profile requirement is met and it still does not open, so a documented action is unperformable by any input device until the visitor recalibrates from scratch. This is a genuine silent violation, not accessibility work, and it is why I had to enable the button directly to test the overlay's keyboard behaviour.

**Corrected statement.** A calibration profile restored from localStorage never re-enables the heatmap button, so every returning visitor must redo the full 9-dot calibration to reach the 5.9 heatmap and the 5.10 replay

**Skeptic's reasoning.** CONFIRMED by observation in a real Chromium browser against a fresh production build, on both the camera path and the clip path.

WHAT I OBSERVED (my own probe, not the auditor's script; served from my own node server on :4917):

- Fresh visitor, no profile, at load: label "Gaze heatmap (calibrate first)", disabled true. Correct.
- Returning visitor (profile in localStorage under blinklab-calibration-profile-v1), at load: label "Gaze heatmap", disabled TRUE. The calibrate button correctly reads "Recalibrate gaze", proving the profile was read and restored.
- Same visitor, camera started, frame loop confirmed running ("Inference time: N ms" is written only inside processFrame), after 4 further seconds of frames: still label "Gaze heatmap", disabled true.
- Click attempt: overlay stays hidden. Keyboard attempt: the button is not focusable, so it is skipped by tab order. No route in.
- Clip path (no camera at all, test/fixtures/clip-60fps-60frames.mp4), same profile, frames running: heatmap "Gaze heatmap" disabled true, and replay "Replay scanpath (run the heatmap first)" disabled true. Increment 5.10 dies as a consequence of 5.9.

MECHANISM, and the answer to the question the finding asked about which condition gates it. The gate is the PROFILE, not the accumulation of session gaze samples: src/main.ts:965 `heatmapButton.disabled = calibrationProfile === null`. The defect is that this gate is never re-evaluated. `heatmapButton.disabled` is written in exactly three places: :963 (init true), :965 (inside refreshHeatmapButton), and :550 inside render()'s force-off block. refreshHeatmapButton() is called at only two moments: :971 at module init, and :1900 in the frame loop when a calibration CAPTURE completes. At startup :971 correctly enables it, then render() at :2753 runs with state idle and force-disables it. render()'s own comment at :541-543 says the four conditional buttons are "only forced off, never on" because "the frame loop sets those while running", which is true for export and replay but false for the heatmap, whose only re-enable is tied to finishing a fresh capture. A profile restored from storage therefore never re-enables anything.

SKEPTIC CHECKLIST:

1. Reachable? High. No hand-edited storage is needed to reach the state: the app itself writes that key via saveCalibrationProfile the first time a user calibrates. I seeded the exact shape the solver emits ({horizontal:{slope,intercept},vertical:{slope,intercept}}) only because Chromium's fake camera has no face, so a genuine 9-dot capture cannot complete headlessly. Every returning visitor who calibrated once hits this.
2. Already filed? No. Chunk 2's C2-09 covers calibrationStore's unvalidated `as` casts (a CORRUPT profile crashing core) and frameLoop's missing try/catch. This is a VALID profile that parses, loads, and is actively used elsewhere: lookingToward at :1216-1221 still answers "(calibrated)" from it, and the calibrate button correctly relabels to "Recalibrate gaze". Only the button gate is stale. Different cause, different lines, not a duplicate. I grepped all three appendix files and the chunk write-ups for refreshHeatmapButton, "stored profile" and "earlier visit": nothing.
3. Unreached roadmap work? No. ROADMAP.md:87-88 tick 5.9 and 5.10 as done, and src/main.ts:907-908 states outright that a profile from an earlier visit "survives in local storage and works from the first frame." It survives; it does not work.
4. Does a user-visible thing go wrong? Measured, yes. docs/UI.md:245 fixes the label contract: "Gaze heatmap" when enabled, "Gaze heatmap (calibrate first)" when disabled. The observed returning-visitor state is the ENABLED label on a DISABLED button, so the app tells the user the feature is ready and gives no reason when it does nothing. That disagreement between label and state is itself the proof the gate is stale rather than deliberate.

SCOPE CORRECTION to the finding as written: "can never open" is slightly too strong. A returning user can restore the heatmap by completing a fresh 9-target recalibration in that session, which fires the :1900 refresh. But nothing in the interface hints at that, the label says the opposite, and the cost is the full capture on every single visit.

Not counted as a fifth silent-success instance: nothing is measured or reported falsely here, a control is simply dead while its label claims readiness. That is a functional plus label-contract defect, not a false measurement.

No files in the repo were modified; `git status --porcelain` is empty.

### C5-10. No global error boundary anywhere, so any throw in the frame loop is permanent and invisible

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | A7               |
| Classified        | silent-violation |
| Severity as filed | high             |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** `grep -rn "onerror|unhandledrejection" src/main.ts` returns nothing. src/io/frameLoop.ts:3-6 is the whole loop: `function tick(nowMs){ onFrame(nowMs); requestAnimationFrame(tick); }` — no try/finally. processFrame (src/main.ts ~1533-2273) is not wrapped at any call site.

**Detail.** This is the single root cause of the two crashes above and of any future one. Constraint 7 says the demo must never crash the page; today the page cannot even notice that it has. A try/finally around onFrame plus a window.onerror that writes into the existing status banner would convert both criticals into a readable degraded state. No ADR, SPEC row or ROADMAP row covers this, and ROADMAP 8.8 is about accessibility, so this is not unreached roadmap work.

### C5-11. If the model file fails to load, the page says nothing at all and looks like it is measuring

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | A7               |
| Classified        | silent-violation |
| Severity as filed | high             |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** page.route('**/face_landmarker.task', r => r.abort('failed')), then Start camera, waited 20 s. Banner: "No alerts at this time." fps readout: "Frames per second: 240". Visible text matching /model|load|fail|error/: [] — nothing. The only trace is console: "face landmarker failed to load: TypeError: Failed to fetch".

**Detail.** src/main.ts:874-878 catches the load failure and only console.errors it, with the comment "Full degraded-state treatment for a failed model load is 2.5 territory." But ROADMAP row 2.5 is TICKED and reads "Guard against a model returning 468 landmarks instead of 478" — it is the wrong-count guard and does not cover a failed load. The comment defers to work that is already marked done, so this gap has no owner. The user gets a live preview, a 240 fps counter and every readout saying "no valid measurement", with nothing to tell them the measurement engine never arrived.

### C5-12. Revoking the camera mid-session is never noticed: fps and the record count keep climbing

|                             |                  |
| --------------------------- | ---------------- |
| Constraint                  | A7               |
| Classified                  | silent-violation |
| Severity as filed           | high             |
| Verdict as filed            | violation        |
| Verification                | **REFUTED**      |
| Severity after verification | **low**          |

**Evidence.** Ran the live camera, then `__stream.getTracks().forEach(t => t.stop())`. Before: fps 72, "Feature records: 5 this session". 5 s after revoke: fps 78, records 10. 3 s later: fps 77, records 13. Visible text matching /camera|stopped|lost|error/: only "Camera resolution:", which still asserts 1280 x 720. No uncaught error.

**Detail.** Nothing listens for the track's `ended` event or checks video.readyState. The fps readout is now measuring the requestAnimationFrame loop rather than the camera, so it reads healthy while no frame has arrived, and the session keeps appending FeatureRecords that a CSV export would present as measured seconds. This is not one of SPEC's five named states, but it is squarely constraint 7's "render a readable state" and SPEC's "never shows stale numbers".

**Corrected statement.** A camera that dies mid-session is shown as "no face in frame" and never named as a camera fault; the measurements themselves correctly refuse

**Skeptic's reasoning.** REFUTED by direct observation in headless Chromium against a fresh build of the worktree (served from my own node server on :4917; repo untouched, `git status --porcelain` empty).

1. REACHABLE? Yes, no hand-editing needed: unplugging a webcam or another app taking it ends the track the same way `track.stop()` does. So reachability is not the reason it fails.

2. WHAT ACTUALLY HAPPENS AFTER THE TRACK IS STOPPED (31 s of one-second samples, probe of my own): track.readyState becomes "ended", stream.active false, video.currentTime resets to 0, and the video element hands out a FULLY BLACK image. I pre-filled a scratch canvas magenta and drew the element into it: 1200 of 1200 pixels black, 0 magenta, so drawImage painted black rather than leaving a stale frame. A merely disabled track (the "another app grabbed the camera" shape) gives the identical 1200/1200 black. There is no frozen last frame for MediaPipe to keep detecting, so every readout goes to absence and stays there: "Eyelid aperture: no valid measurement", "Eye aspect ratio: no valid measurement", "Head pose: no valid measurement", "Iris offset / Looking toward / Gaze state: no valid measurement", "PERCLOS: measuring..." (withdrawn by the existing PERCLOS_STALE_MS = 2000 guard, which exists for exactly this drift), "Alertness score: no face in frame". The on-screen preview goes solid black, which is the most visible possible signal that the camera died (screenshot taken).

3. THE TWO THINGS THE FINDING NAMES:
   a) Record count. It does climb (11 -> 41 over 31 s), but the exported CSV rows written after the camera died read `19084.715,false,77.47,,,,0,,,,,0,,,,` - faceDetected false and every measurement column empty. That is a record of measured absence, which the brief explicitly names as CORRECT behaviour. The one non-empty field, blinkRatePerMin = 0, first appears at ~16 s, i.e. when BLINK_RATE_MIN_OBSERVATION_MS = 15000 elapses, not at the ~9 s stop: rows at 9, 10, 11, 12, 13, 14, 15 s are all empty there with the camera already dead. So it is the observation-window rule, not camera loss.
   b) Frame rate readout. It does keep reading ~78. But I measured the true camera rate with requestVideoFrameCallback on the app's own element: the fake device ran at 20 fps (getSettings frameRate 20, 20.0 decoded frames/s measured) WHILE the app's readout said "Frames per second: 70". The readout has never been the camera's rate; it is the requestAnimationFrame/processFrame call rate, 3.5x the camera even in a perfectly healthy session (and it holds the MIN_BLINK_FPS = 25 gate open on a 20 fps camera). Killing the camera moves it from 70 to 78. So the number is not made wrong by the camera dying - it is the same loop-rate number before and after, and its wrongness is a separate, larger, pre-existing matter.

4. PUBLISHED CLAIM. SPEC.md:119 "The page never crashes and never shows stale numbers." Measured: not breached. Nothing stale is shown; the aperture, EAR, pose, gaze, PERCLOS, score and every CSV field all refuse. This is therefore NOT a fifth silent-success instance: the instrument does not report progress while measuring nothing, it reports absence in every measurement channel and blanks its own video panel.

WHAT SURVIVES, AND IT IS SMALL: the app never NAMES the cause. cameraState stays "running", src/io/camera.ts wires no track "ended"/"mute" listener, and a dead camera is presented to the user as "no face in frame" while "Learning your open eyes: 0 s left" stalls forever. That is a missing diagnostic message for a state SPEC.md's degraded-state table does not list, not a false measurement. Low.

### C5-13. Gaze heatmap: dwell is carried by colour alpha alone, with no text equivalent anywhere on the page

|                   |                        |
| ----------------- | ---------------------- |
| Constraint        | A8                     |
| Classified        | unreached-roadmap-work |
| Severity as filed | high                   |
| Verdict as filed  | violation              |
| Verification      | **UNTESTED**           |

**Evidence.** src/main.ts:1128 `context.fillStyle = \`rgba(255, 145, 0, ${String(0.55 * heat)})\``where heat = dwell frames per cell / hottest cell (src/core/heatmap.ts:44-54). Browser dump of the open overlay subtree: exactly two elements,`canvas[aria-label="Gaze heatmap accumulating over a test image"]`and`input[type=range][aria-label="Replay time"]`. Computed heat-over-card contrast (#ff9100 at 0.55*heat over #101418): heat 1.0 = 3.24:1, heat 0.5 = 1.67:1, heat 0.25 = 1.24:1.

**Detail.** The aria-label is a name for the graphic, not a value: nothing states any cell's dwell, which shape held gaze longest, or for how long. Alpha is the only channel, so this fails both the text-alternative rule and colour-alone; below roughly the top third of intensity it is also near-invisible to a sighted low-vision user.

### C5-14. Scanpath replay: fixation duration is circle radius, and its only numeric caption is painted inside the canvas

|                   |                        |
| ----------------- | ---------------------- |
| Constraint        | A8                     |
| Classified        | unreached-roadmap-work |
| Severity as filed | high                   |
| Verdict as filed  | violation              |
| Verification      | **UNTESTED**           |

**Evidence.** src/main.ts:1179 `const radius = 6 + Math.sqrt(fixation.endMs - fixation.startMs) / 2;`. src/main.ts:1199-1203 draws `Replay at X s of Y s` with `context.fillText`. Browser check `document.body.innerText.includes("Look at the shapes")` returned false, confirming canvas text is pixels, not DOM. The slider (src/main.ts:1011-1016) has min 0 / max 1000 and no aria-valuetext.

**Detail.** Fixation count, durations and positions in the replay have no text form at all, and the one number that does exist (seconds into the replay) is unreachable by any assistive technology. A screen reader announces the slider as "700", which is not the quantity it controls.

### C5-15. processFrame counts frames it never measured, so a failed model load is reported to the operator as a frame-rate refusal

|                             |                  |
| --------------------------- | ---------------- |
| Constraint                  | DEBT             |
| Classified                  | silent-violation |
| Severity as filed           | high             |
| Verdict as filed            | violation        |
| Verification                | **SURVIVED**     |
| Severity after verification | **medium**       |

**Evidence.** src/main.ts:1542 `framesMeasured += 1` sits ABOVE both guards: 1559 `if (state.kind === "running" && canvasContext !== null)` and 1563 `if (landmarker !== null)`. src/main.ts:876-878 swallows a model-load failure with only `console.error("face landmarker failed to load:", error)`. framesBlinkMeasurable is incremented at 1934, INSIDE the landmarker guard. src/core/fpsGate.ts:44-50 clipRefusedMessage prints "All N frames were read, but it runs at X frames per second, below the 25 a short blink needs." ROADMAP.md:50 shows row 2.5 is `[x]` and is the 468/478 landmark guard.

**Detail.** If loadLandmarker throws, the stepped clip path still runs to completion: framesMeasured equals summary.framesMeasured exactly, so checkStepping (1533-area call at 815-819) returns "ok", and the 826 test `framesMeasured > 0 && framesBlinkMeasurable === 0` fires the #192 refusal, which names the frame rate as the cause. The comment at 877 claims this is "2.5 territory", but ROADMAP row 2.5 is ticked and is about a different defect, so nothing on the roadmap covers a failed model load and no SPEC.md degraded state names it (SPEC.md:120-127 lists five, this is not one). The page stays readable, so constraint 7's named cases hold, but the cause printed is wrong with full confidence.

**Corrected statement.** The frame counter runs before the model exists: a failed model load prints "Measured 60 frames at 60.0 frames per second", and every live export's frames_measured overstates by the whole model-load window (4490 counted, ~1460 looked at)

**Skeptic's reasoning.** SURVIVES, with one correction that removes its "strongest possible version". I built fresh (npx vite build --outDir <scratchpad>/sk-frames/dist --base ./), served it with my own node static server on port 4917, and drove real Chromium with three probes of my own.

MECHANISM. src/main.ts:1542 `framesMeasured += 1` is the first statement of processFrame; the detector guard `if (landmarker !== null)` is 21 lines later at :1563. Nothing throws, so this is not chunk 2's "no try/catch kills the rAF loop" cause — the loop lives, it just counts frames nobody looked at.

Q1 REACHABLE. Both paths, and they differ, as the finding suspected.
(a) CLIP, stepped, model asset fails to fetch (Playwright route abort on models/face_landmarker.task, i.e. a network failure of one of ~15 MB of assets). Reproduced on test/fixtures/clip-60fps-60frames.mp4 with zero detections ever run. Status line: "Measured 60 frames at 60.0 frames per second, in 0 s. Check that rate against your clip. Export the CSV, or pick another clip." Console: "face landmarker failed to load: TypeError: Failed to fetch". The healthy control run prints the identical first sentence ("in 5 s"). Worse, a second sentence follows: "All 60 frames were read, but it runs at 60.0 frames per second, below the 25 a short blink needs" — framesBlinkMeasurable stayed 0 because it is incremented inside the same landmarker guard, so the app misdiagnoses a missing model as a frame-rate refusal and states something arithmetically impossible. It also says "Everything else in the export is still valid" when nothing can be exported.
(b) LIVE camera, NO fault injected at all. beginVideoFile awaits ensureLandmarker; beginCamera at main.ts:666 does `void ensureLandmarker()` AFTER setState running, so every display frame during the model load is counted. I instrumented rAF from before app code ran (the app has one rAF loop) and cross-checked the tick count against the exported header. Cold cache, CDP-emulated 10 Mbps, ordinary first visit: model load window 16.4 s, 3,027 frames counted before the model existed, 1,429 after, exported `# frames_measured: 4490`. Two thirds of a number published into a CSV describes frames nothing measured. Warm cache: 14 of 858 (1.6%), so the size tracks load time. Not hand-edited state, not a deleted file.
I also tried to break the model without a network fault (--disable-webgl --disable-webgl2, since landmarker.ts:12 asks for delegate "GPU"): MediaPipe fell back to XNNPACK and measured normally, so path (a) needs a fetch failure, which is why I do not rate this higher.

CORRECTION — the finding's "strongest possible version" is false. When the model never loads there is NO CSV to corrupt: featureRecords is pushed inside the landmarker guard (main.ts:2100), so serializeRecords returns null and exportButton stays disabled. I measured it: exportCsvDisabled true in the blocked run, false in the control. The header is corrupted only on the live path, where the model does eventually arrive.

Q2 NOT A DUPLICATE. Chunk 2's recorded causes are a throw killing the rAF loop and unguarded calibrationStore; neither applies (nothing throws, the loop keeps running). The nearest neighbour is C3-31, "framesMeasured comes from an untested counter", a D10 coverage finding that says "nothing tests that the number inside it counts the right frames" — this is the behaviour that finding only speculated about, now measured.

Q3 NOT ROADMAP WORK. SPEC.md:121-126's degraded-state table has five rows and "the model failed to load" is not one of them; SPEC.md:119 promises "never shows stale numbers". The comment at main.ts:877 says "Full degraded-state treatment for a failed model load is 2.5 territory", but ROADMAP row 2.5 is ticked ([x]) and is the 468-vs-478 landmark guard. Nothing tracks this.

Q4 NUMBERS. A user-visible number goes wrong: the live `# frames_measured:` header, whose own contract in frameClock.ts:126-128 is "how many frames did this instrument actually look at". No PUBLISHED claim goes wrong — every published result is stepped-clip mode, where the model is awaited and chunk-4 verified frames_measured exactly against MP4 stsz/stts atoms. `# measured_fps:` is "unknown" in live mode, so the finding's "and a frame rate" is loose: the clip status line's 60.0 fps comes from the stepper's own seek calibration and is the clip's true rate.

Severity medium, not high: no published claim or dataset result is affected, and the total-failure case has other tells (no "Inference time" readout, no "Feature records" line, export disabled). It is a genuine fifth silent-success instance — the same shape as issue #192, where a run reported measurement while measuring nothing.

git -C <worktree> status --porcelain is empty; the server is stopped and the repo was never touched.

### C5-16. The single rule the whole document hangs on is false: all seven boxes render at idle, not just Source

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | B2               |
| Classified        | silent-violation |
| Severity as filed | high             |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** docs/UI.md:46-47: "**The rule: everything except the Source box is hidden unless the state is `running`.** Whole boxes are hidden, not individual readouts." On the built page at `idle`, `[...document.querySelectorAll('.box')].filter(b=>b.getBoundingClientRect().height>0).map(b=>b.querySelector('h2').textContent)` returned `["Source","Alertness","Session","Live signals","Gaze","Eyes","Blinks"]`. render() (src/main.ts:504-565) hides only the canvas, four toggle labels, three graph canvases, kssPanel, alertBanner and startButton; it never sets `hidden` on a single `.box`.

**Detail.** src/main.ts:508-512 states the opposite in a comment ("Readouts stay on the page at idle"), and src/main.ts:2658-2676 seeds fifteen readouts with idle strings so the page never reflows. UI.md contradicts itself: §8 item 7 (lines 347-351) describes exactly this true behaviour while §2 and the §7 state table (lines 319-326, `idle` = "Notice, title, Source box") describe the opposite. A designer reading §2 or §7 would size a page that does not exist.

### C5-17. The short caveat UI.md calls a non-negotiable rule does not exist on the page and is not even in the bundle

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | B2               |
| Classified        | silent-violation |
| Severity as filed | high             |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** docs/UI.md:191 "Caveat, from `demoNoticeShort()`: Demo, not a safety or medical device. Not diagnostic." and docs/UI.md:362-364 "the short caveat cannot be separated from the score. A screenshot of the number must carry the caveat with it." src/main.ts:78 imports `demoNoticeText` only; `grep -n 'demoNoticeShort' src/main.ts` returns nothing. src/main.ts:2555 `box("Alertness", scoreLabel, panelSummaryLabel, panelList)` has no caveat child. On the built page `document.querySelectorAll('.caveat').length` = 0 and `document.body.textContent.includes('Not diagnostic')` = false. `grep -c 'Not diagnostic' dist/assets/*.js` = 0.

**Detail.** DEMO_NOTICE_SHORT is tree-shaken out of the production bundle because nothing renders it. The `.caveat` CSS rule at src/main.ts:2358 is dead, and the comments at src/main.ts:2144-2149 ("the caveat travels WITH the number") and 2496-2497 ("It sits inside the same box as the number") describe an element that was removed and left its comments behind. Extends earlier finding C2-14 with the bundle-level proof.

### C5-18. Three whole page regions and one whole box exist on the page and appear nowhere in UI.md

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | B2               |
| Classified        | silent-violation |
| Severity as filed | high             |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** docs/UI.md:19-24 lists four regions: graph strip, demo notice, content column, overlays. On the built page `[...document.querySelector('#app').children]` returned seven: `p` (notice), `div.page-column` (nav bar), `div.page-column` (status banner wrapper), `div#content.page-column`, `footer#page-footer.page-column`, and two overlay divs. Sources: navBar src/main.ts:199, statusBanner src/main.ts:251-253 + bannerColumn:268-270, pageFooter src/main.ts:2707-2712. `document.querySelectorAll('.box').length` = 7; UI.md describes five plus "Instrument".

**Detail.** Undocumented: the nav bar carrying the LinkedIn link (src/main.ts:209-232, href `https://www.linkedin.com/in/eivinasnorusaitis`, text `/eivinasnorusaitis`); the status banner and its idle line `"No alerts at this time."` (src/main.ts:261); the footer `"Eivinas Norusaitis, 2026"` (src/main.ts:2711); the "Live signals" box (src/main.ts:2596) and its three-swatch legend `"Eye aspect ratio" / "Gaze, raw" / "Gaze, smoothed"` (src/main.ts:2528-2534). On the question asked: no, UI.md does not describe either identity-bearing element. The two strings on the shipped page that name a person are the two the specification omits. Confirms earlier finding C1-60.

### C5-19. UI.md §3 and §9 put the graph strip full width at the top; it ships column width inside a box mid-page, and main.ts documents the change UI.md missed

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | B2               |
| Classified        | silent-violation |
| Severity as filed | high             |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** docs/UI.md:55-57 "Region 1: Graph strip. Full window width, above everything." and docs/UI.md:366-368, filed under "Rules that constrain any redesign... they are not stylistic": "**The graph strip stays full width at the top**, because a single screenshot of the top of the page has to carry the traces plus as many readouts as fit." Actual: src/main.ts:2596 `box("Live signals", graphStrip, signalsFooter)`, src/main.ts:2614 `contentBox.append(topRow, liveSignalsBox, measurementRow)`. sizeGraphsToBox() sizes from `liveSignalsBox.clientWidth` (src/main.ts:2633), capped by `.page-column { max-width: 1280px }` (src/main.ts:2322). On the page, all three trace canvases report `closest('.box')` heading `"Live signals"`.

**Detail.** src/main.ts:2620-2627 states the reversal explicitly: "Sized to the box rather than the window now. The traces used to span the whole window so one screenshot of the top of the page carried them plus the readouts; with the boxed layout the top of the page carries the score, the source and the video instead, which is a better screenshot." The decision was made and reasoned in a code comment. UI.md still presents the abandoned version as a hard constraint on any future redesign, so the document now argues against the shipped design.

### C5-20. No non-JavaScript fallback and no global error handler: any failure before the DOM is built renders a completely blank white page

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | A7               |
| Classified        | silent-violation |
| Severity as filed | high             |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** index.html body is exactly `<div id="app"></div>` plus one `<script type="module">`. No <noscript>, no static text. `grep -rn "onerror|unhandledrejection|addEventListener(\"error\"" src/ index.html` returns nothing. Tested both ways against my scratchpad build: with the assets/ bundle removed (script 404) and with javaScriptEnabled:false, the result was identical — visible body text "" (empty string), body innerHTML 30 characters, no background colour.

**Detail.** main.ts appends to the page only at line 2744, so every top-level statement before it is a blank-screen candidate; chunk 2's localStorage read at main.ts:909 is one instance, and the `throw new Error` at main.ts:165 is another. Hard constraint 7 says degraded states "render a readable state, not a blank screen". This is the literal blank screen.

### C5-21. Blocked video playback is reported as "permission denied" while the granted camera stream is left running

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | A7               |
| Classified        | silent-violation |
| Severity as filed | high             |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** src/io/camera.ts:18-19 sets video.srcObject then awaits video.play(); a rejected play() carries name "NotAllowedError". src/main.ts:668-672 classifies on the error NAME alone and never calls stopCamera on the failure path (stopCamera appears only at main.ts:649 and 695, both before the try). Tested by making HTMLMediaElement.prototype.play reject with NotAllowedError while getUserMedia succeeded: status read "Camera permission was denied. To use blinklab, allow camera access for this site in your browser settings, then reload the page." and the MediaStream track readyState was still `video:live`.

**Detail.** The user is sent to fix a browser setting that is already correct, and the camera indicator light stays on with nothing on screen acknowledging a running camera. Only a reload recovers. docs/UI.md:114 specifies that denied string for genuine denial; nothing covers a granted-but-unplayable camera.

### C5-22. A clip that was never measurable reports a clean finish when watched rather than stepped

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | A7               |
| Classified        | silent-violation |
| Severity as filed | medium           |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** Same 10 fps clip, both modes. STEPPED banner: "Measured 27 frames at 9.8 frames per second... NO BLINKS WERE MEASURED IN THIS CLIP, and that is a refusal rather than a failure..." WATCHED banner: "The clip finished. Export the CSV, or pick another clip." — no refusal sentence. Its blink line reads "Blink metrics not measurable: the frame rate is still unknown." and the fps readout reads "Frames per second: measuring...", for a clip the same app measured at 10 fps one run earlier.

**Detail.** src/main.ts:820-838: the clipRefusedMessage block sits inside the stepped branch, which ends with `return;` at 838. The watched path's only completion message is the fixed string at src/main.ts:391-392, with no frame count, no rate and no refusal. fpsGate.ts's own doc comment describes exactly this failure (issue #192, 16 of 36 DROZY sessions silently unmeasured) and the fix was applied to one of the two paths. "The frame rate is still unknown" is also simply wrong at that point, which is worse than silence.

### C5-23. On the live path, PERCLOS and long closures say "measuring..." indefinitely while the fps gate is refusing them

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | A7               |
| Classified        | silent-violation |
| Severity as filed | medium           |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** CDP Emulation.setCPUThrottlingRate 25x. Blink line correctly became "Blink metrics not measurable: 6 fps is below the 25 fps a short blink needs." while PERCLOS stayed "PERCLOS (eyes closed share, last 60 s): measuring..." and long closures stayed "Long closures: waiting for the baseline", identical to their warm-up text.

**Detail.** src/main.ts:2082-2092 feeds `blinkMeasurable ? stabilityMm : null` into perclosStep, so a refused PERCLOS returns null and renders the same string as one that is still filling its 60 s window. Same for the baseline at 1938 and 2025, which gates "waiting for the baseline" behind a gate that will never open. fpsGate.ts's comment names this exact problem ("PERCLOS and long closures ride the same gate and were silent too") and the fix it describes, clipRefusedMessage, only speaks at the end of a stepped clip. A person watching a live session cannot tell a warm-up from a permanent refusal.

### C5-24. The three trace canvases are named but their values are not; the smoothed gaze series is never printed as a number

|                   |                        |
| ----------------- | ---------------------- |
| Constraint        | A8                     |
| Classified        | unreached-roadmap-work |
| Severity as filed | medium                 |
| Verdict as filed  | partial                |
| Verification      | **UNTESTED**           |

**Evidence.** CDP Accessibility.getFullAXTree while running exposes all three with nameFrom "attribute", e.g. "Eye aspect ratio over the last 10 seconds". But the sparkline plots the two-eye mean (src/main.ts:1631-1634, 1911-1915) on a 0..0.6 scale (SPARK_EAR_MAX, line 1455) while the only EAR text is per-eye and instantaneous (line 1629). The smoothed gaze pushed at lines 1796-1806 and drawn at line 2250 appears in no readout.

**Detail.** An aria-label naming a ten second trace is not an alternative for the values inside it, and the current-frame readout is not current for a ten second window. Partial credit is real though: "Fixations in the last 10 s: N, duration mean/median/longest" (line 1850) summarises the same window and the same smoothed signal, and the blink log (line 1982) gives every notch in the EAR line a timestamped text row.

### C5-25. No live regions: sixteen-plus readouts change silently, so a screen reader never hears a measurement update

|                   |                        |
| ----------------- | ---------------------- |
| Constraint        | A8                     |
| Classified        | unreached-roadmap-work |
| Severity as filed | medium                 |
| Verdict as filed  | violation              |
| Verification      | **UNTESTED**           |

**Evidence.** `document.querySelectorAll("[aria-live],[role=status],[role=log],output,[aria-atomic],[aria-relevant]")` returned `[]`. Sampling `#content p` 1.5 s apart with the camera running: "Feature records: 4" to "6", "Frames per second: 67" to "65", "Inference time: 13 ms" to "14 ms", "Learning your open eyes: 24 s left" to "23 s left".

**Detail.** The only live region on the page is the alert banner. Every measurement, every degraded-state message and every status line updates with no announcement path, so a screen reader user must re-read the page by hand to learn that anything changed.

### C5-26. Both overlays leave the entire page behind them exposed and tabbable

|                   |                        |
| ----------------- | ---------------------- |
| Constraint        | A8                     |
| Classified        | unreached-roadmap-work |
| Severity as filed | medium                 |
| Verdict as filed  | violation              |
| Verification      | **UNTESTED**           |

**Evidence.** With the heatmap overlay open, Accessibility.getFullAXTree still returned 201 non-ignored nodes including button "Export CSV" and StaticText "Alertness score: ". Six Tab presses from inside the overlay walked out of it and landed on `button | Export CSV` on the page underneath. No aria-modal, no inert, no role=dialog on either overlay (src/main.ts:920-931, 972-980).

**Detail.** A screen reader reads straight through the covering overlay into content the sighted user cannot see, and keyboard focus leaves the overlay with nothing to bring it back. Overlaps A7's dialog semantics, reported here for the reading order consequence.

### C5-27. The video canvas has no accessible name and does not appear in the accessibility tree at all

|                   |                        |
| ----------------- | ---------------------- |
| Constraint        | A8                     |
| Classified        | unreached-roadmap-work |
| Severity as filed | medium                 |
| Verdict as filed  | violation              |
| Verification      | **UNTESTED**           |

**Evidence.** `document.querySelector(".box canvas")` returned `{label: null, role: null, title: null, children: "", w: 640, h: 360}` (created at src/main.ts:303, appended at 2551). CDP getFullAXTree while running listed exactly three Canvas nodes, all three trace canvases; the picture is not among them.

**Detail.** The primary graphic on the page, plus the eyelid dots, iris rings and mesh drawn over it, is a nameless void to assistive technology. The numbers those markers encode do exist as text elsewhere (aperture, EAR), so this is a missing name rather than a missing value.

### C5-28. Trace and legend colours fall below the 3:1 non-text contrast floor

|                   |                        |
| ----------------- | ---------------------- |
| Constraint        | A8                     |
| Classified        | unreached-roadmap-work |
| Severity as filed | medium                 |
| Verdict as filed  | violation              |
| Verification      | **UNTESTED**           |

**Evidence.** Computed against the Live signals box background #fbfbfb (src/main.ts:2304): EAR sparkline #00b0ff = 2.34:1, gaze smoothed #ff9100 = 2.18:1, legend swatches the same two values. Gaze raw #546e7a = 5.22:1 and the zero line #37474f = 9.32:1 both pass.

**Detail.** The two lines that carry the most meaning are the two that are hardest to see. Raw versus smoothed is at least double-encoded by line width, 1 px against 2 px (src/main.ts:2240 and 2250), so the legend is not purely colour-dependent.

### C5-29. inferenceSamplesMs survives resetSession, so one session's inference times are blended into the next session's readout

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | B2               |
| Classified        | silent-violation |
| Severity as filed | medium           |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** Declared src/main.ts:1512 `let inferenceSamplesMs: number[] = [];`. Pushed at 1570-1574 with a 60-sample cap. Read into the visible readout at 1575-1578 `inferenceMessage(meanDurationMs(inferenceSamplesMs))`. resetSession spans 581-633 and resets 30 module variables including its direct sibling `frameTimestampsMs = []` at 621; `grep -n inferenceSamplesMs src/main.ts` shows no line inside 581-633.

**Detail.** Switch from a live camera to a stepped clip and the first ~60 frames report a mean blended with the previous source's samples. render():532 clears the LABEL when not running but never the buffer, so the stale mean reappears the instant a new session starts. This is the identical class of miss the file's own comment at 622-624 records review already catching twice ("Review found these two missed"); this instance is still open. Fix is one line in resetSession.

### C5-30. Measured frames-per-second is computed twice, and the two copies disagree exactly where the code already knows the duration can be infinite

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | DEBT             |
| Classified        | silent-violation |
| Severity as filed | medium           |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** src/main.ts:828-831 computes `framesMeasured / loadedClipDurationSeconds` guarded only by `loadedClipDurationSeconds !== null && loadedClipDurationSeconds > 0`. src/core/frameClock.ts:141-146 computes the same quotient guarded additionally by `Number.isFinite(durationSeconds)`, returning the string "unknown" otherwise. src/main.ts:716 already branches on `Number.isFinite(clip.durationSeconds)` to print "unknown length", so the file knows this case is real.

**Detail.** With an infinite duration, main.ts:830 yields `N / Infinity === 0` and hands 0 to clipRefusedMessage, which formats it at fpsGate.ts:44-46 as "it runs at 0.0 frames per second". The CSV written from the same run says `# measured_fps: unknown` (frameClock.ts:145-151). One screen and one file, same quantity, one fabricated number and one honest refusal. The renderer should call the core helper rather than re-deriving the quotient.

### C5-31. main.ts stamps an un-aged "last blink" into every per-second record, which defeats the score's own time window

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | B2               |
| Classified        | silent-violation |
| Severity as filed | medium           |
| Verdict as filed  | partial          |
| Verification      | **UNTESTED**     |

**Evidence.** src/main.ts:2099 `const lastShape = blinkEvents[blinkEvents.length - 1]?.shape ?? null;` and 2111 `lastBlinkDurationMs: blinkState.lastBlinkDurationMs` are copied into each new record with no age test. src/core/score.ts:137-142 charges points from lastBlinkDurationMs and 151-158 from `lastBlinkAmplitudeMm / lastBlinkPeakVelocityMmPerS`. main.ts:2138-2140's own comment: the score reads the last minute "selected by TIMESTAMP inside core: a row-count window would bridge a paused tab's gap and charge closures from ten minutes ago." `grep -rn "last blink" SPEC.md ROADMAP.md docs/UI.md MODEL_CARD.md` returns nothing.

**Detail.** Core deliberately windows by timestamp so old evidence cannot be charged; the renderer then re-stamps a possibly very old blink into every fresh row, so the old evidence walks back inside the window. If someone blinks once and then stops, that single blink keeps charging the score indefinitely. Marked partial rather than violation because "last blink" may be the intended column semantics, but no document states an age policy either way, so the behaviour is undecided rather than chosen.

### C5-32. The disproven MediaPipe-clock belief is still stated as fact 60 lines from the comment that refutes it

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | DEBT             |
| Classified        | silent-violation |
| Severity as filed | medium           |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** src/main.ts:1565-1568, inside processFrame: "MediaPipe wants a strictly increasing clock of its own, and uses it only to order frames internally. The wall clock is always that...". src/main.ts:1514-1532, immediately above the same function: "It used to be `performance.now()` in every mode, on the stated belief that MediaPipe 'uses it only to order frames internally'. That belief was wrong and it cost this project its repeatability... three runs of one clip on one machine gave the same 43 detections with three different sets of blink timings. See issue #174."

**Detail.** The #174 fix changed the stepped call site (756 passes `clipModelClockBaseMs + nowMs`) but left the old rationale in place at the point of use. A reader working inside processFrame sees only the wrong comment. Acting on it, by simplifying line 756 back to performance.now(), silently re-breaks repeatability with no test to catch it, because no test imports main.ts. Deleting 1565-1568 costs nothing.

### C5-33. The 3600 feature-record cap is a bare literal in two places, so changing one makes the label announce data loss that did not happen

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | DEBT             |
| Classified        | silent-violation |
| Severity as filed | medium           |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** src/main.ts:2122 `3600,` (the pushBounded cap) and src/main.ts:2133 `featureRecords.length >= 3600` with 2134 printing "Feature records: last 3600 kept, oldest discarded (about one per second)". `grep -n 3600 src/main.ts` returns 824, 1433, 2122, 2133, 2134 and no named constant.

**Detail.** Raise the cap at 2122 to 7200 and forget 2133, and the label claims the oldest rows were discarded from the moment 3600 is passed, while all 7200 are still present and exportable. The reverse edit makes rows vanish from the CSV with the label never saying so. Every other window in this file (SPARK_WINDOW_MS, SCANPATH_SAMPLE_CAP, GAZE_TRACE_HALF) is a named constant; this one is not.

### C5-34. processFrame holds about 30 distinct concerns in 733 lines with zero early returns; a null landmarker freezes every readout while the frame-rate readout keeps counting

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | B2               |
| Classified        | silent-violation |
| Severity as filed | medium           |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** src/main.ts:1533-2265 is 733 lines (`awk 'NR>=1533 && NR<=2265' src/main.ts | grep -c ""` = 733). It contains no `return` statement at all; control is instead two nested guards at 1559 and 1563 plus one `continue` at 1743. Maximum indentation reaches column 15 (line 1628). Numbered concerns include: frame accounting 1542-1543, fps readout 1544-1557, video draw 1560-1561, inference and its readout 1564-1578, face-presence logging 1580-1584, landmark validation 1600-1604, head pose and gate 1608-1618, EAR 1621-1634, aperture 1636-1672, iris offset and quadrant 1674-1702, overlay drawing 1712-1756, fixture recording 1606, gaze smoothing and four trace buffers 1772-1807, fixation detection 1809-1852, heatmap accumulation 1854-1875, calibration state machine 1877-1909, EAR sparkline buffer 1911-1915, baseline 1917-1929, blink detection 1931-1946, blink shape 1948-1967, blink log render 1969-1986, blink readout 1987-2004, shut-baseline freeze and long closure 2006-2074, alert governor 2031-2046, PERCLOS 2076-2092, per-second record 2094-2136, score and panel 2138-2174, stability CV 2177-2198, sparkline draw 2199-2211, gaze trace draw 2212-2262.

**Detail.** No early return means no half-updated state from a return, but the guards produce the same effect: when landmarker is null nothing in 1563-2263 runs, so not one readout is cleared, while 1542-1557 still advance framesMeasured and print a live frame rate. The interface then shows a moving camera image, a rising frame rate, and every measurement stuck on its initial "no valid measurement" string, with no sentence saying why. Four closures (`fmt` 1690, `project` 1712, `pushTrace` 1778, `drawGazeTraces` 2212) are also re-allocated on every frame inside this function.

### C5-35. UI.md describes a "Box: Instrument" that does not exist, and places the status line, model status, alert banner, video and title in containers they left

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | B2               |
| Classified        | silent-violation |
| Severity as filed | medium           |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** `[...document.querySelectorAll('h2')].some(h=>h.textContent==='Instrument')` = false; `document.querySelector('.instrument-line').closest('.box').querySelector('h2').textContent` = "Live signals" (src/main.ts:2536-2542). UI.md:283-288 documents "Box: Instrument". UI.md:104-105 puts Status line and Model status in the Source box; src/main.ts:2701 `statusBanner.append(bannerIdle, status, modelStatus, alertBanner)` and on the page `sourceBox.contains(document.querySelector('#status-banner'))` = false. UI.md:183 puts the Alert banner in the Alertness box; it is in the status banner. UI.md:145 heads §5.3 "The video (not in a box)"; src/main.ts:2544-2553 puts `canvas` inside `box("Source", ...)`. UI.md:91 puts the title in the content column; src/main.ts:2700 `navBar.append(title, linkedInLink)`.

**Detail.** Also: UI.md:26-28 says the column holds "five boxes arranged in three tiers, with the video sitting between the first box and the second" — the page has seven boxes in a 55fr/45fr top row (Source | Alertness+Session), then Live signals, then a three-across row ordered Gaze, Eyes, Blinks (src/main.ts:2601-2614), the reverse of UI.md's listing order. UI.md:213-216 also lists "Blink count" and "Frame rate refusal" as two Blinks rows; src/main.ts:1988 and 2001 write both into the same `blinkLabel` element, so they are mutually exclusive and never cost two lines.

### C5-36. UI.md's "about 130 characters, budget two lines" for the status line is now short by a factor of three

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | B2               |
| Classified        | silent-violation |
| Severity as filed | medium           |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** docs/UI.md:126 quotes the completion line and docs/UI.md:131 states "**Longest is about 130 characters. Budget two lines.**" src/main.ts:835-837 now appends two further clauses: `...pick another clip.${warning}${refused}`, where `warning` is `steppingWarning()` (src/core/frameClock.ts:253-266) and `refused` is `clipRefusedMessage()` (src/main.ts:825-834). Measured with node: the documented completion line is 131 chars; completion + steppingWarning is 380 chars.

**Detail.** Both clauses were added by the two most recent commits, 39bb021 (#197) and a257203 (#198), after UI.md was last touched. This is the exact number a layout would be sized against, in the section of UI.md whose stated purpose (lines 3-5) is "so a layout can be designed against worst cases". Neither new clause is documented anywhere in §5.2.

### C5-37. Quoted strings differ from what the code emits: the title, and the demo notice UI.md calls a tested constant

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | B2               |
| Classified        | silent-violation |
| Severity as filed | medium           |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** docs/UI.md:91 "`blinklab`. Always visible. Single line." Actual src/main.ts:169 `title.textContent = "Alertness measurement demo";` and on the page `document.querySelector('h1').textContent` = "Alertness measurement demo" (changed by 3e3a74d, #187). docs/UI.md:78-80 quotes the notice as "...medical device. **This is a learning project.** It is not for clinical..."; src/core/notice.ts:11-14 has no such sentence, and the page's rendered `data-testid=demo-notice` text reads "Demo, not a safety or medical device. It is not for clinical, workplace or safety use...". Node string compare: `equal? false`.

**Detail.** UI.md:75 introduces the notice as "`DEMO_NOTICE` from `core/notice.ts`, a tested constant", and UI.md:7-10 promises that quoted strings were extracted from the code rather than written from memory. This one was not: it carries a sentence the constant has never contained. UI.md:70 also calls the notice strip "grey background"; computed style on the page is `rgb(245, 197, 24)`, yellow (src/main.ts:179). Smaller: UI.md:101 "Measure every frame" vs the actual label "Measure every frame (slower to watch, but the same on every machine)" (src/main.ts:351).

### C5-38. Serving over plain HTTP on a LAN address shows the user the word "TypeError" and advice that can never work

|                             |                  |
| --------------------------- | ---------------- |
| Constraint                  | A7               |
| Classified                  | silent-violation |
| Severity as filed           | medium           |
| Verdict as filed            | violation        |
| Verification                | **REFUTED**      |
| Severity after verification | **low**          |

**Evidence.** Off a secure context `navigator.mediaDevices` is undefined, so src/io/camera.ts:10 throws a TypeError, and src/core/cameraState.ts:22-23 falls to the default branch producing `{kind:"failed", reason:"TypeError"}`. Tested by deleting navigator.mediaDevices before load: status read "The camera could not start (TypeError). Reload the page and try again." and the Start camera button stayed visible.

**Detail.** README.md:493-496 tells people to clone and `npm run dev`; Vite's --host prints a LAN URL that is not a secure context. Reloading will never fix it, and "TypeError" is developer jargon on a user-facing line. docs/UI.md:116 specifies the `failed` template but no written state covers the insecure-context cause.

**Corrected statement.** On an insecure origin the failure is reported readably but the reason reads "TypeError" and the recovery advice ("reload") cannot work

**Skeptic's reasoning.** REFUTED on question 4: the constraint the finding invokes is met, measured in a real browser. I reproduced the trigger with real Chromium enforcement and no monkeypatching, by serving my own fresh `npx vite build` of the repo on port 4917 and loading it through `--host-resolver-rules=MAP lanbox 127.0.0.1`, so the page ran on origin http://lanbox:4917 with `isSecureContext: false` and `typeof navigator.mediaDevices === "undefined"` — exactly the LAN-over-http condition claimed. Clicking "Start camera" produced, in the visible status line under the header: "The camera could not start (TypeError). Reload the page and try again."

WHAT THE PAGE ACTUALLY DOES. It does not go blank and it does not crash. Visible text went 1251 -> 1272 characters, all 7 buttons still rendered (Start camera, Stop measuring, Export CSV, Export blink log, Calibrate gaze, Gaze heatmap, Replay scanpath), `pageerror` list empty, console-error list empty. No stale numbers: every readout reads "no valid measurement" / "none yet" / "waiting for the baseline", and "Feature records: none yet". Control on a secure origin (http://127.0.0.1:4917, same bundle, same server, fake camera device) reached "Feature records: 1 this session" and "Alertness score: no face in frame", so the trigger really is the insecure origin and nothing else. SPEC.md:119 ("Each state renders a readable message. The page never crashes and never shows stale numbers") holds. AUDIT_PLAN.md:140 A7 ("The demo must never crash the page... each renders a readable state") holds. The finding's own test — "the page must render a readable state rather than a blank screen" — passes.

QUESTION 1, REACHABILITY: developer-only and undocumented, not a normal user path. README.md:493-497 says `npm run dev` then "Open the local URL that Vite prints"; vite.config.ts sets base /blinklab/ and Vite prints http://localhost:5173/blinklab/, which is a secure context where getUserMedia works. README.md:9 points the public at https://heshipstech.github.io/blinklab/, https. Reaching this needs `--host` plus a LAN IP, or self-hosting the build over plain http. Not hand-edited localStorage, but not the documented route either.

QUESTION 4, DOCUMENTATION: the finding says "SPEC.md names five degraded states and this is not one of them", which is true of SPEC's table but ignores the project's own UI catalogue. docs/UI.md:43 lists a sixth state `failed` = "Camera failed for another reason", and docs/UI.md:116 prints the exact shipped string with the placeholder spelled out: "`failed`: The camera could not start (REASON). Reload the page and try again." test/core/cameraState.test.ts:22 asserts by name that unknown errors keep "the reason preserved". So surfacing the raw browser error token is a written, tested design decision, not an undisclosed leak. docs/audit/appendix-chunk-2-all-findings.md:696 had already cleared this exact call site ("startCamera at main.ts:652 is inside try/catch ending main.ts:668 with classifyCameraError") and :665 had already recorded that the `default:` branch "switches on an arbitrary browser-supplied `string` and is plainly reachable".

NOT SILENT SUCCESS, AND ARGUABLY THE OPPOSITE. The interface announces the failure prominently, disables the export buttons, accumulates zero records, and claims no progress. The one string that could be misread, "Alertness score: measuring...", is the idle-state copy already on screen before any click, identical on the secure control at idle, so it is not produced by this failure.

WHAT SURVIVES, AND IT IS SMALL. Two cosmetic residues, neither a constraint breach. The parenthetical reason is developer jargon rather than English, and the recovery sentence is wrong for this specific cause: "Reload the page and try again" can never fix an http origin, where the real fix is https or localhost. A one-line guard in classifyCameraError (or a `navigator.mediaDevices === undefined` check before the call) would name the cause. Separately, the status <p> carries no role or aria-live (role null, aria-live null), so the change is not announced, which is roadmap row 8.8 territory and out of scope by question 3.

Worktree untouched: `git status --porcelain` empty at the end. I wrote my own build, my own static server on 4917 and my own three Playwright probes in scratchpad/skeptic-a7, and ran none of the auditor's scripts.

### C5-39. The clipFailed status line pipes raw JavaScript exception text straight to the user

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | A7               |
| Classified        | silent-violation |
| Severity as filed | medium           |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** src/main.ts:854-859 builds the reason from `error.message` for anything thrown inside beginVideoFile's try, which includes processFrame via `await stepThroughVideo(...)` at main.ts:749 and `await onFrame(...)` at src/io/videoStepper.ts:303. src/core/cameraState.ts:41-44 then passes it through verbatim, on the stated promise that "The reason arrives already written for a person to read". A TypeError or a QuotaExceededError (I confirmed Storage.prototype.setItem can be made to throw QuotaExceededError in the running page) would therefore be displayed as the app's status line.

**Detail.** The intended path is correct and I verified it — an undecodable file rendered exactly "This browser could not decode broken.mp4. Try an MP4 or WebM file." The defect is that the same channel is also the dumping ground for internal exceptions, with no distinction between a written reason and a stack-trace message.

### C5-40. Tab order jumps to the right column and back to the left, against reading order

|                   |                        |
| ----------------- | ---------------------- |
| Constraint        | A8                     |
| Classified        | unreached-roadmap-work |
| Severity as filed | low                    |
| Verdict as filed  | partial                |
| Verification      | **UNTESTED**           |

**Evidence.** Observed tab order with the camera running: stop 6 = Export CSV at (727,413), stops 7-16 = the nine KSS options and Skip at x=727-990, stop 17 = "Calibrate gaze" at (33,579). Focus therefore crosses to the right column, works down it, then returns to the left column below where it started.

**Detail.** DOM order puts the export and KSS panels before the gaze button row (src/main.ts:2512 appends calibrate, heatmap and replay into gazeButtonRow after those panels). Nothing is unreachable, the sequence is just surprising; this is ordinary row 8.8 work.

### C5-41. docs/UI.md documents how the calibration overlay closes but says nothing about the heatmap overlay

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | DEBT             |
| Classified        | silent-violation |
| Severity as filed | low              |
| Verdict as filed  | partial          |
| Verification      | **UNTESTED**     |

**Evidence.** docs/UI.md:298 reads "Opens on Calibrate gaze. Closes on any click, or on completion." The heatmap section at docs/UI.md:305-311 lists the canvas, caption and slider and never states a dismissal rule, although src/main.ts:1052 gives it the same click-to-close behaviour.

**Detail.** A 368 line interface spec that names one overlay's exit and omits the other's makes the omission look deliberate when it is not. Cheap to fix, and it is the natural place to also record that neither overlay currently has a non-pointer exit.

### C5-42. The clip refusal sentence quotes two different frame rates for the same clip in one status line

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | A7               |
| Classified        | silent-violation |
| Severity as filed | low              |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** Observed banner, stepped 10 fps clip: "Measured 27 frames at 9.8 frames per second, in 4 s. ... All 27 frames were read, but it runs at 9.0 frames per second, below the 25 a short blink needs."

**Detail.** src/main.ts:779-782 computes the first rate as `1 / summary.frameIntervalSeconds` (the stepper's calibrated interval) while src/main.ts:826-831 computes the second as `framesMeasured / loadedClipDurationSeconds`. The status line is explicitly asking the reader to "Check that rate against your clip", so handing them two answers undercuts the one instruction it gives.

### C5-43. A structurally valid but numerically poisoned profile produces a confident "(calibrated)" answer

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | A7               |
| Classified        | silent-violation |
| Severity as filed | low              |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** Stored {"horizontal":{"slope":null,"intercept":0},"vertical":{"slope":1,"intercept":0}}. No crash, loop alive, and the page rendered "Looking toward: top left (calibrated)" and "Gaze state: fixating for 0.3 s".

**Detail.** calibratedPoint (src/core/calibrationProfile.ts:93-101) does `null * offset.horizontal + 0`, which JavaScript evaluates to 0, so a meaningless profile yields a clean number wearing the "(calibrated)" badge. The project's own rule in SPEC.md Conventions is that a function which cannot produce a trustworthy number returns null, never a guess. Same unchecked cast as the critical above; here it fails quietly instead of loudly.

### C5-44. SPEC's promised "No face detected" string does not exist anywhere in the code

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | A7               |
| Classified        | silent-violation |
| Severity as filed | low              |
| Verdict as filed  | partial          |
| Verification      | **UNTESTED**     |

**Evidence.** `grep -rn "No face" src/` returns one hit, and it is a comment: src/main.ts:1758 "// No face: the numbers must vanish, not go stale." Driven with Chromium's fake device (a test pattern, no face), the page instead renders "Alertness score: no face in frame", every readout as "no valid measurement", the banner as "No alerts at this time.", and console.log "face detected: false". No uncaught errors.

**Detail.** There IS a written reason for the wording that ships: docs/UI.md:188 documents "Alertness score: no face in frame" as one of the score line's three forms. The state is readable and measurements do stop, which is the substance of SPEC's row. What is missing is any top-of-page acknowledgement — the banner claims no alerts — and SPEC.md's error table is now stale against docs/UI.md. Fix the table, not the code.

### C5-45. The alert banner's `hidden` attribute is rewritten about 66 times a second while running

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | DEBT             |
| Classified        | silent-violation |
| Severity as filed | low              |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** src/main.ts:2046 `alertBanner.hidden = !alertVisible(alertState, nowMs);` is unconditional. A MutationObserver on `#status-banner` recorded 133 records in 2 s while running, every one `attributes:hidden`, versus 0 records in 2 s at idle. src/main.ts:2723-2732 documents this exact pattern as the bug that hung `page.goto` in every browser, and guards `bannerIdle.hidden` against it.

**Detail.** The guard the code calls "load bearing" was applied to one child of the strip and not the other, so the MutationObserver still re-runs every frame. No announcement follows, because the content does not change, but it is the same silent-churn defect the comment warns about.

### C5-46. docs/UI.md documents a heatmap caption and a slider readout that do not exist as visible or accessible text

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | A8               |
| Classified        | silent-violation |
| Severity as filed | low              |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** docs/UI.md:312 lists `| Caption | \`Gaze heatmap accumulating over a test image\` |`and 313 says the scanpath slider "Shows`Replay at X s of Y s`". In code that first string exists only as a canvas aria-label (src/main.ts:982-985) and the second is painted into the canvas by fillText (src/main.ts:1199-1203); the visible caption on the card is a different string, "Look at the shapes, hold on each. Click anywhere to close." (line 1107).

**Detail.** The specification presents an invisible accessible name as though it were an on-screen caption, and attributes a readout to a control that does not display it. Anyone reading UI.md would conclude the heatmap already has the text the accessibility rule asks for.

### C5-47. No landmarks and no skip link; box headings reach the accessibility tree uppercased

|                   |                        |
| ----------------- | ---------------------- |
| Constraint        | A8                     |
| Classified        | unreached-roadmap-work |
| Severity as filed | low                    |
| Verdict as filed  | partial                |
| Verification      | **UNTESTED**           |

**Evidence.** AX tree landmark roles while running: `contentinfo` only, from `<footer id="page-footer">` (src/main.ts:2707). `document.querySelectorAll("a[href^='#']")` returned `[]`. The nav bar is a plain div (src/main.ts:199). Chrome returned h2 names as "SOURCE", "ALERTNESS", "GAZE" because of `text-transform: uppercase` at src/main.ts:2339, though the DOM text is "Source".

**Detail.** Heading structure itself is sound, one h1 followed by seven h2s with no skipped level, which is real 8.8 work already landed. What is missing is region navigation: no main, no nav, no way to jump past the fourteen controls to the readouts.

### C5-48. Dead CSS rules and dead class handles in the concatenated stylesheet

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | DEBT             |
| Classified        | silent-violation |
| Severity as filed | low              |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** Observed in the browser on my own build (script http://localhost:4319/assets/index-DNpIyELs.js): `document.querySelectorAll('.quiet').length` = 0, `.caveat` = 0. Rules exist at src/main.ts:2356 `.quiet { font-size: 12px; color: #555; }`, 2357 `.quiet p { margin: 2px 0; }`, 2358 `.caveat { font-size: 12px; color: #666; margin: 0 0 10px 0; }`. `grep -n quiet\|caveat src/main.ts index.html` finds no element assignment. The reverse also exists: main.ts:260 sets `bannerIdle.className = "banner-idle"` and main.ts:1327 sets `skip.className = "kss-option skip"`, and neither `.banner-idle` nor `.skip` has any rule in 2276-2455.

**Detail.** Three dead rules and two dead handles. `.caveat` is the CSS half of the already-reported missing score caveat (docs/UI.md:363-364 says the short caveat cannot be separated from the score; demoNoticeShort() has no importer in src/). Also stranded: the orphaned comment at 2416-2421 explaining a Skip rule that no longer exists, and `.box[hidden]` at 2305 which no box ever triggers (no `*Box.hidden` assignment exists in the file).

### C5-49. A statement is duplicated verbatim on consecutive lines, and the two export paths repeat the same timestamp and metadata assembly

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | DEBT             |
| Classified        | silent-violation |
| Severity as filed | low              |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** src/main.ts:1361 and 1362 are the identical statement `exportButton.disabled = true;`, twice in a row. `npx eslint src/main.ts` produced no output and exited 0, so the project's own lint does not catch it. The four-line ISO stamp expression `new Date(sessionStartedAtEpochMs ?? Date.now()).toISOString().replace(/[:.]/g, "-").replace("Z", "")` appears identically at 1351-1354 and 1394-1397. The metadata-row assembly appears at 1337-1344 and 1379-1387.

**Detail.** Harmless today, but each duplication is a place where one copy can be corrected and the other left behind. The two export buttons already differ in one respect that matters (the blink log deliberately omits kssMetadataRows), which is exactly the situation where copied blocks drift without anyone noticing.

### C5-50. The same six refusal sentences are written from three or four call sites each, and a window resize listener is registered inside a state setter

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | DEBT             |
| Classified        | silent-violation |
| Severity as filed | low              |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** `grep -on '"[A-Z][^"]\{12,\}"' src/main.ts | sort | uniq -c` gives 4 for each of "Looking toward: no valid measurement", "Iris offset: no valid measurement", "Eyelid aperture: no valid measurement", "Eye aspect ratio: no valid measurement"; 3 for "Head pose: no valid measurement" and "Fixations in the last 10 s: none yet". The sites are the inline ternaries (1628, 1653, 1695, 1614, 1817), the gate-refused branch (1706-1709), the no-face branch (1759-1764) and the idle-initialisation table (2661-2670). Separately, src/main.ts:572 `window.addEventListener("resize", sizeGraphsToBox);` sits inside `setState`.

**Detail.** Twenty-two occurrences of "no valid measurement" across the file; reword one refusal and the page will say two different things depending on which path produced it. Every other message of this kind is a tested core function (cameraStateMessage, fpsGateMessage, poseValidityMessage); these six are not, and `lookingTowardMessage` (1209-1221) is a presentation function that stayed behind in main.ts. The resize listener is deduped by the DOM spec because the same function reference is passed each time, so it does not leak, but a listener registration inside a setter is a landmine for the next edit.

### C5-51. Section 8, "the worst cases", leads with a risk the code already solved and mis-states the panel measurements

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | B2               |
| Classified        | silent-violation |
| Severity as filed | low              |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** docs/UI.md:335-337, ranked #1: "**The blink log grows to 50 entries** and is the tallest element on the page. Everything below it moves down. Consider a fixed height with internal scrolling." src/main.ts:2425-2426 already does exactly that: `.blink-log { ... max-height: 190px; overflow-y: auto; ... }`. docs/UI.md:280 "**Option 9 is 58 characters.**"; node reports `"Very sleepy, great effort to keep awake, fighting sleep"` (src/core/kss.ts:28) is 55, and src/main.ts:2410 comments 54, so three numbers disagree. docs/UI.md:275 lists the KSS options as one flow; src/main.ts:2413-2414 renders `repeat(2, minmax(0, 1fr))`, a two-column grid.

**Detail.** A designer reading §8 in order would spend effort on a solved problem and size the Session box against a stale character count and a one-per-row layout that is now two columns. Smaller in the same section: §8.6 says tier 2 stacks "below about 1000 px"; the actual rule is `repeat(auto-fit, minmax(300px, 1fr))` (src/main.ts:2347), roughly 932 px, and the top row has its own undocumented 900 px breakpoint (src/main.ts:2367).

### C5-52. Overlay contents drift: the visible heatmap instruction is undocumented and the documented caption is an aria-label, not a caption

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | B2               |
| Classified        | silent-violation |
| Severity as filed | low              |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** docs/UI.md:309-313 lists the heatmap overlay as Canvas, "Caption: `Gaze heatmap accumulating over a test image`", Scanpath slider. src/main.ts:982-985 sets that string as `heatmapCanvas.setAttribute("aria-label", ...)`, so it renders nothing visible. The text a viewer actually sees is painted onto the canvas at src/main.ts:1106-1110: `"Look at the shapes, hold on each. Click anywhere to close."` — absent from UI.md. UI.md:244 gives the calibrate button two labels; src/main.ts:1898 adds a third, `"Recalibrate gaze (solver refused the samples, try again)"`.

**Detail.** UI.md's other overlay strings check out exactly (`Follow the dot (N/9). Click anywhere to cancel.` at src/main.ts:1907, `Replay at X s of Y s` at src/main.ts:1200). Whether an aria-label is an adequate text alternative for a number-bearing graphic is ROADMAP row 8.8 work and is not judged here; the drift finding is that UI.md records the invisible string and omits the visible one.

### C5-53. Three fire-and-forget async calls; beginCamera's pre-try lines can strand the page in "requesting" with no button to press

|                   |                  |
| ----------------- | ---------------- |
| Constraint        | A7               |
| Classified        | silent-violation |
| Severity as filed | low              |
| Verdict as filed  | violation        |
| Verification      | **UNTESTED**     |

**Evidence.** Unawaited promises: src/main.ts:360 `void beginVideoFile(file)`, 885 `void beginCamera()`, 889 `void beginCamera(picker.value)`. In beginCamera, lines 645-650 (setState, clipLoop?.stop(), stopCamera(video), unloadVideoFile(video) which calls video.load()) sit OUTSIDE the try that begins at 651; beginVideoFile has the same structure at 694-698. A throw there rejects into `void` and is lost. main.ts:564 `startButton.hidden = running || state.kind === "requesting"` then leaves no visible control.

**Detail.** `void ensureLandmarker()` at main.ts:667 cannot reject because it swallows internally — that swallowing is finding 2. The beginCamera pre-try window is narrow in practice, which is why this is low, but the recovery cost is a full reload with no on-screen explanation.

---

## Compliance, as reported by each auditor

### Interface layer, keyboard operation and visible focus (checklist A8), driven in Chromium against a production build served from the scratchpad

- Every control that receives focus keeps a real, visible browser focus ring. I enumerated all 52 author CSS rules from `document.styleSheets`: not one contains `outline`, `:focus` or `:focus-visible`, and the only pseudo-class rule present is `button:hover:not(:disabled)`. Because nothing sets `outline: none`, the UA ring survives: every one of the 18 controls reached measured `outline-style: auto`, `outline-width: 1px`, `outline-color: rgb(0, 95, 204)` and `el.matches(':focus-visible') === true`.
- The camera starts with the keyboard alone: two Tabs to "Start camera", Enter, and the button hid itself while the Mirror, Eye markers and Face mesh toggles joined the page.
- A clip loads with the keyboard: Enter on the focused file input fired Playwright's `filechooser` event, and after supplying test/fixtures/clip-60fps-60frames.mp4 the status read "Measuring every frame: 1 done, 0% of the clip."
- "Stop measuring" is reachable by Tab (third stop from the top during a clip) and Enter stops it: the button went `hidden = true` and the status read "Stopped after 7 frames. Export the CSV to keep what was measured, or pick another clip."
- Export CSV works from the keyboard: Enter on the focused button produced a download named blinklab-session-2026-08-10T10-53-32-505.csv.
- The KSS question is fully keyboard operable: all nine options plus Skip appear in the tab order at stops 7-16, and Enter on "3 Alert" collapsed the option grid to the single answered button "3 Alert".
- All three view checkboxes toggle with Space; observed face-mesh flip from `checked:false` to `checked:true` on a single Space press.
- The scanpath range slider responds correctly to arrow keys once its overlay is open: value 1000, five ArrowLeft presses gave 995 with 5 `input` events fired, Home gave 0, End gave 1000. The `event.stopPropagation()` on its click handler (src/main.ts:1027) does not interfere with key handling.
- No element anywhere carries a `tabindex` attribute, so nothing distorts the natural focus order, and disabled controls are correctly skipped (Export blink log, disabled for want of blink events, never received focus). The camera picker is a native `<select>` with `aria-label="Camera"` (src/main.ts:277), focusable and keyboard operable once shown, and stays hidden with a single camera exactly as test/MANUAL.md item 6 documents.
- No uncaught page errors were raised during any keyboard sequence, including every attempt to escape both overlays. `page.on("pageerror")` collected an empty array across all runs.

### A7 — the five degraded states SPEC.md promises, and hard constraint 7 (the demo must never crash the page). Driven against the real production build i

- PERMISSION DENIED — compliant, readable, names recovery. getUserMedia overridden to reject NotAllowedError; banner rendered "Camera permission was denied. To use blinklab, allow camera access for this site in your browser settings, then reload the page." Page intact (98 elements under #app), zero uncaught errors. src/core/cameraState.ts:36.
- NO CAMERA FOUND — compliant. enumerateDevices returning [] plus NotFoundError produced "No camera was found on this device. Connect one and reload the page." Zero uncaught errors. src/core/cameraState.ts:38.
- UNCLASSIFIED CAMERA FAILURE — compliant, and better than the spec asks. OverconstrainedError produced "The camera could not start (OverconstrainedError). Reload the page and try again." The reason is named rather than swallowed. src/core/cameraState.ts:39-40.
- WRONG LANDMARK COUNT, 468 not 478 — compliant, and this was OBSERVED, not reasoned. With the served bundle patched to hand processFrame 468 points, the page rendered in full: "The face model returned 468 landmarks instead of 478. This model variant lacks the iris points that measurements need, so measurement is stopped. Reload the page; if this persists, the bundled model file is wrong." Frames kept flowing (fps 52 → 56), no uncaught error, and every measurement readout dropped to "no valid measurement" rather than going stale. src/core/landmarkGuard.ts:22.
- LOW FRAME RATE, LIVE — compliant on the blink metrics. CDP CPU throttling at 25x drove real fps to 6 and the readout became "Blink metrics not measurable: 6 fps is below the 25 fps a short blink needs." It names the measured rate and the threshold, and it RECOVERS: releasing the throttle restored "Blinks: 0 (rate: 0/min)". Zero uncaught errors throughout.
- LOW FRAME RATE, STEPPED CLIP — compliant and unusually good. A 10 fps clip produced the whole clipRefusedMessage on screen: "NO BLINKS WERE MEASURED IN THIS CLIP, and that is a refusal rather than a failure... Eye closure share and long closures are refused for the same reason. Everything else in the export is still valid." This is the one place the instrument speaks up about a whole run being unmeasurable.
- A FILE THAT IS NOT A VIDEO — compliant. A plain-text file named not-a-video.mp4 produced "This browser could not decode not-a-video.mp4. Try an MP4 or WebM file." Page intact, zero uncaught errors.
- A ZERO-BYTE FILE — compliant. empty.mp4 produced the same readable decode message. Page intact, zero uncaught errors.
- A ONE-FRAME CLIP — compliant, and it refuses rather than guesses: "Could not work out this clip's frame rate, so it cannot be measured frame by frame. Try re-saving it as a constant frame rate MP4." This is src/main.ts:790-793 doing exactly what its comment promises.
- RELOAD MID-CALIBRATION, and REPEATED START CLICKS — both compliant. Reloading with the calibration overlay up came back clean: `Object.keys(localStorage)` was [], the button read "Calibrate gaze" again, banner "The camera is off. Click \"Start camera\" to begin.", no half-written profile. Clicking Start camera five times inside 100 ms (dispatched directly, bypassing the fact that the button hides) left ONE loop running at 66 fps with no uncaught error; Stop measuring is hidden at idle so it cannot be clicked before Start.

### A8: text alternatives for every number shown as a graphic, plus screen-reader semantics

- Heading structure is correct and complete: one h1 "Alertness measurement demo" (src/main.ts:168) followed by seven h2 box titles, no skipped levels, all exposed as role heading in the AX tree.
- role="alert" is genuinely correct: CDP shows the node entering the tree with live="assertive", atomic=true, relevant="additions text", and its text already present. src/main.ts:2031-2044 writes the text only on the firing edge, with a comment saying why, so suppressed triggers are never announced.
- The alert never carries meaning by colour alone: the strip turns orange via `#status-banner.alerting` (src/main.ts:2406) AND reads "Alert: long eye closure (alerts: N, suppressed: M)".
- The score contribution panel is the one number-bearing display with no graphic at all: a <ul aria-label="Score contributions"> (src/main.ts:1425-1426) whose items are plain text like "eyes closed share, 20 points". No bars to need an alternative.
- The blink log is a full text equivalent for the notches in the EAR sparkline: <ul aria-label="Blink events"> (src/main.ts:1438-1440), one timestamped row per blink with duration, amplitude and velocity (line 1982).
- Disabled controls state their reason in text, not just in grey: "Gaze heatmap (calibrate first)" and "Replay scanpath (run the heatmap first)" (src/main.ts:964-1009), with a deliberate comment at 535-537 about disabling rather than hiding.
- Every text colour on the page clears WCAG 1.4.3, measured against its own composited background: demo notice #1a1a1a on #f5c518 = 10.68:1, alert #1a1a1a on #ff9100 = 7.71:1 and on the alerting strip #ffb300 = 9.70:1, calibration progress white over rgba(0,0,0,0.85) = 15.08:1, footer #666 = 5.74:1, box h2 #666 on #fbfbfb = 5.55:1, quiet #555 = 7.20:1, link #0a66c2 = 5.69:1.
- The demo notice's colour choice is reasoned in the source (src/main.ts:180-186: near-black on yellow rather than white "because white on yellow is poor contrast and this is the one line on the page that must be readable by everyone"), and the measurement confirms it at 10.68:1.
- The trace legend gives every coloured line a text name (src/main.ts:2518-2534), and raw versus smoothed is double-encoded by line width, 1 px against 2 px (lines 2240 and 2250), so the pairing does not depend on colour alone.
- The calibration overlay's progress count is real DOM text, "Follow the dot (1/9). Click anywhere to cancel." (src/main.ts:1907), confirmed present in the AX tree as StaticText, so the one number that overlay shows has a text form.

### Interface layer: structure and technical debt inside src/main.ts (checklist B2, DEBT). Read all 2,764 lines; built to /private/tmp/.../scratchpad/b2di

- Lint is clean. `npx eslint src/main.ts` produced no output and exited 0, including the project's core-purity rule. `git -C .../audit-fresh status --porcelain` returned 0 lines at the end of this audit; nothing was modified and no install ran.
- resetSession genuinely does most of the job: it resets 30 of the 46 module-level `let` bindings (src/main.ts:581-633 against `grep -n '^let ' src/main.ts`), and its comments record three earlier misses now fixed: blinkState at 608 ("the previous session's last blink duration still charged the new session's score"), framesMeasured and framesBlinkMeasurable at 625-626, and frameClock at 620. The reset habit is real, not decorative.
- The 16 unreset bindings are almost all defensible: canvasContext, frameSource, loadedClipName, measurementMode, loadedClipDurationSeconds, clipLoop, clipStopRequested, state, landmarker and landmarkerLoading are owned by the source lifecycle and reassigned in beginCamera (653-656) and beginVideoFile (712-714); mirrored, showEyeMarkers and showFaceMesh are user preferences that should survive; calibrationProfile deliberately persists via localStorage (909); clipModelClockBaseMs is assigned at 744 immediately before its only read at 756. Only inferenceSamplesMs and lastFacePresent are missed, and lastFacePresent drives nothing but a console.log (1581-1584).
- The banner MutationObserver workaround is documented, load-bearing and verified working. Observed at localhost:4319: emptying `status.textContent` from outside the app caused `.banner-idle` to become visible with textContent "No alerts at this time." and `idle.hidden` to flip false, with no render() call and no synchronous change (`syncIdleHidden: true` immediately after the write, `idleHidden: false` on the next probe). The defect it covers, roughly eight direct `status.textContent =` writes at 373, 391, 729, 731, 748, 761, 835/837 plus modelStatus at 1602, is still live, so the workaround cannot be removed without routing status writes through one setter.
- The re-entrancy guard at src/main.ts:2730 `if (bannerIdle.hidden !== speaking)` is correct and its comment names the exact cost of removing it: "every browser sat on `page.goto` until it timed out... and the overnight corpus run silently produced nothing for an hour." The `attributeFilter: ["hidden"]` at 2740 is what keeps the `classList.toggle("alerting")` at 2733 from re-triggering, which is subtle but stated.
- The clip model clock offset at 744 (`Math.ceil(performance.now()) + 1`) is a correct fix for a real MediaPipe constraint, not a workaround for this codebase's own bug. Its reason is written at 738-743 and 1514-1532 with a measured date (9 August 2026), a reproduction (three runs, same 43 detections, three different timing sets) and an issue number (#174).
- The two counters that separate a refusal from a failure work as designed: framesBlinkMeasurable (315, incremented 1934, reset 626) and the #192 clip refusal path at 825-834, backed by core/fpsGate.ts:37-52. Likewise the #193 stepping cross-check at 815-821 compares the stepper's count against the pipeline's rather than printing the larger one.
- Both overlays' state is reset by resetSession: captureState and calibrationRequested at 610-611, calibrationOverlay.hidden at 612, heatmapOpen, heatmapOverlay.hidden, heatmapGrid and scanpathSamples at 613-616. The overlays' missing keyboard reachability, role=dialog and Escape handler is ROADMAP.md:124 row 8.8 `[ ]`, so it is UNREACHED ROADMAP WORK and is not filed as a finding here.
- No accessibility finding is filed in this dimension. Zero `:focus`/`outline` rules in the stylesheet (2276-2455) and no keyboard listeners among the 21 addEventListener calls are exactly ROADMAP.md:124 row 8.8, which is UNTICKED. That is unreached roadmap work, not a silent violation, and it is correctly so.
- JUDGMENT on ARCHITECTURE.md:139 ("main.ts is long and does the wiring by hand, which is honest for its size and would not survive a second developer without being split"): the claim was true and is no longer. The file is still honest in intent, every one of its 44 core imports is a real delegation and the comments are unusually candid, but it has stopped being honest in effect, and the cost is now measurable rather than aesthetic. Four of my ten findings exist only because there is no src/ui: the measured-fps quotient is computed in two places and the copies already disagree (main.ts:828-831 versus frameClock.ts:141-146); the 3600 cap is a literal in two places; six refusal sentences are written from three or four sites each; and a whole page-state mechanism, the banner, is held together by a MutationObserver watching the DOM because roughly nine call sites write status text directly and no function owns it. Two more are structural: processFrame carries about 30 concerns across 733 lines with no early return, which is why a null landmarker leaves the interface half-updated and why the #192 refusal can print the wrong cause with full confidence. The decisive fact is that no test imports main.ts, so 2,764 lines carrying the fps derivation, the two-eye means, the 400 ms blink-shape window, the shut-baseline freeze policy and the per-second record assembly are covered by nothing but two Playwright specs and a manual checklist. The debt is not the length; it is that measurement decisions kept migrating into the one file no test can reach. The cheapest honest fix is not a full split: extract a status/banner owner (deletes the observer and its re-entrancy guard), move the six refusal strings and lookingTowardMessage into core message functions, move the blink-shape window selection and the measured-fps quotient into core where their siblings already live, and name the 3600. That is maybe 200 lines moved and it retires most of this list.

### docs/UI.md against the page that actually ships (interface layer)

- Git status clean at the end: `git -C "...audit-fresh" status --porcelain` returned empty output. The repo was never modified; the build went to /private/tmp/.../scratchpad/uiaudit/dist via `npx vite build --outDir ... --emptyOutDir --base ./` and was served on port 4199. No npm install was run.
- All seven `cameraStateMessage` strings in UI.md:111-117 match src/core/cameraState.ts:29-41 exactly, including the nested quotes in `The camera is off. Click "Start camera" to begin.` and the full denied/noCamera sentences. The page rendered the idle one verbatim.
- The model-status failure string quoted at UI.md:138-141 matches src/core/landmarkGuard.ts:23 word for word, including "the bundled model file is wrong."
- Tier-2 readout strings match the code exactly: `Eyelid aperture, right: X mm, left: Y mm` (main.ts:1654), `Eye aspect ratio, right: X, left: Y` (1629), `Iris offset...` (1696), `Looking toward: ... (calibrated)/(uncalibrated)/off screen` (1211-1220), `Gaze state: fixating for X s` / `moving` (1836-1837), `Fixations in the last 10 s: ...` (1849-1850), `Head pose, pitch: X°, yaw: Y°, roll: Z°` (1615), and the pose gate sentence (src/core/validityGate.ts:48).
- The alert banner string at UI.md:203 matches src/main.ts:2044 exactly: `Alert: long eye closure (alerts: N, suppressed: M)`. Only its container moved.
- The two frame-rate refusal forms at UI.md:216 match src/core/fpsGate.ts:16,18 exactly.
- Both caps UI.md states are real: blink log 50 (`BLINK_LOG_DISPLAY_CAP = 50`, src/core/constants.ts:58, applied at src/core/blinkLog.ts:41-43) and panel list 0 to 3 (`PANEL_DRIVER_LIMIT = 3`, src/core/scorePanel.ts:9, sliced at :30).
- Both resolution-line forms at UI.md:161-162 match src/main.ts:660 and 718-721, including the "unknown length" fallback.
- The Session box composition at UI.md:258-264 is accurate: src/main.ts:2558 `box("Session", featureLabel, exportRow, kssPanel)` with exportRow holding Export CSV, Export blink log and the DEV-only recorder (src/main.ts:2502-2508, gated by `import.meta.env.DEV` at :498).
- The demo notice is genuinely always present and undismissible, centred, normal weight, appended first (src/main.ts:2744-2745). Computed style on the page: `text-align: center`, `font-weight: 400`, no dismiss handler exists. Only its colour and its quoted text differ from UI.md.

### A7 — everything that can stop the page, beyond chunk 2 (crash paths, unhandled rejections, feature detection, model load, long-session memory)

- Repo untouched: `git -C .../audit-fresh status --porcelain` is EMPTY at the end (0 lines). I built only to /private/tmp/.../scratchpad/a7/dist and never ran npm install or npm run build.
- Every buffer in main.ts is bounded, and I checked all eleven. Time-bounded: frameTimestampsMs via keepRecent 2000 ms (main.ts:1545); earSamples, stabilitySamples, gazeSamples and the four gazeTraces arrays via withinWindow SPARK_WINDOW_MS=10000 (main.ts:1783-1793, 1820, 1911, 2177). Count-bounded: inferenceSamplesMs cap 60 (1570-1574), scanpathSamples SCANPATH_SAMPLE_CAP=18000 (1865-1869), featureRecords 3600 (2100-2123), blinkEvents BLINK_LOG_RECORD_CAP=20000 (blinkLog.ts:25, constants.ts:66). heatmapGrid is a fixed grid. Nothing grows without a bound.
- At the featureRecords cap the label tells the truth rather than hiding the loss: main.ts:2133-2135 switches to "Feature records: last 3600 kept, oldest discarded (about one per second)".
- The blink log's record cap (20,000) and display cap (50) are deliberately separate — blinkLog.ts:28-44 explains that collapsing them once cost an external validation 63 rows — so reaching the display boundary never truncates what gets exported.
- requestVideoFrameCallback IS feature-detected, and it is the one degradation done properly: frameLoop.ts:33-37 guards, main.ts:758-762 throws a written, user-readable refusal naming the browsers that work and noting the live camera still functions.
- No WebGL is a non-issue and needs no code: MediaPipe falls back to CPU on its own. Verified with --disable-webgl2 (document.createElement('canvas').getContext('webgl2') returned null): console said "Created TensorFlow Lite XNNPACK delegate for CPU", the page reported "Inference time: 13 ms (budget 30 ms)", and measurement ran normally. The hardcoded `delegate: "GPU"` at landmarker.ts:12 is safe.
- OffscreenCanvas is not used anywhere: `grep -rn OffscreenCanvas src/` returns nothing.
- Every getContext("2d") result is null-checked before use: main.ts:1464, 1484, 1488 with guards at 1872, 2199, 2217, and 640-642 for the main canvas; videoCanvas.ts only accepts an already-non-null context.
- The undecodable-clip path renders exactly the string docs/UI.md:117 specifies. Uploaded 18 bytes of text as broken.mp4; status read "This browser could not decode broken.mp4. Try an MP4 or WebM file."
- A real page-stopper is already fixed with its reasoning written down: refreshBanner's conditional write at main.ts:2730-2732 stops the MutationObserver at 2735 from re-triggering itself forever, which used to hang page.goto until timeout in every browser.

---

## What each auditor could not check

### Interface layer, keyboard operation and visible focus (checklist A8), driven in Chromium against a production build served from the scratchpad

- MANUAL item 10 as quoted in my brief does not exist in this repository. `grep -n -i "keyboard|tab through|focus" test/MANUAL.md` returns nothing, and docs/UI.md contains zero occurrences of keyboard, focus, escape, tabindex, dialog or aria-modal. Item 10 of test/MANUAL.md is the 2.3 eyelid-ring check. So there is NO written promise that focus is always visible to violate, and every focus finding above falls under unticked ROADMAP.md:124 rather than a broken commitment. That unticked row is the only accessibility statement anywhere in the docs.
- I could not reach the heatmap or the scanpath slider through the real flow: the fake camera stream has no face, so calibration never completes and no gaze samples accumulate. I set `heatmapButton.disabled = false` and `scanpathSlider.hidden = false` directly, which reproduces exactly the state src/main.ts:1900 and the Replay button would produce, and I changed nothing else.
- Export blink log stayed disabled throughout (no blink events in the synthetic clip), so its keyboard activation is untested. Every other export path was exercised.
- Screen reader behaviour was not tested. I measured focus and keys only, so whether either overlay is announced at all is unknown, though neither carries `role="dialog"` or `aria-modal`.
- The degraded states named in SPEC.md (permission denied, no camera, no face, low frame rate, wrong landmark count) were not exercised for keyboard reachability; the fake device always grants permission and always succeeds. Repo state at the end: `git -C .../audit-fresh status --porcelain` printed nothing, the worktree is unmodified, and the scratchpad static server on port 4199 was stopped.

### A7 — the five degraded states SPEC.md promises, and hard constraint 7 (the demo must never crash the page). Driven against the real production build i

- A physically unplugged camera. I could only simulate revocation by calling track.stop() from the page. A real unplug may raise different events, though the absence of any track/readyState listener in src/ suggests the result is the same.
- Whether a genuine 468-landmark model file behaves identically to the 468 points I injected at the one bundle line that reads model output. The guard, message and downstream nulling are the app's own code and all fired, but I did not swap the .task file itself.
- Safari and WebKit. playwright.config.ts runs WebKit locally for videoFile.spec.ts and the project's own comments say Playwright's WebKit is not Safari; all of my driving was Chromium. The localStorage quota crash is most likely to bite in Safari, which has the smallest quota.
- Whether the watched low-fps clip producing only ONE feature record for a 3 s clip is general or specific to my MediaRecorder-generated WebM. The structural finding — that the refusal sentence exists only in the stepped branch, which returns at src/main.ts:838 — does not depend on the clip and is proven from the code.
- Interaction with the other auditor running in parallel. My static server on port 4188 was killed mid-run by another process and my scratchpad serve.mjs was overwritten; I moved to my own serve-a7.mjs on ports 4189/4191 and re-ran everything affected. No result in this report comes from the interrupted run.

### A8: text alternatives for every number shown as a graphic, plus screen-reader semantics

- Whether VoiceOver or NVDA actually speak the revealed role=alert. I verified the accessibility tree and its live properties in Chromium, not the speech; the reveal-a-prefilled-alert pattern is known to be browser and reader dependent.
- The heatmap and scanpath with real accumulated dwell. The fake camera stream has no face and test/fixtures/clip-60fps-60frames.mp4 is a face-free test pattern (test/fixtures/README.md), so the heatmap button never enabled on its own; I set disabled=false in the page to inspect the overlay DOM, which does not depend on the data.
- No axe-core, pa11y or any accessibility library is present in node_modules (checked by listing it) and per the hard rules I installed nothing. Every result above comes from hand-written DOM checks and CDP Accessibility.getFullAXTree run against a production build served from the scratchpad.
- Firefox and Safari behaviour for aria-label on a bare <canvas> with no role. Chromium exposed all three trace canvases with role Canvas and the label as the name; role="img" would be the more portable form but I could not test the other engines.
- The 468-landmark and low-frame-rate degraded states as rendered. They need a model swap or a loaded machine to reach, so I read their strings in source rather than observing them announced.

### Interface layer: structure and technical debt inside src/main.ts (checklist B2, DEBT). Read all 2,764 lines; built to /private/tmp/.../scratchpad/b2di

- Whether a failed model load actually produces the frame-rate refusal message end to end. I traced it through main.ts:876-878, 1563, 1542, 815-834 and core/fpsGate.ts:37-52 from source; I did not force loadLandmarker to throw and step a real clip.
- Whether an infinite clip duration is reachable with a real file. main.ts:716 explicitly handles `!Number.isFinite(clip.durationSeconds)`, so the code expects it, but I did not produce such a container to see "it runs at 0.0 frames per second" printed.
- Whether the un-aged last-blink carry (main.ts:2099, 2111) measurably shifts a score. I traced the fields into core/score.ts:137-158 but ran no session with a camera.
- Everything below src/main.ts:1563 was never executed in a browser. The build was served headless at localhost:4319 with no camera granted, so the landmarker branch, all measurement readouts and the overlays were verified by reading only. Note: another auditor's server is live on port 4199 and the browser tab was pulled there once mid-session; all DOM observations reported here were re-taken on my own bundle, confirmed by `location.href === "http://localhost:4319/"` and script `assets/index-DNpIyELs.js`.
- Whether the resize listener registered inside setState (main.ts:572) ever accumulates in practice. Identical (type, listener, capture) triples are deduped by the DOM spec and the same function reference is passed each time, so it should not, but I did not enumerate window listeners to prove it.

### docs/UI.md against the page that actually ships (interface layer)

- Rendering in the `running` state. The audit environment has no camera and no clip, so every claim in UI.md that begins "Visible only when running" was verified from src/main.ts's render() and processFrame rather than from a running page. The idle-state DOM was verified live.
- All pixel geometry, wrap counts and breakpoints. The browser pane reported `window.innerWidth` = 0 and zero-width bounding rects for every element, so UI.md's "wraps to two lines at 1512 px" (line 82), the 1000 px tier-2 breakpoint and the 1280 px column width could not be measured on screen. The CSS rules were read from src/main.ts:2322-2367 instead.
- The overlays while open. Both are `hidden` with empty textContent at idle, so the calibration dot's nine positions and the scanpath slider's visibility rule were checked in source (src/main.ts:920-1031, 1907) rather than observed.
- Whether any of these drifts was raised and consciously accepted in a place I did not read. I checked ROADMAP.md's ten amendments, the three ADRs in decisions/, README.md and CLAUDE.md; none mentions UI.md maintenance or the interface campaign. docs/log.md was not read in full.

### A7 — everything that can stop the page, beyond chunk 2 (crash paths, unhandled rejections, feature detection, model load, long-session memory)

- Whether MediaPipe's detectForVideo actually throws in the wild (GPU context loss, wasm trap, non-monotonic timestamp). I proved the loop dies on ANY throw, but could not force a genuine MediaPipe failure to confirm the trigger frequency.
- Long-session memory over hours. I verified boundedness by reading every buffer and its cap, not by running the page for hours.
- The raw-exception clipFailed message end to end. I traced the path (videoStepper.ts:303 -> main.ts:749 -> catch at 854 -> cameraState.ts:44) but had no clip file to make processFrame throw mid-run.
- localStorage disabled or quota-exceeded on the WRITE path inside processFrame (main.ts:1885, 1892) — chunk 2 owns that finding, so I only confirmed that Storage.prototype.setItem can be made to throw QuotaExceededError in the running page and did not re-derive the consequence.
- Whether the deployed GitHub Pages build differs from what I built from this worktree.
