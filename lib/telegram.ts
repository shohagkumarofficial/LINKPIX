import { createHmac, timingSafeEqual } from "node:crypto";
import { Api } from "grammy";
import { env } from "./http";

export interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export function getApi(): Api {
  return new Api(env("BOT_TOKEN"));
}

/**
 * Checks the signed data Telegram gives a Mini App (`initData`).
 * Without this check anyone could call our API pretending to be any user.
 * Returns the Telegram user, or null if the data is fake or too old.
 */
export function verifyInitData(initData: string, botToken: string, maxAgeSeconds = 60 * 60 * 24): TgUser | null {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) return null;

  try {
    const user = JSON.parse(params.get("user") || "null");
    if (!user || typeof user.id !== "number") return null;
    return user as TgUser;
  } catch {
    return null;
  }
}

export function displayName(u: { first_name?: string | null; last_name?: string | null; username?: string | null }): string {
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return full || (u.username ? `@${u.username}` : "Unknown");
}
