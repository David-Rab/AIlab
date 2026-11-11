import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds to a single self-contained dist/index.html that runs offline (double-click to play).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
});
