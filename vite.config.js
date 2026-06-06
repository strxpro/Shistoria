import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config for the S'Historia React app.
// The codebase historically attached components to `window` and relied on global
// React; we keep that pattern but compile JSX via @vitejs/plugin-react so the
// classic React runtime works the same way.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false,
  },
});
