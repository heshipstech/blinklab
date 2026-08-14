# Appendix: Chunk 2, all findings as produced

The complete, unedited output of the six Chunk 2 auditors and the
skeptics who tested them. `chunk-2-core-purity.md` is the write-up;
this file is the raw record behind it, kept so nothing is lost to a
summary.

Produced 10 August 2026.

---

## Verification key

- **SURVIVED** a skeptic told to refute it, severity as corrected.
- **REFUTED** as stated. The corrected statement is given.
- **UNTESTED**. No skeptic saw it. Treat as a lead, not a conclusion.

---

## All 42 findings

### C2-01. isFeatureRecord, the schema SPEC.md credits with refusing NaN, has no production caller

|                             |             |
| --------------------------- | ----------- |
| Constraint                  | D4          |
| Severity as filed           | high        |
| Verdict as filed            | violation   |
| Verification                | **REFUTED** |
| Severity after verification | **low**     |

**Evidence.** `grep -rn isFeatureRecord src/ test/ tools/ analysis/` returns only src/core/featureRecord.ts:70 (the definition) and test/core/featureRecord.test.ts. src/main.ts:72 imports assembleFeatureRecord only, which is `return {...fields}` (featureRecord.ts:42-44) and validates nothing.

**Detail.** SPEC.md:80 and the comment at csv.ts:59-65 both rest on "the FeatureRecord schema refuses them upstream", but nothing in the running app calls it, so a non-finite value reaches csvCell and is written as an empty field. analysis/blinklab/loader.py:133 reads an empty field as an honest null, so a broken computation becomes indistinguishable from "not measured" at both ends.

**Corrected statement.** isFeatureRecord is exercised only by its tests, and three comments read as if it runs in the export path

**Skeptic's reasoning.** The factual half checks out, the harm half does not. `grep -rn isFeatureRecord . --exclude-dir=node_modules` confirms only src/core/featureRecord.ts:70 plus test/core/featureRecord.test.ts and SPEC.md:16, and src/main.ts:72-73 imports only `assembleFeatureRecord` and the type. But the claimed consequence does not reproduce. I ran `npx tsx` against the repo's own gates with degenerate inputs: `measureFps([100,100,100])` and `measureFps([200,100])` both returned null (fps.ts:13-15 refuses `last <= first`), and `apertureMm` with all landmarks collapsed on one point returned null (aperture.ts:41 returns null when `widthPx` is not > 0). blinkRate.ts:39 refuses before observedMs can be 0, blinkShape.ts:60 refuses `dtS <= 0`, perclos.ts:92-97 refuses an empty window. Every numeric field feeding the record is null-gated at source, so "refuses them upstream" at SPEC.md:80 is substantively true of the pipeline even though the mechanism is the per-metric gates, not a validator call. The second-line guard the auditor says rests on a false premise is real and works: `csvCell(NaN)` and `csvCell(Infinity)` both returned `""` in the same run, and SPEC.md:80 documents that empty-field choice deliberately, including the tradeoff the auditor re-states as the defect. It is also accounted for in writing: issue #119 (increment 6.4) specifies isFeatureRecord as "the schema the 6.7 serializer and the 7.2 loader will both TRUST", with the check being "Schema test" — which exists and passes (`npx vitest run test/core/featureRecord.test.ts test/core/csv.test.ts`, 29 passed). The 7.2 loader is Python (analysis/blinklab/loader.py) and provably cannot call a TS function, which confirms "behind" was never claiming a call site. Finally there is no boundary where it could earn a call: nothing in src/ or tools/ parses a record from a file or network into TypeScript, so the only record producer is the compile-time-checked assembler. Residual truth is a documentation-precision nit, not a high-severity D4 dead-code violation: SPEC.md:16, featureRecord.ts:67 and csv.ts:59 read as if the schema runs in the pipeline when it is exercised only by tests. Wiring it in or deleting it changes zero observable behaviour.

### C2-02. apertureMm returns NaN instead of null when an eyelid landmark is non-finite, and the three detectors then record "eyes open"

|                             |              |
| --------------------------- | ------------ |
| Constraint                  | D4           |
| Severity as filed           | high         |
| Verdict as filed            | violation    |
| Verification                | **SURVIVED** |
| Severity after verification | **low**      |

**Evidence.** Ran vitest against the repo from the scratchpad: `apertureMm(face_with_NaN_at_index_160, MAP, RING, 640, 480) -> NaN` (aperturePx at aperture.ts:65-69 has no guard on its own result). Feeding that NaN on: `blinkStep -> eye:"open"`, `longClosureStep -> eye:"open"`, `perclosStep -> samples:[{closed:false}]`.

**Detail.** irisWidthPx correctly refuses NaN because `widthPx > 0` is false for NaN (aperture.ts:41), but aperturePx returns its mean chord unguarded, so a NaN eyelid point with an intact iris ring yields a NaN millimetre reading. blink.ts:59, longClosure.ts:79 and perclos.ts:76 all test `apertureMm < threshold`, which is false for NaN, so an unmeasurable frame is positively recorded as an open eye rather than skipped as a gap.

**Corrected statement.** No finiteness check at the landmark trust boundary: a non-finite eyelid point makes apertureMm and eyeAspectRatio return NaN instead of null, and the detectors then record "eyes open" (trigger unproven)

**Skeptic's reasoning.** Mechanism personally reproduced with tsx scripts importing the repo's own modules. With face[160]={x:NaN,y:0.48} and an intact iris ring: irisWidthPx=12.8, aperturePx=NaN, apertureMm=NaN (aperture.ts:65-69 returns the mean chord unguarded). Feeding that on gives blinkStep eye="open", longClosureStep eye="open", perclosStep samples=[{closed:false}]. Sharper than claimed: a NaN frame arriving mid-closure mints a FALSE BLINK, blinkStep(armedClosedState, 150, NaN, 5) -> count 1, lastBlinkDurationMs 50, where null correctly gives eye "unknown", count 0, duration null. Not covered in writing anywhere: no ADR (decisions/ has 3, unrelated), no open issue (checked all via gh issue list --state all), no ROADMAP amendment, no comment. SPEC.md:80 and csv.ts:59-62 both claim non-finite values are "refused by the FeatureRecord schema upstream", but isFeatureRecord is never called in src/, only in test/core/featureRecord.test.ts, so that written mitigation does not exist in the production path. Severity cut from high to low: the auditor proved the mechanism but gave no reachability evidence and I found none. The only runtime producer is result.faceLandmarks[0] straight from MediaPipe (main.ts:1593) with no arithmetic in between, and canvas.width/height cannot be NaN, so firing this needs the model to emit a PARTIALLY non-finite tensor (iris ring finite, an eyelid point not), since whole-tensor corruption already returns null. Never observed. The finding is also under-scoped: eyeAspectRatio (ear.ts:26) has the identical hole, NaN <= 0 is false, and I confirmed it returns NaN too, so the real defect is a missing finiteness check at the model trust boundary that landmarkGuard.ts:3-6 claims to defend but validates count only.

### C2-03. baselineStep reaches kind:"ready" with baselineMm NaN, and personalThresholdMm then returns NaN forever

|                             |             |
| --------------------------- | ----------- |
| Constraint                  | D4          |
| Severity as filed           | high        |
| Verdict as filed            | violation   |
| Verification                | **REFUTED** |
| Severity after verification | **low**     |

**Evidence.** Ran 400 baselineStep calls with NaN apertures: `all-NaN baseline state -> ready baselineMm=NaN`, `personalThresholdMm -> NaN`. One NaN in every ten samples produces the same result. percentile([NaN,NaN,NaN],90) returns NaN, and boundedBaseline's `wide === null` check (baseline.ts:81) does not catch it.

**Detail.** baseline.ts:51 accepts the candidate because `baselineMm !== null` is true for NaN, so the state freezes as ready with a NaN bar. Every later frame then evaluates `apertureMm < NaN` as false in blink.ts and longClosure.ts, so the session silently reports zero blinks and zero closures for the rest of its life — the project's own documented silent-success failure shape.

**Corrected statement.** baseline.ts does not refuse non-finite apertures, a latent gap with no reachable producer (the ratchet already rejects NaN once ready)

