import { readFileSync } from "node:fs";
import { join } from "node:path";

// Every colour pair the page renders text in, held to WCAG AA.
//
// Why a guard and not a careful edit. Roadmap row 8.8 was DECLINED on
// 15 August on the stated grounds that "all text clears WCAG
// contrast". That was checked by eye, it stopped being true, and
// nothing could notice: five pairs on the committed stylesheet fail
// AA. The worst of them is `.rate-warning`, which carries the
// processing-rate limitation added the very next day, at 2.80:1 in
// 12px. A caveat nobody can read is not a limitation stated in the
// open, which is a house rule, so the decline's own premise had
// rotted while the item sat closed.
//
// Same arrangement as resultGuard and uiGuard: plain .mjs that reads
// the disk, hand-written types next door, callers type checked. The
// ratios are computed here rather than pasted from a checker, because
// a pasted number is one nobody can re-derive — and because the plan
// that proposed this guard pinned "white on #0f172a = 15.13" when the
// real ratio is 17.85, which would have failed for the right reason
// and then been "fixed" by bending the constant.

/** The sRGB relative luminance of a six-digit hex colour, per WCAG 2.x. */
export function relativeLuminance(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new Error(`not a six-digit hex colour: ${hex}`);
  }
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map(
    (byte) => {
      const s = byte / 255;
      // 0.04045 is the WCAG threshold. The widely copied 0.03928 is
      // from an older draft; it differs only below one 255th of a
      // channel, but a guard that rounds its own definition has no
      // standing to fail anybody else's colour.
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    },
  );
  return (
    0.2126 * (channels[0] ?? 0) +
    0.7152 * (channels[1] ?? 0) +
    0.0722 * (channels[2] ?? 0)
  );
}

/** The WCAG contrast ratio between two hex colours, 1 to 21. */
export function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** WCAG AA for body text. Large text is 3.0 and nothing here relies on it. */
export const AA_NORMAL_TEXT = 4.5;

/** The `--name: #value` custom properties declared in the stylesheet. */
export function readTokens(root) {
  const css = readFileSync(join(root, "src/styles.css"), "utf8");
  const tokens = {};
  const pattern = /--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi;
  let match = pattern.exec(css);
  while (match !== null) {
    const name = match[1];
    const value = match[2];
    if (name !== undefined && value !== undefined) {
      tokens[name] = value.toLowerCase();
    }
    match = pattern.exec(css);
  }
  return tokens;
}

/**
 * Every foreground/background pair the page actually renders text in.
 *
 * TWO GROUNDS, not one, and that is the trap this table closes.
 * `--page` is a shade darker than `--surface`, so a colour can clear
 * 4.5 against a card and fail against the page behind it. A candidate
 * for `--accent-text` was rejected during this work for exactly that:
 * #c2540b measures 4.60 on surface and 4.39 on page.
 */
export const TEXT_PAIRS = [
  { fg: "ink", bg: "surface", where: "card headings and values" },
  { fg: "ink", bg: "page", where: "title and footer" },
  { fg: "ink", bg: "accent", where: "the alerting status banner" },
  { fg: "body", bg: "surface", where: "body copy inside cards" },
  { fg: "body", bg: "page", where: "body copy on the page" },
  { fg: "muted", bg: "surface", where: "labels, legend, blink table" },
  { fg: "muted", bg: "page", where: "muted text outside cards" },
  { fg: "accent-text", bg: "surface", where: "the low-rate warning" },
  { fg: "accent-text", bg: "page", where: "the low-rate warning" },
];

/** Every pair with its measured ratio and whether it clears AA. */
export function checkPairs(tokens) {
  return TEXT_PAIRS.map((pair) => {
    const fg = tokens[pair.fg];
    const bg = tokens[pair.bg];
    if (fg === undefined) throw new Error(`stylesheet has no --${pair.fg}`);
    if (bg === undefined) throw new Error(`stylesheet has no --${pair.bg}`);
    const ratio = contrastRatio(fg, bg);
    // The resolved colours go in under their OWN names. Spreading
    // them over `fg` and `bg` clobbered the token names with hex
    // values, so a failure read "--#b8500c on --#ffffff" and a caller
    // filtering by token name silently matched nothing. Caught by the
    // test that filters for the rate warning, which is the one pair
    // this guard exists for.
    return {
      ...pair,
      fgColor: fg,
      bgColor: bg,
      ratio,
      passes: ratio >= AA_NORMAL_TEXT,
    };
  });
}

/**
 * Which token a rule paints its text with, e.g. `colorTokenUsedBy(root,
 * ".rate-warning")` returns "accent-text".
 *
 * The palette table above proves the COLOURS are legible. It cannot
 * prove the page uses them: reverting `.rate-warning` to `--accent`
 * left every pair passing and the warning unreadable again, which a
 * mutation caught and which is the whole failure this guard was
 * written for. So the usage is checked too, and the two together are
 * the claim.
 */
export function colorTokenUsedBy(root, selector) {
  const css = readFileSync(join(root, "src/styles.css"), "utf8");
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rule = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
  const body = css.match(rule);
  if (body === null) {
    throw new Error(`src/styles.css has no rule for ${selector}`);
  }
  const colour = (body[1] ?? "").match(
    /(?:^|[;{\s])color:\s*var\(--([a-z-]+)\)/,
  );
  if (colour === null) {
    throw new Error(`${selector} does not set color from a token`);
  }
  return colour[1];
}
