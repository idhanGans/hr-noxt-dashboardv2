import { z } from "zod";

// Zugriffsverwaltung: nur firmeneigene Adressen duerfen Zugriff bekommen.
export const COMPANY_DOMAIN = "@example.com";

const exampleEmail = z
  .string()
  .email()
  .refine((e) => e.toLowerCase().endsWith(COMPANY_DOMAIN), {
    message: `E-Mail muss auf ${COMPANY_DOMAIN} enden`,
  });

// Rolle: "manager" = Vollzugriff (sieht alles, darf verwalten),
// "staff" = Standard (nur eigene Daten). "admin" bleibt aus Kompatibilitaet erlaubt.
export const accessRole = z.enum(["manager", "admin", "staff"]);

// Neuer Zugang: legt einen Mitarbeiter-Datensatz an UND verknuepft den
// Plattform-Login (X-Auth-User), damit die Person sich anmelden kann.
export const accessGrantSchema = z.object({
  firstName: z.string().min(1, "Vorname fehlt"),
  lastName: z.string().min(1, "Nachname fehlt"),
  email: exampleEmail,
  authUser: z.string().min(1, "Plattform-Login fehlt"),
  role: accessRole,
});

// Bestehenden Zugang aendern: Rolle und/oder Login. authUser=null entzieht den Login.
export const accessUpdateSchema = z.object({
  role: accessRole.optional(),
  authUser: z.string().min(1).nullable().optional(),
});

export type AccessGrantInput = z.infer<typeof accessGrantSchema>;
export type AccessUpdateInput = z.infer<typeof accessUpdateSchema>;
