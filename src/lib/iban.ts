// IBAN helpers — MOD-97 validation, format helpers, deterministic generator
// for backfilling mock employees, and a tiny BIC stub derived from the IBAN's
// bank code (first 4 digits in DE).

const A_CODE = "A".charCodeAt(0);

function letterToNum(ch: string): string {
  return String(ch.charCodeAt(0) - A_CODE + 10);
}

// Pure MOD-97 over a numeric string built per ISO-13616 §5.
function mod97(numeric: string): number {
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    const part = String(remainder) + numeric.slice(i, i + 7);
    remainder = parseInt(part, 10) % 97;
  }
  return remainder;
}

/** Strip spaces, upper-case, and return canonical IBAN string. */
export function normalizeIban(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

/** Format IBAN with a space every 4 chars (display form). */
export function formatIban(input: string): string {
  const n = normalizeIban(input);
  return n.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * MOD-97 IBAN validation per ISO-13616:
 *   1) move first 4 chars to the end,
 *   2) replace letters A-Z by 10-35,
 *   3) IBAN is valid iff mod 97 == 1.
 *
 * Accepts whitespace and any casing.
 */
export function isValidIban(input: string | undefined | null): boolean {
  if (!input) return false;
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;

  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let numeric = "";
  for (const ch of rearranged) {
    numeric += /[A-Z]/.test(ch) ? letterToNum(ch) : ch;
  }
  return mod97(numeric) === 1;
}

/**
 * For German IBANs (DEkk BBBB BBBB CCCC CCCC CC) the first 8 digits after the
 * checksum are the Bankleitzahl. We turn those into a plausible 8-char BIC
 * stub (BLZ + "XXX"). Real BIC lookup would need a registry — this is an
 * editable default for the wizard.
 */
export function deriveBicFromIban(input: string | undefined | null): string {
  if (!input) return "";
  const iban = normalizeIban(input);
  if (!iban.startsWith("DE") || iban.length < 13) return "";
  const blz = iban.slice(4, 12); // 8 numeric digits
  if (!/^\d{8}$/.test(blz)) return "";
  // BIC is ISO-9362: 8 or 11 chars. Mock-derive a stable 8-char placeholder.
  // First 4 = "BANK", next 2 = "DE", next 2 = first two BLZ digits.
  return `BANK${"DE"}${blz.slice(0, 2)}`;
}

/**
 * Build a valid DE IBAN from BLZ (8) + account number (10), computing the
 * correct MOD-97 checksum. Used by the mock-data backfill.
 */
export function buildDeIban(blz: string, account: string): string {
  const bban = blz.padStart(8, "0") + account.padStart(10, "0");
  // Build numeric with country code DE -> 1314, "00" placeholder for checksum
  const numeric =
    bban
      .split("")
      .map((c) => (/[A-Z]/.test(c) ? letterToNum(c) : c))
      .join("") +
    "1314" +
    "00";
  const checksum = 98 - mod97(numeric);
  const cc = String(checksum).padStart(2, "0");
  return `DE${cc}${bban}`;
}
