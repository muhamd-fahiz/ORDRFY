import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // Explicit, not a fix for a reproduced failure: a reported "vitest spawn EPERM" issue
    // could not be reproduced in this session across git-bash, PowerShell, both pools
    // (threads/forks), or CI (which runs on Linux and is unaffected regardless). The default
    // 'threads' pool's worker_threads spawning is the more common source of that error class
    // on Windows under antivirus/EDR or restrictive local security policies; 'forks' uses
    // plain child_process.fork, which tends to be more broadly tolerated. Pinned here as a
    // low-risk preventive measure in case a differently-restricted local terminal session
    // hits what this session's own tool environment did not.
    pool: "forks",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
