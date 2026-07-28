# ADR-0001: Browser TypeScript stack with MediaPipe

Date: 2026-07-28
Status: accepted

## Context

blinklab must run entirely in the browser (privacy rule: nothing leaves the device), be teachable to a non engineer in small increments, and do webcam vision work at real frame rates. A stranger must be able to clone and run it in under 5 minutes, and every increment must be demoable by URL.

## Options considered

1. Python desktop app with OpenCV. Strongest vision ecosystem, but distribution is painful, nothing is demoable by URL, and it fails the 5 minute stranger test.
2. Browser app built on a framework (React or Svelte). Industry standard, but adds a layer between the learner and the DOM before that layer earns its keep.
3. Browser app in plain TypeScript and DOM: Vite, MediaPipe tasks-vision (WASM in browser, 478 landmarks including iris), Vitest, ESLint plus Prettier, GitHub Actions, GitHub Pages, npm.

## Decision

Option 3. Fewest layers, fully local processing, free public deploys, and the vision model runs inside the page.

## Consequences

- Good: every measurement is publicly demoable, pure core logic tests run in milliseconds, and there is no backend to secure or pay for.
- Bad: we are bound to MediaPipe's landmark quality and to browser camera APIs, and heavy custom models are out of reach.
- Already felt: the toolchain convoy sets the pace. TypeScript is pinned to 6.0.3 until typescript-eslint supports 7 (increment 0.3).
- A UI framework or charting library may only be introduced by a superseding ADR.
