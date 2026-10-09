import { baseUrl, handle, json, readJson, HttpError } from "@/lib/http";
import { getApi } from "@/lib/telegram";
import { deleteUser, getUser, listUsers, requireAdmin, setUserStatus } from "@/lib/users";
import { InlineKeyboard } from "grammy";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  return json({ users: await listUsers() });
});

/** Body: { id: "123456", action: "approve" | "block" | "remove" } */
export const POST = handle(async (req: Request) => {
  await requireAdmin(req);
  const body = await readJson(req);
  const id = String(body.id ?? "");
  const action = String(body.action ?? "");
  if (!/^\d+$/.test(id)) throw new HttpError(400, "Missing user id.");

  const target = await getUser(id);
  if (!target) throw new HttpError(404, "User not found.");
  if (target.is_admin) throw new HttpError(400, "You can't change the admin account.");

  const api = getApi();

  if (action === "approve") {
    const wasApproved = target.status === "approved";
    await setUserStatus(id, "approved");
    if (!wasApproved) {
      await api
        .sendMessage(id, "✅ You now have access! Tap the button below to open the app.", {
          reply_markup: new InlineKeyboard().webApp("🔗 Open Link Shortener", baseUrl(req)),
        })
        .catch(() => {});
    }
  } else if (action === "block") {
    await setUserStatus(id, "blocked");
    await api.sendMessage(id, "Your access to this bot has been removed by the admin.").catch(() => {});
  } else if (action === "remove") {
    await deleteUser(id);
  } else {
    throw new HttpError(400, "Unknown action.");
  }

  return json({ ok: true, users: await listUsers() });
});
