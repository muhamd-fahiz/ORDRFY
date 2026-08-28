import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["supabase/migrations/**", "supabase/seed.sql", "lib/db/database.types.ts"],
  },
];

export default eslintConfig;
