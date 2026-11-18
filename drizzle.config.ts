import { defineConfig } from "drizzle-kit";

// Config for `drizzle-kit generate` (turns src/db/schema.ts into SQL files
// under ./drizzle). Generating does NOT need a live database connection —
// migrations are applied at container startup (see src/db/migrate.ts).
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
});
