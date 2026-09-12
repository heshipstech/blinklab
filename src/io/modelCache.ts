// The model through the Cache API, roadmap 13.10.
//
// The 3.8 MB model file is fetched by this page's own code, so it is
// the one big file whose repeat cost this page can control without a
// service worker: stored in the Cache API on first load and handed to
// the landmarker as bytes, a returning visitor pays for it once,
// whatever the host's cache-control header says. The 12 MB wasm
// runtime CANNOT be treated the same way — its fetch happens inside
// the vendored library, and intercepting another library's fetches
// requires a service worker, a design this row deliberately does not
// smuggle in (docs/cold-load.txt names that bounded end).
//
// Null on ANY failure, and the caller falls back to handing the
// landmarker the plain URL: a visitor in a private window with no
// Cache API, or behind a fetch that fails here, must end with the
// same session they would have had before this module existed.

const MODEL_CACHE = "blinklab-model-v1";

export async function cachedModelBytes(
  url: string,
): Promise<Uint8Array | null> {
  try {
    const cache = await caches.open(MODEL_CACHE);
    const hit = await cache.match(url);
    if (hit !== undefined) {
      return new Uint8Array(await hit.arrayBuffer());
    }
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    await cache.put(url, response.clone());
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}
