# PRD - Quincena *[nombre provisional; antes "Gastos Personales"]*

> Versión 0.5 · 2026-11-07 · Autor: Victor Manuel Nuñez Salas
> Basado en el análisis del Google Sheet actual "Gastos de Tarjetas de Crédito" (28 pestañas, oct 2024 – nov 2026).
> Cambios v0.2: centro de notificaciones, gestión de categorías y etiquetas, metas de ahorro y fondos de previsión, ingresos variables, salud financiera, simulador de compras, lista de deseos y priorización MoSCoW.
> Cambios v0.3: días de pago confirmados (15 y último del mes), "Me deben" pasa a Fase 2 con préstamos ligados a MSI, preguntas abiertas actualizadas.
> Cambios v0.4: fuentes de ingreso ilimitadas con monto esperado vs. real, servicios divididos generan "por cobrar", mensualidades del carro opcionales, metas en cuenta real o apartado virtual, despliegue local primero.
> Cambios v0.5: Android como plataforma principal; soporte iPhone como tarea flotante sin fase fija.
> Las recomendaciones de producto, técnicas y financieras están en [RECOMENDACIONES.md](RECOMENDACIONES.md).

---

## 1. Resumen

Web app instalable (PWA) + bot de Telegram para llevar las finanzas personales de un círculo cerrado (familia y amigos cercanos). Automatiza lo que hoy se hace a mano en Google Sheets: generar cada mes los ciclos de las tarjetas de crédito, calcular cuánto hay que pagar en cada quincena y cuánto queda disponible. Además registra en segundos gastos e ingresos desde Telegram, avisa antes de cada fecha límite, permite ahorrar para metas (viajes, fondo de emergencia, compras) y muestra indicadores para mejorar las finanzas. Todo corre en el servidor personal del autor.

## 2. Problema

Hoy el control financiero vive en un Google Sheet con estas limitaciones:

- **Trabajo manual repetitivo:** cada mes se duplica una pestaña y se escriben a mano las fechas de corte y de límite de 7 tarjetas y 1 préstamo. Ya hay 25 pestañas mensuales.
- **Quincenas armadas a mano:** la asignación de cada pago a "Quincena 1" o "Quincena 2" se hace editando fórmulas que cambian cada mes.
- **Saldo encadenado con fórmulas frágiles:** los ingresos y saldos van escritos como números dentro de las fórmulas.
- **No se registran gastos hormiga ni ingresos extra:** solo se ve el total del estado de cuenta; no se sabe en qué se va el dinero.
- **No hay ahorro con propósito:** no existe un lugar para apartar dinero para un viaje, un fondo de emergencia o gastos de temporada (diciembre).
- **No hay avisos:** las fechas límite dependen de acordarse.
- **Información dispersa y desactualizada:** MSI, dinero prestado, servicios divididos entre 2, suscripciones y un pequeño negocio de reventa de internet viven en pestañas sueltas. Por ejemplo, la tabla de MSI ya no coincide con los montos de las tarjetas porque se actualiza a mano.

**Impacto:** flojera de mantenerlo, riesgo de pagar tarde (intereses y afectación al buró), poca visibilidad para reducir gastos y nada de ahorro planeado.

## 3. Objetivo

1. **Cero mantenimiento mensual:** ciclos de tarjetas, MSI, préstamos, servicios e ingresos fijos se generan solos.
2. **Saber al instante cuánto queda por quincena**, ya descontados pagos y apartados para metas.
3. **Registrar un gasto o ingreso en menos de 5 segundos** desde Telegram.
4. **Cero pagos tardíos** gracias a avisos escalonados.
5. **Ahorrar con propósito:** metas con aporte sugerido por quincena y seguimiento de avance.
6. **Mejorar hábitos:** ver en qué se gasta más, medir la salud financiera y frenar compras impulsivas a MSI.

## 4. Usuarios y roles

Círculo cerrado: el registro es **solo por invitación**.

| Rol | Descripción | Permisos principales |
|-----|-------------|----------------------|
| Admin | Dueño del servidor (Victor) | Todo lo del usuario + generar invitaciones, ver/desactivar usuarios, ver el estado del sistema (respaldos, bot, cola de notificaciones). **No ve las finanzas de otros usuarios.** |
| Usuario | Familiar o amigo invitado | Gestionar sus propias tarjetas, cuentas, ingresos, gastos, categorías, metas, MSI, préstamos, presupuestos y notificaciones; vincular su Telegram. |
| Miembro de espacio compartido *[Fase 3]* | Dos o más usuarios que comparten gastos o metas (servicios del hogar ÷ 2, viaje familiar) | Ver y registrar movimientos del espacio, aportar a metas compartidas y ver quién le debe a quién. |

## 5. Alcance

Priorización **MoSCoW**. El MVP es todo lo marcado como **Must**.

| Prioridad | Funcionalidad | Fase |
|---|---|---|
| **Must** | Registro por invitación, login, PWA instalable | 0 |
| **Must** | Tarjetas, préstamos y cuentas; ciclos automáticos | 1 |
| **Must** | Ingresos fijos y variables; vista "Mis quincenas" | 1 |
| **Must** | Gastos con categorías; gestión de categorías | 1 |
| **Must** | MSI con cuotas automáticas | 1 |
| **Must** | Importador del Excel actual | 1 |
| **Must** | Notificaciones de fecha límite y corte (Telegram + push) | 1–2 |
| **Must** | Bot de Telegram: vinculación, registro por texto, comandos | 2 |
| **Must** | Metas de ahorro (viajes, compras) y fondo de emergencia | 2 |
| **Should** | Centro de notificaciones completo con preferencias | 2 |
| **Should** | Dashboard y presupuestos por categoría | 2 |
| **Should** | Fondos de previsión (navidad, seguro del carro, tenencia) | 2 |
| **Should** | Plan de quincena al cobrar ("págate primero") | 2 |
| **Should** | Simulador "¿Me alcanza?" para compras a MSI | 2 |
| **Should** | Panel de salud financiera | 2 |
| **Should** | Etiquetas y modo viaje | 2 |
| **Should** | Voz y fotos de tickets en el bot | 2 |
| **Should** | **Me deben**: préstamos y compras a nombre de otros, con abonos y recordatorios | 2 |
| **Could** | Lista de deseos con enfriamiento de 72 h | 3 |
| **Could** | Detector de suscripciones y gastos recurrentes | 3 |
| **Could** | Espacios compartidos y metas familiares | 3 |
| **Could** | Proyectos/negocios (reventa de internet: ingresos, costos, retorno) | 3 |
| **Could** | Patrimonio neto, reporte anual, exportación | 3 |
| **Won't** (por ahora) | Conexión con bancos, inversiones, facturación (CFDI), app nativa, registro público | — |

## 6. Fuera de alcance (esta versión)

- Conexión directa con bancos (open banking o scraping de portales).
- App nativa en App Store o Play Store (se usa PWA).
- Inversiones, criptomonedas o recomendaciones de productos financieros.
- Facturación (CFDI) o contabilidad fiscal.
- Registro abierto al público y cobro de suscripción.
- Multi-moneda completa: solo MXN, más un saldo informativo en USD con tipo de cambio.

## 7. Funcionalidades principales

