# Issue #175: the corpus runner will measure a server it did not build

This is the written record of what was checked on 9 August 2026.

## What happened

`tools/measure_corpus.mjs` measures whatever web server answers on port 4173. It
never checks that the server is serving the code that was built for the run.

On 9 August a preview server left running from an earlier session still held port 4173. It served the old bundle. A bundle is the single JavaScript file the build
produces. The server answered every request with HTTP 200, the success code of
the hypertext transfer protocol, so nothing looked broken. A corpus run of about
twenty minutes measured the wrong code and produced a confident, plausible, wrong
result of 69.1%.

## The two run logs

Both logs are in `../run-logs/`. They look the same. That is the point.

- `corpus-run-01-39-stale-server.txt` is the contaminated run at 01:39.
- `corpus-run-10-07-corrected.txt` is the corrected run at 10:07.

Both end with the line `done. 8 measured, 0 failed.` Both report the same frame
counts for all eight clips. Nothing in either file names the build. So there is
no way to tell from the log which one measured the right code.

## The trap was still armed

At the time of the audit four leftover servers were listening on the machine.

| port | serving                                       | has the blink log fix |
| ---- | --------------------------------------------- | --------------------- |
| 4173 | worktree `dist/`, built 09:46                 | yes                   |
| 4174 | main repo `dist/`, built 01:17                | no                    |
| 5199 | development server since 08:36                | not applicable        |
| 5173 | development server since 18:23 the day before | not applicable        |

Port 4174 was fetched by hand. It answered 200 and served the pre-fix bundle
`index-CcVgRq3D.js`.

Two things make it worse.

1. `package.json` runs `vite preview` with no `--strictPort`. If 4173 is busy,
   Vite quietly starts on another port while the runner keeps talking to the old
   server on 4173. The project already knows this flag. `playwright.config.ts`
   passes it by hand, and the usage note at the top of `tools/measure_corpus.mjs`
   tells the operator to type it. What is missing is enforcement.
2. `playwright.config.ts` sets `reuseExistingServer: !process.env.CI`. When a
   server already answers on 4173 the whole build and serve command is skipped.
   No build runs. The end to end test suite passed against a bundle several hours
   old on 9 August.

## How it was found

Two audit workflows listed the running processes with
`lsof -nP -iTCP -sTCP:LISTEN`, fetched each port by hand, and read the served
bundle name out of the returned page. They then read `tools/measure_corpus.mjs`
line by line looking for a guard and found none.

## Nothing else to keep

This finding rests on the two run logs and on the code, which is already in the
repository. No measurement data supports it.
