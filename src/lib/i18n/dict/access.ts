// Zugriffsverwaltung (Access Management) — DE/EN.
export const access = {
  de: {
    "access.title": "Zugriffsverwaltung",
    "access.subtitle":
      "Lege fest, wer sich anmelden darf und welche Rolle die Person hat. Nur @example.com-Adressen.",
    "access.grantBtn": "Zugriff geben",
    "access.deniedTitle": "Kein Zugriff",
    "access.deniedDesc": "Die Zugriffsverwaltung ist nur für Manager verfügbar.",

    "access.colName": "Name",
    "access.colEmail": "E-Mail",
    "access.colRole": "Rolle",
    "access.colLogin": "Plattform-Login",
    "access.colStatus": "Status",
    "access.colActions": "Aktionen",

    "access.roleManager": "Manager (Vollzugriff)",
    "access.roleAdmin": "Admin",
    "access.roleStaff": "Mitarbeiter (Standard)",
    "access.canLogin": "Kann sich anmelden",
    "access.noLogin": "Kein Login",
    "access.self": "Du",
    "access.revoke": "Zugriff entziehen",

    "access.dialogTitle": "Neuen Zugriff geben",
    "access.dialogDesc":
      "Legt einen Mitarbeiter-Datensatz an und verknüpft den Plattform-Login. Die Person muss zusätzlich vom Plattform-Betreiber für diesen Service freigeschaltet sein.",
    "access.fieldFirstName": "Vorname",
    "access.fieldLastName": "Nachname",
    "access.fieldEmail": "E-Mail (@example.com)",
    "access.fieldAuthUser": "Plattform-Login (Benutzername)",
    "access.fieldAuthUserHint":
      "Der Benutzername, den die Plattform sendet (z. B. \"max_mustermann\") — nicht die E-Mail.",
    "access.fieldRole": "Rolle",
    "access.submit": "Zugriff geben",
    "access.cancel": "Abbrechen",

    "access.toastGranted": "Zugriff für {name} angelegt",
    "access.toastRoleChanged": "Rolle von {name} geändert",
    "access.toastRevoked": "Zugriff für {name} entzogen",
    "access.errEmailDomain": "E-Mail muss auf @example.com enden",
    "access.empty": "Noch keine Zugänge angelegt.",
  },
  en: {
    "access.title": "Access Management",
    "access.subtitle":
      "Decide who may sign in and which role they have. Only @example.com addresses.",
    "access.grantBtn": "Grant access",
    "access.deniedTitle": "No access",
    "access.deniedDesc": "Access management is available to managers only.",

    "access.colName": "Name",
    "access.colEmail": "Email",
    "access.colRole": "Role",
    "access.colLogin": "Platform login",
    "access.colStatus": "Status",
    "access.colActions": "Actions",

    "access.roleManager": "Manager (full access)",
    "access.roleAdmin": "Admin",
    "access.roleStaff": "Staff (standard)",
    "access.canLogin": "Can sign in",
    "access.noLogin": "No login",
    "access.self": "You",
    "access.revoke": "Revoke access",

    "access.dialogTitle": "Grant new access",
    "access.dialogDesc":
      "Creates an employee record and links the platform login. The person must also be enabled for this service by the platform operator.",
    "access.fieldFirstName": "First name",
    "access.fieldLastName": "Last name",
    "access.fieldEmail": "Email (@example.com)",
    "access.fieldAuthUser": "Platform login (username)",
    "access.fieldAuthUserHint":
      "The username the platform sends (e.g. \"max_mustermann\") — not the email.",
    "access.fieldRole": "Role",
    "access.submit": "Grant access",
    "access.cancel": "Cancel",

    "access.toastGranted": "Access created for {name}",
    "access.toastRoleChanged": "Role changed for {name}",
    "access.toastRevoked": "Access revoked for {name}",
    "access.errEmailDomain": "Email must end with @example.com",
    "access.empty": "No access granted yet.",
  },
};
