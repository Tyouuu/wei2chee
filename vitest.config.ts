import { defineConfig } from "vitest/config"

// Minimal config: this repo's existing tests (lib/openai/analysis-schema.test.ts,
// lib/rate-limit.test.ts) are pure-logic and don't need a DOM, but jsdom doesn't
// break them either. Component tests (design-system/components/__tests__/*)
// need jsdom to render and query React output via @testing-library/react.
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // The brief's field.test.tsx calls test()/expect() as globals (no
    // per-file import). The two existing logic tests import test/expect
    // explicitly from "vitest" instead — that still works fine with
    // globals enabled, so this doesn't disturb them.
    globals: true,
  },
})
