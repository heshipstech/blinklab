# ADR-0003: End to end testing with Playwright, Chromium only, fake camera

Date: 2026-08-03
Status: accepted

## Context

Every test through 5.4b is a unit test on a pure function. Nothing checks the wiring between them: that the buttons, the camera, the model and the frame loop actually compose into a working flow. Roadmap 5.5 introduces browser level end to end testing. The hard constraint is CI: the machines have no camera and no face, and amendment 1 already established that a headless browser cannot click a real permission prompt.

## Options considered

1. Cypress. Mature, but it runs the tests inside its own browser app, carries a heavier runtime, and its fake media story is the same Chromium flags with more layers in between. Rejected.
2. Selenium / WebdriverIO. The older protocol, more moving parts, slower feedback. Nothing here needs cross vendor grid testing. Rejected.
3. Playwright. First party headless browsers, launch flags pass straight through, it starts and stops the web server itself, and a trace viewer for failures. Chosen.

## Decision

Playwright with Chromium only. Two flags make the camera problem disappear: `--use-fake-device-for-media-stream` provides a synthetic video stream and `--use-fake-ui-for-media-stream` grants permission without a prompt. The tests run against the real production build (`vite build` then `vite preview`), never the dev server, so what CI proves is what the public site ships. Suffixes keep the two runners apart: Vitest owns `test/**/*.test.ts`, Playwright owns `test/e2e/*.spec.ts`.

The boundary, stated once and relied on everywhere: a headless browser can fake a camera, but not a face. End to end tests prove WIRING, the overlay opens, the dot moves, cancel cancels. Everything that needs eyes stays where it lives today, in unit tests on fixtures and in `test/MANUAL.md`.

## Consequences

- Good: the assembled app finally has automated coverage, and regressions in plumbing, not just math, now fail a pull request.
- Good: the fake camera makes the tests deterministic, no hardware, no prompts, no flaky permissions.
- Bad: CI grows a browser download of roughly 100 MB per run, about a minute. If this starts to hurt, cache `~/.cache/ms-playwright` keyed on the Playwright version.
- Bad: one engine only. A WebKit or Firefox specific wiring bug would not be caught. Accepted for a learning lab: one engine buys nearly all the value at a third of the cost.
- The `data-testid` attributes on the calibration overlay and dot are a small permanent contract between the app and its tests: styles and copy may change freely, those names may not.

**Superseded in part, recorded 2026-08-14.** The "one engine only"
consequence above no longer holds: a WebKit project was added to
`playwright.config.ts` and is documented in README.md, ARCHITECTURE.md
and `docs/log.md`, but no ADR ever recorded the change. Everything else
here stands. Nothing above this line has been edited.
