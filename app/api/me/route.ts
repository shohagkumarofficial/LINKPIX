import { baseUrl, handle, json } from "@/lib/http";
import { identify } from "@/lib/users";

export const dynamic = "force-dynamic";

/** First call the Mini App makes: who am I, and do I have access? */
export const GET = handle(async (req: Request) => {
  const { tg, user } = await identify(req);
  return json({
    status: user?.status ?? "none",
    is_admin: Boolean(user?.is_admin),
    user: {
      id: String(tg.id),
      first_name: tg.first_name ?? null,
      username: tg.username ?? null,
    },
    base_url: baseUrl(req),
  });
});
