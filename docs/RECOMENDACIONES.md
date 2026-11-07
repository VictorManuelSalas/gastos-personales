# Recomendaciones – producto, técnica y finanzas

> 2026-11-07 · Complemento del [PRD](PRD.md).
> El análisis con tus números reales está en `docs/privado/analisis-financiero.md`, que **no se sube a GitHub** (está en `.gitignore`).
> Aviso: no soy asesor financiero certificado. Lo que sigue son principios generales de finanzas personales aplicados a lo que vi en tu Sheet, no asesoría de inversión.

---

## 1. Como asesor financiero: los principios que la app debe empujar

La app no debe ser solo un registro. Cada función debería empujar alguno de estos hábitos. Si una función no ayuda a ninguno, probablemente sobra.

| # | Principio | Cómo lo empuja la app |
|---|---|---|
| 1 | **Paga siempre el total de la tarjeta, nunca el mínimo.** Las tarjetas en México cobran tasas de interés muy altas; usarlas sin pagar intereses es gratis, financiarse con ellas sale carísimo. | Avisos escalonados, mostrar el "pago para no generar intereses" como el único monto sugerido y alerta roja si un ciclo queda con saldo. |
| 2 | **Págate primero.** Ahorra al cobrar, no con lo que sobra al final, porque nunca sobra. | Plan de quincena el día de cobro con apartados automáticos antes del "disponible para vivir". |
| 3 | **Fondo de emergencia antes que cualquier otra meta.** De 3 a 6 meses de gastos esenciales, en una cuenta separada y líquida. Es lo que evita endeudarte cuando falla el carro o hay un gasto médico. | Primera meta sugerida en el onboarding, con el objetivo calculado de tus gastos reales. |
| 4 | **Los gastos "inesperados" casi nunca lo son.** Diciembre, el seguro y la tenencia del carro, regalos y mantenimiento pasan cada año. | Fondos de previsión: monto anual ÷ 24 quincenas. |
| 5 | **Los MSI no son gratis para tu flujo.** No cobran intereses, pero comprometen tu ingreso futuro, y varios MSI encimados te dejan sin margen meses después. | Simulador "¿Me alcanza?", indicador de cuotas MSI / ingreso y lista de deseos con 72 h de enfriamiento. |
| 6 | **Lo que no se mide, no se reduce.** Los gastos hormiga suelen ser del 5 al 15% del ingreso y son invisibles en el estado de cuenta. | Registro por Telegram en 5 s, presupuesto hormiga quincenal y resumen semanal. |
| 7 | **Prestar dinero a conocidos = considéralo un regalo hasta que te paguen.** | Módulo "Me deben" con tope mensual opcional; lo prestado no cuenta como disponible. |
| 8 | **Menos tarjetas = menos fechas, menos errores.** Mantener muchas tarjetas activas multiplica cortes, fechas límite y la tentación. | Reporte de "uso por tarjeta": muestra cuáles casi no usas o cuáles solo concentran compras a MSI. |
| 9 | **Revisa una vez por quincena, 10 minutos.** La constancia vale más que la perfección. | Cierre de quincena: un resumen y "¿cuadra tu saldo?" con un toque. |
| 10 | **Mide tu avance con pocos números.** | Panel de salud financiera: 6 indicadores en semáforo, no 40 gráficas. |

**Orden recomendado para cualquier usuario de la app** (es lo que debería guiar el onboarding):
1. Cero intereses de tarjeta: pagar siempre el total.
2. Fondo de emergencia inicial: 1 mes de gastos esenciales.
3. Dejar de encimar MSI hasta que las cuotas bajen de ~10–15% del ingreso.
4. Fondos de previsión (diciembre, carro).
5. Fondo de emergencia completo: 3 a 6 meses.
6. Metas de disfrute (viajes, compras) **con dinero ya ahorrado**, no a MSI.
7. Para invertir a largo plazo, buscar información en fuentes oficiales (CONDUSEF) o con un asesor certificado. Queda fuera del alcance de la app.

---

## 2. Como programador: recomendaciones sinceras

### 2.1 El riesgo número 1 es el alcance, no la técnica
El PRD v0.2 tiene más de 40 requerimientos. Si intentas construir todo antes de usarlo, lo más probable es que el proyecto se quede a medias, como pasa con la mayoría de los proyectos personales.
- **Construye la Fase 1 y úsala un mes entero antes de la Fase 2.** El objetivo de la Fase 1 es uno solo: *dejar de abrir el Google Sheet*.
- Cada función nueva debe responder: "¿esto me hace registrar más, pagar a tiempo o ahorrar más?". Si no, va a la Fase 3 o se descarta.
- Usa tú la app primero. Invita a la familia cuando ya no la cambies todos los días.

### 2.2 La disciplina de registro importa más que las funciones
La mejor app del mundo no sirve si dejas de registrar a las 3 semanas. Por eso:
- **El monto del estado de cuenta manda** (RN-05). Aunque no registres todo, las quincenas siempre cuadran. Esto es lo que hace que la app sea útil desde el día 1 sin exigir perfección.
- El bot debe ser rapidísimo y perdonar errores ("cafe 65" sin acento ni tarjeta → usa la tarjeta default).
- No obligues a registrar todo: lo importante son las tarjetas y los gastos hormiga en efectivo o débito.

