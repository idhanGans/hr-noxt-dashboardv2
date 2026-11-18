import { eq } from "drizzle-orm";

import { getDb } from "@/db/client";
import { employees } from "@/db/schema";
import { resolveVerifiedIdentity } from "@/lib/api/verify";

export type Role = "manager" | "admin" | "staff";

export interface AuthContext {
  authUser: string; // platform login (X-Auth-User)
  employeeId: number; // the matching employee row
  role: Role;
}

// Vor- und Nachname aus dem Plattform-Username ableiten
// ("maya_putri" / "maya.putri" -> "Maya" / "Putri").
function splitUsername(u: string): { first: string; last: string } {
  const parts = u.replace(/[._-]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  if (parts.length === 0) return { first: u, last: "" };
  return { first: cap(parts[0]), last: parts.slice(1).map(cap).join(" ") };
}

// Resolves the logged-in person to an employee + role.
//
// *Who* the caller is comes ONLY from a verified credential — the MSH session
// token (cookie `auth_token` / Bearer) checked against MSH_AUTH_URL, or the
// trusted platform proxy (see resolveVerifiedIdentity). Rohe, unsignierte
// X-Auth-*-Header werden NICHT mehr geglaubt: in-cluster (an Traefik/ForwardAuth
// vorbei) koennte sie sonst jeder Pod selbst setzen und beliebige Identitaet/
// Admin-Rechte vortaeuschen. *Which* employee + welche App-Rolle kommt aus
// unserer employees.auth_user-Spalte.
//
// Just-in-Time-Provisioning: Hat ein VERIFIZIERT autorisierter Nutzer noch
// keinen Mitarbeiter-Datensatz, legen wir einen Basis-Datensatz an (Rolle
// "staff") statt ihn mit 403 auszusperren. So koennen alle Beschaeftigten sich
// mit ihrem bestehenden Plattform-Account anmelden, ohne dass 200 Datensaetze
// vorher importiert werden muessen. Der State-Write passiert damit nur noch auf
// dem verifizierten Pfad. Echte Stammdaten (Name/E-Mail/Abteilung) ergaenzt HR
// per Import/Edit bzw. der/die Beschaeftigte im ESS-Profil; Manager werden von
// einem bestehenden Manager hochgestuft.
export async function getAuthContext(req: Request): Promise<AuthContext | null> {
  const identity = await resolveVerifiedIdentity(req);
  if (!identity) return null;
  const authUser = identity.username;

  const db = getDb();
  const found = await db
    .select({ id: employees.id, role: employees.role })
    .from(employees)
    .where(eq(employees.authUser, authUser))
    .limit(1);

  if (found.length > 0) {
    return { authUser, employeeId: found[0].id, role: found[0].role };
  }

  // Unbekannter, aber authentifizierter Nutzer -> JIT-Datensatz anlegen.
  const { first, last } = splitUsername(authUser);
  try {
    await db
      .insert(employees)
      .values({
        firstName: first,
        lastName: last,
        email: `${authUser}@noxt.local`, // Platzhalter, im ESS-Profil aenderbar
        jobTitle: "—",
        location: "—",
        employmentType: "full_time",
        status: "active",
        hireDate: new Date().toISOString().slice(0, 10),
        salary: "0",
        performanceScore: 0,
        role: "staff",
        authUser,
      })
      .onConflictDoNothing();
  } catch {
    // Race/Unique -> ignorieren, gleich erneut lesen
  }

  const created = await db
    .select({ id: employees.id, role: employees.role })
    .from(employees)
    .where(eq(employees.authUser, authUser))
    .limit(1);

  if (created.length === 0) return null;
  return { authUser, employeeId: created[0].id, role: created[0].role };
}

// Fields only a manager may see.
const SENSITIVE_EMPLOYEE_FIELDS = [
  "salary",
  "iban",
  "bic",
  "taxId",
  "socialSecurityNo",
  "bonusTargetPct",
] as const;

// Removes sensitive fields for non-managers, server-side, so they never
// even reach the browser.
export function stripSensitiveEmployee<T extends Record<string, unknown>>(row: T, role: Role): T {
  if (role === "manager") return row;
  const clone: Record<string, unknown> = { ...row };
  for (const field of SENSITIVE_EMPLOYEE_FIELDS) delete clone[field];
  return clone as T;
}
