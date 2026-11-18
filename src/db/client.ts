import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// Lazy singleton. We do NOT connect at import time so that `next build`
// (which loads modules for analysis without a database) never fails.
let cached: PostgresJsDatabase<typeof schema> | undefined;

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (cached) return cached;

  const url = process.env.DATABASE_URL;
  if (!url) {
    // No fallback by design — the platform injects DATABASE_URL via the
    // "postgres" resource. Missing it is a real configuration error.
    throw new Error("DATABASE_URL is not set");
  }

  const client = postgres(url, { max: 10 });
  cached = drizzle(client, { schema });
  return cached;
}
