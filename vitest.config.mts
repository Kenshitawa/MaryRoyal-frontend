import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Normalize root path to avoid Windows drive-letter case mismatch (vitest bug on Node v26/Windows)
    root: path.resolve(fileURLToPath(new URL("./", import.meta.url))),
    pool: "vmForks",
  },
});
