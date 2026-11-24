/** Display metadata for scholarship windows and categories (client-safe). */
export type WindowStatus = "open" | "opens_soon" | "closed" | "not_announced" | "paused";
export type Category = "ug_africa" | "ug_extra_africa" | "ug_outside_africa" | "pg_africa" | "pg_outside_africa";

export const WINDOW_LABELS: Record<WindowStatus, string> = {
  open: "Open",
  opens_soon: "Opens soon",
  closed: "Closed",
  not_announced: "Not announced",
  paused: "Paused",
};
export const WINDOW_TONES = { open: "success", opens_soon: "info", closed: "neutral", not_announced: "warning", paused: "danger" } as const;
export const WINDOW_ORDER: WindowStatus[] = ["open", "opens_soon", "not_announced", "closed", "paused"];

export const CATEGORY_LABELS: Record<Category, string> = {
  ug_africa: "Undergraduate — in Africa",
  ug_extra_africa: "Undergraduate — additional African partners (TAGDev)",
  ug_outside_africa: "Undergraduate — outside Africa",
  pg_africa: "Postgraduate — in Africa",
  pg_outside_africa: "Postgraduate — outside Africa",
};
export const CATEGORY_SHORT: Record<Category, string> = {
  ug_africa: "UG · Africa",
  ug_extra_africa: "UG · Extra (Africa)",
  ug_outside_africa: "UG · Outside Africa",
  pg_africa: "PG · Africa",
  pg_outside_africa: "PG · Outside Africa",
};
export const CATEGORY_ORDER: Category[] = ["ug_africa", "ug_extra_africa", "ug_outside_africa", "pg_africa", "pg_outside_africa"];

/** Applications (and planning) can be started only while a window is open or about to open. */
export const canStartApplication = (w: WindowStatus) => w === "open" || w === "opens_soon";
