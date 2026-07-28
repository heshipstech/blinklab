import { defineConfig } from "vite";

// The site is served from https://heshipstech.github.io/blinklab/,
// a subpath, not a domain root. Every asset URL must start with /blinklab/.
export default defineConfig({
  base: "/blinklab/",
});
