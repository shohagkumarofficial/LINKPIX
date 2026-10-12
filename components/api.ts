import { initData } from "./tg";

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api<T = any>(path: string, opts: { method?: string; json?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.json !== undefined ? "POST" : "GET"),
      headers: {
        "x-telegram-init-data": initData(),
        ...(opts.json !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "No connection. Check your internet and try again.");
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) throw new ApiError(res.status, data?.error || `Request failed (${res.status}).`, data);
  return data as T;
}

/** Uploads a picture file and returns its public address. */
export async function uploadImage(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);

  let res: Response;
  try {
    res = await fetch("/api/upload", {
      method: "POST",
      headers: { "x-telegram-init-data": initData() },
      body,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "No connection. Check your internet and try again.");
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) throw new ApiError(res.status, data?.error || "Couldn't upload the picture.", data);
  return data.url as string;
}