**Skeptic's reasoning.** The mechanism reproduces but the claimed impact does not. I ran a tsx script importing the real modules: percentile([NaN,NaN,NaN],90) returns NaN, and 400 NaN samples at 100ms steps do reach `ready baselineMm=NaN, threshold=NaN` (the auditor's earlier 33ms step never crosses BASELINE_LEARN_MS=30000, so the run only works at a longer step). Two claims fail. (1) "forever" is wrong: an already-ready baseline is immune. After a clean learn followed by 1000 consecutive NaN frames I got `ready baselineMm= 10 threshold= 5`, because the ratchet at baseline.ts:66 tests `candidate > baselineMm` and NaN > 10 is false. Poisoning is only possible inside the first 30-second learning window. (2) No input path produces NaN. The sole caller is src/main.ts:1917 with `stabilityMm`, the mean of two apertureMm results. Probing apertureMm directly, it emits NaN only when an eyelid landmark is non-finite while the iris ring is still finite (`eyelid-NaN apertureMm = NaN`, `iris-also-NaN apertureMm = null`, since irisWidthPx's `widthPx > 0` check at aperture.ts:40 already rejects NaN). Landmarks come only from the MediaPipe model via src/io/landmarker.ts; the only production JSON.parse calls are src/io/calibrationStore.ts:22,38 for calibration data, which never reaches baselineStep, and fixture landmark JSON lives only under test/. The auditor proved a property under synthetic input and then asserted a running-session consequence they never showed was reachable. The genuine residue is a hardening gap: the landmark trust boundary (validateLandmarkCount, count only) checks no finiteness, unlike frameClock.ts:51, featureRecord.ts:52 and csv.ts:66 which all refuse non-finite explicitly. That is worth a low-severity note, not high.

### C2-04. The app does make a third-party network call at runtime: MediaPipe POSTs telemetry to Google every 60 seconds

|                             |              |
| --------------------------- | ------------ |
| Constraint                  | A6-network   |
| Severity as filed           | high         |
| Verdict as filed            | violation    |
| Verification                | **SURVIVED** |
| Severity after verification | **high**     |

**Evidence.** Ran /private/tmp/.../scratchpad/probe.mjs: a headless chromium page that configures FaceLandmarker exactly as src/io/landmarker.ts does (local /public/mediapipe-wasm, local /public/models/face_landmarker.task, runningMode VIDEO, delegate GPU), runs 40 detections, then waits 70 s. Output: "TOTAL REQUESTS: 6 / EXTERNAL THIRD-PARTY REQUESTS: 1 / >>> POST https://odml.pa.googleapis.com/v1/log". Source: node_modules/@mediapipe/tasks-vision/vision_bundle.mjs offset ~52955-53413 (class Ch: `setInterval(()=>{this.flush()},6e4)`, POST to that URL with header x-goog-api-key read from the wasm export `_mediapipeLoggerGetEncodedApiKey`; records pushed on setGraph and on every finishProcessing). The endpoint also ships in the built bundle: `grep -rl odml.pa.googleapis dist/` → dist/assets/index-SyxepCYv.js.

**Detail.** The constraint "no third party network calls at runtime" is broken, not by project code but by the vendored dependency, and it is silent. MODEL_CARD.md:152 publicly states "There is no server component, no analytics and no telemetry" and ADR-0002 lists "zero runtime third party calls" as a consequence, so a published privacy claim is currently false. No video or landmark data is sent — the payload is a protobuf of usage statistics plus a baked-in Google API key — which is why this is high and not critical.

**Corrected statement.** The app does make a third-party network call at runtime: MediaPipe POSTs telemetry to Google 60 s after the landmarker is created, even with zero detections

**Skeptic's reasoning.** Independently reproduced with my own script (scratchpad/verify.mjs: node static server over the repo + headless Playwright chromium), and reproduced more strongly than claimed. Building a FaceLandmarker with exactly the options in src/io/landmarker.ts and running ZERO detections still produced: TOTAL REQUESTS 6, EXTERNAL 1, ">>> POST https://odml.pa.googleapis.com/v1/log", with response status 200 — so the call not only fires but is delivered, and it needs no detections at all, only graph construction. Mechanism verified at source in node_modules/@mediapipe/tasks-vision/vision_bundle.mjs v1.0.0: class Ch does setInterval(()=>{this.flush()},6e4) and POSTs to that URL with header x-goog-api-key; the logger Ph is constructed unconditionally at task creation ("t.m=new Ph(e,r,n)" at ~offset 66610) and iu.setGraph calls this.m?.xa(), which queues the first record. The api key export _mediapipeLoggerGetEncodedApiKey is present in all three locally served runtimes under public/mediapipe-wasm/. Every refutation angle failed: (1) not a misreading — decisions/ADR-0002-model-hosting.md:8 states the constraint behaviorally, "the running app makes no third party network calls, ever", and line 13 rejects the CDN option for that reason, so "it is only a dependency" does not excuse it; (2) not documented anywhere — grep for logger/logging/api key across all *.md, decisions/ and docs/ hits only AUDIT_PLAN.md:137 restating the constraint, and `gh issue list --state all --limit 200` (gh authenticated, 190+ issues) has no issue mentioning telemetry, network, privacy, odml, googleapis or third-party; (3) no mitigation — grep for Content-Security-Policy/connect-src outside node_modules and dist returns nothing and index.html has no CSP meta tag; (4) not a dead path — src/main.ts:875 calls loadLandmarker() from ensureLandmarker(), reached by the start-camera button and the video-file picker, the app's only two entry paths; (5) not local-only — .github/workflows/deploy.yml exists and the endpoint string is in the built bundle dist/assets/index-SyxepCYv.js. Severity high is correctly calibrated rather than inflated: no video, landmarks or measurements are transmitted (payload is a usage-statistics protobuf), so it is not critical, but README.md:478 and MODEL_CARD.md:152-153 tell users of a publicly deployed site "no analytics and no telemetry" and that is currently false, and the user's IP and User-Agent do reach Google. Repository untouched: git status --porcelain is empty.

### C2-05. Blocked site data makes the whole page render blank, with no message

|                             |              |
| --------------------------- | ------------ |
| Constraint                  | A6           |
| Severity as filed           | high         |
| Verdict as filed            | violation    |
| Verification                | **SURVIVED** |
| Severity after verification | **medium**   |

**Evidence.** src/io/calibrationStore.ts:17 and :33 call localStorage.getItem OUTSIDE the try block (the try only wraps JSON.parse), and src/main.ts:909 calls loadCalibrationProfile() at module top level. Ran /private/tmp/.../scratchpad/storagecrash.mjs against the prebuilt dist/ in chromium: baseline → "buttons rendered: 7, visible text length: 1256, uncaught page errors: []"; with localStorage.getItem throwing SecurityError (Chrome's "block all site data", Safari's equivalent, third-party embedding) → "buttons rendered: 0, visible text length: 0, uncaught page errors: [\"The operation is insecure.\"]".

**Detail.** A top-level throw aborts main.ts before any UI is created, so the user gets a white screen rather than a degraded app. The master prompt says the demo must never crash the page; this is the total case. A try/catch inside loadCalibrationProfile and loadCalibrationSamples returning null would fix it.

**Corrected statement.** A7: blocked site data or a sandboxed embed blanks the whole page, because loadCalibrationProfile reads localStorage outside its try at module top level

**Skeptic's reasoning.** Confirmed independently, twice. calibrationStore.ts:17 and :33 read localStorage outside the try (the try only wraps JSON.parse), and main.ts:909 calls loadCalibrationProfile() at module top level while the only DOM attach is app.append() at main.ts:2744 into an empty <div id="app">, so the throw aborts before any UI exists. I built fresh from source (npx vite build --outDir <scratchpad>/distfresh --emptyOutDir --base ./) and ran my own Playwright script: baseline buttons=7 textLen=1251 pageErrors=[]; with localStorage throwing, buttons=0 textLen=0 pageErrors=["The operation is insecure."]. Because a stub is weak evidence I re-ran with NO monkeypatching, using real Chromium enforcement via <iframe sandbox="allow-scripts"> with CORS headers so the module script loads: PAGEERROR SecurityError "Failed to read the 'localStorage' property from 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag", buttons=0 textLen=0, against a plain-iframe control of buttons=7 textLen=1251. Not accounted for in writing: grepped SPEC.md, ROADMAP.md (all 10 amendments), STATE.md, ARCHITECTURE.md, PROJECT.md, README.md, decisions/ (ADR-0001..0003) and docs/log.md for storage, private browsing, site data, iframe and known limitations with zero hits; no code comment mentions it; gh issue list shows 7 open issues, none related; and no test touches io at all (find test -iname "_calibrationStore_" -o -iname "_storage_" returns nothing). SPEC.md:119 says unconditionally "The page never crashes and never shows stale numbers", so this is a genuine violation. Two corrections. The constraint id is wrong: AUDIT_PLAN.md:137 defines A6 as no secrets/API keys/third-party network calls; the constraint actually broken is A7 at AUDIT_PLAN.md:140, "The demo must never crash the page." And the severity is inflated: the trigger is a non-default browser configuration (Chrome/Brave block-all-site-data) or a sandboxed embed the project never claims to support, there is no data loss or security impact, every documented degraded state still works, and the fix is two lines, so total impact at low likelihood lands at medium, not high.

### C2-06. videoStepper computes the clip's published frame rate — measurement logic in the impure edge, with no unit test

|                             |             |
| --------------------------- | ----------- |
| Constraint                  | A4          |
| Severity as filed           | high        |
| Verdict as filed            | violation   |
| Verification                | **REFUTED** |
| Severity after verification | **low**     |

**Evidence.** src/io/videoStepper.ts:152-211 (measureFrameInterval); the pure part is :185-210, which turns a list of observed media times into gaps, takes Math.min (:204), and range-checks it (:207). Its result is published verbatim: src/main.ts:782 renders `${(1 / summary.frameIntervalSeconds).toFixed(1)} frames per second`. `grep -rn "src/io" test/` returns nothing — no unit test imports any io module. core/fps.ts already holds the equivalent pure estimator (measureFps, tested).

**Detail.** A function that takes numbers and returns a published number lives in a browser-only module, which is exactly the rule the master prompt calls the most important. The file's own comments record three separate times this arithmetic shipped wrong (60 frames read as 180, as 27, and a 15,784-frame clip doubled), and `git log -- src/io` shows fixes #154, #156, #169 for them — every one is a case a pure `smallestGapSeconds(timesSeconds): number | null` in core would have caught in milliseconds.

**Corrected statement.** videoStepper's 10-line min-gap reduction could be extracted to core for unit tests, but it is not landmark measurement logic and is covered by a cross-browser frame-count regression test

**Skeptic's reasoning.** Anchors check out (videoStepper.ts:185-210, Math.min at :204, main.ts:782, and `grep -rn "src/io" test/` exits 1), but the finding's load-bearing claims fail. (1) The proposed remedy is wrong: core/fps.ts measureFps is an AVERAGE estimator ((n-1)*1000/(last-first)) over wall-clock timestamps, not "the equivalent" of a MIN-gap estimator over media times; the file's comment records that the averaging family was tried and produced the 60-measured-as-27 bug. (2) The bug history is misattributed. I copied the pure block verbatim into scratchpad/gap.mjs and ran the three scenarios: for #154 "60 read as 180" the pure block returns a healthy 250.0 fps (the bug was the sampler collecting requested times; `git show c944366` shows the fix was adding `exact: boolean` and `if (!landing.exact)`); for #169 "15,784 doubled" the pure block CORRECTLY returned null (`git show 42fc8d9` shows the fix was CALIBRATION_ATTEMPTS 16->60 and step 4ms->10ms plus refusing instead of guessing 60 — the arithmetic was never wrong); and #156 "last frame twice" is entirely inside stepThroughVideo near :237 per `git show 1de3ae4 -- src/io/videoStepper.ts`, a different function. Only the median->min change touched this block, and scratchpad/median.mjs shows min is itself wrong on 32/243 skip patterns, so extraction would not make it provable in isolation — its correctness depends on sampler behaviour, which is the impure part. (3) "No unit test" misstates the risk: test/e2e/videoFile.spec.ts:130-165 is the labelled regression test asserting 60 +/- 1 frames on a committed 60fps/60-frame fixture, and since `const step = interval;` (videoStepper.ts:243) a wrong interval doubles or halves that count — the exact #169 symptom; playwright.config.ts:51 runs this spec under WebKit too with a dated written justification for local-only. (4) The master prompt rule is scoped to "any function that takes landmarks and returns a number"; measureFrameInterval takes a VideoWithFrameCallback, seeks it, and awaits frame callbacks, which is squarely "src/io: the impure edge". The residual — extracting a 10-line smallestGapSeconds into core for cheap unit tests — is a legitimate nice-to-have refactor, not a high-severity A4 violation.

### C2-07. Any throw inside a frame handler kills the display loop permanently, and calibrationStore's writes are unguarded

|                             |              |
| --------------------------- | ------------ |
| Constraint                  | A6           |
| Severity as filed           | high         |
| Verdict as filed            | violation    |
| Verification                | **SURVIVED** |
| Severity after verification | **medium**   |

**Evidence.** src/io/frameLoop.ts:2-5 re-schedules only after onFrame returns (`onFrame(nowMs); requestAnimationFrame(tick);`). Ran /private/tmp/.../scratchpad/loop.test.ts: pumped 10 stubbed frames with onFrame throwing once on tick 3 → "ticks delivered: 3, frames still queued: 0". The reachable throw: src/io/calibrationStore.ts:13 and :29 call localStorage.setItem with no guard, and src/main.ts:1885/1892 call them from inside processFrame (defined at main.ts:1533), which the loop callback at main.ts:2762 invokes directly. Confirmed setItem throws through: store.test.ts printed "SAVE under quota exceeded threw: QuotaExceededError: quota".

**Detail.** On a browser whose storage quota is full, finishing a calibration throws out of processFrame and the camera view freezes forever with nothing on screen explaining it — a silent stop, which this project has repeatedly identified as its worst failure mode. Wrapping tick's onFrame call in try/catch, and the two setItem calls, would contain it.

**Corrected statement.** A7, not A6: any uncaught throw in processFrame stops the app's only frame loop for good, and neither MediaPipe's detectForVideo nor calibrationStore's setItem calls are guarded

**Skeptic's reasoning.** Mechanism, reachability and silence all reproduce, but the constraint label and the severity are both wrong. VERIFIED: src/io/frameLoop.ts:2-5 re-schedules only after onFrame returns; my own scratch test (scratchpad/sk/loop.test.ts, `npx vitest run --config .../sk/vitest.config.ts`) queued stubbed rAF callbacks and threw on tick 3, asserting ticks===3 and queue.length===0 — passed. It is the app's only rAF (grep -rn requestAnimationFrame src/ hits frameLoop.ts alone). processFrame spans src/main.ts:1533-2265 with ZERO try/catch in it (awk over that range returns nothing), contains the two bare localStorage.setItem calls via src/io/calibrationStore.ts:13 and :29, and is invoked directly by the loop callback at main.ts:2762. Consequence confirmed at main.ts:296-299 and :1561 — the video element never joins the page, the canvas is repainted per frame, so a dead loop freezes the image with the calibration overlay up and no message. Undocumented: no hit for localStorage|quota|storage in SPEC.md, ROADMAP.md, ARCHITECTURE.md, STATE.md, docs/log.md or decisions/; SPEC.md:119 promises "the page never crashes" and its state table omits storage; test/ has no io directory at all. WHERE THE AUDITOR IS WRONG: (1) A6 (AUDIT_PLAN.md:137) is secrets, API keys and third-party network calls — this is A7. (2) Their proof that setItem throws was a stub that throws by construction, which is circular. I measured the real exposure instead: driving the repo's own captureStep to completion (9 targets x 30 samples, full float precision) writes 18,433 bytes, about 0.4% of a typical 5 MB quota, so the app cannot exhaust its own storage and the throw needs an externally full origin. The page does not crash either: DOM handlers stay bound, no wrong number is produced, a reload recovers. What keeps the finding alive is not localStorage but that the same unguarded handler wraps the third-party WASM call landmarker.detectForVideo at main.ts:1569 — a far likelier thrower with the same silent permanent stop. Medium, not high.

### C2-08. BLINK_CSV_COLUMNS has no guard at all; the blink log can go ragged in silence

|                             |             |
| --------------------------- | ----------- |
| Constraint                  | A4          |
| Severity as filed           | high        |
| Verdict as filed            | violation   |
| Verification                | **REFUTED** |
| Severity after verification | **low**     |

**Evidence.** In a scratch copy I added an 8th name "closingDurationMs" to BLINK_CSV_COLUMNS (src/core/blinkLog.ts:62-70) and touched nothing else. `npx tsc --noEmit` printed no errors and `npx vitest run test/core/blinkLog.test.ts` passed 19/19. A forced probe then showed header = "startFrame,endFrame,atMs,durationMs,amplitudeMm,peakClosingVelocityMmPerS,amplitudeOverVelocityMs,closingDurationMs" (8 cells) against row "10,17,1000,120,,," (7 cells).

**Detail.** CSV_COLUMNS carries `as const satisfies readonly (keyof FeatureRecord)[]` plus the EveryFieldHasAColumn compile assert; BLINK_CSV_COLUMNS carries only `as const` and the row writer at blinkLog.ts:107-117 is a hand-written 7-element literal with no link to it. The tests cannot catch drift because blinkLog.test.ts:182 derives the expected header from the constant itself while :183 hard-codes the row, so both move independently.

**Corrected statement.** Blink CSV header/row drift is not caught in TypeScript, but the Python reader refuses it loudly and that guard is tested

**Skeptic's reasoning.** The mechanism reproduces but the headline claim ("in silence", high, A4) does not survive.

WHAT I CONFIRMED. I copied src/test/configs to scratch, symlinked node_modules, and added the same 8th name "closingDurationMs" to BLINK_CSV_COLUMNS (src/core/blinkLog.ts:62-70). `npx tsc --noEmit` exited 0, and I ran the FULL suite, not one file: `npx vitest run` gave "Test Files 49 passed (49) / Tests 473 passed (473)". A tsx probe printed line0 cells=8 vs line1 cells=7 ("10,17,1000,120,,,"). So the TypeScript layer genuinely has no link between the constant and the hand-written 7-element row at blinkLog.ts:117-125, and blinkLog.test.ts:182-183 does derive the header from the constant while hard-coding the row. That part is accurate.

WHY IT IS STILL REFUTED.

1. It is not silent. The only consumer of these files guards the contract twice. <repo>/.claude/worktrees/audit-fresh/analysis/blinklab/blink_log.py:20-28 mirrors the list under the comment "The contract from src/core/blinkLog.ts, in the order it is written"; :108-113 raises on a header mismatch and :116-121 raises on a field-count mismatch. I fed my exact ragged file to the real `load_blink_log` and got: "ragged.csv: columns are [...8 names...], expected [...7 names...]. The browser's blink log contract has changed, or this is a different file." I also tested the opposite drift (extra cell, unchanged header) and got "ragged2.csv row 2: 8 fields, expected 7". Both directions refuse loudly, and the header guard is itself under test at analysis/tests/test_blink_log.py:75 (`test_changed_columns`). Given this project's stated allergy to silent success, "no guard at all" is the wrong description; the guard sits one layer downstream and fires at file-read time.

2. Wrong constraint. A4 (AUDIT_PLAN.md:132-136) is "Pure logic testable with no camera... must be pure and import nothing from the browser." blinkLog.ts imports only ./blinkShape (type), ./constants and ./ringBuffer, touches no browser global, and its 19 tests run with no camera. A missing compile-time cardinality assert is not an A4 matter.

3. Already on the record. AUDIT_PLAN.md:472-474, item 44, under the heading "Smaller signals": "Two independent comma-separated-value column lists exist, `CSV_COLUMNS` and `BLINK_CSV_COLUMNS`. Whether they stay consistent is unverified." The project wrote the concern down and pre-classified it as small.

4. Severity. Nothing is broken today (7 columns, 7 cells, verified). The defect requires a future edit that skips a writer sitting 45 lines below the constant, and that edit is caught before any number is computed. Also worth noting for fairness: csv.ts can use `satisfies readonly (keyof FeatureRecord)[]` because one type backs every column, while the blink row flattens BlinkEvent plus BlinkShape, so the same trick is not directly available. The residual real gap is one missing assertion (row cell count === BLINK_CSV_COLUMNS.length) that would move detection from analysis time to test time. That is low, not high.

Repo untouched: `git status --porcelain` empty; all edits were in the scratchpad copy.

### C2-09. Unvalidated `as` at the localStorage boundary crashes core and puts strings into a number field

|                   |              |
| ----------------- | ------------ |
| Constraint        | A4           |
| Severity as filed | high         |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** src/io/calibrationStore.ts:22 `JSON.parse(raw) as CompletedTarget[]` and :38 `JSON.parse(raw) as CalibrationProfile`. Ran against the repo's own core: a stored profile missing `vertical` throws `TypeError: Cannot read properties of undefined (reading 'slope')` at src/core/calibrationProfile.ts:103. With string slopes, calibratedPoint returned `{x: "-0.20.5", y: "-0.20.5"}`, calibratedQuadrant answered "bottom right", and heatmap.accumulate wrote a stray "NaN" key into `cells`.

**Detail.** FeatureRecord has isFeatureRecord as its runtime schema; CalibrationProfile and CompletedTarget have no equivalent, so a stale or hand-edited localStorage value enters core typed but unchecked. ScreenPoint declares `x: number` and receives a string, which breaks SPEC's "the page never crashes" and "null over guessing" at the same time.

### C2-10. The lint gate does not enforce the purity rule it is credited with; it catches 1 of 7 impurities I fed it

|                   |              |
| ----------------- | ------------ |
| Constraint        | B3           |
| Severity as filed | medium       |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** Ran: `printf '...Date.now();performance.now();Math.random();localStorage.length;fetch;requestAnimationFrame;console.log(...);document.title="x"...' | npx eslint --stdin --stdin-filename src/core/__probe.ts`. Output: exactly one error, `12:3 Unexpected use of 'document'`. Date.now, performance.now, Math.random, localStorage, fetch, requestAnimationFrame and console all passed clean. eslint.config.js:41-52 names only window, document, navigator. (No file was written; `ls src/core/__probe.ts` → No such file.)

**Detail.** The master prompt says time must always arrive as a parameter and core must touch no browser globals, and the project presents the ESLint rule as the enforcement. A `Date.now()` or a `performance.now()` inside core would ship without a single complaint from lint, typecheck or CI. Adding Date, performance, localStorage, fetch, requestAnimationFrame, console to the existing no-restricted-globals list, plus a no-restricted-properties entry for Math.random, closes it in one edit. Today core is clean in fact, so this is a gate weakness rather than a defect.

### C2-11. eulerFromMatrix returns a NaN head pose and poseValidity declares it valid

|                   |              |
| ----------------- | ------------ |
| Constraint        | D4           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** `eulerFromMatrix([...15 zeros with NaN at index 6])` returned `{pitchDeg:NaN, yawDeg:0, rollDeg:0}`; an all-NaN matrix returned all three NaN. `poseValidity(thatPose)` returned `{kind:"valid"}` and `poseValidityMessage` returned "" in both cases.

**Detail.** The gimbal-lock refusal at headPose.ts:31 tests `Math.abs(Math.cos(pitch)) < 1e-6`, which is false for NaN, and validityGate.ts:31 tests `Math.abs(valueDeg) > limitDeg`, also false for NaN. The one module whose stated job is to refuse untrustworthy poses ("a guess wearing a number's clothes", validityGate.ts:5-6) therefore fails open on the least trustworthy input there is.

### C2-12. analyzeClosing returns a BlinkShape with NaN velocity, and scoreRecords then returns score: NaN marked available: true

|                   |              |
| ----------------- | ------------ |
| Constraint        | D4           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** `analyzeClosing([{0,8},{33,NaN},{66,2}])` returned `amplitudeMm=6 peakClosingVelocityMmPerS=NaN amplitudeOverVelocityMs=NaN`. Feeding that into scoreRecords gave `score = NaN` with contribution `sluggish lids=NaN/true`, and panelSummary said "Top drivers of the score:" with no mention that anything was broken.

**Detail.** blinkShape.ts:65 guards with `peakMmPerS <= 0` and score.ts:153 with `lastBlinkPeakVelocityMmPerS <= 0`; both are false for NaN. scoreRecords is declared ScoreBreakdown | null, so a NaN score is neither the number nor the refusal, and the contribution is flagged available:true, which is an explicit claim that the signal was trustworthy.

### C2-13. solveCalibration returns a profile of NaN coefficients, and calibratedQuadrant names a confident quadrant from it

|                   |              |
| ----------------- | ------------ |
| Constraint        | D4           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** `solveCalibration(nine targets whose samples are all NaN)` returned `{horizontal:{slope:NaN,intercept:NaN}, vertical:{...}}` rather than null. `calibratedPoint` on it gave `{x:NaN,y:NaN}` and `calibratedQuadrant` on that returned "bottom right". Separately, `irisOffset` with a NaN iris-centre landmark returned `{horizontal:NaN, vertical:NaN}`, and `screenQuadrant` on it returned "top right".

**Detail.** fitLine's refusal at calibrationProfile.ts:54 tests `spread <= 0`, false for NaN, so the least-squares fit publishes NaN/NaN as a slope. calibratedQuadrant (calibrationProfile.ts:111-112) and screenQuadrant (gazeQuadrant.ts:41-42) both use `<=` / `>=` comparisons that fall through to a named quadrant, so an unmeasurable gaze is reported as a definite screen region.

### C2-14. demoNoticeShort() and DEMO_NOTICE_SHORT are dead: nothing renders the short caveat, though docs/UI.md says it does

|                   |              |
| ----------------- | ------------ |
| Constraint        | A5           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** src/core/notice.ts:28,31. AST import scan: only importer is test/core/notice.test.ts. `grep -rn 'demoNoticeShort\|DEMO_NOTICE_SHORT' src/` returns only the declaration; main.ts:78 imports demoNoticeText only. `grep -n 'not a safety|Not diagnostic' src/main.ts` returns nothing. docs/UI.md:191 documents "Caveat, from `demoNoticeShort()`" beside the score. main.ts:2358 defines a `.caveat` CSS rule and no element ever gets that class.

**Detail.** A tested constant plus its accessor exist solely for a UI element that is not built. The long notice (demoNoticeText) is rendered at main.ts:177, so the page is not missing its disclaimer, but the documented short caveat beside the score is absent and the code supporting it is dead.

### C2-15. loadCalibrationSamples() in src/io is referenced by nothing, anywhere

|                   |              |
| ----------------- | ------------ |
| Constraint        | A5           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** src/io/calibrationStore.ts:16-26. `grep -rn 'loadCalibrationSamples' --include=*.ts --include=*.md --include=*.html .` (excluding node_modules and dist) returns exactly one hit, the declaration itself. Confirmed tree-shaken: in dist/assets/index-SyxepCYv.js the samples key `blinklab-calibration-samples-v1` appears once and only a setItem wrapper survives beside it (`function cn(e){localStorage.setItem(on,JSON.stringify(e))}`); no getItem for that key exists.

**Detail.** Eleven lines including a JSON.parse and a catch, the only fully unreferenced export of the 250 in src/core and src/io. Its partner saveCalibrationSamples is called at main.ts:1885, so samples are written to localStorage and never read back. No decision record, ROADMAP amendment or comment explains it.

### C2-16. isFeatureRecord(), the 31-line runtime schema, has no production caller

|                   |              |
| ----------------- | ------------ |
| Constraint        | A5           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** src/core/featureRecord.ts:70-100. Only importer is test/core/featureRecord.test.ts; own-file occurrence count is 1 (declaration only). main.ts has no record-loading path: `grep -n 'JSON.parse|FileReader|loadRecords|importRecords' src/main.ts` returns only main.ts:489, the fixture download.

**Detail.** The comment at featureRecord.ts:67 claims it sits behind "the 6.7 serializer and the 7.2 loader", and SPEC.md:16 repeats that. ROADMAP.md:106 shows 7.2 was delivered as a Python CSV loader, so no TypeScript caller was ever created. Written intent exists, which softens this, but the code is unreached on main and the comment is now inaccurate.

### C2-17. SPEC.md's stated justification for skipping src/ui is factually false today

|                   |              |
| ----------------- | ------------ |
| Constraint        | B2           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** SPEC.md:11 claims "every string it renders that carries meaning is produced by a tested pure function in core". Ran `grep -c "no valid measurement" src/main.ts` -> 22; same grep over src/core -> 0. Inline meaning-carrying readouts at src/main.ts:1556, 1615, 1629, 1654, 1692, 1927, 1965, 2091, 2197.

**Detail.** About 16 of the page's readouts are formatted inline in main.ts with units and values ("Eyelid aperture, right: 4.3 mm", "PERCLOS (eyes closed share, last 60 s): 12.4%"), while roughly 8 come from core. The deviation from the master prompt's layout is documented, but the reason given for it does not hold, so the rule that was supposed to survive the missing src/ui is only followed for about a third of the UI text.

### C2-18. The renderer computes the aperture measurement that everything downstream uses

|                   |              |
| ----------------- | ------------ |
| Constraint        | B2           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** src/main.ts:1631-1634 (meanEar), src/main.ts:1669-1672 (stabilityPx, stabilityMm). stabilityMm is then fed to baseline/blink/PERCLOS/score/CSV at src/main.ts:1920, 1938, 2025, 2083, 2106. core already has the identical combiner for the other signal at src/core/gazeQuadrant.ts:17 meanIrisOffset.

**Detail.** Combining the two eyes into one number is measurement, not rendering, and SPEC.md:11's fallback promise is "the renderer never computes a measurement". The logic is one line and its null rule matches meanIrisOffset, so it is very likely correct, but it is the most load-bearing value in the app and it has no unit test because it lives in the one file that has none.

### C2-19. A pure decision rule is trapped inside io and cannot be unit tested

|                   |              |
| ----------------- | ------------ |
| Constraint        | B2           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** src/io/videoStepper.ts:185-209: measureFrameInterval picks the SMALLEST gap between probed frame times and clamps it to 0.001-1 s. Function is not exported, is async, and takes a VideoWithFrameCallback. `grep -rln "src/io\|/io/" test` returns nothing: no unit test imports src/io.

**Detail.** The seek loop genuinely belongs in io, but the gap-selection rule is pure arithmetic over a number array and is exactly the kind of function the master prompt says must be testable with no camera. Its own comments record two past bugs in this rule (median gave 27 for a 60-frame clip on WebKit; a 60 fps fallback double-counted a 15,784 frame recording), which is the strongest possible argument for extracting it.

### C2-20. drawFittedCircle computes a measurement in io and its docstring wrongly claims it equals the core ruler

|                   |              |
| ----------------- | ------------ |
| Constraint        | A4           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** src/io/videoCanvas.ts:86-91 averages the distance to all four iris ring points; the docstring at :66-74 says the radius "is the same average the millimetre conversion is built on... the circle drawn here is literally the measurement". It is not: src/core/aperture.ts:26-41 (irisWidthPx) deliberately uses only the horizontal chord, ring[0] to ring[2], "because the vertical pair would be occluded by the lids exactly when it matters most, mid blink". Ran /private/tmp/.../scratchpad/circle.test.ts importing both real modules: "open: core irisWidthPx=40.00 px, drawn circle diameter=40.00 px" / "mid-blink: core irisWidthPx=40.00 px, drawn circle diameter=28.00 px". main.ts:1744-1750 passes the full four-point ring.

**Detail.** Measurement arithmetic sits in io, and it is a second, different formula from the one the millimetre conversion uses. The drawn circle shrinks 30% mid-blink while the ruler does not, so the overlay contradicts the instrument precisely during the event being measured, and a comment asserts they agree.

### C2-21. Calibration loaders return unvalidated JSON typed as domain objects — guessing where null was required

|                   |              |
| ----------------- | ------------ |
| Constraint        | A4           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** src/io/calibrationStore.ts:22 and :38 do `JSON.parse(raw) as CompletedTarget[]` / `as CalibrationProfile` with no shape check. Ran /private/tmp/.../scratchpad/store.test.ts: with stored value '"a string, not an array"' → "samples loaded as: string \"a string, not an array\"" from a function whose type says CompletedTarget[] | null; with a partial older-schema profile '{"gainX":1}' → "older-schema profile loaded as: {\"gainX\":1}", returned as a valid CalibrationProfile.

**Detail.** The keys are versioned (-v1), so a deliberate schema bump is handled, but a partially written or hand-edited entry is not. main.ts:909 assigns the result straight to calibrationProfile and main.ts:1219 feeds it to calibratedPoint, so a missing field becomes NaN gaze rather than the null the rule requires. A field check returning null on mismatch is the fix.

### C2-22. A contribution can be fractional, breaking the stated integer half of the score contract

|                   |              |
| ----------------- | ------------ |
| Constraint        | A4           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** Ran scoreRecords against the repo's core with longClosureCount going 0 -> 0.5 across the window: isFeatureRecord returned true, points were [0, 7.5, 0, 0] and score was 92.5. src/core/featureRecord.ts:92-95 requires only finite and >= 0; src/core/score.ts:124-133 multiplies the delta by LONG_CLOSURE_PENALTY_EACH with no rounding. `grep -rn isInteger src test` finds only src/core/kss.ts:38.

**Detail.** SPEC.md states `points: number; // whole points, never fractional` and "every contribution is an integer". The four ramp penalties are safe because rampPoints ends in Math.round, but the closure penalty is the one arithmetic path with no rounding and no integer check upstream. Not reachable from the live wiring (main.ts:2116 feeds an integer counter), only from the loader path SPEC assigns to isFeatureRecord.

### C2-23. Two `as ScreenQuadrant` casts that are unnecessary and provably hide a wrong value

|                   |              |
| ----------------- | ------------ |
| Constraint        | A4           |
| Severity as filed | medium       |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** src/core/gazeQuadrant.ts:43 and src/core/calibrationProfile.ts:113. Removing both casts in a scratch copy: `npx tsc --noEmit` exit 0, so they buy nothing. Putting the cast back and changing gazeQuadrant.ts:42 to `const band: string = offset.vertical >= 0 ? "bottom" : "middle";` also compiled with zero tsc errors; only the runtime suite noticed (2 of 8 gazeQuadrant tests failed).

**Detail.** TypeScript already infers the template literal union exactly, so each cast is pure suppression sitting on the one line where the union is constructed. Both are in the gaze-quadrant path, which is where a silently wrong literal would be hardest to notice.

### C2-24. Every module-scope object in core is a live mutable singleton, and three of them are the reset seeds for main.ts

|                   |              |
| ----------------- | ------------ |
| Constraint        | A4           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** Ran a node probe importing the modules through a TS loader: `Object.isFrozen(initialBlinkState)` false, `initialAlertState` false, `initialLongClosureState` false, `POSE_LIMITS` false, `RIGHT_EYE_INDICES` false. Then `blink.initialBlinkState.blinkCount = 99` succeeded and printed 99. Declared at blink.ts:39, alert.ts:25, longClosure.ts:53, constants.ts:163/170. Consumed as reset seeds at main.ts:591, 593, 608 and as initial values at main.ts:1228, 1239, 1266.

**Detail.** `readonly` and `as const` are compile-time only and vanish at runtime. Nothing mutates these today (proven below), so there is no current bug, but one stray `state.blinkCount++` anywhere would silently poison every later `resetSession()` and the failure would look like a counting bug, not a shared-state bug. `Object.freeze` on the five declarations would make that stray write throw at the moment it happens.

### C2-25. One exported core function is never called by any test: baseline.ts learningSecondsLeft

|                   |              |
| ----------------- | ------------ |
| Constraint        | A4           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** Instrumented every exported core function to log its first invocation to a file and ran the suite: 103 of 104 reached, the miss being `baseline.ts:learningSecondsLeft` (src/core/baseline.ts:92). It is live code, called at src/main.ts:1923. I called it directly with a frozen state: `learningSecondsLeft({kind:'learning',startedAtMs:1000}, 6000)` → 25 on both calls; non-learning state → null.

**Detail.** The function is pure and honours the null contract, so this is not an impurity. It is a coverage gap: the only piece of core arithmetic whose purity rests on my reading plus one manual call rather than on the project's own tests. Flagging it for the test chunk rather than as an architecture break.

### C2-26. Six functions declared `number | null` return NaN or Infinity on poisoned input

|                   |              |
| ----------------- | ------------ |
| Constraint        | D4           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** `measureFps([NaN,NaN]) -> NaN` (fps.ts:15, `last <= first` false for NaN); `mean([NaN]) -> NaN`, `mean([1,Infinity]) -> Infinity`, `standardDeviation([Infinity,1]) -> NaN` (statistics.ts:13,25); `meanDurationMs([NaN]) -> NaN` (timing.ts:20); `dispersionOffset` with one NaN sample -> NaN (fixation.ts:46); `smoothingFactor(1, NaN) -> NaN` (gazeSmoothing.ts:28-31).

**Detail.** Each of these is a defence-in-depth layer rather than a first line, and each is fed by a caller that mostly guards already, so the practical impact is small. Also in this class: `percentile([1,2], -50)` returns 1 rather than null, because Math.max(1, ceil(-1)) clamps a nonsense percentile to the minimum (statistics.ts:38).

### C2-27. headPose.ts `?? 0` plus no orthonormality check makes a degenerate matrix read as "facing straight ahead"

|                   |              |
| ----------------- | ------------ |
| Constraint        | D4           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** `eulerFromMatrix(new Array(16).fill(0))` returned `{pitchDeg:0, yawDeg:0, rollDeg:0}` and `poseValidity` on it returned `{kind:"valid"}`. A sparse `new Array(16)` (length 16, all holes) gave the identical result via the `data[row * 4 + col] ?? 0` at headPose.ts:22.

**Detail.** This is the one `?? 0` in core that converts a refusal into a claim: the length check at headPose.ts:19 passes, the missing entries become zeros, and atan2(0,0) is 0, so a matrix that is not a rotation at all reports a head aimed dead at the camera. The other six `?? 0` sites in core are legitimate and are listed as compliant.

### C2-28. sparklineSegments emits NaN coordinates when valueMax or windowMs is zero

|                   |              |
| ----------------- | ------------ |
| Constraint        | D4           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** `sparklineSegments([{timestampMs:100,value:5}], 100, 1000, 300, 60, 0)` returned `[[{x:300, y:NaN}]]`; with windowMs 0 it returned `[[{x:NaN, y:30}]]`. Denominators at sparkline.ts:75-76 are unguarded.

**Detail.** These are drawing coordinates rather than measured values, and every call site in main.ts passes a module constant, so this is a latent hazard rather than a live defect. Listed because it is the only remaining unguarded denominator in core.

### C2-29. isKssRating() validates input the app never receives

|                   |              |
| ----------------- | ------------ |
| Constraint        | A5           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** src/core/kss.ts:35-42. Only importer is test/core/kss.test.ts; own-file occurrence count is 1. In main.ts the rating only ever comes from buttons generated from KSS_SCALE (main.ts:1304-1320) and is already typed KssRating, so no unknown value is ever narrowed.

**Detail.** An eight-line `value is KssRating` guard with tests and no caller. It would earn its place if a saved session were ever parsed back, but nothing parses one.

### C2-30. StepSummary.lastMediaTimeSeconds is written at every return and read by no consumer

|                   |              |
| ----------------- | ------------ |
| Constraint        | A5           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** src/io/videoStepper.ts:32 declares it; it is populated at lines 237, 264 and 310. `grep -rn 'lastMediaTimeSeconds' src test tools` shows no read outside videoStepper.ts, and main.ts reads only summary.frameIntervalSeconds, summary.framesMeasured and summary.stoppedEarly (main.ts:780-835). It is the only never-read field out of 186 object fields declared in src/core and src/io (AST scan).

**Detail.** The local variable of the same name is genuinely used for the duplicate-frame check at lines 297-304, so only the returned field is dead. A field on a public result type that nothing consumes.

### C2-31. Two `!== null` guards that the compiler already proves true (blink.ts:93, longClosure.ts:117)

|                   |              |
| ----------------- | ------------ |
| Constraint        | A5           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** Type-aware ESLint (scratchpad config, @typescript-eslint/no-unnecessary-condition against the repo tsconfig) reports "Unnecessary conditional, the types have no overlap" at src/core/blink.ts:93 and src/core/longClosure.ts:117. Proof by execution on a copy: I mirrored src/ and test/ into the scratchpad, removed both `&& closedDurationMs !== null` clauses, and `npx tsc --noEmit` exited 0 and `npx vitest run test/core/blink.test.ts test/core/longClosure.test.ts` passed 46 of 46.

**Detail.** `completedBlink` already implies `closedDurationMs !== null` through `shapedLikeABlink` (blink.ts:74-76), and both disjuncts of `completedLong` require it (longClosure.ts:104-110). TypeScript's aliased-condition narrowing carries that through, so the second guard is the checklist's "second guard that repeats the first" and can never be false.

### C2-32. A user-facing string is duplicated between core and the renderer

|                   |              |
| ----------------- | ------------ |
| Constraint        | B2           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** src/core/scorePanel.ts:61 returns "Nothing is costing points."; src/main.ts:2660 hardcodes the same literal as the idle text. Only the core copy is asserted (test/core/scorePanel.test.ts:166).

**Detail.** Reword the core sentence and the idle panel silently disagrees with the running panel, with no failing test. This is precisely the drift that src/core/notice.ts:6-9 argues against in its own comment, so the project already holds the principle and broke it here.

### C2-33. Four core modules are presentation work with no measurement content

|                   |              |
| ----------------- | ------------ |
| Constraint        | B2           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** src/core/videoLayout.ts:6-17 (CSS box height from an aspect ratio), src/core/deviceList.ts:21-23 shouldShowPicker (whether a control is visible), src/core/sparkline.ts:50-82 sparklineSegments (canvas pixel coords with a y-flip), src/core/notice.ts (disclaimer copy).

**Detail.** Each computes a number or a boolean about the page, not about the eyes, so by role they are src/ui. The cost is small and the benefit is real: all four have tests (videoLayout 29, deviceList 62, sparkline 176, notice 54 lines) and all four would move to a future src/ui without touching a caller, since none of them import anything impure.

### C2-34. core carries browser-API vocabulary without importing browser globals

|                   |              |
| ----------------- | ------------ |
| Constraint        | B2           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** src/core/cameraState.ts:13-25 switches on DOMException names ("NotAllowedError", "SecurityError", "DevicesNotFoundError"); src/core/deviceList.ts:13 filters on kind === "videoinput" (MediaDeviceInfo); src/core/transform.ts:3 defines its six numbers "in canvas setTransform order".

**Detail.** Lint cannot see this because these are strings and comments, not globals, and the modules stay importable in bare Node. It is knowledge of the browser API surface inside the pure layer, which is a mild coupling rather than a purity break: if the io shape changed, core would have to change with it.

### C2-35. The renderer parses core's sentences, making punctuation a load-bearing contract

|                   |              |
| ----------------- | ------------ |
| Constraint        | B2           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** src/main.ts:2686-2698 writeReadout splits on the first ": " to build two spans, and is called 38 times including with core output (src/main.ts:1577 inferenceMessage, 1988 fpsGateMessage). Ran the same split offline over four core strings: fpsGateMessage(12) -> label "Blink metrics not measurable: " / value "12 fps is below the 25 fps a short blink needs."

**Detail.** Every result was sensible, and the design is explained in a comment at src/main.ts:2677-2685, so this is deliberate rather than accidental. The cost is an unenforced contract in both directions: core's tests assert whole sentences and never the "Label: value" shape, and main.ts has no test that the shape held.

### C2-36. src/ui was never created; the presentation layer is a single 2,764 line file

|                   |              |
| ----------------- | ------------ |
| Constraint        | B2           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** `ls src` -> core, io, main.ts, vite-env.d.ts. src/main.ts is 2,764 of 6,645 source lines (42%), with 212 DOM calls (`grep -cE "document\.|getElementById|querySelector|\.textContent|\.style|\.className|innerHTML|addEventListener|createElement" src/main.ts`). Documented at SPEC.md:11 and ARCHITECTURE.md:90; no ADR in decisions/ and no ROADMAP amendment covers it.

**Detail.** As a layout simplification this is defensible: one wiring file for a demo page is a reasonable call and it is written down. The real cost is not the missing folder, it is that with no boundary there is no rule for what deserves a test, so which strings live in core is arbitrary and 42% of the code has only two Playwright specs.

### C2-37. Orphaned doc comment for a function that no longer exists

|                   |              |
| ----------------- | ------------ |
| Constraint        | A4           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** src/io/videoCanvas.ts:42-43: "// Strokes a closed path through already projected points. // Like drawDots, it only paints, it makes no coordinate decisions." — followed by a blank line and a second, separate comment block at :45-46 for drawDots. No closed-path function exists in the file; `grep -n "export function" src/io/videoCanvas.ts` lists only drawVideoFrame, drawPolyline, drawDots, drawFittedCircle.

**Detail.** Left behind when the closed-path stroker was removed (git log shows #165, "draw the iris as a circle, not a diamond"). Minor, but the rule is no dead code and no commented-out code on main.

### C2-38. IrisOffset and every threshold derived from it carry no unit in their names

|                   |              |
| ----------------- | ------------ |
| Constraint        | A4           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** src/core/gazeOffset.ts:10-13 declares `horizontal: number; vertical: number` while the comment two lines above says "as fractions of the eye width". Same units gap propagates to GazeSample.offset (fixation.ts:20-23), Fixation.centroid (:25-29), FIXATION_DISPERSION_THRESHOLD (fixation.ts:14), OFF_SCREEN_OFFSET_THRESHOLD (constants.ts:29) and the return of dispersionOffset (fixation.ts:33).

**Detail.** SPEC.md:113 says every measured value carries its unit in its name, and `grep -rn -i "offset unit|eye width" SPEC.md ROADMAP.md decisions/` finds no written exemption. This is the single largest unit exception in core by reach: it touches gaze, fixation, calibration and the off-screen gate.

### C2-39. DisplaySize drops the unit that its own inputs carry

|                   |              |
| ----------------- | ------------ |
| Constraint        | A4           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** src/core/videoLayout.ts:1-4 declares `DisplaySize = { width: number; height: number }` while the function that builds it, displaySize at :6-9, names every parameter streamWidthPx, streamHeightPx, targetWidthPx.

**Detail.** The unit is present on the way in and gone on the way out of the same function, so a caller reading `.width` has nothing in the name telling it these are pixels. Smallest possible fix, but it is a clear miss against SPEC.md:113.

### C2-40. FeatureRecord.perclos carries no unit while its sibling constant does

|                   |              |
| ----------------- | ------------ |
| Constraint        | A4           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** src/core/featureRecord.ts:30 `perclos: number | null`, validated as 0 to 1 at :96-99, versus src/core/perclos.ts:27 `export const PERCLOS_CLOSED_FRACTION`. SPEC.md annotates the field with `// 0 to 1` rather than naming it.

**Detail.** The value is a dimensionless fraction, so this is the weakest of the unit findings, but the project's own constant in the same subsystem spells out Fraction, which makes the field the odd one out.

### C2-41. tools/bundleGuard.mjs is never typechecked and its hand-written .d.mts is unverified

|                   |              |
| ----------------- | ------------ |
| Constraint        | A4           |
| Severity as filed | low          |
| Verdict as filed  | violation    |
| Verification      | **UNTESTED** |

**Evidence.** `npx tsc --noEmit --listFiles` lists tools/bundleGuard.d.mts but not tools/bundleGuard.mjs. I rewrote the declaration to `export function servedBundle(html: string): { ok: true; bundle: string };` (a lie: the implementation returns `{ok:false, reason:"no-bundle-in-page"}` at bundleGuard.mjs:53) and tsc stayed green.

**Detail.** The .d.mts header already documents why the guard stays .mjs, so the choice is written down and dated, and bundleGuard.test.ts does exercise the refusal branches of checkBundle at runtime. What is missing is any check that the declaration still matches the file it describes.

### C2-42. tsconfig include omits the repo's root TypeScript config files

|                   |              |
| ----------------- | ------------ |
| Constraint        | A4           |
| Severity as filed | low          |
| Verdict as filed  | partial      |
| Verification      | **UNTESTED** |

**Evidence.** tsconfig.json `"include": ["src", "test"]`; `npx tsc --noEmit --listFiles` shows no vite.config.ts, vitest.config.ts or playwright.config.ts. Adding all three in a scratch copy: vite and vitest are clean, playwright.config.ts yields 4 x TS2591 `Cannot find name 'process'` (no @types/node installed).

**Detail.** So `npm run typecheck` never sees three TypeScript files that ship in the repo. The playwright errors are a missing-@types problem rather than a real defect, which is a plausible reason for the exclusion, but the exclusion is not written down anywhere I could find.

---

## Compliance, as reported by each auditor

Verified-correct observations, quoted with their evidence inline.

### Core purity in fact (A4, A5) — src/core, 45 modules / 3,175 lines

- ZERO argument mutation, proven by execution. I ran the full suite through a Vite plugin that deep-freezes every argument to all 104 exported core functions: `npx vitest run --config scratchpad/vitest.freeze.config.mjs --testTimeout=300000` → 49 files, 473/473 passed. ESM is strict mode, so any sort/push/splice/property write on a passed array or object would have thrown TypeError.
- The freeze harness was verifiably live, not a no-op. Canary run where the guard itself did `args[0].__canary = 1` after freezing: 349 tests failed with `TypeError: Cannot add property __canary, object is not extensible`. So the freeze reached real call sites across the suite.
- ZERO non-determinism, proven by execution. Second harness calls every exported core function TWICE with identical arguments and compares serialized results, throwing on any difference: 473/473 passed. Any module cache, counter, clock read or randomness would have differed on the second call.
- ZERO module-level mutable state. AST scan of all 45 files for top-level `let`/`var`: 0 hits. Same scan over src/io finds 1, so the scanner works.
- ZERO hidden clock reads. `grep -rn 'Date\.now|new Date|performance\.now' src/core/` → no matches. No default parameter calls any function (AST check for DEFAULT_PARAM_CALL: 0). Time arrives as nowMs/elapsedMs/wallClockMs parameters throughout, e.g. frameClock.ts:89-94, 162-168.
- ZERO randomness and ZERO identity-keyed iteration. `grep -rn 'Math\.random|crypto\.' src/core/` → no matches; `grep -rn 'new Map|new Set|WeakMap|WeakSet' src/core/` → no matches. No Set/Map means no input-order-dependent iteration.
- ZERO throws in core. `grep -rn 'throw ' src/core/` → no matches. The null-over-guessing contract is never routed around by an exception.
- The two sort() calls in core are on fresh arrays, not on arguments. statistics.ts:37 `[...values].sort(...)`; scorePanel.ts:21-29 sorts the array produced by `.map()`. AST classified both as fresh-receiver, and the freeze run confirms neither touches the input.
- The one indexed write in core is on a copy. heatmap.ts:36-38 does `const cells = [...grid.cells]; cells[index] = ...` and returns a new grid. It is the only ASSIGN_TO_PROP in 3,175 lines.
- core imports nothing outside itself. Every `from` specifier across src/core resolves to a `./sibling`: no io, no ui, no npm package (mediapipe appears only at src/io/landmarker.ts:1 and src/main.ts:160), and `grep 'import(|require('` in core → no matches, so no dynamic escape hatch.
- No browser types leak into core signatures. Grep for HTMLElement/CanvasRenderingContext/MediaStream/ImageData/DOMRect in core returns only false positives on the project's own `BlinkEvent` name. facePresence.ts takes a structural `LandmarkerResultLike`, deviceList.ts a structural `DeviceLike`. No async, no Promise, no closure factory returning a stateful function anywhere in core.
- The direction of the dependency is right and the impurity is where it belongs. Same AST scan over src/io reports 16 browser-global reads, 11 param-property writes and 1 module-level let (camera.ts:34 navigator, download.ts:11-13 document, frameLoop.ts:4 requestAnimationFrame, videoStepper.ts:99 setTimeout). io imports core; core never imports io. `npx eslint .` and `npx tsc --noEmit` both exit 0; the unmodified suite is 473/473.

### D4 — the null-over-zero rule across all 45 src/core modules

- isFeatureRecord genuinely refuses NaN and both infinities on every numeric field, exactly as SPEC.md:16 claims. Executed: NaN or ±Infinity in apertureMm, fps, timestampMs, perclos, longClosureCount or blinkRatePerMin all returned false; a missing key returned false; the well-formed baseline row returned true (featureRecord.ts:50-99).
- No `|| 0` anywhere in src/core, and no numeric sentinel return anywhere: `grep -rn 'return 0;|return -1;|return NaN' src/core/` matches nothing. The eight `return ""` hits are all message functions saying "nothing to report" or CSV cells, which is the documented empty-means-not-measured convention (csv.ts:51-53, blinkLog.ts:76-78).
- All seven `?? 0` / `?? -1` sites judged individually and six are legitimate: aperture.ts:32-33 turns a missing ring index into `face[-1]` which is undefined and therefore a null refusal; blinkShape.ts:27,37 and heatmap.ts:37 and replay.ts:18 index provably in-range; fixtureRecording.ts:43 is a genuine count of an empty recording; statistics.ts:39 uses `?? null`, the correct form.
- Every division denominator in core is guarded against literal zero. Audited all 44 `/` sites: aperture.ts:84 (rulerPx>0), blinkRate.ts:43 (min observation), blinkShape.ts:59,72 (dtS>0, peak>0), calibrationProfile.ts:57 (spread>0), fps.ts:18 (last>first), gazeOffset.ts:45-54 (widthPx>0), heatmap.ts:53 (max>0), perclos.ts:111 (non-empty), statistics.ts:13,25,51 (length>0, mean>0), timing.ts:20, videoLayout.ts:16. Only sparkline.ts:75-76 is unguarded.
- frameClock.ts is the exemplar for this rule: Number.isFinite on every number arriving from outside, at lines 51, 99, 101, 138, 143 and 245, with `durationSeconds > 0` and `elapsedMs > 0` on top. `steppingProgress` and `coverageMetadataRows` return the word "unknown" rather than a computed zero when duration is missing.
- Several guards written as `<= 0` happen to catch NaN correctly because the comparison fails safe toward the refusal branch, and I verified each by execution: irisWidthPx, eyeAspectRatio and irisOffset return null on a degenerate eye; displaySize(0,10,100) returns null; coefficientOfVariation([0,0]) returns null; normalizedCells(emptyGrid()) returns null.
- The gate compositions hold: gatedBlinkRatePerMin returns null below MIN_BLINK_FPS instead of zero (blinkRate.ts:49-58), perclosValue refuses a window whose newest sample is over 2 s old and refuses under 15 s of observed span (perclos.ts:96-104), and scoreRecords returns null for an empty buffer, a no-face newest row, and a null PERCLOS (verified: all three returned null).
- Tests assert null and would fail on zero. 99 `toBeNull()` assertions across test/core, covering at least twelve null-returning functions: measureFps (fps.test.ts:21-27), mean/standardDeviation/coefficientOfVariation (statistics.test.ts:22-39), blinkRatePerMin (blinkRate.test.ts:37), perclosValue (perclos.test.ts:88,100,117,121,155), apertureMm and irisWidthPx (aperture.test.ts:65-72), personalThresholdMm (baseline.test.ts:103), normalizedCells (heatmap.test.ts:76), displaySize (videoLayout.test.ts:21-27), fixationStats (fixationStats.test.ts:18), serializeRecords (csv.test.ts:114,192), eulerFromMatrix (headPose.test.ts:116), irisOffset (gazeOffset.test.ts:105,120). Vitest's toBeNull is Object.is against null, so zero cannot satisfy it.
- fpsGate.test.ts:27-33 asserts the rule in the master prompt's own words, with a describe block titled "the ladder's assertion: null, not zero" and an explicit `expect(gatedBlinkRatePerMin(20, rate, 30000)).not.toBe(0)`.
- The export border refuses rather than invents: serializeRecords returns null for an empty session rather than a lone header (csv.ts:92-94), serialiseBlinkEvents does the same (blinkLog.ts:105), csvCell writes an empty field for null and for non-finite numbers (verified: csvCell(NaN) and csvCell(Infinity) both returned ""), and Object.is(value,-0) normalises negative zero (csv.ts:71).
- score.ts's zero-point contributions are a written, tested design rather than a silent zero: the `available: false` flag is documented at score.ts:61-64 and SPEC.md:64, scorePanel.ts:53-58 counts unavailable signals aloud in the summary sentence, and topDrivers excludes them. Verified: a row with no blink data scored 80 with two contributions marked available:false.
- The repository's own suite is green and I did not modify it: `npx vitest run` from the worktree gave 49 test files passed, 473 tests passed.

### A5 — dead code, unused exports and unreachable logic in src/core and src/io

- No orphan modules. A full AST import graph over src/, test/ and tools/ shows all 53 src files reachable from the single entry src/main.ts (index.html:10 is the only script tag); the sole unreached file is src/vite-env.d.ts, an ambient declaration. Nothing in src/core or src/io is test-only at module level. A type-only-import analysis also found no module reached solely via `import type`, so nothing survives as pure type baggage.
- No commented-out code in src/core or src/io. Two sweeps returned zero code-shaped comment lines: `grep -rnE '^\s*//.*(\(\)|=>|;\s*$)' src/core src/io`, and a `^\s*//\s*(const|let|if|return|function|export|import|})` pass whose five hits (csv.ts:7, landmarkGuard.ts:4, constants.ts:45 and :65, perclos.ts:37) are all prose sentences containing the words "constant", "returns", "export", "exported", "if". The earlier pass's five prose candidates are confirmed prose.
- fixtureRecording.ts does not ship. It is a static import at main.ts:107 but used only inside createRecorder(), gated by `const recorder = import.meta.env.DEV ? createRecorder() : null` (main.ts:498). Reasoning from that guard plus the import graph, and corroborated against the pre-existing gitignored dist/assets/index-SyxepCYv.js: grep finds 0 occurrences of "landmarkCountPerFrame", "Record fixture", "session-01.json" and "targetFrames". I did not run vite build.
- No unused parameters. `npx tsc --noEmit` exits 0 with noUnusedParameters and noUnusedLocals on, and I verified empirically in the scratchpad that TypeScript does flag a middle unused parameter (TS6133 on `b` in `f(a,b,c)`), so this is a real guarantee and not an after-used rule.
- No unreachable statements, redundant assertions, empty blocks, duplicate else-if branches or unreachable loops. An extended type-aware ESLint run over src/core and src/io (no-unnecessary-type-assertion, no-unnecessary-boolean-literal-compare, no-redundant-type-constituents, no-unused-vars with args:all, no-unused-expressions, no-dupe-else-if, no-self-compare, no-unreachable-loop, no-empty, no-empty-function) produced zero problems.
- Switch exhaustiveness is clean. Only four switches exist in core/io. cameraStateMessage (cameraState.ts:28) covers all seven CameraState kinds with no default; the one `default:` in the tree (cameraState.ts:22) switches on an arbitrary browser-supplied `string` and is plainly reachable. landmarkGuard.ts:19 and validityGate.ts:44 have no default.
- noUncheckedIndexedAccess defensive guards are compiler-required, not dead. Example: fixation.ts:70 `if (first === undefined) break;` sits under `start < samples.length`, so it is logically unreachable, but `samples[start]` is typed `GazeSample | undefined` and removing the guard would not compile. Judged required, not dead.
- Object-field surface is tight: of 186 property signatures declared across src/core and src/io, exactly one (StepSummary.lastMediaTimeSeconds) is never read anywhere in src/, test/ or tools/.
- No debug leftovers. `grep -rn 'console\.|debugger' src/core src/io` and `grep -rniE '\bTODO\b|\bFIXME\b|\bXXX\b|\bHACK\b' src/core src/io` both return nothing.
- The earlier pass's "19 unused exports" is wrong and I corrected it with a full AST scan: of 250 exported symbols in src/core and src/io, 23 are imported by no other file and 45 more are imported only by tests. But 22 of those 23 are used inside their own file (types naming a public signature, constants the module consumes), and 41 of the 45 are used internally too. Only 5 symbols are genuinely dead in production, all listed in the findings. csv.ts:40 EveryFieldHasAColumn deserves a specific defence: it is a compile-time assertion type, exported only so noUnusedLocals does not reject it, and the reason is written at csv.ts:29-34.
- No export-star, export-default or re-export barrels in src/core or src/io, so the import graph is complete and nothing is kept alive by an indirect re-export.
- Repository untouched: `git status --porcelain` is empty after all experiments. Every mutation was done on a mirrored copy under the scratchpad.

### core / io / ui boundary judged by role (checklist B2, B3)

- B3 holds and is enforced: eslint.config.js:27-51 restricts **/io/** and **/ui/** imports plus the window/document/navigator globals inside src/core. Ran `npx eslint src/core src/io` -> no output, exit 0.
- B3 holds independently of lint: `grep -rnE 'from "' src/core | grep -v 'from "\./'` returns nothing. Every one of the 45 core modules imports only its siblings, with no third-party or cross-layer import at all.
- Purity verified by execution, not by reading: a scratch script imported all 45 files in src/core in a bare Node process. Output: "imported 45/45 core modules in bare node, failures=0", with typeof document = undefined and typeof window = undefined.
- The presentation functions in core genuinely need no browser. Called 13 of them in that same bare Node run: cameraStateMessage, fpsGateMessage, clipRefusedMessage, poseValidityMessage, formatBlinkEvent, displaySize, shouldShowPicker, sparklineSegments, steppingProgress, inferenceMessage, demoNoticeShort, panelSummary all returned their expected strings or arrays.
- io stays io by role. download.ts, camera.ts, frameLoop.ts, landmarker.ts, videoCanvas.ts, videoFile.ts and calibrationStore.ts contain no measurement; src/io/videoCanvas.ts:45-46 states outright that points arrive already projected and the function makes no coordinate decisions.
- The dependency direction is right where it exists: src/io/calibrationStore.ts:1-2 and src/io/videoCanvas.ts:1-2 import core types, and nothing in core imports io.
- Every presentation-shaped core module has a test file: scorePanel, notice, fpsGate, validityGate, sparkline, videoLayout, deviceList, heatmap, replay, cameraState, timing, landmarkGuard, transform, projection. That is 1,119 of the 5,913 lines in test/core, so the choice is paid for and not merely asserted.
- The gate/sentence split is clean at function level, which is what makes a future move to src/ui cheap. fpsGate.ts:7 measurableAtFps returns a boolean and fpsGate.ts:11 fpsGateMessage returns the prose; validityGate.ts:17/43, landmarkGuard.ts:10/16 and timing.ts:12/23 follow the same shape.
- The strings in src/core/kss.ts:17-30 are correctly in core and are the best-defended user-visible text in the project: they are the Karolinska instrument's own wording, and kss.ts:6-9 explains that rewording them would change what people report, so the UI is not allowed to paraphrase.
- No core module knows about the page. Grepping src/core for canvas, ctx, style, className, innerHTML, textContent, element, document, getElementById returns only comment prose and *Px parameter names (aperture.ts, projection.ts, sparkline.ts, videoLayout.ts); there is not one DOM identifier, CSS class or element name.
- src/core/blinkLog.ts:28-44 gets the display-versus-record distinction exactly right: eventsForDisplay trims for the reader while appendEvent keeps the full record, and the docstring names the 63 rows lost when the two were once collapsed.
- The stepper interval rule, though not unit tested, has a cross-browser end-to-end regression test: test/e2e/videoFile.spec.ts:131 asserts the measured frame COUNT within one frame, and it is not tagged @chromium-only, so playwright.config.ts:51-60 runs it on webkit too.

### src/io, the impure edge — checklist A4, A6, and the runtime network constraint

- NO NETWORK CODE IN src/ AT ALL. `grep -rnE "fetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|navigator\.connection|importScripts|new Worker|import\(|https?://" src/ index.html` returns three hits, all in main.ts and none a network call: :210 a LinkedIn href the user must click, :212 and :221 the SVG XML namespace string, which is an identifier and never fetched. No dynamic import, no worker, no cookie, no indexedDB. The violation above comes entirely from the vendored dependency, not from project code.
- MODEL AND WASM RESOLVE LOCALLY. src/io/landmarker.ts:7 and :11 build both paths from import.meta.env.BASE_URL, and vite.config.ts sets base "/blinklab/". `grep -o` over dist/assets/*.js finds exactly "/blinklab/models/face_landmarker.task" and "blinklab/mediapipe-wasm" and no CDN path. My probe confirmed the loader fetched only vision_wasm_internal.js, vision_wasm_internal.wasm and face_landmarker.task from the local origin.
- A FRESH CLONE WORKS. `git ls-files public/` → public/models/face_landmarker.task (the 3.7 MB model is tracked). The wasm is gitignored (.gitignore "public/mediapipe-wasm/") and regenerated by package.json's prepare-assets, wired to predev and prebuild, so npm ci + npm run build produces a complete site with no download step.
- ADR-0002 RECORDS THE DECISION, dated 2026-07-30, status accepted: it names the CDN option and rejects it, and states the model is committed while the wasm is copied from the version-locked package. The finding above is a gap in that ADR's premise, not an undocumented drift.
- CORE PURITY HOLDS FROM THE io SIDE. src/io/videoCanvas.ts:1-2 and src/io/calibrationStore.ts:1-2 are the only io→core imports and both are `import type`, so nothing crosses at runtime. No core module imports io; the eslint.config.js no-restricted-imports rule for src/core/**/*.ts is present and `npx eslint src/io` exits 0.
- download.ts IS NOT RACY IN PRACTICE, despite revoking the object URL immediately after link.click() (src/io/download.ts:14-15). Ran /private/tmp/.../scratchpad/download.mjs, which serves the file's own body and clicks it in both engines: "chromium: download fired, name=probe.csv body=\"a,b\\n1,2\\n\"" and the identical line for webkit. I looked for a defect here and did not find one.
- EVERY io ENTRY POINT THAT THROWS HAS A CALLER THAT CATCHES, except the two named above: startCamera at main.ts:652 is inside try/catch ending main.ts:668 with classifyCameraError; listMediaDevices at :679 has its own catch with a comment; loadVideoFile and stepThroughVideo sit inside the try that ends at main.ts:854 with a clipFailed state; loadLandmarker at :875 is caught at :876.
- THE STEPPER REFUSES RATHER THAN GUESSES. src/io/videoStepper.ts:234-241 returns frameIntervalSeconds: null and stoppedEarly: true when calibration fails, instead of the old 60 fps assumption, and main.ts:783 branches on that null to say so. This is the "null over guessing" rule honoured in the exact place it was once broken.
- UNITS ARE IN THE NAMES throughout io: mediaTimeSeconds, frameIntervalSeconds, durationSeconds, widthPx/heightPx, lineWidthPx, radiusPx, SEEK_TIMEOUT_MS, FRAME_GRACE_MS, CALIBRATION_STEP_S, nowMs. Only a few locals inside stepThroughVideo (step, target, probe, origin, end) drop the suffix.
- THE STEPPER IS NOT WHOLLY UNTESTED. test/e2e/videoFile.spec.ts:155-164 drives a real clip through stepThroughVideo and asserts the reported frame count is within ±1 of the fixture's, in two browser engines. That is real coverage of the whole path; what is missing is fast unit coverage of the interval arithmetic's edge cases.
- MOST io MODULES ARE INHERENTLY UNTESTABLE AND CORRECTLY SO. camera.ts (35 lines) is a getUserMedia wrapper, videoCanvas.ts's three drawing functions only paint, download.ts builds a Blob, landmarker.ts is 12 lines of configuration, videoFile.ts is element wiring around loadedmetadata/canplay. Their lack of unit tests is inherent, not a gap.
- REPO-WIDE GATES ARE GREEN: `npx tsc --noEmit` exits 0 and `npx eslint src/io` exits 0. I ran both and did not modify the repository; all scratch files live under the scratchpad.

### Type safety and contract integrity inside core (checklist A4 + the SPEC.md FeatureRecord / ScoreBreakdown / CSV contracts)

- `npx tsc --noEmit` exits 0 on the repo as committed (EXIT=0), and `npx eslint .` exits 0.
- Zero `any` anywhere in src: `grep -rn '\bany\b' src --include='*.ts'` matches only English prose inside comments (e.g. sparkline.ts:3, perclos.ts:34), never a type position.
- Zero non-null assertions in all of src and test: a tight `grep -rnE '[A-Za-z0-9_)\]]!(\.|\[|,|\)|;| )'` over both trees, excluding `!=`/`!==`, returns nothing. With noUncheckedIndexedAccess on, that is real discipline, not luck.
- Zero `@ts-ignore`, `@ts-expect-error` and `@ts-nocheck` in src and test.
- Exactly one index signature in src: `value as Record<string, unknown>` at src/core/featureRecord.ts:74, read-only and immediately narrowed by typeof/isFinite checks on every key. Safe.
- tsconfig.json runs strict, noUncheckedIndexedAccess, noUnusedLocals, noUnusedParameters, noFallthroughCasesInSwitch and isolatedModules together.
- The CSV_COLUMNS guard SPEC.md claims is real and I broke it deliberately: adding a 17th field to FeatureRecord in a scratch copy produced `src/core/csv.ts(41,3): error TS2344: Type 'false' does not satisfy the constraint 'true'` from the EveryFieldHasAColumn assert at csv.ts:33-41, alongside the runtime check at test/core/csv.test.ts:103.
- The FeatureRecord contract agrees four ways. A script parsing all four sources gives 16 fields each for the type (featureRecord.ts:13-33), isFeatureRecord (:70-110), CSV_COLUMNS (csv.ts:10-27) and the SPEC.md listing, with zero missing and zero extra on any side, and identical ORDER across type, SPEC and columns.
- The four score caps sum to exactly 100 (40 + 30 + 15 + 15) and that sum is pinned by its own test at test/core/score.test.ts:396-403, not merely by comment.
- The `score = 100 - sum(points)` identity is asserted by a reusable helper sumOfContributions (test/core/score.test.ts:50-56) invoked from six separate scenarios including the drowsy, gapped and unavailable-signal cases.
- All four ramp penalties pass through Math.round in rampPoints (score.ts:71-80), so ramp contributions are integers by construction; the fractional risk is confined to the one unrounded closure multiply.
- Units are carried correctly almost everywhere in core: apertureMm, irisWidthPx, aperturePx, peakClosingVelocityMmPerS, amplitudeOverVelocityMs, blinkRatePerMin, pitchDeg/yawDeg/rollDeg, frameWidthPx/frameHeightPx, cutoffHz, dtS, tauS, derivativePerS, mediaTimeSeconds, meanMs/medianMs/longestMs, closedAtMs, targetStartedAtMs. `as unknown as` appears exactly once in the whole repo, at test/core/csv.test.ts:198, deliberately feeding hostile input to the serialiser.

---

## What each auditor could not check

### Core purity in fact (A4, A5) — src/core, 45 modules / 3,175 lines

- Branch-level coverage of the freeze harness. No coverage provider is installed (`ls node_modules/@vitest/` shows no coverage-v8, and none in package.json), so I can only say 103 of 104 exported functions were entered, not which branches. The static AST scan is path-insensitive and covers 100% of statements, and it found zero param-mutating statements, which is the stronger of the two results.
- Whether src/main.ts hands core a live browser object that behaves differently from the plain objects the tests pass. main.ts is out of scope for this chunk. Core's signatures are all structural, so this is unlikely, but I did not run the app.
- Floating-point associativity across different orderings of the same input set. Purity only requires the same input to give the same output, which I proved; whether summation order across re-ordered inputs is stable is a measurement question for the maths chunk.
- Whether the exported types never referenced outside their own module (19 of them, e.g. videoLayout.ts DisplaySize, heatmap.ts HeatmapGrid, kss.ts KssStep) count as dead code under A5. They are type-only, erased at build, and several read as deliberate public API. I did not call it either way. No exported const or function in core is dead: the five that looked unused (SPEED_COEFFICIENT, DERIVATIVE_CUTOFF_HZ, DEMO_NOTICE_SHORT, PERCLOS_WINDOW_MS, STEPPING_DUPLICATE_TOLERANCE) are all consumed inside their own module.
- Commented-out code across the repo (the other half of A5). I read core in full and found none there, only prose comments, but I did not sweep src/main.ts, test/ or tools/.

### D4 — the null-over-zero rule across all 45 src/core modules

- Whether MediaPipe can actually emit a non-finite landmark coordinate or a non-finite facial transformation matrix. There is no camera or model run available here, and src/io/landmarker.ts performs no validation of what the model returns, so the reachability of findings 2, 3, 5, 6 and 7 is unproven. The guards themselves are demonstrably wrong regardless of reachability.
- Whether the degenerate all-zero transformation matrix in the headPose finding occurs in practice; nothing in core or io checks the matrix for orthonormality.
- Whether main.ts re-checks any core return value before display. main.ts is out of scope for this chunk, and I confirmed only the one fact needed for finding 1, that isFeatureRecord is never called there.
- Whether a NaN can survive the Python side undetected end to end. analysis/blinklab/loader.py:133 comments that NaN is how pandas represents the FeatureRecord contract's null, which strongly suggests it cannot be distinguished, but I did not run the Python suite.

### A5 — dead code, unused exports and unreachable logic in src/core and src/io

- Tree-shaking claims rest on the pre-existing gitignored build at dist/assets/index-SyxepCYv.js (dated 10 Aug 10:53) plus the import graph, because I was told not to run vite build. If that bundle is stale relative to HEAD the dist evidence is corroborating rather than definitive; the import-graph and import.meta.env.DEV reasoning stands on its own.
- src/main.ts (2,764 lines) was out of scope, so dead code living only there was not audited systematically. One spillover was visible from this dimension: the `.caveat` CSS rule at main.ts:2358 has no element using it.
- Logic-level unreachable branches that the type system cannot see were only spot-checked. no-unnecessary-condition catches type-level impossibility, not a condition unreachable purely because of upstream value ranges.
- Coverage-based confirmation of never-executed lines was not run: @vitest/coverage-v8 is not installed and installing it would modify the repository.

### core / io / ui boundary judged by role (checklist B2, B3)

- Whether the ~16 untested readout strings in main.ts are ever wrong at runtime. I read and grepped main.ts but did not run the app or execute the two Playwright specs, so their correctness rests on manual testing recorded in test/MANUAL.md.
- Whether writeReadout's first-": " split ever mangles a core string in a real session. I reproduced the split offline over four core strings and all four were sensible, but I did not enumerate the runtime value at all 38 call sites.
- Whether presentation constants are duplicated between core and the stylesheet. index.html and any CSS were outside the role judgement I was asked for, so I did not compare them against src/core/heatmap.ts's grid or src/core/videoLayout.ts's sizing.
- How much of main.ts's 2,764 lines would actually move to a src/ui versus stay as wiring. Judging that needs a read of the whole file, which is out of scope for this chunk.

### src/io, the impure edge — checklist A4, A6, and the runtime network constraint

- The exact contents of the telemetry POST body. It is binary protobuf, and I read the encoder (frame counts, timings, platform string, task type) rather than decoding a captured payload, so "usage statistics only, no face data" is inference from the encoder shape, not from a decoded body.
- Whether any supported MediaPipe option disables the logger, and whether the POST also fires on the CPU delegate or in WebKit. My probe proved the GPU path in headless chromium only.
- Whether the deployed GitHub Pages site behaves identically. I served the prebuilt local dist/ read-only on localhost; I did not fetch the live origin.
- Real quota-exceeded and blocked-storage behaviour in a shipping browser under real user settings. I stubbed localStorage (unit test) and overrode the property before module execution (browser test), so the exact DOMException name per engine may differ even though the throw path is the same.
- videoStepper against a variable-frame-rate or remuxed clip. The repo has only a synthetic constant-rate fixture, so I relied on reading the code plus the incidents its own comments and git log record.

### Type safety and contract integrity inside core (checklist A4 + the SPEC.md FeatureRecord / ScoreBreakdown / CSV contracts)

- Whether main.ts sanity-checks the loaded calibration profile before use. main.ts is out of scope for this chunk; I only confirmed the direct assignment at main.ts:909 `let calibrationProfile: CalibrationProfile | null = loadCalibrationProfile();` with no validation on that line.
- Whether the fractional-longClosureCount path is reachable in practice. SPEC.md calls isFeatureRecord "the runtime schema behind the 6.7 serializer and the 7.2 loader", but `grep -rn isFeatureRecord src test tools` shows only tests call it, so the loader it guards may not exist in TypeScript yet.
- The MEANING of the score (whether the ramps and caps measure drowsiness well) is explicitly chunk 4's job; I audited only whether the stated structural contract holds.
- Whether CI actually runs `npm run typecheck` over the same include list, or adds files. I checked the tsconfig and tsc's own --listFiles output, not the .github workflow definitions.
