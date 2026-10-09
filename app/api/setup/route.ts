import { query } from "@/lib/db";
import { HttpError, baseUrl, handle, json, safeEqual } from "@/lib/http";
import { SCHEMA } from "@/lib/schema";
import { getApi } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * One-time setup. Open this in the browser after every deploy of a NEW address:
 *   https://YOUR-APP.vercel.app/api/setup?secret=YOUR_WEBHOOK_SECRET
 * It creates the database tables, connects Telegram to the app, and sets the
 * "Open App" button next to the chat box. It is safe to run again.
 */
export const GET = handle(async (req: Request) => {
  const secret = process.env.WEBHOOK_SECRET || "";
  const given = new URL(req.url).searchParams.get("secret") || "";
  if (!secret) throw new HttpError(500, "WEBHOOK_SECRET is not set in the Vercel environment variables.");
  if (!safeEqual(given, secret)) throw new HttpError(401, "Wrong or missing secret in the address.");

  const base = baseUrl(req);
  if (!base.startsWith("https://")) {
    throw new HttpError(400, "Telegram needs an https:// address. Open this page on your https Vercel address.");
  }
  const steps: Record<string, string> = {};

  // 1. Database tables
  for (const statement of SCHEMA) await query(statement);
  steps.database = "tables are ready";

  // 2. Telegram webhook
  const api = getApi();
  const me = await api.getMe();
  await api.setWebhook(`${base}/api/bot`, {
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  steps.webhook = `${base}/api/bot`;

  // 3. Menu button + command list
  await api.setChatMenuButton({
    menu_button: { type: "web_app", text: "Open App", web_app: { url: base } },
  });
  await api.setMyCommands([{ command: "start", description: "Open the app or request access" }]);
  steps.menu_button = "set";

  return json({
    ok: true,
    bot: `@${me.username}`,
    app_url: base,
    steps,
    next: `Open Telegram, send /start to @${me.username}, then tap "Open Link Shortener".`,
  });
});
