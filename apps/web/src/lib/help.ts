/** Textos del «?» de cada pantalla. */
export const HELP = {
  ingresos: {
    title: "Cómo funcionan los ingresos",
    items: [
      "Aquí defines lo que cobras de forma fija (nómina, renta). El monto es lo que esperas recibir y sirve para proyectar tus quincenas.",
      "«¿Cuándo cae?»: en cada día de cobro (los defines en Ajustes → Días de cobro) o un día fijo al mes.",
      "El día que te cae, ve a Inicio → Esta quincena y toca «Confirmar» con el monto real (días extra, descuentos). Ese es el que se suma a tu cuenta.",
      "Si tu sueldo varía, elige «El promedio de mis últimos 3 cobros».",
      "Lo que no se repite (te transfirieron, vendiste algo) regístralo en Movimientos → Ingreso.",
    ],
  },
  servicios: {
    title: "Cómo funcionan los servicios",
    items: [
      "Servicio: el monto varía (luz, agua, gas). Suscripción: monto fijo (streaming, gimnasio).",
      "Para un recibo bimestral elige «Bimestral» y en «Mes del próximo cobro» el mes en que vence el siguiente.",
      "El total de arriba es lo que te cuestan al mes: un bimestral de $400 cuenta $200.",
      "Cuando pagues, toca «Pagado» y escribe el monto real. Si lo pagas con tarjeta de crédito, entra en el estado de cuenta de la tarjeta.",
      "«Dividir con»: tú pagas todo y la parte de la otra persona se anota en Más → Me deben.",
    ],
  },
  tarjetas: {
    title: "Cómo funcionan las tarjetas",
    items: [
      "Cada tarjeta tiene ciclos: del día después del corte hasta el siguiente corte. Lo que gastas en ese periodo se paga en la fecha límite.",
      "«Estado de cuenta»: el monto que capturaste del banco o de tu Excel. En un ciclo abierto se le suman los gastos que registres después.",
      "«Estimado»: para ciclos sin estado de cuenta, el promedio de tus últimos 3 o lo que llevas registrado, lo que sea mayor.",
      "Cada pago se asigna a la quincena del último cobro antes de su fecha límite; puedes moverlo con «Cambiar quincena».",
      "Cuando pagues, márcalo como pagado y elige la cuenta de donde salió el dinero.",
    ],
  },
  movimientos: {
    title: "Cómo registrar movimientos",
    items: [
      "Registra aquí tus gastos e ingresos del día a día. «Pagado con» puede ser una cuenta (débito, efectivo) o una tarjeta de crédito.",
      "Un gasto con débito o efectivo baja el saldo de esa cuenta; con tarjeta de crédito se suma a su ciclo actual.",
      "Tu nómina no la registres aquí: confírmala en Inicio el día que te cae.",
      "La categoría alimenta Análisis y el reporte anual. También puedes registrar gastos desde el bot de Telegram.",
    ],
  },
};
