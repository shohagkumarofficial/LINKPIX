import { baseUrl, handle, json, readJson } from "@/lib/http";
import { cleanCaption, cleanImageUrl, cleanTargetUrl, deleteLink, getOwnedLink, updateLink } from "@/lib/links";
import { requireUser } from "@/lib/users";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser(req);
  const { code } = await ctx.params;
  const link = await getOwnedLink(code, user);
  const body = await readJson(req);
  const base = baseUrl(req);

  // Fields that are not sent keep their current value.
  const link2 = await updateLink(link.id, {
    target_url: "target_url" in body ? cleanTargetUrl(body.target_url, new URL(base).host) : link.target_url,
    image_url: "image_url" in body ? cleanImageUrl(body.image_url) : link.image_url,
    caption: "caption" in body ? cleanCaption(body.caption) : link.caption,
  });

  return json({ link: link2, short_url: `${base}/${link2.code}` });
});

export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser(req);
  const { code } = await ctx.params;
  const link = await getOwnedLink(code, user);
  await deleteLink(link.id);
  return json({ ok: true });
});
