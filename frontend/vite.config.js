import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // frontend dev port
    proxy: {
      // Forward all /api requests to Flask backend
      "/api": {
        target: "http://127.0.0.1:5000", // change if your Flask runs on another port
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
