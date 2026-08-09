// Does the server we are about to measure serve the code we built?
//
// On 9 August 2026 it did not, and nobody noticed for twenty minutes.
// A leftover preview server from the previous night still held port
// 4173, so `npm run preview -- --strictPort` refused to start and
// exited, while the old server carried on answering. A check of the
// port returned HTTP 200, which reads as success, and the corpus run
// measured the previous build. It produced recall 69.1% against the
// 69.6% it was supposed to replace, which is exactly plausible enough
// to be believed.
//
// The lesson is narrow and worth stating: a status code proves a server
// is answering, not that it is YOUR server. Vite puts a content hash in
// the bundle filename, so the built name and the served name are the
// cheapest possible proof that they are the same code.
//
// Pure functions, no input and output of its own, so the decision can
// be tested without a server or a build. Issue #175.

const BUNDLE = /index-[A-Za-z0-9_-]+\.js/g;

/**
 * The bundle this repository has built, from the names in dist/assets.
 *
 * Refuses on none and on more than one. Neither is a state a caller can
 * sensibly guess its way out of: no bundle means nothing was built, and
 * two mean an earlier build was left behind, so which one the server is
 * serving is exactly the question we cannot answer.
 */
export function builtBundle(distFileNames) {
  const bundles = distFileNames.filter((name) =>
    /^index-[A-Za-z0-9_-]+\.js$/.test(name),
  );
  if (bundles.length === 0) {
    return { ok: false, reason: "no-build" };
  }
  if (bundles.length > 1) {
    return { ok: false, reason: "many-builds", bundles: bundles.sort() };
  }
  return { ok: true, bundle: bundles[0] };
}

/**
 * The bundle a served page actually references.
 *
 * Returns every distinct match rather than the first. One page should
 * name exactly one, and a page naming two is a broken assumption rather
 * than a thing to pick from.
 */
export function servedBundle(html) {
  const found = [...new Set(html.match(BUNDLE) ?? [])];
  if (found.length === 0) {
    return { ok: false, reason: "no-bundle-in-page" };
  }
  if (found.length > 1) {
    return { ok: false, reason: "many-bundles-in-page", bundles: found.sort() };
  }
  return { ok: true, bundle: found[0] };
}

/**
 * The whole decision: measure, or refuse and say why.
 *
 * Every refusal carries the remedy, because the failure this guards
 * against looked like success and cost twenty minutes. A message that
 * only says "mismatch" would leave the reader in the same fog.
 */
export function checkBundle({ distFileNames, html }) {
  const built = builtBundle(distFileNames);
  if (!built.ok) {
    if (built.reason === "no-build") {
      return {
        ok: false,
        message:
          "Nothing is built. dist/assets holds no index-*.js file.\n" +
          "Run `npm run build` first, then start the preview server.",
      };
    }
    return {
      ok: false,
      message:
        `dist/assets holds ${String(built.bundles.length)} bundles: ${built.bundles.join(", ")}.\n` +
        "An earlier build was left behind, so there is no way to tell which\n" +
        "one the server is serving. Delete dist and run `npm run build`.",
    };
  }

  const served = servedBundle(html);
  if (!served.ok) {
    if (served.reason === "no-bundle-in-page") {
      return {
        ok: false,
        message:
          "The page served on that port references no index-*.js bundle.\n" +
          "Something is answering, but it is not this app. Check what holds\n" +
          "the port with `lsof -nP -iTCP:4173 -sTCP:LISTEN`.",
      };
    }
    return {
      ok: false,
      message:
        `The served page references ${String(served.bundles.length)} bundles: ${served.bundles.join(", ")}.\n` +
        "That is not a page this build produces. Check what holds the port.",
    };
  }

  if (built.bundle !== served.bundle) {
    return {
      ok: false,
      bundle: built.bundle,
      served: served.bundle,
      message:
        "REFUSING TO MEASURE. The server is not serving the code you built.\n" +
        `  built:  ${built.bundle}\n` +
        `  served: ${served.bundle}\n` +
        "\n" +
        "Almost certainly a preview server from an earlier run still holds\n" +
        "the port, so `npm run preview -- --strictPort` exited and the old\n" +
        "server kept answering. It answers with HTTP 200, so nothing looks\n" +
        "wrong. This is what produced a false result on 9 August.\n" +
        "\n" +
        "Fix it:\n" +
        "  lsof -nP -iTCP:4173 -sTCP:LISTEN     # find the old server\n" +
        "  kill <pid>                           # end it\n" +
        "  npm run build\n" +
        "  npm run preview -- --strictPort &    # build on its OWN line",
    };
  }

  return { ok: true, bundle: built.bundle };
}
