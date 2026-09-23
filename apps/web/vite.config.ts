/// <reference types="vitest/config" />
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
// The repo-root `.env` is the single place for every variable (README, .env.example); Vite only
// exposes the VITE_* subset to the browser, so pointing envDir at the root leaks nothing.
const ENV_DIR = path.resolve(__dirname, "../..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ENV_DIR, "");
  // Local development proxies the engine so the browser needs no CORS (D-30); `vite preview`
  // and production call VITE_API_URL directly, where the engine's allow-list applies.
  const apiUrl = env.VITE_API_URL || "http://localhost:8000";
  return {
    plugins: [
      react(),
      tailwindcss(),
      // D-32: installable PWA; the app shell is precached and /api/scenarios is served
      // stale-while-revalidate so the demo chips work offline after one visit.
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg", "icons/*.png"],
        manifest: {
          name: "Venture Route",
          short_name: "Venture Route",
          description:
            "An evidence-backed route through the BASIX ecosystem, decided by MeTTa graph rules.",
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: "#f4f1ea",
          theme_color: "#1e5a45",
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
          navigateFallback: "/index.html",
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname === "/api/scenarios",
              handler: "StaleWhileRevalidate",
              options: { cacheName: "scenarios", expiration: { maxEntries: 4 } },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    envDir: ENV_DIR,
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
      // The no-key seam (#44) must not depend on the developer's real .env now that envDir is
      // the repo root: Vitest always runs without Clerk.
      env: { VITE_CLERK_PUBLISHABLE_KEY: "pk_test_replace-me", VITE_OFFLINE_DEMO: "0" },
      setupFiles: ["./test/setup.ts"],
      include: ["test/**/*.test.{ts,tsx}"],
      css: false,
      // Full-app renders (nav, footer, calendar) in jsdom are slow under parallel workers.
      testTimeout: 20_000,
    },
  };
});
