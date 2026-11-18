import { timingSafeEqual } from "node:crypto";

// Verifizierte Aufrufer-Identitaet, die AUSSCHLIESSLICH aus einem geprueften
// Nachweis stammt (Token-Introspektion beim MSH-Auth-Service bzw. dem
// vertrauenswuerdigen Plattform-Proxy) — NIE aus einem rohen, unsignierten
// X-Auth-*-Header.
export interface VerifiedIdentity {
  username: string;
  role: string | null; // MSH-Plattform-Rolle (nicht die App-Rolle) — nur Info.
  userId: string | null;
}

// Liest das MSH-Session-Token: zuerst Cookie `auth_token` (so setzt die
// Plattform das JWT auf `.example.com`), dann `Authorization: Bearer`.
export function extractToken(req: Request): string | null {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
  if (m) {
    const val = decodeURIComponent(m[1]).trim();
    if (val) return val;
  }
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const val = auth.slice(7).trim();
    if (val) return val;
  }
  return null;
}

// Vertraut den rohen X-Auth-*-Headern NUR, wenn der Request beweist, dass er
// durch den Plattform-Proxy kam: Header `x-msh-proxy-secret` muss (konstante
// Zeit) `MSH_S2S_PROXY_SECRET` entsprechen. Default AUS — ist die Env nicht
// gesetzt, ist der Roh-Header-Pfad komplett deaktiviert (Ost-West-Forgery
// bekommt kein Vertrauen).
export function proxyHeaderTrusted(req: Request): boolean {
  const secret = process.env.MSH_S2S_PROXY_SECRET;
  if (!secret) return false;
  const provided = req.headers.get("x-msh-proxy-secret");
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Validiert das Token beim MSH-Auth-Service (Token-Introspektion). Liefert die
// verifizierte Identitaet oder null.
export async function introspect(token: string): Promise<VerifiedIdentity | null> {
  const url = process.env.MSH_AUTH_URL;
  if (!url) return null;
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return null; // Auth-Service nicht erreichbar -> fail-closed (kein Zugriff).
  }
  if (!resp.ok) return null;
  let json: unknown;
  try {
    json = await resp.json();
  } catch {
    return null;
  }
  const data = (json as { data?: Record<string, unknown> } | null)?.data;
  const username = data?.username;
  if (typeof username !== "string" || username.length === 0) return null;
  return {
    username,
    role: typeof data?.role === "string" ? data.role : null,
    userId: data?.user_id != null ? String(data.user_id) : null,
  };
}

// Loest die VERIFIZIERTE Plattform-Identitaet des Aufrufers auf — oder null,
// wenn der Request keinen Identitaetsnachweis traegt.
//
// Reihenfolge (verifizierter Pfad ZUERST):
//   (a) Vertrauenswuerdiger Proxy-Pfad: rohe X-Auth-*-Header, aber NUR mit
//       gueltigem `x-msh-proxy-secret` (Default aus).
//   (b) Verifizierter Token-Pfad: Cookie `auth_token` / Bearer -> Introspektion.
//
// Ein erfundener X-Auth-*-Header OHNE Nachweis ergibt null — identisch zu "gar
// kein Credential". Kein Orakel, kein Vertrauen in ungepruefte Header.
export async function resolveVerifiedIdentity(req: Request): Promise<VerifiedIdentity | null> {
  if (proxyHeaderTrusted(req)) {
    const username = req.headers.get("x-auth-user");
    if (username) {
      return {
        username,
        role: req.headers.get("x-auth-role"),
        userId: req.headers.get("x-auth-id"),
      };
    }
  }

  const token = extractToken(req);
  if (token) {
    const identity = await introspect(token);
    if (identity) return identity;
  }

  return null;
}
