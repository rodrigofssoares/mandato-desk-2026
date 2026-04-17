import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "child_process";

function getGitSha() {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  server: {
    host: "::",
    port: 3001,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["xlsx"],
  },
  define: {
    __APP_VERSION__: JSON.stringify(getGitSha()),
    __APP_BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
});
