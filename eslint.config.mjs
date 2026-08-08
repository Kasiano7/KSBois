import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Artefacts de la CLI Supabase (runtime edge embarqué, branches locales).
    "supabase/.temp/**",
    "supabase/.branches/**",
    // Types générés depuis la base : à régénérer, pas à corriger à la main.
    "src/lib/supabase/database.types.ts",
  ]),
]);

export default eslintConfig;
