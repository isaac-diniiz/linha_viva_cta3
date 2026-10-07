import { defineConfig } from "vitest/config";
import { localDemoPlugin } from "./src/demo/server";

export default defineConfig(({ mode }) => ({
  plugins: mode === "demo" ? [localDemoPlugin()] : [],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: true,
    maxWorkers: 1,
    fileParallelism: false,
  },
}));
