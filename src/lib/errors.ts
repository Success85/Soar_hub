export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "bad_request",
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}
export class NotFoundError extends AppError {
  constructor(what = "Record") {
    super(`${what} not found.`, 404, "not_found");
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "You don't have permission to do that.") {
    super(message, 403, "forbidden");
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = "Please sign in to continue.") {
    super(message, 401, "unauthorized");
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Converts thrown errors into a safe result. Never leaks stack traces or internals. */
export function toActionError(e: unknown): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (e instanceof AppError) return { ok: false, error: e.message, fieldErrors: e.fieldErrors };
  if (e && typeof e === "object" && "issues" in e && Array.isArray((e as { issues: unknown[] }).issues)) {
    const fieldErrors: Record<string, string> = {};
    for (const i of (e as { issues: { path: (string | number)[]; message: string }[] }).issues) fieldErrors[i.path.join(".")] = i.message;
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors };
  }
  // redirect()/notFound() from next/navigation must propagate
  if (e && typeof e === "object" && "digest" in e && typeof (e as { digest: unknown }).digest === "string" && /NEXT_(REDIRECT|NOT_FOUND)/.test((e as { digest: string }).digest)) throw e;
  console.error(JSON.stringify({ level: "error", msg: "unhandled action error", error: e instanceof Error ? { name: e.name, message: e.message, stack: e.stack } : String(e) }));
  return { ok: false, error: "Something went wrong on our side. Please try again." };
}
