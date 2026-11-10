#!/usr/bin/env bash
# Respaldo de la base de Quincena, con copia en un bucket privado de Cloudflare R2 (o cualquier S3).
# Uso, desde la carpeta del proyecto (con los contenedores en marcha):
#   bash scripts/backup.sh
#
# Variables del .env:
#   BACKUP_KEEP_DAYS      días que se conservan los respaldos, locales y en el bucket (30)
#   BACKUP_DIR            carpeta local (./backups)
#   BACKUP_S3_BUCKET      si se define, sube cada respaldo a ese bucket con:
#   BACKUP_S3_ENDPOINT    https://<cuenta>.r2.cloudflarestorage.com
#   BACKUP_S3_ACCESS_KEY  token de R2 con permiso solo sobre ese bucket
#   BACKUP_S3_SECRET_KEY
#   BACKUP_PING_URL       opcional: URL de Healthchecks.io; se le avisa al terminar o al fallar
#
# Diario a las 3:30 a. m. (crontab -e en el servidor):
#   30 3 * * * cd ~/apps/gastos-personales && bash scripts/backup.sh >> backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

. scripts/_env.sh; load_env .env
BACKUP_DIR=${BACKUP_DIR:-./backups}
KEEP_DAYS=${BACKUP_KEEP_DAYS:-30}
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="$BACKUP_DIR/$STAMP"
FILE=quincena.dump

ping() { if [ -n "${BACKUP_PING_URL:-}" ]; then curl -fsS -m 10 "$BACKUP_PING_URL$1" >/dev/null || true; fi; }
trap 'echo "✖ El respaldo falló"; ping /fail' ERR
sha256() { if command -v sha256sum >/dev/null; then sha256sum "$@"; else shasum -a 256 "$@"; fi; }
s3() {
  docker run --rm -v "$(cd "$BACKUP_DIR" && pwd):/backups:ro" \
    -e AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" -e AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" -e AWS_DEFAULT_REGION=auto \
    amazon/aws-cli "$@" --endpoint-url "$BACKUP_S3_ENDPOINT"
}

mkdir -p "$OUT"
echo "[$STAMP] Respaldando en $OUT"

# -T: sin TTY para no corromper el binario
docker compose exec -T db pg_dump -U quincena -d quincena --format=custom --no-owner > "$OUT/$FILE"

# Un pg_dump real pesa varios KB; menos que eso es que salió vacío.
[ "$(wc -c < "$OUT/$FILE")" -gt 1024 ] || { echo "✖ $FILE quedó vacío"; false; }
(cd "$OUT" && sha256 "$FILE" > SHA256SUMS)
echo "✔ $FILE $(du -h "$OUT/$FILE" | cut -f1)"

if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  s3 s3 cp "/backups/$STAMP" "s3://$BACKUP_S3_BUCKET/$STAMP/" --recursive --only-show-errors
  echo "✔ Subido a s3://$BACKUP_S3_BUCKET/$STAMP/"

  # Retención en el bucket: las carpetas se llaman con su fecha (UTC), así que se comparan como texto.
  CUTOFF=$(date -u -d "-$KEEP_DAYS days" +%Y%m%dT%H%M%SZ)
  s3 s3 ls "s3://$BACKUP_S3_BUCKET/" | awk '$1 == "PRE" { sub("/", "", $2); print $2 }' | while read -r prefix; do
    if [[ $prefix == 20* && $prefix < $CUTOFF ]]; then
      s3 s3 rm "s3://$BACKUP_S3_BUCKET/$prefix/" --recursive --only-show-errors
      echo "  borrado del bucket: $prefix"
    fi
  done
fi

# Retención local
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' -mtime +"$KEEP_DAYS" -exec rm -rf {} +
ping ""
