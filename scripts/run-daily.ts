/**
 * Runs the daily job (reminders, expiry, junior age-out, housekeeping) directly,
 * for servers that use system cron instead of calling /api/cron/daily:
 *   0 6 * * *  cd /srv/club && npm run cron:daily >> /var/log/club-cron.log 2>&1
 */
import { runDaily } from "../src/lib/membership";

runDaily()
  .then((r) => {
    console.log(new Date().toISOString(), JSON.stringify(r));
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
