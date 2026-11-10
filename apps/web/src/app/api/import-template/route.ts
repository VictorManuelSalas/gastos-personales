import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** Fecha en UTC (así la lee el importador) del día `day` del mes `offset` respecto al actual. */
const date = (offset: number, day: number) => {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset, day));
};

const CARDS = [
  { name: "BBVA Azul", cut: 5, due: 25, amounts: [4200, 3850.5, 5120] },
  { name: "Nu", cut: 18, due: 8, amounts: [1980, 2410, 1765.3] },
];

/** Plantilla de ejemplo con el formato que entiende /app/importar. */
export async function GET() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Quincena";
  const bold = (ws: ExcelJS.Worksheet) => {
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };

  const help = wb.addWorksheet("Instrucciones");
  help.getColumn(1).width = 110;
  [
    "Plantilla de ejemplo de Quincena. Reemplaza los datos de ejemplo por los tuyos y súbela en Más → Importar Excel.",
    "",
    "1. Una pestaña por mes (por ejemplo «Octubre 2026») con las columnas: Tarjeta, Cantidad, Fecha de corte, Fecha límite de pago, Pagado y Movimientos.",
    "   Pon una fila por tarjeta o préstamo. Con dos o más meses deducimos solos el día de corte y la regla de pago de cada tarjeta.",
    "   Pagado: escribe «Sí» si ya lo pagaste. Las fechas deben ser fechas de Excel, no texto.",
    "2. «Compras a meses»: Producto, Banco, Precio, Meses a pagar, Meses abonados y Monto abonado. En Banco usa el mismo nombre de la tarjeta.",
    "3. «Me deben»: Nombre, Monto, Concepto y Abonado (lo que ya te han pagado).",
    "",
    "Solo las pestañas mensuales son obligatorias. Puedes borrar las que no uses; esta pestaña de instrucciones se ignora al importar.",
  ].forEach((t) => help.addRow([t]));
  help.getRow(1).font = { bold: true };

  for (const offset of [-2, -1, 0]) {
    const d = date(offset, 1);
    const ws = wb.addWorksheet(`${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`);
    ws.columns = [
      { header: "Tarjeta", key: "name", width: 18 },
      { header: "Cantidad", key: "amount", width: 14, style: { numFmt: '"$"#,##0.00' } },
      { header: "Fecha de corte", key: "cut", width: 16, style: { numFmt: "dd/mm/yyyy" } },
      { header: "Fecha límite de pago", key: "due", width: 20, style: { numFmt: "dd/mm/yyyy" } },
      { header: "Pagado", key: "paid", width: 10 },
      { header: "Movimientos", key: "note", width: 30 },
    ];
    for (const c of CARDS) {
      const dueOffset = c.due < c.cut ? offset + 1 : offset;
      ws.addRow({
        name: c.name,
        amount: c.amounts[offset + 2],
        cut: date(offset, c.cut),
        due: date(dueOffset, c.due),
        paid: offset < 0 ? "Sí" : "No",
        note: offset === 0 ? "Súper, gasolina y Netflix" : "",
      });
    }
    bold(ws);
  }

  const msi = wb.addWorksheet("Compras a meses");
  msi.columns = [
    { header: "Producto", key: "product", width: 24 },
    { header: "Banco", key: "bank", width: 16 },
    { header: "Precio", key: "price", width: 14, style: { numFmt: '"$"#,##0.00' } },
    { header: "Meses a pagar", key: "months", width: 14 },
    { header: "Meses abonados", key: "paidMonths", width: 16 },
    { header: "Monto abonado", key: "paidCents", width: 16, style: { numFmt: '"$"#,##0.00' } },
  ];
  msi.addRows([
    { product: "Celular", bank: "BBVA Azul", price: 12000, months: 12, paidMonths: 3, paidCents: 3000 },
    { product: "Refrigerador", bank: "Nu", price: 9600, months: 6, paidMonths: 1, paidCents: 1600 },
  ]);
  bold(msi);

  const debts = wb.addWorksheet("Me deben");
  debts.columns = [
    { header: "Nombre", key: "name", width: 18 },
    { header: "Monto", key: "amount", width: 14, style: { numFmt: '"$"#,##0.00' } },
    { header: "Concepto", key: "concept", width: 28 },
    { header: "Abonado", key: "paid", width: 14, style: { numFmt: '"$"#,##0.00' } },
  ];
  debts.addRows([
    { name: "Juan", amount: 1500, concept: "Boletos del concierto", paid: 500 },
    { name: "Ana", amount: 800, concept: "Comida de cumpleaños", paid: 0 },
  ]);
  bold(debts);

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="quincena-plantilla.xlsx"',
    },
  });
}