### 7.1 Tarjetas, préstamos y ciclos
- **Alta única** de cada tarjeta con banco, día de corte, regla de fecha límite (días después del corte *o* día fijo del mes), límite de crédito y color. Los préstamos (p. ej. la mensualidad del carro) usan monto fijo, fecha de pago y número de mensualidades restantes.
- **Ciclos automáticos:** un proceso diario crea el ciclo de cada tarjeta con su periodo, fecha límite y monto (movimientos registrados + cuotas MSI). El monto se puede **sobrescribir con el total real del estado de cuenta**. Estados: *Abierto → Cortado → Pagado / Vencido*.
- **Pago para no generar intereses vs. pago mínimo:** se capturan ambos montos; la app siempre sugiere pagar el total.
- **Utilización de crédito** por tarjeta (saldo / límite).

### 7.2 Mis quincenas
Vista por quincena con:
- saldo inicial;
- \+ ingresos (fijos y extras);
- − pagos de tarjetas y préstamos asignados;
- − gastos fijos y servicios;
- − **apartados para metas**;
- − gastos con débito o efectivo;
- \= **disponible real**.

Muestra la quincena actual y proyecta las próximas 6. Cada renglón se puede marcar como pagado o apartado, o mover a otra quincena.

### 7.3 Registro de movimientos (gastos e ingresos)
- **Tipos:** gasto, ingreso, transferencia entre cuentas, pago de tarjeta, aporte a meta, retiro de meta, reembolso (dinero que te devuelven y que reduce un gasto) y gasto compartido *[F3]*.
- **Fuentes de ingreso ilimitadas:** el usuario da de alta todas las que quiera, no solo las 2 del Excel (sueldo 1, sueldo 2, negocio de internet, renta, freelance…). Cada fuente tiene nombre, cuenta donde cae, días de pago y **monto esperado**.
- **Monto esperado vs. real:** el sueldo varía (horas extra, quincenas de más días, descuentos). Para proyectar, el monto esperado puede ser **fijo** o el **promedio de los últimos 3 cobros**. El día de cobro el bot pregunta "¿Cuánto te cayó de Sueldo 1?" y el monto real reemplaza al esperado solo en esa quincena.
- **Ingresos extra** sin fuente fija: horas extra pagadas aparte, bonos, aguinaldo, PTU, ventas, reembolsos, abonos de "Me deben". Por Telegram: `+3000 venta antena`, `+1500 horas extra`.
- **Web:** formulario rápido de 3 campos (monto, categoría, cuenta), con fecha y nota opcionales. Botón flotante "+" en todas las pantallas.
- **Telegram:** lenguaje natural (`tacos 180 bbva`, `+7360 sueldo`, `aparta 500 viaje`), con confirmación y botones [Editar] [Categoría] [Borrar].
- **Movimientos divididos** *[F2]*: un ticket del súper repartido entre "Súper" y "Hogar".
- **Adjuntos:** foto del ticket guardada en el servidor.

### 7.4 Categorías y etiquetas
- **Catálogo inicial para México** (editable): Súper y despensa, Restaurantes, Café y antojos, Gasolina, Uber/Didi, Carro (mensualidad, seguro, tenencia, mantenimiento), Hogar y servicios, Internet y telefonía, Salud y farmacia, Gym y deporte, Suscripciones, Ropa, Entretenimiento, Educación, Regalos, Mascotas, Tecnología, Préstamos a terceros, Comisiones e intereses, Otros. Ingresos: Sueldo, Negocio, Freelance, Aguinaldo, Venta, Reembolso, Otros.
- **Gestión completa:** crear, editar, cambiar ícono (emoji) y color, crear subcategorías (2 niveles), reordenar, archivar y **fusionar** (los movimientos de la categoría fusionada pasan a la otra).
- **Atributos por categoría:** tipo (gasto/ingreso), clase (**esencial / estilo de vida / ahorro y deuda**, para la regla 50/30/20), marca de *hormiga*, presupuesto mensual opcional.
- **Reglas automáticas:** "si el comercio contiene OXXO → Café y antojos". El bot **aprende de las correcciones**: si cambias la categoría de "Starbucks", la próxima vez la usa sola.
- **Etiquetas libres** que cruzan categorías: `#viaje-cancun`, `#negocio-internet`, `#navidad-2026`. Se puede ver el total por etiqueta.

### 7.5 Metas y ahorro
- **Meta con fecha** (p. ej. "Viaje a Japón", $40,000 para dic 2027). La app calcula el **aporte sugerido por quincena** = restante ÷ quincenas que faltan, y lo recalcula si te atrasas o adelantas.
- **Fondo de emergencia:** el objetivo se calcula solo como N meses (default 3, configurable a 6) del promedio de gastos *esenciales* de los últimos 3 meses.
- **Fondos de previsión** (sinking funds) para gastos anuales predecibles: navidad, seguro y tenencia del carro, mantenimiento, regalos, inscripciones. Se configuran con monto y fecha anual, se reparten entre 24 quincenas y se reinician cada año.
- **Meta de pago de deuda:** liquidar un MSI o una tarjeta antes de tiempo; muestra el ahorro en intereses cuando aplica.
- **Dónde está el dinero:** cada meta se liga a una cuenta real (p. ej. una cuenta de ahorro) o funciona como **apartado virtual** dentro de una cuenta existente. El saldo disponible de la cuenta excluye lo apartado.
- **Aportes:** manuales (web o `aparta 500 japon` por Telegram) o **automáticos al cobrar** (monto fijo o % del ingreso), que aparecen como renglón en "Mis quincenas".
- **Uso de la meta:** al gastar el dinero (el viaje), los gastos con la etiqueta de la meta se descuentan de ella. Se puede ver *planeado vs. gastado*.
- **Modo viaje:** al activarlo desde la meta o con `/viaje japon`, todo lo que registres en el bot se etiqueta con ese viaje hasta que lo desactives.
- **Visual:** barra de progreso, proyección ("a este ritmo llegas en marzo 2028") y avisos de hitos (25/50/75/100%).
- **Metas compartidas** *[F3]*: varios usuarios aportan a la misma meta (viaje familiar).

### 7.6 Notificaciones
Detalle en la sección 7.11.

### 7.7 Presupuestos
- Tope mensual por categoría o por clase (50/30/20). Alertas al 80% y al 100%.
- Presupuesto quincenal de gastos hormiga, con barra visible en el inicio.

### 7.8 Salud financiera *[Should]*
Panel con indicadores en semáforo, explicados en lenguaje simple:

| Indicador | Cálculo | Verde | Amarillo | Rojo |
|---|---|---|---|---|
| Ingreso comprometido | (MSI + préstamos + fijos) / ingreso mensual | < 35% | 35–50% | > 50% |
| Cuotas MSI | Σ cuotas MSI / ingreso mensual | < 10% | 10–20% | > 20% |
| Utilización de crédito | saldo total / límite total | < 30% | 30–50% | > 50% |
| Fondo de emergencia | ahorro de emergencia / gasto esencial mensual | ≥ 3 meses | 1–3 | < 1 |
| Tasa de ahorro | (ingresos − gastos) / ingresos | ≥ 15% | 5–15% | < 5% |
| Gasto hormiga | hormiga / ingreso mensual | < 5% | 5–10% | > 10% |

