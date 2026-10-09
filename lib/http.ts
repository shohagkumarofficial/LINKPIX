import { timingSafeEqual } from "node:crypto";

export class HttpError extends Error {
  status: number;
  extra?: Record<string, unknown>;
  constructor(status: number, message: string, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/** Wrap a route handler so thrown HttpErrors become clean JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) {
        return json({ error: e.message, ...(e.extra ?? {}) }, e.status);
      }
      console.error(e);
      return json({ error: "Something went wrong on the server." }, 500);
    }
  };
}

export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new HttpError(500, `Missing environment variable: ${name}`);
  return v;
}

/** The public address of the app, e.g. https://my-app.vercel.app (no trailing slash). */
export function baseUrl(req: Request): string {
  const fixed = process.env.APP_URL?.trim();
  if (fixed) return fixed.replace(/\/+$/, "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    return `${proto}://${host}`;
  }
  return new URL(req.url).origin;
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function readJson(req: Request): Promise<Record<string, any>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}
