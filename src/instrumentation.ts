// Next.js runs register() exactly once when the server boots.
// We use it to create/update the database tables before serving traffic.
export async function register() {
  // Only in the Node.js server runtime (not Edge, not the browser).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runMigrations } = await import("./db/migrate");
    await runMigrations();
    console.log("[db] migrations applied");

    const { seedIfEmpty, ensureOperator } = await import("./db/seed");
    await seedIfEmpty();
    // Operator-Account garantieren (Selbstheilung nach Sandbox-DB-Reset) — sonst
    // ist die App komplett mit 403 gesperrt. Legt keine Demo-Daten an.
    await ensureOperator();
  }
}