*[Supuesto: umbrales configurables; son referencias comunes de finanzas personales, no reglas absolutas.]*

### 7.9 Simulador "¿Me alcanza?" *[Should]*
Antes de comprar: `/simula laptop 12000 12 msi nu`, o desde la web. Muestra:
- la cuota mensual y en qué quincenas cae;
- cómo cambia el disponible de las próximas 6 quincenas;
- cómo cambian los indicadores de "Ingreso comprometido" y "Cuotas MSI";
- si retrasa alguna meta y cuánto ("tu viaje se retrasa 2 meses").

### 7.10 Otros
- **Lista de deseos con enfriamiento** *[Could]*: lo que quieres comprar se guarda 72 h. Después la app pregunta "¿todavía lo quieres?", con el resultado del simulador.
- **Calendario de pagos:** vista mensual con cortes, fechas límite, servicios, suscripciones, días de cobro y aportes a metas.
- **Detector de suscripciones** *[Could]*: identifica cargos repetidos del mismo comercio y avisa antes de la renovación.
- **Me deben**: ver sección 7.12.
- **Proyectos y negocios** *[Could]*: ingresos, costos e inversión separados de lo personal (reventa de internet: clientes, cobro mensual, retorno de inversión).
- **Patrimonio neto** *[Could]*: cuentas + metas + me deben − saldos de tarjetas − MSI pendientes − préstamos.
- **Cierre de quincena:** al terminar cada quincena, el bot manda un resumen y pide conciliar el saldo real de tus cuentas (un toque si cuadra, o capturar la diferencia).
- **Exportación** a CSV o Excel y reporte anual.

### 7.11 Centro de notificaciones
**Canales:** Telegram (principal y más confiable), Web Push (PWA instalada) y bandeja dentro de la app (historial). Correo solo para recuperar la contraseña.

| Evento | Cuándo (default) | Canal default | Acción en el mensaje |
|---|---|---|---|
| **Fecha límite próxima** | 5, 3 y 1 días antes, y el mismo día a las 9:00 y 18:00, mientras el ciclo no esté pagado | Telegram + push | [Marcar pagado] [Ver monto] |
| **Pago vencido** | Día siguiente a la fecha límite, a las 9:00 | Telegram + push | [Ya pagué] [Recordar mañana] |
| **Corte de tarjeta** | Día del corte, a las 10:00 | Telegram | "¿Cuánto dice tu estado de cuenta?" (responde con el monto) |
| **Día de cobro** | Día de pago, a las 8:00 | Telegram + push | Plan de quincena: pagos, apartados y disponible [Confirmar ingreso] |
| **Presupuesto** | Al llegar al 80% y al 100% de una categoría | Telegram | [Ver detalle] |
| **Gasto inusual** *[F2]* | Gasto > 2× el promedio de su categoría | Telegram | [Es correcto] [Editar] |
| **Aporte a meta pendiente** | 2 días después del cobro si no se apartó | Telegram | [Apartar ahora] [Saltar esta quincena] |
| **Hito de meta** | 25 / 50 / 75 / 100% | Telegram + push | 🎉 |
| **Meta en riesgo** | Atraso > 2 aportes | Telegram | [Ajustar fecha] [Ajustar aporte] |
| **MSI por terminar** | Último pago y cuando se libera | Telegram | "Se liberan $X al mes a partir de…" |
| **Servicio o suscripción** | 3 días antes del vencimiento o renovación | Telegram | [Pagado] [Cancelar recordatorio] |
| **Utilización alta** | Una tarjeta supera el 30% de su límite | Bandeja | — |
| **Resumen semanal** | Domingo 19:00 | Telegram | Gastos de la semana, top categorías, hormiga, quincena |
| **Resumen mensual** | Día 1, a las 9:00 | Telegram + bandeja | Mes vs. mes anterior, metas, salud financiera |
| **Recordatorio de registro** | Sin registros en 2 días (apagado por defecto) | Telegram | "¿Gastaste algo hoy?" |
| **Cobro pendiente (Me deben)** | Fecha acordada de cada abono y, sin fecha, cada 30 días mientras haya saldo | Telegram | [Ya me pagó] [Abono parcial] [Posponer] |
| **Préstamo cubre una cuota MSI** | 3 días antes de la fecha límite de la tarjeta | Telegram | "Tu cuota de la TV ($521) depende de que te abonen; llevas $X recibido este mes" |

**Preferencias por usuario:** activar o desactivar cada evento por canal; anticipación personalizada por tarjeta (p. ej. 7 días para la tarjeta con más saldo); **horario de silencio** (default 22:00–08:00, los avisos se envían al terminar); resúmenes en el día y la hora que elijas.

### 7.12 Me deben *[Should · Fase 2]*
Reemplaza la hoja "Deudores". Tu historial muestra que prestas dinero con frecuencia y que **varias compras a MSI en tus tarjetas fueron para otra persona** (TV, laptop, lavadora). Eso significa que tú cargas la deuda mientras la otra persona te paga, así que este módulo va ligado a tus tarjetas y quincenas.

- **Tipos de préstamo:**
  - **Préstamo en efectivo o transferencia:** "presté $2,000 a Luis" (sale de una cuenta).
  - **Compra a nombre de otro:** "compré la lavadora para Ana, $1,750, con BBVA", o a MSI. El cargo está en tu tarjeta; la persona te debe a ti.
  - **Gastos que pagaste por otro:** "pagué el Spotify de Pedro, $120". Se pueden acumular varios conceptos en una misma cuenta por persona.
- **Personas:** catálogo de contactos (solo nombre y nota; sin datos personales), con saldo total pendiente por persona e historial.
- **Abonos:** parciales, con fecha y cuenta donde entró el dinero. Por Telegram: `ana abonó 500`. El abono es un **ingreso no operativo**: entra al saldo de la quincena, pero no cuenta como ingreso en los reportes de ganancias.
- **Plan de pagos opcional:** monto y frecuencia acordados (p. ej. $500 cada quincena), con avisos de cobro y estado *al corriente / atrasado*.
- **Ligado a MSI:** si la compra fue a MSI, la app compara lo que la persona te abona con la cuota que tú pagas al banco y avisa si vas poniendo dinero de tu bolsa.
- **En tus finanzas:**
  - lo prestado **no cuenta como disponible** en la quincena;
  - aparece como activo en el patrimonio neto, pero marcado como "por cobrar";
  - indicador "Dinero prestado / ingreso mensual" en el panel de salud financiera (verde < 10%, amarillo 10–25%, rojo > 25%).
- **Tope opcional:** máximo que estás dispuesto a tener prestado; al registrar un préstamo que lo supera, la app te lo advierte (no lo bloquea).
- **Recordatorio para la otra persona:** botón "Copiar mensaje" que genera un texto amable con el saldo y los abonos ("Hola Ana, te comparto cómo vamos: …"), para que **tú** lo envíes por WhatsApp. La app nunca contacta a terceros.
- **Cierre:** al llegar a $0 se marca *Liquidado*. También se puede marcar como *Perdonado / incobrable*: pasa a gasto en la categoría "Préstamos a terceros".
- **Importador:** migra las filas de "Deudores" (persona, concepto, monto, abonos) e ignora las listas sueltas de montos de esa hoja.
## 8. Flujos de usuario

