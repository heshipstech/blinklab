# Build log

One line per increment: date, id, what changed, what was surprising.

- 2026-07-28, 0.1, wrote the working documents, license and readme skeleton. Surprise: the plan itself had a contradiction (a Playwright check four phases before Playwright exists) and an ordering bug (dataset features needed video upload mode, which was scheduled later), both fixed as amendments before any code.
- 2026-07-28, 0.2, hand written Vite plus TypeScript scaffold, the page prints blinklab. Surprise: the entire production build is 0.83 kilobytes and takes 25 milliseconds.
- 2026-07-28, 0.3, prettier, eslint with the core purity fence, strict typescript. Surprise: had to step TypeScript back from 7 to 6.0.3 because the lint plugin does not support the new compiler generation yet. Tools travel in convoys.
