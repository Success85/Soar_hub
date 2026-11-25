import { z } from "zod";

/**
 * Server-side environment. Never import this from client components:
 * only NEXT_PUBLIC_* values are ever exposed to the browser.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).default("postgresql://soar:soar@localhost:5432/soar_hub"),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(32).default("dev-only-insecure-session-secret-change-me-0000"),
  SESSION_IDLE_MINUTES: z.coerce.number().int().positive().default(30),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().int().positive().default(12),
  CRON_SECRET: z.string().min(16).default("dev-only-cron-secret-change-me"),

  STORAGE_DRIVER: z.enum(["s3", "local"]).default("local"),
  STORAGE_BUCKET: z.string().default("soar-documents"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("true"),
  LOCAL_STORAGE_DIR: z.string().default(".dev-storage"),

  EMAIL_PROVIDER: z.enum(["resend", "sendgrid", "smtp", "console", "none"]).default("console"),
  EMAIL_PROVIDER_API_KEY: z.string().optional(),
  // SMTP (e.g. Gmail with an App Password): EMAIL_PROVIDER=smtp
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default("SOAR Hub <no-reply@localhost>"),
  EMAIL_WEBHOOK_SECRET: z.string().optional(),

  SMS_PROVIDER: z.enum(["africastalking", "console", "none"]).default("none"),
  SMS_PROVIDER_API_KEY: z.string().optional(),
  SMS_PROVIDER_USERNAME: z.string().optional(),
  SMS_SENDER_ID: z.string().optional(),
  SMS_WEBHOOK_SECRET: z.string().optional(),

  // Payments (Flutterwave). Secret key from Dashboard → Settings → API keys; secret hash from Settings → Webhooks.
  FLW_SECRET_KEY: z.string().optional(),
  FLW_SECRET_HASH: z.string().optional(),
  FLW_API_BASE: z.string().url().default("https://api.flutterwave.com/v3"),

  AI_PROVIDER: z.enum(["anthropic", "openai", "none"]).default("none"),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),

  EMBEDDINGS_PROVIDER: z.enum(["openai", "voyage", "none"]).default("none"),
  EMBEDDINGS_API_KEY: z.string().optional(),
  EMBEDDINGS_MODEL: z.string().optional(),

  CLAMAV_HOST: z.string().optional(),
  CLAMAV_PORT: z.coerce.number().int().default(3310),

  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("Invalid environment configuration: " + parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  const env = parsed.data;
  if (env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    const problems: string[] = [];
    if (!process.env.SESSION_SECRET) problems.push("SESSION_SECRET must be set");
    if (!process.env.CRON_SECRET) problems.push("CRON_SECRET must be set");
    if (env.STORAGE_DRIVER === "local") problems.push("STORAGE_DRIVER=local is not permitted in production (use s3)");
    if (env.EMAIL_PROVIDER === "console") problems.push("EMAIL_PROVIDER=console is not permitted in production");
    if (env.EMAIL_PROVIDER === "smtp" && (!env.SMTP_USER || !env.SMTP_PASSWORD)) problems.push("EMAIL_PROVIDER=smtp needs SMTP_USER and SMTP_PASSWORD");
    if (problems.length) throw new Error("Production configuration error: " + problems.join("; "));
  }
  return env;
}

export const env = load();
export const isProd = env.NODE_ENV === "production";