**Flujo: Registro e inicio**
1. El admin genera una invitación y comparte el enlace.
2. El invitado crea su cuenta (nombre, correo, contraseña).
3. El asistente de bienvenida, en 5 pasos, pide: tarjetas (corte y regla de pago), cuentas con saldo actual, ingresos recurrentes, primera meta (sugiere el fondo de emergencia) y preferencias de notificación.
4. El sistema genera los ciclos, la vista de quincenas y las categorías por defecto.
5. Se muestra "Conecta tu Telegram" e "Instala la app": en Android, Chrome muestra el botón "Instalar app" y luego pide permiso de notificaciones; en iPhone, Safari → Compartir → Agregar a inicio → permitir notificaciones.

**Flujo: Vincular Telegram**
1. El usuario toca "Conectar Telegram" en la web.
2. El sistema crea un token de un solo uso (15 min) y abre `t.me/<bot>?start=<token>`.
3. El usuario presiona *Iniciar* en Telegram.
4. El bot valida el token, guarda el `chat_id` en el usuario y responde "✅ Listo".

**Flujo: Registrar un gasto hormiga por Telegram**
1. El usuario escribe "café 65 nu".
2. El bot interpreta: monto 65, Café y antojos, NU, hoy (primero con un parser rápido; con IA solo si el mensaje es ambiguo).
3. El sistema guarda el gasto y lo asigna al ciclo vigente de NU.
4. El bot responde "✅ $65 · Café y antojos · NU · Hormiga esta quincena: $420 / $800" con botones de edición.

**Flujo: Aviso de fecha límite**
1. 3 días antes de la fecha límite de Mercado Pago, el worker detecta el ciclo *Cortado* y no pagado.
2. Envía por Telegram: "⏰ Mercado Pago: $X vence el lunes 17. Te toca de la quincena del 15." [Marcar pagado].
3. El usuario toca [Marcar pagado] y el sistema registra el pago desde la cuenta default.
4. Los avisos siguientes de ese ciclo se cancelan.

**Flujo: Día de cobro (plan de quincena)**
1. El día 15 a las 8:00 el bot envía el plan: "Entran $X. Pagos esta quincena: $Y (3 tarjetas). Apartados: Viaje $500, Emergencia $1,000, Navidad $400. Disponible para vivir: $Z."
2. El usuario toca [Confirmar ingreso] (o ajusta el monto si cambió).
3. Los apartados automáticos se registran y el disponible queda actualizado.

**Flujo: Crear una meta de viaje**
1. Metas → Nueva → "Viaje a Japón", $40,000, fecha dic 2027, cuenta de ahorro.
2. La app calcula $1,000 por quincena y muestra el impacto en el disponible.
3. El usuario activa el aporte automático al cobrar.
4. Cada quincena se aparta; al llegar al 50% llega un aviso 🎉.
5. Durante el viaje activa `/viaje japon`; los gastos se etiquetan y se descuentan de la meta.

**Flujo: Inicio de ciclo (automático)**
1. Al llegar la fecha de corte, el worker cierra el ciclo y abre el siguiente.
2. Calcula la fecha límite, la asigna a su quincena y programa los avisos.
3. Pide el monto del estado de cuenta por Telegram.

**Flujo: Gestionar categorías**
1. Ajustes → Categorías → ver árbol con totales del mes.
2. Crear "Mascotas" con emoji 🐶, clase *esencial*.
3. Fusionar "Antojos" con "Café y antojos": los 34 movimientos se reasignan.
4. Crear la regla "comercio contiene PETCO → Mascotas".

## 9. Reglas de negocio

- **RN-01 – Fecha límite:** se calcula según la regla de la tarjeta: `corte + N días` (p. ej. BBVA +20, Mercado Pago +10, NU +12) o `día fijo` del mes siguiente (p. ej. Plata día 14). Cada ciclo permite corregirla a mano.
- **RN-02 – Día inhábil:** si la fecha límite cae en sábado, domingo o festivo oficial de México, se muestra la fecha recorrida al día hábil anterior con ⚠️, y los avisos usan esa fecha *[Supuesto: política configurable por tarjeta]*.
- **RN-03 – Días de pago:** los días **15** y **último día del mes** (30 o 31; 28 en febrero, 29 en año bisiesto), sin importar si caen en fin de semana. *[Confirmado por el usuario.]* Cada usuario puede configurar otros días o activar el ajuste "adelantar al viernes previo".
- **RN-04 – Asignación a quincena:** cada pago (tarjeta, préstamo o servicio) se asigna al **último día de pago que sea ≤ a su fecha límite**. Validado con la pestaña "Noviembre 2": límites del 17, 26 y 28 nov → quincena del 15; límites del 30 nov, 2, 12 y 14 dic → quincena del 30. Se puede mover a mano.
- **RN-05 – Monto del ciclo:** `monto calculado = Σ gastos del periodo + cuotas MSI del ciclo`. Si se captura el **monto del estado de cuenta**, ese valor manda.
- **RN-06 – Saldo de quincena:** `saldo final = saldo inicial + ingresos − pagos asignados − fijos − apartados a metas − gastos con débito o efectivo`. El saldo final de una quincena es el inicial de la siguiente. Los gastos con tarjeta de crédito restan cuando se paga la tarjeta, no al comprar (para no contarlos dos veces).
- **RN-07 – MSI:** `cuota = precio / meses` (o la cuota capturada). Se suma a cada ciclo hasta completar los meses.
- **RN-08 – Gasto hormiga:** gasto ≤ $200 MXN *[Supuesto, configurable]* en una categoría marcada como hormiga.
- **RN-09 – Aislamiento:** un usuario jamás puede ver datos de otro, salvo en un espacio compartido al que ambos pertenezcan.
- **RN-10 – Invitación:** de un solo uso; caduca a los 7 días.
- **RN-11 – Moneda:** montos en MXN guardados como enteros en centavos.
- **RN-12 – Aporte sugerido a meta:** `(objetivo − ahorrado) / quincenas restantes hasta la fecha`, redondeado hacia arriba a múltiplos de $50. Se recalcula después de cada aporte o retiro.
- **RN-13 – Apartado virtual:** el dinero apartado para una meta sigue en su cuenta, pero se excluye del "disponible". Una cuenta no puede tener apartados mayores que su saldo; si pasa, se avisa.
- **RN-14 – Fondo de emergencia:** objetivo = N meses × promedio mensual de gastos en categorías *esenciales* de los últimos 3 meses completos. Se recalcula el día 1 de cada mes.
- **RN-15 – Fondo de previsión:** aporte por quincena = monto anual / quincenas hasta la próxima fecha; se reinicia al usarse.
- **RN-16 – Avisos de fecha límite:** solo se envían si el ciclo está *Cortado* y no *Pagado*; al marcarlo pagado se cancelan los avisos pendientes de ese ciclo. Nunca se envían más de 2 avisos del mismo ciclo en un día.
- **RN-17 – Horario de silencio:** los avisos que caen en horario de silencio se envían al terminar ese horario, excepto *Pago vencido*, que espera también.
- **RN-18 – Categorías:** no se puede borrar una categoría con movimientos: solo archivarla o fusionarla. Una categoría archivada no aparece al registrar, pero conserva su historial.
- **RN-19 – Autocategorización:** prioridad: (1) regla explícita del usuario, (2) categoría aprendida para ese comercio, (3) sugerencia de la IA, (4) "Otros" con petición de confirmación.
- **RN-20 – Reembolso:** reduce el gasto de su categoría en el mes original (no cuenta como ingreso).
- **RN-21 – Transferencias y pagos de tarjeta:** no cuentan como gasto ni como ingreso en reportes, para no duplicar.
- **RN-22 – Ingresos esperados vs. reales:** las quincenas futuras usan el monto esperado de cada fuente (fijo o promedio de los últimos 3 cobros reales). La quincena actual usa el monto real en cuanto se confirma; si no se confirma, el esperado se marca como "sin confirmar" ⚠️.
- **RN-23 – Servicios divididos:** un servicio con "dividir entre N" registra el gasto completo y crea automáticamente un "por cobrar" por la parte de cada persona. Si esa persona también usa la app (espacio compartido, Fase 3), se le registra su parte directamente.
- **RN-24 – Préstamos sin dato de mensualidades:** las mensualidades restantes son opcionales. Sin ese dato, el préstamo se proyecta indefinidamente y la app recuerda capturarlo una vez al mes.
- **RN-25 – Apartados:** cada meta puede vivir en una **cuenta real separada** o como **apartado virtual** dentro de una cuenta existente (ver 7.5). El default es apartado virtual en la cuenta principal.

