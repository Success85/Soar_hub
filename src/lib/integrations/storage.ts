import "server-only";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl as s3SignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { signPayload } from "@/lib/auth/tokens";
import { env, isProd } from "@/lib/env";
import { IntegrationNotConfiguredError } from "./errors";

/**
 * Private object storage. Production uses any S3-compatible bucket
 * (Supabase Storage S3 endpoint, AWS S3, Cloudflare R2). Objects are never public:
 * downloads are short-lived signed URLs issued only after an authorisation check.
 *
 * The "local" driver exists for development and automated tests only and is refused
 * in production by env validation.
 */
export interface StorageDriver {
  name: string;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  signedUrl(key: string, opts: { expiresInSeconds: number; filename: string; contentType: string; inline?: boolean }): Promise<string>;
}

function s3(): StorageDriver {
  if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new IntegrationNotConfiguredError("Storage", "S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required when STORAGE_DRIVER=s3");
  }
  const client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT || undefined,
    forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
  return {
    name: "s3",
    async put(key, body, contentType) {
      await client.send(new PutObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key, Body: body, ContentType: contentType }));
    },
    async get(key) {
      const out = await client.send(new GetObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key }));
      const bytes = await out.Body!.transformToByteArray();
      return Buffer.from(bytes);
    },
    async signedUrl(key, opts) {
      const cmd = new GetObjectCommand({
        Bucket: env.STORAGE_BUCKET,
        Key: key,
        ResponseContentType: opts.contentType,
        ResponseContentDisposition: `${opts.inline ? "inline" : "attachment"}; filename="${opts.filename.replace(/["\\\r\n]/g, "_")}"`,
      });
      return s3SignedUrl(client, cmd, { expiresIn: opts.expiresInSeconds });
    },
  };
}

function local(): StorageDriver {
  if (isProd) throw new IntegrationNotConfiguredError("Storage", "local storage is disabled in production");
  const root = path.resolve(process.cwd(), env.LOCAL_STORAGE_DIR);
  const safe = (key: string) => {
    const p = path.resolve(root, key);
    if (!p.startsWith(root + path.sep)) throw new Error("Invalid storage key");
    return p;
  };
  return {
    name: "local-dev",
    async put(key, body) {
      const p = safe(key);
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, body, { flag: "wx" }); // never overwrite an existing object
    },
    async get(key) {
      return readFile(safe(key));
    },
    async signedUrl(key, opts) {
      const exp = Math.floor(Date.now() / 1000) + opts.expiresInSeconds;
      const payload = `${key}|${exp}|${opts.filename}|${opts.contentType}|${opts.inline ? 1 : 0}`;
      const q = new URLSearchParams({ key, exp: String(exp), fn: opts.filename, ct: opts.contentType, inl: opts.inline ? "1" : "0", sig: signPayload(payload) });
      return `/api/dev-storage?${q.toString()}`;
    },
  };
}

let cached: StorageDriver | null = null;
export function storage(): StorageDriver {
  if (!cached) cached = env.STORAGE_DRIVER === "s3" ? s3() : local();
  return cached;
}

export function storageStatus() {
  if (env.STORAGE_DRIVER === "s3") {
    const missing = ["S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"].filter((k) => !process.env[k]);
    return { configured: missing.length === 0, provider: `S3-compatible (${env.S3_ENDPOINT ? new URL(env.S3_ENDPOINT).host : "AWS"})`, missing };
  }
  return { configured: !isProd, provider: "Local development storage (not for production)", missing: isProd ? ["STORAGE_DRIVER=s3"] : [] };
}
