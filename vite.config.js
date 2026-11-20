import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
const __dirname = import.meta.dirname;

function syncVersion() {
  return {
    name: 'sync-version',
    closeBundle() {
      const mainPath = path.resolve(__dirname, 'src/main.js');
      if (!fs.existsSync(mainPath)) return;
      
      const mainContent = fs.readFileSync(mainPath, 'utf8');
      const versionMatch = mainContent.match(/const\s+CURRENT_VERSION\s*=\s*['"]([^'"]+)['"]/);
      
      if (versionMatch) {
        const version = versionMatch[1];
        
        // Update service worker in dist
        const swPath = path.resolve(__dirname, 'dist/service-worker.js');
        if (fs.existsSync(swPath)) {
          let swContent = fs.readFileSync(swPath, 'utf8');
          swContent = swContent.replace(/CACHE_NAME = 'mids-asistencia-v[^']+';/, `CACHE_NAME = 'mids-asistencia-v${version}';`);
          fs.writeFileSync(swPath, swContent);
        }
        
        // Update version.json in dist
        const versionJsonPath = path.resolve(__dirname, 'dist/version.json');
        if (fs.existsSync(versionJsonPath)) {
          fs.writeFileSync(versionJsonPath, JSON.stringify({ version }));
        }
        
        console.log('\n✅ Build sincronizado con la versión:', version);
      }
    }
  };
}

export default defineConfig({
  plugins: [syncVersion()],
  server: {
    port: 8080,
    host: '127.0.0.1',
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:8787' }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  },
  preview: {host:'127.0.0.1',port:8081,strictPort:true,proxy:{'/api':'http://127.0.0.1:8787'}}
});
