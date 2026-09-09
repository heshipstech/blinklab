// Roadmap 14.0f2 [E7]. What the page says it is, and what it looks
// like in a tab, in one place.
//
// Three small things that were each missing for the same reason: they
// live in `index.html` and in the nav bar rather than in a module, so
// nothing in this repository was holding them. A page that publishes
// measured numbers under a test-enforced stamp had a bare `<head>`: no
// description, so a shared link previewed as the single word
// "blinklab", and no icon, so a tab showed the browser's blank sheet.
//
// These are claims and marks rather than measurements, so they are
// held differently: the description is walked by `claimGuard` like
// every other sentence this project publishes, and the icon is held to
// the mark the nav bar already draws.

/**
 * Where this project's source lives.
 *
 * Public and already in README beside the clone command. It is here
 * because two things need it — the nav link and every citation link —
 * and a URL written twice is a URL that is eventually wrong once.
 */
export const REPOSITORY_URL = "https://github.com/heshipstech/blinklab";

/**
 * The page's `<meta name="description">`, and the sentence a search
 * result or a shared link shows.
 *
 * Written to say what the page does and to claim nothing more. It
 * deliberately does NOT say anything about where data goes: the
 * shortest natural version of that sentence is "no data leaves your
 * device", which is a RETIRED claim in `tools/claimGuard.mjs` because
 * it was measured false, and a description is exactly the kind of
 * short marketing sentence that reaches for it. The honesty notice at
 * the top of the page is where that subject is handled, at the length
 * it needs. This sentence is walked by the same guard as every other
 * tracked file, so the retired wording cannot appear here either.
 *
 * "A demo, not a medical device" is carried rather than dropped for
 * length. The one place this project cannot afford to be brief is the
 * place a stranger reads first.
 */
export const PAGE_DESCRIPTION =
  "A browser-based eye signal laboratory. It reads a webcam locally " +
  "and turns blinks, eyelid aperture in millimetres, gaze and PERCLOS " +
  "into numbers you can audit. A demo, not a medical device.";

/**
 * The eye outline the brand mark draws, as SVG path data.
 *
 * Exported so the nav mark and the tab icon are literally the same
 * shape rather than two drawings that agree today. A test holds
 * `public/favicon.svg` to this string, so an icon redrawn without the
 * header turns the build red.
 */
export const EYE_OUTLINE_PATH =
  "M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z";

/**
 * The dark ground the brand mark sits on, and the page's ink colour.
 *
 * Duplicated from `--ink` in `styles.css` because an SVG file served
 * as an icon cannot read a CSS custom property, and a test holds the
 * two together.
 */
export const BRAND_INK = "#0f172a";
