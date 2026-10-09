import { handle, json } from "@/lib/http";
import { getStats, resolveRange, validTimeZone } from "@/lib/stats";
import { requireUser } from "@/lib/users";

export const dynamic = "force-dynamic";

/**
 * GET /api/stats?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=Asia/Dhaka&link=abc123&scope=all
 * All parameters are optional. Defaults to the last 7 days of your own links.
 */
export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  const q = new URL(req.url).searchParams;

  const tz = validTimeZone(q.get("tz"));
  const range = resolveRange(q.get("from"), q.get("to"), tz);
  const all = q.get("scope") === "all" && user.is_admin;
  const code = q.get("link")?.trim().toLowerCase() || null;

  const stats = await getStats({
    owner: all ? null : user.telegram_id,
    code,
    range,
    tz,
  });
  return json(stats);
});
