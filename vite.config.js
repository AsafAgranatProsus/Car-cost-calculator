import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Base path matches the GitHub Pages project URL: https://<user>.github.io/Car-cost-calculator/
export default defineConfig({
  plugins: [react()],
  base: "/Car-cost-calculator/",
});
