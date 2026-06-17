import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppBindings } from "../types/hono";

export type ApiContext = Context<AppBindings>;

export function jsonError(
  c: ApiContext,
  code: string,
  status: number,
  message = code.replace(/_/g, " ").toLowerCase(),
) {
  return c.json(
    {
      error: {
        code,
        message,
        details: { requestId: c.get("requestId") },
      },
    },
    status as ContentfulStatusCode,
  );
}

export function isPrismaKnownRequestError(
  err: unknown,
): err is { code: string; message: string; meta?: unknown } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as { code?: unknown }).code === "string" &&
    "message" in err &&
    typeof (err as { message?: unknown }).message === "string"
  );
}

export function prismaStatus(code: string) {
  if (code === "P2025") {
    return 404;
  }
  if (code === "P2002") {
    return 409;
  }
  if (code === "P2003") {
    return 400;
  }
  return 500;
}

export function safeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}