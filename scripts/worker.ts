/**
 * Long-running background worker for hosts without a managed scheduler (Render, Railway, a VM).
 * On Vercel, use vercel.json crons hitting /api/cron/* instead — do not run both.
 *
 *   npm run worker            → loops forever
 *   npm run worker -- --once  → runs every job group once and exits (useful for system cron)
 */
import "dotenv/config";
import { sqlClient } from "@/lib/db";
import { runGroup } from "@/lib/services/jobs";

const FREQUENT_MS = 60_000; // notifications + AI critiques every minute
const HOURLY_MS = 60 * 60_000;
const DAILY_MS = 24 * 60 * 60_000;

const log = (msg: string, extra: Record<string, unknown> = {}) => console.log(JSON.stringify({ level: "info", msg, at: new Date().toISOString(), ...extra }));

async function main() {
  if (process.argv.includes("--once")) {
    for (const g of ["frequent", "hourly", "daily"]) log(`group ${g}`, { results: await runGroup(g) });
    await sqlClient.end();
    return;
  }
  let lastHourly = 0;
  let lastDaily = 0;
  let stopping = false;
  process.on("SIGTERM", () => (stopping = true));
  process.on("SIGINT", () => (stopping = true));
  log("worker started");
  while (!stopping) {
    const now = Date.now();
    try {
      await runGroup("frequent");
      if (now - lastHourly >= HOURLY_MS) {
        await runGroup("hourly");
        lastHourly = now;
      }
      if (now - lastDaily >= DAILY_MS) {
        await runGroup("daily");
        lastDaily = now;
      }
    } catch (e) {
      console.error(JSON.stringify({ level: "error", msg: "worker cycle failed", error: String(e) }));
    }
    await new Promise((r) => setTimeout(r, FREQUENT_MS));
  }
  log("worker stopping");
  await sqlClient.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
