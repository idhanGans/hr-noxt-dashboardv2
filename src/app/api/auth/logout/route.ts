import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Die Anmeldung wird von der Example-Plattform (ForwardAuth) verwaltet — die
// App besitzt keine eigene Session. "Abmelden" schickt den Browser deshalb zur
// Plattform-Anmeldeseite (MSH_LOGIN_URL). Ein echtes Beenden der SSO-Session
// (Cookie loeschen) kann nur die Plattform; zum sauberen Test der Anmeldung ein
// privates/Inkognito-Fenster nutzen.
export async function GET(req: Request) {
  const loginUrl = process.env.MSH_LOGIN_URL;
  const target = loginUrl && /^https?:\/\//.test(loginUrl) ? loginUrl : new URL("/", req.url).toString();
  return NextResponse.redirect(target, { status: 302 });
}
