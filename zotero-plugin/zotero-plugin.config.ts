import { defineConfig } from "zotero-plugin-scaffold";
import pkg from "./package.json";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from root .env.local
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

export default defineConfig({
  source: ["src", "addon"],
  dist: "build",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  updateURL: `https://github.com/occasional16/researchopia/releases/download/release/${
    pkg.version.includes("-") ? "update-beta.json" : "update.json"
  }`,
  xpiDownloadLink:
    "https://github.com/occasional16/researchopia/releases/download/v{{version}}/{{xpiName}}.xpi",

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
    prefs: {
      prefix: pkg.config.prefsPrefix,
    },
    esbuildOptions: [
      {
        entryPoints: ["src/index.ts"],
        define: {
          __env__: `"${process.env.NODE_ENV || "development"}"`,
          __SUPABASE_URL__: JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL || ""),
          __SUPABASE_ANON_KEY__: JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""),
        },
        bundle: true,
        target: "firefox140",
        format: "esm",
        platform: "browser",
        outfile: `build/addon/content/scripts/${pkg.config.addonRef}.js`,
        // 🔥 Bundle @researchopia/shared into the plugin
        external: [], // Don't mark as external, bundle it
      },
    ],
  },

  server: {
    asProxy: true,
  },

  test: {
    waitForPlugin: `() => Zotero.${pkg.config.addonInstance}.data.initialized`,
  },

  // Detailed logging for development
  logLevel: process.env.NODE_ENV === "development" ? "TRACE" : "INFO",
});
