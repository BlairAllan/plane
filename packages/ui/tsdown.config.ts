import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  platform: "neutral",
  exports: true,
  // c-swarm: one file per source module, so an app bundles only the components it imports (with "sideEffects": false)
  // and not, say, the colour picker because a button was used.
  unbundle: true,
});
