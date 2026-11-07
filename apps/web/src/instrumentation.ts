// Se ejecuta una vez al arrancar el servidor: aplica migraciones y arranca los avisos.
// El import condicional evita que el código de Node (pg) entre al bundle de Edge.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.RUN_MIGRATIONS !== "false") {
      const { runMigrations } = await import("./server/migrate");
      await runMigrations();
    }
    const { startReminderLoop } = await import("./server/telegram/reminders");
    startReminderLoop();
  }
}
