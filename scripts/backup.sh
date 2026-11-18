#!/usr/bin/env bash
# Nightly backup: compressed PostgreSQL dump + encrypted uploads, keeping 30 days.
#   0 2 * * *  cd /srv/club && npm run backup >> /var/log/club-backup.log 2>&1
# Copy BACKUP_DIR off the server (e.g. rclone to S3/Backblaze) — a backup on the same disk is not a backup.
# Uploads are already encrypted with DATA_ENCRYPTION_KEY; store that key separately from the backups.
set -euo pipefail
set -a; [ -f .env ] && . ./.env; set +a
BACKUP_DIR="${BACKUP_DIR:-./backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
pg_dump --no-owner --format=custom "${DATABASE_URL%%\?*}" > "$BACKUP_DIR/db-$STAMP.dump"
tar -czf "$BACKUP_DIR/uploads-$STAMP.tgz" -C "$(dirname "${UPLOAD_DIR:-./storage/uploads}")" "$(basename "${UPLOAD_DIR:-./storage/uploads}")" 2>/dev/null || true
find "$BACKUP_DIR" -type f -mtime +30 -delete
echo "$(date -Iseconds) backup ok: db-$STAMP.dump"
