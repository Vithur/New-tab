import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

// 递归拷贝目录(支持过滤文件后缀),把扩展运行时所需的二进制资源同步
// 到 dist/。chrome 加载 dist/ (而非根目录) 即可完整运行。
function copyRecursive(srcDir, dstDir, filterExt) {
  if (!existsSync(srcDir)) return;
  mkdirSync(dstDir, { recursive: true });
  for (const name of readdirSync(srcDir)) {
    if (name.startsWith(".")) continue;
    const s = resolve(srcDir, name);
    const d = resolve(dstDir, name);
    const st = statSync(s);
    if (st.isDirectory()) {
      copyRecursive(s, d, filterExt);
      continue;
    }
    if (filterExt && !filterExt.some((ext) => name.toLowerCase().endsWith(ext))) continue;
    copyFileSync(s, d);
  }
}

function syncExtensionAssets() {
  return {
    name: "sync-extension-assets",
    closeBundle() {
      const root = process.cwd();
      const imgFilter = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
      const fontFilter = [".ttf", ".otf", ".woff", ".woff2"];
      const mediaFilter = [".mp3", ".mp4", ".json", ".png", ".jpg", ".jpeg", ".webp", ".gif"];

      const targets = [
        ["public/images", "images", imgFilter],
        ["public/fonts", "fonts", fontFilter],
        ["public/media", "media", mediaFilter],
      ];

      for (const [srcRel, dstRel, exts] of targets) {
        const srcDir = resolve(root, srcRel);
        if (!existsSync(srcDir)) continue;
        copyRecursive(srcDir, resolve(root, "dist", dstRel), exts);
      }

      for (const f of ["manifest.json", "rules.json"]) {
        const src = resolve(root, f);
        if (!existsSync(src)) continue;
        copyFileSync(src, resolve(root, "dist", f));
      }
    },
  };
}

// Extension root serves index.html; built assets go to /assets (root), matching
// the existing structure (manifest newtab = index.html, assets referenced as /assets/*).
export default defineConfig({
  plugins: [react(), syncExtensionAssets()],
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 3000,
  },
});
