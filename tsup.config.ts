import { defineConfig } from "tsup";

export default defineConfig([
  // Main entry + sub-modules
  {
    entry: {
      index: "src/index.ts",
      "realtime/index": "src/realtime/index.ts",
      "codegen/index": "src/codegen/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2020",
    treeshake: true,
    splitting: false,
  },
  // CLI binary
  {
    entry: { "codegen/bin": "src/codegen/bin.ts" },
    format: ["esm"],
    sourcemap: true,
    clean: false,
    target: "node18",
    banner: { js: "#!/usr/bin/env node" },
  },
]);
