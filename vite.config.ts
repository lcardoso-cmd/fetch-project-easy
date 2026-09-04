// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { createRequire } from "node:module";

// pdf-lib depends on an old UMD build of tslib. Nitro's Cloudflare bundle can
// wrap that module as a default ESM export which is undefined in workerd. Point
// bare tslib imports at the native ESM build so the same bundle runs in both
// Node (tests/build) and Cloudflare Workers (production).
const require = createRequire(import.meta.url);
const tslibEsmPath = require.resolve("tslib/tslib.es6.mjs");

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [mcpPlugin()],
    resolve: {
      alias: [{ find: /^tslib$/, replacement: tslibEsmPath }],
    },
  },
});
