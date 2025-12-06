
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Allow Vite to load environment variables starting with NEXT_PUBLIC_
  envPrefix: 'NEXT_PUBLIC_',
  server: {
    port: 5173
  }
});