## 10. Requerimientos funcionales

**Cuentas y acceso**
- RF-01: El sistema debe permitir el registro solo con una invitación válida.
- RF-02: El usuario debe poder iniciar y cerrar sesión, y recuperar su contraseña por correo *[Supuesto: SMTP disponible]*.
- RF-03: El usuario debe poder vincular y desvincular su Telegram.
- RF-04: La app debe instalarse como PWA. **Plataforma principal: Android (Chrome).** iPhone (Safari, iOS ≥ 16.4) usa el mismo código y se valida después *[sin fase fija: ver “Soporte iPhone” en el plan por fases]*.

**Tarjetas, ciclos y quincenas**
- RF-05: El usuario debe poder crear, editar y archivar tarjetas, préstamos y cuentas.
- RF-06: El sistema debe generar automáticamente los ciclos de cada tarjeta y préstamo.
- RF-07: El usuario debe poder sobrescribir el monto y la fecha límite de un ciclo y marcarlo como pagado.
- RF-08: El sistema debe mostrar la vista de quincenas (actual + 6 futuras) según RN-04 y RN-06.
- RF-09: El usuario debe poder registrar compras a MSI y ver su avance.

**Movimientos**
- RF-10: El usuario debe poder registrar gastos, ingresos (fijos y variables), transferencias, reembolsos y pagos de tarjeta desde la web y desde Telegram.
- RF-11: El bot debe interpretar mensajes en lenguaje natural y pedir aclaración si falta el monto o la cuenta es ambigua.
- RF-12: El bot debe soportar los comandos `/resumen`, `/quincena`, `/tarjetas`, `/metas`, `/aparta`, `/simula`, `/viaje`, `/deshacer` y `/ayuda`.
- RF-13 *[F2]*: El bot debe aceptar notas de voz y fotos de tickets.
- RF-14 *[F2]*: El usuario debe poder dividir un movimiento en varias categorías.

**Categorías y etiquetas**
- RF-15: El usuario debe poder crear, editar, reordenar, archivar y fusionar categorías y subcategorías (2 niveles), con emoji, color, clase y marca de hormiga.
- RF-16: El usuario debe poder crear reglas de autocategorización por comercio o palabra clave.
- RF-17: El sistema debe recordar la categoría corregida para cada comercio y usarla después.
- RF-18: El usuario debe poder agregar etiquetas libres a cualquier movimiento y ver totales por etiqueta.

**Metas**
- RF-19: El usuario debe poder crear metas con objetivo, fecha, cuenta o apartado virtual, ícono y aporte sugerido.
- RF-20: El sistema debe calcular y recalcular el aporte sugerido por quincena (RN-12).
- RF-21: El usuario debe poder aportar y retirar de una meta desde la web y desde Telegram.
- RF-22: El usuario debe poder activar aportes automáticos al cobrar (monto fijo o %).
- RF-23: El sistema debe ofrecer el fondo de emergencia con objetivo calculado (RN-14).
- RF-24 *[Should]*: El usuario debe poder crear fondos de previsión anuales (RN-15).
- RF-25 *[Should]*: El usuario debe poder activar el modo viaje ligado a una meta.

**Notificaciones**
- RF-26: El sistema debe enviar los avisos de fecha límite, pago vencido y corte según la sección 7.11.
- RF-27: El usuario debe poder configurar cada evento por canal, la anticipación por tarjeta y el horario de silencio.
- RF-28: Las notificaciones de Telegram deben incluir botones de acción (marcar pagado, apartar, etc.).
- RF-29: El sistema debe guardar el historial de notificaciones en una bandeja dentro de la app.
- RF-30 *[Should]*: El sistema debe enviar el plan de quincena el día de cobro y los resúmenes semanal y mensual.

**Análisis**
- RF-31: El sistema debe mostrar el dashboard por categoría, clase, tarjeta, comercio, etiqueta y mes.
- RF-32 *[Should]*: El usuario debe poder definir presupuestos por categoría y recibir alertas.
- RF-33 *[Should]*: El sistema debe mostrar el panel de salud financiera (7.8).
- RF-34 *[Should]*: El usuario debe poder simular una compra a MSI y ver su impacto (7.9).

**Datos**
- RF-35: El sistema debe importar el .xlsx actual (tarjetas, historial de ciclos, MSI, préstamos, servicios).
- RF-36: El usuario debe poder exportar sus datos a CSV o Excel.

**Me deben** *[Should · F2]*
- RF-38: El usuario debe poder registrar préstamos en efectivo, compras a nombre de otra persona (de contado o a MSI) y gastos pagados por otros, agrupados por persona.
- RF-43: El usuario debe poder registrar abonos parciales desde la web y desde Telegram (`ana abonó 500`) y ver el saldo e historial por persona.
- RF-44: El usuario debe poder definir un plan de pagos opcional y recibir avisos de cobro.
- RF-45: El sistema debe comparar los abonos con la cuota MSI ligada y avisar si el usuario está cubriendo la diferencia.
- RF-46: El usuario debe poder generar un mensaje de estado de cuenta para copiar y enviar él mismo, y marcar un préstamo como liquidado o incobrable.

**Fase 3**
- RF-37: Lista de deseos con enfriamiento de 72 h.
- RF-39: Espacios compartidos con división de gastos y metas compartidas.
- RF-40: Proyectos/negocios con ingresos, costos e inversión.
- RF-41: Detector de suscripciones.
- RF-42: Patrimonio neto y reporte anual.

## 11. Requerimientos no funcionales

