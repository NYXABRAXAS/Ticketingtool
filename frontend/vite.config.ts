import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The backend URL for local dev proxying; in production the frontend is a static
// build served separately (e.g. Render Static Site) and talks to VITE_API_BASE_URL.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_API_PROXY ?? "http://localhost:10000",
        changeOrigin: true,
      },
    },
  },
});
