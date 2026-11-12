import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Same-origin live pair in `vite` / `vite preview` (matches Vercel `/equity-live` rewrite). */
const pagesLiveProxy = {
  "/equity-live": {
    target: "https://varshavskiy1-beep.github.io",
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/equity-live/, "/portfolio-krsk"),
  },
};

export default defineConfig({
  plugins: [react()],
  // Vercel: "/". GitHub Pages: "VITE_BASE=/portfolio-krsk/ npm run build"
  base: process.env.VITE_BASE || "/",
  build: { outDir: "dist" },
  server: { proxy: pagesLiveProxy },
  preview: { proxy: pagesLiveProxy },
});
