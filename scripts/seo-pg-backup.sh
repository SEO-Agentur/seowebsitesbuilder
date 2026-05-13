#!/bin/bash
# Nightly Postgres dump for seowebsitesbuilder. 7-day rolling retention.
#
# Install on the VPS:
#   sudo install -m 755 scripts/seo-pg-backup.sh /usr/local/bin/seo-pg-backup.sh
#   ( crontab -l 2>/dev/null; echo "30 3 * * * /usr/local/bin/seo-pg-backup.sh >/dev/null 2>&1" ) | crontab -
#
# Restore from a dump:
#   gunzip -c /var/backups/seowebsitesbuilder/seobuilder-YYYYMMDD-HHMMSS.sql.gz \
#     | docker compose exec -T postgres psql -U seo -d seobuilder
set -euo pipefail
BACKUP_DIR=/var/backups/seowebsitesbuilder
mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/seobuilder-$TS.sql.gz"

# pg_dump runs inside the postgres container; gzip on the host saves CPU.
docker compose -f /opt/seowebsitesbuilder/docker-compose.yml exec -T postgres \
  pg_dump -U seo -d seobuilder --no-owner --no-privileges \
  | gzip -9 > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
chmod 600 "$OUT"

# Prune dumps older than 7 days.
find "$BACKUP_DIR" -name "seobuilder-*.sql.gz" -type f -mtime +7 -delete

SIZE=$(du -h "$OUT" | cut -f1)
COUNT=$(ls -1 "$BACKUP_DIR"/seobuilder-*.sql.gz 2>/dev/null | wc -l)
logger -t seo-pg-backup "ok: $OUT ($SIZE), $COUNT dumps retained"
