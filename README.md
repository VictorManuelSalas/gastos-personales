# Quincena

App de finanzas personales para la familia: tarjetas, quincenas, metas y un bot de Telegram. Corre en tu propio servidor con Docker.

- Producto: [docs/PRD.md](docs/PRD.md)
- Recomendaciones: [docs/RECOMENDACIONES.md](docs/RECOMENDACIONES.md)
- Prototipo visual: [docs/diseno/prototipo.html](docs/diseno/prototipo.html)

**Estado:** Fase 0 (base) lista: registro por invitación, inicio de sesión, PWA instalable y despliegue con Docker.

## Requisitos

Solo **Docker** (con Compose). No hace falta instalar Node: todo corre en contenedores.

## Primer arranque

```bash
cp .env.example .env
```

Edita `.env` y pon secretos reales (puedes generarlos con `openssl rand -hex 32`).

### Modo servidor (lo que usarías en casa)

```bash
docker compose up -d --build
```

Abre http://localhost:3100. Como aún no hay usuarios, la primera cuenta que crees en **/registro** será la del **administrador**. Desde **Invitaciones** generas los enlaces para tu familia.

### Modo desarrollo (recarga en caliente)

```bash
docker compose -f compose.yaml -f compose.dev.yaml up db dev
```

Usa el mismo puerto (3100). Detén el contenedor `web` antes si está corriendo: `docker compose stop web`.

## Comandos útiles

| Qué | Comando |
|---|---|
| Ver estado | `docker compose ps` |
| Ver logs | `docker compose logs -f web` |
| Typecheck | `docker compose -f compose.yaml -f compose.dev.yaml run --rm --no-deps dev sh -c "corepack enable && pnpm -r typecheck"` |
| Nueva migración (tras cambiar `packages/db/src/schema.ts`) | `docker compose -f compose.yaml -f compose.dev.yaml run --rm --no-deps dev sh -c "corepack enable && pnpm db:generate"` |
| Entrar a la base de datos | `docker compose exec db psql -U quincena -d quincena` |

Las migraciones se aplican solas al arrancar la app.

## Acceso desde el teléfono (HTTPS con tu dominio)

Android solo deja instalar la app y recibir notificaciones si se abre por HTTPS:

1. En Cloudflare Zero Trust crea un túnel con un hostname público (p. ej. `quincena.tu-dominio.com`) que apunte a `http://web:3000`.
2. En `.env`, pon `APP_URL=https://quincena.tu-dominio.com` y `CLOUDFLARE_TUNNEL_TOKEN=<token del túnel>`.
3. Arranca con el perfil del túnel:

```bash
docker compose --profile tunnel up -d --build
```

4. Abre el dominio en Chrome (Android) y toca **Instalar app**.

## Estructura

```
apps/web        Next.js 15 (UI, API, auth, PWA)
packages/db     Esquema Drizzle + migraciones SQL
docs/           PRD, recomendaciones, prototipo (docs/privado no se sube)
```

## Puertos

3000 y 5432 ya los usan otros proyectos en esta Mac, así que la app usa **3100** y Postgres **5442** (solo desde localhost). Se cambian en `.env`.
