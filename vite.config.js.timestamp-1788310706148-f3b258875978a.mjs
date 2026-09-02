// vite.config.js
import { defineConfig } from "file:///C:/Users/vithur/Documents/Workbuddy/Project%20OS/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/vithur/Documents/Workbuddy/Project%20OS/node_modules/@vitejs/plugin-react/dist/index.js";
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
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
        ["public/media", "media", mediaFilter]
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
    }
  };
}
var vite_config_default = defineConfig({
  plugins: [react(), syncExtensionAssets()],
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 3e3
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFx2aXRodXJcXFxcRG9jdW1lbnRzXFxcXFdvcmtidWRkeVxcXFxQcm9qZWN0IE9TXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFx2aXRodXJcXFxcRG9jdW1lbnRzXFxcXFdvcmtidWRkeVxcXFxQcm9qZWN0IE9TXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy92aXRodXIvRG9jdW1lbnRzL1dvcmtidWRkeS9Qcm9qZWN0JTIwT1Mvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IHsgY29weUZpbGVTeW5jLCBta2RpclN5bmMsIGV4aXN0c1N5bmMsIHJlYWRkaXJTeW5jLCBzdGF0U3luYyB9IGZyb20gXCJub2RlOmZzXCI7XG5pbXBvcnQgeyByZXNvbHZlLCBqb2luIH0gZnJvbSBcIm5vZGU6cGF0aFwiO1xuXG4vLyBcdTkwMTJcdTVGNTJcdTYyRjdcdThEMURcdTc2RUVcdTVGNTUoXHU2NTJGXHU2MzAxXHU4RkM3XHU2RUU0XHU2NTg3XHU0RUY2XHU1NDBFXHU3RjAwKSxcdTYyOEFcdTYyNjlcdTVDNTVcdThGRDBcdTg4NENcdTY1RjZcdTYyNDBcdTk3MDBcdTc2ODRcdTRFOENcdThGREJcdTUyMzZcdThENDRcdTZFOTBcdTU0MENcdTZCNjVcbi8vIFx1NTIzMCBkaXN0L1x1MzAwMmNocm9tZSBcdTUyQTBcdThGN0QgZGlzdC8gKFx1ODAwQ1x1OTc1RVx1NjgzOVx1NzZFRVx1NUY1NSkgXHU1MzczXHU1M0VGXHU1QjhDXHU2NTc0XHU4RkQwXHU4ODRDXHUzMDAyXG5mdW5jdGlvbiBjb3B5UmVjdXJzaXZlKHNyY0RpciwgZHN0RGlyLCBmaWx0ZXJFeHQpIHtcbiAgaWYgKCFleGlzdHNTeW5jKHNyY0RpcikpIHJldHVybjtcbiAgbWtkaXJTeW5jKGRzdERpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gIGZvciAoY29uc3QgbmFtZSBvZiByZWFkZGlyU3luYyhzcmNEaXIpKSB7XG4gICAgaWYgKG5hbWUuc3RhcnRzV2l0aChcIi5cIikpIGNvbnRpbnVlO1xuICAgIGNvbnN0IHMgPSByZXNvbHZlKHNyY0RpciwgbmFtZSk7XG4gICAgY29uc3QgZCA9IHJlc29sdmUoZHN0RGlyLCBuYW1lKTtcbiAgICBjb25zdCBzdCA9IHN0YXRTeW5jKHMpO1xuICAgIGlmIChzdC5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICBjb3B5UmVjdXJzaXZlKHMsIGQsIGZpbHRlckV4dCk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKGZpbHRlckV4dCAmJiAhZmlsdGVyRXh0LnNvbWUoKGV4dCkgPT4gbmFtZS50b0xvd2VyQ2FzZSgpLmVuZHNXaXRoKGV4dCkpKSBjb250aW51ZTtcbiAgICBjb3B5RmlsZVN5bmMocywgZCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gc3luY0V4dGVuc2lvbkFzc2V0cygpIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBcInN5bmMtZXh0ZW5zaW9uLWFzc2V0c1wiLFxuICAgIGNsb3NlQnVuZGxlKCkge1xuICAgICAgY29uc3Qgcm9vdCA9IHByb2Nlc3MuY3dkKCk7XG4gICAgICBjb25zdCBpbWdGaWx0ZXIgPSBbXCIucG5nXCIsIFwiLmpwZ1wiLCBcIi5qcGVnXCIsIFwiLndlYnBcIiwgXCIuZ2lmXCJdO1xuICAgICAgY29uc3QgZm9udEZpbHRlciA9IFtcIi50dGZcIiwgXCIub3RmXCIsIFwiLndvZmZcIiwgXCIud29mZjJcIl07XG4gICAgICBjb25zdCBtZWRpYUZpbHRlciA9IFtcIi5tcDNcIiwgXCIubXA0XCIsIFwiLmpzb25cIiwgXCIucG5nXCIsIFwiLmpwZ1wiLCBcIi5qcGVnXCIsIFwiLndlYnBcIiwgXCIuZ2lmXCJdO1xuXG4gICAgICBjb25zdCB0YXJnZXRzID0gW1xuICAgICAgICBbXCJwdWJsaWMvaW1hZ2VzXCIsIFwiaW1hZ2VzXCIsIGltZ0ZpbHRlcl0sXG4gICAgICAgIFtcInB1YmxpYy9mb250c1wiLCBcImZvbnRzXCIsIGZvbnRGaWx0ZXJdLFxuICAgICAgICBbXCJwdWJsaWMvbWVkaWFcIiwgXCJtZWRpYVwiLCBtZWRpYUZpbHRlcl0sXG4gICAgICBdO1xuXG4gICAgICBmb3IgKGNvbnN0IFtzcmNSZWwsIGRzdFJlbCwgZXh0c10gb2YgdGFyZ2V0cykge1xuICAgICAgICBjb25zdCBzcmNEaXIgPSByZXNvbHZlKHJvb3QsIHNyY1JlbCk7XG4gICAgICAgIGlmICghZXhpc3RzU3luYyhzcmNEaXIpKSBjb250aW51ZTtcbiAgICAgICAgY29weVJlY3Vyc2l2ZShzcmNEaXIsIHJlc29sdmUocm9vdCwgXCJkaXN0XCIsIGRzdFJlbCksIGV4dHMpO1xuICAgICAgfVxuXG4gICAgICBmb3IgKGNvbnN0IGYgb2YgW1wibWFuaWZlc3QuanNvblwiLCBcInJ1bGVzLmpzb25cIl0pIHtcbiAgICAgICAgY29uc3Qgc3JjID0gcmVzb2x2ZShyb290LCBmKTtcbiAgICAgICAgaWYgKCFleGlzdHNTeW5jKHNyYykpIGNvbnRpbnVlO1xuICAgICAgICBjb3B5RmlsZVN5bmMoc3JjLCByZXNvbHZlKHJvb3QsIFwiZGlzdFwiLCBmKSk7XG4gICAgICB9XG4gICAgfSxcbiAgfTtcbn1cblxuLy8gRXh0ZW5zaW9uIHJvb3Qgc2VydmVzIGluZGV4Lmh0bWw7IGJ1aWx0IGFzc2V0cyBnbyB0byAvYXNzZXRzIChyb290KSwgbWF0Y2hpbmdcbi8vIHRoZSBleGlzdGluZyBzdHJ1Y3R1cmUgKG1hbmlmZXN0IG5ld3RhYiA9IGluZGV4Lmh0bWwsIGFzc2V0cyByZWZlcmVuY2VkIGFzIC9hc3NldHMvKikuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKSwgc3luY0V4dGVuc2lvbkFzc2V0cygpXSxcbiAgYmFzZTogXCIvXCIsXG4gIGJ1aWxkOiB7XG4gICAgb3V0RGlyOiBcImRpc3RcIixcbiAgICBlbXB0eU91dERpcjogdHJ1ZSxcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDMwMDAsXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBMFUsU0FBUyxvQkFBb0I7QUFDdlcsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsY0FBYyxXQUFXLFlBQVksYUFBYSxnQkFBZ0I7QUFDM0UsU0FBUyxTQUFTLFlBQVk7QUFJOUIsU0FBUyxjQUFjLFFBQVEsUUFBUSxXQUFXO0FBQ2hELE1BQUksQ0FBQyxXQUFXLE1BQU0sRUFBRztBQUN6QixZQUFVLFFBQVEsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUNyQyxhQUFXLFFBQVEsWUFBWSxNQUFNLEdBQUc7QUFDdEMsUUFBSSxLQUFLLFdBQVcsR0FBRyxFQUFHO0FBQzFCLFVBQU0sSUFBSSxRQUFRLFFBQVEsSUFBSTtBQUM5QixVQUFNLElBQUksUUFBUSxRQUFRLElBQUk7QUFDOUIsVUFBTSxLQUFLLFNBQVMsQ0FBQztBQUNyQixRQUFJLEdBQUcsWUFBWSxHQUFHO0FBQ3BCLG9CQUFjLEdBQUcsR0FBRyxTQUFTO0FBQzdCO0FBQUEsSUFDRjtBQUNBLFFBQUksYUFBYSxDQUFDLFVBQVUsS0FBSyxDQUFDLFFBQVEsS0FBSyxZQUFZLEVBQUUsU0FBUyxHQUFHLENBQUMsRUFBRztBQUM3RSxpQkFBYSxHQUFHLENBQUM7QUFBQSxFQUNuQjtBQUNGO0FBRUEsU0FBUyxzQkFBc0I7QUFDN0IsU0FBTztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ04sY0FBYztBQUNaLFlBQU0sT0FBTyxRQUFRLElBQUk7QUFDekIsWUFBTSxZQUFZLENBQUMsUUFBUSxRQUFRLFNBQVMsU0FBUyxNQUFNO0FBQzNELFlBQU0sYUFBYSxDQUFDLFFBQVEsUUFBUSxTQUFTLFFBQVE7QUFDckQsWUFBTSxjQUFjLENBQUMsUUFBUSxRQUFRLFNBQVMsUUFBUSxRQUFRLFNBQVMsU0FBUyxNQUFNO0FBRXRGLFlBQU0sVUFBVTtBQUFBLFFBQ2QsQ0FBQyxpQkFBaUIsVUFBVSxTQUFTO0FBQUEsUUFDckMsQ0FBQyxnQkFBZ0IsU0FBUyxVQUFVO0FBQUEsUUFDcEMsQ0FBQyxnQkFBZ0IsU0FBUyxXQUFXO0FBQUEsTUFDdkM7QUFFQSxpQkFBVyxDQUFDLFFBQVEsUUFBUSxJQUFJLEtBQUssU0FBUztBQUM1QyxjQUFNLFNBQVMsUUFBUSxNQUFNLE1BQU07QUFDbkMsWUFBSSxDQUFDLFdBQVcsTUFBTSxFQUFHO0FBQ3pCLHNCQUFjLFFBQVEsUUFBUSxNQUFNLFFBQVEsTUFBTSxHQUFHLElBQUk7QUFBQSxNQUMzRDtBQUVBLGlCQUFXLEtBQUssQ0FBQyxpQkFBaUIsWUFBWSxHQUFHO0FBQy9DLGNBQU0sTUFBTSxRQUFRLE1BQU0sQ0FBQztBQUMzQixZQUFJLENBQUMsV0FBVyxHQUFHLEVBQUc7QUFDdEIscUJBQWEsS0FBSyxRQUFRLE1BQU0sUUFBUSxDQUFDLENBQUM7QUFBQSxNQUM1QztBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0Y7QUFJQSxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxHQUFHLG9CQUFvQixDQUFDO0FBQUEsRUFDeEMsTUFBTTtBQUFBLEVBQ04sT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsYUFBYTtBQUFBLElBQ2IsdUJBQXVCO0FBQUEsRUFDekI7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
