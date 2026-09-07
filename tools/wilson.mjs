// The confidence interval a counted proportion is entitled to, on the
// document side of the border.
//
// Roadmap 10.10c1, ladder B8. `analysis/blinklab/stats.py` holds the
// same arithmetic for the tools that measure; this holds it for the
// README block, which is generated from the counts those tools
// published rather than from a fresh measurement.
//
// Two implementations of one formula is the thing this repository
// keeps finding fault with, so they are held to a committed table of
// cases (test/fixtures/wilson-cases.json) that both suites read and
// recompute. A formula agreed in prose and disagreed in arithmetic is
// the failure that table exists to catch.

/** The two-sided z for a confidence level, by bisection on the normal CDF. */
function zFor(confidence) {
  const target = 1 - (1 - confidence) / 2;
  // The standard normal CDF from the error function, itself computed
  // by the Abramowitz and Stegun 7.1.26 approximation: seven digits,
  // which is six more than any published interval here shows.
  const cdf = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
  let low = 0;
  let high = 10;
  for (let step = 0; step < 200; step += 1) {
    const middle = (low + high) / 2;
    if (cdf(middle) < target) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
}

function erf(x) {
  const sign = x < 0 ? -1 : 1;
  const absolute = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * absolute);
  const series =
    t *
    (0.254829592 +
      t *
        (-0.284496736 +
          t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return sign * (1 - series * Math.exp(-absolute * absolute));
}

/**
 * Wilson's score interval, as fractions, clamped to [0, 1].
 *
 * Wilson rather than the normal approximation because a boundary count
 * still has an interval: 0 of 3 is 0 to 56 percent, where the normal
 * approximation reports three observations as certainty.
 */
export function wilsonInterval(successes, trials, confidence = 0.95) {
  if (trials <= 0) {
    throw new Error("a proportion needs at least one trial");
  }
  if (successes < 0 || successes > trials) {
    throw new Error(
      `${String(successes)} successes in ${String(trials)} trials is not a proportion`,
    );
  }
  if (!(confidence > 0 && confidence < 1)) {
    throw new Error("confidence is a probability strictly inside 0 and 1");
  }
  const z = zFor(confidence);
  const observed = successes / trials;
  const denominator = 1 + (z * z) / trials;
  const centre = (observed + (z * z) / (2 * trials)) / denominator;
  const half =
    (z / denominator) *
    Math.sqrt(
      (observed * (1 - observed)) / trials + (z * z) / (4 * trials * trials),
    );
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

/** "79.7 to 86.9", the form a published sentence carries. */
export function intervalPercent(successes, trials, confidence = 0.95) {
  const [low, high] = wilsonInterval(successes, trials, confidence);
  return `${(low * 100).toFixed(1)} to ${(high * 100).toFixed(1)}`;
}
