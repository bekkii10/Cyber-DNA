import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, /api/v1/* is proxied to the FastAPI backend.
// Override with VITE_API_PROXY (e.g. http://localhost:8000). If the backend is
// not running, the dashboard falls back to built-in demo data automatically.
const target = process.env.VITE_API_PROXY || 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': { target, changeOrigin: true } } },
});
