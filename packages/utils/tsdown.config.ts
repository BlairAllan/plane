import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  platform: "neutral",
  exports: true,
  // c-swarm: one file per source module, so an app bundles only the helpers it imports (with "sideEffects": false)
  // and not, say, the markdown parser and its HTML toolchain because one string helper was used.
  unbundle: true,
});
