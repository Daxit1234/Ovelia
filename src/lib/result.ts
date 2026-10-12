import type { z } from "zod";

/** Standard return shape for Server Actions consumed by client components. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail<T = never>(error: string, fieldErrors?: Record<string, string[]>): ActionResult<T> {
  return { ok: false, error, fieldErrors };
}

export function zodFail<T = never>(error: z.ZodError, message = "Please correct the highlighted fields."): ActionResult<T> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { ok: false, error: message, fieldErrors };
}

/** An error whose message is safe to show to end users. */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code = "APP_ERROR", status = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super(message, "FORBIDDEN", 403);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

/** Converts unknown errors into an ActionResult without leaking internals. */
export function toActionError<T = never>(error: unknown, fallback = "Something went wrong. Please try again."): ActionResult<T> {
  if (error instanceof AppError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: fallback };
}
