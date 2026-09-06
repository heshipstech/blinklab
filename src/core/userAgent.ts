// What the export says about the browser, and how much of it.
//
// Roadmap 10.0a2, ladder B2. Every session file carries the full
// `navigator.userAgent`, and the validation and pilot plans ask
// participants to email those files. A full user agent names the
// browser build, the engine build and often the operating system patch
// level. Together those are a fingerprint: rare enough in combination
// to pick one machine out of a crowd, and none of it is what the
// analysis reads. What the analysis reads is coarse — which browser,
// roughly which version, on which kind of machine — so that is what
// the export offers, and the full string is written only when someone
// asks for it.
//
// This module is pure. It is handed a string and returns a string, so
// every browser below is staged in a test rather than visited.

/**
 * The platform families this project distinguishes, in the order they
 * must be tried.
 *
 * Order matters twice. "Macintosh" must be tried before "Mac OS X",
 * because an iPhone's user agent says "like Mac OS X" and is not one.
 * And "Android" must be tried before "Linux", because every Android
 * user agent contains both and only one of them is the answer.
 */
const PLATFORMS: readonly (readonly [RegExp, string])[] = [
  [/\biPhone|\biPad|\biPod/, "iOS"],
  [/\bAndroid\b/, "Android"],
  [/\bMacintosh\b|\bMac OS X\b/, "macOS"],
  [/\bWindows NT\b|\bWindows\b/, "Windows"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bLinux\b|\bX11\b/, "Linux"],
];

/**
 * The browser families, in the order they must be tried.
 *
 * Every Chromium build ends in "Safari/537.36" and most carry
 * "Chrome/" as well, so the specific tokens go first: a reducer that
 * matched the last word would call Edge, Opera and Chrome all Safari.
 * Safari's own version lives in "Version/", never in the "Safari/"
 * token, which is the engine build.
 */
const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/\bEdgi?A?[a-z]*\/(\d+)/, "Edge"],
  [/\bOPR\/(\d+)/, "Opera"],
  [/\bFirefox\/(\d+)/, "Firefox"],
  [/\bChrome\/(\d+)/, "Chrome"],
  [/\bVersion\/(\d+)[.\d]*\s+(?:Mobile\/\S+\s+)?Safari\//, "Safari"],
];

/** The platform family named in a user agent, or null. */
function platformOf(userAgent: string): string | null {
  for (const [pattern, name] of PLATFORMS) {
    if (pattern.test(userAgent)) {
      return name;
    }
  }
  return null;
}

/** The browser family and major version named in a user agent, or null. */
function browserOf(userAgent: string): string | null {
  for (const [pattern, name] of BROWSERS) {
    const match = userAgent.match(pattern);
    if (match !== null) {
      return `${name} ${match[1]}`;
    }
  }
  return null;
}

/**
 * A user agent reduced to the three facts the analysis uses: browser
 * family, major version, platform family.
 *
 * Null in, null out, and an empty string is nothing to reduce. An
 * unreadable half says so rather than being dropped: "Chrome 140" on
 * its own would read as a measurement of a platform somebody
 * identified, and nobody did.
 */
export function reduceUserAgent(userAgent: string | null): string | null {
  if (userAgent === null || userAgent.length === 0) {
    return null;
  }
  const browser = browserOf(userAgent) ?? "an unknown browser";
  const platform = platformOf(userAgent) ?? "an unknown platform";
  return `${browser} on ${platform}`;
}
