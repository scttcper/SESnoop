import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'zrender',
              test: /node_modules[\\/]zrender[\\/]/,
              priority: 2,
            },
            {
              name: 'echarts',
              test: /node_modules[\\/]echarts[\\/]/,
              priority: 1,
            },
          ],
        },
      },
    },
  },
  plugins: [react(), cloudflare(), tailwindcss()],
});