- RNF-01: **Rendimiento** – Respuesta del bot < 2 s con texto simple (parser local) y < 5 s cuando se usa IA (< 8 s con voz o foto); páginas de la PWA < 1.5 s en Wi-Fi.
- RNF-02: **Seguridad** – HTTPS obligatorio; contraseñas con hash (scrypt, el default de Better Auth); sesiones con cookie httpOnly y SameSite; el webhook del bot se valida con su secret token; aislamiento por `user_id` en todas las consultas, con pruebas automáticas; base de datos sin puerto expuesto; servidor publicado solo mediante Cloudflare Tunnel.
- RNF-03: **Privacidad** – A la IA solo se envía el texto del mensaje (sin nombre ni datos del usuario). La app nunca pide números de tarjeta ni contraseñas bancarias.
- RNF-04: **Disponibilidad** – Servidor casero: se acepta caída ocasional. Los contenedores reinician solos y Telegram reintenta el webhook. Las notificaciones que no se enviaron durante una caída se mandan al volver (cola persistente), sin duplicarse.
- RNF-05: **Respaldos** – `pg_dump` diario cifrado, retención de 30 días, **copia fuera de casa** (nube o disco externo rotado). Prueba de restauración mensual.
- RNF-06: **Escalabilidad** – Diseñado para ≤ 20 usuarios.
- RNF-07: **Usabilidad** – Mobile-first; registrar un gasto en la web en ≤ 3 toques; modo oscuro; textos en español de México.
- RNF-08: **Mantenibilidad** – Todo en TypeScript; despliegue con `docker compose up -d`; migraciones versionadas; la lógica de fechas y dinero en un paquete puro con > 90% de cobertura de pruebas.
- RNF-09: **Zona horaria** – `America/Mexico_City` para todos los cálculos y avisos.
- RNF-10: **Confiabilidad de avisos** – Cada notificación tiene una clave única (evento + ciclo + fecha) para no enviarse dos veces.

## 12. Arquitectura técnica

```
Internet ──► Cloudflare Tunnel (HTTPS, tu dominio; sin abrir puertos del router)
                │
                ▼
     ┌─────────────────── Servidor casero · Docker Compose ───────────────────┐
     │  web     Next.js (App Router) · UI + API + PWA + webhook del bot        │
     │  worker  pg-boss: ciclos, avisos, resúmenes, recálculo de metas         │
     │  db      PostgreSQL 16 (sin puerto expuesto)                            │
     │  backup  pg_dump diario cifrado → copia externa                         │
     └────────────────────────────────────────────────────────────────────────┘
                │                                   │
                ▼                                   ▼
     API de Telegram (bot, avisos)        API de Claude (solo mensajes ambiguos, voz, tickets)
```

**Stack:** Next.js + TypeScript · Tailwind + shadcn/ui · Drizzle ORM · PostgreSQL · Better Auth · grammY · pg-boss (cola y tareas programadas sobre Postgres) · Web Push (VAPID) · Recharts · Zod · Vitest.

**Repositorio (monorepo):**
```
apps/web        Next.js (UI, API, webhook del bot, PWA)
apps/worker     tareas programadas y envío de notificaciones
packages/core   lógica de dominio pura (ciclos, quincenas, MSI, metas, salud financiera) + tests
packages/db     esquema Drizzle + migraciones + seed de categorías
packages/bot    parser de mensajes + handlers de grammY
docker/         compose, configuración del tunnel, scripts de respaldo
```

**Modelo de datos:**

| Entidad | Campos clave |
|---|---|
| `users` | id, nombre, email, rol, telegram_chat_id, zona horaria, días de pago, horario de silencio |
| `invitations` | token, creada_por, usada_por, expira |
| `accounts` | id, user_id, tipo (débito / efectivo / ahorro / usd), nombre, saldo, es_default |
| `credit_lines` | id, user_id, tipo (tarjeta / préstamo), nombre, banco, día_corte, regla_limite (`days_after` / `fixed_day`), valor_regla, límite, pago_fijo, mensualidades_restantes, color, días_aviso |
| `cycles` | id, credit_line_id, inicio, corte, fecha_limite, monto_calculado, monto_estado_cuenta, pago_minimo, quincena_asignada, estado, pagado_en |
| `transactions` | id, user_id, tipo (gasto / ingreso / transferencia / pago_tarjeta / aporte_meta / retiro_meta / reembolso), monto_centavos, fecha, categoría_id, account_id \| credit_line_id, cycle_id, goal_id, comercio, nota, origen (web / telegram / voz / foto / import), adjunto |
| `transaction_splits` | transaction_id, categoría_id, monto |
| `categories` | id, user_id, parent_id, nombre, emoji, color, tipo, clase (esencial / estilo_vida / ahorro), es_hormiga, orden, archivada |
| `category_rules` | id, user_id, patrón, categoría_id, origen (manual / aprendida) |
| `tags`, `transaction_tags` | id, user_id, nombre · transaction_id, tag_id |
| `installments` (MSI) | id, credit_line_id, producto, precio, meses, cuota, primer_ciclo |
| `recurring` | id, user_id, tipo (ingreso / servicio / suscripción), nombre, monto_esperado, modo_estimación (fijo / promedio_3), regla de fecha, account_id, dividir_entre (contact_ids / user_ids), activo |
| *(en `transactions`)* | recurring_id: liga cada cobro real a su fuente de ingreso o servicio |
| `goals` | id, user_id, tipo (meta / emergencia / previsión / deuda), nombre, emoji, objetivo, fecha, account_id, es_virtual, aporte_auto (monto o %), tag_id, estado |
| `budgets` | id, user_id, categoría_id \| clase, monto_mensual |
| `notifications` | id, user_id, evento, clave_unica, canal, programada_para, enviada_en, payload, leída |
| `notification_prefs` | user_id, evento, canal, activo, anticipación |
| `push_subscriptions` | id, user_id, endpoint, keys |
| `telegram_link_tokens` | token, user_id, expira |
| `wishlist` *[F3]* | id, user_id, producto, precio, msi, disponible_desde, estado |
| `contacts` | id, user_id, nombre, nota |
| `receivables` | id, user_id, contact_id, tipo (efectivo / compra / gasto_pagado), concepto, monto, transaction_id (origen), installment_id (MSI ligado), plan (monto, frecuencia), estado (activo / liquidado / incobrable) |
| `receivable_payments` | id, receivable_id, monto, fecha, account_id |
| `projects` *[F3]* | id, user_id, nombre, inversión; los movimientos se ligan por etiqueta |

## 13. Métricas de éxito

| Métrica | Meta | Cómo medirla |
|---------|------|--------------|
| Pestañas nuevas en Google Sheets | 0 a partir del mes 1 | El Sheet deja de usarse |
| Pagos tardíos de tarjetas | 0 | Ciclos con `pagado_en > fecha_limite` |
| Tiempo para registrar un gasto | < 5 s por Telegram | Tiempo entre el mensaje y la confirmación |
| Gastos registrados por semana | ≥ 15 por usuario activo | Conteo en `transactions` |
| Diferencia entre monto calculado y estado de cuenta | < 10% al mes 3 | `monto_calculado` vs. `monto_estado_cuenta` |
| Fondo de emergencia | ≥ 1 mes de gastos esenciales al mes 6 | Meta de emergencia |
| Tasa de ahorro | ≥ 10% del ingreso al mes 6 | Panel de salud financiera |
| Cuotas MSI / ingreso | < 15% al mes 6 | Panel de salud financiera |
| Gasto hormiga | −15% en 3 meses | Dashboard, comparación mensual |
| Usuarios activos | ≥ 3 personas del círculo al mes 2 | Actividad en los últimos 7 días |

