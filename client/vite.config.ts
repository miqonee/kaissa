import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'proxy-sitemap-dev',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url === '/sitemap.xml') {
            try {
              const backendRes = await fetch('http://localhost:4000/sitemap.xml');
              if (backendRes.ok) {
                const text = await backendRes.text();
                res.setHeader('Content-Type', 'application/xml; charset=utf-8');
                res.end(text);
                return;
              }
            } catch {
              // fallback to static file if backend is not running
            }
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      shared: path.resolve(__dirname, '../shared'),
    },
  },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          chess: ['@lichess-org/chessground', 'chess.js'],
          socket: ['socket.io-client'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:4000', ws: true },
      '/sitemap.xml': { target: 'http://localhost:4000', changeOrigin: true },
      '/robots.txt': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
