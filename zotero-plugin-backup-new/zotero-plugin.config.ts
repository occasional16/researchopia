import { defineConfig } from "zotero-plugin-scaffold";
import pkg from "./package.json";

export default defineConfig({
  source: ["src", "addon"],
  dist: "build",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  updateURL: `https://github.com/occasional15/researchopia/releases/download/release/update.json`,
  xpiDownloadLink: `https://github.com/occasional15/researchopia/releases/download/release/researchopia.xpi`,
  
  build: {
    assets: ["addon/**/*.*"],
    define: {
      ...pkg.config,
      author: pkg.author,
      description: pkg.description,
      homepage: pkg.homepage,
      buildVersion: pkg.version,
      buildTime: "{{buildTime}}",
    },
    esbuildOptions: [
      {
        entryPoints: ["src/index.ts"],
        define: {
          __env__: `"${process.env.NODE_ENV ?? "development"}"`,
        },
        bundle: true,
        target: "firefox115",
        outfile: `build/addon/content/scripts/index.js`,
      },
    ],
  },

  release: {
    bumpp: {
      execute: "npm run build",
    },
  },

  server: {
    asProxy: true,
  },
});
