import path from "node:path";
import { fileURLToPath } from "node:url";

export const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const repoRoot = path.resolve(packageRoot, "..");
export const defaultDatabaseUrl = `file:${path.join(repoRoot, "packages/db/prisma/dev.db")}`;

process.env.DATABASE_URL = process.env.DATABASE_URL ?? defaultDatabaseUrl;

export const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
let redisHost = "localhost";
let redisPort = 6379;

try {
  const url = new URL(redisUrl);
  redisHost = url.hostname;
  redisPort = parseInt(url.port || "6379");
} catch {
  // keep defaults
}

export const redisConnection = { host: redisHost, port: redisPort };

export function getPort() {
  const configured = Number(process.env.PORT ?? 8787);
  return Number.isFinite(configured) && configured > 0 ? configured : 8787;
}

export function getLocalUploadDir() {
  const configured = process.env.LOCAL_UPLOAD_DIR;
  return configured ? path.resolve(repoRoot, configured) : path.join(repoRoot, "apps/api/uploads");
}