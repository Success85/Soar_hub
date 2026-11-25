import "server-only";
import { inArray } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/lib/db";
import { platformSettings } from "@/lib/db/schema";

/** Non-secret platform configuration. Secrets live only in environment variables. */
export const SETTING_DEFAULTS = {
  platform_name: "SOAR Hub",
  logo_url: "",
  brand_colors: { navy: "#0B1F3A", gold: "#D4A72C", blue: "#2563EB", ivory: "#FAF8F2" },
  support_email: "support@soarhub.ng",
  contact_phone: "",
  contact_address: "Lagos, Nigeria",
  admin_alert_email: "",
  timezone: "Africa/Lagos",
  upload_max_mb: 10,
  allowed_file_types: ["pdf", "docx", "jpeg", "png"],
  reminder_offsets_days: [7, 1, 0],
  overdue_reminders_enabled: true,
  sms_enabled: true,
  ai_enabled: true,
  ai_auto_generate_on_submit: true,
  referee_link_days: 14,
  notify_admin_on_referee_submission: true,
  registration_open: true,
  membership_required: true,
  membership_price_ngn: 25000,
  membership_duration_months: 12,
  maintenance_mode: false,
  maintenance_message: "SOAR Hub is undergoing scheduled maintenance. Please check back shortly.",
  terms_markdown: "",
  privacy_markdown: "",
  terms_version: "2026-11",
  privacy_version: "2026-11",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = { -readonly [K in SettingKey]: (typeof SETTING_DEFAULTS)[K] extends readonly (infer U)[] ? U[] : (typeof SETTING_DEFAULTS)[K] extends object ? { [P in keyof (typeof SETTING_DEFAULTS)[K]]: string } : (typeof SETTING_DEFAULTS)[K] extends boolean ? boolean : (typeof SETTING_DEFAULTS)[K] extends number ? number : string };

export const getSettings = cache(async (): Promise<Settings> => {
  let rows: (typeof platformSettings.$inferSelect)[] = [];
  try {
    rows = await db.select().from(platformSettings);
  } catch (e) {
    // Keep public pages rendering with defaults if the database is unreachable; the real error is logged.
    console.error(JSON.stringify({ level: "error", msg: "could not load platform settings (database unreachable or not migrated?)", error: e instanceof Error ? (e.cause instanceof Error ? e.cause.message : e.message) : String(e) }));
  }
  const out: Record<string, unknown> = { ...SETTING_DEFAULTS };
  for (const r of rows) if (r.key in SETTING_DEFAULTS) out[r.key] = r.value;
  return out as Settings;
});

export async function getSetting<K extends SettingKey>(key: K): Promise<Settings[K]> {
  return (await getSettings())[key];
}

export async function saveSettings(values: Partial<Settings>, actorId: string): Promise<{ previous: Record<string, unknown> }> {
  const keys = Object.keys(values).filter((k) => k in SETTING_DEFAULTS);
  const prevRows = keys.length ? await db.select().from(platformSettings).where(inArray(platformSettings.key, keys)) : [];
  const previous: Record<string, unknown> = {};
  for (const k of keys) previous[k] = prevRows.find((r) => r.key === k)?.value ?? (SETTING_DEFAULTS as Record<string, unknown>)[k];
  for (const k of keys) {
    const value = (values as Record<string, unknown>)[k];
    await db
      .insert(platformSettings)
      .values({ key: k, value: value as object, updatedBy: actorId })
      .onConflictDoUpdate({ target: platformSettings.key, set: { value: value as object, updatedBy: actorId, updatedAt: new Date() } });
  }
  return { previous };
}
