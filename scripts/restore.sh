#!/usr/bin/env bash
# Restaura un respaldo hecho con scripts/backup.sh.
# Uso, desde la carpeta del proyecto:
#   bash scripts/restore.sh backups/20261110T093000Z            # carpeta local
#   bash scripts/restore.sh 20261110T093000Z                    # la baja del bucket (BACKUP_S3_*)
#   bash scripts/restore.sh 20261110T093000Z --prueba           # prueba: no toca tus datos
#
# Sin --prueba REEMPLAZA la base actual: detiene la web, restaura y la vuelve a arrancar.
# Con --prueba restaura en una base temporal, cuenta los registros y la borra. Hazla cada mes.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=${1:?Indica la carpeta del respaldo (backups/20261110T093000Z) o su nombre en el bucket}
TEST=$([ "${2:-}" = "--prueba" ] && echo 1 || echo "")
. scripts/_env.sh; load_env .env
FILE=quincena.dump

if [ ! -d "$SRC" ]; then
  : "${BACKUP_S3_BUCKET:?No existe la carpeta $SRC y no hay BACKUP_S3_BUCKET para bajarla}"
  DEST="${BACKUP_DIR:-./backups}/restaurar-$SRC"
  mkdir -p "$DEST"
  docker run --rm -v "$(cd "$DEST" && pwd):/dest" \
    -e AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" -e AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" -e AWS_DEFAULT_REGION=auto \
    amazon/aws-cli s3 cp "s3://$BACKUP_S3_BUCKET/$SRC/" /dest/ --recursive --endpoint-url "$BACKUP_S3_ENDPOINT" --only-show-errors
  SRC=$DEST
fi
[ -s "$SRC/$FILE" ] || { echo "✖ $SRC no tiene $FILE"; exit 1; }
if [ -f "$SRC/SHA256SUMS" ]; then
  (cd "$SRC" && if command -v sha256sum >/dev/null; then sha256sum -c SHA256SUMS; else shasum -a 256 -c SHA256SUMS; fi >/dev/null) || { echo "✖ El respaldo está dañado (SHA256SUMS)"; exit 1; }
fi
psql() { docker compose exec -T -e PGOPTIONS=--client-min-messages=warning db psql -U quincena -v ON_ERROR_STOP=1 "$@"; }

# Antes de tocar nada: un pg_dump en formato custom empieza con "PGDMP".
[ "$(head -c 5 "$SRC/$FILE")" = "PGDMP" ] || { echo "✖ $FILE no es un respaldo de pg_dump"; exit 1; }

if [ -n "$TEST" ]; then
  DB=quincena_prueba_restauracion
  psql -d postgres -qc "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
  trap 'psql -d postgres -qc "DROP DATABASE IF EXISTS $DB"' EXIT
  docker compose exec -T db pg_restore -U quincena -d "$DB" --no-owner --single-transaction < "$SRC/$FILE"
  echo "✔ El respaldo se restauró. Registros:"
  psql -d "$DB" -c 'SELECT (SELECT count(*) FROM "user") AS usuarios, (SELECT count(*) FROM txn) AS movimientos, (SELECT count(*) FROM credit_line) AS tarjetas, (SELECT count(*) FROM cycle) AS ciclos'
  exit 0
fi

if [ -z "${FORCE:-}" ]; then
  read -r -p "Se reemplazará la base de Quincena con $SRC. Escribe RESTAURAR para continuar: " answer
  [ "$answer" = "RESTAURAR" ] || { echo "Cancelado"; exit 1; }
fi
docker compose stop web
# La web vuelve a arrancar aunque la restauración falle (--single-transaction deja la base como estaba).
trap 'docker compose start web' EXIT
docker compose exec -T db pg_restore -U quincena -d quincena --clean --if-exists --no-owner --single-transaction < "$SRC/$FILE"
echo "✔ Restaurado desde $SRC"
