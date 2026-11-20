// vite.config.js
import { defineConfig } from "file:///D:/asistencia/node_modules/vite/dist/node/index.js";
import fs from "fs";
import path from "path";
var __vite_injected_original_dirname = "D:\\asistencia";
function syncVersion() {
  return {
    name: "sync-version",
    closeBundle() {
      const mainPath = path.resolve(__vite_injected_original_dirname, "src/main.js");
      if (!fs.existsSync(mainPath)) return;
      const mainContent = fs.readFileSync(mainPath, "utf8");
      const versionMatch = mainContent.match(/const\s+CURRENT_VERSION\s*=\s*['"]([^'"]+)['"]/);
      if (versionMatch) {
        const version = versionMatch[1];
        const swPath = path.resolve(__vite_injected_original_dirname, "dist/service-worker.js");
        if (fs.existsSync(swPath)) {
          let swContent = fs.readFileSync(swPath, "utf8");
          swContent = swContent.replace(/CACHE_NAME = 'mids-asistencia-v[^']+';/, `CACHE_NAME = 'mids-asistencia-v${version}';`);
          fs.writeFileSync(swPath, swContent);
        }
        const versionJsonPath = path.resolve(__vite_injected_original_dirname, "dist/version.json");
        if (fs.existsSync(versionJsonPath)) {
          fs.writeFileSync(versionJsonPath, JSON.stringify({ version }));
        }
        console.log("\n\u2705 Build sincronizado con la versi\xF3n:", version);
      }
    }
  };
}
var vite_config_default = defineConfig({
  plugins: [syncVersion()],
  server: {
    port: 8080,
    host: true
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxhc2lzdGVuY2lhXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxhc2lzdGVuY2lhXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9hc2lzdGVuY2lhL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5cbmZ1bmN0aW9uIHN5bmNWZXJzaW9uKCkge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICdzeW5jLXZlcnNpb24nLFxuICAgIGNsb3NlQnVuZGxlKCkge1xuICAgICAgY29uc3QgbWFpblBhdGggPSBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnc3JjL21haW4uanMnKTtcbiAgICAgIGlmICghZnMuZXhpc3RzU3luYyhtYWluUGF0aCkpIHJldHVybjtcbiAgICAgIFxuICAgICAgY29uc3QgbWFpbkNvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMobWFpblBhdGgsICd1dGY4Jyk7XG4gICAgICBjb25zdCB2ZXJzaW9uTWF0Y2ggPSBtYWluQ29udGVudC5tYXRjaCgvY29uc3RcXHMrQ1VSUkVOVF9WRVJTSU9OXFxzKj1cXHMqWydcIl0oW14nXCJdKylbJ1wiXS8pO1xuICAgICAgXG4gICAgICBpZiAodmVyc2lvbk1hdGNoKSB7XG4gICAgICAgIGNvbnN0IHZlcnNpb24gPSB2ZXJzaW9uTWF0Y2hbMV07XG4gICAgICAgIFxuICAgICAgICAvLyBVcGRhdGUgc2VydmljZSB3b3JrZXIgaW4gZGlzdFxuICAgICAgICBjb25zdCBzd1BhdGggPSBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnZGlzdC9zZXJ2aWNlLXdvcmtlci5qcycpO1xuICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhzd1BhdGgpKSB7XG4gICAgICAgICAgbGV0IHN3Q29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhzd1BhdGgsICd1dGY4Jyk7XG4gICAgICAgICAgc3dDb250ZW50ID0gc3dDb250ZW50LnJlcGxhY2UoL0NBQ0hFX05BTUUgPSAnbWlkcy1hc2lzdGVuY2lhLXZbXiddKyc7LywgYENBQ0hFX05BTUUgPSAnbWlkcy1hc2lzdGVuY2lhLXYke3ZlcnNpb259JztgKTtcbiAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHN3UGF0aCwgc3dDb250ZW50KTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gVXBkYXRlIHZlcnNpb24uanNvbiBpbiBkaXN0XG4gICAgICAgIGNvbnN0IHZlcnNpb25Kc29uUGF0aCA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdkaXN0L3ZlcnNpb24uanNvbicpO1xuICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyh2ZXJzaW9uSnNvblBhdGgpKSB7XG4gICAgICAgICAgZnMud3JpdGVGaWxlU3luYyh2ZXJzaW9uSnNvblBhdGgsIEpTT04uc3RyaW5naWZ5KHsgdmVyc2lvbiB9KSk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUubG9nKCdcXG5cdTI3MDUgQnVpbGQgc2luY3Jvbml6YWRvIGNvbiBsYSB2ZXJzaVx1MDBGM246JywgdmVyc2lvbik7XG4gICAgICB9XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbc3luY1ZlcnNpb24oKV0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDgwODAsXG4gICAgaG9zdDogdHJ1ZVxuICB9LFxuICBidWlsZDoge1xuICAgIG91dERpcjogJ2Rpc3QnLFxuICAgIGFzc2V0c0RpcjogJ2Fzc2V0cycsXG4gICAgc291cmNlbWFwOiB0cnVlXG4gIH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE2TixTQUFTLG9CQUFvQjtBQUMxUCxPQUFPLFFBQVE7QUFDZixPQUFPLFVBQVU7QUFGakIsSUFBTSxtQ0FBbUM7QUFJekMsU0FBUyxjQUFjO0FBQ3JCLFNBQU87QUFBQSxJQUNMLE1BQU07QUFBQSxJQUNOLGNBQWM7QUFDWixZQUFNLFdBQVcsS0FBSyxRQUFRLGtDQUFXLGFBQWE7QUFDdEQsVUFBSSxDQUFDLEdBQUcsV0FBVyxRQUFRLEVBQUc7QUFFOUIsWUFBTSxjQUFjLEdBQUcsYUFBYSxVQUFVLE1BQU07QUFDcEQsWUFBTSxlQUFlLFlBQVksTUFBTSxnREFBZ0Q7QUFFdkYsVUFBSSxjQUFjO0FBQ2hCLGNBQU0sVUFBVSxhQUFhLENBQUM7QUFHOUIsY0FBTSxTQUFTLEtBQUssUUFBUSxrQ0FBVyx3QkFBd0I7QUFDL0QsWUFBSSxHQUFHLFdBQVcsTUFBTSxHQUFHO0FBQ3pCLGNBQUksWUFBWSxHQUFHLGFBQWEsUUFBUSxNQUFNO0FBQzlDLHNCQUFZLFVBQVUsUUFBUSwwQ0FBMEMsa0NBQWtDLE9BQU8sSUFBSTtBQUNySCxhQUFHLGNBQWMsUUFBUSxTQUFTO0FBQUEsUUFDcEM7QUFHQSxjQUFNLGtCQUFrQixLQUFLLFFBQVEsa0NBQVcsbUJBQW1CO0FBQ25FLFlBQUksR0FBRyxXQUFXLGVBQWUsR0FBRztBQUNsQyxhQUFHLGNBQWMsaUJBQWlCLEtBQUssVUFBVSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQUEsUUFDL0Q7QUFFQSxnQkFBUSxJQUFJLGtEQUEwQyxPQUFPO0FBQUEsTUFDL0Q7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGO0FBRUEsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLFlBQVksQ0FBQztBQUFBLEVBQ3ZCLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxFQUNSO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixXQUFXO0FBQUEsSUFDWCxXQUFXO0FBQUEsRUFDYjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
