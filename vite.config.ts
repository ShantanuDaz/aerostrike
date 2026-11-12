import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";

function collectDistAssets(dir: string, rootDir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectDistAssets(fullPath, rootDir));
    } else if (entry.isFile()) {
      const rel = "/" + path.relative(rootDir, fullPath).replace(/\\/g, "/");
      if (rel !== "/sw.js" && !rel.endsWith(".map")) {
        results.push(rel);
      }
    }
  }
  return results;
}

function aerostrikePwaPrecachePlugin(): Plugin {
  let outDir = "dist";
  return {
    name: "aerostrike-pwa-precache",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const swPath = path.join(outDir, "sw.js");
      if (!fs.existsSync(swPath)) return;

      const discovered = collectDistAssets(outDir, outDir).sort();
      const assets = Array.from(new Set(["/", ...discovered]));

      const hash = crypto.createHash("sha256");
      for (const rel of discovered) {
        const stat = fs.statSync(path.join(outDir, rel.slice(1)));
        hash.update(`${rel}:${stat.size};`);
      }
      const version = hash.digest("hex").slice(0, 12);

      let swCode = fs.readFileSync(swPath, "utf8");
      swCode = swCode.replace(
        /const CACHE_VERSION = '[^']*'; \/\/ __SW_VERSION_OVERRIDE__/,
        `const CACHE_VERSION = '${version}';`,
      );
      swCode = swCode.replace(
        /const PRECACHE_ASSETS = \[[\s\S]*?\]; \/\/ __SW_PRECACHE_OVERRIDE__/,
        `const PRECACHE_ASSETS = ${JSON.stringify(assets, null, 2)};`,
      );
      fs.writeFileSync(swPath, swCode, "utf8");
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] }),
    aerostrikePwaPrecachePlugin(),
  ],
  server: {
    port: 3000,
    open: true,
    host: true,
  },
});
