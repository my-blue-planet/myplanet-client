import { defineConfig } from 'vite';
import { resolve } from 'path'
import solidPlugin from 'vite-plugin-solid';
import solidStyled from 'babel-plugin-solid-styled';

export default defineConfig({
  plugins: [
    solidPlugin({babel: {plugins: [[solidStyled, {}]]}}),
    {
      name: "configure-response-headers",
      configureServer: (server) => {
        server.middlewares.use((_req, res, next) => {
          res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
          res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
          next();
        });
      },
    },
  ],
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'main.html'),
        documentation: resolve(__dirname, 'documentation.html'),
        welcome: resolve(__dirname, 'index.html'),
        channelloader: resolve(__dirname, 'channelloader.html'),
      },
    },
  },
});
