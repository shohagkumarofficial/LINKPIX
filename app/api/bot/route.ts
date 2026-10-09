import { webhookCallback } from "grammy";
import { createBot } from "@/lib/bot";
import { baseUrl, safeEqual } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Telegram sends every message and button press here. */
export async function POST(req: Request): Promise<Response> {
  const secret = process.env.WEBHOOK_SECRET || "";
  const sent = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!secret || !safeEqual(sent, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const bot = createBot(baseUrl(req));
  const handler = webhookCallback(bot, "std/http");
  return handler(req);
}
