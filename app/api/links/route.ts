import { baseUrl, handle, json, readJson } from "@/lib/http";
import { cleanAlias, cleanCaption, cleanImageUrl, cleanTargetUrl, createLink, listLinks } from "@/lib/links";
import { requireUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  const url = new URL(req.url);
  const all = url.searchParams.get("scope") === "all" && user.is_admin;
  const links = await listLinks({
    owner: all ? null : user.telegram_id,
    search: url.searchParams.get("q") || "",
  });
  return json({ links, base_url: baseUrl(req), scope: all ? "all" : "mine" });
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);
  const body = await readJson(req);
  const base = baseUrl(req);
  const host = new URL(base).host;

  const link = await createLink(user.telegram_id, {
    target_url: cleanTargetUrl(body.target_url, host),
    image_url: cleanImageUrl(body.image_url),
    caption: cleanCaption(body.caption),
    alias: cleanAlias(body.alias),
  });

  return json({ link, short_url: `${base}/${link.code}` }, 201);
});
