import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Connection errors that just mean "Postgres isn't reachable yet" — on k8s the
// database pod and this app pod start independently, so on a cold start the DB
// DNS/socket may not be ready for a few seconds. These are worth waiting out.
const RETRYABLE = new Set([
  "ENOTFOUND", // DNS name not resolvable yet
  "EAI_AGAIN", // transient DNS failure
  "ECONNREFUSED", // port not open yet
  "ETIMEDOUT",
  "CONNECT_TIMEOUT",
  "57P03", // postgres: cannot_connect_now (still starting up)
]);

const MAX_ATTEMPTS = 30;
const DELAY_MS = 2000; // 30 × 2s ≈ 60s budget before giving up

function errorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.cause?.code ?? e?.code;
}

// Applies any pending SQL files from ./drizzle to the database.
// drizzle keeps a __drizzle_migrations table, so this is idempotent:
// already-applied migrations are skipped. Runs once on server start
// (see src/instrumentation.ts). Waits for the database to become reachable.
export async function runMigrations(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // A dedicated, short-lived connection just for this attempt.
    const client = postgres(url, { max: 1 });
    try {
      await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
      await client.end();
      return; // success
    } catch (err) {
      await client.end({ timeout: 5 }).catch(() => {});
      const code = errorCode(err);
      const isLast = attempt === MAX_ATTEMPTS;
      if (isLast || !code || !RETRYABLE.has(code)) {
        throw err; // real error, or out of retries — fail loud
      }
      console.log(
        `[db] database not reachable yet (attempt ${attempt}/${MAX_ATTEMPTS}, ${code}) — retrying in ${DELAY_MS}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }
}