## 14. Casos de uso

**CU-01: Registrar gasto por Telegram**
- **Actor**: Usuario
- **Precondición**: Telegram vinculado, al menos una cuenta o tarjeta.
- **Flujo principal**: Escribe "despensa 850 rappi" → el bot interpreta → guarda → confirma.
- **Resultado esperado**: El gasto aparece en el ciclo vigente de Rappi y en el dashboard.

**CU-02: Registrar un ingreso extra**
- **Actor**: Usuario
- **Precondición**: Telegram vinculado.
- **Flujo principal**: Escribe "+1200 internet cliente" → el bot lo registra como ingreso en la categoría Negocio.
- **Resultado esperado**: El disponible de la quincena aumenta $1,200.

**CU-03: Consultar cuánto queda esta quincena**
- **Actor**: Usuario
- **Precondición**: Ingresos recurrentes configurados.
- **Flujo principal**: `/quincena` o abre la PWA.
- **Resultado esperado**: "Quincena del 15 nov: entran $X, pagos $Y, apartados $Z, te quedan $W."

**CU-04: Recibir y atender un aviso de fecha límite**
- **Actor**: Usuario
- **Precondición**: Ciclo cortado y no pagado.
- **Flujo principal**: 3 días antes llega el aviso → toca [Marcar pagado].
- **Resultado esperado**: El ciclo queda pagado, el saldo de la cuenta baja y no llegan más avisos de ese ciclo.

**CU-05: Ajustar un ciclo con el estado de cuenta real**
- **Actor**: Usuario
- **Precondición**: El ciclo ya cortó.
- **Flujo principal**: El bot pide el monto → el usuario responde "4568.71".
- **Resultado esperado**: La quincena se recalcula con el monto real.

**CU-06: Ahorrar para un viaje**
- **Actor**: Usuario
- **Precondición**: Una cuenta de ahorro (o apartado virtual).
- **Flujo principal**: Crea la meta "Cancún", $15,000 en 12 quincenas → la app sugiere $1,250 por quincena → activa el aporte automático.
- **Resultado esperado**: Cada día de cobro se aparta $1,250, el disponible lo refleja y la barra de progreso avanza.

**CU-07: Simular una compra a MSI**
- **Actor**: Usuario
- **Precondición**: Tarjetas e ingresos configurados.
- **Flujo principal**: `/simula celular 9000 12 msi mercado pago`.
- **Resultado esperado**: "Cuota $750/mes. Tu disponible de las próximas 6 quincenas baja a $X. Cuotas MSI pasan de 9% a 12% de tu ingreso. Tu viaje se retrasa 1 mes."

**CU-08: Gestionar categorías**
- **Actor**: Usuario
- **Precondición**: Sesión iniciada.
- **Flujo principal**: Crea la subcategoría "Gasolina" bajo "Carro", fusiona "Gas carro" en ella y crea la regla "PEMEX → Gasolina".
- **Resultado esperado**: Los movimientos se reasignan y los futuros de PEMEX se categorizan solos.

**CU-09: Invitar a un familiar**
- **Actor**: Admin
- **Precondición**: Sesión de admin.
- **Flujo principal**: Ajustes → Invitaciones → Generar → comparte el enlace.
- **Resultado esperado**: El familiar se registra con datos aislados.

**CU-10: Migrar desde Google Sheets**
- **Actor**: Usuario
- **Precondición**: Archivo .xlsx exportado.
- **Flujo principal**: Ajustes → Importar → vista previa → confirmar.
- **Resultado esperado**: Tarjetas con reglas inferidas, historial de ciclos, MSI y servicios cargados.

## 15. Criterios de aceptación

