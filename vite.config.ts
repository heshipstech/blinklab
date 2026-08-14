import { defineConfig } from "vite";

// The site is served from https://heshipstech.github.io/blinklab/,
// a subpath, not a domain root. Every asset URL must start with /blinklab/.
//
// The build stamps the commit it was built from into a meta tag, so anyone
// reading a published number can tell which code produced it. REMEDIATION E2.
// This project's documents carry dated stamps enforced by a test, and the
// published artefact was the one place that discipline did not reach: the live
// commit could only be established through the deployments API, which needs
// repository access a reader may not have.
//
// A meta tag rather than footer text: it is checkable by anyone who views
// source and changes the design by nothing at all.
//
// GITHUB_SHA is set by Actions. Locally it is absent, and "dev" is the honest
// answer for a build that came from a working tree rather than a commit.
const commit = (process.env.GITHUB_SHA ?? "dev").slice(0, 7);

export default defineConfig({
  base: "/blinklab/",
  plugins: [
    {
      name: "stamp-build-commit",
      transformIndexHtml(html) {
        return html.replace(
          "</head>",
          `  <meta name="build-commit" content="${commit}" />\n  </head>`,
        );
      },
    },
  ],
});
