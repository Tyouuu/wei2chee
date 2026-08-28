import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

/**
 * The lint gate, which until 2026-08-28 was not a gate.
 *
 * `npm run lint` has been in package.json and `eslint` + `eslint-config-next`
 * have been in devDependencies since the project was scaffolded. There has
 * never been a config file of any kind -- no eslint.config.*, no .eslintrc.* --
 * so ESLint 9 exited with "couldn't find an eslint.config.(js|mjs|cjs)" every
 * single time. The script ran, failed, and nothing downstream cared, so the
 * repo has been shipping with react-hooks and next/core-web-vitals switched
 * off for its entire life while appearing to have them on.
 *
 * That is worth more here than the usual style-nagging. This codebase's real
 * gates are tests, tsc and a shelf of purpose-built checkers (check:en,
 * check:contrast, check:registers, check:reachable, check:print,
 * check:isolation) -- none of which can see a missing dependency in a
 * useEffect or an <img> that should be next/image. Those are exactly the two
 * failure modes core-web-vitals and react-hooks exist to catch.
 *
 * Shape taken from node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md
 * rather than from memory, per AGENTS.md: this Next is 16.3.1, ESLint is 9, and
 * the flat-config entry points changed.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypeScript,

  globalIgnores([
    // The defaults eslint-config-next would have applied; re-stated because
    // passing globalIgnores at all replaces them.
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    /* Generated from the database schema by the Supabase CLI. Linting a
       generated file means either editing it (and losing the edit on the next
       generate) or carrying disable comments that the generator will delete. */
    "types/database-generated.ts",

    /* Not ours. `.claude/skills/*` carries vendored bundles that ship with
       tooling -- one minified UMD file alone accounted for 78 of the first
       run's 321 findings. Linting somebody else's build output tells you
       nothing and drowns the findings that are about this codebase. */
    ".claude/**",

    /* Plain-node scripts run outside the bundler: shoot:*, check:*, eval:*.
       They are .mjs with top-level await and no React in sight, and the
       Next/React rule sets have nothing true to say about them. */
    "scripts/**",
  ]),

  {
    /* `_name` is the conventional "I know, and I mean it" -- destructured to
       drop a key, or a positional argument kept for shape. The codebase already
       writes them that way (_icon-placeholder.tsx), so the rule should read
       them that way rather than have the convention argued with by a linter. */
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },

  {
    /*
      DELIBERATELY A WARNING, NOT AN ERROR.

      `next/no-img-element` wants next/image everywhere. It is right in the app
      shell and wrong inside design-system/: those components are rendered into
      the customer's PUBLISHED page and into hundreds of live preview
      thumbnails, where next/image's wrapper markup and lazy loading change the
      layout being previewed -- which is the one thing a preview must not do.
      Turning it off entirely would lose the warning where it is correct, so it
      stays visible and stays non-blocking.
    */
    files: ["design-system/**/*.{ts,tsx}"],
    rules: { "@next/next/no-img-element": "warn" },
  },
]);

export default eslintConfig;