| ID | Funcionalidad | Criterio |
|----|---------------|----------|
| CA-01 | Ciclos automáticos | **Dado** una tarjeta con corte día 10 y regla "+20 días", **cuando** llega el 10 de noviembre, **entonces** existe un ciclo con corte 10 nov y fecha límite 30 nov sin acción del usuario. |
| CA-02 | Regla de día fijo | **Dado** Plata con corte día 14 y límite "día 14", **cuando** corta el 14 nov, **entonces** la fecha límite es 14 dic. |
| CA-03 | Asignación a quincena | **Dado** días de pago 15 y 30, **cuando** una fecha límite es 17 nov, **entonces** el pago va a la quincena del 15 nov; **y cuando** es 2 dic, **entonces** va a la del 30 nov. |
| CA-03b | Último día del mes | **Dado** días de pago "15 y último del mes", **cuando** se generan las quincenas de 2027, **entonces** los cobros de la segunda quincena caen el 31 ene, el 28 feb, el 31 mar y el 30 abr; **y** una fecha límite del 1 mar se asigna a la quincena del 28 feb. |
| CA-04 | Saldo de quincena | **Dado** saldo inicial $12,000, ingresos $12,500, pagos $10,000 y apartados $1,500, **cuando** abro la quincena, **entonces** el disponible es $13,000. |
| CA-05 | Estado de cuenta manda | **Dado** un ciclo con monto calculado $4,000, **cuando** capturo $4,568.71, **entonces** la quincena usa $4,568.71. |
| CA-06 | Registro por Telegram | **Dado** Telegram vinculado, **cuando** envío "café 65 nu", **entonces** en < 2 s recibo la confirmación y el gasto queda en el ciclo vigente de NU. |
| CA-07 | Ambigüedad | **Dado** que envío "uber" sin monto, **cuando** el bot lo procesa, **entonces** pregunta el monto y no guarda nada todavía. |
| CA-08 | MSI | **Dado** un MSI de $5,499 a 18 meses en BBVA, **cuando** se generan ciclos, **entonces** cada uno de los 18 siguientes suma $305.50. |
| CA-09 | Aviso de fecha límite | **Dado** un ciclo cortado con límite el 30 nov y no pagado, **cuando** es 27 nov a las 9:00, **entonces** recibo un aviso por Telegram con el botón [Marcar pagado]. |
| CA-10 | Cancelación de avisos | **Dado** que marqué el ciclo como pagado el 28 nov, **cuando** llegan el 29 y el 30 nov, **entonces** no recibo más avisos de ese ciclo. |
| CA-11 | Horario de silencio | **Dado** un horario de silencio de 22:00 a 08:00, **cuando** un aviso se programa a las 23:00, **entonces** se envía a las 08:00. |
| CA-12 | Sin duplicados | **Dado** que el servidor estuvo apagado de 08:00 a 12:00, **cuando** vuelve, **entonces** el aviso de las 9:00 se envía una sola vez. |
| CA-13 | Aporte sugerido | **Dado** una meta de $15,000 con $3,000 ahorrados y 10 quincenas restantes, **cuando** la abro, **entonces** el aporte sugerido es $1,200 por quincena. |
| CA-14 | Apartado virtual | **Dado** una cuenta con $10,000 y $4,000 apartados para metas, **cuando** veo el disponible, **entonces** muestra $6,000. |
| CA-15 | Fondo de emergencia | **Dado** gastos esenciales promedio de $15,000/mes y N = 3, **cuando** creo el fondo de emergencia, **entonces** el objetivo es $45,000. |
| CA-16 | Modo viaje | **Dado** el modo viaje activo para "Cancún", **cuando** registro "cena 600", **entonces** el gasto queda etiquetado `#cancun` y se descuenta de la meta. |
| CA-17 | Fusionar categorías | **Dado** "Antojos" con 34 movimientos, **cuando** la fusiono con "Café y antojos", **entonces** los 34 pasan a "Café y antojos" y "Antojos" desaparece. |
| CA-18 | Categoría aprendida | **Dado** que corregí "Starbucks" a "Café y antojos", **cuando** registro "starbucks 95", **entonces** se categoriza solo como "Café y antojos". |
| CA-19 | Borrado protegido | **Dado** una categoría con movimientos, **cuando** intento borrarla, **entonces** solo puedo archivarla o fusionarla. |
| CA-20 | Simulador | **Dado** ingreso mensual $25,000 y cuotas MSI de $2,500, **cuando** simulo $9,000 a 12 MSI, **entonces** el indicador de cuotas MSI pasa de 10% a 13%. |
| CA-25 | Me deben: abono | **Dado** un préstamo a Ana de $5,500 con $500 abonados, **cuando** envío "ana abonó 1000", **entonces** el saldo pendiente queda en $4,000 y el abono entra al saldo de la quincena. |
| CA-26 | Me deben: MSI ligado | **Dado** una TV comprada para Ana a 12 MSI con cuota de $521, **cuando** faltan 3 días para la fecha límite y Ana abonó $300 ese mes, **entonces** recibo un aviso de que estoy poniendo $221 de mi bolsa. |
| CA-27 | Me deben: disponible | **Dado** que presté $2,000 en efectivo, **cuando** veo mi quincena, **entonces** esos $2,000 ya no aparecen como disponibles y sí como "por cobrar" en el patrimonio. |
| CA-28 | Me deben: incobrable | **Dado** un préstamo con $750 pendientes, **cuando** lo marco como incobrable, **entonces** se registra un gasto de $750 en "Préstamos a terceros" y desaparece de "por cobrar". |
| CA-29 | Ingreso variable | **Dado** "Sueldo 2" con monto esperado fijo de $7,360, **cuando** el día 15 confirmo $8,100 por horas extra, **entonces** la quincena del 15 usa $8,100 y las quincenas futuras siguen proyectando $7,360. |
| CA-30 | Promedio de ingreso | **Dado** "Sueldo 1" en modo promedio con cobros reales de $5,000, $5,200 y $5,400, **cuando** veo las quincenas futuras, **entonces** proyectan $5,200. |
| CA-31 | Fuentes ilimitadas | **Dado** 2 fuentes de ingreso, **cuando** agrego "Negocio internet" con $2,160 el día 5 de cada mes, **entonces** aparece en la quincena del último día del mes anterior *[cae el 5, después del cobro del 30/31 y antes del 15]*. |
| CA-32 | Servicio dividido | **Dado** internet de $630 dividido entre 2 con un contacto que no usa la app, **cuando** registro el pago, **entonces** se crea un "por cobrar" de $315 a ese contacto. |
| CA-21 | Aislamiento | **Dado** dos usuarios A y B, **cuando** A consulta cualquier endpoint, **entonces** nunca recibe datos de B (pruebas automáticas). |
| CA-22 | Invitación | **Dado** una invitación usada o vencida, **cuando** alguien intenta registrarse, **entonces** se rechaza. |
| CA-23a | PWA Android | **Dado** un teléfono Android con Chrome, **cuando** abro la app por HTTPS, **entonces** Chrome ofrece "Instalar app", abre en pantalla completa con su ícono y recibe notificaciones push aunque la app esté cerrada. |
| CA-23b | PWA iPhone *[cuando se active]* | **Dado** un iPhone con iOS ≥ 16.4, **cuando** agrego la app a inicio y acepto notificaciones, **entonces** abre en pantalla completa y recibe push. |
| CA-24 | Importador | **Dado** el archivo .xlsx actual, **cuando** lo importo, **entonces** se crean las 7 tarjetas y el préstamo con reglas inferidas, el historial de ciclos y los MSI. |

---

## Plan por fases

| Fase | Contenido | Resultado | Estimado *[Supuesto: tiempo parcial]* |
|---|---|---|---|
| **0 – Base** | Monorepo, Docker Compose **en local** (Postgres, web, worker), Better Auth, invitaciones, PWA vacía. Al final, Cloudflare Tunnel con tu dominio para abrirla e instalarla en tu Android (Chrome exige HTTPS para instalar la PWA y recibir push) | Entras a la app desde tu Android | 1 semana |
| **1 – Núcleo** | Tarjetas, préstamos, cuentas, ingresos, ciclos, Mis quincenas, MSI, categorías, importador, avisos de fecha límite por Telegram (bot solo para avisos) | **El Google Sheet deja de usarse** | 3–4 semanas |
| **2 – Hábitos** | Bot de registro, metas y fondo de emergencia, centro de notificaciones, plan de quincena, dashboard, presupuestos, salud financiera, simulador, etiquetas, modo viaje, voz y fotos, Me deben | Gastos hormiga visibles y ahorro en marcha | 5–7 semanas |
| **3 – Extras** | Lista de deseos, espacios compartidos, negocio de internet, suscripciones, patrimonio, exportación | Todo el Sheet reemplazado | Según uso real |
| **Soporte iPhone** *[flotante]* | Probar en Safari/iOS: instalación, push (solo con la app agregada a inicio), cámara para tickets, ajustes visuales (zona segura, barra inferior). El código ya será compatible desde la Fase 0 | La app funciona igual en iPhone | 2–4 días, cuando haya un iPhone para probar |

## Preguntas abiertas

Ninguna bloqueante. Pendiente capturar después: mensualidades restantes del carro (RN-24).

**Resueltas (v0.4):**
- Préstamo del carro: quedan varios meses, dato exacto pendiente → campo opcional (RN-24).
- Servicios ÷ 2: la otra persona *tal vez* use la app → por ahora su parte se registra como "por cobrar" (RN-23); el espacio compartido queda en Fase 3.
- Metas: se soportan cuenta real y apartado virtual; default apartado virtual (RN-25).
- Servidor: ya tiene Docker; se desarrolla y corre en local, con Cloudflare Tunnel (ya instalado) para HTTPS y acceso desde el teléfono.
- Plataforma: Android ahora; iPhone después, sin fase fija (ver “Soporte iPhone”).
- Ingresos: varían (horas extra, días de la quincena) y debe haber más fuentes que las del Excel → fuentes ilimitadas con monto esperado vs. real (7.3, RN-22).

**Resueltas (v0.3):**
- Días de pago: 15 y último día del mes (28 en febrero) → RN-03.
- Pago de tarjetas: siempre el total. La app sigue avisando si un ciclo queda con saldo, pero no es un riesgo actual.
- Hoja "Deudores": son registros de personas que deben → se migran al módulo "Me deben" (7.12); la lista de montos sueltos se ignora en el importador.
