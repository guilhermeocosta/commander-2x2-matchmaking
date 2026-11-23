import { defineConfig } from "drizzle-kit";

// Only used by `pnpm db:generate`, which needs no database. Migrations are applied by
// scripts/migrate.ts (`pnpm db:migrate`).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  strict: true,
  verbose: true,
});
