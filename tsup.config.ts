import { defineConfig } from "tsup";

export default defineConfig([
  // Main entry + sub-modules
  {
    entry: {
      index: "src/index.ts",
      "realtime/index": "src/realtime/index.ts",
      "codegen/index": "src/codegen/index.ts",
      "migrate/index": "src/migrate/index.ts",
      "flags/index": "src/flags/index.ts",
      "flags/react": "src/flags/react.ts",
      "flags/openfeature": "src/flags/openfeature.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2020",
    treeshake: true,
    splitting: false,
    external: ["react"],
  },
  // CLI binaries
  {
    entry: {
      "codegen/bin": "src/codegen/bin.ts",
      "migrate/bin": "src/migrate/bin.ts",
      "codegen/flags-bin": "src/codegen/flags-bin.ts",
    },
    format: ["esm"],
    sourcemap: true,
    clean: false,
    target: "node18",
    banner: { js: "#!/usr/bin/env node" },
  },
]);