### 2.3 Usa la IA solo donde aporta
- Un **parser local** (expresiones regulares + diccionario de comercios aprendidos) resuelve el 80–90% de los mensajes ("tacos 180 bbva") en milisegundos y gratis.
- La IA (Claude) entra solo para mensajes ambiguos, voz y fotos de tickets. Así el bot es más rápido, barato y sigue funcionando si la API falla.
- Nunca dejes que la IA decida montos sin confirmación: el bot siempre muestra lo que entendió con un botón [Editar].

### 2.4 Hospedar datos financieros de tu familia en casa es una responsabilidad
Es buena decisión (control y privacidad), pero asúmela en serio:
- **Respaldos fuera de casa sí o sí.** Un disco que muere, un apagón o un robo no pueden borrar el historial de todos. Mínimo: `pg_dump` diario cifrado hacia una nube o un disco que no esté en el mismo lugar, y una **prueba de restauración** de vez en cuando.
- **Cloudflare Tunnel** en lugar de abrir puertos del router: menos superficie de ataque y HTTPS automático.
- Actualiza el sistema operativo y los contenedores; activa actualizaciones automáticas de seguridad.
- La base de datos nunca se expone a internet.
- La app **nunca** pide números de tarjeta, CVV ni contraseñas bancarias: solo nombres. Si alguien entra, no hay nada que robar más allá de montos.
- Pruebas automáticas de aislamiento entre usuarios (CA-21) desde el primer endpoint. Es el error más grave posible en una app multiusuario.

### 2.5 Fechas y dinero: lo único que debe ser perfecto
- Dinero en **enteros de centavos**, nunca `float`.
- Toda la lógica de ciclos, quincenas, MSI y metas en `packages/core` como funciones puras con pruebas. Usa tus 25 pestañas del Sheet como **casos de prueba reales**: si la app calcula lo mismo que tu Sheet, está bien.
- Zona horaria fija `America/Mexico_City`, días festivos de México en una tabla y fechas con `date-fns-tz` o `Temporal`.

### 2.6 Notificaciones: Telegram primero
- En **Android** (tu plataforma principal) las push de una PWA funcionan muy bien, casi como una app nativa. En **iPhone** funcionan, pero dependen de que la app esté instalada en inicio y de que aceptes permisos, y a veces iOS las retrasa. **Telegram es el canal confiable**; la push es un extra.
- Cola persistente (pg-boss sobre Postgres) con clave única por aviso: si el servidor se apaga, los avisos salen al volver y nunca se duplican.
- Menos es más: demasiadas notificaciones = las silencias y pierdes el aviso importante. Por eso los defaults son conservadores y el recordatorio de registro viene apagado.

### 2.7 Decisiones técnicas que ya recomendé y por qué
| Decisión | Por qué |
|---|---|
| Un solo bot de Telegram | Telegram no permite crear bots desde código; uno solo con vinculación es lo estándar. |
| Next.js para web + API + webhook | Un solo proyecto, un solo despliegue, un solo lenguaje. |
| Postgres + pg-boss | La cola vive en la misma base de datos: no necesitas Redis. Menos piezas en tu servidor. |
| Better Auth | Auth moderna, self-hosted, sin depender de servicios externos. |
| Drizzle | Tipado fuerte, SQL claro y migraciones simples. |
| PWA en vez de app nativa | Sin App Store ni cuenta de desarrollador de $99 USD/año; se instala desde Safari. |
| Sin conexión bancaria | En México es caro, frágil y riesgoso para la privacidad. El monto del estado de cuenta + el bot cubren el 95% del valor. |

### 2.8 Lo que NO haría
- **Gamificación pesada** (puntos, niveles, insignias) antes de tener el núcleo estable. Los hitos de metas con 🎉 bastan.
- **Microservicios.** Con 20 usuarios, un monolito con un worker es lo correcto.
- **App nativa** hasta que la PWA quede corta (no va a pasar pronto).
- **Scraping de bancos.** Se rompe cada mes y puede violar los términos del banco.
- **Inversiones o cripto** dentro de la app.

---

## 3. Ideas evaluadas

| Idea | Valor para tus finanzas | Esfuerzo | Veredicto |
|---|---|---|---|
| Plan de quincena al cobrar (págate primero) | Muy alto | Bajo | **Fase 2, prioridad alta** |
| Fondo de emergencia calculado | Muy alto | Bajo | **Fase 2** |
| Fondos de previsión (diciembre, carro) | Alto | Bajo | **Fase 2** |
| Simulador de MSI | Alto (ataca la compra impulsiva) | Medio | **Fase 2** |
| Avisos de fecha límite | Muy alto (evita intereses) | Bajo | **Fase 1** |
| Panel de salud financiera | Alto | Medio | Fase 2 |
| Metas de viaje + modo viaje | Medio–alto | Medio | Fase 2 |
| Lista de deseos con 72 h | Alto si compras por impulso | Bajo | Fase 3 (o antes si te identificas) |
| Me deben | Medio | Bajo | Fase 3 |
| Negocio de internet (retorno de inversión) | Medio | Medio | Fase 3 |
| Detector de suscripciones | Medio | Medio | Fase 3 |
| "Costo en horas de trabajo" de cada compra | Medio (efecto psicológico) | Muy bajo | Extra fácil de agregar al simulador |
| Retos (semana sin antojos) | Bajo–medio | Medio | Después |
| Conexión bancaria | Medio | Muy alto | No |
