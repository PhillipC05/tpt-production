import path from "node:path";
import { fileURLToPath } from "node:url";

// Must be set before any module import that reads DATABASE_URL
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const testDbPath = path.join(repoRoot, "apps/api/test.db");

process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.NODE_ENV = "test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.ADMIN_API_TOKEN = "test-admin-token";
process.env.ENABLE_CREDITS = "true";
process.env.ENABLE_DRM = "true";
