/** RN-11: el dinero se maneja en centavos enteros. */

/** "1,234.50", "$ 1234.5", "1234" → centavos. Devuelve null si no es un monto válido. */
export function parseMoney(input: string | null | undefined): number | null {
  if (input == null) return null;
  const clean = String(input).replace(/[$\s,]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [int, dec = ""] = clean.replace("-", "").split(".");
  const cents = Number(int) * 100 + Number(dec.padEnd(2, "0"));
  return clean.startsWith("-") ? -cents : cents;
}

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const mxn0 = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

export const formatMXN = (cents: number, opts?: { round?: boolean }) =>
  (opts?.round ? mxn0 : mxn).format(cents / 100);

/** Para campos de formulario: 123450 → "1234.50". */
export const centsToInput = (cents: number | null | undefined) => (cents == null ? "" : (cents / 100).toFixed(2));
