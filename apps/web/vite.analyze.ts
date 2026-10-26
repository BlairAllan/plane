/**
 * c-swarm: `ANALYZE=1 pnpm build` writes build/analyze.json: every chunk with its modules (rendered bytes) and
 * static/dynamic imports, plus each module's importers, so "why does this page load that chunk" has an answer
 * without a bundle-visualizer dependency.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

export function analyze(): Plugin {
  return {
    name: "c-swarm-analyze",
    apply: "build",
    generateBundle(_options, bundle) {
      const chunks: Record<string, unknown> = {};
      const importers: Record<string, string[]> = {};
      for (const out of Object.values(bundle)) {
        if (out.type !== "chunk") continue;
        chunks[out.fileName] = {
          entry: out.isEntry,
          dynamicEntry: out.isDynamicEntry,
          facade: out.facadeModuleId,
          imports: out.imports,
          dynamicImports: out.dynamicImports,
          modules: Object.fromEntries(Object.entries(out.modules).map(([id, m]) => [id, m.renderedLength])),
        };
        for (const id of Object.keys(out.modules)) {
          const info = this.getModuleInfo(id);
          if (info) importers[id] = [...info.importers, ...info.dynamicImporters.map((d) => `dyn:${d}`)];
        }
      }
      const dir = path.resolve(process.cwd(), "build");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        path.join(dir, `analyze-${this.environment?.name ?? "client"}.json`),
        JSON.stringify({ chunks, importers })
      );
    },
  };
}
