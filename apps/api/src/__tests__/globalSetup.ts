import { execSync } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
export const TEST_DB_PATH = path.join(repoRoot, "apps/api/test.db");
const DB_PACKAGE_DIR = path.join(repoRoot, "packages/db");

export async function setup() {
  process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
  process.env.NODE_ENV = "test";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.ADMIN_API_TOKEN = "test-admin-token";

  // Apply migrations to the isolated test DB
  execSync("pnpm prisma migrate deploy", {
    cwd: DB_PACKAGE_DIR,
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB_PATH}` },
    stdio: "pipe",
  });
}

export async function teardown() {
  // Windows may hold a file lock until the process exits; ignore the error.
  await rm(TEST_DB_PATH, { force: true }).catch(() => {});
  await rm(`${TEST_DB_PATH}-journal`, { force: true }).catch(() => {});
}
