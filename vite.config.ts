import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site at /<repo>/. BASE_PATH is set by the deploy workflow.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
});
