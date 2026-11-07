import { iso, parseMoney, type SheetInstallment, type SheetRow } from "@gp/core";
import ExcelJS from "exceljs";

/** Valor "real" de una celda: resultado de fórmulas, texto enriquecido, fechas. */
function cellValue(v: ExcelJS.CellValue): unknown {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return cellValue((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
    if ("text" in v) return (v as ExcelJS.CellHyperlinkValue).text;
    if ("error" in v) return null;
  }
  return v;
}

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

function toCents(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v * 100);
  if (typeof v === "string") return parseMoney(v);
  return null;
}

/** Las fechas de exceljs vienen en UTC (medianoche del día de la celda). */
function toISO(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return iso(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  if (typeof v === "number" && v > 20000 && v < 80000) {
    // Número de serie de Excel.
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86_400_000);
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return null;
}

const isYes = (v: unknown) => ["si", "sí", "true", "pagado", "x", "1"].includes(norm(v)) || v === true;

/** Busca en las primeras filas un encabezado con todas las columnas requeridas. */
function findHeader(ws: ExcelJS.Worksheet, matchers: Record<string, (h: string) => boolean>, required: string[]) {
  for (let r = 1; r <= Math.min(6, ws.rowCount); r++) {
    const cols: Record<string, number> = {};
    ws.getRow(r).eachCell((cell, col) => {
      const h = norm(cellValue(cell.value));
      for (const [key, test] of Object.entries(matchers)) if (cols[key] == null && test(h)) cols[key] = col;
    });
    if (required.every((k) => cols[k] != null)) return { row: r, cols };
  }
  return null;
}

export type ParsedWorkbook = {
  rows: SheetRow[];
  installments: SheetInstallment[];
  monthSheets: string[];
  skippedSheets: string[];
};

export async function parseWorkbook(data: ArrayBuffer): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);

  const rows: SheetRow[] = [];
  const installments: SheetInstallment[] = [];
  const monthSheets: string[] = [];
  const skippedSheets: string[] = [];

  wb.worksheets.forEach((ws, sheetIndex) => {
    // Pestaña mensual de tarjetas.
    const month = findHeader(
      ws,
      {
        name: (h) => h.startsWith("tarjeta"),
        amount: (h) => h === "cantidad" || h === "monto",
        cut: (h) => h.includes("corte"),
        due: (h) => h.includes("limite"),
        paid: (h) => h === "pagado",
        note: (h) => h.startsWith("movimiento"),
      },
      ["name", "amount", "cut", "due"],
    );
    if (month) {
      let found = 0;
      for (let r = month.row + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const name = String(cellValue(row.getCell(month.cols.name!).value) ?? "").trim();
        if (!name) continue;
        if (/^cantidad/i.test(name) || /total|pendiente/i.test(name)) break;
        const cut = toISO(cellValue(row.getCell(month.cols.cut!).value));
        const due = toISO(cellValue(row.getCell(month.cols.due!).value));
        const amountCents = toCents(cellValue(row.getCell(month.cols.amount!).value)) ?? 0;
        if (!cut || !due) continue;
        rows.push({
          sheet: ws.name,
          sheetIndex,
          name,
          amountCents: Math.max(0, amountCents),
          cut,
          due,
          paid: month.cols.paid ? isYes(cellValue(row.getCell(month.cols.paid).value)) : false,
          note: month.cols.note ? String(cellValue(row.getCell(month.cols.note).value) ?? "") : undefined,
        });
        found++;
      }
      if (found) monthSheets.push(ws.name);
      return;
    }

    // Hoja de compras a meses.
    const msi = findHeader(
      ws,
      {
        product: (h) => h === "producto",
        bank: (h) => h === "banco" || h === "tarjeta",
        price: (h) => h === "precio",
        months: (h) => h.startsWith("meses a pagar") || h === "meses",
        paidMonths: (h) => h.startsWith("meses abonados"),
        paidCents: (h) => h.startsWith("monto abonado"),
      },
      ["product", "bank", "price", "months"],
    );
    if (msi) {
      for (let r = msi.row + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const product = String(cellValue(row.getCell(msi.cols.product!).value) ?? "").trim();
        if (!product) continue;
        const priceCents = toCents(cellValue(row.getCell(msi.cols.price!).value));
        const months = Number(cellValue(row.getCell(msi.cols.months!).value));
        if (!priceCents || !Number.isInteger(months) || months < 1) continue;
        installments.push({
          product,
          bank: String(cellValue(row.getCell(msi.cols.bank!).value) ?? "").trim(),
          priceCents,
          months,
          paidMonths: msi.cols.paidMonths ? Number(cellValue(row.getCell(msi.cols.paidMonths).value)) || 0 : 0,
          paidCents: msi.cols.paidCents ? toCents(cellValue(row.getCell(msi.cols.paidCents).value)) : null,
        });
      }
      return;
    }

    skippedSheets.push(ws.name);
  });

  return { rows, installments, monthSheets, skippedSheets };
}
