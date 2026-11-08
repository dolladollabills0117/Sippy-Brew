import { NextResponse } from "next/server";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (code: string, message: string) => new AppError(400, code, message);
export const unauthorized = () => new AppError(401, "UNAUTHORIZED", "Please log in.");
export const forbidden = (message = "You don't have access to that.") => new AppError(403, "FORBIDDEN", message);
export const notFound = (what = "That") => new AppError(404, "NOT_FOUND", `${what} wasn't found.`);

/** Friendly messages for errors raised inside the database functions. */
const DB_ERRORS: Record<string, [number, string]> = {
  DAILY_LIMIT: [409, "That would go over today's $8 limit."],
  CREDIT_CAP: [409, "Not enough credit left this month."],
  ORDER_TOTAL_MISMATCH: [400, "Order total didn't match the menu. Please try again."],
  EXPIRED: [410, "This code expired. Ask the member to refresh their QR."],
  ALREADY_REDEEMED: [409, "This code was already redeemed."],
  WRONG_SHOP: [403, "This order belongs to a different shop."],
  ORDER_CANCELLED: [409, "This order was cancelled."],
  INVALID_TRANSITION: [409, "That status change isn't allowed."],
  NOT_FOUND: [404, "Not found."],
};

export function fromDbError(err: { message?: string; code?: string } | null): AppError | null {
  if (!err) return null;
  const key = err.message?.trim() ?? "";
  const known = DB_ERRORS[key];
  if (known) return new AppError(known[0], key, known[1]);
  if (err.code === "23505") return new AppError(409, "CONFLICT", "That already exists.");
  return new AppError(500, "DB_ERROR", "Something went wrong. Please try again.");
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/** Wrap a route handler so thrown AppErrors become JSON error responses. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof AppError) return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: { code: "SERVER_ERROR", message: "Something went wrong. Please try again." } }, { status: 500 });
    }
  };
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw badRequest("BAD_JSON", "Request body must be JSON.");
  }
}
