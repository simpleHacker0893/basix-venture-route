/// <reference types="vitest/config" />
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Local development proxies the engine so the browser needs no CORS (D-30); `vite preview`
  // and production call VITE_API_URL directly, where the engine's allow-list applies.
  const apiUrl = env.VITE_API_URL || "http://localhost:8000";
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": { target: apiUrl, changeOrigin: true },
        "/health": { target: apiUrl, changeOrigin: true },
      },
    },
    preview: { port: 4173 },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./test/setup.ts"],
      include: ["test/**/*.test.{ts,tsx}"],
      css: false,
    },
  };
});
